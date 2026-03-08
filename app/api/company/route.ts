import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { parseCompanyFromJson, parseCompanyFromText } from "@/lib/company-parser";
import { getCompanyByUserId, readDefaultCompanyKnowledge, upsertCompanyByUserId } from "@/lib/storage";
import { isoNow } from "@/lib/utils";
import { importCompanyRequestSchema, upsertCompanyRequestSchema } from "@/lib/validators";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.email;
    const userCompany = await getCompanyByUserId(userId);

    if (!userCompany) {
      const fallback = await readDefaultCompanyKnowledge();
      return NextResponse.json({
        company: fallback,
        source: "default",
      });
    }

    return NextResponse.json({
      company: userCompany.company,
      source: "user",
      updatedAt: userCompany.updatedAt,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch company profile.", detail: error instanceof Error ? error.message : "Unknown error" },
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

    const manual = upsertCompanyRequestSchema.safeParse(body);
    if (manual.success) {
      const saved = await upsertCompanyByUserId(userId, manual.data, isoNow());
      return NextResponse.json({ company: saved.company, updatedAt: saved.updatedAt });
    }

    const imported = importCompanyRequestSchema.safeParse(body);
    if (!imported.success) {
      return NextResponse.json(
        {
          error: "Validation failed.",
          issues: imported.error.issues.map((issue) => issue.message),
        },
        { status: 422 },
      );
    }

    const parsedCompany =
      imported.data.inputType === "json"
        ? parseCompanyFromJson(imported.data.content)
        : parseCompanyFromText(imported.data.content);

    const saved = await upsertCompanyByUserId(userId, parsedCompany, isoNow());
    return NextResponse.json({ company: saved.company, updatedAt: saved.updatedAt });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed.", issues: error.issues.map((issue) => issue.message) },
        { status: 422 },
      );
    }

    return NextResponse.json(
      { error: "Failed to save company profile.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
