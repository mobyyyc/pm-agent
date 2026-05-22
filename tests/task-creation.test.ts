import assert from "node:assert/strict";
import test from "node:test";

import { generateRiskWatchProposals } from "../lib/agent-actions/risk-watch";
import { createTaskRequestSchema } from "../lib/validators";
import type { Project, ProjectHealthSummary, ProjectMember, Task } from "../types/models";
import { validateTask } from "../lib/validators";

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
  displayName: "Project Owner",
  imageUrl: null,
};

const health: ProjectHealthSummary = {
  status: "watch",
  label: "Watch",
  message: "Task ownership needs attention.",
  signals: [],
  evaluatedAt: "2026-05-09",
};

function makeTask(overrides: Partial<Task>): Task {
  return validateTask({
    id: overrides.id || `task_${crypto.randomUUID()}`,
    projectId: overrides.projectId || project.id,
    title: overrides.title || "Task",
    description: overrides.description || "Do the work",
    deadline: overrides.deadline || "2026-05-20",
    suggestedAssignee: overrides.suggestedAssignee ?? "Unassigned",
    status: overrides.status || "todo",
    createdAt: overrides.createdAt || "2026-05-09T12:00:00.000Z",
    updatedAt: overrides.updatedAt || "2026-05-09T12:00:00.000Z",
  });
}

test("createTaskRequestSchema defaults a missing assignee to unassigned", () => {
  const parsed = createTaskRequestSchema.parse({
    projectId: project.id,
    title: "Write docs",
    description: "Document the release flow.",
    deadline: "2026-05-20",
  });

  assert.equal(parsed.suggestedAssignee, "Unassigned");
  assert.equal(parsed.status, "todo");

  const task = makeTask({
    id: "task_created_without_assignee",
    title: parsed.title,
    description: parsed.description,
    deadline: parsed.deadline,
    suggestedAssignee: parsed.suggestedAssignee,
    status: parsed.status,
  });

  assert.equal(task.suggestedAssignee, "Unassigned");
});

test("createTaskRequestSchema preserves an explicit assignee", () => {
  const parsed = createTaskRequestSchema.parse({
    projectId: project.id,
    title: "Review logs",
    description: "Check the release logs.",
    deadline: "2026-05-20",
    suggestedAssignee: "  owner@example.com  ",
  });

  const task = makeTask({
    id: "task_explicit_assignee",
    title: parsed.title,
    description: parsed.description,
    deadline: parsed.deadline,
    suggestedAssignee: parsed.suggestedAssignee,
    status: parsed.status,
  });

  assert.equal(parsed.suggestedAssignee, "owner@example.com");
  assert.equal(task.suggestedAssignee, "owner@example.com");
});

test("Risk Watch detects a newly created unassigned task", () => {
  const task = makeTask({
    id: "task_risk_watch",
    title: "Prepare launch notes",
    deadline: "2026-05-08",
    suggestedAssignee: "Unassigned",
  });

  const proposals = generateRiskWatchProposals({
    project,
    tasks: [task],
    members: [ownerMember],
    health,
    now: "2026-05-09T12:00:00.000Z",
  });

  assert.equal(proposals.length, 1);
  assert.equal(proposals[0]?.proposedActionType, "assign_task_owner");
  assert.equal(proposals[0]?.payload.taskId, task.id);
  assert.equal(proposals[0]?.payload.assigneeMemberId, null);
});
