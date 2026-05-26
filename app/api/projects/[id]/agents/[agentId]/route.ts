import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import {
  calculateNextRunAt,
  cronToScheduleConfig,
  getScheduleDisplayLabel,
  parseScheduleConfig,
  scheduleConfigToCron,
  type AgentScheduleConfig,
} from "@/lib/agent-runs/schedule-config";
import { getSafeErrorDetail } from "@/lib/api-errors";
import { authOptions } from "@/lib/auth";
import {
  deleteProjectAgent,
  getProjectAgentByProjectIdAndAgentId,
  getProjectById,
  isProjectMember,
  normalizeUserId,
  updateProjectAgent,
  updateProjectAgentScheduleState,
  upsertAppUser,
} from "@/lib/storage";
import { isoNow } from "@/lib/utils";
import { updateProjectAgentRequestSchema } from "@/lib/validators";
import type { ProjectAgent } from "@/types/models";

type RouteContext = {
  params: Promise<{ id: string; agentId: string }>;
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

function parseScheduleConfigSafe(value: unknown): AgentScheduleConfig | null {
  try {
    return parseScheduleConfig(value);
  } catch {
    return null;
  }
}

function buildProjectAgentResponse(agent: ProjectAgent) {
  const scheduleConfig = parseScheduleConfigSafe(agent.config.scheduleConfig) || cronToScheduleConfig(agent.schedule);

  return {
    ...agent,
    scheduleConfig,
    scheduleDisplayLabel: getScheduleDisplayLabel(scheduleConfig || agent.schedule),
  };
}

export async function PATCH(request: Request, context: RouteContext) {
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

    const { id, agentId } = await context.params;
    const accessResult = await getAuthorizedProject(id, sessionUserId);
    if ("error" in accessResult) {
      return accessResult.error;
    }

    if (!accessResult.canManage) {
      return NextResponse.json({ error: "Only the project owner can update agents." }, { status: 403 });
    }

    const existing = await getProjectAgentByProjectIdAndAgentId(id, agentId);
    if (!existing) {
      return NextResponse.json({ error: "Project agent not found." }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateProjectAgentRequestSchema.parse(body);
    const schedule =
      parsed.scheduleConfig !== undefined
        ? scheduleConfigToCron(parsed.scheduleConfig)
        : Object.prototype.hasOwnProperty.call(parsed, "schedule")
          ? parsed.schedule
          : undefined;
    const hasRawSchedule = Object.prototype.hasOwnProperty.call(parsed, "schedule");
    const { scheduleConfig: _oldScheduleConfig, ...existingConfigWithoutSchedule } = existing.config;
    void _oldScheduleConfig;
    const nextConfig =
      parsed.scheduleConfig !== undefined
        ? {
            ...(parsed.config || existing.config),
            scheduleConfig: parsed.scheduleConfig,
          }
        : hasRawSchedule
          ? {
              ...existingConfigWithoutSchedule,
              ...(parsed.config || {}),
            }
          : parsed.config;

    const updates: {
      status?: "active" | "paused";
      schedule?: string | null;
      config?: Record<string, unknown>;
    } = {};
    if (parsed.status !== undefined) updates.status = parsed.status;
    if (schedule !== undefined) updates.schedule = schedule;
    if (nextConfig !== undefined) updates.config = nextConfig;

    const updated = await updateProjectAgent(id, agentId, updates, isoNow());
    if (!updated) {
      return NextResponse.json({ error: "Project agent not found." }, { status: 404 });
    }

    if (schedule !== undefined) {
      const timestamp = isoNow();
      const withScheduleState =
        (await updateProjectAgentScheduleState({
          projectId: id,
          agentId,
          lastRunAt: existing.lastRunAt,
          nextRunAt: calculateNextRunAt(schedule, timestamp),
          timestamp,
        })) || updated;

      return NextResponse.json({ agent: buildProjectAgentResponse(withScheduleState) });
    }

    return NextResponse.json({ agent: buildProjectAgentResponse(updated) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed.", issues: error.issues.map((issue) => issue.message) },
        { status: 422 },
      );
    }

    return NextResponse.json(
      {
        error: "Failed to update project agent.",
        detail: getSafeErrorDetail(error),
      },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
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

    const { id, agentId } = await context.params;
    const accessResult = await getAuthorizedProject(id, sessionUserId);
    if ("error" in accessResult) {
      return accessResult.error;
    }

    if (!accessResult.canManage) {
      return NextResponse.json({ error: "Only the project owner can remove agents." }, { status: 403 });
    }

    const existing = await getProjectAgentByProjectIdAndAgentId(id, agentId);
    if (!existing) {
      return NextResponse.json({ error: "Project agent not found." }, { status: 404 });
    }

    await deleteProjectAgent(id, agentId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to remove project agent.",
        detail: getSafeErrorDetail(error),
      },
      { status: 500 },
    );
  }
}
