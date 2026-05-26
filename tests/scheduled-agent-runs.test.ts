import assert from "node:assert/strict";
import test from "node:test";

import { runDeterministicProjectAgent, type DeterministicAgentRunDependencies } from "../lib/agent-runs/run-agent";
import { findAgentDefinition } from "../lib/agents";
import {
  calculateNextRunFromScheduleConfig,
  cronToScheduleConfig,
  getScheduleDisplayLabel,
  parseScheduleConfig,
  scheduleConfigToCron,
} from "../lib/agent-runs/schedule-config";
import {
  calculateNextRunAt,
  getDueProjectAgents,
  runScheduledProjectAgents,
  type ScheduledAgentRunnerDependencies,
} from "../lib/agent-runs/scheduler";
import type {
  Project,
  ProjectActivityEvent,
  ProjectAgent,
  ProjectAgentActionProposal,
  ProjectAgentRun,
  ProjectMember,
  Task,
} from "../types/models";

const baseTime = "2026-05-25T12:00:00.000Z";

function makeAgent(overrides: Partial<ProjectAgent> = {}): ProjectAgent {
  return {
    projectId: "project_1",
    agentId: "risk-watch",
    name: "Risk Watch Agent",
    description: "Monitors tasks for delay and delivery risk",
    category: "Monitoring",
    status: "active",
    schedule: "0 */6 * * *",
    config: {},
    lastRunAt: null,
    nextRunAt: null,
    createdByUserId: "owner@example.com",
    createdAt: "2026-05-20T00:00:00.000Z",
    updatedAt: "2026-05-20T00:00:00.000Z",
    ...overrides,
  };
}

function makeProject(): Project {
  return {
    id: "project_1",
    userId: "owner@example.com",
    name: "Launch Plan",
    idea: "Launch the product",
    guideline: "Ship carefully",
    timeline: [],
    taskIds: ["task_1"],
    createdAt: "2026-05-20T00:00:00.000Z",
    updatedAt: "2026-05-20T00:00:00.000Z",
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task_1",
    projectId: "project_1",
    title: "Prepare launch checklist",
    description: "Create launch checklist",
    deadline: "2026-05-24",
    suggestedAssignee: "Unassigned",
    status: "todo",
    createdAt: "2026-05-20T00:00:00.000Z",
    updatedAt: "2026-05-20T00:00:00.000Z",
    ...overrides,
  };
}

function makeMember(): ProjectMember {
  return {
    projectId: "project_1",
    userId: "owner@example.com",
    role: "owner",
    joinedAt: "2026-05-20T00:00:00.000Z",
    displayName: "Owner",
    imageUrl: null,
  };
}

function makeRun(overrides: Partial<ProjectAgentRun> = {}): ProjectAgentRun {
  return {
    id: "agent_run_1",
    projectId: "project_1",
    agentId: "risk-watch",
    triggerType: "scheduled",
    status: "running",
    startedByUserId: null,
    inputSnapshot: null,
    summary: null,
    errorMessage: null,
    startedAt: baseTime,
    completedAt: null,
    createdAt: baseTime,
    ...overrides,
  };
}

function makeProposal(overrides: Partial<ProjectAgentActionProposal> = {}): ProjectAgentActionProposal {
  return {
    id: "agent_action_1",
    projectId: "project_1",
    runId: "agent_run_1",
    agentId: "risk-watch",
    sourceType: "task",
    sourceId: "task_1",
    dedupeKey: "risk-watch:assign-owner:task:task_1:overdue:2026-05-24",
    proposedActionType: "assign_task_owner",
    title: "Assign owner",
    description: "Assign task owner",
    payload: {
      taskId: "task_1",
      assigneeMemberId: null,
      reason: "Task is overdue.",
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
    createdAt: baseTime,
    updatedAt: baseTime,
    ...overrides,
  };
}

test("due agent selection uses active status, nextRunAt, lastRunAt, and schedule", () => {
  const due = makeAgent({ agentId: "risk-watch", nextRunAt: "2026-05-25T11:59:00.000Z" });
  const future = makeAgent({ agentId: "github-task-review", nextRunAt: "2026-05-25T12:01:00.000Z" });
  const paused = makeAgent({ agentId: "daily-standup", status: "paused", nextRunAt: "2026-05-25T11:00:00.000Z" });
  const noSchedule = makeAgent({ agentId: "backlog-triage", schedule: null, nextRunAt: null, lastRunAt: null });
  const calculatedDue = makeAgent({
    agentId: "weekly-report",
    schedule: "0 9 * * MON",
    lastRunAt: "2026-05-18T09:00:00.000Z",
    nextRunAt: null,
  });

  assert.deepEqual(
    getDueProjectAgents([due, future, paused, noSchedule, calculatedDue], baseTime).map((agent) => agent.agentId),
    ["risk-watch", "weekly-report"],
  );
});

test("nextRunAt calculation supports current catalog cron formats", () => {
  assert.equal(
    calculateNextRunAt("0 */6 * * *", "2026-05-25T12:00:00.000Z"),
    "2026-05-25T18:00:00.000Z",
  );
  assert.equal(
    calculateNextRunAt("0 9 * * MON", "2026-05-25T12:00:00.000Z"),
    "2026-06-01T09:00:00.000Z",
  );
  assert.equal(
    calculateNextRunAt("0 9 * * MON-FRI", "2026-05-29T09:01:00.000Z"),
    "2026-06-01T09:00:00.000Z",
  );
});

test("Risk Watch catalog definition installs with the scheduler-supported key and schedule", () => {
  const riskWatch = findAgentDefinition("risk-watch");

  assert.ok(riskWatch);
  assert.equal(riskWatch.id, "risk-watch");
  assert.equal(riskWatch.recommendedSchedule, "0 */6 * * *");
  assert.equal(scheduleConfigToCron(cronToScheduleConfig(riskWatch.recommendedSchedule) || { type: "manual" }), "0 */6 * * *");
  assert.equal(
    calculateNextRunAt(riskWatch.recommendedSchedule, "2026-05-25T12:00:00.000Z"),
    "2026-05-25T18:00:00.000Z",
  );
});

test("friendly schedule config converts to internal cron safely", () => {
  assert.equal(scheduleConfigToCron({ type: "manual" }), null);
  assert.equal(scheduleConfigToCron({ type: "interval", every: 6, unit: "hour" }), "0 */6 * * *");
  assert.equal(scheduleConfigToCron({ type: "daily", time: "09:00" }), "0 9 * * *");
  assert.equal(scheduleConfigToCron({ type: "weekdays", time: "09:00" }), "0 9 * * MON-FRI");
  assert.equal(scheduleConfigToCron({ type: "weekly", dayOfWeek: "MON", time: "09:00" }), "0 9 * * MON");
});

test("existing cron strings convert to readable display labels", () => {
  assert.equal(getScheduleDisplayLabel(null), "Runs manually");
  assert.equal(getScheduleDisplayLabel("0 */6 * * *"), "Runs every 6 hours");
  assert.equal(getScheduleDisplayLabel("0 9 * * *"), "Runs every day at 9:00 AM");
  assert.equal(getScheduleDisplayLabel("0 9 * * MON-FRI"), "Runs every weekday at 9:00 AM");
  assert.equal(getScheduleDisplayLabel("0 9 * * MON"), "Runs every Monday at 9:00 AM");
  assert.equal(getScheduleDisplayLabel("not cron"), "Runs on a custom schedule");
});

test("daily schedule config calculates the next run", () => {
  assert.equal(
    calculateNextRunFromScheduleConfig({ type: "daily", time: "09:00" }, "2026-05-25T08:59:00.000Z"),
    "2026-05-25T09:00:00.000Z",
  );
  assert.equal(
    calculateNextRunFromScheduleConfig({ type: "daily", time: "09:00" }, "2026-05-25T09:00:00.000Z"),
    "2026-05-26T09:00:00.000Z",
  );
});

test("weekday schedule config skips weekends", () => {
  assert.equal(
    calculateNextRunFromScheduleConfig({ type: "weekdays", time: "09:00" }, "2026-05-29T09:01:00.000Z"),
    "2026-06-01T09:00:00.000Z",
  );
});

test("weekly schedule config calculates the selected day", () => {
  assert.equal(
    calculateNextRunFromScheduleConfig(
      { type: "weekly", dayOfWeek: "TUE", time: "14:30" },
      "2026-05-25T12:00:00.000Z",
    ),
    "2026-05-26T14:30:00.000Z",
  );
});

test("manual schedule config is never due automatically", () => {
  assert.equal(calculateNextRunFromScheduleConfig({ type: "manual" }, baseTime), null);
  assert.deepEqual(
    getDueProjectAgents([makeAgent({ schedule: null })], baseTime),
    [],
  );
});

test("invalid schedule config is rejected safely", () => {
  assert.throws(() => parseScheduleConfig({ type: "daily", time: "25:00" }));
  assert.throws(() => scheduleConfigToCron({ type: "interval", every: 5, unit: "hour" }));
  assert.throws(() => scheduleConfigToCron({ type: "interval", every: 2, unit: "day" }));
});

test("existing raw cron strings still drive due selection", () => {
  const agent = makeAgent({
    schedule: "0 9 * * MON-FRI",
    lastRunAt: "2026-05-22T09:00:00.000Z",
    nextRunAt: null,
  });

  assert.equal(cronToScheduleConfig(agent.schedule)?.type, "weekdays");
  assert.deepEqual(getDueProjectAgents([agent], "2026-05-25T09:00:00.000Z").map((item) => item.agentId), [
    "risk-watch",
  ]);
});

test("scheduled deterministic runner creates pending proposals without executing task mutations", async () => {
  const createdInputs: Array<{ requiresApproval: boolean; status?: string; payload: Record<string, unknown> }> = [];
  const dependencies: DeterministicAgentRunDependencies = {
    getProjectById: async () => makeProject(),
    getProjectMembers: async () => [makeMember()],
    getTasksByProjectId: async () => [makeTask()],
    getProjectActivityEventsByProjectId: async () => [],
    createProjectAgentRun: async () => makeRun(),
    updateProjectAgentRunStatus: async (input) => makeRun({
      status: input.status,
      summary: input.summary ?? null,
      completedAt: input.completedAt ?? null,
    }),
    createProjectAgentActionProposalIfNotExists: async (input) => {
      const optionalStatus = (input as { status?: string }).status;
      createdInputs.push({
        requiresApproval: input.requiresApproval,
        status: optionalStatus,
        payload: input.payload,
      });
      return { proposal: makeProposal({ payload: input.payload }), created: true };
    },
    logProjectActivityEvent: async () => undefined,
    now: () => baseTime,
  };

  const result = await runDeterministicProjectAgent({
    projectId: "project_1",
    agentId: "risk-watch",
    triggerType: "scheduled",
    startedByUserId: null,
    now: baseTime,
    logActivityEvents: false,
    dependencies,
  });

  assert.equal(result.createdProposalCount, 1);
  assert.equal(createdInputs.length, 1);
  assert.equal(createdInputs[0].requiresApproval, true);
  assert.equal(createdInputs[0].status, undefined);
  assert.equal(createdInputs[0].payload.assigneeMemberId, null);
});

test("scheduled deterministic runner preserves proposal dedupe results", async () => {
  const dependencies: DeterministicAgentRunDependencies = {
    getProjectById: async () => makeProject(),
    getProjectMembers: async () => [makeMember()],
    getTasksByProjectId: async () => [makeTask()],
    getProjectActivityEventsByProjectId: async () => [],
    createProjectAgentRun: async () => makeRun(),
    updateProjectAgentRunStatus: async (input) => makeRun({ status: input.status, summary: input.summary ?? null }),
    createProjectAgentActionProposalIfNotExists: async (input) => ({
      proposal: makeProposal({ payload: input.payload }),
      created: false,
    }),
    logProjectActivityEvent: async () => undefined,
    now: () => baseTime,
  };

  const result = await runDeterministicProjectAgent({
    projectId: "project_1",
    agentId: "risk-watch",
    triggerType: "scheduled",
    startedByUserId: null,
    now: baseTime,
    logActivityEvents: false,
    dependencies,
  });

  assert.equal(result.createdProposalCount, 0);
  assert.equal(result.skippedProposalCount, 1);
});

test("scheduled runner skips unsupported due agents safely", async () => {
  const updates: Array<{ agentId: string; lastRunAt: string | null; nextRunAt: string | null }> = [];
  const dependencies: ScheduledAgentRunnerDependencies = {
    getActiveProjectAgents: async () => [makeAgent({ agentId: "weekly-report", schedule: "0 9 * * MON" })],
    updateProjectAgentScheduleState: async (input) => {
      updates.push(input);
      return makeAgent({ agentId: input.agentId, lastRunAt: input.lastRunAt, nextRunAt: input.nextRunAt });
    },
    runAgent: async () => {
      throw new Error("unsupported agent should not run");
    },
    now: () => baseTime,
  };

  const summary = await runScheduledProjectAgents(dependencies);

  assert.equal(summary.ranCount, 0);
  assert.equal(summary.skippedCount, 1);
  assert.equal(summary.results[0].reason, "unsupported_agent");
  assert.equal(updates.length, 1);
  assert.equal(updates[0].lastRunAt, null);
  assert.equal(updates[0].nextRunAt, "2026-06-01T09:00:00.000Z");
});

test("scheduled runner skips GitHub Task Review until scheduled support is implemented", async () => {
  const dependencies: ScheduledAgentRunnerDependencies = {
    getActiveProjectAgents: async () => [makeAgent({ agentId: "github-task-review", nextRunAt: "2026-05-25T11:00:00.000Z" })],
    updateProjectAgentScheduleState: async (input) =>
      makeAgent({ agentId: input.agentId, lastRunAt: input.lastRunAt, nextRunAt: input.nextRunAt }),
    runAgent: async () => {
      throw new Error("GitHub Task Review should not be run by the scheduler yet");
    },
    now: () => baseTime,
  };

  const summary = await runScheduledProjectAgents(dependencies);

  assert.equal(summary.ranCount, 0);
  assert.equal(summary.skippedCount, 1);
  assert.equal(summary.results[0].agentId, "github-task-review");
  assert.equal(summary.results[0].reason, "unsupported_agent");
});

test("scheduled runner runs due Risk Watch agents and reports pending proposals", async () => {
  const runs: string[] = [];
  const updates: Array<{ lastRunAt: string | null; nextRunAt: string | null }> = [];
  const dependencies: ScheduledAgentRunnerDependencies = {
    getActiveProjectAgents: async () => [makeAgent({ nextRunAt: "2026-05-25T11:00:00.000Z" })],
    updateProjectAgentScheduleState: async (input) => {
      updates.push({ lastRunAt: input.lastRunAt, nextRunAt: input.nextRunAt });
      return makeAgent({ lastRunAt: input.lastRunAt, nextRunAt: input.nextRunAt });
    },
    runAgent: async (input) => {
      runs.push(input.agentId);
      return {
        run: { id: "agent_run_risk_watch" },
        createdProposalCount: 2,
        skippedProposalCount: 1,
      };
    },
    now: () => baseTime,
  };

  const summary = await runScheduledProjectAgents(dependencies);

  assert.deepEqual(runs, ["risk-watch"]);
  assert.equal(summary.ranCount, 1);
  assert.equal(summary.proposedCount, 2);
  assert.equal(summary.duplicateProposalCount, 1);
  assert.equal(summary.results[0].status, "ran");
  assert.equal(updates[0].lastRunAt, baseTime);
  assert.equal(updates[0].nextRunAt, "2026-05-25T18:00:00.000Z");
});

test("scheduled runner continues when one due agent fails", async () => {
  const runOrder: string[] = [];
  const dependencies: ScheduledAgentRunnerDependencies = {
    getActiveProjectAgents: async () => [
      makeAgent({ projectId: "project_1", agentId: "risk-watch" }),
      makeAgent({ projectId: "project_2", agentId: "risk-watch", nextRunAt: "2026-05-25T11:30:00.000Z" }),
    ],
    updateProjectAgentScheduleState: async (input) =>
      makeAgent({ projectId: input.projectId, agentId: input.agentId, lastRunAt: input.lastRunAt, nextRunAt: input.nextRunAt }),
    runAgent: async (input) => {
      runOrder.push(input.projectId);
      if (input.projectId === "project_1") {
        throw new Error("Risk Watch failed");
      }
      return {
        run: { id: "agent_run_success" },
        createdProposalCount: 2,
        skippedProposalCount: 1,
      };
    },
    now: () => baseTime,
  };

  const summary = await runScheduledProjectAgents(dependencies);

  assert.deepEqual(runOrder, ["project_1", "project_2"]);
  assert.equal(summary.failedCount, 1);
  assert.equal(summary.ranCount, 1);
  assert.equal(summary.proposedCount, 2);
  assert.equal(summary.duplicateProposalCount, 1);
});

test("GitHub Task Review scheduled run only creates proposals from synced commit activity", async () => {
  const activity: ProjectActivityEvent = {
    id: "event_1",
    projectId: "project_1",
    actorUserId: null,
    source: "github",
    eventType: "github.commit.synced",
    entityType: "github_commit",
    entityId: "abc123",
    summary: "Commit: start task_1",
    metadata: {
      sha: "abc123",
      message: "start task_1",
      branchName: "main",
    },
    createdAt: baseTime,
  };
  const proposals: Record<string, unknown>[] = [];
  const dependencies: DeterministicAgentRunDependencies = {
    getProjectById: async () => makeProject(),
    getProjectMembers: async () => [makeMember()],
    getTasksByProjectId: async () => [makeTask({ status: "todo" })],
    getProjectActivityEventsByProjectId: async () => [activity],
    createProjectAgentRun: async () => makeRun({ agentId: "github-task-review" }),
    updateProjectAgentRunStatus: async (input) => makeRun({ agentId: "github-task-review", status: input.status }),
    createProjectAgentActionProposalIfNotExists: async (input) => {
      proposals.push(input.payload);
      return {
        proposal: makeProposal({
          agentId: "github-task-review",
          sourceType: "github_commit",
          proposedActionType: "suggest_task_progress_update",
          payload: input.payload,
        }),
        created: true,
      };
    },
    logProjectActivityEvent: async () => undefined,
    now: () => baseTime,
  };

  const result = await runDeterministicProjectAgent({
    projectId: "project_1",
    agentId: "github-task-review",
    triggerType: "scheduled",
    startedByUserId: null,
    now: baseTime,
    logActivityEvents: false,
    dependencies,
  });

  assert.equal(result.createdProposalCount, 1);
  assert.equal(proposals[0].suggestedStatus, "in_progress");
});
