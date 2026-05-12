import type {
  ProjectHealthStatus,
  ProjectHealthSummary,
  ProjectProgressSummary,
  ProjectRiskSignal,
} from "@/types/models";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const AT_RISK_OVERDUE_TASKS = 3;
const AT_RISK_OVERDUE_RATIO = 0.25;
const AT_RISK_COMPLETION_AFTER_END = 80;
const WATCH_DUE_SOON_TASKS = 3;

function isDateString(value: string): boolean {
  return DATE_PATTERN.test(value);
}

function getHealthLabel(status: ProjectHealthStatus): string {
  if (status === "at_risk") return "At Risk";
  if (status === "watch") return "Watch";
  return "Healthy";
}

function getHealthMessage(status: ProjectHealthStatus, progress: ProjectProgressSummary): string {
  if (status === "at_risk") {
    if (progress.overdueTasks > 0) return `${progress.overdueTasks} tasks need deadline attention.`;
    return "Completion is behind the project window.";
  }

  if (status === "watch") {
    if (progress.overdueTasks > 0) return `${progress.overdueTasks} tasks are past deadline.`;
    if (progress.unassignedTasks > 0) return `${progress.unassignedTasks} tasks need an owner.`;
    return `${progress.dueSoonTasks} tasks are due soon.`;
  }

  return "No immediate delivery signals need attention.";
}

export function calculateProjectHealth(progress: ProjectProgressSummary, today: string): ProjectHealthSummary {
  const evaluatedAt = isDateString(today) ? today : "1970-01-01";
  const overdueRatio = progress.totalTasks === 0 ? 0 : progress.overdueTasks / progress.totalTasks;
  const projectEnded = progress.projectWindow.endDate !== null && progress.projectWindow.endDate < evaluatedAt;
  const lowCompletionAfterEnd = projectEnded && progress.completionPercent < AT_RISK_COMPLETION_AFTER_END;
  const signals: ProjectRiskSignal[] = [];

  if (progress.overdueTasks > 0) {
    signals.push({
      id: "overdue_tasks",
      severity:
        progress.overdueTasks >= AT_RISK_OVERDUE_TASKS || overdueRatio >= AT_RISK_OVERDUE_RATIO
          ? "critical"
          : "warning",
      message:
        progress.overdueTasks >= AT_RISK_OVERDUE_TASKS || overdueRatio >= AT_RISK_OVERDUE_RATIO
          ? `${progress.overdueTasks} active tasks are overdue.`
          : `${progress.overdueTasks} active tasks are past deadline.`,
      value: progress.overdueTasks,
      threshold: AT_RISK_OVERDUE_TASKS,
    });
  }

  if (progress.dueSoonTasks >= WATCH_DUE_SOON_TASKS) {
    signals.push({
      id: "due_soon_tasks",
      severity: "warning",
      message: `${progress.dueSoonTasks} active tasks are due in the next 7 days.`,
      value: progress.dueSoonTasks,
      threshold: WATCH_DUE_SOON_TASKS,
    });
  }

  if (progress.unassignedTasks > 0) {
    signals.push({
      id: "unassigned_tasks",
      severity: "warning",
      message: `${progress.unassignedTasks} tasks do not have an owner.`,
      value: progress.unassignedTasks,
      threshold: 1,
    });
  }

  if (lowCompletionAfterEnd) {
    signals.push({
      id: "project_ended_incomplete",
      severity: "critical",
      message: `Project window ended with ${progress.completionPercent}% completion.`,
      value: progress.completionPercent,
      threshold: AT_RISK_COMPLETION_AFTER_END,
    });
  }

  let status: ProjectHealthStatus = "healthy";
  if (progress.overdueTasks >= AT_RISK_OVERDUE_TASKS || overdueRatio >= AT_RISK_OVERDUE_RATIO || lowCompletionAfterEnd) {
    status = "at_risk";
  } else if (progress.overdueTasks > 0 || progress.dueSoonTasks >= WATCH_DUE_SOON_TASKS || progress.unassignedTasks > 0) {
    status = "watch";
  }

  return {
    status,
    label: getHealthLabel(status),
    message: getHealthMessage(status, progress),
    signals,
    evaluatedAt,
  };
}
