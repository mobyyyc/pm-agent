import { calculateNextRunAt } from "./schedule-config";
import type { ProjectAgent } from "@/types/models";

export { calculateNextRunAt } from "./schedule-config";

const supportedAgentIds = new Set(["risk-watch"]);

export type ScheduledAgentRunSummary = {
  checkedCount: number;
  dueCount: number;
  ranCount: number;
  skippedCount: number;
  failedCount: number;
  proposedCount: number;
  duplicateProposalCount: number;
  results: Array<{
    projectId: string;
    agentId: string;
    status: "ran" | "skipped" | "failed";
    reason?: string;
    runId?: string | null;
    createdProposalCount?: number;
    skippedProposalCount?: number;
    nextRunAt?: string | null;
    error?: string;
  }>;
};

export type ScheduledAgentRunnerDependencies = {
  getActiveProjectAgents(): Promise<ProjectAgent[]>;
  updateProjectAgentScheduleState(input: {
    projectId: string;
    agentId: string;
    lastRunAt: string | null;
    nextRunAt: string | null;
    timestamp: string;
  }): Promise<ProjectAgent | null>;
  runAgent(input: {
    projectId: string;
    agentId: string;
    triggerType: "scheduled";
    startedByUserId: string | null;
    now: string;
    logActivityEvents: boolean;
  }): Promise<{
    run: { id: string };
    createdProposalCount: number;
    skippedProposalCount: number;
  }>;
  now(): string;
};

export type ScheduledAgentRunnerOptions = {
  force?: boolean;
};

function toValidDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isSupportedScheduledAgent(agentId: string): boolean {
  return supportedAgentIds.has(agentId);
}

export function isProjectAgentDue(agent: ProjectAgent, now: Date | string): boolean {
  if (agent.status !== "active") return false;
  if (!agent.schedule?.trim()) return false;

  const nowDate = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(nowDate.getTime())) return false;

  const nextRunAt = toValidDate(agent.nextRunAt);
  if (nextRunAt) {
    return nextRunAt.getTime() <= nowDate.getTime();
  }

  if (!agent.lastRunAt) {
    return calculateNextRunAt(agent.schedule, nowDate) !== null;
  }

  const calculatedNextRunAt = calculateNextRunAt(agent.schedule, agent.lastRunAt);
  const calculatedNextRunDate = toValidDate(calculatedNextRunAt);
  return calculatedNextRunDate ? calculatedNextRunDate.getTime() <= nowDate.getTime() : false;
}

export function getDueProjectAgents(agents: ProjectAgent[], now: Date | string): ProjectAgent[] {
  return agents.filter((agent) => isProjectAgentDue(agent, now));
}

export function getRunnableProjectAgents(
  agents: ProjectAgent[],
  now: Date | string,
  options: ScheduledAgentRunnerOptions = {},
): ProjectAgent[] {
  if (!options.force) {
    return getDueProjectAgents(agents, now);
  }

  return agents.filter((agent) => {
    if (agent.status !== "active") return false;
    if (!agent.schedule?.trim()) return false;
    return calculateNextRunAt(agent.schedule, now) !== null || Boolean(agent.nextRunAt);
  });
}

async function getDefaultDependencies(): Promise<ScheduledAgentRunnerDependencies> {
  const [storage, runner] = await Promise.all([
    import("@/lib/storage"),
    import("@/lib/agent-runs/run-agent"),
  ]);

  return {
    getActiveProjectAgents: storage.getActiveProjectAgents,
    updateProjectAgentScheduleState: storage.updateProjectAgentScheduleState,
    runAgent: runner.runDeterministicProjectAgent,
    now: () => new Date().toISOString(),
  };
}

export async function runScheduledProjectAgents(
  dependencies?: ScheduledAgentRunnerDependencies,
  options: ScheduledAgentRunnerOptions = {},
): Promise<ScheduledAgentRunSummary> {
  const deps = dependencies || (await getDefaultDependencies());
  const now = deps.now();
  const agents = await deps.getActiveProjectAgents();
  const dueAgents = getRunnableProjectAgents(agents, now, options);
  const results: ScheduledAgentRunSummary["results"] = [];

  for (const agent of dueAgents) {
    if (!isSupportedScheduledAgent(agent.agentId)) {
      const nextRunAt = calculateNextRunAt(agent.schedule, now);
      await deps.updateProjectAgentScheduleState({
        projectId: agent.projectId,
        agentId: agent.agentId,
        lastRunAt: agent.lastRunAt,
        nextRunAt,
        timestamp: now,
      });
      results.push({
        projectId: agent.projectId,
        agentId: agent.agentId,
        status: "skipped",
        reason: "unsupported_agent",
        nextRunAt,
      });
      continue;
    }

    try {
      const result = await deps.runAgent({
        projectId: agent.projectId,
        agentId: agent.agentId,
        triggerType: "scheduled",
        startedByUserId: null,
        now,
        logActivityEvents: false,
      });
      const nextRunAt = calculateNextRunAt(agent.schedule, now);
      await deps.updateProjectAgentScheduleState({
        projectId: agent.projectId,
        agentId: agent.agentId,
        lastRunAt: now,
        nextRunAt,
        timestamp: now,
      });
      results.push({
        projectId: agent.projectId,
        agentId: agent.agentId,
        status: "ran",
        runId: result.run.id,
        createdProposalCount: result.createdProposalCount,
        skippedProposalCount: result.skippedProposalCount,
        nextRunAt,
      });
    } catch (error) {
      const nextRunAt = calculateNextRunAt(agent.schedule, now);
      await deps.updateProjectAgentScheduleState({
        projectId: agent.projectId,
        agentId: agent.agentId,
        lastRunAt: now,
        nextRunAt,
        timestamp: now,
      });
      results.push({
        projectId: agent.projectId,
        agentId: agent.agentId,
        status: "failed",
        error: error instanceof Error ? error.message : "Scheduled agent run failed.",
        nextRunAt,
      });
    }
  }

  return {
    checkedCount: agents.length,
    dueCount: dueAgents.length,
    ranCount: results.filter((result) => result.status === "ran").length,
    skippedCount: results.filter((result) => result.status === "skipped").length,
    failedCount: results.filter((result) => result.status === "failed").length,
    proposedCount: results.reduce((sum, result) => sum + (result.createdProposalCount || 0), 0),
    duplicateProposalCount: results.reduce((sum, result) => sum + (result.skippedProposalCount || 0), 0),
    results,
  };
}
