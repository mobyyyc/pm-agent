"use client";

import { useCallback, useEffect, useRef, useState, use } from "react";
import { notFound } from "next/navigation";
import { useSession } from "next-auth/react";
import { useGuest } from "@/components/GuestContext";
import { ActivitySection } from "@/components/projects/activity-section";
import { GuidelineSection } from "@/components/projects/guideline-section";
import { ProjectHeader } from "@/components/projects/project-header";
import { ProjectProgressSection } from "@/components/projects/project-progress-section";
import { ProjectReportSection } from "@/components/projects/project-report-section";
import { TaskListSection } from "@/components/projects/task-list-section";
import { calculateProjectHealth } from "@/lib/project-health";
import { calculateProjectProgress } from "@/lib/project-progress";
import type {
  Project,
  ProjectActivityEvent,
  ProjectHealthSummary,
  ProjectMember,
  ProjectProgressSummary,
  Task,
} from "@/types/models";

type PageProps = {
  params: Promise<{ id: string }>;
};

type TimelineDraft = Project["timeline"][number];
type TaskDraft = Pick<Task, "title" | "description" | "deadline" | "suggestedAssignee" | "status">;
type ProjectTitleUpdatedDetail = { projectId: string; name: string };
type ProjectResponse = {
  project?: Project;
  tasks?: Task[];
  members?: ProjectMember[];
  progress?: ProjectProgressSummary;
  health?: ProjectHealthSummary;
};
type ActivityResponse = {
  events?: ProjectActivityEvent[];
};

const COLLAPSE_ANIMATION_MS = 320;

async function getResponseErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as { detail?: string; error?: string } | null;
  return body?.detail || body?.error || fallback;
}

export default function ProjectDashboardPage({ params }: PageProps) {
  const { id } = use(params);
  const { data: session, status: sessionStatus } = useSession();
  const {
    isGuest,
    addGuestTask,
    addGuestTimelineItem,
    getGuestProject,
    removeGuestTask,
    removeGuestTimelineItem,
    updateGuestProjectTitle,
    updateGuestTask,
    updateGuestTimelineItem,
  } = useGuest();

  const [dbProject, setDbProject] = useState<Project | null>(null);
  const [dbTasks, setDbTasks] = useState<Task[]>([]);
  const [dbMembers, setDbMembers] = useState<ProjectMember[]>([]);
  const [dbActivityEvents, setDbActivityEvents] = useState<ProjectActivityEvent[]>([]);
  const [renderedTimeline, setRenderedTimeline] = useState<Project["timeline"]>([]);
  const [renderedTasks, setRenderedTasks] = useState<Task[]>([]);
  const [notFoundState, setNotFoundState] = useState(false);

  const [editingTimelineIndex, setEditingTimelineIndex] = useState<number | null>(null);
  const [timelineDraft, setTimelineDraft] = useState<TimelineDraft | null>(null);
  const [pendingTimelineIndex, setPendingTimelineIndex] = useState<number | null>(null);
  const [isAddingTimeline, setIsAddingTimeline] = useState(false);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [taskListMode, setTaskListMode] = useState<"mine" | "all">("all");
  const [taskStatusFilter, setTaskStatusFilter] = useState<"all" | "todo" | "in_progress" | "done">("all");
  const [timelineEditCooldownIndex, setTimelineEditCooldownIndex] = useState<number | null>(null);
  const [taskEditCooldownId, setTaskEditCooldownId] = useState<string | null>(null);
  const [isEditingProjectTitle, setIsEditingProjectTitle] = useState(false);
  const [isSavingProjectTitle, setIsSavingProjectTitle] = useState(false);
  const [projectTitleDraft, setProjectTitleDraft] = useState("");

  const [frameActionError, setFrameActionError] = useState<string | null>(null);

  const timelineCooldownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const taskCooldownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectTitleInputRef = useRef<HTMLInputElement | null>(null);
  const skipProjectTitleBlurSaveRef = useRef(false);

  const guestProjectBundle = isGuest ? getGuestProject(id) : null;
  const project = isGuest ? (guestProjectBundle?.project || null) : dbProject;
  const tasks = isGuest ? (guestProjectBundle?.tasks ?? dbTasks) : dbTasks;
  const isPageLoading =
    sessionStatus === "loading" ||
    (!isGuest && !!session?.user?.email && !notFoundState && dbProject === null);

  const refreshActivity = useCallback(async () => {
    if (isGuest || !session?.user?.email) return;

    const response = await fetch(`/api/projects/${id}/activity?limit=50`, { cache: "no-store" });
    if (!response.ok) return;

    const data = (await response.json().catch(() => null)) as ActivityResponse | null;
    setDbActivityEvents(Array.isArray(data?.events) ? data.events : []);
  }, [id, isGuest, session?.user?.email]);

  useEffect(() => {
    // Wait for session to settle
    if (sessionStatus === "loading") return;

    if (isGuest) {
      return;
    }

    // Authenticated user: fetch from API
    if (session?.user?.email) {
      fetch(`/api/projects/${id}`)
        .then(async (res) => {
          if (!res.ok) {
            setNotFoundState(true);
            return null;
          }
          return (await res.json()) as ProjectResponse;
        })
        .then((data) => {
          if (data) {
            setDbProject(data.project ?? null);
            setDbTasks(data.tasks || []);
            setDbMembers(Array.isArray(data.members) ? data.members : []);
          }
        })
        .catch(() => setNotFoundState(true));
    }
  }, [id, isGuest, session?.user?.email, sessionStatus, guestProjectBundle]);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    void refreshActivity();
  }, [refreshActivity, sessionStatus]);

  useEffect(() => {
    setRenderedTimeline(project?.timeline || []);
  }, [project]);

  useEffect(() => {
    setRenderedTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    if (!isGuest && session?.user?.email) {
      setTaskListMode("mine");
    }
  }, [isGuest, session?.user?.email]);

  useEffect(() => {
    if (isEditingProjectTitle) return;
    setProjectTitleDraft(project?.name || "");
  }, [isEditingProjectTitle, project?.name]);

  useEffect(() => {
    if (!isEditingProjectTitle) return;
    projectTitleInputRef.current?.focus();
    projectTitleInputRef.current?.select();
  }, [isEditingProjectTitle]);

  useEffect(() => {
    return () => {
      if (timelineCooldownTimeoutRef.current) {
        clearTimeout(timelineCooldownTimeoutRef.current);
      }
      if (taskCooldownTimeoutRef.current) {
        clearTimeout(taskCooldownTimeoutRef.current);
      }
    };
  }, []);

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

  const projectForProgress: Project = {
    ...project,
    timeline: renderedTimeline,
  };
  const today = new Date().toISOString().slice(0, 10);
  const projectProgress = calculateProjectProgress(
    projectForProgress,
    renderedTasks,
    today,
  );
  const projectHealth = calculateProjectHealth(projectProgress, today);

  const ownerMemberFallback: ProjectMember = {
    projectId: project.id,
    userId: project.userId,
    role: "owner",
    joinedAt: project.createdAt,
    displayName: session?.user?.name || null,
    imageUrl: session?.user?.image || null,
  };

  const ownerMember =
    dbMembers.find((member) => member.role === "owner") || dbMembers[0] || ownerMemberFallback;
  const projectMembers = dbMembers.length > 0 ? dbMembers : [ownerMember];

  const normalizeAssigneeKey = (value: string) => value.trim().toLowerCase();
  const getMemberLabel = (member: ProjectMember) => member.displayName?.trim() || member.userId;
  const currentUserKey = session?.user?.email ? normalizeAssigneeKey(session.user.email) : null;
  const currentUserMember = currentUserKey
    ? projectMembers.find((member) => normalizeAssigneeKey(member.userId) === currentUserKey) || null
    : null;
  const findMemberByAssigneeValue = (value?: string | null) => {
    if (!value) return null;

    const normalizedValue = normalizeAssigneeKey(value);
    return (
      projectMembers.find((member) => {
        const memberUserId = normalizeAssigneeKey(member.userId);
        const memberDisplayName = member.displayName ? normalizeAssigneeKey(member.displayName) : null;

        return memberUserId === normalizedValue || memberDisplayName === normalizedValue;
      }) || null
    );
  };
  const getAssigneeValue = (value?: string | null) => findMemberByAssigneeValue(value)?.userId || ownerMember.userId;
  const getAssigneeLabel = (value?: string | null) => {
    const member = findMemberByAssigneeValue(value);
    if (member) return getMemberLabel(member);
    return value?.trim() || "Unassigned";
  };
  const isTaskAssignedToCurrentUser = (task: Task) => {
    if (!currentUserMember) {
      return false;
    }

    const member = findMemberByAssigneeValue(task.suggestedAssignee);
    return normalizeAssigneeKey(member?.userId || "") === normalizeAssigneeKey(currentUserMember.userId);
  };

  const filteredByAssignee =
    taskListMode === "mine" && currentUserMember ? renderedTasks.filter(isTaskAssignedToCurrentUser) : renderedTasks;

  const visibleTasks =
    taskStatusFilter === "all" ? filteredByAssignee : filteredByAssignee.filter((task) => task.status === taskStatusFilter);

  const todoCount = filteredByAssignee.filter((task) => task.status === "todo").length;
  const inProgressCount = filteredByAssignee.filter((task) => task.status === "in_progress").length;
  const doneCount = filteredByAssignee.filter((task) => task.status === "done").length;

  const statusCardStyles: Record<Task["status"], string> = {
    todo: "bg-linear-to-l from-sky-500/18 to-transparent",
    in_progress: "bg-linear-to-l from-amber-500/18 to-transparent",
    done: "bg-linear-to-l from-emerald-500/18 to-transparent",
  };

  const frameEditButtonClass =
    "normal-button inline-flex h-7 shrink-0 items-center rounded-full px-4 text-xs font-semibold transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 sm:pointer-events-none sm:translate-y-1 sm:opacity-0 sm:group-hover:pointer-events-auto sm:group-hover:translate-y-0 sm:group-hover:opacity-100";
  const framePrimaryActionButtonClass =
    "key-button inline-flex h-9 items-center justify-center rounded-full border border-transparent px-6 text-sm font-semibold leading-none shadow-lg transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60";

  const getTodayDate = () => new Date().toISOString().slice(0, 10);

  const createTimelineTemplate = (): TimelineDraft => ({
    phase: `Phase ${renderedTimeline.length + 1}`,
    startDate: getTodayDate(),
    endDate: getTodayDate(),
    deliverable: "Describe the expected deliverable",
  });

  const createTaskTemplate = (): TaskDraft => ({
    title: `New Task ${renderedTasks.length + 1}`,
    description: "Describe what this task needs to deliver.",
    deadline: getTodayDate(),
    suggestedAssignee: ownerMember.userId,
    status: "todo",
  });

  const startTimelineEditCooldown = (timelineIndex: number) => {
    if (timelineCooldownTimeoutRef.current) {
      clearTimeout(timelineCooldownTimeoutRef.current);
    }

    setTimelineEditCooldownIndex(timelineIndex);
    timelineCooldownTimeoutRef.current = setTimeout(() => {
      setTimelineEditCooldownIndex((current) => (current === timelineIndex ? null : current));
    }, COLLAPSE_ANIMATION_MS);
  };

  const startTaskEditCooldown = (taskId: string) => {
    if (taskCooldownTimeoutRef.current) {
      clearTimeout(taskCooldownTimeoutRef.current);
    }

    setTaskEditCooldownId(taskId);
    taskCooldownTimeoutRef.current = setTimeout(() => {
      setTaskEditCooldownId((current) => (current === taskId ? null : current));
    }, COLLAPSE_ANIMATION_MS);
  };

  const handleStatusChange = (taskId: string, status: Task["status"]) => {
    setRenderedTasks((currentTasks) =>
      currentTasks.map((task) => (task.id === taskId ? { ...task, status } : task)),
    );
  };

  const handleProjectTitleEditStart = () => {
    setProjectTitleDraft(project.name || "");
    setIsEditingProjectTitle(true);
    setFrameActionError(null);
  };

  const handleProjectTitleEditCancel = () => {
    setProjectTitleDraft(project.name || "");
    setIsEditingProjectTitle(false);
    setFrameActionError(null);
  };

  const handleProjectTitleSave = async () => {
    if (isSavingProjectTitle) return;

    const nextTitle = projectTitleDraft.trim();
    if (!nextTitle) {
      setFrameActionError("Project title is required.");
      return;
    }

    if (nextTitle === project.name) {
      setIsEditingProjectTitle(false);
      return;
    }

    setFrameActionError(null);
    setIsSavingProjectTitle(true);
    const previousProject = project;

    try {
      if (isGuest) {
        updateGuestProjectTitle(id, nextTitle);
        setProjectTitleDraft(nextTitle);
        setIsEditingProjectTitle(false);
        window.dispatchEvent(
          new CustomEvent<ProjectTitleUpdatedDetail>("project-title-updated", {
            detail: { projectId: id, name: nextTitle },
          }),
        );
        return;
      }

      setDbProject({
        ...project,
        name: nextTitle,
      });

      const response = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextTitle }),
      });

      if (!response.ok) {
        throw new Error(await getResponseErrorMessage(response, "Failed to save project title."));
      }

      const data = (await response.json()) as { project?: Project };
      const savedTitle = data.project?.name || nextTitle;
      if (data.project) {
        setDbProject(data.project);
        setProjectTitleDraft(savedTitle);
      }

      setIsEditingProjectTitle(false);
      await refreshActivity();
      window.dispatchEvent(
        new CustomEvent<ProjectTitleUpdatedDetail>("project-title-updated", {
          detail: { projectId: id, name: savedTitle },
        }),
      );
    } catch (error) {
      setDbProject(previousProject);
      setProjectTitleDraft(previousProject.name || "");
      setFrameActionError(error instanceof Error ? error.message : "Failed to save project title.");
    } finally {
      setIsSavingProjectTitle(false);
    }
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
      await refreshActivity();
      startTimelineEditCooldown(timelineIndex);
    } catch (error) {
      setRenderedTimeline(previousTimeline);
      setFrameActionError(error instanceof Error ? error.message : "Failed to save timeline item.");
    } finally {
      setPendingTimelineIndex(null);
    }
  };

  const handleAddTimeline = async () => {
    const timelineTemplate = createTimelineTemplate();
    const previousTimeline = renderedTimeline;
    const nextTimeline = [...renderedTimeline, timelineTemplate];
    const createdTimelineIndex = nextTimeline.length - 1;

    setRenderedTimeline(nextTimeline);
    setIsAddingTimeline(true);
    setFrameActionError(null);

    try {
      if (isGuest) {
        addGuestTimelineItem(id, timelineTemplate);
      } else {
        const response = await fetch(`/api/projects/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timeline: nextTimeline }),
        });

        if (!response.ok) {
          throw new Error(await getResponseErrorMessage(response, "Failed to add timeline item."));
        }

        const data = (await response.json()) as { project?: Project };
        if (data.project) {
          setDbProject(data.project);
          setRenderedTimeline(data.project.timeline);
        }
      }

      await refreshActivity();
      setEditingTimelineIndex(createdTimelineIndex);
      setTimelineDraft({ ...timelineTemplate });
    } catch (error) {
      setRenderedTimeline(previousTimeline);
      setFrameActionError(error instanceof Error ? error.message : "Failed to add timeline item.");
    } finally {
      setIsAddingTimeline(false);
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

      await refreshActivity();
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
      suggestedAssignee: getAssigneeValue(task.suggestedAssignee),
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

      await refreshActivity();
      setEditingTaskId(null);
      setTaskDraft(null);
      startTaskEditCooldown(taskId);
    } catch (error) {
      setRenderedTasks(previousTasks);
      setFrameActionError(error instanceof Error ? error.message : "Failed to save task.");
    } finally {
      setPendingTaskId(null);
    }
  };

  const handleClaimTask = async (task: Task) => {
    if (!currentUserMember) {
      return;
    }

    const claimedAssignee = currentUserMember.userId;
    if (normalizeAssigneeKey(task.suggestedAssignee) === normalizeAssigneeKey(claimedAssignee)) {
      return;
    }

    const previousTasks = renderedTasks;
    const nextTasks = renderedTasks.map((currentTask) =>
      currentTask.id === task.id ? { ...currentTask, suggestedAssignee: claimedAssignee } : currentTask,
    );

    setRenderedTasks(nextTasks);
    setPendingTaskId(task.id);
    setFrameActionError(null);

    try {
      if (isGuest) {
        updateGuestTask(task.id, { suggestedAssignee: claimedAssignee });
      } else {
        const response = await fetch(`/api/tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: task.title,
            description: task.description,
            deadline: task.deadline,
            suggestedAssignee: claimedAssignee,
            status: task.status,
          }),
        });

        if (!response.ok) {
          throw new Error(await getResponseErrorMessage(response, "Failed to claim task."));
        }

        const data = (await response.json()) as { task?: Task };
        if (data.task) {
          setDbTasks((currentTasks) => currentTasks.map((currentTask) => (currentTask.id === task.id ? data.task as Task : currentTask)));
          setRenderedTasks((currentTasks) =>
            currentTasks.map((currentTask) => (currentTask.id === task.id ? data.task as Task : currentTask)),
          );
        }
      }

      if (editingTaskId === task.id && taskDraft) {
        setTaskDraft({
          ...taskDraft,
          suggestedAssignee: claimedAssignee,
        });
      }
      await refreshActivity();
    } catch (error) {
      setRenderedTasks(previousTasks);
      setFrameActionError(error instanceof Error ? error.message : "Failed to claim task.");
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

      await refreshActivity();
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

  const handleAddTask = async () => {
    const taskTemplate = createTaskTemplate();
    setIsAddingTask(true);
    setFrameActionError(null);

    try {
      if (isGuest) {
        const timestamp = new Date().toISOString();
        const guestTask: Task = {
          id: `task_${crypto.randomUUID()}`,
          projectId: id,
          title: taskTemplate.title,
          description: taskTemplate.description,
          deadline: taskTemplate.deadline,
          suggestedAssignee: taskTemplate.suggestedAssignee,
          status: taskTemplate.status,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        setRenderedTasks((currentTasks) => [...currentTasks, guestTask]);
        addGuestTask(id, guestTask);
        setEditingTaskId(guestTask.id);
        setTaskDraft({ ...taskTemplate });
        return;
      }

      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: id,
          title: taskTemplate.title,
          description: taskTemplate.description,
          deadline: taskTemplate.deadline,
          suggestedAssignee: taskTemplate.suggestedAssignee,
          status: taskTemplate.status,
        }),
      });

      if (!response.ok) {
        throw new Error(await getResponseErrorMessage(response, "Failed to add task."));
      }

      const data = (await response.json()) as { task?: Task; project?: Project | null };
      if (!data.task) {
        throw new Error("Failed to add task.");
      }

      setDbTasks((currentTasks) => [...currentTasks, data.task as Task]);
      setRenderedTasks((currentTasks) => [...currentTasks, data.task as Task]);
      if (data.project) {
        setDbProject(data.project);
      }
      setEditingTaskId(data.task.id);
      setTaskDraft({ ...taskTemplate });
      await refreshActivity();
    } catch (error) {
      setFrameActionError(error instanceof Error ? error.message : "Failed to add task.");
    } finally {
      setIsAddingTask(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl min-w-0 flex-col gap-6 px-3 py-6 sm:px-4 sm:py-8 md:gap-8 md:px-6 md:py-12">
      <ProjectHeader
        projectName={project.name}
        projectIdea={project.idea}
        isGuest={isGuest}
        isEditingProjectTitle={isEditingProjectTitle}
        isSavingProjectTitle={isSavingProjectTitle}
        projectTitleDraft={projectTitleDraft}
        projectTitleInputRef={projectTitleInputRef}
        onProjectTitleEditStart={handleProjectTitleEditStart}
        onProjectTitleDraftChange={setProjectTitleDraft}
        onProjectTitleBlur={() => {
          if (skipProjectTitleBlurSaveRef.current) {
            skipProjectTitleBlurSaveRef.current = false;
            return;
          }

          void handleProjectTitleSave();
        }}
        onProjectTitleKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            skipProjectTitleBlurSaveRef.current = true;
            void handleProjectTitleSave();
            return;
          }

          if (event.key === "Escape") {
            event.preventDefault();
            skipProjectTitleBlurSaveRef.current = true;
            handleProjectTitleEditCancel();
          }
        }}
      />

      {frameActionError ? <div className="error-msg px-4 py-2 text-sm font-semibold">{frameActionError}</div> : null}

      <ProjectProgressSection progress={projectProgress} health={projectHealth} />

      <ProjectReportSection projectId={project.id} isGuest={isGuest} />

      <GuidelineSection guideline={project.guideline} />

      <section className="app-frame min-w-0 rounded-2xl bg-white/5 p-4 sm:p-5 md:p-6">
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
                  className={`timeline-frame-item app-frame-item app-frame-hover group relative rounded-xl bg-white/5 p-4 transition-all duration-300 ease-in-out ${
                    isEditing ? "ring-1 ring-white/20" : "hover:bg-white/10"
                  }`}
                >
                  <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <span className="text-lg font-medium text-white">{timelineView.phase}</span>
                    <span className="self-start rounded-md bg-white/5 px-2 py-1 font-mono text-xs text-neutral-400">
                      {timelineView.startDate} &rarr; {timelineView.endDate}
                    </span>
                  </div>
                  <div className="flex min-h-7 items-end justify-between gap-3">
                    <p className="min-w-0 flex-1 text-sm text-neutral-400">
                      Deliverable: <span className="text-neutral-300">{timelineView.deliverable}</span>
                    </p>
                    <div className="flex h-7 w-16 shrink-0 items-end justify-end">
                      {!isEditing && timelineEditCooldownIndex !== index ? (
                        <button
                          type="button"
                          onClick={() => handleTimelineEditStart(index)}
                          disabled={isPending}
                          className={frameEditButtonClass}
                        >
                          Edit
                        </button>
                      ) : (
                        <span aria-hidden="true" className="inline-flex h-7 w-full" />
                      )}
                    </div>
                  </div>

                  <div
                    className={`overflow-hidden transition-[max-height,opacity,margin] duration-300 ease-in-out ${
                      isEditing ? "mt-4 max-h-96 opacity-100" : "max-h-0 opacity-0"
                    }`}
                  >
                    <div>
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
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => void handleRemoveTimeline(index)}
                          disabled={isPending}
                          className="app-destructive-button rounded-full px-4 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleSaveTimeline()}
                          disabled={isPending}
                          className="key-button rounded-full px-4 py-2 text-xs font-semibold transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isPending ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-5 flex items-center justify-start">
          <button
            type="button"
            onClick={() => void handleAddTimeline()}
            disabled={isAddingTimeline || pendingTimelineIndex !== null}
            className={framePrimaryActionButtonClass}
          >
            {isAddingTimeline ? "Adding timeline..." : "Add Timeline"}
          </button>
        </div>
      </section>

      <TaskListSection
        visibleTasks={visibleTasks}
        editingTaskId={editingTaskId}
        taskDraft={taskDraft}
        taskStatusFilter={taskStatusFilter}
        taskListMode={taskListMode}
        todoCount={todoCount}
        inProgressCount={inProgressCount}
        doneCount={doneCount}
        taskEditCooldownId={taskEditCooldownId}
        pendingTaskId={pendingTaskId}
        isAddingTask={isAddingTask}
        projectMembers={projectMembers}
        currentUserMember={currentUserMember}
        ownerMember={ownerMember}
        isGuest={isGuest}
        statusCardStyles={statusCardStyles}
        frameEditButtonClass={frameEditButtonClass}
        framePrimaryActionButtonClass={framePrimaryActionButtonClass}
        onTaskEditStart={handleTaskEditStart}
        onTaskDraftChange={handleTaskDraftChange}
        onSaveTask={handleSaveTask}
        onRemoveTask={handleRemoveTask}
        onAddTask={handleAddTask}
        onClaimTask={handleClaimTask}
        onTaskStatusFilterChange={setTaskStatusFilter}
        onTaskListModeChange={setTaskListMode}
        getAssigneeLabel={getAssigneeLabel}
        getMemberLabel={getMemberLabel}
        isTaskAssignedToCurrentUser={isTaskAssignedToCurrentUser}
        onStatusChange={handleStatusChange}
        onStatusSaved={refreshActivity}
      />

      <ActivitySection
        events={isGuest ? [] : dbActivityEvents}
        projectMembers={projectMembers}
        isGuest={isGuest}
      />
    </main>
  );
}
