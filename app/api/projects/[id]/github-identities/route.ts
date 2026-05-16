import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { getSafeErrorDetail } from "@/lib/api-errors";
import { authOptions } from "@/lib/auth";
import {
  getGithubIdentityMappingsByProjectId,
  getProjectById,
  getProjectMembers,
  isProjectMember,
  normalizeUserId,
  upsertAppUser,
  upsertGithubIdentityMapping,
} from "@/lib/storage";
import { isoNow } from "@/lib/utils";
import { upsertGithubIdentityMappingRequestSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function requireProjectAccess(projectId: string) {
  const session = await getServerSession(authOptions);
  const sessionUserId = session?.user?.email ? normalizeUserId(session.user.email) : null;

  if (!sessionUserId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  await upsertAppUser({
    userId: sessionUserId,
    displayName: session?.user?.name || null,
    imageUrl: session?.user?.image || null,
    timestamp: isoNow(),
  });

  const project = await getProjectById(projectId);
  if (!project) {
    return { error: NextResponse.json({ error: "Project not found." }, { status: 404 }) };
  }

  const hasAccess = await isProjectMember(projectId, sessionUserId);
  if (!hasAccess) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { sessionUserId, project };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const access = await requireProjectAccess(id);
    if ("error" in access) return access.error;

    const mappings = await getGithubIdentityMappingsByProjectId(id);
    return NextResponse.json({ mappings });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch GitHub identity mappings.", detail: getSafeErrorDetail(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const access = await requireProjectAccess(id);
    if ("error" in access) return access.error;

    const body = await request.json();
    const parsed = upsertGithubIdentityMappingRequestSchema.parse(body);
    const members = await getProjectMembers(id);
    const memberId = normalizeUserId(parsed.memberId);

    if (!members.some((member) => member.userId === memberId)) {
      return NextResponse.json({ error: "Project member not found." }, { status: 404 });
    }

    const mapping = await upsertGithubIdentityMapping({
      ...parsed,
      memberId,
      projectId: id,
      timestamp: isoNow(),
    });

    return NextResponse.json({ mapping });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed.", issues: error.issues.map((issue) => issue.message) },
        { status: 422 },
      );
    }

    return NextResponse.json(
      { error: "Failed to save GitHub identity mapping.", detail: getSafeErrorDetail(error) },
      { status: 500 },
    );
  }
}
