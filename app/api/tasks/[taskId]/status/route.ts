import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { getProjects, getTasks, saveTasks } from "@/lib/storage";
import { isoNow } from "@/lib/utils";
import { updateTaskStatusRequestSchema, validateTask } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { taskId } = await context.params;
    const body = await request.json();
    const parsed = updateTaskStatusRequestSchema.parse(body);

    const [tasks, projects] = await Promise.all([getTasks(), getProjects()]);
    const taskIndex = tasks.findIndex((task) => task.id === taskId);

    if (taskIndex < 0) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }

    const task = tasks[taskIndex];
    const project = projects.find((p) => p.id === task.projectId);

    if (!project || project.userId !== session.user.email) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updatedTask = validateTask({
      ...task,
      status: parsed.status,
      updatedAt: isoNow(),
    });

    const updatedTasks = [...tasks];
    updatedTasks[taskIndex] = updatedTask;
    await saveTasks(updatedTasks);

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
