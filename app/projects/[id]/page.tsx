import Link from "next/link";
import { notFound } from "next/navigation";

import { getProjects, getTasks } from "@/lib/storage";

import { TaskStatusSelect } from "./task-status-select";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProjectDashboardPage({ params }: PageProps) {
  const { id } = await params;
  const [projects, tasks] = await Promise.all([getProjects(), getTasks()]);

  const project = projects.find((item) => item.id === id);

  if (!project) {
    notFound();
  }

  const projectTasks = tasks.filter((task) => task.projectId === id);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Project Dashboard</h1>
          <p className="mt-1 text-sm text-white/75">{project.idea}</p>
        </div>
        <Link href="/" className="rounded-md bg-white/10 px-3 py-2 text-sm hover:bg-white/20">
          Back to Projects
        </Link>
      </header>

      <section className="rounded-lg bg-white/5 p-4">
        <h2 className="mb-2 text-lg font-medium">Guideline</h2>
        <p className="text-sm text-white/80">{project.guideline}</p>
      </section>

      <section className="rounded-lg bg-white/5 p-4">
        <h2 className="mb-3 text-lg font-medium">Project Timeline</h2>
        <ul className="space-y-2">
          {project.timeline.map((item, index) => (
            <li key={`${item.phase}-${index}`} className="rounded-md bg-white/5 p-3 text-sm">
              <p className="font-medium">{item.phase}</p>
              <p className="text-white/75">
                {item.startDate} to {item.endDate}
              </p>
              <p className="mt-1">Deliverable: {item.deliverable}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg bg-white/5 p-4">
        <h2 className="mb-3 text-lg font-medium">Task List</h2>
        {projectTasks.length === 0 ? (
          <p className="text-sm text-white/75">No tasks generated.</p>
        ) : (
          <ul className="space-y-3">
            {projectTasks.map((task) => (
              <li key={task.id} className="rounded-md bg-white/5 p-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{task.title}</p>
                    <p className="mt-1 text-sm text-white/80">{task.description}</p>
                    <p className="mt-1 text-xs text-white/75">
                      Deadline: {task.deadline} • Suggested assignee: {task.suggestedAssignee}
                    </p>
                  </div>
                  <TaskStatusSelect taskId={task.id} initialStatus={task.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
