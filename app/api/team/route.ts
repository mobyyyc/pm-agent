import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { parseTeamFromJson, parseTeamFromText } from "@/lib/team-parser";
import { deleteTeamByUserId, getTeamByUserId, readDefaultTeamKnowledge, upsertTeamByUserId } from "@/lib/storage";
import { isoNow } from "@/lib/utils";
import { importTeamRequestSchema, upsertTeamRequestSchema } from "@/lib/validators";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.email;
    const userTeam = await getTeamByUserId(userId);

    if (!userTeam) {
      const fallback = await readDefaultTeamKnowledge();
      return NextResponse.json({
        team: fallback,
        source: "default",
      });
    }

    return NextResponse.json({
      team: userTeam.team,
      source: "user",
      updatedAt: userTeam.updatedAt,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch team profile.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.email;
    const body = await request.json();

    const manual = upsertTeamRequestSchema.safeParse(body);
    if (manual.success) {
      const saved = await upsertTeamByUserId(userId, manual.data, isoNow());
      return NextResponse.json({ team: saved.team, updatedAt: saved.updatedAt });
    }

    const imported = importTeamRequestSchema.safeParse(body);
    if (!imported.success) {
      return NextResponse.json(
        {
          error: "Validation failed.",
          issues: imported.error.issues.map((issue) => issue.message),
        },
        { status: 422 },
      );
    }

    const parsedTeam =
      imported.data.inputType === "json"
        ? parseTeamFromJson(imported.data.content)
        : parseTeamFromText(imported.data.content);

    const saved = await upsertTeamByUserId(userId, parsedTeam, isoNow());
    return NextResponse.json({ team: saved.team, updatedAt: saved.updatedAt });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed.", issues: error.issues.map((issue) => issue.message) },
        { status: 422 },
      );
    }

    return NextResponse.json(
      { error: "Failed to save team profile.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await deleteTeamByUserId(session.user.email);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to reset team profile.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
