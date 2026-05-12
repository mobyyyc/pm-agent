import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { getSafeErrorDetail } from "@/lib/api-errors";
import { authOptions } from "@/lib/auth";
import { calculateProjectHealth } from "@/lib/project-health";
import { calculateProjectProgress } from "@/lib/project-progress";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";
import {
  deleteProject,
  getProjectById,
  getProjectMembers,
  getTasksByProjectId,
  isProjectMember,
  logProjectActivityEvent,
  normalizeUserId,
  updateProject,
  upsertAppUser,
} from "@/lib/storage";
import { isoNow } from "@/lib/utils";
import { updateProjectRequestSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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
    const project = await getProjectById(id);

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const hasAccess = await isProjectMember(id, sessionUserId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const members = await getProjectMembers(id);
    const projectTasks = await getTasksByProjectId(id);
    const today = isoNow().slice(0, 10);
    const progress = calculateProjectProgress(project, projectTasks, today);
    const health = calculateProjectHealth(progress, today);

    return NextResponse.json({ project, tasks: projectTasks, members, progress, health });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch project.", detail: getSafeErrorDetail(error) },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUserId = session?.user?.email ? normalizeUserId(session.user.email) : null;

    if (!sessionUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = checkRateLimit(
      getRateLimitKey(_request, "projects:mutation", sessionUserId),
      RATE_LIMITS.projectMutation,
    );
    if (rateLimit.limited) {
      return rateLimitResponse(rateLimit);
    }

    const { id } = await context.params;
    const project = await getProjectById(id);

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    if (normalizeUserId(project.userId) !== sessionUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await deleteProject(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete project.", detail: getSafeErrorDetail(error) },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUserId = session?.user?.email ? normalizeUserId(session.user.email) : null;

    if (!sessionUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = checkRateLimit(
      getRateLimitKey(request, "projects:mutation", sessionUserId),
      RATE_LIMITS.projectMutation,
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

    const body = await request.json();
    const parsed = updateProjectRequestSchema.parse(body);
    const updatedAt = isoNow();
    const updatedProject = await updateProject(
      id,
      {
        name: parsed.name,
        timeline: parsed.timeline,
      },
      updatedAt,
    );

    if (!updatedProject) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    if (parsed.name !== undefined && parsed.name !== project.name) {
      await logProjectActivityEvent({
        projectId: id,
        actorUserId: sessionUserId,
        source: "user",
        eventType: "project.renamed",
        entityType: "project",
        entityId: id,
        summary: `Project renamed from "${project.name}" to "${updatedProject.name}"`,
        metadata: {
          previousName: project.name,
          nextName: updatedProject.name,
        },
        createdAt: updatedAt,
      });
    }

    if (parsed.timeline !== undefined && JSON.stringify(parsed.timeline) !== JSON.stringify(project.timeline)) {
      await logProjectActivityEvent({
        projectId: id,
        actorUserId: sessionUserId,
        source: "user",
        eventType: "timeline.updated",
        entityType: "timeline",
        entityId: id,
        summary: "Project timeline updated",
        metadata: {
          previousCount: project.timeline.length,
          nextCount: updatedProject.timeline.length,
        },
        createdAt: updatedAt,
      });
    }

    return NextResponse.json({ project: updatedProject });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed.", issues: error.issues.map((issue) => issue.message) },
        { status: 422 },
      );
    }

    return NextResponse.json(
      { error: "Failed to update project.", detail: getSafeErrorDetail(error) },
      { status: 500 },
    );
  }
}
