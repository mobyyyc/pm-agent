import type {
  ProjectReportActivitySummary,
  ProjectReportComparisonSummary,
  ProjectReportInputSnapshot,
  ProjectReportTaskSummary,
} from "@/types/models";

type PreviousReportRef = {
  id: string;
  createdAt: string;
};

function taskKey(task: ProjectReportTaskSummary): string | null {
  return task.id || null;
}

function getSnapshotTasks(snapshot: ProjectReportInputSnapshot): ProjectReportTaskSummary[] {
  if (Array.isArray(snapshot.tasks.all) && snapshot.tasks.all.length > 0) {
    return snapshot.tasks.all;
  }

  const byId = new Map<string, ProjectReportTaskSummary>();
  const fallback: ProjectReportTaskSummary[] = [];
  const groups = [
    snapshot.tasks.completed,
    snapshot.tasks.inProgress,
    snapshot.tasks.overdue,
    snapshot.tasks.dueSoon,
    snapshot.tasks.unassigned,
  ];

  for (const task of groups.flat()) {
    const key = taskKey(task);
    if (key) {
      byId.set(key, task);
    } else {
      fallback.push(task);
    }
  }

  return [...byId.values(), ...fallback];
}

function activityKey(activity: ProjectReportActivitySummary): string {
  if (activity.id) return activity.id;
  return [
    activity.createdAt,
    activity.eventType,
    activity.entityType,
    activity.entityId || "",
    activity.summary,
  ].join("|");
}

function compareById(
  previousTasks: ProjectReportTaskSummary[],
  currentTasks: ProjectReportTaskSummary[],
) {
  const previousById = new Map<string, ProjectReportTaskSummary>();
  const currentById = new Map<string, ProjectReportTaskSummary>();

  for (const task of previousTasks) {
    const key = taskKey(task);
    if (key) previousById.set(key, task);
  }

  for (const task of currentTasks) {
    const key = taskKey(task);
    if (key) currentById.set(key, task);
  }

  return { previousById, currentById };
}

export function compareProjectReportSnapshots(
  previousSnapshot: ProjectReportInputSnapshot | null | undefined,
  currentSnapshot: ProjectReportInputSnapshot,
  previousReport?: PreviousReportRef | null,
): ProjectReportComparisonSummary | null {
  if (!previousSnapshot || !previousReport) {
    return null;
  }

  const previousTasks = getSnapshotTasks(previousSnapshot);
  const currentTasks = getSnapshotTasks(currentSnapshot);
  const { previousById, currentById } = compareById(previousTasks, currentTasks);

  const completedSinceLastReport: ProjectReportTaskSummary[] = [];
  const newlyOverdue: ProjectReportTaskSummary[] = [];
  const newlyCreated: ProjectReportTaskSummary[] = [];
  const statusChanged: ProjectReportComparisonSummary["taskChanges"]["statusChanged"] = [];

  for (const [id, currentTask] of currentById) {
    const previousTask = previousById.get(id);

    if (!previousTask) {
      newlyCreated.push(currentTask);
      continue;
    }

    if (previousTask.status !== "done" && currentTask.status === "done") {
      completedSinceLastReport.push(currentTask);
    }

    if (previousTask.status !== currentTask.status) {
      statusChanged.push({
        id,
        title: currentTask.title,
        previousStatus: previousTask.status,
        currentStatus: currentTask.status,
      });
    }
  }

  const previousOverdueIds = new Set(
    previousSnapshot.tasks.overdue.map((task) => task.id).filter((id): id is string => Boolean(id)),
  );
  for (const task of currentSnapshot.tasks.overdue) {
    if (task.id && !previousOverdueIds.has(task.id)) {
      newlyOverdue.push(task);
    }
  }

  const previousActivityKeys = new Set(previousSnapshot.recentActivity.map(activityKey));
  const newActivity = currentSnapshot.recentActivity.filter((activity) => !previousActivityKeys.has(activityKey(activity)));
  const newCommitCount = newActivity.filter((activity) => activity.entityType === "github_commit").length;
  const newMemberAttributedActivity = newActivity.filter(
    (activity) => Boolean(activity.actorMemberId || activity.actorMemberName),
  ).length;

  const comparison: ProjectReportComparisonSummary = {
    previousReportId: previousReport.id,
    previousReportCreatedAt: previousReport.createdAt,
    taskChanges: {
      completedSinceLastReport,
      newlyOverdue,
      newlyCreated,
      statusChanged,
    },
    activityChanges: {
      newActivityCount: newActivity.length,
      newCommitCount,
      newMemberAttributedActivity,
    },
    progressDelta: {
      completionPercentDelta: currentSnapshot.progress.completionPercent - previousSnapshot.progress.completionPercent,
      overdueTasksDelta: currentSnapshot.progress.overdueTasks - previousSnapshot.progress.overdueTasks,
      dueSoonTasksDelta: currentSnapshot.progress.dueSoonTasks - previousSnapshot.progress.dueSoonTasks,
    },
    healthChange: {
      previousStatus: previousSnapshot.health.status,
      currentStatus: currentSnapshot.health.status,
      changed: previousSnapshot.health.status !== currentSnapshot.health.status,
    },
    notableChanges: [],
  };

  const notableChanges: string[] = [];
  if (comparison.progressDelta.completionPercentDelta !== 0) {
    notableChanges.push(`Completion changed by ${comparison.progressDelta.completionPercentDelta} points.`);
  }
  if (comparison.healthChange.changed) {
    notableChanges.push(`Health changed from ${comparison.healthChange.previousStatus} to ${comparison.healthChange.currentStatus}.`);
  }
  if (completedSinceLastReport.length > 0) {
    notableChanges.push(`${completedSinceLastReport.length} task(s) completed since the previous report.`);
  }
  if (newlyOverdue.length > 0) {
    notableChanges.push(`${newlyOverdue.length} task(s) became overdue.`);
  }
  if (newCommitCount > 0) {
    notableChanges.push(`${newCommitCount} new commit activity event(s).`);
  }
  if (newMemberAttributedActivity > 0) {
    notableChanges.push(`${newMemberAttributedActivity} new activity event(s) have member attribution.`);
  }

  return {
    ...comparison,
    notableChanges,
  };
}
