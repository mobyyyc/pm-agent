import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { getSafeErrorDetail } from "@/lib/api-errors";
import { authOptions } from "@/lib/auth";
import {
  getProjectById,
  getProjectReportsByProjectId,
  isProjectMember,
  normalizeUserId,
  upsertAppUser,
} from "@/lib/storage";
import { isoNow } from "@/lib/utils";
import { listProjectReportsQuerySchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
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

    const url = new URL(request.url);
    const parsed = listProjectReportsQuerySchema.parse({
      period: url.searchParams.get("period") || undefined,
      limit: url.searchParams.get("limit") || undefined,
    });
    const reports = await getProjectReportsByProjectId({
      projectId: id,
      period: parsed.period,
      limit: parsed.limit,
    });

    return NextResponse.json({ reports });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed.", issues: error.issues.map((issue) => issue.message) },
        { status: 422 },
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch project reports.", detail: getSafeErrorDetail(error) },
      { status: 500 },
    );
  }
}
