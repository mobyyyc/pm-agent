import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { addTaskIdToProject, getProjectById, isProjectMember, normalizeUserId, insertTask, upsertAppUser } from "@/lib/storage";
import { createId, isoNow } from "@/lib/utils";
import { createTaskRequestSchema, validateTask } from "@/lib/validators";

export async function POST(request: Request) {
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

    const body = await request.json();
    const parsed = createTaskRequestSchema.parse(body);

    const project = await getProjectById(parsed.projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const hasAccess = await isProjectMember(parsed.projectId, sessionUserId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const timestamp = isoNow();
    const task = validateTask({
      id: createId("task"),
      projectId: parsed.projectId,
      title: parsed.title,
      description: parsed.description,
      deadline: parsed.deadline,
      suggestedAssignee: parsed.suggestedAssignee,
      status: parsed.status,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await insertTask(task);
    const updatedProject = await addTaskIdToProject(parsed.projectId, task.id, timestamp);

    return NextResponse.json({ task, project: updatedProject }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed.", issues: error.issues.map((issue) => issue.message) },
        { status: 422 },
      );
    }

    return NextResponse.json(
      { error: "Failed to create task.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
