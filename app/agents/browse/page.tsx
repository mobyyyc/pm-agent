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
  success: "app-notice app-notice-success px-4 py-3",
  error: "app-notice app-notice-danger px-4 py-3",
  info: "app-notice app-notice-info px-4 py-3",
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
      <main className="page-shell items-center justify-center">
        <p className="text-neutral-400">Loading agent catalog...</p>
      </main>
    );
  }

  const isAuthed = !!session?.user?.email;

  return (
    <main className="page-shell">
      <header className="page-header">
        <h1 className="page-title">Browse Agents</h1>
        <p className="page-description">
          Pick an agent template and attach it to a project. Agents can be managed now, with execution still controlled from project-level approvals.
        </p>
      </header>

      {loadError ? (
        <section className="app-notice app-notice-danger px-4 py-3 text-sm font-semibold">{loadError}</section>
      ) : null}

      {isAuthed ? (
        <section className="app-frame app-frame-hover rounded-2xl p-4 transition-all">
          <label className="app-label mb-2 block" htmlFor="project-select">
            Target project
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              id="project-select"
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              className="app-field sm:max-w-md"
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
                className="app-button app-button-ghost"
              >
                Open Project Agents
              </Link>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="app-notice app-notice-warning px-4 py-3 text-sm">
          <p className="mb-3">Sign in to attach agents to your projects.</p>
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/agents/browse" })}
            className="app-button app-button-secondary cursor-pointer"
          >
            Sign in with Google
          </button>
        </section>
      )}

      {feedback ? <p className={`text-sm font-semibold ${feedbackToneClass[feedback.tone]}`}>{feedback.message}</p> : null}

      <section className="grid gap-4 md:grid-cols-2">
        {agents.map((agent) => (
          <article
            key={agent.id}
            className="timeline-frame-item app-frame-item app-frame-hover group relative rounded-xl p-5 transition-all duration-300 ease-in-out"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">{agent.name}</h2>
                <p className="mt-1 text-sm text-neutral-400">{agent.tagline}</p>
              </div>
              <span className="app-badge">{agent.category}</span>
            </div>

            <p className="text-sm leading-relaxed text-neutral-300">{agent.description}</p>

            <p className="mt-3 text-xs font-semibold text-neutral-400">
              Recommended schedule: {getScheduleDisplayLabel(agent.recommendedSchedule)}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {agent.tags.map((tag) => (
                <span key={`${agent.id}-${tag}`} className="app-badge">
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-5">
              <button
                type="button"
                disabled={!isAuthed || !selectedProjectId || isAddingAgentId === agent.id}
                onClick={() => handleAddAgent(agent.id)}
                className="app-button app-button-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
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
