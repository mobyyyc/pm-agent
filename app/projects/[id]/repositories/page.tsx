"use client";

import { use, useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { useSession } from "next-auth/react";

import { useGuest } from "@/components/GuestContext";
import type { Project } from "@/types/models";

type PageProps = {
  params: Promise<{ id: string }>;
};

type ProjectResponse = {
  project?: Project;
};

export default function ProjectRepositoriesPage({ params }: PageProps) {
  const { id } = use(params);
  const { data: session, status: sessionStatus } = useSession();
  const { isGuest, getGuestProject } = useGuest();

  const [dbProject, setDbProject] = useState<Project | null>(null);
  const [notFoundState, setNotFoundState] = useState(false);

  const guestProjectBundle = isGuest ? getGuestProject(id) : null;
  const project = isGuest ? (guestProjectBundle?.project || null) : dbProject;

  const isPageLoading =
    sessionStatus === "loading" ||
    (!isGuest && !!session?.user?.email && !notFoundState && dbProject === null);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (isGuest) return;

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
          if (data?.project) {
            setDbProject(data.project);
          }
        })
        .catch(() => setNotFoundState(true));
    }
  }, [id, isGuest, session?.user?.email, sessionStatus]);

  if (isPageLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-neutral-400">Loading repositories...</p>
      </div>
    );
  }

  const isUnauthedUser = !isGuest && !session?.user?.email;
  const isGuestNotFound = isGuest && !guestProjectBundle;

  if (notFoundState || !project || isGuestNotFound || isUnauthedUser) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-3 py-6 sm:px-4 sm:py-8 md:gap-8 md:px-6 md:py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">Repositories</h1>
        <p className="max-w-2xl text-base leading-relaxed text-neutral-400">
          Connect or create a repository for this project.
        </p>
        <p className="text-sm text-neutral-500">Project: {project.name || project.idea}</p>
      </header>

      <section className="app-frame app-frame-hover rounded-2xl border border-white/10 bg-white/5 p-6 transition-colors">
        <h2 className="mb-3 text-xl font-semibold tracking-tight text-white">Create Repository</h2>
        <p className="text-sm text-neutral-400">
          Repository setup is coming soon. You will be able to create or link a remote repository from this page.
        </p>
        <button
          type="button"
          disabled
          className="mt-5 cursor-not-allowed rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-neutral-400"
        >
          Create Repository (Coming Soon)
        </button>
      </section>
    </main>
  );
}
