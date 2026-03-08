import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { generateProjectPlanWithGemini } from "@/lib/gemini";
import { getProjectsByUserId, readTeamKnowledge, insertProject, insertTasks } from "@/lib/storage";
import { createId, isoNow } from "@/lib/utils";
import { createProjectRequestSchema, validateProject, validateTask } from "@/lib/validators";
import type { Project, Task } from "@/types/models";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userProjects = await getProjectsByUserId(session.user.email);
    
    return NextResponse.json({ projects: userProjects });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch projects.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const isGuest = !session?.user?.email;

    // Allow both authenticated users and guests
    const userId = session?.user?.email || `guest:${crypto.randomUUID()}`;

    const body = await request.json();
    const parsed = createProjectRequestSchema.parse(body);

  const userEmail = session?.user?.email ?? undefined;
  const teamKnowledge = await readTeamKnowledge(userEmail);

    const aiPlan = await generateProjectPlanWithGemini({
      projectIdea: parsed.idea,
      teamKnowledge,
      today: new Date().toISOString().slice(0, 10),
    });

    const timestamp = isoNow();
    const projectId = createId("project");

    const tasks: Task[] = aiPlan.tasks.map((task) =>
      validateTask({
        id: createId("task"),
        projectId,
        title: task.title,
        description: task.description,
        deadline: task.deadline,
        suggestedAssignee: task.suggestedAssignee,
        status: "todo",
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    );

    const project: Project = validateProject({
      id: projectId,
      userId,
      name: aiPlan.name,
      idea: parsed.idea,
      guideline: aiPlan.guideline,
      timeline: aiPlan.timeline,
      taskIds: tasks.map((task) => task.id),
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    // For guests, don't persist to DB — return data for client-side storage
    if (isGuest) {
      return NextResponse.json({ project, tasks, guest: true }, { status: 201 });
    }

    await insertProject(project);
    await insertTasks(tasks);

    return NextResponse.json({ project, tasks }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed.", issues: error.issues.map((issue) => issue.message) },
        { status: 422 },
      );
    }

    console.error("[POST /api/projects] Error:", error);

    return NextResponse.json(
      {
        error: "Failed to create project.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
