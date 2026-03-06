import Link from "next/link";

import { getTaskReminders } from "@/lib/reminders";
import { getProjects, getTasks } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const [projects, tasks] = await Promise.all([getProjects(), getTasks()]);
  const reminders = getTaskReminders(tasks, 3);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-12">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-white">My Projects</h1>
        <Link href="/" className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 transition-all">
          New Project
        </Link>
      </header>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 text-xl font-semibold tracking-tight text-white">Deadline Reminders</h2>
        {reminders.length === 0 ? (
          <p className="text-sm text-neutral-400">No near-due tasks right now.</p>
        ) : (
          <ul className="space-y-3">
            {reminders.slice(0, 8).map((reminder) => (
              <li key={reminder.taskId} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm transition-colors hover:bg-white/10">
                <Link href={`/projects/${reminder.projectId}`} className="font-medium hover:text-white text-neutral-200">
                  {reminder.title}
                </Link>
                <p className="text-neutral-400 mt-1">
                  {reminder.isOverdue
                    ? `Overdue (${Math.abs(reminder.daysLeft)} days)`
                    : `Due in ${reminder.daysLeft} day(s)`}
                  {` • ${reminder.deadline}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4">
        {projects.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-neutral-400">
            No projects yet. Create your first project from the home page.
          </p>
        ) : (
          projects.map((project) => (
            <article key={project.id} className="rounded-2xl border border-white/10 bg-white/5 p-6 transition-all hover:border-white/20 hover:bg-white/10">
              <h3 className="text-lg font-medium text-white">{project.idea}</h3>
              <p className="mt-2 text-sm text-neutral-400">{project.guideline}</p>
              <div className="mt-4">
                <Link href={`/projects/${project.id}`} className="text-sm font-medium text-blue-400 hover:text-blue-300">
                  Open Dashboard
                </Link>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
