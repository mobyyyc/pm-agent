import { z } from "zod";

export const agentScheduleDayOfWeekSchema = z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);
export const agentScheduleTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const agentScheduleConfigSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("manual") }),
  z.object({
    type: z.literal("interval"),
    every: z.number().int().min(1).max(24),
    unit: z.enum(["hour", "day"]),
  }),
  z.object({
    type: z.literal("daily"),
    time: agentScheduleTimeSchema,
  }),
  z.object({
    type: z.literal("weekdays"),
    time: agentScheduleTimeSchema,
  }),
  z.object({
    type: z.literal("weekly"),
    dayOfWeek: agentScheduleDayOfWeekSchema,
    time: agentScheduleTimeSchema,
  }),
]).superRefine((value, context) => {
  if (value.type !== "interval") return;

  if (value.unit === "hour" && 24 % value.every !== 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Hourly interval must divide evenly into 24 hours.",
      path: ["every"],
    });
  }

  if (value.unit === "day" && value.every !== 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Daily intervals greater than one day are not supported yet.",
      path: ["every"],
    });
  }
});

export type AgentScheduleConfig = z.infer<typeof agentScheduleConfigSchema>;

const dayIndexes: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

const dayLabels: Record<string, string> = {
  SUN: "Sunday",
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
};

type CronMatcher = {
  minutes: Set<number> | null;
  hours: Set<number> | null;
  daysOfWeek: Set<number> | null;
};

function parseIntegerField(value: string, min: number, max: number): Set<number> | null {
  if (value === "*") return null;

  const stepMatch = value.match(/^\*\/(\d+)$/);
  if (stepMatch) {
    const step = Number(stepMatch[1]);
    if (!Number.isInteger(step) || step <= 0) return null;
    const values = new Set<number>();
    for (let current = min; current <= max; current += step) {
      values.add(current);
    }
    return values;
  }

  const values = new Set<number>();
  for (const part of value.split(",")) {
    const number = Number(part);
    if (!Number.isInteger(number) || number < min || number > max) {
      return null;
    }
    values.add(number);
  }

  return values;
}

function parseDayOfWeekField(value: string): Set<number> | null {
  if (value === "*") return null;

  const values = new Set<number>();
  for (const part of value.toUpperCase().split(",")) {
    const range = part.split("-");
    if (range.length === 2) {
      const start = dayIndexes[range[0]];
      const end = dayIndexes[range[1]];
      if (start === undefined || end === undefined || start > end) return null;
      for (let current = start; current <= end; current += 1) {
        values.add(current);
      }
      continue;
    }

    const named = dayIndexes[part];
    if (named !== undefined) {
      values.add(named);
      continue;
    }

    const numeric = Number(part);
    if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 6) {
      values.add(numeric);
      continue;
    }

    return null;
  }

  return values;
}

function parseSupportedCron(schedule: string): CronMatcher | null {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  // MVP scheduler: supports the current catalog/user-facing subset only:
  // fixed or wildcard minutes, fixed/wildcard/step hours, wildcard day/month,
  // and wildcard/list/range day-of-week values such as MON or MON-FRI.
  if (dayOfMonth !== "*" || month !== "*") return null;

  const minutes = parseIntegerField(minute, 0, 59);
  const hours = parseIntegerField(hour, 0, 23);
  const daysOfWeek = parseDayOfWeekField(dayOfWeek);

  if (minutes === null && minute !== "*") return null;
  if (hours === null && hour !== "*") return null;
  if (daysOfWeek === null && dayOfWeek !== "*") return null;

  return { minutes, hours, daysOfWeek };
}

function matchesCron(date: Date, matcher: CronMatcher): boolean {
  const minute = date.getUTCMinutes();
  const hour = date.getUTCHours();
  const day = date.getUTCDay();

  return (
    (matcher.minutes === null || matcher.minutes.has(minute)) &&
    (matcher.hours === null || matcher.hours.has(hour)) &&
    (matcher.daysOfWeek === null || matcher.daysOfWeek.has(day))
  );
}

function plural(value: number, singular: string): string {
  return value === 1 ? singular : `${singular}s`;
}

function parseTime(time: string): { hour: number; minute: number } {
  const [hour, minute] = time.split(":").map(Number);
  return { hour, minute };
}

function formatTimeLabel(time: string): string {
  const { hour, minute } = parseTime(time);
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function parseScheduleConfig(input: unknown): AgentScheduleConfig {
  return agentScheduleConfigSchema.parse(input);
}

export function scheduleConfigToCron(config: AgentScheduleConfig): string | null {
  if (config.type === "manual") return null;

  if (config.type === "interval") {
    if (config.unit === "hour") {
      if (24 % config.every !== 0) {
        throw new Error("Hourly interval must divide evenly into 24 hours.");
      }
      return `0 */${config.every} * * *`;
    }

    if (config.every !== 1) {
      throw new Error("Daily intervals greater than one day are not supported yet.");
    }
    return "0 0 * * *";
  }

  const { hour, minute } = parseTime(config.time);
  if (config.type === "daily") return `${minute} ${hour} * * *`;
  if (config.type === "weekdays") return `${minute} ${hour} * * MON-FRI`;
  return `${minute} ${hour} * * ${config.dayOfWeek}`;
}

export function cronToScheduleConfig(cron: string | null): AgentScheduleConfig | null {
  if (!cron?.trim()) return { type: "manual" };

  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  if (dayOfMonth !== "*" || month !== "*") return null;

  const minuteNumber = Number(minute);
  const hourNumber = Number(hour);
  const time =
    Number.isInteger(minuteNumber) &&
    minuteNumber >= 0 &&
    minuteNumber <= 59 &&
    Number.isInteger(hourNumber) &&
    hourNumber >= 0 &&
    hourNumber <= 23
      ? `${String(hourNumber).padStart(2, "0")}:${String(minuteNumber).padStart(2, "0")}`
      : null;

  const hourStepMatch = hour.match(/^\*\/(\d+)$/);
  if (minute === "0" && hourStepMatch && dayOfWeek === "*") {
    const every = Number(hourStepMatch[1]);
    if (Number.isInteger(every) && every > 0 && every <= 24 && 24 % every === 0) {
      return { type: "interval", every, unit: "hour" };
    }
  }

  if (!time) return null;
  if (dayOfWeek === "*") return { type: "daily", time };
  if (dayOfWeek === "MON-FRI") return { type: "weekdays", time };
  const parsedDayOfWeek = agentScheduleDayOfWeekSchema.safeParse(dayOfWeek);
  if (parsedDayOfWeek.success) {
    return { type: "weekly", dayOfWeek: parsedDayOfWeek.data, time };
  }

  return null;
}

export function getScheduleDisplayLabel(input: AgentScheduleConfig | string | null): string {
  const config = typeof input === "string" || input === null ? cronToScheduleConfig(input) : input;
  if (!config) return "Runs on a custom schedule";

  if (config.type === "manual") return "Runs manually";
  if (config.type === "interval") {
    return `Runs every ${config.every} ${plural(config.every, config.unit)}`;
  }
  if (config.type === "daily") return `Runs every day at ${formatTimeLabel(config.time)}`;
  if (config.type === "weekdays") return `Runs every weekday at ${formatTimeLabel(config.time)}`;
  return `Runs every ${dayLabels[config.dayOfWeek]} at ${formatTimeLabel(config.time)}`;
}

export function calculateNextRunAt(schedule: string | null, from: Date | string): string | null {
  if (!schedule?.trim()) return null;

  const matcher = parseSupportedCron(schedule);
  if (!matcher) return null;

  const fromDate = from instanceof Date ? from : new Date(from);
  if (Number.isNaN(fromDate.getTime())) return null;

  const candidate = new Date(fromDate);
  candidate.setUTCSeconds(0, 0);
  candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);

  const maxMinutesToScan = 60 * 24 * 370;
  for (let index = 0; index < maxMinutesToScan; index += 1) {
    if (matchesCron(candidate, matcher)) {
      return candidate.toISOString();
    }
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  }

  return null;
}

export function calculateNextRunFromScheduleConfig(
  config: AgentScheduleConfig,
  from: Date | string,
): string | null {
  return calculateNextRunAt(scheduleConfigToCron(config), from);
}
