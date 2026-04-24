import { sql } from "@/lib/db";
import {
  appUserSchema,
  projectSchema,
  projectInvitationSchema,
  projectMemberSchema,
  taskSchema,
  userTeamSchema,
  type AppUser,
  type Project,
  type ProjectInvitation,
  type ProjectMember,
  type Task,
  type TeamKnowledge,
  type UserTeam,
} from "@/types/models";

export function normalizeUserId(value: string): string {
  return value.trim().toLowerCase();
}

let collaborationSchemaReady: Promise<void> | null = null;

async function initializeCollaborationSchema(): Promise<void> {
  const bootstrapTimestamp = new Date().toISOString();

  await sql`
    CREATE TABLE IF NOT EXISTS app_users (
      user_id TEXT PRIMARY KEY,
      display_name TEXT,
      image_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS project_members (
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TEXT NOT NULL,
      PRIMARY KEY (project_id, user_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS project_invitations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      inviter_user_id TEXT NOT NULL,
      invitee_user_id TEXT NOT NULL,
      role TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
      created_at TEXT NOT NULL,
      responded_at TEXT
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_project_invitations_project_id ON project_invitations(project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_project_invitations_inviter_user_id ON project_invitations(inviter_user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_project_invitations_invitee_user_id ON project_invitations(invitee_user_id)`;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_project_invitations_pending_unique
    ON project_invitations(project_id, invitee_user_id)
    WHERE status = 'pending'
  `;

  await sql`
    INSERT INTO app_users (user_id, display_name, image_url, created_at, updated_at)
    SELECT DISTINCT LOWER(source.user_id), NULL, NULL, ${bootstrapTimestamp}, ${bootstrapTimestamp}
    FROM (
      SELECT user_id FROM projects
      UNION
      SELECT user_id FROM teams
      UNION
      SELECT user_id FROM github_links
    ) AS source
    WHERE source.user_id IS NOT NULL
    ON CONFLICT (user_id) DO NOTHING
  `;

  await sql`
    INSERT INTO project_members (project_id, user_id, role, joined_at)
    SELECT id, LOWER(user_id), 'owner', created_at
    FROM projects
    WHERE user_id IS NOT NULL
    ON CONFLICT (project_id, user_id) DO NOTHING
  `;
}

export async function ensureCollaborationSchema(): Promise<void> {
  if (!collaborationSchemaReady) {
    collaborationSchemaReady = initializeCollaborationSchema().catch((error) => {
      collaborationSchemaReady = null;
      throw error;
    });
  }

  await collaborationSchemaReady;
}

function mapAppUserRow(row: Record<string, unknown>): AppUser {
  return appUserSchema.parse({
    userId: String(row.user_id),
    displayName: typeof row.display_name === "string" ? row.display_name : null,
    imageUrl: typeof row.image_url === "string" ? row.image_url : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  });
}

function mapProjectMemberRow(row: Record<string, unknown>): ProjectMember {
  return projectMemberSchema.parse({
    projectId: String(row.project_id),
    userId: String(row.user_id),
    role: String(row.role || "member"),
    joinedAt: String(row.joined_at),
    displayName: typeof row.display_name === "string" ? row.display_name : null,
    imageUrl: typeof row.image_url === "string" ? row.image_url : null,
  });
}

function mapProjectInvitationRow(row: Record<string, unknown>): ProjectInvitation {
  return projectInvitationSchema.parse({
    id: String(row.id),
    projectId: String(row.project_id),
    inviterUserId: String(row.inviter_user_id),
    inviteeUserId: String(row.invitee_user_id),
    role: typeof row.role === "string" ? row.role : null,
    status: row.status,
    createdAt: String(row.created_at),
    respondedAt: typeof row.responded_at === "string" ? row.responded_at : null,
  });
}

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
// Application users
// ---------------------------------------------------------------------------

export async function getAppUserById(userId: string): Promise<AppUser | null> {
  await ensureCollaborationSchema();

  const normalizedUserId = normalizeUserId(userId);
  const rows = await sql`SELECT * FROM app_users WHERE user_id = ${normalizedUserId} LIMIT 1`;
  if (rows.length === 0) return null;

  return mapAppUserRow(rows[0] as Record<string, unknown>);
}

export async function upsertAppUser(input: {
  userId: string;
  displayName: string | null;
  imageUrl: string | null;
  timestamp: string;
}): Promise<AppUser> {
  await ensureCollaborationSchema();

  const normalizedUserId = normalizeUserId(input.userId);
  const rows = await sql`
    INSERT INTO app_users (user_id, display_name, image_url, created_at, updated_at)
    VALUES (
      ${normalizedUserId},
      ${input.displayName},
      ${input.imageUrl},
      ${input.timestamp},
      ${input.timestamp}
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
      display_name = COALESCE(EXCLUDED.display_name, app_users.display_name),
      image_url = COALESCE(EXCLUDED.image_url, app_users.image_url),
      updated_at = EXCLUDED.updated_at
    RETURNING *
  `;

  return mapAppUserRow(rows[0] as Record<string, unknown>);
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
  await ensureCollaborationSchema();

  const normalizedUserId = normalizeUserId(userId);
  const rows = await sql`
    SELECT p.*
    FROM projects p
    INNER JOIN project_members pm ON pm.project_id = p.id
    WHERE pm.user_id = ${normalizedUserId}
    ORDER BY p.created_at DESC
  `;
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
  await ensureCollaborationSchema();

  const ownerUserId = normalizeUserId(project.userId);

  await sql`
    INSERT INTO projects (id, user_id, name, idea, guideline, timeline, task_ids, created_at, updated_at)
    VALUES (
      ${project.id},
      ${ownerUserId},
      ${project.name},
      ${project.idea},
      ${project.guideline},
      ${JSON.stringify(project.timeline)}::jsonb,
      ${JSON.stringify(project.taskIds)}::jsonb,
      ${project.createdAt},
      ${project.updatedAt}
    )
  `;

  await sql`
    INSERT INTO project_members (project_id, user_id, role, joined_at)
    VALUES (${project.id}, ${ownerUserId}, 'owner', ${project.createdAt})
    ON CONFLICT (project_id, user_id) DO NOTHING
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

export async function isProjectMember(projectId: string, userId: string): Promise<boolean> {
  await ensureCollaborationSchema();

  const normalizedUserId = normalizeUserId(userId);
  const rows = await sql`
    SELECT 1
    FROM project_members
    WHERE project_id = ${projectId} AND user_id = ${normalizedUserId}
    LIMIT 1
  `;

  return rows.length > 0;
}

export async function addProjectMember(input: {
  projectId: string;
  userId: string;
  role: string;
  joinedAt: string;
}): Promise<void> {
  await ensureCollaborationSchema();

  const normalizedUserId = normalizeUserId(input.userId);
  await sql`
    INSERT INTO project_members (project_id, user_id, role, joined_at)
    VALUES (${input.projectId}, ${normalizedUserId}, ${input.role}, ${input.joinedAt})
    ON CONFLICT (project_id, user_id)
    DO UPDATE SET
      role = project_members.role
  `;
}

export async function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
  await ensureCollaborationSchema();

  const rows = await sql`
    SELECT
      pm.project_id,
      pm.user_id,
      pm.role,
      pm.joined_at,
      au.display_name,
      au.image_url
    FROM project_members pm
    LEFT JOIN app_users au ON au.user_id = pm.user_id
    WHERE pm.project_id = ${projectId}
    ORDER BY
      CASE WHEN pm.role = 'owner' THEN 0 ELSE 1 END,
      pm.joined_at ASC
  `;

  return rows.map((row) => mapProjectMemberRow(row as Record<string, unknown>));
}

export type PendingProjectInvitation = {
  id: string;
  projectId: string;
  projectName: string;
  inviterUserId: string;
  inviterDisplayName: string | null;
  role: string | null;
  invitedAt: string;
};

export async function getProjectInvitationById(invitationId: string): Promise<ProjectInvitation | null> {
  await ensureCollaborationSchema();

  const rows = await sql`SELECT * FROM project_invitations WHERE id = ${invitationId} LIMIT 1`;
  if (rows.length === 0) return null;

  return mapProjectInvitationRow(rows[0] as Record<string, unknown>);
}

export async function getPendingProjectInvitationByProjectAndInvitee(
  projectId: string,
  inviteeUserId: string,
): Promise<ProjectInvitation | null> {
  await ensureCollaborationSchema();

  const normalizedInvitee = normalizeUserId(inviteeUserId);
  const rows = await sql`
    SELECT *
    FROM project_invitations
    WHERE
      project_id = ${projectId} AND
      invitee_user_id = ${normalizedInvitee} AND
      status = 'pending'
    LIMIT 1
  `;

  if (rows.length === 0) return null;
  return mapProjectInvitationRow(rows[0] as Record<string, unknown>);
}

export async function createProjectInvitation(input: {
  id: string;
  projectId: string;
  inviterUserId: string;
  inviteeUserId: string;
  role: string | null;
  createdAt: string;
}): Promise<ProjectInvitation> {
  await ensureCollaborationSchema();

  const inviterUserId = normalizeUserId(input.inviterUserId);
  const inviteeUserId = normalizeUserId(input.inviteeUserId);

  const rows = await sql`
    INSERT INTO project_invitations (
      id,
      project_id,
      inviter_user_id,
      invitee_user_id,
      role,
      status,
      created_at,
      responded_at
    )
    VALUES (
      ${input.id},
      ${input.projectId},
      ${inviterUserId},
      ${inviteeUserId},
      ${input.role},
      'pending',
      ${input.createdAt},
      NULL
    )
    RETURNING *
  `;

  return mapProjectInvitationRow(rows[0] as Record<string, unknown>);
}

export async function getPendingProjectInvitationsByInvitee(inviteeUserId: string): Promise<PendingProjectInvitation[]> {
  await ensureCollaborationSchema();

  const normalizedInvitee = normalizeUserId(inviteeUserId);
  const rows = await sql`
    SELECT
      pi.id,
      pi.project_id,
      pi.inviter_user_id,
      pi.role,
      pi.created_at,
      p.name AS project_name,
      au.display_name AS inviter_display_name
    FROM project_invitations pi
    INNER JOIN projects p ON p.id = pi.project_id
    LEFT JOIN app_users au ON au.user_id = pi.inviter_user_id
    WHERE pi.invitee_user_id = ${normalizedInvitee} AND pi.status = 'pending'
    ORDER BY pi.created_at DESC
  `;

  return rows.map((row) => ({
    id: String(row.id),
    projectId: String(row.project_id),
    projectName: String(row.project_name),
    inviterUserId: String(row.inviter_user_id),
    inviterDisplayName: typeof row.inviter_display_name === "string" ? row.inviter_display_name : null,
    role: typeof row.role === "string" ? row.role : null,
    invitedAt: String(row.created_at),
  }));
}

export async function respondToProjectInvitation(input: {
  invitationId: string;
  inviteeUserId: string;
  action: "accept" | "decline";
  respondedAt: string;
}): Promise<ProjectInvitation | null> {
  await ensureCollaborationSchema();

  const normalizedInvitee = normalizeUserId(input.inviteeUserId);
  const nextStatus = input.action === "accept" ? "accepted" : "declined";

  const rows = await sql`
    UPDATE project_invitations
    SET
      status = ${nextStatus},
      responded_at = ${input.respondedAt}
    WHERE
      id = ${input.invitationId} AND
      invitee_user_id = ${normalizedInvitee} AND
      status = 'pending'
    RETURNING *
  `;

  if (rows.length === 0) {
    return null;
  }

  const invitation = mapProjectInvitationRow(rows[0] as Record<string, unknown>);

  if (nextStatus === "accepted") {
    await addProjectMember({
      projectId: invitation.projectId,
      userId: invitation.inviteeUserId,
      role: invitation.role || "member",
      joinedAt: input.respondedAt,
    });
  }

  return invitation;
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
