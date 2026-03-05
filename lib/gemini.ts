import { validateAndNormalizeAIPlan } from "@/lib/validators";
import type { AIPlan } from "@/types/models";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent";

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
