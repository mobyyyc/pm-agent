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
