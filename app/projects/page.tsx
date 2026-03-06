"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

import { useGuest } from "@/components/GuestContext";
import type { Project, Task } from "@/types/models";

// Inline reminder logic (client-side)
function getTaskReminders(tasks: Task[], daysThreshold: number) {
  const now = new Date();
  return tasks
    .filter((t) => t.status !== "done" && t.deadline)
    .map((t) => {
      const deadline = new Date(t.deadline);
      const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        taskId: t.id,
        projectId: t.projectId,
        title: t.title,
        deadline: t.deadline,
        daysLeft,
        isOverdue: daysLeft < 0,
      };
    })
    .filter((r) => r.daysLeft <= daysThreshold)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export default function ProjectsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const { isGuest, guestProjects } = useGuest();
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionStatus === "loading") return;

    if (isGuest) {
      setProjects(guestProjects.map((gp) => gp.project));
      setAllTasks(guestProjects.flatMap((gp) => gp.tasks));
      setLoading(false);
      return;
    }

    if (!session?.user?.email) {
      router.replace("/");
      return;
    }

    // Authenticated: fetch from API
    fetch("/api/projects")
      .then((res) => (res.ok ? res.json() : { projects: [] }))
      .then((data: { projects: Project[] }) => {
        const projs = data.projects || [];
        setProjects(projs);
        if (projs.length > 0) {
          // Fetch tasks for each project for reminders
          Promise.all(
            projs.map((p) =>
              fetch(`/api/projects/${p.id}`)
                .then((r) => (r.ok ? r.json() : { tasks: [] }))
                .then((d) => (d.tasks || []) as Task[])
            )
          ).then((taskArrays) => setAllTasks(taskArrays.flat()));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionStatus, session, isGuest, guestProjects, router]);

  const reminders = getTaskReminders(allTasks, 3);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-neutral-400">Loading projects...</p>
      </div>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-12">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-white">My Projects</h1>
        <Link href="/projects/new" className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 transition-all">
          New Project
        </Link>
      </header>

      {isGuest && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-900/20 px-4 py-3 text-sm text-amber-400">
          Guest session — projects are temporary and will be discarded when you exit.
        </div>
      )}

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
