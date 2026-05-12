"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { useSession } from "next-auth/react";
import { use, useEffect, useState } from "react";

import { useGuest } from "@/components/GuestContext";
import type { Project } from "@/types/models";

type PageProps = {
  params: Promise<{ id: string }>;
};

type ProjectResponse = {
  project?: Project;
  error?: string;
};

type ProjectAgent = {
  projectId: string;
  agentId: string;
  name: string;
  description: string;
  category: string;
  status: "active" | "paused";
  schedule: string | null;
  config: Record<string, unknown>;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

type ProjectAgentsResponse = {
  agents?: ProjectAgent[];
  canManage?: boolean;
  error?: string;
};

export default function ProjectAgentsPage({ params }: PageProps) {
  const { id } = use(params);
  const { data: session, status: sessionStatus } = useSession();
  const { isGuest, getGuestProject } = useGuest();

  const [dbProject, setDbProject] = useState<Project | null>(null);
  const [agents, setAgents] = useState<ProjectAgent[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isSavingAgentId, setIsSavingAgentId] = useState<string | null>(null);
  const [isRemovingAgentId, setIsRemovingAgentId] = useState<string | null>(null);
  const [notFoundState, setNotFoundState] = useState(false);

  const guestProjectBundle = isGuest ? getGuestProject(id) : null;
  const project = isGuest ? guestProjectBundle?.project || null : dbProject;
  const isPageLoading =
    sessionStatus === "loading" || (!isGuest && !!session?.user?.email && !notFoundState && dbProject === null);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (isGuest) return;

    if (session?.user?.email) {
      Promise.all([fetch(`/api/projects/${id}`), fetch(`/api/projects/${id}/agents`, { cache: "no-store" })])
        .then(async ([projectRes, agentsRes]) => {
          if (!projectRes.ok) {
            setNotFoundState(true);
            return;
          }

          const projectBody = (await projectRes.json()) as ProjectResponse;
          if (!projectBody?.project) {
            setNotFoundState(true);
            return;
          }

          setDbProject(projectBody.project);

          const agentsBody = (await agentsRes.json().catch(() => ({}))) as ProjectAgentsResponse;
          if (!agentsRes.ok) {
            setLoadError(agentsBody.error || "Failed to load project agents.");
            return;
          }

          setAgents(Array.isArray(agentsBody.agents) ? agentsBody.agents : []);
          setCanManage(!!agentsBody.canManage);
        })
        .catch(() => setNotFoundState(true));
    }
  }, [id, isGuest, session?.user?.email, sessionStatus]);

  const handleAgentFieldChange = (agentId: string, field: "status" | "schedule", value: string) => {
    setAgents((current) =>
      current.map((agent) => {
        if (agent.agentId !== agentId) {
          return agent;
        }

        if (field === "status") {
          return {
            ...agent,
            status: value as ProjectAgent["status"],
          };
        }

        return {
          ...agent,
          schedule: value,
        };
      }),
    );
  };

  const handleSave = async (agent: ProjectAgent) => {
    setActionError(null);
    setActionSuccess(null);
    setIsSavingAgentId(agent.agentId);

    try {
      const response = await fetch(`/api/projects/${id}/agents/${agent.agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: agent.status,
          schedule: agent.schedule?.trim() ? agent.schedule.trim() : null,
        }),
      });

      const body = (await response.json().catch(() => ({}))) as { agent?: ProjectAgent; error?: string; issues?: string[] };
      if (!response.ok || !body.agent) {
        throw new Error(body.error || (Array.isArray(body.issues) ? body.issues.join(" ") : "Failed to save agent."));
      }

      setAgents((current) => current.map((item) => (item.agentId === body.agent?.agentId ? body.agent : item)));
      setActionSuccess(`${agent.name} updated.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to save agent.");
    } finally {
      setIsSavingAgentId(null);
    }
  };

  const handleRemove = async (agent: ProjectAgent) => {
    setActionError(null);
    setActionSuccess(null);
    setIsRemovingAgentId(agent.agentId);

    try {
      const response = await fetch(`/api/projects/${id}/agents/${agent.agentId}`, {
        method: "DELETE",
      });

      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error || "Failed to remove agent.");
      }

      setAgents((current) => current.filter((item) => item.agentId !== agent.agentId));
      setActionSuccess(`${agent.name} removed from project.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to remove agent.");
    } finally {
      setIsRemovingAgentId(null);
    }
  };

  if (isPageLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-neutral-400">Loading agents...</p>
      </div>
    );
  }

  const isUnauthedUser = !isGuest && !session?.user?.email;
  const isGuestNotFound = isGuest && !guestProjectBundle;

  if (notFoundState || !project || isGuestNotFound || isUnauthedUser) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:py-8 md:gap-8 md:px-6 md:py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">Project Agents</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-neutral-400">
          Manage which agents are attached to this project. Agent automation execution is not enabled yet, but assignment and controls are ready.
        </p>
        <p className="text-xs text-neutral-500">Project: {project.name || project.idea}</p>
      </header>

      {isGuest ? (
        <section className="rounded-2xl border border-amber-400/35 bg-amber-500/10 p-4 text-sm text-amber-100">
          Agent assignment requires a signed-in account. Guest mode project data is temporary.
        </section>
      ) : null}

      {loadError ? <p className="text-sm text-red-300">{loadError}</p> : null}
      {actionError ? <p className="text-sm text-red-300">{actionError}</p> : null}
      {actionSuccess ? <p className="text-sm text-emerald-300">{actionSuccess}</p> : null}

      <section className="outer-frame outer-frame-hover rounded-2xl p-6 transition-all duration-300 ease-in-out">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight text-white">Attached Agents</h2>
          <Link
            href="/agents/browse"
            className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-sm text-neutral-200 transition-colors hover:bg-white/10"
          >
            Browse Agents
          </Link>
        </div>

        {agents.length === 0 ? (
          <p className="text-sm text-neutral-400">No agents attached yet.</p>
        ) : (
          <div className="space-y-4">
            {agents.map((agent) => (
              <article key={agent.agentId} className="inner-frame inner-frame-hover rounded-xl p-4 transition-all duration-300 ease-in-out">
                <div className="mb-2 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-white">{agent.name}</h3>
                    <p className="mt-1 text-sm text-neutral-400">{agent.description}</p>
                  </div>
                  <span className="rounded-full border border-white/15 px-2.5 py-1 text-xs text-neutral-300">{agent.category}</span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm text-neutral-300">
                    Status
                    <select
                      disabled={!canManage}
                      value={agent.status}
                      onChange={(event) => handleAgentFieldChange(agent.agentId, "status", event.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="active">active</option>
                      <option value="paused">paused</option>
                    </select>
                  </label>

                  <label className="text-sm text-neutral-300">
                    Schedule (cron)
                    <input
                      disabled={!canManage}
                      value={agent.schedule || ""}
                      onChange={(event) => handleAgentFieldChange(agent.agentId, "schedule", event.target.value)}
                      placeholder="0 9 * * MON"
                      className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-neutral-500 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={!canManage || isSavingAgentId === agent.agentId}
                    onClick={() => handleSave(agent)}
                    className="key-button cursor-pointer rounded-full px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingAgentId === agent.agentId ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    disabled={!canManage || isRemovingAgentId === agent.agentId}
                    onClick={() => handleRemove(agent)}
                    className="normal-button cursor-pointer rounded-full px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRemovingAgentId === agent.agentId ? "Removing..." : "Remove"}
                  </button>
                  <p className="text-xs text-neutral-500">Added {new Date(agent.createdAt).toLocaleDateString()}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
