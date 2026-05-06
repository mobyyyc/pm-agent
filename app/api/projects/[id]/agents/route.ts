import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { getSafeErrorDetail } from "@/lib/api-errors";
import { findAgentDefinition } from "@/lib/agents";
import { authOptions } from "@/lib/auth";
import {
  getProjectById,
  getProjectAgentsByProjectId,
  isProjectMember,
  normalizeUserId,
  upsertAppUser,
  upsertProjectAgent,
} from "@/lib/storage";
import { isoNow } from "@/lib/utils";
import { attachProjectAgentRequestSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getAuthorizedProject(projectId: string, sessionUserId: string) {
  const project = await getProjectById(projectId);
  if (!project) {
    return { error: NextResponse.json({ error: "Project not found." }, { status: 404 }) };
  }

  const hasAccess = await isProjectMember(projectId, sessionUserId);
  if (!hasAccess) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const canManage = normalizeUserId(project.userId) === sessionUserId;
  return { project, canManage };
}

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
    const accessResult = await getAuthorizedProject(id, sessionUserId);
    if ("error" in accessResult) {
      return accessResult.error;
    }

    const agents = await getProjectAgentsByProjectId(id);
    return NextResponse.json({ agents, canManage: accessResult.canManage });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch project agents.",
        detail: getSafeErrorDetail(error),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
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
    const accessResult = await getAuthorizedProject(id, sessionUserId);
    if ("error" in accessResult) {
      return accessResult.error;
    }

    if (!accessResult.canManage) {
      return NextResponse.json({ error: "Only the project owner can add agents." }, { status: 403 });
    }

    const body = await request.json();
    const parsed = attachProjectAgentRequestSchema.parse(body);
    const agentDefinition = findAgentDefinition(parsed.agentId);

    if (!agentDefinition) {
      return NextResponse.json({ error: "Agent not found." }, { status: 404 });
    }

    const timestamp = isoNow();
    const projectAgent = await upsertProjectAgent({
      projectId: id,
      agentId: agentDefinition.id,
      name: agentDefinition.name,
      description: agentDefinition.description,
      category: agentDefinition.category,
      status: "active",
      schedule: parsed.schedule ?? agentDefinition.recommendedSchedule,
      config: parsed.config || {},
      lastRunAt: null,
      nextRunAt: null,
      createdByUserId: sessionUserId,
      timestamp,
    });

    return NextResponse.json({ agent: projectAgent }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed.", issues: error.issues.map((issue) => issue.message) },
        { status: 422 },
      );
    }

    return NextResponse.json(
      {
        error: "Failed to add project agent.",
        detail: getSafeErrorDetail(error),
      },
      { status: 500 },
    );
  }
}
