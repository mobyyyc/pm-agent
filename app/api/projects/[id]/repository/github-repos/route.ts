import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { getSafeErrorDetail, getSafeProviderDetail } from "@/lib/api-errors";
import { authOptions } from "@/lib/auth";
import {
  getGithubLinkByUserId,
  getProjectById,
  isProjectMember,
  normalizeUserId,
} from "@/lib/storage";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type GithubRepoResponse = {
  id?: number;
  name?: string;
  full_name?: string;
  html_url?: string;
  private?: boolean;
  default_branch?: string;
  description?: string | null;
  owner?: {
    login?: string;
  } | null;
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

    if (!sessionUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const githubLink = await getGithubLinkByUserId(sessionUserId);
    if (!githubLink?.accessToken) {
      return NextResponse.json({ error: "Github account not linked." }, { status: 400 });
    }

    const url = new URL(_request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
    const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get("per_page") || "50")));

    const apiUrl = `https://api.github.com/user/repos?per_page=${perPage}&page=${page}&sort=updated`;

    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "pm-agent",
      Authorization: `Bearer ${githubLink.accessToken}`,
    };

    const res = await fetch(apiUrl, { headers });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return NextResponse.json(
        { error: "Failed to fetch Github repos.", detail: getSafeProviderDetail(body, "GitHub repositories are temporarily unavailable.") },
        { status: res.status },
      );
    }

    const repos = (await res.json().catch(() => [])) as GithubRepoResponse[];

    // Filter to repositories owned by the linked login to simplify UX
    const filtered = repos.filter((r) => r && r.owner && typeof r.owner.login === "string" && r.owner.login === githubLink.githubLogin);

    const mapped = filtered.map((r) => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      htmlUrl: r.html_url,
      private: Boolean(r.private),
      defaultBranch: r.default_branch || "main",
      description: r.description || null,
    }));

    return NextResponse.json({ repos: mapped });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch Github repos.", detail: getSafeErrorDetail(error) }, { status: 500 });
  }
}
