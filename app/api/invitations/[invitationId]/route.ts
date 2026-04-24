import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { getProjectInvitationById, normalizeUserId, respondToProjectInvitation, upsertAppUser } from "@/lib/storage";
import { isoNow } from "@/lib/utils";
import { respondInvitationRequestSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ invitationId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUserId = session?.user?.email ? normalizeUserId(session.user.email) : null;

    if (!sessionUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const timestamp = isoNow();
    await upsertAppUser({
      userId: sessionUserId,
      displayName: session?.user?.name || null,
      imageUrl: session?.user?.image || null,
      timestamp,
    });

    const { invitationId } = await context.params;
    const body = await request.json();
    const parsed = respondInvitationRequestSchema.parse(body);

    const invitation = await getProjectInvitationById(invitationId);
    if (!invitation) {
      return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    }

    if (invitation.inviteeUserId !== sessionUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (invitation.status !== "pending") {
      return NextResponse.json({ error: "This invitation has already been processed." }, { status: 409 });
    }

    const updated = await respondToProjectInvitation({
      invitationId,
      inviteeUserId: sessionUserId,
      action: parsed.action,
      respondedAt: timestamp,
    });

    if (!updated) {
      return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    }

    return NextResponse.json({
      invitation: {
        id: updated.id,
        status: updated.status,
        respondedAt: updated.respondedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed.", issues: error.issues.map((issue) => issue.message) },
        { status: 422 },
      );
    }

    return NextResponse.json(
      { error: "Failed to update invitation.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
