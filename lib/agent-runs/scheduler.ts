import type { ProjectAgent } from "@/types/models";

const dayIndexes: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

const supportedAgentIds = new Set(["risk-watch", "github-task-review"]);

type CronMatcher = {
  minutes: Set<number> | null;
  hours: Set<number> | null;
  daysOfWeek: Set<number> | null;
};

export type ScheduledAgentRunSummary = {
  checkedCount: number;
  dueCount: number;
  ranCount: number;
  skippedCount: number;
  failedCount: number;
  proposedCount: number;
  duplicateProposalCount: number;
  results: Array<{
    projectId: string;
    agentId: string;
    status: "ran" | "skipped" | "failed";
    reason?: string;
    runId?: string | null;
    createdProposalCount?: number;
    skippedProposalCount?: number;
    nextRunAt?: string | null;
    error?: string;
  }>;
};

export type ScheduledAgentRunnerDependencies = {
  getActiveProjectAgents(): Promise<ProjectAgent[]>;
  updateProjectAgentScheduleState(input: {
    projectId: string;
    agentId: string;
    lastRunAt: string | null;
    nextRunAt: string | null;
    timestamp: string;
  }): Promise<ProjectAgent | null>;
  runAgent(input: {
    projectId: string;
    agentId: string;
    triggerType: "scheduled";
    startedByUserId: string | null;
    now: string;
    logActivityEvents: boolean;
  }): Promise<{
    run: { id: string };
    createdProposalCount: number;
    skippedProposalCount: number;
  }>;
  now(): string;
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
  // MVP scheduler: support the catalog's current cron subset only:
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

function toValidDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isSupportedScheduledAgent(agentId: string): boolean {
  return supportedAgentIds.has(agentId);
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

export function isProjectAgentDue(agent: ProjectAgent, now: Date | string): boolean {
  if (agent.status !== "active") return false;
  if (!agent.schedule?.trim()) return false;

  const nowDate = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(nowDate.getTime())) return false;

  const nextRunAt = toValidDate(agent.nextRunAt);
  if (nextRunAt) {
    return nextRunAt.getTime() <= nowDate.getTime();
  }

  if (!agent.lastRunAt) {
    return calculateNextRunAt(agent.schedule, nowDate) !== null;
  }

  const calculatedNextRunAt = calculateNextRunAt(agent.schedule, agent.lastRunAt);
  const calculatedNextRunDate = toValidDate(calculatedNextRunAt);
  return calculatedNextRunDate ? calculatedNextRunDate.getTime() <= nowDate.getTime() : false;
}

export function getDueProjectAgents(agents: ProjectAgent[], now: Date | string): ProjectAgent[] {
  return agents.filter((agent) => isProjectAgentDue(agent, now));
}

async function getDefaultDependencies(): Promise<ScheduledAgentRunnerDependencies> {
  const [storage, runner] = await Promise.all([
    import("@/lib/storage"),
    import("@/lib/agent-runs/run-agent"),
  ]);

  return {
    getActiveProjectAgents: storage.getActiveProjectAgents,
    updateProjectAgentScheduleState: storage.updateProjectAgentScheduleState,
    runAgent: runner.runDeterministicProjectAgent,
    now: () => new Date().toISOString(),
  };
}

export async function runScheduledProjectAgents(
  dependencies?: ScheduledAgentRunnerDependencies,
): Promise<ScheduledAgentRunSummary> {
  const deps = dependencies || (await getDefaultDependencies());
  const now = deps.now();
  const agents = await deps.getActiveProjectAgents();
  const dueAgents = getDueProjectAgents(agents, now);
  const results: ScheduledAgentRunSummary["results"] = [];

  for (const agent of dueAgents) {
    if (!isSupportedScheduledAgent(agent.agentId)) {
      const nextRunAt = calculateNextRunAt(agent.schedule, now);
      await deps.updateProjectAgentScheduleState({
        projectId: agent.projectId,
        agentId: agent.agentId,
        lastRunAt: agent.lastRunAt,
        nextRunAt,
        timestamp: now,
      });
      results.push({
        projectId: agent.projectId,
        agentId: agent.agentId,
        status: "skipped",
        reason: "unsupported_agent",
        nextRunAt,
      });
      continue;
    }

    try {
      const result = await deps.runAgent({
        projectId: agent.projectId,
        agentId: agent.agentId,
        triggerType: "scheduled",
        startedByUserId: null,
        now,
        logActivityEvents: false,
      });
      const nextRunAt = calculateNextRunAt(agent.schedule, now);
      await deps.updateProjectAgentScheduleState({
        projectId: agent.projectId,
        agentId: agent.agentId,
        lastRunAt: now,
        nextRunAt,
        timestamp: now,
      });
      results.push({
        projectId: agent.projectId,
        agentId: agent.agentId,
        status: "ran",
        runId: result.run.id,
        createdProposalCount: result.createdProposalCount,
        skippedProposalCount: result.skippedProposalCount,
        nextRunAt,
      });
    } catch (error) {
      const nextRunAt = calculateNextRunAt(agent.schedule, now);
      await deps.updateProjectAgentScheduleState({
        projectId: agent.projectId,
        agentId: agent.agentId,
        lastRunAt: now,
        nextRunAt,
        timestamp: now,
      });
      results.push({
        projectId: agent.projectId,
        agentId: agent.agentId,
        status: "failed",
        error: error instanceof Error ? error.message : "Scheduled agent run failed.",
        nextRunAt,
      });
    }
  }

  return {
    checkedCount: agents.length,
    dueCount: dueAgents.length,
    ranCount: results.filter((result) => result.status === "ran").length,
    skippedCount: results.filter((result) => result.status === "skipped").length,
    failedCount: results.filter((result) => result.status === "failed").length,
    proposedCount: results.reduce((sum, result) => sum + (result.createdProposalCount || 0), 0),
    duplicateProposalCount: results.reduce((sum, result) => sum + (result.skippedProposalCount || 0), 0),
    results,
  };
}
