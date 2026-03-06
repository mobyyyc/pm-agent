"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Project, Task } from "@/types/models";

type GuestProject = {
  project: Project;
  tasks: Task[];
};

type GuestContextValue = {
  isGuest: boolean;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
  guestProjects: GuestProject[];
  addGuestProject: (project: Project, tasks: Task[]) => void;
  removeGuestProject: (projectId: string) => void;
  getGuestProject: (projectId: string) => GuestProject | undefined;
  updateGuestTaskStatus: (taskId: string, status: string) => void;
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

  const updateGuestTaskStatus = useCallback((taskId: string, status: string) => {
    setGuestProjects((prev) =>
      prev.map((gp) => ({
        ...gp,
        tasks: gp.tasks.map((t) =>
          t.id === taskId ? { ...t, status: status as Task["status"], updatedAt: new Date().toISOString() } : t,
        ),
      })),
    );
  }, []);

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
