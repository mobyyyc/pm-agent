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

  const prompt = [
    "You are a product management assistant.",
    "Return only valid JSON matching the required schema.",
    "Do not include markdown, comments, explanations, or extra keys.",
    "Deadlines and timeline dates must be in YYYY-MM-DD format.",
    "Use the provided company knowledge and project idea.",
    "",
    `Today: ${input.today}`,
    `Project idea: ${input.projectIdea}`,
    `Company knowledge: ${JSON.stringify(input.companyKnowledge)}`,
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
}): Promise<AIAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  const systemInstruction = `
You are an expert Project Manager. You help users clarify their project ideas.
Your goal is to gather enough information to generate a detailed project plan.
- Ask ONE clarifying question at a time if the user's idea is vague.
- Suggest 2-3 short options for the user to pick if helpful.
- Once you have enough information (scope, timeline, main features), set status to "ready" and summarize the plan.
- If the user asks specifically to generate the plan, set status to "ready".
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

