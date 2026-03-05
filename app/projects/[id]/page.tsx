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
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">{project.name || "Project Dashboard"}</h1>
        <p className="text-base text-neutral-400 max-w-2xl leading-relaxed">{project.idea}</p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 transition-all hover:bg-white/10">
        <h2 className="mb-4 text-xl font-semibold tracking-tight text-white">Guideline</h2>
        <p className="text-base text-neutral-300 leading-relaxed">{project.guideline}</p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 text-xl font-semibold tracking-tight text-white">Project Timeline</h2>
        <ul className="space-y-3">
          {project.timeline.map((item, index) => (
            <li key={`${item.phase}-${index}`} className="rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                <span className="font-medium text-white text-lg">{item.phase}</span>
                <span className="text-xs font-mono text-neutral-400 bg-white/5 px-2 py-1 rounded-md self-start">
                   {item.startDate} &rarr; {item.endDate}
                </span>
              </div>
              <p className="text-sm text-neutral-400">Deliverable: <span className="text-neutral-300">{item.deliverable}</span></p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 text-xl font-semibold tracking-tight text-white">Task List</h2>
        {projectTasks.length === 0 ? (
          <p className="text-sm text-neutral-400">No tasks generated.</p>
        ) : (
          <ul className="space-y-3">
            {projectTasks.map((task) => (
              <li key={task.id} className="rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-medium text-white text-lg">{task.title}</p>
                    <p className="text-sm text-neutral-400 leading-relaxed">{task.description}</p>
                    <div className="flex flex-wrap gap-2 pt-2">
                       <span className="text-xs text-neutral-500 bg-white/5 px-2 py-1 rounded-md">Deadline: {task.deadline}</span>
                       <span className="text-xs text-neutral-500 bg-white/5 px-2 py-1 rounded-md">Assignee: {task.suggestedAssignee}</span>
                    </div>
                  </div>
                  <div className="shrink-0 pt-1">
                    <TaskStatusSelect taskId={task.id} initialStatus={task.status} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
