import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { generateProjectPlanWithGemini } from "@/lib/gemini";
import {
  getProjectsByUserId,
  insertProject,
  insertTasks,
  normalizeUserId,
  readTeamKnowledge,
  upsertAppUser,
} from "@/lib/storage";
import { createId, isoNow } from "@/lib/utils";
import { createProjectRequestSchema, validateProject, validateTask } from "@/lib/validators";
import type { Project, Task } from "@/types/models";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    const sessionEmail = session?.user?.email ? normalizeUserId(session.user.email) : null;
    if (!sessionEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await upsertAppUser({
      userId: sessionEmail,
      displayName: session?.user?.name || null,
      imageUrl: session?.user?.image || null,
      timestamp: isoNow(),
    });

    const userProjects = await getProjectsByUserId(sessionEmail);

    return NextResponse.json({ projects: userProjects });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch projects.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const start = performance.now();
  try {
    let authMs = 0;
    let parseMs = 0;
    let teamMs = 0;
    let geminiMs = 0;
    let dbMs = 0;

    const authStart = performance.now();
    const session = await getServerSession(authOptions);
    const sessionEmail = session?.user?.email ? normalizeUserId(session.user.email) : null;
    const isGuest = !sessionEmail;
    authMs = performance.now() - authStart;

    // Allow both authenticated users and guests
    const userId = sessionEmail || `guest:${crypto.randomUUID()}`;

    const parseStart = performance.now();
    const body = await request.json();
    const parsed = createProjectRequestSchema.parse(body);
    parseMs = performance.now() - parseStart;

    const userEmail = sessionEmail ?? undefined;
    const teamStart = performance.now();
    const teamKnowledge = await readTeamKnowledge(userEmail);
    teamMs = performance.now() - teamStart;

    const geminiStart = performance.now();
    const aiPlan = await generateProjectPlanWithGemini({
      projectIdea: parsed.idea,
      teamKnowledge,
      today: new Date().toISOString().slice(0, 10),
    });
    geminiMs = performance.now() - geminiStart;

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

    // For guests, don't persist to DB �?return data for client-side storage
    if (isGuest) {
      const totalMs = performance.now() - start;
      const response = NextResponse.json({ project, tasks, guest: true }, { status: 201 });
      response.headers.set(
        "Server-Timing",
        [
          `auth;dur=${authMs.toFixed(1)}`,
          `parse;dur=${parseMs.toFixed(1)}`,
          `team;dur=${teamMs.toFixed(1)}`,
          `gemini;dur=${geminiMs.toFixed(1)}`,
          `db;dur=0.0`,
          `total;dur=${totalMs.toFixed(1)}`,
        ].join(", "),
      );
      return response;
    }

    await upsertAppUser({
      userId,
      displayName: session?.user?.name || null,
      imageUrl: session?.user?.image || null,
      timestamp,
    });

    const dbStart = performance.now();
    await insertProject(project);
    await insertTasks(tasks);
    dbMs = performance.now() - dbStart;

    const totalMs = performance.now() - start;
    const response = NextResponse.json({ project, tasks }, { status: 201 });
    response.headers.set(
      "Server-Timing",
      [
        `auth;dur=${authMs.toFixed(1)}`,
        `parse;dur=${parseMs.toFixed(1)}`,
        `team;dur=${teamMs.toFixed(1)}`,
        `gemini;dur=${geminiMs.toFixed(1)}`,
        `db;dur=${dbMs.toFixed(1)}`,
        `total;dur=${totalMs.toFixed(1)}`,
      ].join(", "),
    );
    return response;
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
