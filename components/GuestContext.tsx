"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Project, Task } from "@/types/models";

type GuestProject = {
  project: Project;
  tasks: Task[];
};

type GuestTaskUpdates = Partial<Pick<Task, "title" | "description" | "deadline" | "suggestedAssignee" | "status">>;

type GuestContextValue = {
  isGuest: boolean;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
  guestProjects: GuestProject[];
  addGuestProject: (project: Project, tasks: Task[]) => void;
  removeGuestProject: (projectId: string) => void;
  getGuestProject: (projectId: string) => GuestProject | undefined;
  updateGuestTimelineItem: (projectId: string, timelineIndex: number, timelineItem: Project["timeline"][number]) => void;
  removeGuestTimelineItem: (projectId: string, timelineIndex: number) => void;
  updateGuestTask: (taskId: string, updates: GuestTaskUpdates) => void;
  removeGuestTask: (taskId: string) => void;
  updateGuestTaskStatus: (taskId: string, status: Task["status"]) => void;
};

const GuestContext = createContext<GuestContextValue | null>(null);

export function GuestProvider({ children }: { children: ReactNode }) {
  const [isGuest, setIsGuest] = useState(false);
  const [guestProjects, setGuestProjects] = useState<GuestProject[]>([]);

  const enterGuestMode = useCallback(() => setIsGuest(true), []);

  const exitGuestMode = useCallback(() => {
    setIsGuest(false);
    setGuestProjects([]);
  }, []);

  const addGuestProject = useCallback((project: Project, tasks: Task[]) => {
    setGuestProjects((prev) => [{ project, tasks }, ...prev]);
  }, []);

  const removeGuestProject = useCallback((projectId: string) => {
    setGuestProjects((prev) => prev.filter((gp) => gp.project.id !== projectId));
  }, []);

  const getGuestProject = useCallback(
    (projectId: string) => guestProjects.find((gp) => gp.project.id === projectId),
    [guestProjects],
  );

  const updateGuestTimelineItem = useCallback(
    (projectId: string, timelineIndex: number, timelineItem: Project["timeline"][number]) => {
      const now = new Date().toISOString();

      setGuestProjects((prev) =>
        prev.map((gp) => {
          if (gp.project.id !== projectId) {
            return gp;
          }

          return {
            ...gp,
            project: {
              ...gp.project,
              timeline: gp.project.timeline.map((item, index) => (index === timelineIndex ? timelineItem : item)),
              updatedAt: now,
            },
          };
        }),
      );
    },
    [],
  );

  const removeGuestTimelineItem = useCallback((projectId: string, timelineIndex: number) => {
    const now = new Date().toISOString();

    setGuestProjects((prev) =>
      prev.map((gp) => {
        if (gp.project.id !== projectId) {
          return gp;
        }

        return {
          ...gp,
          project: {
            ...gp.project,
            timeline: gp.project.timeline.filter((_, index) => index !== timelineIndex),
            updatedAt: now,
          },
        };
      }),
    );
  }, []);

  const updateGuestTask = useCallback((taskId: string, updates: GuestTaskUpdates) => {
    const now = new Date().toISOString();

    setGuestProjects((prev) =>
      prev.map((gp) => {
        const hasTask = gp.tasks.some((task) => task.id === taskId);
        if (!hasTask) {
          return gp;
        }

        return {
          ...gp,
          tasks: gp.tasks.map((task) => (task.id === taskId ? { ...task, ...updates, updatedAt: now } : task)),
          project: {
            ...gp.project,
            updatedAt: now,
          },
        };
      }),
    );
  }, []);

  const removeGuestTask = useCallback((taskId: string) => {
    const now = new Date().toISOString();

    setGuestProjects((prev) =>
      prev.map((gp) => {
        const hasTask = gp.tasks.some((task) => task.id === taskId);
        if (!hasTask) {
          return gp;
        }

        return {
          ...gp,
          tasks: gp.tasks.filter((task) => task.id !== taskId),
          project: {
            ...gp.project,
            taskIds: gp.project.taskIds.filter((projectTaskId) => projectTaskId !== taskId),
            updatedAt: now,
          },
        };
      }),
    );
  }, []);

  const updateGuestTaskStatus = useCallback((taskId: string, status: Task["status"]) => {
    updateGuestTask(taskId, { status });
  }, [updateGuestTask]);

  return (
    <GuestContext.Provider
      value={{
        isGuest,
        enterGuestMode,
        exitGuestMode,
        guestProjects,
        addGuestProject,
        removeGuestProject,
        getGuestProject,
        updateGuestTimelineItem,
        removeGuestTimelineItem,
        updateGuestTask,
        removeGuestTask,
        updateGuestTaskStatus,
      }}
    >
      {children}
    </GuestContext.Provider>
  );
}

export function useGuest() {
  const ctx = useContext(GuestContext);
  if (!ctx) throw new Error("useGuest must be used within GuestProvider");
  return ctx;
}
