import { validateAndNormalizeAIPlan, validateAndNormalizeAIAnalysis } from "@/lib/validators";
import type { AIPlan, AIAnalysis } from "@/types/models";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent";

const analysisJsonSchema = {
  type: "OBJECT",
  properties: {
    status: { type: "STRING", enum: ["asking", "ready"] },
    question: { type: "STRING" },
    options: { type: "ARRAY", items: { type: "STRING" } },
    summary: { type: "STRING" },
  },
  required: ["status"],
};

const responseJsonSchema = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING" },
    guideline: { type: "STRING" },
    timeline: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          phase: { type: "STRING" },
          startDate: { type: "STRING" },
          endDate: { type: "STRING" },
          deliverable: { type: "STRING" },
        },
        required: ["phase", "startDate", "endDate", "deliverable"],
      },
    },
    tasks: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          description: { type: "STRING" },
          deadline: { type: "STRING" },
          suggestedAssignee: { type: "STRING" },
        },
        required: ["title", "description", "deadline", "suggestedAssignee"],
      },
    },
  },
  required: ["name", "guideline", "timeline", "tasks"],
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

export async function generateProjectPlanWithGemini(input: {
  projectIdea: string;
  companyKnowledge: unknown;
  today: string;
}): Promise<AIPlan> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  const companyKnowledge = input.companyKnowledge as Record<string, unknown>;

  const prompt = [
    `You are a product management assistant for ${companyKnowledge.name || "the company"}.`,
    "Return only valid JSON matching the required schema.",
    "Do not include markdown, comments, explanations, or extra keys.",
    "Deadlines and timeline dates must be in YYYY-MM-DD format.",
    "",
    "=== COMPANY CONTEXT (use this to tailor every part of the plan) ===",
    `Company: ${companyKnowledge.name}`,
    `Industry: ${companyKnowledge.industry || "N/A"}`,
    `Preferred Tech Stack: ${JSON.stringify(companyKnowledge.preferredStack || [])}`,
    `Core Values: ${JSON.stringify(companyKnowledge.values || [])}`,
    `Constraints: ${JSON.stringify(companyKnowledge.constraints || [])}`,
    `Target Audience: ${JSON.stringify(companyKnowledge.targetAudience || [])}`,
    `Design System: ${JSON.stringify(companyKnowledge.designSystem || [])}`,
    "",
    "=== INSTRUCTIONS ===",
    "- The guideline MUST reference the company's values, constraints, and preferred stack.",
    "- Timeline phases should respect the company's delivery constraints (e.g. MVP timelines).",
    "- Task descriptions should mention specific technologies from the preferred stack where relevant.",
    "- Suggested assignees should reflect the lean team size mentioned in constraints.",
    "- Design-related tasks should follow the company's design system guidelines.",
    "",
    `Today: ${input.today}`,
    `Project idea: ${input.projectIdea}`,
  ].join("\n");

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseJsonSchema,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${errorText}`);
  }

  const json = (await response.json()) as GeminiResponse;
  const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error("Gemini returned an empty response.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("Gemini returned invalid JSON.");
  }

  return validateAndNormalizeAIPlan(parsed);
}

export async function analyzeProjectRequest(input: {
  message: string;
  history: { role: "user" | "model"; content: string }[];
  companyKnowledge?: unknown;
}): Promise<AIAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  const ck = (input.companyKnowledge || {}) as Record<string, unknown>;
  const companyName = (ck.name as string) || "the company";

  const systemInstruction = `
You are an expert product manager at ${companyName}.
You help users clarify their project ideas in the context of this company.

=== COMPANY CONTEXT ===
Company: ${companyName}
Industry: ${ck.industry || "N/A"}
Preferred Tech Stack: ${JSON.stringify(ck.preferredStack || [])}
Core Values: ${JSON.stringify(ck.values || [])}
Constraints: ${JSON.stringify(ck.constraints || [])}
Target Audience: ${JSON.stringify(ck.targetAudience || [])}
Design System: ${JSON.stringify(ck.designSystem || [])}

=== BEHAVIOR ===
- Ask ONE clarifying question at a time if the user's idea is vague.
- Suggest 2-3 short options for the user to pick if helpful.
- Frame your questions and suggestions around the company's capabilities, stack, constraints, and audience.
- CRITICAL: Before setting status to "ready", you MUST know the following information:
  1. Duration of the project
  2. Scale of the project
  3. How many members/developers will work on it
  4. Type of project (webapp, local software, ios app, etc.)
- DO NOT assume any of this information (e.g. do not assume the duration). If anything is missing, you must ask the user.
- Once you have ALL the required information (duration, scale, team size, project type, and main features), set status to "ready" and summarize the plan.
- If the user asks specifically to generate the plan but required info is missing, kindly ask for the missing info first.
- In your summary, reference the company's preferred stack and constraints.
`.trim();

  const contents = input.history.map((msg) => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.content }],
  }));

  contents.push({
    role: "user",
    parts: [{ text: input.message }],
  });

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: analysisJsonSchema,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini analyze request failed: ${response.status} ${errorText}`);
  }

  const json = (await response.json()) as GeminiResponse;
  const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) throw new Error("Gemini returned empty analysis.");

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("Gemini returned invalid analysis JSON.");
  }

  return validateAndNormalizeAIAnalysis(parsed);
}

