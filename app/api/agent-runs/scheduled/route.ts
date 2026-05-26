import { NextResponse } from "next/server";

import { runScheduledProjectAgents } from "@/lib/agent-runs/scheduler";
import { getSafeErrorDetail } from "@/lib/api-errors";

function getCronAuthorizationError(request: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    // Local/dev default: allow calls when no secret is configured. Set CRON_SECRET
    // in production and send it as x-cron-secret from the cron provider.
    return null;
  }

  const providedSecret = request.headers.get("x-cron-secret")?.trim();
  if (providedSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized scheduled runner." }, { status: 401 });
  }

  return null;
}

async function handleScheduledAgentRuns(request: Request) {
  const authorizationError = getCronAuthorizationError(request);
  if (authorizationError) {
    return authorizationError;
  }

  try {
    const url = new URL(request.url);
    const forceRequested = url.searchParams.get("force") === "true";
    const force = forceRequested && process.env.NODE_ENV !== "production";
    const summary = await runScheduledProjectAgents(undefined, { force });
    return NextResponse.json({
      ok: summary.failedCount === 0,
      protected: Boolean(process.env.CRON_SECRET?.trim()),
      force,
      forceIgnored: forceRequested && !force,
      ...summary,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to run scheduled agents.",
        detail: getSafeErrorDetail(error),
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handleScheduledAgentRuns(request);
}

export async function POST(request: Request) {
  return handleScheduledAgentRuns(request);
}
