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

export const projectMemberGithubIdentitySchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  memberId: z.string().min(1),
  githubLogin: z.string().nullable(),
  githubName: z.string().nullable(),
  githubEmail: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const githubContributorIdentitySchema = z.object({
  githubLogin: z.string().nullable(),
  githubName: z.string().nullable(),
  githubEmail: z.string().nullable(),
});

export const githubIdentityMappingInputSchema = z.object({
  id: z.string().min(1).optional(),
  memberId: z.string().min(1),
  githubLogin: z.string().trim().min(1).nullable().optional(),
  githubName: z.string().trim().min(1).nullable().optional(),
  githubEmail: z.string().trim().email().nullable().optional(),
}).refine(
  (value) => Boolean(value.githubLogin || value.githubName || value.githubEmail),
  { message: "At least one GitHub identity field is required." },
);

export const resolvedGithubActorSchema = z.object({
  actorMemberId: z.string().min(1),
  actorMemberName: z.string().min(1),
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

export const projectActivitySourceSchema = z.enum(["user", "github", "system"]);
export const projectActivityEntityTypeSchema = z.enum([
  "project",
  "task",
  "timeline",
  "repository",
  "member",
  "github_commit",
]);

export const projectActivityEventSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  actorUserId: z.string().min(1).nullable(),
  source: projectActivitySourceSchema,
  eventType: z.string().min(1),
  entityType: projectActivityEntityTypeSchema,
  entityId: z.string().min(1).nullable(),
  summary: z.string().min(1),
  metadata: z.record(z.unknown()),
  createdAt: z.string().datetime(),
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
export type ProjectMemberGithubIdentity = z.infer<typeof projectMemberGithubIdentitySchema>;
export type GithubContributorIdentity = z.infer<typeof githubContributorIdentitySchema>;
export type GithubIdentityMappingInput = z.infer<typeof githubIdentityMappingInputSchema>;
export type ResolvedGithubActor = z.infer<typeof resolvedGithubActorSchema>;
export type ProjectInvitation = z.infer<typeof projectInvitationSchema>;
export type ProjectInvitationStatus = z.infer<typeof projectInvitationStatusSchema>;
export type RepositoryVisibility = z.infer<typeof repositoryVisibilitySchema>;
export type ProjectRepository = z.infer<typeof projectRepositorySchema>;
export type ProjectActivitySource = z.infer<typeof projectActivitySourceSchema>;
export type ProjectActivityEntityType = z.infer<typeof projectActivityEntityTypeSchema>;
export type ProjectActivityEvent = z.infer<typeof projectActivityEventSchema>;
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

export const projectProgressSummarySchema = z.object({
  totalTasks: z.number().int().nonnegative(),
  completedTasks: z.number().int().nonnegative(),
  inProgressTasks: z.number().int().nonnegative(),
  todoTasks: z.number().int().nonnegative(),
  completionPercent: z.number().int().min(0).max(100),
  overdueTasks: z.number().int().nonnegative(),
  dueSoonTasks: z.number().int().nonnegative(),
  unassignedTasks: z.number().int().nonnegative(),
  timelinePhaseCount: z.number().int().nonnegative(),
  completedTimelinePhases: z.number().int().nonnegative(),
  currentTimelinePhase: z.string().nullable(),
  projectWindow: z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  }),
});

export const projectHealthStatusSchema = z.enum(["healthy", "watch", "at_risk"]);
export const projectRiskSeveritySchema = z.enum(["info", "warning", "critical"]);

export const projectRiskSignalSchema = z.object({
  id: z.string().min(1),
  severity: projectRiskSeveritySchema,
  message: z.string().min(1),
  value: z.number().nonnegative(),
  threshold: z.number().nonnegative().nullable(),
});

export const projectHealthSummarySchema = z.object({
  status: projectHealthStatusSchema,
  label: z.string().min(1),
  message: z.string().min(1),
  signals: z.array(projectRiskSignalSchema),
  evaluatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const projectReportPeriodSchema = z.enum(["daily", "weekly", "monthly"]);
export const projectReportSourceSchema = z.enum(["manual"]);

export const projectReportActionItemSchema = z.object({
  title: z.string().min(1),
  rationale: z.string().min(1),
  priority: projectRiskSeveritySchema,
});

export const projectReportTaskSummarySchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().min(1),
  status: taskStatusSchema,
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  suggestedAssignee: z.string(),
});

export const projectReportActivitySummarySchema = z.object({
  id: z.string().min(1).optional(),
  summary: z.string().min(1),
  source: projectActivitySourceSchema,
  entityType: projectActivityEntityTypeSchema,
  entityId: z.string().min(1).nullable().optional(),
  eventType: z.string().min(1),
  createdAt: z.string().datetime(),
  actorMemberId: z.string().min(1).nullable().optional(),
  actorMemberName: z.string().min(1).nullable().optional(),
});

export const projectReportComparisonSummarySchema = z.object({
  previousReportId: z.string().min(1),
  previousReportCreatedAt: z.string().datetime(),
  taskChanges: z.object({
    completedSinceLastReport: z.array(projectReportTaskSummarySchema),
    newlyOverdue: z.array(projectReportTaskSummarySchema),
    newlyCreated: z.array(projectReportTaskSummarySchema),
    statusChanged: z.array(z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      previousStatus: taskStatusSchema,
      currentStatus: taskStatusSchema,
    })),
  }),
  activityChanges: z.object({
    newActivityCount: z.number().int().nonnegative(),
    newCommitCount: z.number().int().nonnegative(),
    newMemberAttributedActivity: z.number().int().nonnegative(),
  }),
  progressDelta: z.object({
    completionPercentDelta: z.number().int(),
    overdueTasksDelta: z.number().int(),
    dueSoonTasksDelta: z.number().int(),
  }),
  healthChange: z.object({
    previousStatus: projectHealthStatusSchema,
    currentStatus: projectHealthStatusSchema,
    changed: z.boolean(),
  }),
  notableChanges: z.array(z.string().min(1)),
});

export const projectProgressReportSchema = z.object({
  projectId: z.string().min(1),
  projectName: z.string().min(1),
  period: projectReportPeriodSchema,
  generatedAt: z.string().datetime(),
  executiveSummary: z.string().min(1),
  progressOverview: z.string().min(1),
  completedWork: z.array(z.string().min(1)),
  inProgressWork: z.array(z.string().min(1)),
  riskyWork: z.array(z.string().min(1)),
  activityHighlights: z.array(z.string().min(1)),
  healthExplanation: z.string().min(1),
  suggestedNextActions: z.array(projectReportActionItemSchema).min(1).max(5),
});

export const projectReportInputSnapshotSchema = z.object({
  period: projectReportPeriodSchema,
  generatedAt: z.string().datetime(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  project: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    idea: z.string().min(1),
    guideline: z.string().min(1),
  }),
  progress: projectProgressSummarySchema,
  health: projectHealthSummarySchema,
  tasks: z.object({
    all: z.array(projectReportTaskSummarySchema).optional(),
    completed: z.array(projectReportTaskSummarySchema),
    inProgress: z.array(projectReportTaskSummarySchema),
    overdue: z.array(projectReportTaskSummarySchema),
    dueSoon: z.array(projectReportTaskSummarySchema),
    unassigned: z.array(projectReportTaskSummarySchema),
  }),
  recentActivity: z.array(projectReportActivitySummarySchema),
  comparisonSummary: projectReportComparisonSummarySchema.nullable().optional(),
});

export const projectReportArtifactSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  createdByUserId: z.string().min(1).nullable(),
  period: projectReportPeriodSchema,
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  generatedAt: z.string().datetime(),
  report: projectProgressReportSchema,
  inputSnapshot: projectReportInputSnapshotSchema,
  source: projectReportSourceSchema,
  createdAt: z.string().datetime(),
});

export type Project = z.infer<typeof projectSchema>;
export type Task = z.infer<typeof taskSchema>;
export type ProjectProgressSummary = z.infer<typeof projectProgressSummarySchema>;
export type ProjectHealthStatus = z.infer<typeof projectHealthStatusSchema>;
export type ProjectRiskSeverity = z.infer<typeof projectRiskSeveritySchema>;
export type ProjectRiskSignal = z.infer<typeof projectRiskSignalSchema>;
export type ProjectHealthSummary = z.infer<typeof projectHealthSummarySchema>;
export type ProjectReportPeriod = z.infer<typeof projectReportPeriodSchema>;
export type ProjectReportSource = z.infer<typeof projectReportSourceSchema>;
export type ProjectReportActionItem = z.infer<typeof projectReportActionItemSchema>;
export type ProjectReportTaskSummary = z.infer<typeof projectReportTaskSummarySchema>;
export type ProjectReportActivitySummary = z.infer<typeof projectReportActivitySummarySchema>;
export type ProjectReportComparisonSummary = z.infer<typeof projectReportComparisonSummarySchema>;
export type ProjectProgressReport = z.infer<typeof projectProgressReportSchema>;
export type ProjectReportInputSnapshot = z.infer<typeof projectReportInputSnapshotSchema>;
export type ProjectReportArtifact = z.infer<typeof projectReportArtifactSchema>;
