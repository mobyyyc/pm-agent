import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { getSafeErrorDetail, getSafeProviderDetail } from "@/lib/api-errors";
import { authOptions } from "@/lib/auth";
import { normalizeGithubCommits, type GithubCommitResponse } from "@/lib/github-commits";
import {
  getGithubLinkByUserId,
  getProjectById,
  getProjectRepositoryByProjectId,
  isProjectMember,
  normalizeUserId,
} from "@/lib/storage";
import { isoNow } from "@/lib/utils";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getAuthorizedProject(projectId: string, sessionUserId: string | null) {
  if (!sessionUserId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const project = await getProjectById(projectId);
  if (!project) return { error: NextResponse.json({ error: "Project not found." }, { status: 404 }) };

  const hasAccess = await isProjectMember(projectId, sessionUserId);
  if (!hasAccess) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };

  const canManage = normalizeUserId(project.userId) === sessionUserId;
  return { project, canManage };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUserId = session?.user?.email ? normalizeUserId(session.user.email) : null;

    const { id } = await context.params;
    const accessResult = await getAuthorizedProject(id, sessionUserId);
    if ("error" in accessResult) return accessResult.error;

    const repository = await getProjectRepositoryByProjectId(id);
    if (!repository) return NextResponse.json({ commits: [], message: "No repository linked." });

    const url = new URL(_request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
    const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get("per_page") || "20")));

    const githubLink = sessionUserId ? await getGithubLinkByUserId(sessionUserId) : null;

    const owner = repository.ownerLogin;
    const repo = repository.repoName;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${perPage}&page=${page}`;

    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "pm-agent",
    };

    if (githubLink?.accessToken) {
      headers.Authorization = `Bearer ${githubLink.accessToken}`;
    }

    const res = await fetch(apiUrl, { headers });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return NextResponse.json(
        { error: "Failed to fetch commits from Github.", detail: getSafeProviderDetail(body, "GitHub commit data is temporarily unavailable.") },
        { status: res.status },
      );
    }

    const commitsBody = (await res.json().catch(() => [])) as GithubCommitResponse[];

    const commits = normalizeGithubCommits(commitsBody, {
      ownerLogin: owner,
      repoName: repo,
    });

    return NextResponse.json({ commits, fetchedAt: isoNow() });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch commits.", detail: getSafeErrorDetail(error) }, { status: 500 });
  }
}
