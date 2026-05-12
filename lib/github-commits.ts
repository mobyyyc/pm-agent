import type { ProjectActivityEvent } from "@/types/models";

export type GithubCommitResponse = {
  sha?: string;
  html_url?: string;
  author?: {
    login?: string | null;
  } | null;
  commit?: {
    message?: string;
    author?: {
      name?: string | null;
      date?: string | null;
    } | null;
    verification?: {
      verified?: boolean;
    } | null;
  } | null;
};

export type NormalizedGithubCommit = {
  sha: string;
  message: string;
  authorName: string | null;
  authorLogin: string | null;
  date: string | null;
  htmlUrl: string;
  verified: boolean;
};

export type GithubCommitActivityInput = Omit<ProjectActivityEvent, "metadata"> & {
  metadata: {
    sha: string;
    message: string;
    authorName: string | null;
    authorLogin: string | null;
    htmlUrl: string;
    repositoryFullName: string;
    syncedAt: string;
  };
};

function getFirstLine(value: string): string {
  return value.split("\n")[0]?.trim() || "(no message)";
}

export function normalizeGithubCommit(
  commit: GithubCommitResponse,
  repository: { ownerLogin: string; repoName: string },
): NormalizedGithubCommit | null {
  if (!commit.sha) return null;

  return {
    sha: commit.sha,
    message: commit.commit?.message || "",
    authorName: commit.commit?.author?.name || commit.author?.login || null,
    authorLogin: commit.author?.login || null,
    date: commit.commit?.author?.date || null,
    htmlUrl: commit.html_url || `https://github.com/${repository.ownerLogin}/${repository.repoName}/commit/${commit.sha}`,
    verified: Boolean(commit.commit?.verification?.verified),
  };
}

export function normalizeGithubCommits(
  commits: GithubCommitResponse[],
  repository: { ownerLogin: string; repoName: string },
): NormalizedGithubCommit[] {
  return commits
    .map((commit) => normalizeGithubCommit(commit, repository))
    .filter((commit): commit is NormalizedGithubCommit => commit !== null);
}

export function getGithubCommitActivityEventId(projectId: string, sha: string): string {
  return `github_commit_${projectId}_${sha}`;
}

export function githubCommitToActivityEvent(input: {
  projectId: string;
  commit: NormalizedGithubCommit;
  repositoryFullName: string;
  syncedAt: string;
}): GithubCommitActivityInput {
  const summary = `Commit: ${getFirstLine(input.commit.message)}`;

  return {
    id: getGithubCommitActivityEventId(input.projectId, input.commit.sha),
    projectId: input.projectId,
    actorUserId: null,
    source: "github",
    eventType: "github.commit.synced",
    entityType: "github_commit",
    entityId: input.commit.sha,
    summary,
    metadata: {
      sha: input.commit.sha,
      message: input.commit.message,
      authorName: input.commit.authorName,
      authorLogin: input.commit.authorLogin,
      htmlUrl: input.commit.htmlUrl,
      repositoryFullName: input.repositoryFullName,
      syncedAt: input.syncedAt,
    },
    createdAt: input.commit.date || input.syncedAt,
  };
}
