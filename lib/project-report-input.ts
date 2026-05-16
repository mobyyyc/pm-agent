import type {
  Project,
  ProjectActivityEvent,
  ProjectHealthSummary,
  ProjectProgressSummary,
  ProjectReportComparisonSummary,
  ProjectReportPeriod,
  Task,
} from "@/types/models";

type ReportTaskSummary = {
  id: string;
  title: string;
  status: Task["status"];
  deadline: string;
  suggestedAssignee: string;
};

export type ProjectReportInput = {
  period: ProjectReportPeriod;
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  project: {
    id: string;
    name: string;
    idea: string;
    guideline: string;
  };
  progress: ProjectProgressSummary;
  health: ProjectHealthSummary;
  tasks: {
    completed: ReportTaskSummary[];
    inProgress: ReportTaskSummary[];
    overdue: ReportTaskSummary[];
    dueSoon: ReportTaskSummary[];
    unassigned: ReportTaskSummary[];
    all: ReportTaskSummary[];
  };
  recentActivity: Array<{
    id: string;
    summary: string;
    source: ProjectActivityEvent["source"];
    entityType: ProjectActivityEvent["entityType"];
    entityId: string | null;
    eventType: string;
    createdAt: string;
    actorMemberId?: string | null;
    actorMemberName?: string | null;
  }>;
  comparisonSummary?: ProjectReportComparisonSummary | null;
};

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getPeriodStart(period: ProjectReportPeriod, today: string): string {
  const date = new Date(`${today}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return today;

  if (period === "daily") {
    return today;
  }

  if (period === "weekly") {
    date.setUTCDate(date.getUTCDate() - 6);
    return formatDate(date);
  }

  date.setUTCDate(date.getUTCDate() - 29);
  return formatDate(date);
}

function toReportTaskSummary(task: Task): ReportTaskSummary {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    deadline: task.deadline,
    suggestedAssignee: task.suggestedAssignee,
  };
}

function isUnassignedAssignee(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "" || normalized === "unassigned";
}

export function buildProjectReportInput(input: {
  project: Project;
  tasks: Task[];
  progress: ProjectProgressSummary;
  health: ProjectHealthSummary;
  activityEvents: ProjectActivityEvent[];
  period: ProjectReportPeriod;
  today: string;
  generatedAt: string;
}): ProjectReportInput {
  const periodStart = getPeriodStart(input.period, input.today);
  const periodEnd = input.today;
  const dueSoonEndDate = new Date(`${input.today}T00:00:00.000Z`);
  dueSoonEndDate.setUTCDate(dueSoonEndDate.getUTCDate() + 7);
  const dueSoonEnd = Number.isNaN(dueSoonEndDate.getTime())
    ? input.today
    : formatDate(new Date(dueSoonEndDate.getTime()));

  const activeTasks = input.tasks.filter((task) => task.status !== "done");
  const relevantActivity = input.activityEvents
    .filter((event) => event.createdAt.slice(0, 10) >= periodStart && event.createdAt.slice(0, 10) <= periodEnd)
    .slice(0, 12)
    .map((event) => {
      const actorMemberId = typeof event.metadata.actorMemberId === "string" ? event.metadata.actorMemberId : null;
      const actorMemberName = typeof event.metadata.actorMemberName === "string" ? event.metadata.actorMemberName : null;

      return {
        id: event.id,
        summary: event.summary,
        source: event.source,
        entityType: event.entityType,
        entityId: event.entityId,
        eventType: event.eventType,
        createdAt: event.createdAt,
        actorMemberId,
        actorMemberName,
      };
    });

  return {
    period: input.period,
    generatedAt: input.generatedAt,
    periodStart,
    periodEnd,
    project: {
      id: input.project.id,
      name: input.project.name,
      idea: input.project.idea,
      guideline: input.project.guideline,
    },
    progress: input.progress,
    health: input.health,
    tasks: {
      all: input.tasks.slice(0, 100).map(toReportTaskSummary),
      completed: input.tasks.filter((task) => task.status === "done").slice(0, 10).map(toReportTaskSummary),
      inProgress: input.tasks.filter((task) => task.status === "in_progress").slice(0, 10).map(toReportTaskSummary),
      overdue: activeTasks
        .filter((task) => task.deadline < input.today)
        .slice(0, 10)
        .map(toReportTaskSummary),
      dueSoon: activeTasks
        .filter((task) => task.deadline >= input.today && task.deadline <= dueSoonEnd)
        .slice(0, 10)
        .map(toReportTaskSummary),
      unassigned: input.tasks.filter((task) => isUnassignedAssignee(task.suggestedAssignee)).slice(0, 10).map(toReportTaskSummary),
    },
    recentActivity: relevantActivity,
  };
}
