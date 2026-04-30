import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import {
  getGithubLinkByUserId,
  getProjectById,
  getProjectRepositoryByProjectId,
  deleteProjectRepositoryByProjectId,
  isProjectMember,
  normalizeUserId,
  upsertAppUser,
  upsertProjectRepository,
} from "@/lib/storage";
import { isoNow } from "@/lib/utils";
import {
  createGithubRepositoryRequestSchema,
  upsertProjectRepositoryRequestSchema,
} from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type GithubCreateRepositoryResponse = {
  id?: number;
  name?: string;
  full_name?: string;
  html_url?: string;
  default_branch?: string;
  private?: boolean;
  visibility?: "public" | "private";
  message?: string;
};

type GithubDeleteRepositoryResponse = {
  message?: string;
};

function buildRepositoryPayload(input: {
  projectId: string;
  ownerLogin: string;
  repoName: string;
  htmlUrl: string;
  defaultBranch: string;
  visibility: "public" | "private";
  externalId: string;
  createdByUserId: string;
  timestamp: string;
}) {
  return {
    projectId: input.projectId,
    provider: "github" as const,
    ownerLogin: input.ownerLogin,
    repoName: input.repoName,
    fullName: `${input.ownerLogin}/${input.repoName}`,
    htmlUrl: input.htmlUrl,
    defaultBranch: input.defaultBranch,
    visibility: input.visibility,
    externalId: input.externalId,
    createdByUserId: input.createdByUserId,
    timestamp: input.timestamp,
  };
}

async function getAuthorizedProject(projectId: string, sessionUserId: string) {
  const project = await getProjectById(projectId);
  if (!project) {
    return { error: NextResponse.json({ error: "Project not found." }, { status: 404 }) };
  }

  const hasAccess = await isProjectMember(projectId, sessionUserId);
  if (!hasAccess) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const canManage = normalizeUserId(project.userId) === sessionUserId;
  return { project, canManage };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUserId = session?.user?.email ? normalizeUserId(session.user.email) : null;

    if (!sessionUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await upsertAppUser({
      userId: sessionUserId,
      displayName: session?.user?.name || null,
      imageUrl: session?.user?.image || null,
      timestamp: isoNow(),
    });

    const { id } = await context.params;
    const accessResult = await getAuthorizedProject(id, sessionUserId);
    if ("error" in accessResult) {
      return accessResult.error;
    }

    const [repository, githubLink] = await Promise.all([
      getProjectRepositoryByProjectId(id),
      getGithubLinkByUserId(sessionUserId),
    ]);

    return NextResponse.json({
      repository,
      canManage: accessResult.canManage,
      github: {
        linked: !!githubLink,
        login: githubLink?.githubLogin || null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch repository details.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUserId = session?.user?.email ? normalizeUserId(session.user.email) : null;

    if (!sessionUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await upsertAppUser({
      userId: sessionUserId,
      displayName: session?.user?.name || null,
      imageUrl: session?.user?.image || null,
      timestamp: isoNow(),
    });

    const { id } = await context.params;
    const accessResult = await getAuthorizedProject(id, sessionUserId);
    if ("error" in accessResult) {
      return accessResult.error;
    }

    if (!accessResult.canManage) {
      return NextResponse.json({ error: "Only the project owner can update repository settings." }, { status: 403 });
    }

    const body = await request.json();
    const parsed = upsertProjectRepositoryRequestSchema.parse(body);

    const repository = await upsertProjectRepository(
      buildRepositoryPayload({
        projectId: id,
        ownerLogin: parsed.ownerLogin,
        repoName: parsed.repoName,
        htmlUrl: parsed.htmlUrl,
        defaultBranch: parsed.defaultBranch,
        visibility: parsed.visibility,
        externalId: parsed.externalId || `manual:${parsed.ownerLogin}/${parsed.repoName}`,
        createdByUserId: sessionUserId,
        timestamp: isoNow(),
      }),
    );

    return NextResponse.json({ repository });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed.", issues: error.issues.map((issue) => issue.message) },
        { status: 422 },
      );
    }

    return NextResponse.json(
      { error: "Failed to update repository settings.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUserId = session?.user?.email ? normalizeUserId(session.user.email) : null;

    if (!sessionUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await upsertAppUser({
      userId: sessionUserId,
      displayName: session?.user?.name || null,
      imageUrl: session?.user?.image || null,
      timestamp: isoNow(),
    });

    const { id } = await context.params;
    const accessResult = await getAuthorizedProject(id, sessionUserId);
    if ("error" in accessResult) {
      return accessResult.error;
    }

    if (!accessResult.canManage) {
      return NextResponse.json({ error: "Only the project owner can create a repository." }, { status: 403 });
    }

    const githubLink = await getGithubLinkByUserId(sessionUserId);
    if (!githubLink) {
      return NextResponse.json({ error: "Link your Github account before creating repositories." }, { status: 400 });
    }

    const body = await request.json();
    const parsed = createGithubRepositoryRequestSchema.parse(body);

    if (normalizeUserId(parsed.ownerLogin) !== normalizeUserId(githubLink.githubLogin)) {
      return NextResponse.json({ error: "User-owned repositories must use your linked Github account." }, { status: 400 });
    }

    const githubResponse = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubLink.accessToken}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "versor-ai",
      },
      body: JSON.stringify({
        name: parsed.repoName,
        description: parsed.description || "",
        private: parsed.visibility === "private",
        auto_init: parsed.autoInit,
      }),
    });

    const githubBody = (await githubResponse.json().catch(() => ({}))) as GithubCreateRepositoryResponse;

    if (!githubResponse.ok) {
      return NextResponse.json(
        {
          error: githubBody.message || "Failed to create Github repository.",
          detail:
            githubResponse.status === 401 || githubResponse.status === 403
              ? "Check Github token scopes and account permissions."
              : null,
        },
        { status: githubResponse.status || 500 },
      );
    }

    if (
      typeof githubBody.id !== "number" ||
      typeof githubBody.name !== "string" ||
      typeof githubBody.full_name !== "string" ||
      typeof githubBody.html_url !== "string"
    ) {
      return NextResponse.json({ error: "Github repository response was incomplete." }, { status: 502 });
    }

    const repository = await upsertProjectRepository({
      projectId: id,
      provider: "github",
      ownerLogin: parsed.ownerLogin,
      repoName: githubBody.name,
      fullName: githubBody.full_name,
      htmlUrl: githubBody.html_url,
      defaultBranch: githubBody.default_branch || "main",
      visibility:
        githubBody.visibility || (githubBody.private ? "private" : "public") || parsed.visibility,
      externalId: String(githubBody.id),
      createdByUserId: sessionUserId,
      timestamp: isoNow(),
    });

    return NextResponse.json({ repository }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed.", issues: error.issues.map((issue) => issue.message) },
        { status: 422 },
      );
    }

    return NextResponse.json(
      { error: "Failed to create Github repository.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUserId = session?.user?.email ? normalizeUserId(session.user.email) : null;

    if (!sessionUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await upsertAppUser({
      userId: sessionUserId,
      displayName: session?.user?.name || null,
      imageUrl: session?.user?.image || null,
      timestamp: isoNow(),
    });

    const { id } = await context.params;
    const accessResult = await getAuthorizedProject(id, sessionUserId);
    if ("error" in accessResult) {
      return accessResult.error;
    }

    if (!accessResult.canManage) {
      return NextResponse.json({ error: "Only the project owner can unlink a repository." }, { status: 403 });
    }

    const repository = await getProjectRepositoryByProjectId(id);
    if (!repository) {
      return NextResponse.json({ error: "No repository linked to this project." }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as { action?: string };
    const action = body.action === "unlink_and_delete" ? "unlink_and_delete" : "unlink_only";

    if (action === "unlink_and_delete") {
      const githubLink = await getGithubLinkByUserId(sessionUserId);
      if (!githubLink) {
        return NextResponse.json({ error: "Link your Github account before deleting the repository." }, { status: 400 });
      }

      const deleteResponse = await fetch(`https://api.github.com/repos/${repository.fullName}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${githubLink.accessToken}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "versor-ai",
        },
      });

      if (!deleteResponse.ok && deleteResponse.status !== 404) {
        const deleteBody = (await deleteResponse.json().catch(() => ({}))) as GithubDeleteRepositoryResponse;
        return NextResponse.json(
          {
            error: deleteBody.message || "Failed to delete Github repository.",
            detail:
              deleteResponse.status === 403
                ? "Must have admin rights to Repository."
                : deleteResponse.status === 401
                  ? "Check Github permissions."
                  : null,
          },
          { status: deleteResponse.status || 500 },
        );
      }
    }

    await deleteProjectRepositoryByProjectId(id);

    return NextResponse.json({
      success: true,
      deletedGithubRepository: action === "unlink_and_delete",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to unlink repository.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
