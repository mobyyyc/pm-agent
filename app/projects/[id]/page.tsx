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

  const [dbProject, setDbProject] = useState<Project | null>(null);
  const [dbTasks, setDbTasks] = useState<Task[]>([]);
  const [renderedTasks, setRenderedTasks] = useState<Task[]>([]);
  const [notFoundState, setNotFoundState] = useState(false);

  const guestProjectBundle = isGuest ? getGuestProject(id) : null;
  const project = isGuest ? (guestProjectBundle?.project || null) : dbProject;
  const tasks = isGuest ? (guestProjectBundle?.tasks || []) : dbTasks;
  const isPageLoading =
    sessionStatus === "loading" ||
    (!isGuest && !!session?.user?.email && !notFoundState && dbProject === null);

  useEffect(() => {
    // Wait for session to settle
    if (sessionStatus === "loading") return;

    if (isGuest) {
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
            setDbProject(data.project);
            setDbTasks(data.tasks || []);
          }
        })
        .catch(() => setNotFoundState(true));
    }
  }, [id, isGuest, session?.user?.email, sessionStatus, guestProjectBundle]);

  useEffect(() => {
    setRenderedTasks(tasks);
  }, [tasks]);

  if (isPageLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-neutral-400">Loading project...</p>
      </div>
    );
  }

  const isUnauthedUser = !isGuest && !session?.user?.email;
  const isGuestNotFound = isGuest && !guestProjectBundle;

  if (notFoundState || !project || isGuestNotFound || isUnauthedUser) {
    notFound();
  }

  const todoCount = renderedTasks.filter((task) => task.status === "todo").length;
  const inProgressCount = renderedTasks.filter((task) => task.status === "in_progress").length;
  const doneCount = renderedTasks.filter((task) => task.status === "done").length;

  const statusCardStyles: Record<Task["status"], string> = {
    todo: "bg-linear-to-l from-sky-500/18 to-transparent",
    in_progress: "bg-linear-to-l from-amber-500/18 to-transparent",
    done: "bg-linear-to-l from-emerald-500/18 to-transparent",
  };

  const handleStatusChange = (taskId: string, status: Task["status"]) => {
    setRenderedTasks((currentTasks) =>
      currentTasks.map((task) => (task.id === taskId ? { ...task, status } : task)),
    );
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">{project.name || "Project Dashboard"}</h1>
        <p className="text-base text-neutral-400 max-w-2xl leading-relaxed">{project.idea}</p>
        {isGuest && (
          <p className="text-xs text-amber-500/80">Guest project — this data will be lost when you exit.</p>
        )}
      </header>

      <section className="rounded-2xl bg-white/5 p-6 transition-all hover:bg-white/10">
        <h2 className="mb-4 text-xl font-semibold tracking-tight text-white">Guideline</h2>
        <p className="text-base text-neutral-300 leading-relaxed">{project.guideline}</p>
      </section>

      <section className="rounded-2xl bg-white/5 p-6">
        <h2 className="mb-4 text-xl font-semibold tracking-tight text-white">Project Timeline</h2>
        <ul className="space-y-3">
          {project.timeline.map((item, index) => (
            <li key={`${item.phase}-${index}`} className="rounded-xl bg-white/5 p-4 transition-colors hover:bg-white/10">
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

      <section className="rounded-2xl bg-white/5 p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold tracking-tight text-white">Task List</h2>
          <div className="flex flex-wrap gap-2 text-xs font-medium">
            <span className="rounded-md bg-sky-500/10 px-2.5 py-1 text-sky-200">To do: {todoCount}</span>
            <span className="rounded-md bg-amber-500/10 px-2.5 py-1 text-amber-200">In progress: {inProgressCount}</span>
            <span className="rounded-md bg-emerald-500/10 px-2.5 py-1 text-emerald-200">Done: {doneCount}</span>
          </div>
        </div>
        {renderedTasks.length === 0 ? (
          <p className="text-sm text-neutral-400">No tasks generated.</p>
        ) : (
          <ul className="space-y-3">
            {renderedTasks.map((task, index) => (
              <li
                key={task.id}
                className={`rounded-xl p-4 transition-colors hover:bg-white/10 ${statusCardStyles[task.status]}`}
              >
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-black/25 px-2 py-0.5 text-xs font-medium text-neutral-300">Task {index + 1}</span>
                      <p className="font-medium text-white text-lg">{task.title}</p>
                    </div>
                    <p className="text-sm text-neutral-400 leading-relaxed">{task.description}</p>
                    <div className="flex flex-wrap gap-2 pt-2">
                       <span className="text-xs text-neutral-500 bg-white/5 px-2 py-1 rounded-md">Deadline: {task.deadline}</span>
                       <span className="text-xs text-neutral-500 bg-white/5 px-2 py-1 rounded-md">Assignee: {task.suggestedAssignee}</span>
                    </div>
                  </div>
                  <div className="shrink-0 pt-1">
                    <TaskStatusSelect
                      taskId={task.id}
                      initialStatus={task.status}
                      isGuest={isGuest}
                      onStatusChange={handleStatusChange}
                    />
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
