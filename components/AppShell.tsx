
"use client";

import { useSession, signOut, signIn } from "next-auth/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Bars3Icon, PlusIcon, XMarkIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useGuest } from "@/components/GuestContext";

type Project = {
  id: string;
  name?: string;
  idea: string;
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const { isGuest, exitGuestMode, guestProjects, removeGuestProject } = useGuest();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const pathname = usePathname();

  // Fetch projects for authenticated users
  useEffect(() => {
    if (session) {
      fetchProjects();
    }
  }, [session]);

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    }
  };

  // Combine: use DB projects for authed users, context projects for guests
  const displayProjects: Project[] = isGuest
    ? guestProjects.map((gp) => ({ id: gp.project.id, name: gp.project.name, idea: gp.project.idea }))
    : projects;

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
    <div className="flex h-screen w-full bg-black text-white overflow-hidden">
      {/* Fixed Toggle Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed left-6 top-3 z-60 cursor-pointer rounded-full p-2 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
        aria-label="Toggle Sidebar"
      >
        <Bars3Icon className="h-6 w-6" />
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-neutral-900 transition-transform duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between px-4">
            {/* Spacer for toggle button */}
        </div>

        <nav className="flex flex-col p-4 space-y-2 overflow-y-auto h-[calc(100vh-4rem)]">
          <Link
            href="/"
            onClick={() => setSidebarOpen(false)}
            className={`block rounded-full px-3 py-2 text-sm font-medium hover:bg-white/10 ${
              pathname === "/" ? "bg-white/10 text-white" : "text-neutral-400"
            }`}
          >
            Home
          </Link>
          <Link
            href="/projects/new"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium hover:bg-white/10 ${
              pathname === "/projects/new" ? "bg-white/10 text-white" : "text-neutral-400"
            }`}
          >
            <PlusIcon className="h-4 w-4" />
            New Project
          </Link>

          <div className="pt-4 pb-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            Projects
          </div>
          
          <div className="space-y-1">
            {displayProjects.map((project) => (
              <div key={project.id} className="group flex items-center justify-between rounded-full pr-2 hover:bg-white/10">
                    <Link
                        href={`/projects/${project.id}`}
                        onClick={() => setSidebarOpen(false)}
                        className={`block grow px-3 py-2 text-sm truncate ${
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
            {displayProjects.length === 0 && (
                <p className="px-3 text-xs text-neutral-600">No projects yet.</p>
            )}
          </div>

          {/* Guest mode: offer sign-in link at bottom of sidebar */}
          {isGuest && (
            <div className="mt-auto pt-4 border-t border-white/10">
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
      </aside>

      {/* Main Content Area */}
      <div className={`flex flex-1 flex-col transition-all duration-300 ${sidebarOpen ? "ml-64" : ""}`}>
        {/* Top Navbar */}
        <header className="flex h-16 items-center justify-between bg-black px-4 shadow-sm">
          <div className={`flex items-center gap-4 transition-all duration-300 ${sidebarOpen ? "pl-2" : "pl-16"}`}>
            <span className="text-xl font-semibold tracking-tight">
              <span className="text-white/95">VERSOR</span>
              <span className="ml-0.5 text-neutral-400">.AI</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
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
        <main className="flex-1 overflow-auto bg-black p-6 relative">
            {children}
        </main>
      </div>
    </div>
  );
}
