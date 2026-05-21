import assert from "node:assert/strict";
import test from "node:test";

import { calculateProjectTeamActivityInsight } from "../lib/project-team-activity-insight";
import type { ProjectActivityEvent } from "../types/models";

const now = "2026-05-21T12:00:00.000Z";

function makeEvent(overrides: Partial<ProjectActivityEvent>): ProjectActivityEvent {
  return {
    id: overrides.id || "activity_1",
    projectId: overrides.projectId || "project_1",
    actorUserId: overrides.actorUserId ?? null,
    source: overrides.source || "user",
    eventType: overrides.eventType || "task.updated",
    entityType: overrides.entityType || "task",
    entityId: overrides.entityId ?? "task_1",
    summary: overrides.summary || "Task updated",
    metadata: overrides.metadata || {},
    createdAt: overrides.createdAt || now,
  };
}

test("calculateProjectTeamActivityInsight handles no activity", () => {
  const insight = calculateProjectTeamActivityInsight([], now);

  assert.deepEqual(insight, {
    lastActivityAt: null,
    activityCountLast7Days: 0,
    commitCountLast7Days: 0,
    attributedActivityCountLast7Days: 0,
    topContributorName: null,
    topContributorActivityCount: 0,
  });
});

test("calculateProjectTeamActivityInsight returns the latest activity time", () => {
  const insight = calculateProjectTeamActivityInsight(
    [
      makeEvent({ id: "old", createdAt: "2026-05-18T10:00:00.000Z" }),
      makeEvent({ id: "new", createdAt: "2026-05-20T09:30:00.000Z" }),
      makeEvent({ id: "middle", createdAt: "2026-05-19T12:00:00.000Z" }),
    ],
    now,
  );

  assert.equal(insight.lastActivityAt, "2026-05-20T09:30:00.000Z");
});

test("calculateProjectTeamActivityInsight counts commits in the last 7 days", () => {
  const insight = calculateProjectTeamActivityInsight(
    [
      makeEvent({ id: "commit_1", entityType: "github_commit", createdAt: "2026-05-21T10:00:00.000Z" }),
      makeEvent({ id: "task_1", entityType: "task", createdAt: "2026-05-20T10:00:00.000Z" }),
      makeEvent({ id: "commit_2", entityType: "github_commit", createdAt: "2026-05-15T10:00:00.000Z" }),
    ],
    now,
  );

  assert.equal(insight.activityCountLast7Days, 3);
  assert.equal(insight.commitCountLast7Days, 2);
});

test("calculateProjectTeamActivityInsight counts member-attributed activity in the last 7 days", () => {
  const insight = calculateProjectTeamActivityInsight(
    [
      makeEvent({
        id: "with_id",
        createdAt: "2026-05-21T10:00:00.000Z",
        metadata: { actorMemberId: "owner@example.com" },
      }),
      makeEvent({
        id: "with_name",
        createdAt: "2026-05-20T10:00:00.000Z",
        metadata: { actorMemberName: "Project Owner" },
      }),
      makeEvent({ id: "unattributed", createdAt: "2026-05-19T10:00:00.000Z" }),
    ],
    now,
  );

  assert.equal(insight.attributedActivityCountLast7Days, 2);
});

test("calculateProjectTeamActivityInsight picks the top contributor and prefers member names", () => {
  const insight = calculateProjectTeamActivityInsight(
    [
      makeEvent({
        id: "owner_1",
        createdAt: "2026-05-21T10:00:00.000Z",
        metadata: { actorMemberId: "owner@example.com", actorMemberName: "Project Owner" },
      }),
      makeEvent({
        id: "owner_2",
        createdAt: "2026-05-20T10:00:00.000Z",
        metadata: { actorMemberId: "owner@example.com", actorMemberName: "Project Owner" },
      }),
      makeEvent({
        id: "designer_1",
        createdAt: "2026-05-19T10:00:00.000Z",
        metadata: { actorMemberId: "designer@example.com", actorMemberName: "Designer" },
      }),
    ],
    now,
  );

  assert.equal(insight.topContributorName, "Project Owner");
  assert.equal(insight.topContributorActivityCount, 2);
});

test("calculateProjectTeamActivityInsight ignores activity older than 7 days for weekly stats", () => {
  const insight = calculateProjectTeamActivityInsight(
    [
      makeEvent({
        id: "recent",
        entityType: "github_commit",
        createdAt: "2026-05-21T10:00:00.000Z",
        metadata: { actorMemberId: "owner@example.com", actorMemberName: "Project Owner" },
      }),
      makeEvent({
        id: "old",
        entityType: "github_commit",
        createdAt: "2026-05-14T11:59:59.000Z",
        metadata: { actorMemberId: "owner@example.com", actorMemberName: "Project Owner" },
      }),
    ],
    now,
  );

  assert.equal(insight.lastActivityAt, "2026-05-21T10:00:00.000Z");
  assert.equal(insight.activityCountLast7Days, 1);
  assert.equal(insight.commitCountLast7Days, 1);
  assert.equal(insight.attributedActivityCountLast7Days, 1);
  assert.equal(insight.topContributorActivityCount, 1);
});
