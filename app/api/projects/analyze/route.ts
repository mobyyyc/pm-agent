import { NextRequest, NextResponse } from "next/server";
import { analyzeProjectRequest } from "@/lib/gemini";
import { readCompanyKnowledge } from "@/lib/storage";
import { analyzeProjectRequestSchema } from "@/lib/validators";

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const result = analyzeProjectRequestSchema.safeParse(json);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request", details: result.error.format() },
        { status: 400 }
      );
    }

    const { message, history } = result.data;
    const companyKnowledge = await readCompanyKnowledge();
    const analysis = await analyzeProjectRequest({ message, history: history || [], companyKnowledge });

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze request" },
      { status: 500 }
    );
  }
}
