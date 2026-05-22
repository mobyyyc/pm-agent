import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { getSafeErrorDetail } from "@/lib/api-errors";
import { authOptions } from "@/lib/auth";
import {
  getProjectAgentActionProposalsByProjectId,
  getProjectAgentRunsByProjectId,
  getProjectById,
  isProjectMember,
  normalizeUserId,
  upsertAppUser,
} from "@/lib/storage";
import { isoNow } from "@/lib/utils";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUserId = session?.user?.email ? normalizeUserId(session.user.email) : null;

    if (!sessionUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await upsertAppUser({
      userId: sessionUserId,
      displayName: session?.user?.name || null,
      imageUrl: session?.user?.image || null,
      timestamp: isoNow(),
    });

    const { id } = await context.params;
    const project = await getProjectById(id);

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const hasAccess = await isProjectMember(id, sessionUserId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [proposals, runs] = await Promise.all([
      getProjectAgentActionProposalsByProjectId(id, { limit: 50 }),
      getProjectAgentRunsByProjectId(id, 10),
    ]);

    const pendingProposals = proposals.filter((proposal) => proposal.status === "pending");
    const recentProposals = proposals.filter((proposal) => proposal.status !== "pending").slice(0, 20);
    const canManage = normalizeUserId(project.userId) === sessionUserId;

    return NextResponse.json({
      pendingProposals,
      recentProposals,
      runs,
      canManage,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch agent action proposals.",
        detail: getSafeErrorDetail(error),
      },
      { status: 500 },
    );
  }
}
