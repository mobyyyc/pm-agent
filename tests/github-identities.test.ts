import assert from "node:assert/strict";
import test from "node:test";

import { resolveGithubContributorFromMappings } from "../lib/github-identities";
import type { ProjectMember, ProjectMemberGithubIdentity } from "../types/models";

const members: ProjectMember[] = [
  {
    projectId: "project_1",
    userId: "ada@example.com",
    role: "member",
    joinedAt: "2026-05-01T00:00:00.000Z",
    displayName: "Ada Lovelace",
    imageUrl: null,
  },
  {
    projectId: "project_1",
    userId: "grace@example.com",
    role: "member",
    joinedAt: "2026-05-01T00:00:00.000Z",
    displayName: "Grace Hopper",
    imageUrl: null,
  },
  {
    projectId: "project_1",
    userId: "katherine@example.com",
    role: "member",
    joinedAt: "2026-05-01T00:00:00.000Z",
    displayName: "Katherine Johnson",
    imageUrl: null,
  },
];

function mapping(overrides: Partial<ProjectMemberGithubIdentity>): ProjectMemberGithubIdentity {
  return {
    id: overrides.id || "mapping_1",
    projectId: "project_1",
    memberId: overrides.memberId || "ada@example.com",
    githubLogin: overrides.githubLogin ?? null,
    githubName: overrides.githubName ?? null,
    githubEmail: overrides.githubEmail ?? null,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
  };
}

test("resolves GitHub contributor by login", () => {
  const resolved = resolveGithubContributorFromMappings(
    [mapping({ githubLogin: "ada-dev" })],
    members,
    { githubLogin: "Ada-Dev", githubEmail: null, githubName: null },
  );

  assert.equal(resolved?.userId, "ada@example.com");
});

test("resolves GitHub contributor by email", () => {
  const resolved = resolveGithubContributorFromMappings(
    [mapping({ memberId: "grace@example.com", githubEmail: "grace@navy.mil" })],
    members,
    { githubLogin: null, githubEmail: "GRACE@NAVY.MIL", githubName: null },
  );

  assert.equal(resolved?.userId, "grace@example.com");
});

test("resolves GitHub contributor by name", () => {
  const resolved = resolveGithubContributorFromMappings(
    [mapping({ memberId: "katherine@example.com", githubName: "Katherine Johnson" })],
    members,
    { githubLogin: null, githubEmail: null, githubName: "katherine johnson" },
  );

  assert.equal(resolved?.userId, "katherine@example.com");
});

test("returns null when no GitHub identity mapping matches", () => {
  const resolved = resolveGithubContributorFromMappings(
    [mapping({ githubLogin: "ada-dev" })],
    members,
    { githubLogin: "unknown", githubEmail: null, githubName: null },
  );

  assert.equal(resolved, null);
});

test("uses login before email and name when multiple mappings could match", () => {
  const resolved = resolveGithubContributorFromMappings(
    [
      mapping({ id: "login_mapping", memberId: "ada@example.com", githubLogin: "octo" }),
      mapping({ id: "email_mapping", memberId: "grace@example.com", githubEmail: "octo@example.com" }),
      mapping({ id: "name_mapping", memberId: "katherine@example.com", githubName: "Octo Cat" }),
    ],
    members,
    { githubLogin: "octo", githubEmail: "octo@example.com", githubName: "Octo Cat" },
  );

  assert.equal(resolved?.userId, "ada@example.com");
});
