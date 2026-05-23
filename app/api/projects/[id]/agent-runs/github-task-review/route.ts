import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { generateGithubTaskReviewProposals } from "@/lib/agent-actions/github-task-review";
import { getSafeErrorDetail } from "@/lib/api-errors";
import { authOptions } from "@/lib/auth";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";
import {
  createProjectAgentActionProposalIfNotExists,
  createProjectAgentRun,
  getProjectActivityEventsByProjectId,
  getProjectById,
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

    if (!(await isProjectMember(id, sessionUserId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (normalizeUserId(project.userId) !== sessionUserId) {
      return NextResponse.json({ error: "Only the project owner can run GitHub Task Review." }, { status: 403 });
    }

    const [tasks, activityEvents] = await Promise.all([
      getTasksByProjectId(id),
      getProjectActivityEventsByProjectId(id, 100),
    ]);
    const recentCommitEvents = activityEvents.filter(
      (event) => event.source === "github" && event.entityType === "github_commit" && event.eventType === "github.commit.synced",
    );
    const startedAt = isoNow();
    const run = await createProjectAgentRun({
      projectId: id,
      agentId: "github-task-review",
      triggerType: "manual",
      status: "running",
      startedByUserId: sessionUserId,
      startedAt,
      createdAt: startedAt,
      inputSnapshot: {
        activeTaskCount: tasks.filter((task) => task.status !== "done").length,
        recentCommitEventCount: recentCommitEvents.length,
      },
    });
    runId = run.id;

    const drafts = generateGithubTaskReviewProposals({
      project,
      tasks,
      activityEvents: recentCommitEvents,
    });
    let createdProposalCount = 0;
    let skippedProposalCount = 0;

    for (const draft of drafts) {
      const result = await createProjectAgentActionProposalIfNotExists({
        ...draft,
        projectId: id,
        runId: run.id,
        agentId: "github-task-review",
        timestamp: startedAt,
      });

      if (!result.created) {
        skippedProposalCount += 1;
        continue;
      }

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
          commitSha: result.proposal.payload.commitSha,
          suggestedStatus: result.proposal.payload.suggestedStatus,
        },
        createdAt: startedAt,
      });
    }

    const completedAt = isoNow();
    const summary = `GitHub Task Review created ${createdProposalCount} proposal${createdProposalCount === 1 ? "" : "s"} and skipped ${skippedProposalCount} duplicate${skippedProposalCount === 1 ? "" : "s"}.`;
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
      eventType: "github_task_review.run.completed",
      entityType: "agent_run",
      entityId: run.id,
      summary: "GitHub task progress review completed",
      metadata: {
        runId: run.id,
        agentId: "github-task-review",
        createdProposalCount,
        skippedProposalCount,
        proposedActionType: "suggest_task_progress_update",
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
      await updateProjectAgentRunStatus({
        projectId,
        runId,
        status: "failed",
        errorMessage: getSafeErrorDetail(error),
        completedAt: isoNow(),
      });
    }

    return NextResponse.json(
      { error: "Failed to run GitHub Task Review.", detail: getSafeErrorDetail(error) },
      { status: 500 },
    );
  }
}
