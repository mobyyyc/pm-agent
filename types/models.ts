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

export const aiAnalysisSchema = z.object({
  status: z.enum(["asking", "ready"]),
  question: z.string().optional(),
  options: z.array(z.string()).optional(),
  summary: z.string().optional(),
});

export type AIAnalysis = z.infer<typeof aiAnalysisSchema>;

export const teamCategorySchema = z.object({
  title: z.string().min(1),
  points: z.array(z.string().min(1)).min(1),
});

export const teamKnowledgeSchema = z.object({
  name: z.string().min(1),
  industry: z.string().min(1),
  preferredStack: z.array(z.string().min(1)),
  values: z.array(z.string().min(1)),
  constraints: z.array(z.string().min(1)),
  targetAudience: z.array(z.string().min(1)),
  designSystem: z.array(z.string().min(1)),
});

export const teamImportAnalysisSchema = z.object({
  summary: z.string().min(1),
  categories: z.array(teamCategorySchema),
  normalized: teamKnowledgeSchema,
});

export const userTeamSchema = z.object({
  userId: z.string().min(1),
  team: teamKnowledgeSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const appUserSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().nullable(),
  imageUrl: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const projectMemberSchema = z.object({
  projectId: z.string().min(1),
  userId: z.string().min(1),
  role: z.string().min(1),
  joinedAt: z.string().datetime(),
  displayName: z.string().nullable(),
  imageUrl: z.string().nullable(),
});

export const projectInvitationStatusSchema = z.enum(["pending", "accepted", "declined"]);

export const projectInvitationSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  inviterUserId: z.string().min(1),
  inviteeUserId: z.string().min(1),
  role: z.string().nullable(),
  status: projectInvitationStatusSchema,
  createdAt: z.string().datetime(),
  respondedAt: z.string().datetime().nullable(),
});

export const repositoryVisibilitySchema = z.enum(["public", "private"]);

export const projectRepositorySchema = z.object({
  projectId: z.string().min(1),
  provider: z.literal("github"),
  ownerLogin: z.string().min(1),
  repoName: z.string().min(1),
  fullName: z.string().min(1),
  htmlUrl: z.string().url(),
  defaultBranch: z.string().min(1),
  visibility: repositoryVisibilitySchema,
  externalId: z.string().min(1),
  createdByUserId: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const agentStatusSchema = z.enum(["active", "paused"]);

export const agentDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tagline: z.string().min(1),
  category: z.string().min(1),
  description: z.string().min(1),
  recommendedSchedule: z.string().nullable(),
  tags: z.array(z.string().min(1)).min(1),
});

export const projectAgentSchema = z.object({
  projectId: z.string().min(1),
  agentId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  status: agentStatusSchema,
  schedule: z.string().nullable(),
  config: z.record(z.unknown()),
  lastRunAt: z.string().datetime().nullable(),
  nextRunAt: z.string().datetime().nullable(),
  createdByUserId: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TeamKnowledge = z.infer<typeof teamKnowledgeSchema>;
export type UserTeam = z.infer<typeof userTeamSchema>;
export type TeamImportAnalysis = z.infer<typeof teamImportAnalysisSchema>;
export type AppUser = z.infer<typeof appUserSchema>;
export type ProjectMember = z.infer<typeof projectMemberSchema>;
export type ProjectInvitation = z.infer<typeof projectInvitationSchema>;
export type ProjectInvitationStatus = z.infer<typeof projectInvitationStatusSchema>;
export type RepositoryVisibility = z.infer<typeof repositoryVisibilitySchema>;
export type ProjectRepository = z.infer<typeof projectRepositorySchema>;
export type AgentStatus = z.infer<typeof agentStatusSchema>;
export type AgentDefinition = z.infer<typeof agentDefinitionSchema>;
export type ProjectAgent = z.infer<typeof projectAgentSchema>;

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
