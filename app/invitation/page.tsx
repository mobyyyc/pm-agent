"use client";

import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type InvitationItem = {
  id: string;
  projectId: string;
  projectName: string;
  inviterUserId: string;
  invitedBy: string;
  role: string | null;
  invitedAt: string;
};

type InvitationResponse = {
  invitations?: InvitationItem[];
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

export default function InvitationPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingInvitationId, setPendingInvitationId] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") {
      setInvitations([]);
      setError(null);
      setLoadingInvitations(false);
      return;
    }

    let active = true;

    const loadInvitations = async () => {
      setLoadingInvitations(true);
      setError(null);

      try {
        const response = await fetch("/api/invitations", { cache: "no-store" });
        const body = (await response.json().catch(() => ({}))) as InvitationResponse;

        if (!response.ok) {
          throw new Error(body.error || "Failed to load invitations.");
        }

        if (!active) return;
        setInvitations(Array.isArray(body.invitations) ? body.invitations : []);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load invitations.");
      } finally {
        if (active) {
          setLoadingInvitations(false);
        }
      }
    };

    void loadInvitations();

    return () => {
      active = false;
    };
  }, [status]);

  const respondToInvitation = async (invitationId: string, action: "accept" | "decline") => {
    setActionError(null);
    setPendingInvitationId(invitationId);

    try {
      const response = await fetch(`/api/invitations/${invitationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error || "Failed to update invitation.");
      }

      setInvitations((current) => current.filter((invitation) => invitation.id !== invitationId));
      window.dispatchEvent(new Event("invitations-updated"));

      if (action === "accept") {
        window.dispatchEvent(new Event("projects-updated"));
        router.refresh();
      }
    } catch (actionError) {
      setActionError(actionError instanceof Error ? actionError.message : "Failed to update invitation.");
    } finally {
      setPendingInvitationId(null);
    }
  };

  if (status === "loading") {
    return <div className="mx-auto max-w-5xl p-8 text-neutral-300">Loading invitation...</div>;
  }

  if (!session?.user?.email) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <div className="app-frame rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <h1 className="text-2xl font-semibold text-white">Invitation</h1>
          <p className="mt-3 text-neutral-400">Sign in to view your project invitations.</p>
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/invitation" })}
            className="mt-6 cursor-pointer rounded-full bg-white px-6 py-2 text-sm font-semibold text-black hover:bg-white/90"
          >
            Sign in with Google
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">Invitation</h1>
        <p className="max-w-2xl text-base leading-relaxed text-neutral-400">
          Team invitations will appear here.
        </p>
      </header>

      <section className="app-frame app-frame-hover rounded-2xl border border-white/10 bg-white/5 p-6 transition-colors">
        {actionError ? <p className="mb-3 text-sm text-red-400">{actionError}</p> : null}

        {loadingInvitations ? (
          <p className="text-sm text-neutral-400">Loading invitations...</p>
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : invitations.length === 0 ? (
          <p className="text-sm text-neutral-400">
            No invitation yet. When someone invites you to a group project, it will show up here.
          </p>
        ) : (
          <ul className="space-y-3">
            {invitations.map((invitation) => (
              <li key={invitation.id} className="rounded-xl bg-white/5 p-4">
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-stretch">
                  <div className="flex min-w-0 flex-col gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Inviter</p>
                      <p className="mt-1 text-sm font-semibold text-white">{invitation.invitedBy}</p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void respondToInvitation(invitation.id, "accept")}
                        disabled={pendingInvitationId === invitation.id}
                        className="cursor-pointer min-w-24 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {pendingInvitationId === invitation.id ? "Working..." : "Accept"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void respondToInvitation(invitation.id, "decline")}
                        disabled={pendingInvitationId === invitation.id}
                        className="cursor-pointer min-w-24 rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Decline
                      </button>
                    </div>
                  </div>

                  <div className="min-w-0 border-t border-white/10 pt-3 lg:border-l lg:border-t-0 lg:pt-0 lg:pl-5 lg:flex lg:flex-col lg:justify-center">
                    <p className="text-sm font-semibold text-white">{invitation.projectName}</p>
                    <p className="mt-1 text-xs text-neutral-500">Sent on {formatDate(invitation.invitedAt)}</p>
                    {invitation.role ? <p className="mt-1 text-xs text-neutral-400">Role: {invitation.role}</p> : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
