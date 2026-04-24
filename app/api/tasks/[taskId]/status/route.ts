import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { getTaskById, getProjectById, isProjectMember, normalizeUserId, updateTaskStatus, upsertAppUser } from "@/lib/storage";
import { isoNow } from "@/lib/utils";
import { updateTaskStatusRequestSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUserId = session?.user?.email ? normalizeUserId(session.user.email) : null;

    if (!sessionUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await upsertAppUser({
      userId: sessionUserId,
      displayName: session.user?.name || null,
      imageUrl: session.user?.image || null,
      timestamp: isoNow(),
    });

    const { taskId } = await context.params;
    const body = await request.json();
    const parsed = updateTaskStatusRequestSchema.parse(body);

    const task = await getTaskById(taskId);

    if (!task) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }

    const project = await getProjectById(task.projectId);

    if (!project) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const hasAccess = await isProjectMember(project.id, sessionUserId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updatedTask = await updateTaskStatus(taskId, parsed.status, isoNow());

    return NextResponse.json({ task: updatedTask });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed.", issues: error.issues.map((issue) => issue.message) },
        { status: 422 },
      );
    }

    return NextResponse.json(
      { error: "Failed to update task status.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
