import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { getSafeErrorDetail } from "@/lib/api-errors";
import { authOptions } from "@/lib/auth";
import { generateProjectProgressReportWithGemini } from "@/lib/gemini";
import { calculateProjectHealth } from "@/lib/project-health";
import { calculateProjectProgress } from "@/lib/project-progress";
import { compareProjectReportSnapshots } from "@/lib/project-report-comparison";
import { buildProjectReportInput } from "@/lib/project-report-input";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";
import {
  getProjectActivityEventsByProjectId,
  getProjectById,
  getLatestProjectReportByProjectId,
  getTasksByProjectId,
  insertProjectReport,
  isProjectMember,
  normalizeUserId,
  upsertAppUser,
} from "@/lib/storage";
import { isoNow } from "@/lib/utils";
import { generateProjectReportRequestSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const start = performance.now();

  try {
    let authMs = 0;
    let parseMs = 0;
    let dataMs = 0;
    let geminiMs = 0;

    const authStart = performance.now();
    const session = await getServerSession(authOptions);
    const sessionUserId = session?.user?.email ? normalizeUserId(session.user.email) : null;
    authMs = performance.now() - authStart;

    if (!sessionUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = checkRateLimit(
      getRateLimitKey(request, "projects:reports:generate", sessionUserId),
      RATE_LIMITS.aiGenerate,
    );
    if (rateLimit.limited) {
      return rateLimitResponse(rateLimit);
    }

    await upsertAppUser({
      userId: sessionUserId,
      displayName: session?.user?.name || null,
      imageUrl: session?.user?.image || null,
      timestamp: isoNow(),
    });

    const parseStart = performance.now();
    const body = await request.json();
    const parsed = generateProjectReportRequestSchema.parse(body);
    parseMs = performance.now() - parseStart;

    const { id } = await context.params;
    const dataStart = performance.now();
    const project = await getProjectById(id);

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const hasAccess = await isProjectMember(id, sessionUserId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const generatedAt = isoNow();
    const today = generatedAt.slice(0, 10);
    const [tasks, activityEvents, previousReport] = await Promise.all([
      getTasksByProjectId(id),
      getProjectActivityEventsByProjectId(id, 100),
      getLatestProjectReportByProjectId({ projectId: id }),
    ]);
    const progress = calculateProjectProgress(project, tasks, today);
    const health = calculateProjectHealth(progress, today);
    const reportInput = buildProjectReportInput({
      project,
      tasks,
      progress,
      health,
      activityEvents,
      period: parsed.period,
      today,
      generatedAt,
    });
    reportInput.comparisonSummary = compareProjectReportSnapshots(
      previousReport?.inputSnapshot || null,
      reportInput,
      previousReport
        ? {
            id: previousReport.id,
            createdAt: previousReport.createdAt,
          }
        : null,
    );
    dataMs = performance.now() - dataStart;

    const geminiStart = performance.now();
    const report = await generateProjectProgressReportWithGemini(reportInput);
    geminiMs = performance.now() - geminiStart;
    const savedReport = await insertProjectReport({
      id: `report_${crypto.randomUUID()}`,
      projectId: id,
      createdByUserId: sessionUserId,
      period: parsed.period,
      periodStart: reportInput.periodStart,
      periodEnd: reportInput.periodEnd,
      generatedAt: report.generatedAt,
      report,
      inputSnapshot: reportInput,
      source: "manual",
      createdAt: generatedAt,
    });

    const totalMs = performance.now() - start;
    const response = NextResponse.json({ report, savedReport });
    response.headers.set(
      "Server-Timing",
      [
        `auth;dur=${authMs.toFixed(1)}`,
        `parse;dur=${parseMs.toFixed(1)}`,
        `data;dur=${dataMs.toFixed(1)}`,
        `gemini;dur=${geminiMs.toFixed(1)}`,
        `total;dur=${totalMs.toFixed(1)}`,
      ].join(", "),
    );

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed.", issues: error.issues.map((issue) => issue.message) },
        { status: 422 },
      );
    }

    const message = error instanceof Error ? error.message.toLowerCase() : "";
    const status = message.includes("timed out")
      ? 504
      : message.includes("429") || message.includes("quota")
        ? 429
        : message.includes("gemini")
          ? 502
          : 500;

    return NextResponse.json(
      { error: "Failed to generate project report.", detail: getSafeErrorDetail(error) },
      { status },
    );
  }
}
