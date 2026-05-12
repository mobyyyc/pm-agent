import assert from "node:assert/strict";
import test from "node:test";

import {
  getGithubCommitActivityEventId,
  githubCommitToActivityEvent,
  normalizeGithubCommit,
} from "../lib/github-commits";
import { syncGithubCommitsQuerySchema } from "../lib/validators";

const repository = {
  ownerLogin: "versor",
  repoName: "pm-agent",
  fullName: "versor/pm-agent",
};

test("normalizeGithubCommit maps GitHub payload into the shared commit shape", () => {
  const commit = normalizeGithubCommit(
    {
      sha: "abc123",
      html_url: "https://github.com/versor/pm-agent/commit/abc123",
      author: {
        login: "octocat",
      },
      commit: {
        message: "Ship report history\n\nAdds saved artifacts.",
        author: {
          name: "Mona Lisa",
          date: "2026-05-12T14:00:00.000Z",
        },
        verification: {
          verified: true,
        },
      },
    },
    repository,
  );

  assert.equal(commit?.sha, "abc123");
  assert.equal(commit?.message, "Ship report history\n\nAdds saved artifacts.");
  assert.equal(commit?.authorName, "Mona Lisa");
  assert.equal(commit?.authorLogin, "octocat");
  assert.equal(commit?.date, "2026-05-12T14:00:00.000Z");
  assert.equal(commit?.verified, true);
});

test("githubCommitToActivityEvent creates deterministic activity for a commit", () => {
  const commit = normalizeGithubCommit(
    {
      sha: "abc123",
      commit: {
        message: "Sync commits\n\nPersist engineering movement.",
        author: {
          name: "Mona Lisa",
          date: "2026-05-12T14:00:00.000Z",
        },
      },
    },
    repository,
  );

  assert.ok(commit);

  const activity = githubCommitToActivityEvent({
    projectId: "project_1",
    commit,
    repositoryFullName: repository.fullName,
    syncedAt: "2026-05-12T15:00:00.000Z",
  });

  assert.equal(activity.id, "github_commit_project_1_abc123");
  assert.equal(activity.source, "github");
  assert.equal(activity.eventType, "github.commit.synced");
  assert.equal(activity.entityType, "github_commit");
  assert.equal(activity.entityId, "abc123");
  assert.equal(activity.summary, "Commit: Sync commits");
  assert.equal(activity.createdAt, "2026-05-12T14:00:00.000Z");
  assert.equal(activity.metadata.repositoryFullName, "versor/pm-agent");
});

test("github commit activity ids support dedupe by project and sha", () => {
  const first = getGithubCommitActivityEventId("project_1", "abc123");
  const duplicate = getGithubCommitActivityEventId("project_1", "abc123");
  const otherProject = getGithubCommitActivityEventId("project_2", "abc123");

  assert.equal(first, duplicate);
  assert.notEqual(first, otherProject);
});

test("syncGithubCommitsQuerySchema validates default and max limit", () => {
  assert.equal(syncGithubCommitsQuerySchema.parse({}).limit, 20);
  assert.equal(syncGithubCommitsQuerySchema.parse({ limit: "100" }).limit, 100);
  assert.throws(
    () => syncGithubCommitsQuerySchema.parse({ limit: "101" }),
    /Number must be less than or equal to 100/,
  );
});
