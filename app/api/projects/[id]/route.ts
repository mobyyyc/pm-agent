import { NextResponse } from "next/server";

import { getProjects, getTasks } from "@/lib/storage";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const [projects, tasks] = await Promise.all([getProjects(), getTasks()]);

    const project = projects.find((item) => item.id === id);

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const projectTasks = tasks.filter((task) => task.projectId === id);

    return NextResponse.json({ project, tasks: projectTasks });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch project.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
