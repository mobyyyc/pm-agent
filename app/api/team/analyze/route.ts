import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { analyzeTeamImportWithGemini } from "@/lib/gemini";
import { analyzeTeamImportRequestSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = analyzeTeamImportRequestSchema.parse(body);

    const analysis = await analyzeTeamImportWithGemini({
      inputType: parsed.inputType,
      content: parsed.content,
    });

    return NextResponse.json({ analysis });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed.", issues: error.issues.map((issue) => issue.message) },
        { status: 422 },
      );
    }

    return NextResponse.json(
      { error: "Failed to analyze team profile.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
