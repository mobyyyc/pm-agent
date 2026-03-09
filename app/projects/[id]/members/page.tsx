"use client";

import { use, useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { useSession } from "next-auth/react";

import { useGuest } from "@/components/GuestContext";
import type { Project } from "@/types/models";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function ProjectMembersPage({ params }: PageProps) {
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
        .then((res) => {
          if (!res.ok) {
            setNotFoundState(true);
            return null;
          }
          return res.json();
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
        <p className="text-neutral-400">Loading members...</p>
      </div>
    );
  }

  const isUnauthedUser = !isGuest && !session?.user?.email;
  const isGuestNotFound = isGuest && !guestProjectBundle;

  if (notFoundState || !project || isGuestNotFound || isUnauthedUser) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">Members</h1>
        <p className="text-base text-neutral-400 max-w-2xl leading-relaxed">
          Manage who can access this project.
        </p>
        <p className="text-sm text-neutral-500">Project: {project.name || project.idea}</p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-3 text-xl font-semibold tracking-tight text-white">Team</h2>
        <p className="text-sm text-neutral-400">
          Member management UI will appear here. Next step is adding invitations and accepting them.
        </p>
      </section>
    </main>
  );
}
