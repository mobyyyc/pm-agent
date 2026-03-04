import { NextResponse } from "next/server";
import { z } from "zod";

import { getTasks, saveTasks } from "@/lib/storage";
import { isoNow } from "@/lib/utils";
import { updateTaskStatusRequestSchema, validateTask } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { taskId } = await context.params;
    const body = await request.json();
    const parsed = updateTaskStatusRequestSchema.parse(body);

    const tasks = await getTasks();
    const taskIndex = tasks.findIndex((task) => task.id === taskId);

    if (taskIndex < 0) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }

    const updatedTask = validateTask({
      ...tasks[taskIndex],
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
