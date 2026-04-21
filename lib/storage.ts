import { sql } from "@/lib/db";
import {
  projectSchema,
  taskSchema,
  userTeamSchema,
  type Project,
  type Task,
  type TeamKnowledge,
  type UserTeam,
} from "@/types/models";

// ---------------------------------------------------------------------------
// Team profile knowledge
// ---------------------------------------------------------------------------

export async function readDefaultTeamKnowledge(): Promise<TeamKnowledge> {
  return {
    name: "",
    industry: "",
    preferredStack: [],
    values: [],
    constraints: [],
    targetAudience: [],
    designSystem: [],
  };
}

export async function getTeamByUserId(userId: string): Promise<UserTeam | null> {
  const rows = await sql`SELECT * FROM teams WHERE user_id = ${userId} LIMIT 1`;
  if (rows.length === 0) return null;
  const row = rows[0];

  return userTeamSchema.parse({
    userId: row.user_id,
    team: row.knowledge,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export async function upsertTeamByUserId(
  userId: string,
  team: TeamKnowledge,
  timestamp: string,
): Promise<UserTeam> {
  const rows = await sql`
    INSERT INTO teams (user_id, knowledge, created_at, updated_at)
    VALUES (
      ${userId},
      ${JSON.stringify(team)}::jsonb,
      ${timestamp},
      ${timestamp}
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
      knowledge = EXCLUDED.knowledge,
      updated_at = EXCLUDED.updated_at
    RETURNING *
  `;

  const row = rows[0];

  return userTeamSchema.parse({
    userId: row.user_id,
    team: row.knowledge,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export async function deleteTeamByUserId(userId: string): Promise<void> {
  await sql`DELETE FROM teams WHERE user_id = ${userId}`;
}

export async function readTeamKnowledge(userId?: string): Promise<TeamKnowledge> {
  if (!userId) {
    return readDefaultTeamKnowledge();
  }

  const userTeam = await getTeamByUserId(userId);
  if (!userTeam) {
    return readDefaultTeamKnowledge();
  }

  return userTeam.team;
}

// ---------------------------------------------------------------------------
// Linked Github accounts
// ---------------------------------------------------------------------------

export type GithubLink = {
  userId: string;
  githubUserId: number;
  githubLogin: string;
  githubName: string | null;
  githubAvatarUrl: string | null;
  githubEmail: string | null;
  accessToken: string;
  scope: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapGithubLinkRow(row: Record<string, unknown>): GithubLink {
  return {
    userId: String(row.user_id),
    githubUserId: Number(row.github_user_id),
    githubLogin: String(row.github_login),
    githubName: typeof row.github_name === "string" ? row.github_name : null,
    githubAvatarUrl: typeof row.github_avatar_url === "string" ? row.github_avatar_url : null,
    githubEmail: typeof row.github_email === "string" ? row.github_email : null,
    accessToken: String(row.access_token),
    scope: typeof row.scope === "string" ? row.scope : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function getGithubLinkByUserId(userId: string): Promise<GithubLink | null> {
  const rows = await sql`SELECT * FROM github_links WHERE user_id = ${userId} LIMIT 1`;
  if (rows.length === 0) return null;
  return mapGithubLinkRow(rows[0] as Record<string, unknown>);
}

export async function upsertGithubLinkByUserId(input: {
  userId: string;
  githubUserId: number;
  githubLogin: string;
  githubName: string | null;
  githubAvatarUrl: string | null;
  githubEmail: string | null;
  accessToken: string;
  scope: string | null;
  timestamp: string;
}): Promise<GithubLink> {
  const rows = await sql`
    INSERT INTO github_links (
      user_id,
      github_user_id,
      github_login,
      github_name,
      github_avatar_url,
      github_email,
      access_token,
      scope,
      created_at,
      updated_at
    )
    VALUES (
      ${input.userId},
      ${input.githubUserId},
      ${input.githubLogin},
      ${input.githubName},
      ${input.githubAvatarUrl},
      ${input.githubEmail},
      ${input.accessToken},
      ${input.scope},
      ${input.timestamp},
      ${input.timestamp}
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
      github_user_id = EXCLUDED.github_user_id,
      github_login = EXCLUDED.github_login,
      github_name = EXCLUDED.github_name,
      github_avatar_url = EXCLUDED.github_avatar_url,
      github_email = EXCLUDED.github_email,
      access_token = EXCLUDED.access_token,
      scope = EXCLUDED.scope,
      updated_at = EXCLUDED.updated_at
    RETURNING *
  `;

  return mapGithubLinkRow(rows[0] as Record<string, unknown>);
}

export async function deleteGithubLinkByUserId(userId: string): Promise<void> {
  await sql`DELETE FROM github_links WHERE user_id = ${userId}`;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function getProjects(): Promise<Project[]> {
  const rows = await sql`SELECT * FROM projects ORDER BY created_at DESC`;
  return rows.map((row) =>
    projectSchema.parse({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      idea: row.idea,
      guideline: row.guideline,
      timeline: row.timeline,
      taskIds: row.task_ids,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
  );
}

export async function getProjectsByUserId(userId: string): Promise<Project[]> {
  const rows = await sql`SELECT * FROM projects WHERE user_id = ${userId} ORDER BY created_at DESC`;
  return rows.map((row) =>
    projectSchema.parse({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      idea: row.idea,
      guideline: row.guideline,
      timeline: row.timeline,
      taskIds: row.task_ids,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
  );
}

export async function getProjectById(projectId: string): Promise<Project | null> {
  const rows = await sql`SELECT * FROM projects WHERE id = ${projectId} LIMIT 1`;
  if (rows.length === 0) return null;
  const row = rows[0];
  return projectSchema.parse({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    idea: row.idea,
    guideline: row.guideline,
    timeline: row.timeline,
    taskIds: row.task_ids,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export async function insertProject(project: Project): Promise<void> {
  await sql`
    INSERT INTO projects (id, user_id, name, idea, guideline, timeline, task_ids, created_at, updated_at)
    VALUES (
      ${project.id},
      ${project.userId},
      ${project.name},
      ${project.idea},
      ${project.guideline},
      ${JSON.stringify(project.timeline)}::jsonb,
      ${JSON.stringify(project.taskIds)}::jsonb,
      ${project.createdAt},
      ${project.updatedAt}
    )
  `;
}

export async function deleteProject(projectId: string): Promise<void> {
  // Tasks are deleted via ON DELETE CASCADE
  await sql`DELETE FROM projects WHERE id = ${projectId}`;
}

export async function updateProject(
  projectId: string,
  updates: {
    name?: string;
    timeline?: Project["timeline"];
  },
  updatedAt: string,
): Promise<Project | null> {
  const nextName = updates.name ?? null;
  const nextTimelineJson = updates.timeline === undefined ? null : JSON.stringify(updates.timeline);

  const rows = await sql`
    UPDATE projects
    SET
      name = COALESCE(${nextName}, name),
      timeline = COALESCE(${nextTimelineJson}::jsonb, timeline),
      updated_at = ${updatedAt}
    WHERE id = ${projectId}
    RETURNING *
  `;

  if (rows.length === 0) return null;
  const row = rows[0];

  return projectSchema.parse({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    idea: row.idea,
    guideline: row.guideline,
    timeline: row.timeline,
    taskIds: row.task_ids,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export async function updateProjectTimeline(
  projectId: string,
  timeline: Project["timeline"],
  updatedAt: string,
): Promise<Project | null> {
  return updateProject(projectId, { timeline }, updatedAt);
}

export async function removeTaskIdFromProject(
  projectId: string,
  taskId: string,
  updatedAt: string,
): Promise<Project | null> {
  const project = await getProjectById(projectId);
  if (!project) return null;

  const nextTaskIds = project.taskIds.filter((projectTaskId) => projectTaskId !== taskId);

  const rows = await sql`
    UPDATE projects
    SET task_ids = ${JSON.stringify(nextTaskIds)}::jsonb, updated_at = ${updatedAt}
    WHERE id = ${projectId}
    RETURNING *
  `;

  if (rows.length === 0) return null;
  const row = rows[0];

  return projectSchema.parse({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    idea: row.idea,
    guideline: row.guideline,
    timeline: row.timeline,
    taskIds: row.task_ids,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export async function addTaskIdToProject(
  projectId: string,
  taskId: string,
  updatedAt: string,
): Promise<Project | null> {
  const project = await getProjectById(projectId);
  if (!project) return null;

  if (project.taskIds.includes(taskId)) {
    return project;
  }

  const nextTaskIds = [...project.taskIds, taskId];

  const rows = await sql`
    UPDATE projects
    SET task_ids = ${JSON.stringify(nextTaskIds)}::jsonb, updated_at = ${updatedAt}
    WHERE id = ${projectId}
    RETURNING *
  `;

  if (rows.length === 0) return null;
  const row = rows[0];

  return projectSchema.parse({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    idea: row.idea,
    guideline: row.guideline,
    timeline: row.timeline,
    taskIds: row.task_ids,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function getTasks(): Promise<Task[]> {
  const rows = await sql`SELECT * FROM tasks ORDER BY created_at ASC`;
  return rows.map((row) =>
    taskSchema.parse({
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      description: row.description,
      deadline: row.deadline,
      suggestedAssignee: row.suggested_assignee,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
  );
}

export async function getTasksByProjectId(projectId: string): Promise<Task[]> {
  const rows = await sql`SELECT * FROM tasks WHERE project_id = ${projectId} ORDER BY created_at ASC`;
  return rows.map((row) =>
    taskSchema.parse({
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      description: row.description,
      deadline: row.deadline,
      suggestedAssignee: row.suggested_assignee,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
  );
}

export async function getTaskById(taskId: string): Promise<Task | null> {
  const rows = await sql`SELECT * FROM tasks WHERE id = ${taskId} LIMIT 1`;
  if (rows.length === 0) return null;
  const row = rows[0];
  return taskSchema.parse({
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    deadline: row.deadline,
    suggestedAssignee: row.suggested_assignee,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export async function insertTask(task: Task): Promise<void> {
  await sql`
    INSERT INTO tasks (id, project_id, title, description, deadline, suggested_assignee, status, created_at, updated_at)
    VALUES (
      ${task.id},
      ${task.projectId},
      ${task.title},
      ${task.description},
      ${task.deadline},
      ${task.suggestedAssignee},
      ${task.status},
      ${task.createdAt},
      ${task.updatedAt}
    )
  `;
}

export async function insertTasks(tasks: Task[]): Promise<void> {
  await Promise.all(tasks.map((task) => insertTask(task)));
}

export async function updateTaskStatus(taskId: string, status: string, updatedAt: string): Promise<Task | null> {
  const rows = await sql`
    UPDATE tasks SET status = ${status}, updated_at = ${updatedAt}
    WHERE id = ${taskId}
    RETURNING *
  `;
  if (rows.length === 0) return null;
  const row = rows[0];
  return taskSchema.parse({
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    deadline: row.deadline,
    suggestedAssignee: row.suggested_assignee,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export async function updateTaskDetails(
  taskId: string,
  payload: Pick<Task, "title" | "description" | "deadline" | "suggestedAssignee" | "status">,
  updatedAt: string,
): Promise<Task | null> {
  const rows = await sql`
    UPDATE tasks
    SET
      title = ${payload.title},
      description = ${payload.description},
      deadline = ${payload.deadline},
      suggested_assignee = ${payload.suggestedAssignee},
      status = ${payload.status},
      updated_at = ${updatedAt}
    WHERE id = ${taskId}
    RETURNING *
  `;

  if (rows.length === 0) return null;
  const row = rows[0];

  return taskSchema.parse({
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    deadline: row.deadline,
    suggestedAssignee: row.suggested_assignee,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export async function deleteTaskById(taskId: string): Promise<void> {
  await sql`DELETE FROM tasks WHERE id = ${taskId}`;
}

// ---------------------------------------------------------------------------
// Combined operations
// ---------------------------------------------------------------------------

export async function createProjectWithTasks(project: Project, tasks: Task[]): Promise<void> {
  await insertProject(project);
  await insertTasks(tasks);
}

// Legacy aliases kept for backward-compatibility with any remaining callers
export async function saveProjects(_projects: Project[]): Promise<void> {
  void _projects;
  // No-op: individual insert/delete operations are used now
  throw new Error("saveProjects is no longer supported with Neon DB. Use insertProject / deleteProject instead.");
}

export async function saveTasks(_tasks: Task[]): Promise<void> {
  void _tasks;
  // No-op: individual insert/update operations are used now
  throw new Error("saveTasks is no longer supported with Neon DB. Use insertTask / updateTaskStatus instead.");
}
