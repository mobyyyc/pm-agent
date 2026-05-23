"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { useSession } from "next-auth/react";
import { use, useCallback, useEffect, useState } from "react";

import { useGuest } from "@/components/GuestContext";
import type {
  Project,
  ProjectAgent,
  ProjectAgentActionProposal,
  ProjectAgentRun,
  ProjectMember,
  Task,
} from "@/types/models";

type PageProps = {
  params: Promise<{ id: string }>;
};

type ProjectResponse = {
  project?: Project;
  tasks?: Task[];
  members?: ProjectMember[];
  error?: string;
};

type ProjectAgentsResponse = {
  agents?: ProjectAgent[];
  canManage?: boolean;
  error?: string;
};

type AgentActionsResponse = {
  pendingProposals?: ProjectAgentActionProposal[];
  recentProposals?: ProjectAgentActionProposal[];
  runs?: ProjectAgentRun[];
  canManage?: boolean;
  error?: string;
};

type ApproveProposalResponse = {
  proposal?: ProjectAgentActionProposal;
  task?: Task | null;
  execution?: {
    success: boolean;
    errorMessage: string | null;
  };
  error?: string;
  detail?: string;
  issues?: string[];
};

type RejectProposalResponse = {
  proposal?: ProjectAgentActionProposal;
  error?: string;
  detail?: string;
  issues?: string[];
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function getProposalTaskId(proposal: ProjectAgentActionProposal): string | null {
  return typeof proposal.payload.taskId === "string" ? proposal.payload.taskId : null;
}

export default function ProjectAgentsPage({ params }: PageProps) {
  const { id } = use(params);
  const { data: session, status: sessionStatus } = useSession();
  const { isGuest, getGuestProject } = useGuest();

  const [dbProject, setDbProject] = useState<Project | null>(null);
  const [dbTasks, setDbTasks] = useState<Task[]>([]);
  const [dbMembers, setDbMembers] = useState<ProjectMember[]>([]);
  const [agents, setAgents] = useState<ProjectAgent[]>([]);
  const [pendingProposals, setPendingProposals] = useState<ProjectAgentActionProposal[]>([]);
  const [recentProposals, setRecentProposals] = useState<ProjectAgentActionProposal[]>([]);
  const [recentRuns, setRecentRuns] = useState<ProjectAgentRun[]>([]);
  const [proposalAssignees, setProposalAssignees] = useState<Record<string, string>>({});
  const [proposalStatuses, setProposalStatuses] = useState<Record<string, Task["status"]>>({});
  const [canManage, setCanManage] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isSavingAgentId, setIsSavingAgentId] = useState<string | null>(null);
  const [isRemovingAgentId, setIsRemovingAgentId] = useState<string | null>(null);
  const [isRunningRiskWatch, setIsRunningRiskWatch] = useState(false);
  const [isRunningGithubTaskReview, setIsRunningGithubTaskReview] = useState(false);
  const [reviewingProposalId, setReviewingProposalId] = useState<string | null>(null);
  const [notFoundState, setNotFoundState] = useState(false);

  const guestProjectBundle = isGuest ? getGuestProject(id) : null;
  const project = isGuest ? guestProjectBundle?.project || null : dbProject;
  const isPageLoading =
    sessionStatus === "loading" || (!isGuest && !!session?.user?.email && !notFoundState && dbProject === null);

  const refreshAgentActions = useCallback(async () => {
    if (isGuest || !session?.user?.email) return;

    const response = await fetch(`/api/projects/${id}/agent-actions`, { cache: "no-store" });
    const body = (await response.json().catch(() => ({}))) as AgentActionsResponse;
    if (!response.ok) {
      setLoadError(body.error || "Failed to load agent action proposals.");
      return;
    }

    setPendingProposals(Array.isArray(body.pendingProposals) ? body.pendingProposals : []);
    setRecentProposals(Array.isArray(body.recentProposals) ? body.recentProposals : []);
    setRecentRuns(Array.isArray(body.runs) ? body.runs : []);
    setCanManage((current) => current || !!body.canManage);
  }, [id, isGuest, session?.user?.email]);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (isGuest) return;

    if (session?.user?.email) {
      Promise.all([
        fetch(`/api/projects/${id}`),
        fetch(`/api/projects/${id}/agents`, { cache: "no-store" }),
        fetch(`/api/projects/${id}/agent-actions`, { cache: "no-store" }),
      ])
        .then(async ([projectRes, agentsRes, agentActionsRes]) => {
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
          setDbTasks(Array.isArray(projectBody.tasks) ? projectBody.tasks : []);
          setDbMembers(Array.isArray(projectBody.members) ? projectBody.members : []);

          const agentsBody = (await agentsRes.json().catch(() => ({}))) as ProjectAgentsResponse;
          if (!agentsRes.ok) {
            setLoadError(agentsBody.error || "Failed to load project agents.");
            return;
          }

          setAgents(Array.isArray(agentsBody.agents) ? agentsBody.agents : []);
          setCanManage(!!agentsBody.canManage);

          const actionsBody = (await agentActionsRes.json().catch(() => ({}))) as AgentActionsResponse;
          if (!agentActionsRes.ok) {
            setLoadError(actionsBody.error || "Failed to load agent action proposals.");
            return;
          }

          setPendingProposals(Array.isArray(actionsBody.pendingProposals) ? actionsBody.pendingProposals : []);
          setRecentProposals(Array.isArray(actionsBody.recentProposals) ? actionsBody.recentProposals : []);
          setRecentRuns(Array.isArray(actionsBody.runs) ? actionsBody.runs : []);
          setCanManage(!!agentsBody.canManage || !!actionsBody.canManage);
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

  const getMemberLabel = (member: ProjectMember) => member.displayName?.trim() || member.userId;
  const findTask = (taskId: string | null) => dbTasks.find((task) => task.id === taskId) || null;
  const getSelectedAssignee = (proposal: ProjectAgentActionProposal) => {
    const payloadAssignee = typeof proposal.payload.assigneeMemberId === "string" ? proposal.payload.assigneeMemberId : "";
    return proposalAssignees[proposal.id] || payloadAssignee;
  };
  const getSelectedStatus = (proposal: ProjectAgentActionProposal) => {
    const suggestedStatus =
      proposal.payload.suggestedStatus === "todo" ||
      proposal.payload.suggestedStatus === "in_progress" ||
      proposal.payload.suggestedStatus === "done"
        ? proposal.payload.suggestedStatus
        : "in_progress";
    return proposalStatuses[proposal.id] || suggestedStatus;
  };

  const handleRunRiskWatch = async () => {
    if (isRunningRiskWatch) return;

    setActionError(null);
    setActionSuccess(null);
    setIsRunningRiskWatch(true);

    try {
      const response = await fetch(`/api/projects/${id}/agent-runs/risk-watch`, { method: "POST" });
      const body = (await response.json().catch(() => ({}))) as {
        createdProposalCount?: number;
        skippedProposalCount?: number;
        error?: string;
        detail?: string;
      };
      if (!response.ok) {
        throw new Error(body.detail || body.error || "Failed to run Risk Watch.");
      }

      setActionSuccess(
        `Risk Watch created ${body.createdProposalCount ?? 0} proposal${
          body.createdProposalCount === 1 ? "" : "s"
        }. ${body.skippedProposalCount ?? 0} duplicate${body.skippedProposalCount === 1 ? "" : "s"} skipped.`,
      );
      await refreshAgentActions();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to run Risk Watch.");
    } finally {
      setIsRunningRiskWatch(false);
    }
  };

  const handleRunGithubTaskReview = async () => {
    if (isRunningGithubTaskReview) return;

    setActionError(null);
    setActionSuccess(null);
    setIsRunningGithubTaskReview(true);

    try {
      const response = await fetch(`/api/projects/${id}/agent-runs/github-task-review`, { method: "POST" });
      const body = (await response.json().catch(() => ({}))) as {
        createdProposalCount?: number;
        skippedProposalCount?: number;
        error?: string;
        detail?: string;
      };
      if (!response.ok) {
        throw new Error(body.detail || body.error || "Failed to run GitHub Task Review.");
      }

      setActionSuccess(
        `GitHub Task Review created ${body.createdProposalCount ?? 0} proposal${
          body.createdProposalCount === 1 ? "" : "s"
        }. ${body.skippedProposalCount ?? 0} duplicate${body.skippedProposalCount === 1 ? "" : "s"} skipped.`,
      );
      await refreshAgentActions();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to run GitHub Task Review.");
    } finally {
      setIsRunningGithubTaskReview(false);
    }
  };

  const handleApproveProposal = async (proposal: ProjectAgentActionProposal) => {
    const isAssignment = proposal.proposedActionType === "assign_task_owner";
    const assigneeMemberId = getSelectedAssignee(proposal);
    if (isAssignment && !assigneeMemberId) {
      setActionError("Choose a project member before approving this action.");
      return;
    }
    const payload =
      proposal.proposedActionType === "suggest_task_progress_update"
        ? { suggestedStatus: getSelectedStatus(proposal) }
        : { assigneeMemberId };

    setActionError(null);
    setActionSuccess(null);
    setReviewingProposalId(proposal.id);

    try {
      const response = await fetch(`/api/projects/${id}/agent-actions/${proposal.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as ApproveProposalResponse;
      if (!response.ok || !body.proposal) {
        throw new Error(
          body.detail || body.error || (Array.isArray(body.issues) ? body.issues.join(" ") : "Failed to approve proposal."),
        );
      }

      if (body.task) {
        setDbTasks((currentTasks) =>
          currentTasks.map((task) => (task.id === body.task?.id ? body.task : task)),
        );
      }

      if (body.execution?.success === false) {
        setActionError(body.execution.errorMessage || "Agent action was approved but execution failed.");
      } else {
        setActionSuccess("Agent action approved and executed.");
      }
      await refreshAgentActions();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to approve proposal.");
    } finally {
      setReviewingProposalId(null);
    }
  };

  const handleRejectProposal = async (proposal: ProjectAgentActionProposal) => {
    setActionError(null);
    setActionSuccess(null);
    setReviewingProposalId(proposal.id);

    try {
      const response = await fetch(`/api/projects/${id}/agent-actions/${proposal.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = (await response.json().catch(() => ({}))) as RejectProposalResponse;
      if (!response.ok || !body.proposal) {
        throw new Error(
          body.detail || body.error || (Array.isArray(body.issues) ? body.issues.join(" ") : "Failed to reject proposal."),
        );
      }

      setActionSuccess("Agent action rejected.");
      await refreshAgentActions();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to reject proposal.");
    } finally {
      setReviewingProposalId(null);
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
          Manage attached agents and review proposed PM actions. Agent actions execute only after owner approval.
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
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-white">Agent Suggestions</h2>
            <p className="mt-1 max-w-2xl text-sm text-neutral-400">
              Risk Watch proposes task owners, and GitHub Task Review proposes status updates from related commits.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!canManage || isGuest || isRunningGithubTaskReview}
              onClick={() => void handleRunGithubTaskReview()}
              className="key-button inline-flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-full px-5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRunningGithubTaskReview ? "Reviewing..." : "Review GitHub Commits"}
            </button>
            <button
              type="button"
              disabled={!canManage || isGuest || isRunningRiskWatch}
              onClick={() => void handleRunRiskWatch()}
              className="normal-button inline-flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-full px-5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRunningRiskWatch ? "Running..." : "Run Risk Watch"}
            </button>
          </div>
        </div>

        {!canManage && !isGuest ? (
          <p className="mb-4 text-xs text-neutral-500">Only the project owner can run reviews and approve actions.</p>
        ) : null}

        {pendingProposals.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-neutral-400">
            No pending agent actions.
          </div>
        ) : (
          <div className="space-y-4">
            {pendingProposals.map((proposal) => {
              const task = findTask(getProposalTaskId(proposal));
              const selectedAssignee = getSelectedAssignee(proposal);
              const selectedStatus = getSelectedStatus(proposal);
              const isProgressProposal = proposal.proposedActionType === "suggest_task_progress_update";
              const isReviewing = reviewingProposalId === proposal.id;

              return (
                <article key={proposal.id} className="inner-frame inner-frame-hover rounded-xl p-4 transition-all duration-300 ease-in-out">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="wrap-break-word text-base font-semibold text-white">{proposal.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-neutral-400">{proposal.description}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-500">
                        <span className="rounded-md bg-white/5 px-2 py-1">{proposal.status}</span>
                        <span className="rounded-md bg-white/5 px-2 py-1">{proposal.proposedActionType}</span>
                        <span className="rounded-md bg-white/5 px-2 py-1">{formatDateTime(proposal.createdAt)}</span>
                      </div>
                      {task ? (
                        <p className="mt-3 text-xs text-neutral-500">
                          Related task: <span className="text-neutral-300">{task.title}</span>
                        </p>
                      ) : null}
                      {isProgressProposal && typeof proposal.payload.commitMessage === "string" ? (
                        <p className="mt-2 text-xs text-neutral-500">
                          Commit: <span className="text-neutral-300">{proposal.payload.commitMessage}</span>
                          {typeof proposal.payload.commitSha === "string" ? (
                            <span className="ml-2 font-mono text-neutral-500">({proposal.payload.commitSha.slice(0, 8)})</span>
                          ) : null}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
                    {isProgressProposal ? (
                      <label className="text-sm text-neutral-300">
                        Confirm status
                        <select
                          disabled={!canManage || isReviewing}
                          value={selectedStatus}
                          onChange={(event) =>
                            setProposalStatuses((current) => ({
                              ...current,
                              [proposal.id]: event.target.value as Task["status"],
                            }))
                          }
                          className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-black/40 px-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="todo">todo</option>
                          <option value="in_progress">in progress</option>
                          <option value="done">done</option>
                        </select>
                      </label>
                    ) : (
                      <label className="text-sm text-neutral-300">
                        Assignee
                        <select
                          disabled={!canManage || isReviewing}
                          value={selectedAssignee}
                          onChange={(event) =>
                            setProposalAssignees((current) => ({
                              ...current,
                              [proposal.id]: event.target.value,
                            }))
                          }
                          className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-black/40 px-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="">Select member</option>
                          {dbMembers.map((member) => (
                            <option key={member.userId} value={member.userId}>
                              {getMemberLabel(member)}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <button
                      type="button"
                      disabled={!canManage || isReviewing || (!isProgressProposal && !selectedAssignee)}
                      onClick={() => void handleApproveProposal(proposal)}
                      className="key-button h-10 cursor-pointer rounded-full px-5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isReviewing ? "Reviewing..." : "Approve"}
                    </button>
                    <button
                      type="button"
                      disabled={!canManage || isReviewing}
                      onClick={() => void handleRejectProposal(proposal)}
                      className="normal-button h-10 cursor-pointer rounded-full px-5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {recentProposals.length > 0 || recentRuns.length > 0 ? (
          <div className="mt-6 border-t border-white/10 pt-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">Recent History</h3>
            <div className="mt-3 space-y-2">
              {recentProposals.slice(0, 6).map((proposal) => (
                <div key={proposal.id} className="flex flex-col gap-1 rounded-lg bg-white/5 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-neutral-300">{proposal.title}</span>
                  <span className="text-xs text-neutral-500">
                    {proposal.status} - {formatDateTime(proposal.updatedAt)}
                  </span>
                </div>
              ))}
              {recentRuns.slice(0, 3).map((run) => (
                <div key={run.id} className="flex flex-col gap-1 rounded-lg bg-white/5 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-neutral-300">{run.summary || "Risk Watch run"}</span>
                  <span className="text-xs text-neutral-500">
                    {run.status} - {formatDateTime(run.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

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
