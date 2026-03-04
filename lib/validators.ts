import { z } from "zod";

import {
  aiPlanSchema,
  projectSchema,
  taskSchema,
  type AIPlan,
  type Project,
  type Task,
} from "@/types/models";

export const createProjectRequestSchema = z.object({
  idea: z.string().min(5, "Project idea must be at least 5 characters."),
});

export const updateTaskStatusRequestSchema = z.object({
  status: z.enum(["todo", "in_progress", "done"]),
});

function isValidDateString(dateString: string): boolean {
  const date = new Date(dateString);
  return !Number.isNaN(date.getTime());
}

export function validateAndNormalizeAIPlan(plan: unknown): AIPlan {
  const parsed = aiPlanSchema.parse(plan);

  parsed.timeline.forEach((item) => {
    if (!isValidDateString(item.startDate) || !isValidDateString(item.endDate)) {
      throw new Error("Timeline contains invalid dates.");
    }
  });

  parsed.tasks.forEach((task) => {
    if (!isValidDateString(task.deadline)) {
      throw new Error(`Invalid deadline for task: ${task.title}`);
    }
  });

  return parsed;
}

export function validateProject(project: unknown): Project {
  return projectSchema.parse(project);
}

export function validateTask(task: unknown): Task {
  return taskSchema.parse(task);
}
