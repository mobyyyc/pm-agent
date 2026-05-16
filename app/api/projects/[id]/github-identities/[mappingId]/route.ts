import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { getSafeErrorDetail } from "@/lib/api-errors";
import { authOptions } from "@/lib/auth";
import {
  deleteGithubIdentityMapping,
  getProjectById,
  isProjectMember,
  normalizeUserId,
  upsertAppUser,
} from "@/lib/storage";
import { isoNow } from "@/lib/utils";

type RouteContext = {
  params: Promise<{ id: string; mappingId: string }>;
};

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

    const { id, mappingId } = await context.params;
    const project = await getProjectById(id);

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const hasAccess = await isProjectMember(id, sessionUserId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const deleted = await deleteGithubIdentityMapping(mappingId, id);
    if (!deleted) {
      return NextResponse.json({ error: "GitHub identity mapping not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete GitHub identity mapping.", detail: getSafeErrorDetail(error) },
      { status: 500 },
    );
  }
}
