import assert from "node:assert/strict";
import test from "node:test";

import {
  approveAndExecuteAgentActionProposal,
  assertPendingAgentActionProposal,
  executeAgentActionProposal,
  rejectAgentActionProposal,
  type AgentActionWorkflowDependencies,
} from "../lib/agent-actions/action-registry";
import {
  generateGithubTaskReviewProposals,
  suggestStatusFromCommit,
} from "../lib/agent-actions/github-task-review";
import { countNewProposalDrafts, generateRiskWatchProposals } from "../lib/agent-actions/risk-watch";
import type {
  Project,
  ProjectActivityEvent,
  ProjectAgentActionProposal,
  ProjectHealthSummary,
  ProjectMember,
  Task,
} from "../types/models";

const project: Project = {
  id: "project_1",
  userId: "owner@example.com",
  name: "Launch",
  idea: "Launch a product",
  guideline: "Ship carefully",
  timeline: [],
  taskIds: [],
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z",
};

const ownerMember: ProjectMember = {
  projectId: project.id,
  userId: "owner@example.com",
  role: "owner",
  joinedAt: "2026-05-01T00:00:00.000Z",
  displayName: "Owner",
  imageUrl: null,
};

const health: ProjectHealthSummary = {
  status: "watch",
  label: "Watch",
  message: "1 tasks need an owner.",
  signals: [
    {
      id: "unassigned_tasks",
      severity: "warning",
      message: "1 tasks do not have an owner.",
      value: 1,
      threshold: 1,
    },
  ],
  evaluatedAt: "2026-05-09",
};

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id || "task_1",
    projectId: overrides.projectId || project.id,
    title: overrides.title || "Build onboarding",
    description: overrides.description || "Create onboarding flow",
    deadline: overrides.deadline || "2026-05-20",
    suggestedAssignee: overrides.suggestedAssignee ?? "Unassigned",
    status: overrides.status || "todo",
    createdAt: overrides.createdAt || "2026-05-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt || "2026-05-01T00:00:00.000Z",
  };
}

function makeProposal(overrides: Partial<ProjectAgentActionProposal> = {}): ProjectAgentActionProposal {
  return {
    id: "proposal_1",
    projectId: project.id,
    runId: "run_1",
    agentId: "risk-watch",
    sourceType: "task",
    sourceId: "task_1",
    dedupeKey: "risk-watch:assign-owner:task:task_1:unassigned",
    proposedActionType: "assign_task_owner",
    title: "Assign owner to task: Build onboarding",
    description: "Risk Watch found an active task without an owner.",
    payload: {
      taskId: "task_1",
      assigneeMemberId: null,
      reason: "Task is active and has no owner.",
    },
    status: "pending",
    createdBy: "system",
    confidence: null,
    requiresApproval: true,
    reviewedByUserId: null,
    reviewedAt: null,
    reviewNote: null,
    executedByUserId: null,
    executedAt: null,
    executionError: null,
    createdAt: "2026-05-09T12:00:00.000Z",
    updatedAt: "2026-05-09T12:00:00.000Z",
    ...overrides,
  };
}

function makeCommitEvent(overrides: Partial<ProjectActivityEvent> = {}): ProjectActivityEvent {
  return {
    id: "github_commit_project_1_abc123",
    projectId: project.id,
    actorUserId: null,
    source: "github",
    eventType: "github.commit.synced",
    entityType: "github_commit",
    entityId: "abc123",
    summary: "Commit: Work on onboarding",
    metadata: {
      sha: "abc123",
      message: "Work on onboarding",
    },
    createdAt: "2026-05-09T12:00:00.000Z",
    ...overrides,
  };
}

function makeProgressProposal(overrides: Partial<ProjectAgentActionProposal> = {}): ProjectAgentActionProposal {
  return makeProposal({
    agentId: "github-task-review",
    sourceType: "github_commit",
    sourceId: "github_commit_project_1_abc123",
    dedupeKey: "github-task-review:task:task_1:commit:abc123",
    proposedActionType: "suggest_task_progress_update",
    title: "Update task status from commit: Build onboarding",
    description: "A recent GitHub commit appears related to this task.",
    payload: {
      taskId: "task_1",
      commitSha: "abc123",
      commitMessage: "Work on onboarding",
      suggestedStatus: "in_progress",
      suggestedProgress: null,
      reason: "Commit references task title keyword.",
    },
    ...overrides,
  });
}

function createDependencies(input: {
  proposal?: ProjectAgentActionProposal;
  task?: Task | null;
  members?: ProjectMember[];
  updateThrows?: boolean;
}) {
  let proposal = input.proposal || makeProposal();
  let task = input.task === undefined ? makeTask() : input.task;
  const logs: Array<{ eventType: string }> = [];
  const calls = { updateTaskDetails: 0 };

  const dependencies: AgentActionWorkflowDependencies = {
    async getTaskById(taskId) {
      return task?.id === taskId ? task : null;
    },
    async getProjectMembers() {
      return input.members || [ownerMember];
    },
    async updateTaskDetails(_taskId, payload, updatedAt) {
      calls.updateTaskDetails += 1;
      if (input.updateThrows) {
        throw new Error("database unavailable");
      }

      if (!task) return null;
      task = {
        ...task,
        ...payload,
        updatedAt,
      };
      return task;
    },
    async updateProjectAgentActionProposalStatus(update) {
      proposal = {
        ...proposal,
        status: update.status,
        payload: update.payload || proposal.payload,
        reviewedByUserId: update.reviewedByUserId ?? proposal.reviewedByUserId,
        reviewedAt: update.reviewedAt ?? proposal.reviewedAt,
        reviewNote: update.reviewNote ?? proposal.reviewNote,
        executedByUserId: update.executedByUserId ?? proposal.executedByUserId,
        executedAt: update.executedAt ?? proposal.executedAt,
        executionError: update.executionError ?? proposal.executionError,
        updatedAt: update.timestamp,
      };
      return proposal;
    },
    async markProjectAgentActionProposalRejected(update) {
      proposal = {
        ...proposal,
        status: "rejected",
        reviewedByUserId: update.reviewedByUserId,
        reviewedAt: update.reviewedAt,
        reviewNote: update.reviewNote ?? null,
        updatedAt: update.reviewedAt,
      };
      return proposal;
    },
    async markProjectAgentActionProposalExecuting(update) {
      proposal = { ...proposal, status: "executing", updatedAt: update.timestamp };
      return proposal;
    },
    async markProjectAgentActionProposalExecuted(update) {
      proposal = {
        ...proposal,
        status: "executed",
        executedByUserId: update.executedByUserId,
        executedAt: update.executedAt,
        executionError: null,
        updatedAt: update.executedAt,
      };
      return proposal;
    },
    async markProjectAgentActionProposalFailed(update) {
      proposal = {
        ...proposal,
        status: "failed",
        executedByUserId: update.executedByUserId,
        executedAt: update.failedAt,
        executionError: update.executionError,
        updatedAt: update.failedAt,
      };
      return proposal;
    },
    async logProjectActivityEvent(event) {
      logs.push({ eventType: event.eventType });
    },
    now() {
      return "2026-05-09T12:00:00.000Z";
    },
  };

  return {
    dependencies,
    logs,
    calls,
    getProposal: () => proposal,
    getTask: () => task,
  };
}

test("Risk Watch creates proposal for unassigned active task", () => {
  const proposals = generateRiskWatchProposals({
    project,
    tasks: [makeTask()],
    members: [ownerMember],
    health,
    now: "2026-05-09T12:00:00.000Z",
  });

  assert.equal(proposals.length, 1);
  assert.equal(proposals[0]?.proposedActionType, "assign_task_owner");
  assert.equal(proposals[0]?.createdBy, "system");
  assert.equal(proposals[0]?.requiresApproval, true);
  assert.deepEqual(proposals[0]?.payload, {
    taskId: "task_1",
    assigneeMemberId: null,
    reason: "Task is active and has no owner.",
  });
});

test("Risk Watch creates overdue unassigned task proposal with deterministic dedupe key", () => {
  const proposals = generateRiskWatchProposals({
    project,
    tasks: [makeTask({ deadline: "2026-05-08" })],
    members: [ownerMember],
    health,
    now: "2026-05-09T12:00:00.000Z",
  });

  assert.equal(proposals.length, 1);
  assert.equal(proposals[0]?.title, "Assign owner to overdue task: Build onboarding");
  assert.equal(proposals[0]?.dedupeKey, "risk-watch:assign-owner:task:task_1:overdue:2026-05-08");
});

test("Risk Watch does not create proposal for completed task", () => {
  const proposals = generateRiskWatchProposals({
    project,
    tasks: [makeTask({ status: "done" })],
    members: [ownerMember],
    health,
    now: "2026-05-09T12:00:00.000Z",
  });

  assert.equal(proposals.length, 0);
});

test("Risk Watch does not recreate duplicate pending proposal draft", () => {
  const drafts = generateRiskWatchProposals({
    project,
    tasks: [makeTask()],
    members: [ownerMember],
    health,
    now: "2026-05-09T12:00:00.000Z",
  });
  const existing = [makeProposal({ dedupeKey: drafts[0]?.dedupeKey, status: "pending" })];

  assert.equal(countNewProposalDrafts(drafts, existing), 0);
});

test("GitHub Task Review creates proposal for exact task id in commit message", () => {
  const drafts = generateGithubTaskReviewProposals({
    project,
    tasks: [makeTask()],
    activityEvents: [makeCommitEvent({ metadata: { sha: "abc123", message: "Start task_1 implementation" } })],
  });

  assert.equal(drafts.length, 1);
  assert.equal(drafts[0]?.proposedActionType, "suggest_task_progress_update");
  assert.equal(drafts[0]?.dedupeKey, "github-task-review:task:task_1:commit:abc123");
  assert.equal(drafts[0]?.payload.suggestedStatus, "in_progress");
});

test("GitHub Task Review creates proposal for task title keyword", () => {
  const drafts = generateGithubTaskReviewProposals({
    project,
    tasks: [makeTask()],
    activityEvents: [makeCommitEvent()],
  });

  assert.equal(drafts.length, 1);
  assert.match(String(drafts[0]?.payload.reason), /onboarding/);
});

test("GitHub Task Review ignores unrelated commits and completed tasks", () => {
  const unrelated = generateGithubTaskReviewProposals({
    project,
    tasks: [makeTask()],
    activityEvents: [makeCommitEvent({ metadata: { sha: "abc123", message: "Update billing copy" } })],
  });
  const completed = generateGithubTaskReviewProposals({
    project,
    tasks: [makeTask({ status: "done" })],
    activityEvents: [makeCommitEvent()],
  });

  assert.equal(unrelated.length, 0);
  assert.equal(completed.length, 0);
});

test("GitHub Task Review skips a duplicate pending proposal by task and commit", () => {
  const drafts = generateGithubTaskReviewProposals({
    project,
    tasks: [makeTask()],
    activityEvents: [makeCommitEvent()],
  });

  assert.equal(countNewProposalDrafts(drafts, [makeProgressProposal()]), 0);
});

test("GitHub Task Review status suggestions remain conservative", () => {
  assert.equal(suggestStatusFromCommit(makeTask({ status: "todo" }), "Fix onboarding"), "in_progress");
  assert.equal(suggestStatusFromCommit(makeTask({ status: "in_progress" }), "Refine onboarding"), null);
  assert.equal(suggestStatusFromCommit(makeTask({ status: "in_progress" }), "Finish onboarding"), "done");
});

test("cannot approve non-pending proposal", async () => {
  await assert.rejects(
    () =>
      approveAndExecuteAgentActionProposal({
        proposal: makeProposal({ status: "executed" }),
        approvedPayload: { assigneeMemberId: ownerMember.userId },
        userId: ownerMember.userId,
        dependencies: createDependencies({}).dependencies,
      }),
    /Only pending agent action proposals can be reviewed/,
  );

  assert.throws(
    () => assertPendingAgentActionProposal(makeProposal({ status: "rejected" })),
    /Only pending agent action proposals can be reviewed/,
  );
});

test("cannot execute unsupported action type", async () => {
  const unsupported = {
    ...makeProposal({ status: "approved" }),
    proposedActionType: "delete_project",
  } as unknown as ProjectAgentActionProposal;
  const fake = createDependencies({ proposal: unsupported });

  const result = await executeAgentActionProposal({
    proposal: unsupported,
    approvedPayload: { assigneeMemberId: ownerMember.userId },
    userId: ownerMember.userId,
    dependencies: fake.dependencies,
  });

  assert.equal(result.success, false);
  assert.equal(result.proposal.status, "failed");
  assert.match(result.errorMessage || "", /Unsupported agent action type/);
});

test("cannot assign task owner to non-project member", async () => {
  const fake = createDependencies({ members: [ownerMember] });

  const result = await executeAgentActionProposal({
    proposal: makeProposal({ status: "approved" }),
    approvedPayload: { assigneeMemberId: "other@example.com" },
    userId: ownerMember.userId,
    dependencies: fake.dependencies,
  });

  assert.equal(result.success, false);
  assert.equal(result.proposal.status, "failed");
  assert.equal(fake.calls.updateTaskDetails, 0);
  assert.match(result.errorMessage || "", /Selected assignee is not a project member/);
});

test("successful approval updates task assignee and marks proposal executed", async () => {
  const fake = createDependencies({});

  const result = await approveAndExecuteAgentActionProposal({
    proposal: makeProposal(),
    approvedPayload: { assigneeMemberId: ownerMember.userId },
    userId: ownerMember.userId,
    dependencies: fake.dependencies,
  });

  assert.equal(result.success, true, result.errorMessage || undefined);
  assert.equal(result.proposal.status, "executed");
  assert.equal(result.task?.suggestedAssignee, ownerMember.userId);
  assert.equal(fake.calls.updateTaskDetails, 1);
  assert.deepEqual(
    fake.logs.map((log) => log.eventType),
    ["agent_action.approved", "task.assigned_by_agent", "agent_action.executed"],
  );
});

test("approval of task progress suggestion updates task status", async () => {
  const fake = createDependencies({ proposal: makeProgressProposal(), task: makeTask() });

  const result = await approveAndExecuteAgentActionProposal({
    proposal: makeProgressProposal(),
    approvedPayload: { suggestedStatus: "in_progress" },
    userId: ownerMember.userId,
    dependencies: fake.dependencies,
  });

  assert.equal(result.success, true, result.errorMessage || undefined);
  assert.equal(result.task?.status, "in_progress");
  assert.deepEqual(
    fake.logs.map((log) => log.eventType),
    ["agent_action.approved", "task.status_updated_by_agent", "agent_action.executed"],
  );
});

test("failed execution marks proposal failed", async () => {
  const fake = createDependencies({ updateThrows: true });

  const result = await executeAgentActionProposal({
    proposal: makeProposal({ status: "approved" }),
    approvedPayload: { assigneeMemberId: ownerMember.userId },
    userId: ownerMember.userId,
    dependencies: fake.dependencies,
  });

  assert.equal(result.success, false);
  assert.equal(result.proposal.status, "failed");
  assert.equal(result.proposal.executionError, "database unavailable");
});

test("reject marks proposal rejected and does not mutate task", async () => {
  const fake = createDependencies({});

  const rejected = await rejectAgentActionProposal({
    proposal: makeProposal(),
    userId: ownerMember.userId,
    dependencies: fake.dependencies,
  });

  assert.equal(rejected.status, "rejected");
  assert.equal(fake.calls.updateTaskDetails, 0);
  assert.deepEqual(fake.logs.map((log) => log.eventType), ["agent_action.rejected"]);
});

test("rejecting task progress suggestion does not update task", async () => {
  const fake = createDependencies({ proposal: makeProgressProposal() });

  const rejected = await rejectAgentActionProposal({
    proposal: makeProgressProposal(),
    userId: ownerMember.userId,
    dependencies: fake.dependencies,
  });

  assert.equal(rejected.status, "rejected");
  assert.equal(fake.calls.updateTaskDetails, 0);
});
