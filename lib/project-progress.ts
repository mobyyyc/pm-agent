import type { Project, ProjectProgressSummary, Task } from "@/types/models";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DUE_SOON_DAYS = 7;

function isDateString(value: string): boolean {
  return DATE_PATTERN.test(value);
}

function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isUnassignedAssignee(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "" || normalized === "unassigned";
}

export function calculateProjectProgress(
  project: Project,
  tasks: Task[],
  today: string,
): ProjectProgressSummary {
  const safeToday = isDateString(today) ? today : new Date().toISOString().slice(0, 10);
  const dueSoonEnd = addDays(safeToday, DUE_SOON_DAYS);

  const completedTasks = tasks.filter((task) => task.status === "done").length;
  const inProgressTasks = tasks.filter((task) => task.status === "in_progress").length;
  const todoTasks = tasks.filter((task) => task.status === "todo").length;
  const activeTasks = tasks.filter((task) => task.status !== "done");

  const overdueTasks = activeTasks.filter((task) => isDateString(task.deadline) && task.deadline < safeToday).length;
  const dueSoonTasks = activeTasks.filter(
    (task) => isDateString(task.deadline) && task.deadline >= safeToday && task.deadline <= dueSoonEnd,
  ).length;
  const unassignedTasks = tasks.filter((task) => isUnassignedAssignee(task.suggestedAssignee)).length;
  const completionPercent = tasks.length === 0 ? 0 : Math.round((completedTasks / tasks.length) * 100);

  const timelineItems = project.timeline.filter(
    (item) => isDateString(item.startDate) && isDateString(item.endDate),
  );
  const startDates = timelineItems.map((item) => item.startDate);
  const endDates = timelineItems.map((item) => item.endDate);
  const currentTimelineItem = timelineItems.find(
    (item) => item.startDate <= safeToday && item.endDate >= safeToday,
  );

  return {
    totalTasks: tasks.length,
    completedTasks,
    inProgressTasks,
    todoTasks,
    completionPercent,
    overdueTasks,
    dueSoonTasks,
    unassignedTasks,
    timelinePhaseCount: project.timeline.length,
    completedTimelinePhases: timelineItems.filter((item) => item.endDate < safeToday).length,
    currentTimelinePhase: currentTimelineItem?.phase || null,
    projectWindow: {
      startDate: startDates.length > 0 ? startDates.sort()[0] : null,
      endDate: endDates.length > 0 ? endDates.sort()[endDates.length - 1] : null,
    },
  };
}
