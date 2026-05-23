import type {
  Project,
  ProjectActivityEvent,
  ProjectAgentActionProposal,
  SuggestTaskProgressUpdateActionPayload,
  Task,
} from "@/types/models";

export type GithubTaskReviewProposalDraft = Pick<
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

const ignoredTitleWords = new Set([
  "a",
  "an",
  "and",
  "for",
  "from",
  "into",
  "the",
  "this",
  "with",
  "task",
  "add",
  "build",
  "create",
  "implement",
  "update",
]);
const completionWords = new Set(["close", "closed", "complete", "completed", "done", "finish", "finished", "fix", "fixed"]);

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function getWords(value: string): string[] {
  return normalizeText(value).split(/\s+/).filter(Boolean);
}

function includesPhrase(haystack: string, needle: string): boolean {
  const normalizedHaystack = ` ${normalizeText(haystack)} `;
  const normalizedNeedle = normalizeText(needle);
  return normalizedNeedle.length > 0 && normalizedHaystack.includes(` ${normalizedNeedle} `);
}

function getCommitDetails(event: ProjectActivityEvent): {
  sha: string;
  message: string;
  branchName: string | null;
} | null {
  if (event.source !== "github" || event.entityType !== "github_commit" || event.eventType !== "github.commit.synced") {
    return null;
  }

  const sha = typeof event.metadata.sha === "string" ? event.metadata.sha : event.entityId;
  const message = typeof event.metadata.message === "string" ? event.metadata.message : event.summary;
  const branchName =
    typeof event.metadata.branchName === "string"
      ? event.metadata.branchName
      : typeof event.metadata.branch === "string"
        ? event.metadata.branch
        : null;

  return sha ? { sha, message, branchName } : null;
}

function matchTaskToCommit(task: Task, commitText: string): string | null {
  if (includesPhrase(commitText, task.id)) {
    return `Commit references task ID ${task.id}.`;
  }

  const titleKeywords = getWords(task.title).filter((word) => word.length >= 4 && !ignoredTitleWords.has(word));
  const matchedKeyword = titleKeywords.find((word) => includesPhrase(commitText, word));

  return matchedKeyword ? `Commit references task title keyword "${matchedKeyword}".` : null;
}

export function suggestStatusFromCommit(
  task: Pick<Task, "status">,
  commitMessage: string,
): Task["status"] | null {
  if (task.status === "done") return null;

  if (task.status === "todo") {
    return "in_progress";
  }

  const words = new Set(getWords(commitMessage));
  return [...completionWords].some((word) => words.has(word)) ? "done" : null;
}

export function generateGithubTaskReviewProposals(input: {
  project: Project;
  tasks: Task[];
  activityEvents: ProjectActivityEvent[];
}): GithubTaskReviewProposalDraft[] {
  const activeTasks = input.tasks.filter((task) => task.projectId === input.project.id && task.status !== "done");
  const drafts: GithubTaskReviewProposalDraft[] = [];

  for (const event of input.activityEvents) {
    const commit = getCommitDetails(event);
    if (!commit) continue;

    const commitText = [commit.message, commit.branchName].filter(Boolean).join(" ");
    for (const task of activeTasks) {
      const matchReason = matchTaskToCommit(task, commitText);
      if (!matchReason) continue;

      const suggestedStatus = suggestStatusFromCommit(task, commit.message);
      if (!suggestedStatus || suggestedStatus === task.status) continue;

      const reason = `${matchReason} Suggest changing status from ${task.status} to ${suggestedStatus}.`;
      const payload: SuggestTaskProgressUpdateActionPayload = {
        taskId: task.id,
        commitSha: commit.sha,
        commitMessage: commit.message,
        suggestedStatus,
        suggestedProgress: null,
        reason,
      };

      drafts.push({
        sourceType: "github_commit",
        sourceId: event.id,
        dedupeKey: `github-task-review:task:${task.id}:commit:${commit.sha}`,
        proposedActionType: "suggest_task_progress_update",
        title: `Update task status from commit: ${task.title}`,
        description: "A recent GitHub commit appears related to this task. Confirm the status before approval.",
        payload,
        createdBy: "system",
        confidence: null,
        requiresApproval: true,
      });
    }
  }

  return drafts;
}
