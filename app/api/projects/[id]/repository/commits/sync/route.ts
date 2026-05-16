import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { getSafeErrorDetail, getSafeProviderDetail } from "@/lib/api-errors";
import { authOptions } from "@/lib/auth";
import {
  githubCommitToActivityEvent,
  normalizeGithubCommits,
  type GithubCommitResponse,
} from "@/lib/github-commits";
import {
  getGithubLinkByUserId,
  getProjectById,
  getProjectRepositoryByProjectId,
  insertGithubCommitActivityEvents,
  isProjectMember,
  normalizeUserId,
  resolveGithubContributorToMember,
  upsertAppUser,
} from "@/lib/storage";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";
import { isoNow } from "@/lib/utils";
import { syncGithubCommitsQuerySchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUserId = session?.user?.email ? normalizeUserId(session.user.email) : null;

    if (!sessionUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = checkRateLimit(
      getRateLimitKey(request, "github:commits:sync", sessionUserId),
      RATE_LIMITS.githubSync,
    );
    if (rateLimit.limited) {
      return rateLimitResponse(rateLimit);
    }

    await upsertAppUser({
      userId: sessionUserId,
      displayName: session?.user?.name || null,
      imageUrl: session?.user?.image || null,
      timestamp: isoNow(),
    });

    const { id } = await context.params;
    const project = await getProjectById(id);

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const hasAccess = await isProjectMember(id, sessionUserId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const repository = await getProjectRepositoryByProjectId(id);
    if (!repository) {
      return NextResponse.json({ error: "No repository linked." }, { status: 404 });
    }

    const githubLink = await getGithubLinkByUserId(sessionUserId);
    const url = new URL(request.url);
    const parsed = syncGithubCommitsQuerySchema.parse({
      limit: url.searchParams.get("limit") || undefined,
    });

    const apiUrl = `https://api.github.com/repos/${repository.ownerLogin}/${repository.repoName}/commits?per_page=${parsed.limit}&page=1`;
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "pm-agent",
    };

    if (githubLink?.accessToken) {
      headers.Authorization = `Bearer ${githubLink.accessToken}`;
    }

    const response = await fetch(apiUrl, { headers });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return NextResponse.json(
        {
          error: "Failed to fetch commits from Github.",
          detail: getSafeProviderDetail(body, "GitHub commit data is temporarily unavailable."),
        },
        { status: response.status },
      );
    }

    const body = (await response.json().catch(() => [])) as GithubCommitResponse[];
    const syncedAt = isoNow();
    const commits = normalizeGithubCommits(body, {
      ownerLogin: repository.ownerLogin,
      repoName: repository.repoName,
    });
    const events = await Promise.all(commits.map(async (commit) => {
      const actorMember = await resolveGithubContributorToMember(id, {
        githubLogin: commit.authorLogin,
        githubEmail: commit.authorEmail,
        githubName: commit.authorName,
      });

      return githubCommitToActivityEvent({
        projectId: id,
        commit,
        repositoryFullName: repository.fullName,
        syncedAt,
        actorMember: actorMember
          ? {
              id: actorMember.userId,
              name: actorMember.displayName?.trim() || actorMember.userId,
            }
          : null,
      });
    }));
    const result = await insertGithubCommitActivityEvents(events);

    return NextResponse.json({
      fetchedCount: commits.length,
      syncedCount: result.inserted.length,
      skippedCount: result.skippedCount,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed.", issues: error.issues.map((issue) => issue.message) },
        { status: 422 },
      );
    }

    return NextResponse.json(
      { error: "Failed to sync Github commits.", detail: getSafeErrorDetail(error) },
      { status: 500 },
    );
  }
}
