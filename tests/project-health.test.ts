import assert from "node:assert/strict";
import test from "node:test";

import { calculateProjectHealth } from "../lib/project-health";
import type { ProjectProgressSummary } from "../types/models";

const baseProgress: ProjectProgressSummary = {
  totalTasks: 4,
  completedTasks: 2,
  inProgressTasks: 1,
  todoTasks: 1,
  completionPercent: 50,
  overdueTasks: 0,
  dueSoonTasks: 0,
  unassignedTasks: 0,
  timelinePhaseCount: 1,
  completedTimelinePhases: 0,
  currentTimelinePhase: "Build",
  projectWindow: {
    startDate: "2026-05-01",
    endDate: "2026-05-31",
  },
};

type ProgressOverrides = Partial<Omit<ProjectProgressSummary, "projectWindow">> & {
  projectWindow?: Partial<ProjectProgressSummary["projectWindow"]>;
};

function makeProgress(overrides: ProgressOverrides): ProjectProgressSummary {
  return {
    ...baseProgress,
    ...overrides,
    projectWindow: {
      ...baseProgress.projectWindow,
      ...overrides.projectWindow,
    },
  };
}

test("calculateProjectHealth returns healthy when no delivery signals need attention", () => {
  const health = calculateProjectHealth(baseProgress, "2026-05-09");

  assert.equal(health.status, "healthy");
  assert.equal(health.label, "Healthy");
  assert.equal(health.message, "No immediate delivery signals need attention.");
  assert.deepEqual(health.signals, []);
  assert.equal(health.evaluatedAt, "2026-05-09");
});

test("calculateProjectHealth returns watch for one overdue task", () => {
  const progress = makeProgress({ totalTasks: 10, overdueTasks: 1 });
  const health = calculateProjectHealth(progress, "2026-05-09");

  assert.equal(health.status, "watch");
  assert.equal(health.message, "1 tasks are past deadline.");
  assert.equal(health.signals[0]?.id, "overdue_tasks");
  assert.equal(health.signals[0]?.severity, "warning");
});

test("calculateProjectHealth returns at risk when overdue ratio reaches threshold", () => {
  const progress = makeProgress({ totalTasks: 4, overdueTasks: 1 });
  const health = calculateProjectHealth(progress, "2026-05-09");

  assert.equal(health.status, "at_risk");
  assert.equal(health.message, "1 tasks need deadline attention.");
  assert.equal(health.signals[0]?.id, "overdue_tasks");
  assert.equal(health.signals[0]?.severity, "critical");
});

test("calculateProjectHealth returns at risk when project ended with low completion", () => {
  const progress = makeProgress({
    completionPercent: 75,
    projectWindow: {
      endDate: "2026-05-08",
    },
  });
  const health = calculateProjectHealth(progress, "2026-05-09");

  assert.equal(health.status, "at_risk");
  assert.equal(health.message, "Completion is behind the project window.");
  assert.equal(health.signals.some((signal) => signal.id === "project_ended_incomplete"), true);
});

test("calculateProjectHealth returns watch when multiple active tasks are due soon", () => {
  const progress = makeProgress({ dueSoonTasks: 3 });
  const health = calculateProjectHealth(progress, "2026-05-09");

  assert.equal(health.status, "watch");
  assert.equal(health.message, "3 tasks are due soon.");
  assert.equal(health.signals[0]?.id, "due_soon_tasks");
  assert.equal(health.signals[0]?.severity, "warning");
});

test("calculateProjectHealth returns watch when tasks are unassigned", () => {
  const progress = makeProgress({ unassignedTasks: 2 });
  const health = calculateProjectHealth(progress, "2026-05-09");

  assert.equal(health.status, "watch");
  assert.equal(health.message, "2 tasks need an owner.");
  assert.equal(health.signals[0]?.id, "unassigned_tasks");
  assert.equal(health.signals[0]?.severity, "warning");
});

test("calculateProjectHealth handles projects with no tasks", () => {
  const progress = makeProgress({
    totalTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    todoTasks: 0,
    completionPercent: 0,
    overdueTasks: 0,
    dueSoonTasks: 0,
    unassignedTasks: 0,
  });
  const health = calculateProjectHealth(progress, "2026-05-09");

  assert.equal(health.status, "healthy");
  assert.equal(health.label, "Healthy");
  assert.deepEqual(health.signals, []);
});
