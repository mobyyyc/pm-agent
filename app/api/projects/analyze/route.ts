import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { analyzeProjectRequest } from "@/lib/gemini";
import { readTeamKnowledge } from "@/lib/storage";
import { analyzeProjectRequestSchema } from "@/lib/validators";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const json = await req.json();
    const result = analyzeProjectRequestSchema.safeParse(json);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request", details: result.error.format() },
        { status: 400 }
      );
    }

    const { message, history } = result.data;
  const userEmail = session?.user?.email ?? undefined;
  const teamKnowledge = await readTeamKnowledge(userEmail);
    const analysis = await analyzeProjectRequest({ message, history: history || [], teamKnowledge });

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze request" },
      { status: 500 }
    );
  }
}
