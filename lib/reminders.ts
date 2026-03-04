import type { Task } from "@/types/models";

export type TaskReminder = {
  taskId: string;
  projectId: string;
  title: string;
  deadline: string;
  status: Task["status"];
  daysLeft: number;
  isOverdue: boolean;
};

export function getTaskReminders(tasks: Task[], daysWindow: number): TaskReminder[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return tasks
    .filter((task) => task.status !== "done")
    .map((task) => {
      const deadlineDate = new Date(task.deadline);
      const dayMs = 1000 * 60 * 60 * 24;
      const daysLeft = Math.floor((deadlineDate.getTime() - startOfToday.getTime()) / dayMs);
      return {
        taskId: task.id,
        projectId: task.projectId,
        title: task.title,
        deadline: task.deadline,
        status: task.status,
        daysLeft,
        isOverdue: daysLeft < 0,
      };
    })
    .filter((reminder) => reminder.isOverdue || reminder.daysLeft <= daysWindow)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}
