import {
  assignTaskOwnerActionPayloadSchema,
  executableAssignTaskOwnerActionPayloadSchema,
  executableSuggestTaskProgressUpdateActionPayloadSchema,
  suggestTaskProgressUpdateActionPayloadSchema,
  type AssignTaskOwnerActionPayload,
  type ExecutableAssignTaskOwnerActionPayload,
  type ExecutableSuggestTaskProgressUpdateActionPayload,
  type ProjectAgentActionProposal,
  type ProjectMember,
  type SuggestTaskProgressUpdateActionPayload,
  type Task,
} from "../../types/models";

type TaskUpdatePayload = Pick<Task, "title" | "description" | "deadline" | "suggestedAssignee" | "status">;

export type AgentActionWorkflowDependencies = {
  getTaskById(taskId: string): Promise<Task | null>;
  getProjectMembers(projectId: string): Promise<ProjectMember[]>;
  updateTaskDetails(taskId: string, payload: TaskUpdatePayload, updatedAt: string): Promise<Task | null>;
  updateProjectAgentActionProposalStatus(input: {
    projectId: string;
    proposalId: string;
    status: ProjectAgentActionProposal["status"];
    payload?: Record<string, unknown>;
    reviewedByUserId?: string | null;
    reviewedAt?: string | null;
    reviewNote?: string | null;
    executedByUserId?: string | null;
    executedAt?: string | null;
    executionError?: string | null;
    timestamp: string;
  }): Promise<ProjectAgentActionProposal | null>;
  markProjectAgentActionProposalRejected(input: {
    projectId: string;
    proposalId: string;
    reviewedByUserId: string;
    reviewedAt: string;
    reviewNote?: string | null;
  }): Promise<ProjectAgentActionProposal | null>;
  markProjectAgentActionProposalExecuting(input: {
    projectId: string;
    proposalId: string;
    timestamp: string;
  }): Promise<ProjectAgentActionProposal | null>;
  markProjectAgentActionProposalExecuted(input: {
    projectId: string;
    proposalId: string;
    executedByUserId: string;
    executedAt: string;
  }): Promise<ProjectAgentActionProposal | null>;
  markProjectAgentActionProposalFailed(input: {
    projectId: string;
    proposalId: string;
    executedByUserId: string | null;
    failedAt: string;
    executionError: string;
  }): Promise<ProjectAgentActionProposal | null>;
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

export type ExecuteAgentActionProposalResult = {
  proposal: ProjectAgentActionProposal;
  task: Task | null;
  success: boolean;
  errorMessage: string | null;
};

async function getDefaultDependencies(): Promise<AgentActionWorkflowDependencies> {
  const storage = await import("@/lib/storage");

  return {
    getTaskById: storage.getTaskById,
    getProjectMembers: storage.getProjectMembers,
    updateTaskDetails: storage.updateTaskDetails,
    updateProjectAgentActionProposalStatus: storage.updateProjectAgentActionProposalStatus,
    markProjectAgentActionProposalRejected: storage.markProjectAgentActionProposalRejected,
    markProjectAgentActionProposalExecuting: storage.markProjectAgentActionProposalExecuting,
    markProjectAgentActionProposalExecuted: storage.markProjectAgentActionProposalExecuted,
    markProjectAgentActionProposalFailed: storage.markProjectAgentActionProposalFailed,
    logProjectActivityEvent: storage.logProjectActivityEvent,
    now: () => new Date().toISOString(),
  };
}

async function resolveDependencies(
  dependencies?: AgentActionWorkflowDependencies,
): Promise<AgentActionWorkflowDependencies> {
  return dependencies || getDefaultDependencies();
}

function normalizeMemberId(value: string): string {
  return value.trim().toLowerCase();
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Agent action execution failed.";
}

function getProposalTaskId(proposal: ProjectAgentActionProposal): string | null {
  const assignPayload = assignTaskOwnerActionPayloadSchema.safeParse(proposal.payload);
  if (assignPayload.success) return assignPayload.data.taskId;

  const progressPayload = suggestTaskProgressUpdateActionPayloadSchema.safeParse(proposal.payload);
  return progressPayload.success ? progressPayload.data.taskId : null;
}

function buildMetadata(proposal: ProjectAgentActionProposal, extra: Record<string, unknown> = {}) {
  return {
    runId: proposal.runId,
    proposalId: proposal.id,
    proposedActionType: proposal.proposedActionType,
    sourceType: proposal.sourceType,
    sourceId: proposal.sourceId,
    taskId: getProposalTaskId(proposal),
    ...extra,
  };
}

export function assertPendingAgentActionProposal(proposal: Pick<ProjectAgentActionProposal, "status">): void {
  if (proposal.status !== "pending") {
    throw new Error("Only pending agent action proposals can be reviewed.");
  }
}

export function buildApprovedAssignTaskOwnerPayload(
  proposal: ProjectAgentActionProposal,
  approvedPayload: Partial<AssignTaskOwnerActionPayload> = {},
): ExecutableAssignTaskOwnerActionPayload {
  const basePayload = assignTaskOwnerActionPayloadSchema.parse(proposal.payload);

  if (approvedPayload.taskId && approvedPayload.taskId !== basePayload.taskId) {
    throw new Error("Approved payload cannot target a different task.");
  }

  return executableAssignTaskOwnerActionPayloadSchema.parse({
    ...basePayload,
    assigneeMemberId:
      Object.prototype.hasOwnProperty.call(approvedPayload, "assigneeMemberId")
        ? approvedPayload.assigneeMemberId
        : basePayload.assigneeMemberId,
    reason:
      Object.prototype.hasOwnProperty.call(approvedPayload, "reason")
        ? approvedPayload.reason
        : basePayload.reason,
  });
}

export function buildApprovedSuggestTaskProgressUpdatePayload(
  proposal: ProjectAgentActionProposal,
  approvedPayload: Partial<SuggestTaskProgressUpdateActionPayload> = {},
): ExecutableSuggestTaskProgressUpdateActionPayload {
  const basePayload = suggestTaskProgressUpdateActionPayloadSchema.parse(proposal.payload);

  if (approvedPayload.taskId && approvedPayload.taskId !== basePayload.taskId) {
    throw new Error("Approved payload cannot target a different task.");
  }

  return executableSuggestTaskProgressUpdateActionPayloadSchema.parse({
    ...basePayload,
    suggestedStatus:
      Object.prototype.hasOwnProperty.call(approvedPayload, "suggestedStatus")
        ? approvedPayload.suggestedStatus
        : basePayload.suggestedStatus,
  });
}

function buildApprovedActionPayload(
  proposal: ProjectAgentActionProposal,
  approvedPayload: Record<string, unknown>,
): Record<string, unknown> {
  if (proposal.proposedActionType === "assign_task_owner") {
    return buildApprovedAssignTaskOwnerPayload(proposal, approvedPayload as Partial<AssignTaskOwnerActionPayload>);
  }

  if (proposal.proposedActionType === "suggest_task_progress_update") {
    return buildApprovedSuggestTaskProgressUpdatePayload(
      proposal,
      approvedPayload as Partial<SuggestTaskProgressUpdateActionPayload>,
    );
  }

  throw new Error(`Unsupported agent action type: ${proposal.proposedActionType}`);
}

export async function rejectAgentActionProposal(input: {
  proposal: ProjectAgentActionProposal;
  userId: string;
  reviewNote?: string | null;
  dependencies?: AgentActionWorkflowDependencies;
}): Promise<ProjectAgentActionProposal> {
  assertPendingAgentActionProposal(input.proposal);

  const dependencies = await resolveDependencies(input.dependencies);
  const rejectedAt = dependencies.now();
  const rejected = await dependencies.markProjectAgentActionProposalRejected({
    projectId: input.proposal.projectId,
    proposalId: input.proposal.id,
    reviewedByUserId: input.userId,
    reviewedAt: rejectedAt,
    reviewNote: input.reviewNote ?? null,
  });

  if (!rejected) {
    throw new Error("Agent action proposal not found.");
  }

  await dependencies.logProjectActivityEvent({
    projectId: input.proposal.projectId,
    actorUserId: input.userId,
    source: "user",
    eventType: "agent_action.rejected",
    entityType: "agent_action_proposal",
    entityId: input.proposal.id,
    summary: `Agent action rejected: ${input.proposal.title}`,
    metadata: buildMetadata(input.proposal),
    createdAt: rejectedAt,
  });

  return rejected;
}

export async function approveAndExecuteAgentActionProposal(input: {
  proposal: ProjectAgentActionProposal;
  approvedPayload: Record<string, unknown>;
  userId: string;
  reviewNote?: string | null;
  dependencies?: AgentActionWorkflowDependencies;
}): Promise<ExecuteAgentActionProposalResult> {
  assertPendingAgentActionProposal(input.proposal);

  const dependencies = await resolveDependencies(input.dependencies);
  const approvedAt = dependencies.now();
  const executablePayload = buildApprovedActionPayload(input.proposal, input.approvedPayload);
  const approved = await dependencies.updateProjectAgentActionProposalStatus({
    projectId: input.proposal.projectId,
    proposalId: input.proposal.id,
    status: "approved",
    payload: executablePayload,
    reviewedByUserId: input.userId,
    reviewedAt: approvedAt,
    reviewNote: input.reviewNote ?? null,
    timestamp: approvedAt,
  });

  if (!approved) {
    throw new Error("Agent action proposal not found.");
  }

  await dependencies.logProjectActivityEvent({
    projectId: approved.projectId,
    actorUserId: input.userId,
    source: "user",
    eventType: "agent_action.approved",
    entityType: "agent_action_proposal",
    entityId: approved.id,
    summary: `Agent action approved: ${approved.title}`,
    metadata: buildMetadata(approved, executablePayload),
    createdAt: approvedAt,
  });

  return executeAgentActionProposal({
    proposal: approved,
    approvedPayload: executablePayload,
    userId: input.userId,
    dependencies,
  });
}

export async function executeAgentActionProposal(input: {
  proposal: ProjectAgentActionProposal;
  approvedPayload: Record<string, unknown>;
  userId: string;
  dependencies?: AgentActionWorkflowDependencies;
}): Promise<ExecuteAgentActionProposalResult> {
  if (input.proposal.status !== "approved" && input.proposal.status !== "pending") {
    throw new Error("Only pending or approved agent action proposals can be executed.");
  }

  const dependencies = await resolveDependencies(input.dependencies);
  const startedAt = dependencies.now();
  let currentProposal = await dependencies.markProjectAgentActionProposalExecuting({
    projectId: input.proposal.projectId,
    proposalId: input.proposal.id,
    timestamp: startedAt,
  });

  if (!currentProposal) {
    throw new Error("Agent action proposal not found.");
  }

  try {
    const payload = buildApprovedActionPayload(currentProposal, input.approvedPayload);
    const taskId = String(payload.taskId);
    const task = await dependencies.getTaskById(taskId);

    if (!task || task.projectId !== currentProposal.projectId) {
      throw new Error("Task does not belong to this project.");
    }

    let nextTaskStatus = task.status;
    let nextAssignee = task.suggestedAssignee;
    let taskEventType: string;
    let taskSummary: string;
    let actionMetadata: Record<string, unknown>;

    if (currentProposal.proposedActionType === "assign_task_owner") {
      const assignPayload = payload as ExecutableAssignTaskOwnerActionPayload;
      const members = await dependencies.getProjectMembers(currentProposal.projectId);
      const assigneeMember = members.find(
        (member) => normalizeMemberId(member.userId) === normalizeMemberId(assignPayload.assigneeMemberId),
      );

      if (!assigneeMember) {
        throw new Error("Selected assignee is not a project member.");
      }

      nextAssignee = assigneeMember.userId;
      taskEventType = "task.assigned_by_agent";
      taskSummary = `Agent assigned task owner: ${task.title}`;
      actionMetadata = { assigneeMemberId: assigneeMember.userId };
    } else if (currentProposal.proposedActionType === "suggest_task_progress_update") {
      const progressPayload = payload as ExecutableSuggestTaskProgressUpdateActionPayload;
      nextTaskStatus = progressPayload.suggestedStatus;
      taskEventType = "task.status_updated_by_agent";
      taskSummary = `Agent-updated task status: ${task.title} (${task.status} -> ${nextTaskStatus})`;
      actionMetadata = {
        taskId: task.id,
        commitSha: progressPayload.commitSha,
        suggestedStatus: progressPayload.suggestedStatus,
      };
    } else {
      throw new Error(`Unsupported agent action type: ${currentProposal.proposedActionType}`);
    }

    const updatedAt = dependencies.now();
    const updatedTask = await dependencies.updateTaskDetails(
      task.id,
      {
        title: task.title,
        description: task.description,
        deadline: task.deadline,
        suggestedAssignee: nextAssignee,
        status: nextTaskStatus,
      },
      updatedAt,
    );

    if (!updatedTask) {
      throw new Error("Task could not be updated.");
    }

    const executedAt = dependencies.now();
    currentProposal =
      (await dependencies.markProjectAgentActionProposalExecuted({
        projectId: currentProposal.projectId,
        proposalId: currentProposal.id,
        executedByUserId: input.userId,
        executedAt,
      })) || currentProposal;

    await dependencies.logProjectActivityEvent({
      projectId: updatedTask.projectId,
      actorUserId: input.userId,
      source: "system",
      eventType: taskEventType,
      entityType: "task",
      entityId: updatedTask.id,
      summary: taskSummary,
      metadata: {
        proposalId: currentProposal.id,
        runId: currentProposal.runId,
        proposedActionType: currentProposal.proposedActionType,
        previous: {
          suggestedAssignee: task.suggestedAssignee,
          status: task.status,
        },
        next: {
          suggestedAssignee: updatedTask.suggestedAssignee,
          status: updatedTask.status,
        },
      },
      createdAt: executedAt,
    });

    await dependencies.logProjectActivityEvent({
      projectId: currentProposal.projectId,
      actorUserId: input.userId,
      source: "system",
      eventType: "agent_action.executed",
      entityType: "agent_action_proposal",
      entityId: currentProposal.id,
      summary: `Agent action executed: ${currentProposal.title}`,
      metadata: buildMetadata(currentProposal, actionMetadata),
      createdAt: executedAt,
    });

    return {
      proposal: currentProposal,
      task: updatedTask,
      success: true,
      errorMessage: null,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const failedAt = dependencies.now();
    currentProposal =
      (await dependencies.markProjectAgentActionProposalFailed({
        projectId: currentProposal.projectId,
        proposalId: currentProposal.id,
        executedByUserId: input.userId,
        failedAt,
        executionError: errorMessage,
      })) || currentProposal;

    await dependencies.logProjectActivityEvent({
      projectId: currentProposal.projectId,
      actorUserId: input.userId,
      source: "system",
      eventType: "agent_action.failed",
      entityType: "agent_action_proposal",
      entityId: currentProposal.id,
      summary: `Agent action failed: ${currentProposal.title}`,
      metadata: buildMetadata(currentProposal, { errorMessage }),
      createdAt: failedAt,
    });

    return {
      proposal: currentProposal,
      task: null,
      success: false,
      errorMessage,
    };
  }
}
