"use client";

import { use, useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { useSession } from "next-auth/react";

import { useGuest } from "@/components/GuestContext";
import type { Project } from "@/types/models";

type PageProps = {
  params: Promise<{ id: string }>;
};

type MemberItem = {
  userId: string;
  role: string;
  joinedAt: string;
  displayName: string | null;
  imageUrl: string | null;
};

type ProjectResponse = {
  project?: Project;
  members?: MemberItem[];
  error?: string;
};

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ProjectMembersPage({ params }: PageProps) {
  const { id } = use(params);
  const { data: session, status: sessionStatus } = useSession();
  const { isGuest, getGuestProject } = useGuest();

  const [dbProject, setDbProject] = useState<Project | null>(null);
  const [dbMembers, setDbMembers] = useState<MemberItem[]>([]);
  const [notFoundState, setNotFoundState] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [inviteeEmail, setInviteeEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);

  const guestProjectBundle = isGuest ? getGuestProject(id) : null;
  const project = isGuest ? (guestProjectBundle?.project || null) : dbProject;
  const members = isGuest
    ? []
    : dbMembers;
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
            setDbMembers(Array.isArray(data.members) ? data.members : []);
          }
        })
        .catch(() => setNotFoundState(true));
    }
  }, [id, isGuest, session?.user?.email, sessionStatus]);

  const handleOpenInviteModal = () => {
    setInviteeEmail("");
    setInviteError(null);
    setInviteSuccess(null);
    setIsAddMemberModalOpen(true);
  };

  const handleInviteSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextEmail = inviteeEmail.trim().toLowerCase();
    if (!nextEmail) {
      setInviteError("Invitee email is required.");
      return;
    }

    setInviteError(null);
    setInviteSuccess(null);
    setIsInviting(true);

    try {
      const response = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: id,
          inviteeEmail: nextEmail,
        }),
      });

      const body = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(body.error || "Failed to send invitation.");
      }

      setInviteSuccess("Invitation sent.");
      setInviteeEmail("");
      setIsAddMemberModalOpen(false);
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "Failed to send invitation.");
    } finally {
      setIsInviting(false);
    }
  };

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

      <section className="app-frame app-frame-hover rounded-2xl border border-white/10 bg-white/5 p-6 transition-colors">
        <h2 className="mb-3 text-xl font-semibold tracking-tight text-white">Team</h2>
        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-sm text-neutral-300">Member list</p>
            {members.length === 0 ? (
              <p className="mt-1 text-xs text-neutral-500">No members added yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {members.map((member) => (
                  <li
                    key={member.userId}
                    className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-semibold text-white">{member.displayName || member.userId}</p>
                      <p className="text-xs text-neutral-400">{member.userId}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-wide text-neutral-400">{member.role}</p>
                      <p className="mt-0.5 text-xs text-neutral-500">Joined {formatDate(member.joinedAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={handleOpenInviteModal}
            className="cursor-pointer self-start rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20"
          >
            Add Member
          </button>

          {inviteSuccess ? <p className="text-sm text-green-400">{inviteSuccess}</p> : null}
        </div>
      </section>

      {isAddMemberModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-background p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-white">Add Member</h2>
            <p className="mt-3 text-sm text-neutral-400">
              Enter the invitee&apos;s email address to send a project invitation.
            </p>

            <form className="mt-5 space-y-4" onSubmit={handleInviteSubmit}>
              <div>
                <label htmlFor="invitee-email" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Invitee Email
                </label>
                <input
                  id="invitee-email"
                  type="email"
                  value={inviteeEmail}
                  onChange={(event) => setInviteeEmail(event.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-white/40"
                  disabled={isInviting}
                  required
                />
              </div>

              {inviteError ? <p className="text-sm text-red-400">{inviteError}</p> : null}

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddMemberModalOpen(false)}
                  className="cursor-pointer rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-white hover:bg-white/20"
                  disabled={isInviting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cursor-pointer rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isInviting}
                >
                  {isInviting ? "Sending..." : "Send Invitation"}
                </button>
              </div>
            </form>

          </div>
        </div>
      ) : null}
    </main>
  );
}
