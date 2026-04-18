import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { analyzeProjectRequest } from "@/lib/gemini";
import { readTeamKnowledge } from "@/lib/storage";
import { analyzeProjectRequestSchema } from "@/lib/validators";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const start = performance.now();
  try {
    let authMs = 0;
    let parseMs = 0;
    let teamMs = 0;
    let geminiMs = 0;

    const authStart = performance.now();
    const cookieHeader = req.headers.get("cookie") ?? "";
    const hasSessionCookie =
      cookieHeader.includes("next-auth.session-token") ||
      cookieHeader.includes("__Secure-next-auth.session-token");

    const session = hasSessionCookie ? await getServerSession(authOptions) : null;
    authMs = performance.now() - authStart;

    const parseStart = performance.now();
    const json = await req.json();
    const result = analyzeProjectRequestSchema.safeParse(json);
    parseMs = performance.now() - parseStart;

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request", details: result.error.format() },
        { status: 400 }
      );
    }

    const { message, history } = result.data;
    const userEmail = session?.user?.email ?? undefined;

    const teamStart = performance.now();
    const teamKnowledge = await readTeamKnowledge(userEmail);
    teamMs = performance.now() - teamStart;

    const geminiStart = performance.now();
    const analysis = await analyzeProjectRequest({ message, history: history || [], teamKnowledge });
    geminiMs = performance.now() - geminiStart;

    const totalMs = performance.now() - start;
    const response = NextResponse.json(analysis);
    response.headers.set(
      "Server-Timing",
      [
        `auth;dur=${authMs.toFixed(1)}`,
        `parse;dur=${parseMs.toFixed(1)}`,
        `team;dur=${teamMs.toFixed(1)}`,
        `gemini;dur=${geminiMs.toFixed(1)}`,
        `total;dur=${totalMs.toFixed(1)}`,
      ].join(", "),
    );
    return response;
  } catch (error) {
    console.error("Analysis error:", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    const lowerMessage = message.toLowerCase();
    const isTimeout = lowerMessage.includes("timed out");
    const isRateLimited = lowerMessage.includes(" 429") || lowerMessage.includes("resource_exhausted") || lowerMessage.includes("quota exceeded");
    const status = isTimeout ? 504 : isRateLimited ? 429 : 502;

    return NextResponse.json(
      {
        error: "Failed to analyze request",
        detail: isTimeout
          ? "The AI took too long to respond. Please try again."
          : isRateLimited
            ? "Gemini rate limit or quota reached. Wait briefly or use a different model key."
            : "The AI service is temporarily unavailable. Please retry.",
      },
      { status }
    );
  }
}
