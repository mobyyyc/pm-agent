import type { TeamKnowledge } from "@/types/models";
import { validateTeamKnowledge } from "@/lib/validators";

function splitList(input: string): string[] {
  return input
    .split(/[\n,;|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractField(text: string, key: string): string {
  const regex = new RegExp(`(?:^|\\n)\\s*${key}\\s*:\\s*(.+)`, "i");
  const match = text.match(regex);
  return match?.[1]?.trim() || "";
}

export function parseTeamFromJson(content: string): TeamKnowledge {
  const parsed = JSON.parse(content);
  return validateTeamKnowledge(parsed);
}

export function parseTeamFromText(content: string): TeamKnowledge {
  const name = extractField(content, "name") || "Unknown Team";
  const industry = extractField(content, "industry") || "Unspecified";

  const preferredStack = splitList(extractField(content, "preferred stack") || extractField(content, "stack"));
  const values = splitList(extractField(content, "values"));
  const constraints = splitList(extractField(content, "constraints"));
  const targetAudience = splitList(
    extractField(content, "target audience") || extractField(content, "audience"),
  );
  const designSystem = splitList(
    extractField(content, "design system") || extractField(content, "design"),
  );

  return validateTeamKnowledge({
    name,
    industry,
    preferredStack,
    values,
    constraints,
    targetAudience,
    designSystem,
  });
}
