import assert from "node:assert/strict";
import test from "node:test";

import { buildProjectReportInput } from "../lib/project-report-input";
import { listProjectReportsQuerySchema } from "../lib/validators";
import { projectProgressReportSchema, projectReportArtifactSchema, projectReportPeriodSchema } from "../types/models";
import type {
  Project,
  ProjectActivityEvent,
  ProjectHealthSummary,
  ProjectProgressSummary,
  ProjectProgressReport,
  Task,
} from "../types/models";

const project: Project = {
  id: "project_1",
  userId: "owner@example.com",
  name: "Launch",
  idea: "Launch a product",
  guideline: "Keep the team focused.",
  timeline: [],
  taskIds: ["task_done", "task_active", "task_overdue", "task_unassigned"],
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z",
};

const progress: ProjectProgressSummary = {
  totalTasks: 4,
  completedTasks: 1,
  inProgressTasks: 1,
  todoTasks: 2,
  completionPercent: 25,
  overdueTasks: 1,
  dueSoonTasks: 1,
  unassignedTasks: 1,
  timelinePhaseCount: 0,
  completedTimelinePhases: 0,
  currentTimelinePhase: null,
  projectWindow: {
    startDate: null,
    endDate: null,
  },
};

const health: ProjectHealthSummary = {
  status: "watch",
  label: "Watch",
  message: "1 tasks are past deadline.",
  signals: [
    {
      id: "overdue_tasks",
      severity: "warning",
      message: "1 active tasks are past deadline.",
      value: 1,
      threshold: 3,
    },
  ],
  evaluatedAt: "2026-05-09",
};

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: overrides.id || "task_1",
    projectId: project.id,
    title: overrides.title || "Task",
    description: overrides.description || "Do work",
    deadline: overrides.deadline || "2026-05-20",
    suggestedAssignee: overrides.suggestedAssignee ?? "owner@example.com",
    status: overrides.status || "todo",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
  };
}

function makeEvent(overrides: Partial<ProjectActivityEvent>): ProjectActivityEvent {
  return {
    id: overrides.id || "activity_1",
    projectId: project.id,
    actorUserId: "owner@example.com",
    source: overrides.source || "user",
    eventType: overrides.eventType || "task.updated",
    entityType: overrides.entityType || "task",
    entityId: overrides.entityId || "task_1",
    summary: overrides.summary || "Task updated",
    metadata: {},
    createdAt: overrides.createdAt || "2026-05-09T12:00:00.000Z",
  };
}

test("buildProjectReportInput groups deterministic task and activity signals", () => {
  const reportInput = buildProjectReportInput({
    project,
    tasks: [
      makeTask({ id: "task_done", title: "Ship beta", status: "done" }),
      makeTask({ id: "task_active", title: "Build onboarding", status: "in_progress", deadline: "2026-05-10" }),
      makeTask({ id: "task_overdue", title: "Fix billing", status: "todo", deadline: "2026-05-08" }),
      makeTask({ id: "task_unassigned", title: "Write docs", status: "todo", deadline: "2026-05-11", suggestedAssignee: "Unassigned" }),
    ],
    progress,
    health,
    activityEvents: [
      makeEvent({ id: "activity_recent", summary: "Task status changed", createdAt: "2026-05-09T12:00:00.000Z" }),
      makeEvent({ id: "activity_old", summary: "Old task changed", createdAt: "2026-04-01T12:00:00.000Z" }),
    ],
    period: "weekly",
    today: "2026-05-09",
    generatedAt: "2026-05-09T12:00:00.000Z",
  });

  assert.equal(reportInput.periodStart, "2026-05-03");
  assert.equal(reportInput.periodEnd, "2026-05-09");
  assert.deepEqual(reportInput.tasks.completed.map((task) => task.title), ["Ship beta"]);
  assert.deepEqual(reportInput.tasks.inProgress.map((task) => task.title), ["Build onboarding"]);
  assert.deepEqual(reportInput.tasks.overdue.map((task) => task.title), ["Fix billing"]);
  assert.deepEqual(reportInput.tasks.dueSoon.map((task) => task.title), ["Build onboarding", "Write docs"]);
  assert.deepEqual(reportInput.tasks.unassigned.map((task) => task.title), ["Write docs"]);
  assert.deepEqual(reportInput.recentActivity.map((event) => event.summary), ["Task status changed"]);
});

test("projectProgressReportSchema validates concise report output", () => {
  const parsed = projectProgressReportSchema.parse({
    projectId: project.id,
    projectName: project.name,
    period: "weekly",
    generatedAt: "2026-05-09T12:00:00.000Z",
    executiveSummary: "The project is moving, with one overdue task needing attention.",
    progressOverview: "1 of 4 tasks are complete.",
    completedWork: ["Ship beta"],
    inProgressWork: ["Build onboarding"],
    riskyWork: ["Fix billing is overdue."],
    activityHighlights: ["Task status changed."],
    healthExplanation: "The project is on watch because one task is overdue.",
    suggestedNextActions: [
      {
        title: "Resolve the overdue billing task",
        rationale: "It is the clearest delivery risk.",
        priority: "warning",
      },
    ],
  });

  assert.equal(parsed.period, "weekly");
  assert.equal(parsed.suggestedNextActions[0].priority, "warning");
});

test("projectReportArtifactSchema validates saved report artifact with deterministic snapshot", () => {
  const generatedAt = "2026-05-09T12:00:00.000Z";
  const reportInput = buildProjectReportInput({
    project,
    tasks: [
      makeTask({ id: "task_done", title: "Ship beta", status: "done" }),
      makeTask({ id: "task_active", title: "Build onboarding", status: "in_progress", deadline: "2026-05-10" }),
    ],
    progress,
    health,
    activityEvents: [
      makeEvent({ id: "activity_recent", summary: "Task status changed", createdAt: generatedAt }),
    ],
    period: "weekly",
    today: "2026-05-09",
    generatedAt,
  });
  const report: ProjectProgressReport = {
    projectId: project.id,
    projectName: project.name,
    period: "weekly",
    generatedAt,
    executiveSummary: "The project is moving, with one overdue task needing attention.",
    progressOverview: "1 of 4 tasks are complete.",
    completedWork: ["Ship beta"],
    inProgressWork: ["Build onboarding"],
    riskyWork: ["Fix billing is overdue."],
    activityHighlights: ["Task status changed."],
    healthExplanation: "The project is on watch because one task is overdue.",
    suggestedNextActions: [
      {
        title: "Resolve the overdue billing task",
        rationale: "It is the clearest delivery risk.",
        priority: "warning",
      },
    ],
  };

  const parsed = projectReportArtifactSchema.parse({
    id: "report_1",
    projectId: project.id,
    createdByUserId: "owner@example.com",
    period: "weekly",
    periodStart: reportInput.periodStart,
    periodEnd: reportInput.periodEnd,
    generatedAt,
    report,
    inputSnapshot: reportInput,
    source: "manual",
    createdAt: generatedAt,
  });

  assert.equal(parsed.inputSnapshot.health.label, "Watch");
  assert.equal(parsed.inputSnapshot.periodStart, "2026-05-03");
  assert.equal(parsed.report.executiveSummary, report.executiveSummary);
});

test("projectReportPeriodSchema validates supported report history periods", () => {
  const parsed = projectReportPeriodSchema.parse("monthly");

  assert.equal(parsed, "monthly");
  assert.throws(
    () => projectReportPeriodSchema.parse("yearly"),
    /Invalid enum value/,
  );
});

test("listProjectReportsQuerySchema validates period and limit for report history", () => {
  const parsed = listProjectReportsQuerySchema.parse({ period: "monthly", limit: "10" });

  assert.equal(parsed.period, "monthly");
  assert.equal(parsed.limit, 10);
  assert.equal(listProjectReportsQuerySchema.parse({}).limit, 10);
  assert.throws(
    () => listProjectReportsQuerySchema.parse({ period: "yearly", limit: "10" }),
    /Invalid enum value/,
  );
  assert.throws(
    () => listProjectReportsQuerySchema.parse({ period: "weekly", limit: "100" }),
    /Number must be less than or equal to 50/,
  );
});
