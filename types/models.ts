import { z } from "zod";

export const taskStatusSchema = z.enum(["todo", "in_progress", "done"]);

export const timelineItemSchema = z.object({
  phase: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  deliverable: z.string().min(1),
});

export const aiTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  suggestedAssignee: z.string().min(1),
});

export const aiPlanSchema = z.object({
  name: z.string().min(1),
  guideline: z.string().min(1),
  timeline: z.array(timelineItemSchema).min(1),
  tasks: z.array(aiTaskSchema).min(1),
});

export type TimelineItem = z.infer<typeof timelineItemSchema>;
export type AITask = z.infer<typeof aiTaskSchema>;
export type AIPlan = z.infer<typeof aiPlanSchema>;

export const projectSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  name: z.string().min(1),
  idea: z.string().min(1),
  guideline: z.string().min(1),
  timeline: z.array(timelineItemSchema),
  taskIds: z.array(z.string().min(1)),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const taskSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  suggestedAssignee: z.string().min(1),
  status: taskStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Project = z.infer<typeof projectSchema>;
export type Task = z.infer<typeof taskSchema>;
