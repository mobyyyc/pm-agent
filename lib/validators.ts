import { z } from "zod";

import {
  aiPlanSchema,
  teamImportAnalysisSchema,
  teamKnowledgeSchema,
  projectSchema,
  taskSchema,
  taskStatusSchema,
  timelineItemSchema,
  type AIPlan,
  type TeamImportAnalysis,
  type TeamKnowledge,
  type Project,
  type Task,
  aiAnalysisSchema,
} from "@/types/models";

export const createProjectRequestSchema = z.object({
  idea: z.string().min(5, "Project idea must be at least 5 characters."),
});

export const analyzeProjectRequestSchema = z.object({
  message: z.string().min(1, "Message is required."),
  history: z.array(z.object({
    role: z.enum(["user", "model"]),
    content: z.string(),
  })).optional(),
});

export const updateTaskStatusRequestSchema = z.object({
  status: z.enum(["todo", "in_progress", "done"]),
});

export const updateProjectTimelineRequestSchema = z.object({
  timeline: z.array(timelineItemSchema),
});

export const updateTaskRequestSchema = z.object({
  title: z.string().min(1, "Task title is required."),
  description: z.string().min(1, "Task description is required."),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Deadline must be in YYYY-MM-DD format."),
  suggestedAssignee: z.string().min(1, "Suggested assignee is required."),
  status: taskStatusSchema,
});

const arrayFromStringSchema = z
  .union([z.array(z.string()), z.string()])
  .transform((value) => {
    if (Array.isArray(value)) {
      return value.map((item) => item.trim()).filter(Boolean);
    }
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  });

export const upsertTeamRequestSchema = z.object({
  name: z.string().min(1, "Team name is required."),
  industry: z.string().min(1, "Industry is required."),
  preferredStack: arrayFromStringSchema,
  values: arrayFromStringSchema,
  constraints: arrayFromStringSchema,
  targetAudience: arrayFromStringSchema,
  designSystem: arrayFromStringSchema,
});

export const importTeamRequestSchema = z.object({
  inputType: z.enum(["json", "text"]),
  content: z.string().min(1, "Content is required."),
});

export const analyzeTeamImportRequestSchema = importTeamRequestSchema;

export function validateAndNormalizeAIAnalysis(data: unknown) {
  return aiAnalysisSchema.parse(data);
}

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

export function validateTeamKnowledge(team: unknown): TeamKnowledge {
  return teamKnowledgeSchema.parse(team);
}

export function validateAndNormalizeTeamImportAnalysis(analysis: unknown): TeamImportAnalysis {
  return teamImportAnalysisSchema.parse(analysis);
}
