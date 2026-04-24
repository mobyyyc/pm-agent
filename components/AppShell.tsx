
"use client";

import { useSession, signOut, signIn } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bars3Icon,
  ChevronLeftIcon,
  PlusIcon,
  Squares2X2Icon,
  UserGroupIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useGuest } from "@/components/GuestContext";
import ThemeToggleButton from "@/components/ThemeToggleButton";

type Project = {
  id: string;
  name?: string;
  idea: string;
};

type ProjectTitleUpdatedDetail = {
  projectId: string;
  name: string;
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const { isGuest, exitGuestMode, guestProjects, removeGuestProject } = useGuest();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarView, setSidebarView] = useState<"main" | "project">("main");
  const [projects, setProjects] = useState<Project[]>([]);
  const [invitationCount, setInvitationCount] = useState(0);
  const [showProjectFadeTop, setShowProjectFadeTop] = useState(false);
  const [showProjectFadeBottom, setShowProjectFadeBottom] = useState(false);
  const pathname = usePathname();
  const projectScrollRef = useRef<HTMLDivElement>(null);
  const previousPathnameRef = useRef(pathname);
  const isDesktopViewport = () => window.matchMedia("(min-width: 1024px)").matches;

  const fetchUserProjects = useCallback(() => {
    if (!session?.user?.email) return;

    fetch("/api/projects")
      .then((res) => (res.ok ? res.json() : { projects: [] }))
      .then((data: { projects: Project[] }) => {
        setProjects(data.projects || []);
      })
      .catch((error) => {
        console.error("Failed to fetch projects:", error);
      });
  }, [session?.user?.email]);

  const fetchInvitationCount = useCallback(() => {
    if (!session?.user?.email) {
      setInvitationCount(0);
      return;
    }

    fetch("/api/invitations")
      .then((res) => (res.ok ? res.json() : { invitations: [] }))
      .then((data: { invitations?: Array<{ id: string }> }) => {
        setInvitationCount(Array.isArray(data.invitations) ? data.invitations.length : 0);
      })
      .catch((error) => {
        console.error("Failed to fetch invitations:", error);
      });
  }, [session?.user?.email]);

  useEffect(() => {
    fetchUserProjects();
  }, [fetchUserProjects]);

  useEffect(() => {
    const syncId = window.setTimeout(() => {
      fetchInvitationCount();
    }, 0);

    return () => {
      window.clearTimeout(syncId);
    };
  }, [fetchInvitationCount]);

  useEffect(() => {
    const handleProjectTitleUpdated = (event: Event) => {
      const { detail } = event as CustomEvent<ProjectTitleUpdatedDetail>;
      if (!detail?.projectId) return;

      setProjects((currentProjects) =>
        currentProjects.map((project) =>
          project.id === detail.projectId
            ? {
                ...project,
                name: detail.name,
              }
            : project,
        ),
      );
    };

    const handleProjectsUpdated = () => {
      fetchUserProjects();
    };

    const handleInvitationsUpdated = () => {
      fetchInvitationCount();
    };

    window.addEventListener("project-title-updated", handleProjectTitleUpdated);
    window.addEventListener("projects-updated", handleProjectsUpdated);
    window.addEventListener("invitations-updated", handleInvitationsUpdated);
    return () => {
      window.removeEventListener("project-title-updated", handleProjectTitleUpdated);
      window.removeEventListener("projects-updated", handleProjectsUpdated);
      window.removeEventListener("invitations-updated", handleInvitationsUpdated);
    };
  }, [fetchUserProjects, fetchInvitationCount]);

  // Combine: use DB projects for authed users, context projects for guests
  const displayProjects: Project[] = isGuest
    ? guestProjects.map((gp) => ({ id: gp.project.id, name: gp.project.name, idea: gp.project.idea }))
    : projects;
  const projectRouteMatch = pathname.match(/^\/projects\/([^/]+)(?:\/.*)?$/);
  const routeProjectId = projectRouteMatch?.[1] ?? null;
  const selectedProjectId = routeProjectId === "new" ? null : routeProjectId;
  const isProjectRoute = !!selectedProjectId;
  const isProjectSidebar = sidebarView === "project" && isProjectRoute;
  const selectedProject = selectedProjectId
    ? displayProjects.find((project) => project.id === selectedProjectId)
    : null;
  const isMembersTab = !!selectedProjectId && pathname.startsWith(`/projects/${selectedProjectId}/members`);
  const isDashboardTab =
    !!selectedProjectId &&
    (pathname === `/projects/${selectedProjectId}` ||
      (!isMembersTab && pathname.startsWith(`/projects/${selectedProjectId}/`)));

  useEffect(() => {
    const nextView = isProjectRoute ? "project" : "main";
    const syncId = window.setTimeout(() => {
      setSidebarView(nextView);
    }, 0);

    return () => {
      window.clearTimeout(syncId);
    };
  }, [isProjectRoute]);

  const updateProjectScrollFades = useCallback(() => {
    const scrollArea = projectScrollRef.current;
    if (!scrollArea) return;

    const hasOverflow = scrollArea.scrollHeight - scrollArea.clientHeight > 1;
    if (!hasOverflow) {
      setShowProjectFadeTop(false);
      setShowProjectFadeBottom(false);
      return;
    }

    const nextShowTop = scrollArea.scrollTop > 1;
    const nextShowBottom = scrollArea.scrollTop + scrollArea.clientHeight < scrollArea.scrollHeight - 1;

    setShowProjectFadeTop((prev) => (prev === nextShowTop ? prev : nextShowTop));
    setShowProjectFadeBottom((prev) => (prev === nextShowBottom ? prev : nextShowBottom));
  }, []);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      updateProjectScrollFades();
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [displayProjects.length, sidebarOpen, isProjectSidebar, updateProjectScrollFades]);

  useEffect(() => {
    const handleResize = () => {
      updateProjectScrollFades();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [updateProjectScrollFades]);

  useEffect(() => {
    if (!sidebarOpen || isDesktopViewport()) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [sidebarOpen]);

  useEffect(() => {
    if (!sidebarOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [sidebarOpen]);

  useEffect(() => {
    const didRouteChange = previousPathnameRef.current !== pathname;
    previousPathnameRef.current = pathname;
    if (!(didRouteChange && sidebarOpen && !isDesktopViewport())) return;

    const closeSidebarSyncId = window.setTimeout(() => {
      setSidebarOpen(false);
    }, 0);

    return () => {
      window.clearTimeout(closeSidebarSyncId);
    };
  }, [pathname, sidebarOpen]);

  const deleteProject = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this project?")) return;

    if (isGuest) {
      removeGuestProject(id);
      if (pathname === `/projects/${id}`) {
        router.push("/");
      }
      return;
    }

    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete project:", error);
    }
  };

  const handleSignOut = () => {
    if (isGuest) {
      exitGuestMode();
      router.push("/");
    } else {
      signOut({ callbackUrl: "/" });
    }
  };

  const displayName = isGuest ? "Guest" : session?.user?.name || "User";

  return (
    <div className="flex min-h-screen w-full bg-black text-white overflow-x-clip">
      {/* Fixed Toggle Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed left-3 top-3 z-[70] cursor-pointer rounded-full p-2 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white lg:left-6"
        aria-label="Toggle Sidebar"
      >
        <Bars3Icon className="h-6 w-6" />
      </button>

      <button
        type="button"
        aria-label="Close sidebar overlay"
        onClick={() => setSidebarOpen(false)}
        className={`fixed inset-0 z-[45] bg-black/45 transition-opacity duration-300 lg:hidden ${
          sidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-[50] w-72 max-w-[85vw] transform bg-neutral-900 transition-transform duration-300 ease-in-out lg:w-64 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={() => setSidebarView("main")}
          className={`absolute left-14 top-3 z-10 rounded-full p-2 text-neutral-400 transition-all duration-300 lg:left-16 ${
            isProjectSidebar
              ? "cursor-pointer translate-x-0 opacity-100 hover:bg-white/10 hover:text-white"
              : "pointer-events-none -translate-x-1 opacity-0"
          }`}
          aria-label="Back to main sidebar"
        >
          <ChevronLeftIcon className="h-6 w-6" />
        </button>

        <div className="flex h-16 items-center justify-between px-4">
          <div />
        </div>

        <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
          <div className="relative flex-1 overflow-hidden">
          <nav
            className={`absolute inset-0 flex flex-col p-4 transition-all duration-300 ease-in-out ${
              isProjectSidebar ? "-translate-x-full opacity-0" : "translate-x-0 opacity-100"
            }`}
          >
            <div className="space-y-1">
              <Link
                href="/"
                className={`block rounded-full px-3 py-2 text-sm font-medium hover:bg-white/10 ${
                  pathname === "/" ? "bg-white/10 text-white" : "text-neutral-400"
                }`}
              >
                Home
              </Link>
              <Link
                href="/projects/new"
                className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium hover:bg-white/10 ${
                  pathname === "/projects/new" ? "bg-white/10 text-white" : "text-neutral-400"
                }`}
              >
                <PlusIcon className="h-4 w-4" />
                New Project
              </Link>
            </div>

            <div className="my-4 border-t border-white/10" />
            <div className="pb-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Projects
            </div>

            <div className="relative min-h-0 flex-1">
              <div ref={projectScrollRef} onScroll={updateProjectScrollFades} className="project-scroll-area h-full overflow-y-auto">
                <div className="space-y-1 pr-1">
                  {displayProjects.map((project) => (
                    <div key={project.id} className="group flex items-center justify-between rounded-full pr-2 hover:bg-white/10">
                      <Link
                        href={`/projects/${project.id}`}
                        onClick={() => setSidebarView("project")}
                        className={`block grow py-2 pr-3 pl-[0.95rem] text-sm truncate ${
                          pathname === `/projects/${project.id}` ? "text-white font-medium" : "text-neutral-400"
                        }`}
                        title={project.idea}
                      >
                        {project.name || (project.idea.length > 25 ? project.idea.substring(0, 25) + "..." : project.idea)}
                      </Link>
                      <button
                        onClick={(e) => deleteProject(e, project.id)}
                        className="cursor-pointer rounded-full p-1 opacity-0 text-neutral-500 transition-all group-hover:opacity-100 hover:bg-white/10 hover:text-white"
                        title="Delete Project"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {displayProjects.length === 0 && <p className="px-3 text-xs text-neutral-600">No projects yet.</p>}
                </div>
              </div>
              <div
                aria-hidden="true"
                className={`project-scroll-fade-top ${showProjectFadeTop ? "opacity-100" : "opacity-0"}`}
              />
              <div
                aria-hidden="true"
                className={`project-scroll-fade-bottom ${showProjectFadeBottom ? "opacity-100" : "opacity-0"}`}
              />
            </div>

            {isGuest && (
              <div className="pt-2">
                <p className="px-3 text-xs text-neutral-500 mb-2">Guest projects are temporary.</p>
                <button
                  onClick={() => signIn("google", { callbackUrl: "/" })}
                  className="w-full rounded-full bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20 transition-all cursor-pointer"
                >
                  Sign in to save projects
                </button>
              </div>
            )}
          </nav>

          <nav
            className={`absolute inset-0 flex flex-col p-4 overflow-y-auto transition-all duration-300 ease-in-out ${
              isProjectSidebar ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
            }`}
          >
            <div className="mb-6 px-2">
              <p className="text-xs uppercase tracking-wider text-neutral-500">Project</p>
              <p className="mt-2 truncate text-sm font-medium text-white">
                {selectedProject?.name || selectedProject?.idea || "Project"}
              </p>
            </div>

            {selectedProjectId && (
              <div className="space-y-2">
                <Link
                  href={`/projects/${selectedProjectId}`}
                  className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors hover:bg-white/10 ${
                    isDashboardTab ? "bg-white/10 text-white" : "text-neutral-400"
                  }`}
                >
                  <Squares2X2Icon className="h-4 w-4" />
                  Dashboard
                </Link>
                <Link
                  href={`/projects/${selectedProjectId}/members`}
                  className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors hover:bg-white/10 ${
                    isMembersTab ? "bg-white/10 text-white" : "text-neutral-400"
                  }`}
                >
                  <UserGroupIcon className="h-4 w-4" />
                  Members
                </Link>
              </div>
            )}
          </nav>
          </div>

          <div className="px-4 pb-4">
            <div className="my-4 border-t border-white/10" />
            <div className="space-y-1">
              <div className="space-y-1 lg:hidden">
                <div className="flex items-center justify-between gap-3 px-0.5 py-1">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{displayName}</p>
                    {isGuest ? <p className="text-xs text-neutral-500">Temporary session</p> : null}
                  </div>
                  {session?.user?.image ? (
                    <Image
                      src={session.user.image}
                      alt={`${displayName} avatar`}
                      width={30}
                      height={30}
                      className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-white/15"
                    />
                  ) : (
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white/90 ring-1 ring-white/15">
                      {displayName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full cursor-pointer rounded-full bg-white/10 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20"
                >
                  {isGuest ? "Exit" : "Sign out"}
                </button>
                <div className="my-4 border-t border-white/10" />
              </div>
              <Link
                href="/invitation"
                className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm hover:bg-white/10 ${
                  pathname.startsWith("/invitation") ? "bg-white/10 text-white" : "text-neutral-400"
                }`}
              >
                <span>Invitation</span>
                {invitationCount > 0 ? (
                  <span className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-[11px] font-semibold leading-none text-neutral-200">
                    {invitationCount}
                  </span>
                ) : (
                  <span className="ml-auto" />
                )}
              </Link>
              <Link
                href="/settings"
                className={`block rounded-full px-3 py-2 text-sm hover:bg-white/10 ${
                  pathname.startsWith("/settings") ? "bg-white/10 text-white" : "text-neutral-400"
                }`}
              >
                Settings
              </Link>
            </div>

            <div className="my-4 border-t border-white/10" />
            <div className="pb-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Legal
            </div>
            <div className="space-y-1">
                <Link
                  href="/privacy"
                  className={`block rounded-full px-3 py-2 text-sm hover:bg-white/10 ${
                    pathname === "/privacy" ? "bg-white/10 text-white" : "text-neutral-400"
                  }`}
                >
                  Privacy Policy
                </Link>
                <Link
                  href="/cookies"
                  className={`block rounded-full px-3 py-2 text-sm hover:bg-white/10 ${
                    pathname === "/cookies" ? "bg-white/10 text-white" : "text-neutral-400"
                  }`}
                >
                  Cookie Policy
                </Link>
                <Link
                  href="/terms"
                  className={`block rounded-full px-3 py-2 text-sm hover:bg-white/10 ${
                    pathname === "/terms" ? "bg-white/10 text-white" : "text-neutral-400"
                  }`}
                >
                  Terms
                </Link>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`flex flex-1 flex-col transition-all duration-300 ${sidebarOpen ? "lg:ml-64" : ""}`}>
        {/* Top Navbar */}
        <header className="flex h-16 items-center justify-between bg-black px-3 shadow-sm sm:px-4">
          <div className={`flex min-w-0 items-center transition-all duration-300 ${sidebarOpen ? "pl-11 lg:pl-2" : "pl-11 lg:pl-16"}`}>
            <span className="truncate text-xl font-semibold tracking-tight">
              <span className="text-white/95">VERSOR</span>
              <span className="ml-0.5 text-neutral-400">.AI</span>
            </span>
          </div>

          <div className="mr-1 lg:hidden">
            <ThemeToggleButton className="!border-0 !bg-transparent !px-0 hover:!bg-transparent" />
          </div>

          <div className="hidden items-center gap-4 lg:flex">
            <ThemeToggleButton />
            <div className="text-sm text-right">
                <p className="text-white font-medium">{displayName}</p>
                {isGuest && <p className="text-xs text-neutral-500">Temporary session</p>}
            </div>
            <button
              onClick={handleSignOut}
              className="cursor-pointer rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/20"
            >
              {isGuest ? "Exit" : "Sign out"}
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="relative flex-1 overflow-auto bg-black p-3 sm:p-4 md:p-6">
            {children}
        </main>
      </div>
    </div>
  );
}
