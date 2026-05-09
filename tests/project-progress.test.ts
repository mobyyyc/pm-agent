import assert from "node:assert/strict";
import test from "node:test";

import { calculateProjectProgress } from "../lib/project-progress";
import type { Project, Task } from "../types/models";

const baseProject: Project = {
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

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: overrides.id || `task_${crypto.randomUUID()}`,
    projectId: overrides.projectId || baseProject.id,
    title: overrides.title || "Task",
    description: overrides.description || "Do the work",
    deadline: overrides.deadline || "2026-05-20",
    suggestedAssignee: overrides.suggestedAssignee ?? "owner@example.com",
    status: overrides.status || "todo",
    createdAt: overrides.createdAt || "2026-05-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt || "2026-05-01T00:00:00.000Z",
  };
}

test("calculateProjectProgress handles no tasks", () => {
  const progress = calculateProjectProgress(baseProject, [], "2026-05-09");

  assert.equal(progress.totalTasks, 0);
  assert.equal(progress.completedTasks, 0);
  assert.equal(progress.completionPercent, 0);
  assert.equal(progress.overdueTasks, 0);
  assert.equal(progress.dueSoonTasks, 0);
});

test("calculateProjectProgress handles all tasks completed", () => {
  const tasks = [
    makeTask({ id: "task_1", status: "done" }),
    makeTask({ id: "task_2", status: "done" }),
  ];

  const progress = calculateProjectProgress(baseProject, tasks, "2026-05-09");

  assert.equal(progress.totalTasks, 2);
  assert.equal(progress.completedTasks, 2);
  assert.equal(progress.completionPercent, 100);
  assert.equal(progress.overdueTasks, 0);
  assert.equal(progress.dueSoonTasks, 0);
});

test("calculateProjectProgress counts mixed task statuses", () => {
  const tasks = [
    makeTask({ id: "task_1", status: "done" }),
    makeTask({ id: "task_2", status: "in_progress" }),
    makeTask({ id: "task_3", status: "todo" }),
  ];

  const progress = calculateProjectProgress(baseProject, tasks, "2026-05-09");

  assert.equal(progress.completedTasks, 1);
  assert.equal(progress.inProgressTasks, 1);
  assert.equal(progress.todoTasks, 1);
  assert.equal(progress.completionPercent, 33);
});

test("calculateProjectProgress counts overdue active tasks", () => {
  const tasks = [
    makeTask({ id: "task_1", status: "todo", deadline: "2026-05-08" }),
    makeTask({ id: "task_2", status: "in_progress", deadline: "2026-05-01" }),
    makeTask({ id: "task_3", status: "done", deadline: "2026-05-01" }),
  ];

  const progress = calculateProjectProgress(baseProject, tasks, "2026-05-09");

  assert.equal(progress.overdueTasks, 2);
});

test("calculateProjectProgress counts due-soon active tasks", () => {
  const tasks = [
    makeTask({ id: "task_1", status: "todo", deadline: "2026-05-09" }),
    makeTask({ id: "task_2", status: "in_progress", deadline: "2026-05-16" }),
    makeTask({ id: "task_3", status: "todo", deadline: "2026-05-17" }),
    makeTask({ id: "task_4", status: "done", deadline: "2026-05-10" }),
  ];

  const progress = calculateProjectProgress(baseProject, tasks, "2026-05-09");

  assert.equal(progress.dueSoonTasks, 2);
});

test("calculateProjectProgress counts unassigned tasks", () => {
  const tasks = [
    makeTask({ id: "task_1", suggestedAssignee: "Unassigned" }),
    makeTask({ id: "task_2", suggestedAssignee: "   " }),
    makeTask({ id: "task_3", suggestedAssignee: "owner@example.com" }),
  ];

  const progress = calculateProjectProgress(baseProject, tasks, "2026-05-09");

  assert.equal(progress.unassignedTasks, 2);
});

test("calculateProjectProgress derives timeline window and current phase", () => {
  const project: Project = {
    ...baseProject,
    timeline: [
      {
        phase: "Discovery",
        startDate: "2026-05-01",
        endDate: "2026-05-05",
        deliverable: "Validated plan",
      },
      {
        phase: "Build",
        startDate: "2026-05-06",
        endDate: "2026-05-20",
        deliverable: "Working product",
      },
      {
        phase: "Launch",
        startDate: "2026-05-21",
        endDate: "2026-05-31",
        deliverable: "Public release",
      },
    ],
  };

  const progress = calculateProjectProgress(project, [], "2026-05-09");

  assert.equal(progress.timelinePhaseCount, 3);
  assert.equal(progress.completedTimelinePhases, 1);
  assert.equal(progress.currentTimelinePhase, "Build");
  assert.deepEqual(progress.projectWindow, {
    startDate: "2026-05-01",
    endDate: "2026-05-31",
  });
});
