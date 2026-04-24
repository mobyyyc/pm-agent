import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import {
  createProjectInvitation,
  getAppUserById,
  getPendingProjectInvitationByProjectAndInvitee,
  getPendingProjectInvitationsByInvitee,
  getProjectById,
  isProjectMember,
  normalizeUserId,
  upsertAppUser,
} from "@/lib/storage";
import { createId, isoNow } from "@/lib/utils";
import { createInvitationRequestSchema } from "@/lib/validators";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const sessionUserId = session?.user?.email ? normalizeUserId(session.user.email) : null;

    if (!sessionUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await upsertAppUser({
      userId: sessionUserId,
      displayName: session.user?.name || null,
      imageUrl: session.user?.image || null,
      timestamp: isoNow(),
    });

    const invitations = await getPendingProjectInvitationsByInvitee(sessionUserId);

    return NextResponse.json({
      invitations: invitations.map((invitation) => ({
        id: invitation.id,
        projectId: invitation.projectId,
        projectName: invitation.projectName,
        inviterUserId: invitation.inviterUserId,
        invitedBy: invitation.inviterDisplayName || invitation.inviterUserId,
        role: invitation.role,
        invitedAt: invitation.invitedAt,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch invitations.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUserId = session?.user?.email ? normalizeUserId(session.user.email) : null;

    if (!sessionUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createInvitationRequestSchema.parse(body);
    const inviteeUserId = normalizeUserId(parsed.inviteeEmail);

    if (inviteeUserId === sessionUserId) {
      return NextResponse.json({ error: "You cannot invite yourself." }, { status: 400 });
    }

    const timestamp = isoNow();

    await upsertAppUser({
      userId: sessionUserId,
      displayName: session.user?.name || null,
      imageUrl: session.user?.image || null,
      timestamp,
    });

    const project = await getProjectById(parsed.projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const canInvite = await isProjectMember(project.id, sessionUserId);
    if (!canInvite) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const invitee = await getAppUserById(inviteeUserId);
    if (!invitee) {
      return NextResponse.json(
        { error: "User not found. The invitee must sign in to this app at least once." },
        { status: 404 },
      );
    }

    const alreadyMember = await isProjectMember(project.id, inviteeUserId);
    if (alreadyMember) {
      return NextResponse.json({ error: "This user is already a project member." }, { status: 409 });
    }

    const pending = await getPendingProjectInvitationByProjectAndInvitee(project.id, inviteeUserId);
    if (pending) {
      return NextResponse.json({ error: "An invitation is already pending for this user." }, { status: 409 });
    }

    const invitation = await createProjectInvitation({
      id: createId("invitation"),
      projectId: project.id,
      inviterUserId: sessionUserId,
      inviteeUserId,
      role: parsed.role?.trim() || "member",
      createdAt: timestamp,
    });

    return NextResponse.json(
      {
        invitation: {
          id: invitation.id,
          projectId: invitation.projectId,
          projectName: project.name,
          inviteeEmail: inviteeUserId,
          invitedBy: session.user?.name || sessionUserId,
          role: invitation.role,
          invitedAt: invitation.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed.", issues: error.issues.map((issue) => issue.message) },
        { status: 422 },
      );
    }

    return NextResponse.json(
      { error: "Failed to send invitation.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
