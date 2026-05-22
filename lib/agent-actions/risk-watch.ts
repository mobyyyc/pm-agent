import type {
  AssignTaskOwnerActionPayload,
  Project,
  ProjectAgentActionProposal,
  ProjectHealthSummary,
  ProjectMember,
  Task,
} from "@/types/models";

export type RiskWatchProposalDraft = Pick<
  ProjectAgentActionProposal,
  | "sourceType"
  | "sourceId"
  | "dedupeKey"
  | "proposedActionType"
  | "title"
  | "description"
  | "payload"
  | "createdBy"
  | "confidence"
  | "requiresApproval"
>;

type GenerateRiskWatchProposalsInput = {
  project: Project;
  tasks: Task[];
  members: ProjectMember[];
  health: ProjectHealthSummary;
  now: Date | string;
};

export function isTaskUnassigned(task: Pick<Task, "suggestedAssignee">): boolean {
  const assignee = task.suggestedAssignee.trim().toLowerCase();
  return assignee === "" || assignee === "unassigned";
}

function toDateString(value: Date | string): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "1970-01-01" : value.toISOString().slice(0, 10);
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "1970-01-01" : parsed.toISOString().slice(0, 10);
}

function isTaskOverdue(task: Pick<Task, "deadline" | "status">, today: string): boolean {
  return task.status !== "done" && /^\d{4}-\d{2}-\d{2}$/.test(task.deadline) && task.deadline < today;
}

export function generateRiskWatchProposals({
  project,
  tasks,
  members,
  health,
  now,
}: GenerateRiskWatchProposalsInput): RiskWatchProposalDraft[] {
  void members;
  void health;

  const today = toDateString(now);

  return tasks
    .filter((task) => task.projectId === project.id)
    .filter((task) => task.status !== "done")
    .filter(isTaskUnassigned)
    .map((task) => {
      const overdue = isTaskOverdue(task, today);
      const title = overdue
        ? `Assign owner to overdue task: ${task.title}`
        : `Assign owner to task: ${task.title}`;
      const reason = overdue
        ? `Task is overdue as of ${task.deadline} and has no owner.`
        : "Task is active and has no owner.";
      const description = overdue
        ? `Risk Watch found an unassigned active task past its deadline. Select a project member to take ownership before execution.`
        : `Risk Watch found an active task without an owner. Select a project member before execution.`;
      const payload: AssignTaskOwnerActionPayload = {
        taskId: task.id,
        assigneeMemberId: null,
        reason,
      };

      return {
        sourceType: "task",
        sourceId: task.id,
        dedupeKey: overdue
          ? `risk-watch:assign-owner:task:${task.id}:overdue:${task.deadline}`
          : `risk-watch:assign-owner:task:${task.id}:unassigned`,
        proposedActionType: "assign_task_owner",
        title,
        description,
        payload,
        createdBy: "system",
        confidence: null,
        requiresApproval: true,
      };
    });
}

export function countNewProposalDrafts(
  drafts: RiskWatchProposalDraft[],
  existingPendingProposals: Pick<ProjectAgentActionProposal, "dedupeKey" | "status">[],
): number {
  const existingPendingDedupeKeys = new Set(
    existingPendingProposals
      .filter((proposal) => proposal.status === "pending")
      .map((proposal) => proposal.dedupeKey),
  );

  return drafts.filter((draft) => !existingPendingDedupeKeys.has(draft.dedupeKey)).length;
}
