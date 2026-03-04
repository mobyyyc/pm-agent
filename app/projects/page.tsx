import Link from "next/link";

import { getTaskReminders } from "@/lib/reminders";
import { getProjects, getTasks } from "@/lib/storage";

export default async function ProjectsPage() {
  const [projects, tasks] = await Promise.all([getProjects(), getTasks()]);
  const reminders = getTaskReminders(tasks, 3);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Projects</h1>
        <Link href="/" className="rounded-md border border-white/20 px-3 py-2 text-sm hover:bg-white/10">
          New Project
        </Link>
      </header>

      <section className="rounded-lg border border-white/20 bg-white/5 p-4">
        <h2 className="mb-3 text-lg font-medium">Deadline Reminders</h2>
        {reminders.length === 0 ? (
          <p className="text-sm text-white/75">No near-due tasks right now.</p>
        ) : (
          <ul className="space-y-2">
            {reminders.slice(0, 8).map((reminder) => (
              <li key={reminder.taskId} className="rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm">
                <Link href={`/projects/${reminder.projectId}`} className="font-medium hover:underline">
                  {reminder.title}
                </Link>
                <p className="text-white/75">
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
          <p className="rounded-lg border border-white/20 bg-white/5 p-4 text-sm text-white/75">
            No projects yet. Create your first project from the home page.
          </p>
        ) : (
          projects.map((project) => (
            <article key={project.id} className="rounded-lg border border-white/20 bg-white/5 p-4">
              <h3 className="text-lg font-medium">{project.idea}</h3>
              <p className="mt-1 text-sm text-white/75">{project.guideline}</p>
              <div className="mt-4">
                <Link href={`/projects/${project.id}`} className="text-sm font-medium hover:underline">
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
