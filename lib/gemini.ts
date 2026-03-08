import {
  validateAndNormalizeAIPlan,
  validateAndNormalizeAIAnalysis,
  validateAndNormalizeTeamImportAnalysis,
} from "@/lib/validators";
import type { AIPlan, AIAnalysis, TeamImportAnalysis } from "@/types/models";

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
You help users clarify their project ideas in the context of this team.

=== TEAM CONTEXT ===
Team: ${teamName}
Industry: ${ck.industry || "N/A"}
Preferred Tech Stack: ${JSON.stringify(ck.preferredStack || [])}
Core Values: ${JSON.stringify(ck.values || [])}
Constraints: ${JSON.stringify(ck.constraints || [])}
Target Audience: ${JSON.stringify(ck.targetAudience || [])}
Design System: ${JSON.stringify(ck.designSystem || [])}

=== BEHAVIOR ===
- Ask ONE clarifying question at a time if the user's idea is vague.
- Keep your questions extremely concise. DO NOT include examples (e.g., "like X or Y") in the question text itself.
- ALWAYS provide 2-5 short options for the user to pick for EVERY question. Put the examples as the options.
- ALWAYS fill the 'options' array in the JSON response when asking a question. NEVER leave it empty.
- Frame your questions and suggestions around the team's capabilities, constraints, and audience.
- CRITICAL: Before setting status to "ready", you MUST know the following information:
  1. Duration of the project
  2. Scale of the project
  3. How many members/developers will work on it
  4. Type of project (webapp, local software, ios app, etc.)
- DO NOT assume any of this information (e.g. do not assume the duration). If anything is missing, you must ask the user.
- Once you have ALL the required information (duration, scale, team size, project type, and main features), set status to "ready" and summarize the plan.
- If the user asks specifically to generate the plan but required info is missing, kindly ask for the missing info first.
- In your summary, reference the team's preferred approaches and constraints.
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

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: teamImportAnalysisJsonSchema,
      },
    }),
  });

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

