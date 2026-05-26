import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { runDeterministicProjectAgent } from "@/lib/agent-runs/run-agent";
import { getSafeErrorDetail } from "@/lib/api-errors";
import { authOptions } from "@/lib/auth";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";
import {
  getProjectById,
  isProjectMember,
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

    const result = await runDeterministicProjectAgent({
      projectId: id,
      agentId: "github-task-review",
      triggerType: "manual",
      startedByUserId: sessionUserId,
      logActivityEvents: true,
    });
    runId = result.run.id;

    return NextResponse.json({
      run: result.run,
      createdProposalCount: result.createdProposalCount,
      skippedProposalCount: result.skippedProposalCount,
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
