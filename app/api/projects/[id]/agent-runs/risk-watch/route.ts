import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { generateRiskWatchProposals } from "@/lib/agent-actions/risk-watch";
import { getSafeErrorDetail } from "@/lib/api-errors";
import { authOptions } from "@/lib/auth";
import { calculateProjectHealth } from "@/lib/project-health";
import { calculateProjectProgress } from "@/lib/project-progress";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";
import {
  createProjectAgentActionProposalIfNotExists,
  createProjectAgentRun,
  getProjectById,
  getProjectMembers,
  getTasksByProjectId,
  isProjectMember,
  logProjectActivityEvent,
  normalizeUserId,
  updateProjectAgentRunStatus,
  upsertAppUser,
} from "@/lib/storage";
import { isoNow } from "@/lib/utils";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  let runId: string | null = null;
  let projectId: string | null = null;

  try {
    const session = await getServerSession(authOptions);
    const sessionUserId = session?.user?.email ? normalizeUserId(session.user.email) : null;

    if (!sessionUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = checkRateLimit(
      getRateLimitKey(request, "agent-actions:mutation", sessionUserId),
      RATE_LIMITS.mutation,
    );
    if (rateLimit.limited) {
      return rateLimitResponse(rateLimit);
    }

    await upsertAppUser({
      userId: sessionUserId,
      displayName: session?.user?.name || null,
      imageUrl: session?.user?.image || null,
      timestamp: isoNow(),
    });

    const { id } = await context.params;
    projectId = id;
    const project = await getProjectById(id);

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const hasAccess = await isProjectMember(id, sessionUserId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (normalizeUserId(project.userId) !== sessionUserId) {
      return NextResponse.json({ error: "Only the project owner can run Risk Watch." }, { status: 403 });
    }

    const [tasks, members] = await Promise.all([
      getTasksByProjectId(id),
      getProjectMembers(id),
    ]);
    const startedAt = isoNow();
    const today = startedAt.slice(0, 10);
    const progress = calculateProjectProgress(project, tasks, today);
    const health = calculateProjectHealth(progress, today);
    const run = await createProjectAgentRun({
      projectId: id,
      agentId: "risk-watch",
      triggerType: "manual",
      status: "running",
      startedByUserId: sessionUserId,
      startedAt,
      createdAt: startedAt,
      inputSnapshot: {
        progress: {
          totalTasks: progress.totalTasks,
          overdueTasks: progress.overdueTasks,
          unassignedTasks: progress.unassignedTasks,
        },
        health: {
          status: health.status,
          signals: health.signals.map((signal) => signal.id),
        },
      },
    });
    runId = run.id;

    const drafts = generateRiskWatchProposals({
      project,
      tasks,
      members,
      health,
      now: startedAt,
    });

    let createdProposalCount = 0;
    let skippedProposalCount = 0;

    for (const draft of drafts) {
      const result = await createProjectAgentActionProposalIfNotExists({
        ...draft,
        projectId: id,
        runId: run.id,
        agentId: "risk-watch",
        timestamp: startedAt,
      });

      if (result.created) {
        createdProposalCount += 1;
        await logProjectActivityEvent({
          projectId: id,
          actorUserId: sessionUserId,
          source: "system",
          eventType: "agent_action.proposed",
          entityType: "agent_action_proposal",
          entityId: result.proposal.id,
          summary: `Agent action proposed: ${result.proposal.title}`,
          metadata: {
            runId: run.id,
            proposalId: result.proposal.id,
            proposedActionType: result.proposal.proposedActionType,
            sourceType: result.proposal.sourceType,
            sourceId: result.proposal.sourceId,
            taskId: result.proposal.payload.taskId,
            assigneeMemberId: result.proposal.payload.assigneeMemberId,
          },
          createdAt: startedAt,
        });
      } else {
        skippedProposalCount += 1;
      }
    }

    const completedAt = isoNow();
    const summary = `Risk Watch created ${createdProposalCount} proposal${createdProposalCount === 1 ? "" : "s"} and skipped ${skippedProposalCount} duplicate${skippedProposalCount === 1 ? "" : "s"}.`;
    const completedRun = await updateProjectAgentRunStatus({
      projectId: id,
      runId: run.id,
      status: "completed",
      summary,
      completedAt,
    });

    await logProjectActivityEvent({
      projectId: id,
      actorUserId: sessionUserId,
      source: "system",
      eventType: "agent.run.completed",
      entityType: "agent_run",
      entityId: run.id,
      summary: "Risk Watch review completed",
      metadata: {
        runId: run.id,
        agentId: "risk-watch",
        createdProposalCount,
        skippedProposalCount,
        proposedActionType: "assign_task_owner",
      },
      createdAt: completedAt,
    });

    return NextResponse.json({
      run: completedRun || run,
      createdProposalCount,
      skippedProposalCount,
    });
  } catch (error) {
    if (projectId && runId) {
      const failedAt = isoNow();
      await updateProjectAgentRunStatus({
        projectId,
        runId,
        status: "failed",
        errorMessage: getSafeErrorDetail(error),
        completedAt: failedAt,
      });
    }

    return NextResponse.json(
      {
        error: "Failed to run Risk Watch.",
        detail: getSafeErrorDetail(error),
      },
      { status: 500 },
    );
  }
}
