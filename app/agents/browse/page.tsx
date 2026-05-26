"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";

import { getScheduleDisplayLabel } from "@/lib/agent-runs/schedule-config";

type AgentDefinition = {
  id: string;
  name: string;
  tagline: string;
  category: string;
  description: string;
  recommendedSchedule: string | null;
  tags: string[];
};

type ProjectItem = {
  id: string;
  name?: string;
  idea: string;
};

type Feedback = {
  message: string;
  tone: "success" | "error" | "info";
};

const feedbackToneClass: Record<Feedback["tone"], string> = {
  success: "text-success",
  error: "text-red-300",
  info: "text-amber-200",
};

export default function BrowseAgentsPage() {
  const { data: session, status: sessionStatus } = useSession();

  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingAgentId, setIsAddingAgentId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);

        const agentsRes = await fetch("/api/agents", { cache: "no-store" });
        const agentsBody = (await agentsRes.json().catch(() => ({}))) as { agents?: AgentDefinition[]; error?: string };

        if (!agentsRes.ok) {
          throw new Error(agentsBody.error || "Failed to load agents.");
        }

        setAgents(Array.isArray(agentsBody.agents) ? agentsBody.agents : []);

        if (session?.user?.email) {
          const projectsRes = await fetch("/api/projects", { cache: "no-store" });
          const projectsBody = (await projectsRes.json().catch(() => ({}))) as {
            projects?: ProjectItem[];
            error?: string;
          };

          if (!projectsRes.ok) {
            throw new Error(projectsBody.error || "Failed to load projects.");
          }

          const nextProjects = Array.isArray(projectsBody.projects) ? projectsBody.projects : [];
          setProjects(nextProjects);
          if (nextProjects.length > 0) {
            setSelectedProjectId(nextProjects[0].id);
          }
        }
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Failed to load agent catalog.");
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [session?.user?.email]);

  const handleAddAgent = async (agentId: string) => {
    if (!selectedProjectId) {
      setFeedback({ message: "Select a project first.", tone: "info" });
      return;
    }

    setFeedback(null);
    setIsAddingAgentId(agentId);

    try {
      const response = await fetch(`/api/projects/${selectedProjectId}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });

      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        issues?: string[];
      };

      if (!response.ok) {
        throw new Error(body.error || (Array.isArray(body.issues) ? body.issues.join(" ") : "Failed to add agent."));
      }

      setFeedback({ message: "Agent added or updated on your project.", tone: "success" });
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : "Failed to add agent.", tone: "error" });
    } finally {
      setIsAddingAgentId(null);
    }
  };

  if (isLoading || sessionStatus === "loading") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-8">
        <p className="text-neutral-400">Loading agent catalog...</p>
      </main>
    );
  }

  const isAuthed = !!session?.user?.email;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:py-8 md:px-6 md:py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">Browse Agents</h1>
        <p className="max-w-3xl text-sm text-neutral-400">
          Pick an agent template and attach it to a project. This is a foundation layer, so agents can be managed now and automated behavior can be added later.
        </p>
      </header>

      {loadError ? (
        <section className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{loadError}</section>
      ) : null}

      {isAuthed ? (
        <section className="app-frame app-frame-hover rounded-2xl bg-white/5 p-4 transition-all hover:bg-white/10">
          <label className="mb-2 block text-sm font-medium text-neutral-200" htmlFor="project-select">
            Target project
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              id="project-select"
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white focus:border-white/35 focus:outline-hidden sm:max-w-md"
            >
              {projects.length === 0 ? <option value="">No projects found</option> : null}
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name || project.idea}
                </option>
              ))}
            </select>
            {selectedProjectId ? (
              <Link
                href={`/projects/${selectedProjectId}/agents`}
                className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-sm text-neutral-200 transition-colors hover:bg-white/10"
              >
                Open Project Agents
              </Link>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-amber-400/35 bg-amber-500/10 p-4 text-sm text-amber-100">
          <p className="mb-3">Sign in to attach agents to your projects.</p>
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/agents/browse" })}
            className="normal-button cursor-pointer rounded-full px-4 py-2 text-sm"
          >
            Sign in with Google
          </button>
        </section>
      )}

      {feedback ? <p className={`text-sm ${feedbackToneClass[feedback.tone]}`}>{feedback.message}</p> : null}

      <section className="grid gap-4 md:grid-cols-2">
        {agents.map((agent) => (
          <article
            key={agent.id}
            className="timeline-frame-item app-frame-item app-frame-hover group relative rounded-xl bg-white/5 p-4 transition-all duration-300 ease-in-out hover:bg-white/10"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">{agent.name}</h2>
                <p className="mt-1 text-sm text-neutral-400">{agent.tagline}</p>
              </div>
              <span className="rounded-full border border-white/15 px-2.5 py-1 text-xs text-neutral-300">{agent.category}</span>
            </div>

            <p className="text-sm leading-relaxed text-neutral-300">{agent.description}</p>

            <p className="mt-3 text-xs text-neutral-400">
              Recommended schedule: {getScheduleDisplayLabel(agent.recommendedSchedule)}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {agent.tags.map((tag) => (
                <span key={`${agent.id}-${tag}`} className="rounded-full bg-white/8 px-2 py-1 text-xs text-neutral-300">
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-5">
              <button
                type="button"
                disabled={!isAuthed || !selectedProjectId || isAddingAgentId === agent.id}
                onClick={() => handleAddAgent(agent.id)}
                className="key-button cursor-pointer rounded-full px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isAddingAgentId === agent.id ? "Adding..." : "Add to Project"}
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
