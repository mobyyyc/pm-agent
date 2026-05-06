import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getTaskReminders } from "@/lib/reminders";
import { getProjectsByUserId, getTasksByProjectId, normalizeUserId } from "@/lib/storage";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const daysParam = url.searchParams.get("days");
    const parsedDays = Number(daysParam ?? "3");
    const days = Number.isFinite(parsedDays) && parsedDays >= 0 ? parsedDays : 3;

    const session = await getServerSession(authOptions);
    const sessionUserId = session?.user?.email ? normalizeUserId(session.user.email) : null;

    if (!sessionUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projects = await getProjectsByUserId(sessionUserId);
    const projectTasks = await Promise.all(projects.map((project) => getTasksByProjectId(project.id)));
    const tasks = projectTasks.flat();
    const reminders = getTaskReminders(tasks, days);

    return NextResponse.json({ reminders });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch reminders.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
