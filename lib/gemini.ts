import {
  validateAndNormalizeAIPlan,
  validateAndNormalizeAIAnalysis,
  validateAndNormalizeTeamImportAnalysis,
} from "@/lib/validators";
import type { AIPlan, AIAnalysis, TeamImportAnalysis } from "@/types/models";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite-preview";
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const ANALYZE_MAX_HISTORY_MESSAGES = 4;
const ANALYZE_TIMEOUT_MS = 12000;
const ANALYZE_MAX_ATTEMPTS = 1;
const PLAN_TIMEOUT_MS = 25000;
const IMPORT_TIMEOUT_MS = 20000;

function isRetryableAnalyzeError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return (
    message.includes("timed out") ||
    message.includes("429") ||
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504")
  );
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Gemini request timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function compactList(value: unknown): string {
  if (!Array.isArray(value)) return "N/A";
  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
  return normalized.length > 0 ? normalized.join(", ") : "N/A";
}

const analysisJsonSchema = {
  type: "OBJECT",
  properties: {
    status: { type: "STRING", enum: ["asking", "ready"] },
    question: { type: "STRING" },
    options: { type: "ARRAY", items: { type: "STRING" } },
    summary: { type: "STRING" },
  },
  required: ["status", "options"],
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

const teamImportAnalysisJsonSchema = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    categories: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          points: {
            type: "ARRAY",
            items: { type: "STRING" },
          },
        },
        required: ["title", "points"],
      },
    },
    normalized: {
      type: "OBJECT",
      properties: {
        name: { type: "STRING" },
        industry: { type: "STRING" },
        preferredStack: { type: "ARRAY", items: { type: "STRING" } },
        values: { type: "ARRAY", items: { type: "STRING" } },
        constraints: { type: "ARRAY", items: { type: "STRING" } },
        targetAudience: { type: "ARRAY", items: { type: "STRING" } },
        designSystem: { type: "ARRAY", items: { type: "STRING" } },
      },
      required: ["name", "industry", "preferredStack", "values", "constraints", "targetAudience", "designSystem"],
    },
  },
  required: ["summary", "categories", "normalized"],
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
  teamKnowledge: unknown;
  today: string;
}): Promise<AIPlan> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  const teamKnowledge = input.teamKnowledge as Record<string, unknown>;

  const prompt = [
    `You are a product management assistant for ${teamKnowledge.name || "the team"}.`,
    "Return only valid JSON matching the required schema.",
    "Do not include markdown, comments, explanations, or extra keys.",
    "Deadlines and timeline dates must be in YYYY-MM-DD format.",
    "",
    "=== TEAM CONTEXT (use this to tailor every part of the plan) ===",
    `Team: ${teamKnowledge.name}`,
    `Industry: ${teamKnowledge.industry || "N/A"}`,
    `Preferred Methods/Stack: ${JSON.stringify(teamKnowledge.preferredStack || [])}`,
    `Core Values: ${JSON.stringify(teamKnowledge.values || [])}`,
    `Constraints: ${JSON.stringify(teamKnowledge.constraints || [])}`,
    `Target Audience: ${JSON.stringify(teamKnowledge.targetAudience || [])}`,
    `Design/System Preferences: ${JSON.stringify(teamKnowledge.designSystem || [])}`,
    "",
    "=== INSTRUCTIONS ===",
    "- The guideline MUST reference the team's values, constraints, and preferences.",
    "- Timeline phases should respect the team's delivery constraints.",
    "- Task descriptions should mention specific technologies from the preferred stack where relevant.",
    "- Suggested assignees should reflect the lean team size mentioned in constraints.",
    "- Design-related tasks should follow the team's design/system preferences.",
    "",
    `Today: ${input.today}`,
    `Project idea: ${input.projectIdea}`,
  ].join("\n");

  const response = await fetchWithTimeout(`${GEMINI_URL}?key=${apiKey}`, {
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
  }, PLAN_TIMEOUT_MS);

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
  teamKnowledge?: unknown;
}): Promise<AIAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  const ck = (input.teamKnowledge || {}) as Record<string, unknown>;
  const teamName = (ck.name as string) || "the team";

  const systemInstruction = `
You are an expert product manager supporting ${teamName}.
Keep responses short and practical.

TEAM CONTEXT
- Team: ${teamName}
- Industry: ${typeof ck.industry === "string" && ck.industry.trim() ? ck.industry : "N/A"}
- Stack: ${compactList(ck.preferredStack)}
- Constraints: ${compactList(ck.constraints)}
- Audience: ${compactList(ck.targetAudience)}

RULES
- Ask one concise clarifying question when needed.
- Include 2-4 concise options every time status is "asking".
- Do not include examples inside the question sentence.
- Set status to "ready" only after you know: duration, scale, team size, project type, and key features.
- Do not assume missing information.
- When ready, provide a concise summary tailored to team context.
`.trim();

  const recentHistory = input.history.slice(-ANALYZE_MAX_HISTORY_MESSAGES);

  const contents = recentHistory.map((msg) => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.content }],
  }));

  contents.push({
    role: "user",
    parts: [{ text: input.message }],
  });

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= ANALYZE_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        `${GEMINI_URL}?key=${apiKey}`,
        {
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
        },
        ANALYZE_TIMEOUT_MS,
      );

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
    } catch (error) {
      lastError = error;

      if (attempt >= ANALYZE_MAX_ATTEMPTS || !isRetryableAnalyzeError(error)) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, attempt * 300));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Failed to analyze project request.");
}

export async function analyzeTeamImportWithGemini(input: {
  inputType: "json" | "text";
  content: string;
}): Promise<TeamImportAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  const prompt = [
    "You analyze team/organization profile input for project planning.",
    "Return only valid JSON following the schema exactly.",
    "Do not add markdown or any extra keys.",
    "Detect categories directly from user input (industry-agnostic).",
    "Do NOT assume software-specific categories unless present.",
    "",
    "For normalized fields:",
    "- Keep arrays concise and factual.",
    "- If value is missing, use an empty array.",
    "- If name or industry is missing, set to 'Unspecified'.",
    "",
    `Input type: ${input.inputType}`,
    "=== USER INPUT START ===",
    input.content,
    "=== USER INPUT END ===",
  ].join("\n");

  const response = await fetchWithTimeout(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: teamImportAnalysisJsonSchema,
      },
    }),
  }, IMPORT_TIMEOUT_MS);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini import analysis failed: ${response.status} ${errorText}`);
  }

  const json = (await response.json()) as GeminiResponse;
  const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error("Gemini returned empty import analysis.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("Gemini returned invalid import analysis JSON.");
  }

  return validateAndNormalizeTeamImportAnalysis(parsed);
}

