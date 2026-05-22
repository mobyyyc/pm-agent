import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { approveAndExecuteAgentActionProposal } from "@/lib/agent-actions/action-registry";
import { getSafeErrorDetail } from "@/lib/api-errors";
import { authOptions } from "@/lib/auth";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";
import {
  getProjectAgentActionProposalById,
  getProjectById,
  isProjectMember,
  normalizeUserId,
  upsertAppUser,
} from "@/lib/storage";
import { isoNow } from "@/lib/utils";
import { approveProjectAgentActionProposalRequestSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string; proposalId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
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

    const { id, proposalId } = await context.params;
    const project = await getProjectById(id);

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const hasAccess = await isProjectMember(id, sessionUserId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (normalizeUserId(project.userId) !== sessionUserId) {
      return NextResponse.json({ error: "Only the project owner can approve agent actions." }, { status: 403 });
    }

    const proposal = await getProjectAgentActionProposalById(id, proposalId);
    if (!proposal) {
      return NextResponse.json({ error: "Agent action proposal not found." }, { status: 404 });
    }

    const body = await request.json();
    const parsed = approveProjectAgentActionProposalRequestSchema.parse(body);
    const result = await approveAndExecuteAgentActionProposal({
      proposal,
      approvedPayload: parsed.payload,
      userId: sessionUserId,
      reviewNote: parsed.reviewNote ?? null,
    });

    return NextResponse.json(
      {
        proposal: result.proposal,
        task: result.task,
        execution: {
          success: result.success,
          errorMessage: result.errorMessage,
        },
      },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed.", issues: error.issues.map((issue) => issue.message) },
        { status: 422 },
      );
    }

    const message = getSafeErrorDetail(error);
    const status = message.includes("Only pending") ? 409 : 500;
    return NextResponse.json(
      {
        error: "Failed to approve agent action proposal.",
        detail: message,
      },
      { status },
    );
  }
}
