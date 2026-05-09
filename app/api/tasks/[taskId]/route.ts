import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { getSafeErrorDetail } from "@/lib/api-errors";
import { authOptions } from "@/lib/auth";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";
import {
  deleteTaskById,
  getProjectById,
  getTaskById,
  isProjectMember,
  logProjectActivityEvent,
  normalizeUserId,
  removeTaskIdFromProject,
  updateTaskDetails,
  upsertAppUser,
} from "@/lib/storage";
import { isoNow } from "@/lib/utils";
import { updateTaskRequestSchema } from "@/lib/validators";

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

    const rateLimit = checkRateLimit(
      getRateLimitKey(request, "tasks:mutation", sessionUserId),
      RATE_LIMITS.mutation,
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

    const { taskId } = await context.params;
    const body = await request.json();
    const parsed = updateTaskRequestSchema.parse(body);

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

    const updatedAt = isoNow();
    const updatedTask = await updateTaskDetails(taskId, parsed, updatedAt);

    if (updatedTask) {
      const changedFields = [
        task.title !== updatedTask.title ? "title" : null,
        task.description !== updatedTask.description ? "description" : null,
        task.deadline !== updatedTask.deadline ? "deadline" : null,
        task.suggestedAssignee !== updatedTask.suggestedAssignee ? "suggestedAssignee" : null,
        task.status !== updatedTask.status ? "status" : null,
      ].filter((field): field is string => Boolean(field));
      const assigneeChanged = task.suggestedAssignee !== updatedTask.suggestedAssignee;
      const claimedByActor = assigneeChanged && normalizeUserId(updatedTask.suggestedAssignee) === sessionUserId;

      await logProjectActivityEvent({
        projectId: project.id,
        actorUserId: sessionUserId,
        source: "user",
        eventType: claimedByActor ? "task.claimed" : "task.updated",
        entityType: "task",
        entityId: taskId,
        summary: claimedByActor ? `Task claimed: ${updatedTask.title}` : `Task updated: ${updatedTask.title}`,
        metadata: {
          changedFields,
          previous: {
            title: task.title,
            deadline: task.deadline,
            suggestedAssignee: task.suggestedAssignee,
            status: task.status,
          },
          next: {
            title: updatedTask.title,
            deadline: updatedTask.deadline,
            suggestedAssignee: updatedTask.suggestedAssignee,
            status: updatedTask.status,
          },
        },
        createdAt: updatedAt,
      });
    }

    return NextResponse.json({ task: updatedTask });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed.", issues: error.issues.map((issue) => issue.message) },
        { status: 422 },
      );
    }

    return NextResponse.json(
      { error: "Failed to update task.", detail: getSafeErrorDetail(error) },
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
      getRateLimitKey(_request, "tasks:mutation", sessionUserId),
      RATE_LIMITS.mutation,
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

    const { taskId } = await context.params;
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

    const deletedAt = isoNow();
    await deleteTaskById(taskId);
    await removeTaskIdFromProject(project.id, taskId, deletedAt);
    await logProjectActivityEvent({
      projectId: project.id,
      actorUserId: sessionUserId,
      source: "user",
      eventType: "task.deleted",
      entityType: "task",
      entityId: taskId,
      summary: `Task deleted: ${task.title}`,
      metadata: {
        title: task.title,
        status: task.status,
        deadline: task.deadline,
        suggestedAssignee: task.suggestedAssignee,
      },
      createdAt: deletedAt,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete task.", detail: getSafeErrorDetail(error) },
      { status: 500 },
    );
  }
}
