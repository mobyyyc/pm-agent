
"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Bars3Icon, PlusIcon, XMarkIcon, TrashIcon } from "@heroicons/react/24/outline";

type Project = {
  id: string;
  name?: string;
  idea: string;
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const pathname = usePathname();

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

  const deleteProject = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this project?")) return;

    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== id));
        // Redirect if on that project page? simpler to let user navigate
      }
    } catch (error) {
      console.error("Failed to delete project:", error);
    }
  };

  if (!session) {
    return (
        <div className="flex h-screen items-center justify-center bg-black text-white">
          <div className="text-center">
            <h1 className="mb-8 text-4xl font-semibold tracking-tight">
              <span className="text-white/95">VERSOR</span>
              <span className="ml-0.5 text-neutral-400">.AI</span>
            </h1>
            <p className="mb-8 text-neutral-400">Please sign in to continue</p>
            {/* The actual sign-in is handled by the AuthButton or NextAuth pages, 
                but since we are wrapping everything, maybe we redirect or show a button here. 
                Let's reuse the AuthButton logic but simpler here. */}
                <button
                    onClick={() => window.location.href = "/api/auth/signin"}
                  className="rounded-full bg-white px-6 py-3 text-lg font-semibold text-black shadow-sm hover:bg-neutral-200"
                >
                    Sign in with Google
                </button>
          </div>
        </div>
    );
  }

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
            {projects.map((project) => (
              <div key={project.id} className="group flex items-center justify-between rounded-full pr-2 hover:bg-white/10">
                    <Link
                        href={`/projects/${project.id}`}
                        onClick={() => setSidebarOpen(false)}
                        className={`block grow px-3 py-2 text-sm truncate ${
                        pathname === `/projects/${project.id}` ? "text-white font-medium" : "text-neutral-400"
                        }`}
                        title={project.idea}
                    >
                        {/* Truncate idea to be title-like */}
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
            {projects.length === 0 && (
                <p className="px-3 text-xs text-neutral-600">No projects yet.</p>
            )}
          </div>
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
                <p className="text-white font-medium">{session.user?.name || "User"}</p>
            </div>
            <button
              onClick={() => signOut()}
              className="cursor-pointer rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/20"
            >
              Sign out
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-black p-6 relative">
             {/* Overlay for mobile/sidebar open state if needed, handled by transform mostly */}
            {children}
        </main>
      </div>
    </div>
  );
}
