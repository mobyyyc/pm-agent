import type { AgentDefinition } from "@/types/models";

const agentCatalog: AgentDefinition[] = [
  {
    id: "weekly-report",
    name: "Weekly Report Agent",
    tagline: "Builds your weekly PM summary automatically",
    category: "Reporting",
    description:
      "Summarizes completed work, blockers, upcoming deadlines, and key risks for stakeholders.",
    recommendedSchedule: "0 9 * * MON",
    tags: ["weekly", "report", "stakeholder"],
  },
  {
    id: "daily-standup",
    name: "Standup Digest Agent",
    tagline: "Generates concise daily standup updates",
    category: "Communication",
    description:
      "Compiles task movement and repository activity into a daily Yesterday/Today/Blockers digest.",
    recommendedSchedule: "0 9 * * MON-FRI",
    tags: ["daily", "standup", "digest"],
  },
  {
    id: "risk-watch",
    name: "Risk Watch Agent",
    tagline: "Monitors tasks for delay and delivery risk",
    category: "Monitoring",
    description:
      "Flags likely delays based on deadlines, status stagnation, and dependency patterns.",
    recommendedSchedule: "0 */6 * * *",
    tags: ["risk", "monitoring", "alerts"],
  },
  {
    id: "backlog-triage",
    name: "Backlog Triage Agent",
    tagline: "Prioritizes and organizes incoming work",
    category: "Planning",
    description:
      "Categorizes tasks by urgency and impact and suggests ordering for the next iteration.",
    recommendedSchedule: null,
    tags: ["backlog", "triage", "prioritization"],
  },
];

export function getAgentCatalog(): AgentDefinition[] {
  return agentCatalog;
}

export function findAgentDefinition(agentId: string): AgentDefinition | null {
  return agentCatalog.find((agent) => agent.id === agentId) || null;
}
