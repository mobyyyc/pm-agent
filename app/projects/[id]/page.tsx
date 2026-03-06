"use client";

import { useEffect, useState, use } from "react";
import { notFound } from "next/navigation";
import { useSession } from "next-auth/react";
import { useGuest } from "@/components/GuestContext";
import { TaskStatusSelect } from "./task-status-select";
import type { Project, Task } from "@/types/models";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function ProjectDashboardPage({ params }: PageProps) {
  const { id } = use(params);
  const { data: session, status: sessionStatus } = useSession();
  const { isGuest, getGuestProject } = useGuest();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);

  useEffect(() => {
    // Wait for session to settle
    if (sessionStatus === "loading") return;

    if (isGuest) {
      const gp = getGuestProject(id);
      if (gp) {
        setProject(gp.project);
        setTasks(gp.tasks);
      } else {
        setNotFoundState(true);
      }
      setLoading(false);
      return;
    }

    // Authenticated user: fetch from API
    if (session?.user?.email) {
      fetch(`/api/projects/${id}`)
        .then((res) => {
          if (!res.ok) {
            setNotFoundState(true);
            return null;
          }
          return res.json();
        })
        .then((data) => {
          if (data) {
            setProject(data.project);
            setTasks(data.tasks || []);
          }
        })
        .catch(() => setNotFoundState(true))
        .finally(() => setLoading(false));
    } else {
      setNotFoundState(true);
      setLoading(false);
    }
  }, [id, isGuest, session, sessionStatus, getGuestProject]);

  // Re-sync guest tasks when context updates
  useEffect(() => {
    if (isGuest) {
      const gp = getGuestProject(id);
      if (gp) {
        setTasks(gp.tasks);
      }
    }
  }, [isGuest, id, getGuestProject]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-neutral-400">Loading project...</p>
      </div>
    );
  }

  if (notFoundState || !project) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">{project.name || "Project Dashboard"}</h1>
        <p className="text-base text-neutral-400 max-w-2xl leading-relaxed">{project.idea}</p>
        {isGuest && (
          <p className="text-xs text-amber-500/80">Guest project — this data will be lost when you exit.</p>
        )}
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
        {tasks.length === 0 ? (
          <p className="text-sm text-neutral-400">No tasks generated.</p>
        ) : (
          <ul className="space-y-3">
            {tasks.map((task) => (
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
                    <TaskStatusSelect taskId={task.id} initialStatus={task.status} isGuest={isGuest} />
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
