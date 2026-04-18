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

type TimelineDraft = Project["timeline"][number];
type TaskDraft = Pick<Task, "title" | "description" | "deadline" | "suggestedAssignee" | "status">;

async function getResponseErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as { detail?: string; error?: string } | null;
  return body?.detail || body?.error || fallback;
}

export default function ProjectDashboardPage({ params }: PageProps) {
  const { id } = use(params);
  const { data: session, status: sessionStatus } = useSession();
  const {
    isGuest,
    getGuestProject,
    removeGuestTask,
    removeGuestTimelineItem,
    updateGuestTask,
    updateGuestTimelineItem,
  } = useGuest();

  const [dbProject, setDbProject] = useState<Project | null>(null);
  const [dbTasks, setDbTasks] = useState<Task[]>([]);
  const [renderedTimeline, setRenderedTimeline] = useState<Project["timeline"]>([]);
  const [renderedTasks, setRenderedTasks] = useState<Task[]>([]);
  const [notFoundState, setNotFoundState] = useState(false);

  const [editingTimelineIndex, setEditingTimelineIndex] = useState<number | null>(null);
  const [timelineDraft, setTimelineDraft] = useState<TimelineDraft | null>(null);
  const [pendingTimelineIndex, setPendingTimelineIndex] = useState<number | null>(null);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);

  const [frameActionError, setFrameActionError] = useState<string | null>(null);

  const guestProjectBundle = isGuest ? getGuestProject(id) : null;
  const project = isGuest ? (guestProjectBundle?.project || null) : dbProject;
  const tasks = isGuest ? (guestProjectBundle?.tasks ?? dbTasks) : dbTasks;
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
    setRenderedTimeline(project?.timeline || []);
  }, [project]);

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

  const frameEditButtonClass =
    "pointer-events-none inline-flex h-7 shrink-0 translate-y-1 items-center rounded-full bg-white/15 px-4 text-xs font-semibold text-white opacity-0 transition-all duration-300 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-60";

  const handleStatusChange = (taskId: string, status: Task["status"]) => {
    setRenderedTasks((currentTasks) =>
      currentTasks.map((task) => (task.id === taskId ? { ...task, status } : task)),
    );
  };

  const handleTimelineEditStart = (timelineIndex: number) => {
    const item = renderedTimeline[timelineIndex];
    if (!item) return;

    setEditingTimelineIndex(timelineIndex);
    setTimelineDraft({ ...item });
    setFrameActionError(null);
  };

  const handleTimelineDraftChange = (field: keyof TimelineDraft, value: string) => {
    setTimelineDraft((currentDraft) => {
      if (!currentDraft) return currentDraft;
      return {
        ...currentDraft,
        [field]: value,
      };
    });
  };

  const handleSaveTimeline = async () => {
    if (editingTimelineIndex === null || !timelineDraft) return;

    const timelineIndex = editingTimelineIndex;
    const previousTimeline = renderedTimeline;
    const nextTimeline = renderedTimeline.map((item, index) => (index === timelineIndex ? timelineDraft : item));

    setRenderedTimeline(nextTimeline);
    setPendingTimelineIndex(timelineIndex);
    setFrameActionError(null);

    try {
      if (isGuest) {
        updateGuestTimelineItem(id, timelineIndex, timelineDraft);
      } else {
        const response = await fetch(`/api/projects/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timeline: nextTimeline }),
        });

        if (!response.ok) {
          throw new Error(await getResponseErrorMessage(response, "Failed to save timeline item."));
        }

        const data = (await response.json()) as { project?: Project };
        if (data.project) {
          setDbProject(data.project);
          setRenderedTimeline(data.project.timeline);
        }
      }

      setEditingTimelineIndex(null);
      setTimelineDraft(null);
    } catch (error) {
      setRenderedTimeline(previousTimeline);
      setFrameActionError(error instanceof Error ? error.message : "Failed to save timeline item.");
    } finally {
      setPendingTimelineIndex(null);
    }
  };

  const handleRemoveTimeline = async (timelineIndex: number) => {
    const previousTimeline = renderedTimeline;
    const nextTimeline = renderedTimeline.filter((_, index) => index !== timelineIndex);

    setRenderedTimeline(nextTimeline);
    setPendingTimelineIndex(timelineIndex);
    setFrameActionError(null);

    try {
      if (isGuest) {
        removeGuestTimelineItem(id, timelineIndex);
      } else {
        const response = await fetch(`/api/projects/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timeline: nextTimeline }),
        });

        if (!response.ok) {
          throw new Error(await getResponseErrorMessage(response, "Failed to remove timeline item."));
        }

        const data = (await response.json()) as { project?: Project };
        if (data.project) {
          setDbProject(data.project);
          setRenderedTimeline(data.project.timeline);
        }
      }

      if (editingTimelineIndex !== null) {
        if (editingTimelineIndex === timelineIndex) {
          setEditingTimelineIndex(null);
          setTimelineDraft(null);
        } else if (timelineIndex < editingTimelineIndex) {
          setEditingTimelineIndex(editingTimelineIndex - 1);
        }
      }
    } catch (error) {
      setRenderedTimeline(previousTimeline);
      setFrameActionError(error instanceof Error ? error.message : "Failed to remove timeline item.");
    } finally {
      setPendingTimelineIndex(null);
    }
  };

  const handleTaskEditStart = (task: Task) => {
    setEditingTaskId(task.id);
    setTaskDraft({
      title: task.title,
      description: task.description,
      deadline: task.deadline,
      suggestedAssignee: task.suggestedAssignee,
      status: task.status,
    });
    setFrameActionError(null);
  };

  const handleTaskDraftChange = (field: keyof TaskDraft, value: string) => {
    setTaskDraft((currentDraft) => {
      if (!currentDraft) return currentDraft;

      if (field === "status") {
        return {
          ...currentDraft,
          status: value as Task["status"],
        };
      }

      return {
        ...currentDraft,
        [field]: value,
      };
    });
  };

  const handleSaveTask = async () => {
    if (!editingTaskId || !taskDraft) return;

    const taskId = editingTaskId;
    const previousTasks = renderedTasks;
    const nextTasks = renderedTasks.map((task) => (task.id === taskId ? { ...task, ...taskDraft } : task));

    setRenderedTasks(nextTasks);
    setPendingTaskId(taskId);
    setFrameActionError(null);

    try {
      if (isGuest) {
        updateGuestTask(taskId, taskDraft);
      } else {
        const response = await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(taskDraft),
        });

        if (!response.ok) {
          throw new Error(await getResponseErrorMessage(response, "Failed to save task."));
        }

        const data = (await response.json()) as { task?: Task };
        if (data.task) {
          setDbTasks((currentTasks) => currentTasks.map((task) => (task.id === taskId ? data.task as Task : task)));
          setRenderedTasks((currentTasks) =>
            currentTasks.map((task) => (task.id === taskId ? data.task as Task : task)),
          );
        }
      }

      setEditingTaskId(null);
      setTaskDraft(null);
    } catch (error) {
      setRenderedTasks(previousTasks);
      setFrameActionError(error instanceof Error ? error.message : "Failed to save task.");
    } finally {
      setPendingTaskId(null);
    }
  };

  const handleRemoveTask = async (taskId: string) => {
    const previousTasks = renderedTasks;
    const nextTasks = renderedTasks.filter((task) => task.id !== taskId);

    setRenderedTasks(nextTasks);
    setPendingTaskId(taskId);
    setFrameActionError(null);

    try {
      if (isGuest) {
        removeGuestTask(taskId);
      } else {
        const response = await fetch(`/api/tasks/${taskId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error(await getResponseErrorMessage(response, "Failed to remove task."));
        }

        setDbTasks((currentTasks) => currentTasks.filter((task) => task.id !== taskId));
      }

      if (editingTaskId === taskId) {
        setEditingTaskId(null);
        setTaskDraft(null);
      }
    } catch (error) {
      setRenderedTasks(previousTasks);
      setFrameActionError(error instanceof Error ? error.message : "Failed to remove task.");
    } finally {
      setPendingTaskId(null);
    }
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

      {frameActionError ? (
        <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {frameActionError}
        </p>
      ) : null}

      <section className="rounded-2xl bg-white/5 p-6 transition-all hover:bg-white/10">
        <h2 className="mb-4 text-xl font-semibold tracking-tight text-white">Guideline</h2>
        <p className="text-base text-neutral-300 leading-relaxed">{project.guideline}</p>
      </section>

      <section className="rounded-2xl bg-white/5 p-6">
        <h2 className="mb-4 text-xl font-semibold tracking-tight text-white">Project Timeline</h2>
        {renderedTimeline.length === 0 ? (
          <p className="text-sm text-neutral-400">No timeline items available.</p>
        ) : (
          <ul className="space-y-3">
            {renderedTimeline.map((item, index) => {
              const isEditing = editingTimelineIndex === index;
              const isPending = pendingTimelineIndex === index;
              const timelineView = isEditing && timelineDraft ? timelineDraft : item;

              return (
                <li
                  key={`${item.phase}-${index}`}
                  className={`group rounded-xl bg-white/5 p-4 transition-all duration-300 ease-in-out ${
                    isEditing ? "ring-1 ring-white/20" : "hover:bg-white/10"
                  }`}
                >
                  {isEditing ? (
                    <button
                      type="button"
                      onClick={() => void handleRemoveTimeline(index)}
                      disabled={isPending}
                      className="mb-4 rounded-full bg-red-500/20 px-4 py-1.5 text-xs font-semibold text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isPending ? "Removing..." : "Remove"}
                    </button>
                  ) : null}

                  <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <span className="text-lg font-medium text-white">{timelineView.phase}</span>
                    <span className="self-start rounded-md bg-white/5 px-2 py-1 font-mono text-xs text-neutral-400">
                      {timelineView.startDate} &rarr; {timelineView.endDate}
                    </span>
                  </div>
                  <div className="flex items-end justify-between gap-3">
                    <p className="min-w-0 flex-1 text-sm text-neutral-400">
                      Deliverable: <span className="text-neutral-300">{timelineView.deliverable}</span>
                    </p>
                    {!isEditing ? (
                      <button
                        type="button"
                        onClick={() => handleTimelineEditStart(index)}
                        disabled={isPending}
                        className={frameEditButtonClass}
                      >
                        Edit
                      </button>
                    ) : null}
                  </div>

                  <div
                    className={`overflow-hidden transition-[max-height,opacity,margin] duration-300 ease-in-out ${
                      isEditing ? "mt-4 max-h-96 opacity-100" : "max-h-0 opacity-0"
                    }`}
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1 text-xs text-neutral-400">
                        <span>Phase</span>
                        <input
                          type="text"
                          value={timelineDraft?.phase || ""}
                          onChange={(event) => handleTimelineDraftChange("phase", event.target.value)}
                          className="w-full rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-white/40"
                        />
                      </label>
                      <label className="space-y-1 text-xs text-neutral-400">
                        <span>Deliverable</span>
                        <input
                          type="text"
                          value={timelineDraft?.deliverable || ""}
                          onChange={(event) => handleTimelineDraftChange("deliverable", event.target.value)}
                          className="w-full rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-white/40"
                        />
                      </label>
                      <label className="space-y-1 text-xs text-neutral-400">
                        <span>Start Date</span>
                        <input
                          type="date"
                          value={timelineDraft?.startDate || ""}
                          onChange={(event) => handleTimelineDraftChange("startDate", event.target.value)}
                          className="w-full rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-white/40"
                        />
                      </label>
                      <label className="space-y-1 text-xs text-neutral-400">
                        <span>End Date</span>
                        <input
                          type="date"
                          value={timelineDraft?.endDate || ""}
                          onChange={(event) => handleTimelineDraftChange("endDate", event.target.value)}
                          className="w-full rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-white/40"
                        />
                      </label>
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() => void handleSaveTimeline()}
                        disabled={isPending}
                        className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-black transition-all duration-300 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isPending ? "Saving..." : "Save"}
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-white/5 p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold tracking-tight text-white">Task List</h2>
          <div className="flex items-center gap-4 text-xs font-medium sm:gap-5">
            <span className="inline-flex items-center gap-2 whitespace-nowrap text-sky-200">
              <span className="h-2 w-2 rounded-full bg-sky-300" aria-hidden="true" />
              To do: {todoCount}
            </span>
            <span className="inline-flex items-center gap-2 whitespace-nowrap text-amber-200">
              <span className="h-2 w-2 rounded-full bg-amber-300" aria-hidden="true" />
              In progress: {inProgressCount}
            </span>
            <span className="inline-flex items-center gap-2 whitespace-nowrap text-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-300" aria-hidden="true" />
              Done: {doneCount}
            </span>
          </div>
        </div>
        {renderedTasks.length === 0 ? (
          <p className="text-sm text-neutral-400">No tasks generated.</p>
        ) : (
          <ul className="space-y-3">
            {renderedTasks.map((task, index) => {
              const isEditing = editingTaskId === task.id;
              const isPending = pendingTaskId === task.id;
              const taskView = isEditing && taskDraft ? { ...task, ...taskDraft } : task;

              return (
                <li
                  key={task.id}
                  className={`group rounded-xl p-4 transition-all duration-300 ease-in-out ${
                    statusCardStyles[taskView.status]
                  } ${isEditing ? "ring-1 ring-white/20" : "hover:bg-white/10"}`}
                >
                  {isEditing ? (
                    <button
                      type="button"
                      onClick={() => void handleRemoveTask(task.id)}
                      disabled={isPending}
                      className="mb-4 rounded-full bg-red-500/20 px-4 py-1.5 text-xs font-semibold text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isPending ? "Removing..." : "Remove"}
                    </button>
                  ) : null}

                  <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-black/25 px-2 py-0.5 text-xs font-medium text-neutral-300">
                          Task {index + 1}
                        </span>
                        <p className="text-lg font-medium text-white">{taskView.title}</p>
                      </div>
                      <p className="text-sm leading-relaxed text-neutral-400">{taskView.description}</p>
                    </div>

                    {!isEditing ? (
                      <div className="shrink-0 pt-1">
                        <TaskStatusSelect
                          taskId={task.id}
                          initialStatus={task.status}
                          isGuest={isGuest}
                          onStatusChange={handleStatusChange}
                        />
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-2 flex items-end justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap gap-2">
                      <span className="inline-flex h-7 items-center rounded-md bg-white/5 px-2 text-xs text-neutral-500">
                        Deadline: {taskView.deadline}
                      </span>
                      <span className="inline-flex h-7 items-center rounded-md bg-white/5 px-2 text-xs text-neutral-500">
                        Assignee: {taskView.suggestedAssignee}
                      </span>
                    </div>
                    {!isEditing ? (
                      <button
                        type="button"
                        onClick={() => handleTaskEditStart(task)}
                        disabled={isPending}
                        className={frameEditButtonClass}
                      >
                        Edit
                      </button>
                    ) : null}
                  </div>

                  <div
                    className={`overflow-hidden transition-[max-height,opacity,margin] duration-300 ease-in-out ${
                      isEditing ? "mt-4 max-h-140 opacity-100" : "max-h-0 opacity-0"
                    }`}
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1 text-xs text-neutral-400 sm:col-span-2">
                        <span>Title</span>
                        <input
                          type="text"
                          value={taskDraft?.title || ""}
                          onChange={(event) => handleTaskDraftChange("title", event.target.value)}
                          className="w-full rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-white/40"
                        />
                      </label>
                      <label className="space-y-1 text-xs text-neutral-400 sm:col-span-2">
                        <span>Description</span>
                        <textarea
                          value={taskDraft?.description || ""}
                          onChange={(event) => handleTaskDraftChange("description", event.target.value)}
                          rows={4}
                          className="w-full rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-white/40"
                        />
                      </label>
                      <label className="space-y-1 text-xs text-neutral-400">
                        <span>Deadline</span>
                        <input
                          type="date"
                          value={taskDraft?.deadline || ""}
                          onChange={(event) => handleTaskDraftChange("deadline", event.target.value)}
                          className="w-full rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-white/40"
                        />
                      </label>
                      <label className="space-y-1 text-xs text-neutral-400">
                        <span>Assignee</span>
                        <input
                          type="text"
                          value={taskDraft?.suggestedAssignee || ""}
                          onChange={(event) => handleTaskDraftChange("suggestedAssignee", event.target.value)}
                          className="w-full rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-white/40"
                        />
                      </label>
                      <label className="space-y-1 text-xs text-neutral-400">
                        <span>Status</span>
                        <select
                          value={taskDraft?.status || "todo"}
                          onChange={(event) => handleTaskDraftChange("status", event.target.value)}
                          className="w-full rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-white/40"
                        >
                          <option value="todo">To do</option>
                          <option value="in_progress">In progress</option>
                          <option value="done">Done</option>
                        </select>
                      </label>
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() => void handleSaveTask()}
                        disabled={isPending}
                        className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-black transition-all duration-300 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isPending ? "Saving..." : "Save"}
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
