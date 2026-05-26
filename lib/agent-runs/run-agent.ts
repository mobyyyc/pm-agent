import { generateGithubTaskReviewProposals } from "../agent-actions/github-task-review";
import { generateRiskWatchProposals } from "../agent-actions/risk-watch";
import { calculateProjectHealth } from "../project-health";
import { calculateProjectProgress } from "../project-progress";
import type {
  Project,
  ProjectActivityEvent,
  ProjectAgentActionProposal,
  ProjectAgentRun,
  ProjectAgentRunTriggerType,
  ProjectHealthSummary,
  ProjectMember,
  Task,
} from "@/types/models";

type ProposalDraft = Pick<
  ProjectAgentActionProposal,
  | "sourceType"
  | "sourceId"
  | "dedupeKey"
  | "proposedActionType"
  | "title"
  | "description"
  | "payload"
  | "createdBy"
  | "confidence"
  | "requiresApproval"
>;

export type DeterministicAgentRunResult = {
  run: ProjectAgentRun;
  createdProposalCount: number;
  skippedProposalCount: number;
  summary: string;
};

export type DeterministicAgentRunDependencies = {
  getProjectById(projectId: string): Promise<Project | null>;
  getProjectMembers(projectId: string): Promise<ProjectMember[]>;
  getTasksByProjectId(projectId: string): Promise<Task[]>;
  getProjectActivityEventsByProjectId(projectId: string, limit?: number): Promise<ProjectActivityEvent[]>;
  createProjectAgentRun(input: {
    projectId: string;
    agentId: string | null;
    triggerType: ProjectAgentRunTriggerType;
    status: "running";
    startedByUserId: string | null;
    startedAt: string;
    createdAt: string;
    inputSnapshot?: Record<string, unknown> | null;
  }): Promise<ProjectAgentRun>;
  updateProjectAgentRunStatus(input: {
    projectId: string;
    runId: string;
    status: "completed" | "failed";
    summary?: string | null;
    errorMessage?: string | null;
    completedAt?: string | null;
  }): Promise<ProjectAgentRun | null>;
  createProjectAgentActionProposalIfNotExists(input: ProposalDraft & {
    projectId: string;
    runId: string | null;
    agentId: string | null;
    timestamp: string;
  }): Promise<{ proposal: ProjectAgentActionProposal; created: boolean }>;
  logProjectActivityEvent(input: {
    projectId: string;
    actorUserId: string | null;
    source: "user" | "github" | "system";
    eventType: string;
    entityType: "project" | "task" | "timeline" | "repository" | "member" | "github_commit" | "agent_run" | "agent_action_proposal";
    entityId: string | null;
    summary: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
  }): Promise<void>;
  now(): string;
};

async function getDefaultDependencies(): Promise<DeterministicAgentRunDependencies> {
  const storage = await import("@/lib/storage");

  return {
    getProjectById: storage.getProjectById,
    getProjectMembers: storage.getProjectMembers,
    getTasksByProjectId: storage.getTasksByProjectId,
    getProjectActivityEventsByProjectId: storage.getProjectActivityEventsByProjectId,
    createProjectAgentRun: storage.createProjectAgentRun,
    updateProjectAgentRunStatus: storage.updateProjectAgentRunStatus,
    createProjectAgentActionProposalIfNotExists: storage.createProjectAgentActionProposalIfNotExists,
    logProjectActivityEvent: storage.logProjectActivityEvent,
    now: () => new Date().toISOString(),
  };
}

function buildRiskWatchSnapshot(progress: ReturnType<typeof calculateProjectProgress>, health: ProjectHealthSummary) {
  return {
    progress: {
      totalTasks: progress.totalTasks,
      overdueTasks: progress.overdueTasks,
      unassignedTasks: progress.unassignedTasks,
    },
    health: {
      status: health.status,
      signals: health.signals.map((signal) => signal.id),
    },
  };
}

function buildSummary(agentId: string, createdProposalCount: number, skippedProposalCount: number): string {
  if (agentId === "risk-watch") {
    return `Risk Watch created ${createdProposalCount} proposal${createdProposalCount === 1 ? "" : "s"} and skipped ${skippedProposalCount} duplicate${skippedProposalCount === 1 ? "" : "s"}.`;
  }

  return `GitHub Task Review created ${createdProposalCount} proposal${createdProposalCount === 1 ? "" : "s"} and skipped ${skippedProposalCount} duplicate${skippedProposalCount === 1 ? "" : "s"}.`;
}

async function createProposalDrafts(input: {
  agentId: string;
  project: Project;
  tasks: Task[];
  members: ProjectMember[];
  activityEvents: ProjectActivityEvent[];
  now: string;
}): Promise<{
  drafts: ProposalDraft[];
  inputSnapshot: Record<string, unknown>;
  completionEventType: string;
  completionSummary: string;
}> {
  if (input.agentId === "risk-watch") {
    const today = input.now.slice(0, 10);
    const progress = calculateProjectProgress(input.project, input.tasks, today);
    const health = calculateProjectHealth(progress, today);

    return {
      drafts: generateRiskWatchProposals({
        project: input.project,
        tasks: input.tasks,
        members: input.members,
        health,
        now: input.now,
      }),
      inputSnapshot: buildRiskWatchSnapshot(progress, health),
      completionEventType: "agent.run.completed",
      completionSummary: "Risk Watch review completed",
    };
  }

  if (input.agentId === "github-task-review") {
    const recentCommitEvents = input.activityEvents.filter(
      (event) =>
        event.source === "github" &&
        event.entityType === "github_commit" &&
        event.eventType === "github.commit.synced",
    );

    return {
      drafts: generateGithubTaskReviewProposals({
        project: input.project,
        tasks: input.tasks,
        activityEvents: recentCommitEvents,
      }),
      inputSnapshot: {
        activeTaskCount: input.tasks.filter((task) => task.status !== "done").length,
        recentCommitEventCount: recentCommitEvents.length,
      },
      completionEventType: "github_task_review.run.completed",
      completionSummary: "GitHub task progress review completed",
    };
  }

  throw new Error(`Unsupported deterministic agent: ${input.agentId}`);
}

export async function runDeterministicProjectAgent(input: {
  projectId: string;
  agentId: string;
  triggerType: ProjectAgentRunTriggerType;
  startedByUserId: string | null;
  now?: string;
  logActivityEvents?: boolean;
  dependencies?: DeterministicAgentRunDependencies;
}): Promise<DeterministicAgentRunResult> {
  const dependencies = input.dependencies || (await getDefaultDependencies());
  const startedAt = input.now || dependencies.now();
  const project = await dependencies.getProjectById(input.projectId);

  if (!project) {
    throw new Error("Project not found.");
  }

  const [tasks, members, activityEvents] = await Promise.all([
    dependencies.getTasksByProjectId(input.projectId),
    dependencies.getProjectMembers(input.projectId),
    dependencies.getProjectActivityEventsByProjectId(input.projectId, 100),
  ]);

  const draftResult = await createProposalDrafts({
    agentId: input.agentId,
    project,
    tasks,
    members,
    activityEvents,
    now: startedAt,
  });

  const run = await dependencies.createProjectAgentRun({
    projectId: input.projectId,
    agentId: input.agentId,
    triggerType: input.triggerType,
    status: "running",
    startedByUserId: input.startedByUserId,
    startedAt,
    createdAt: startedAt,
    inputSnapshot: draftResult.inputSnapshot,
  });

  try {
    let createdProposalCount = 0;
    let skippedProposalCount = 0;

    for (const draft of draftResult.drafts) {
      const result = await dependencies.createProjectAgentActionProposalIfNotExists({
        ...draft,
        projectId: input.projectId,
        runId: run.id,
        agentId: input.agentId,
        timestamp: startedAt,
      });

      if (result.created) {
        createdProposalCount += 1;
        if (input.logActivityEvents !== false) {
          await dependencies.logProjectActivityEvent({
            projectId: input.projectId,
            actorUserId: input.startedByUserId,
            source: "system",
            eventType: "agent_action.proposed",
            entityType: "agent_action_proposal",
            entityId: result.proposal.id,
            summary: `Agent action proposed: ${result.proposal.title}`,
            metadata: {
              runId: run.id,
              proposalId: result.proposal.id,
              proposedActionType: result.proposal.proposedActionType,
              sourceType: result.proposal.sourceType,
              sourceId: result.proposal.sourceId,
              taskId: result.proposal.payload.taskId,
              assigneeMemberId: result.proposal.payload.assigneeMemberId,
              commitSha: result.proposal.payload.commitSha,
              suggestedStatus: result.proposal.payload.suggestedStatus,
            },
            createdAt: startedAt,
          });
        }
      } else {
        skippedProposalCount += 1;
      }
    }

    const completedAt = dependencies.now();
    const summary = buildSummary(input.agentId, createdProposalCount, skippedProposalCount);
    const completedRun =
      (await dependencies.updateProjectAgentRunStatus({
        projectId: input.projectId,
        runId: run.id,
        status: "completed",
        summary,
        completedAt,
      })) || run;

    if (input.logActivityEvents !== false) {
      await dependencies.logProjectActivityEvent({
        projectId: input.projectId,
        actorUserId: input.startedByUserId,
        source: "system",
        eventType: draftResult.completionEventType,
        entityType: "agent_run",
        entityId: run.id,
        summary: draftResult.completionSummary,
        metadata: {
          runId: run.id,
          agentId: input.agentId,
          createdProposalCount,
          skippedProposalCount,
        },
        createdAt: completedAt,
      });
    }

    return {
      run: completedRun,
      createdProposalCount,
      skippedProposalCount,
      summary,
    };
  } catch (error) {
    await dependencies.updateProjectAgentRunStatus({
      projectId: input.projectId,
      runId: run.id,
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Deterministic agent run failed.",
      completedAt: dependencies.now(),
    });
    throw error;
  }
}
