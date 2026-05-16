import { sql } from "@/lib/db";
import { resolveGithubContributorFromMappings } from "@/lib/github-identities";
import { decryptGithubToken, encryptGithubToken } from "@/lib/github-token-crypto";
import {
  appUserSchema,
  projectMemberGithubIdentitySchema,
  projectReportArtifactSchema,
  projectAgentSchema,
  projectActivityEventSchema,
  projectSchema,
  projectRepositorySchema,
  projectInvitationSchema,
  projectMemberSchema,
  taskSchema,
  userTeamSchema,
  type AppUser,
  type GithubContributorIdentity,
  type GithubIdentityMappingInput,
  type ProjectAgent,
  type ProjectActivityEvent,
  type ProjectActivityEntityType,
  type ProjectActivitySource,
  type Project,
  type ProjectProgressReport,
  type ProjectReportArtifact,
  type ProjectReportInputSnapshot,
  type ProjectReportPeriod,
  type ProjectRepository,
  type ProjectInvitation,
  type ProjectMember,
  type ProjectMemberGithubIdentity,
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

  await sql`
    CREATE TABLE IF NOT EXISTS project_repositories (
      project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      owner_login TEXT NOT NULL,
      repo_name TEXT NOT NULL,
      full_name TEXT NOT NULL,
      html_url TEXT NOT NULL,
      default_branch TEXT NOT NULL,
      visibility TEXT NOT NULL,
      external_id TEXT NOT NULL,
      created_by_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS project_agents (
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      agent_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('active', 'paused')),
      schedule TEXT,
      config JSONB NOT NULL DEFAULT '{}'::jsonb,
      last_run_at TEXT,
      next_run_at TEXT,
      created_by_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (project_id, agent_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS project_member_github_identities (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      member_id TEXT NOT NULL,
      github_login TEXT,
      github_name TEXT,
      github_email TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id, member_id) REFERENCES project_members(project_id, user_id) ON DELETE CASCADE
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS project_activity_events (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      actor_user_id TEXT,
      source TEXT NOT NULL CHECK (source IN ('user', 'github', 'system')),
      event_type TEXT NOT NULL,
      entity_type TEXT NOT NULL CHECK (entity_type IN ('project', 'task', 'timeline', 'repository', 'member', 'github_commit')),
      entity_id TEXT,
      summary TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS project_reports (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      created_by_user_id TEXT,
      period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly')),
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      report JSONB NOT NULL,
      input_snapshot JSONB NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual')),
      created_at TEXT NOT NULL
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_project_invitations_project_id ON project_invitations(project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_project_invitations_inviter_user_id ON project_invitations(inviter_user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_project_invitations_invitee_user_id ON project_invitations(invitee_user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_project_member_github_identities_project_id ON project_member_github_identities(project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_project_member_github_identities_member_id ON project_member_github_identities(member_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_project_repositories_provider ON project_repositories(provider)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_project_agents_project_id ON project_agents(project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_project_agents_status ON project_agents(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_project_activity_events_project_id_created_at ON project_activity_events(project_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_project_activity_events_event_type ON project_activity_events(event_type)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_project_reports_project_id_generated_at ON project_reports(project_id, generated_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_project_reports_project_id_period_generated_at ON project_reports(project_id, period, generated_at DESC)`;
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

function mapProjectMemberGithubIdentityRow(row: Record<string, unknown>): ProjectMemberGithubIdentity {
  return projectMemberGithubIdentitySchema.parse({
    id: String(row.id),
    projectId: String(row.project_id),
    memberId: String(row.member_id),
    githubLogin: typeof row.github_login === "string" ? row.github_login : null,
    githubName: typeof row.github_name === "string" ? row.github_name : null,
    githubEmail: typeof row.github_email === "string" ? row.github_email : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
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

function mapProjectRepositoryRow(row: Record<string, unknown>): ProjectRepository {
  return projectRepositorySchema.parse({
    projectId: String(row.project_id),
    provider: row.provider,
    ownerLogin: String(row.owner_login),
    repoName: String(row.repo_name),
    fullName: String(row.full_name),
    htmlUrl: String(row.html_url),
    defaultBranch: String(row.default_branch),
    visibility: row.visibility,
    externalId: String(row.external_id),
    createdByUserId: String(row.created_by_user_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  });
}

function mapProjectAgentRow(row: Record<string, unknown>): ProjectAgent {
  return projectAgentSchema.parse({
    projectId: String(row.project_id),
    agentId: String(row.agent_id),
    name: String(row.name),
    description: String(row.description),
    category: String(row.category),
    status: row.status,
    schedule: typeof row.schedule === "string" ? row.schedule : null,
    config: (row.config as Record<string, unknown>) || {},
    lastRunAt: typeof row.last_run_at === "string" ? row.last_run_at : null,
    nextRunAt: typeof row.next_run_at === "string" ? row.next_run_at : null,
    createdByUserId: String(row.created_by_user_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  });
}

function mapProjectActivityEventRow(row: Record<string, unknown>): ProjectActivityEvent {
  return projectActivityEventSchema.parse({
    id: String(row.id),
    projectId: String(row.project_id),
    actorUserId: typeof row.actor_user_id === "string" ? row.actor_user_id : null,
    source: row.source,
    eventType: String(row.event_type),
    entityType: row.entity_type,
    entityId: typeof row.entity_id === "string" ? row.entity_id : null,
    summary: String(row.summary),
    metadata: (row.metadata as Record<string, unknown>) || {},
    createdAt: String(row.created_at),
  });
}

function mapProjectReportRow(row: Record<string, unknown>): ProjectReportArtifact {
  return projectReportArtifactSchema.parse({
    id: String(row.id),
    projectId: String(row.project_id),
    createdByUserId: typeof row.created_by_user_id === "string" ? row.created_by_user_id : null,
    period: row.period,
    periodStart: String(row.period_start),
    periodEnd: String(row.period_end),
    generatedAt: String(row.generated_at),
    report: row.report,
    inputSnapshot: row.input_snapshot,
    source: row.source,
    createdAt: String(row.created_at),
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
    accessToken: decryptGithubToken(String(row.access_token)),
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
  // Stored access_token values are encrypted at rest. Set GITHUB_TOKEN_ENCRYPTION_KEY
  // in every server environment before linking GitHub accounts.
  const encryptedAccessToken = encryptGithubToken(input.accessToken);

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
      ${encryptedAccessToken},
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
// Project repositories
// ---------------------------------------------------------------------------

export async function getProjectRepositoryByProjectId(projectId: string): Promise<ProjectRepository | null> {
  await ensureCollaborationSchema();

  const rows = await sql`
    SELECT *
    FROM project_repositories
    WHERE project_id = ${projectId}
    LIMIT 1
  `;

  if (rows.length === 0) return null;
  return mapProjectRepositoryRow(rows[0] as Record<string, unknown>);
}

export async function upsertProjectRepository(input: {
  projectId: string;
  provider: "github";
  ownerLogin: string;
  repoName: string;
  fullName: string;
  htmlUrl: string;
  defaultBranch: string;
  visibility: "public" | "private";
  externalId: string;
  createdByUserId: string;
  timestamp: string;
}): Promise<ProjectRepository> {
  await ensureCollaborationSchema();

  const createdByUserId = normalizeUserId(input.createdByUserId);

  const rows = await sql`
    INSERT INTO project_repositories (
      project_id,
      provider,
      owner_login,
      repo_name,
      full_name,
      html_url,
      default_branch,
      visibility,
      external_id,
      created_by_user_id,
      created_at,
      updated_at
    )
    VALUES (
      ${input.projectId},
      ${input.provider},
      ${input.ownerLogin},
      ${input.repoName},
      ${input.fullName},
      ${input.htmlUrl},
      ${input.defaultBranch},
      ${input.visibility},
      ${input.externalId},
      ${createdByUserId},
      ${input.timestamp},
      ${input.timestamp}
    )
    ON CONFLICT (project_id)
    DO UPDATE SET
      provider = EXCLUDED.provider,
      owner_login = EXCLUDED.owner_login,
      repo_name = EXCLUDED.repo_name,
      full_name = EXCLUDED.full_name,
      html_url = EXCLUDED.html_url,
      default_branch = EXCLUDED.default_branch,
      visibility = EXCLUDED.visibility,
      external_id = EXCLUDED.external_id,
      created_by_user_id = EXCLUDED.created_by_user_id,
      updated_at = EXCLUDED.updated_at
    RETURNING *
  `;

  return mapProjectRepositoryRow(rows[0] as Record<string, unknown>);
}

export async function deleteProjectRepositoryByProjectId(projectId: string): Promise<void> {
  await ensureCollaborationSchema();

  await sql`DELETE FROM project_repositories WHERE project_id = ${projectId}`;
}

// ---------------------------------------------------------------------------
// Project agents
// ---------------------------------------------------------------------------

export async function getProjectAgentsByProjectId(projectId: string): Promise<ProjectAgent[]> {
  await ensureCollaborationSchema();

  const rows = await sql`
    SELECT *
    FROM project_agents
    WHERE project_id = ${projectId}
    ORDER BY created_at ASC
  `;

  return rows.map((row) => mapProjectAgentRow(row as Record<string, unknown>));
}

export async function getProjectAgentByProjectIdAndAgentId(
  projectId: string,
  agentId: string,
): Promise<ProjectAgent | null> {
  await ensureCollaborationSchema();

  const rows = await sql`
    SELECT *
    FROM project_agents
    WHERE project_id = ${projectId} AND agent_id = ${agentId}
    LIMIT 1
  `;

  if (rows.length === 0) return null;
  return mapProjectAgentRow(rows[0] as Record<string, unknown>);
}

export async function upsertProjectAgent(input: {
  projectId: string;
  agentId: string;
  name: string;
  description: string;
  category: string;
  status: "active" | "paused";
  schedule: string | null;
  config: Record<string, unknown>;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdByUserId: string;
  timestamp: string;
}): Promise<ProjectAgent> {
  await ensureCollaborationSchema();

  const createdByUserId = normalizeUserId(input.createdByUserId);
  const rows = await sql`
    INSERT INTO project_agents (
      project_id,
      agent_id,
      name,
      description,
      category,
      status,
      schedule,
      config,
      last_run_at,
      next_run_at,
      created_by_user_id,
      created_at,
      updated_at
    )
    VALUES (
      ${input.projectId},
      ${input.agentId},
      ${input.name},
      ${input.description},
      ${input.category},
      ${input.status},
      ${input.schedule},
      ${JSON.stringify(input.config)}::jsonb,
      ${input.lastRunAt},
      ${input.nextRunAt},
      ${createdByUserId},
      ${input.timestamp},
      ${input.timestamp}
    )
    ON CONFLICT (project_id, agent_id)
    DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      category = EXCLUDED.category,
      status = EXCLUDED.status,
      schedule = EXCLUDED.schedule,
      config = EXCLUDED.config,
      last_run_at = EXCLUDED.last_run_at,
      next_run_at = EXCLUDED.next_run_at,
      created_by_user_id = EXCLUDED.created_by_user_id,
      updated_at = EXCLUDED.updated_at
    RETURNING *
  `;

  return mapProjectAgentRow(rows[0] as Record<string, unknown>);
}

export async function updateProjectAgent(
  projectId: string,
  agentId: string,
  updates: {
    status?: "active" | "paused";
    schedule?: string | null;
    config?: Record<string, unknown>;
  },
  timestamp: string,
): Promise<ProjectAgent | null> {
  await ensureCollaborationSchema();

  const shouldUpdateSchedule = Object.prototype.hasOwnProperty.call(updates, "schedule");
  const shouldUpdateConfig = Object.prototype.hasOwnProperty.call(updates, "config");
  const nextSchedule = shouldUpdateSchedule ? updates.schedule ?? null : null;
  const nextConfigJson = shouldUpdateConfig ? JSON.stringify(updates.config ?? {}) : "{}";
  const nextStatus = updates.status ?? null;

  const rows = await sql`
    UPDATE project_agents
    SET
      status = COALESCE(${nextStatus}, status),
      schedule = CASE WHEN ${shouldUpdateSchedule} THEN ${nextSchedule} ELSE schedule END,
      config = CASE WHEN ${shouldUpdateConfig} THEN ${nextConfigJson}::jsonb ELSE config END,
      updated_at = ${timestamp}
    WHERE project_id = ${projectId} AND agent_id = ${agentId}
    RETURNING *
  `;

  if (rows.length === 0) return null;
  return mapProjectAgentRow(rows[0] as Record<string, unknown>);
}

export async function deleteProjectAgent(projectId: string, agentId: string): Promise<void> {
  await ensureCollaborationSchema();

  await sql`
    DELETE FROM project_agents
    WHERE project_id = ${projectId} AND agent_id = ${agentId}
  `;
}

// ---------------------------------------------------------------------------
// Project activity events
// ---------------------------------------------------------------------------

export async function insertProjectActivityEvent(input: {
  id: string;
  projectId: string;
  actorUserId: string | null;
  source: ProjectActivitySource;
  eventType: string;
  entityType: ProjectActivityEntityType;
  entityId: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}): Promise<ProjectActivityEvent> {
  await ensureCollaborationSchema();

  const actorUserId = input.actorUserId ? normalizeUserId(input.actorUserId) : null;
  const rows = await sql`
    INSERT INTO project_activity_events (
      id,
      project_id,
      actor_user_id,
      source,
      event_type,
      entity_type,
      entity_id,
      summary,
      metadata,
      created_at
    )
    VALUES (
      ${input.id},
      ${input.projectId},
      ${actorUserId},
      ${input.source},
      ${input.eventType},
      ${input.entityType},
      ${input.entityId},
      ${input.summary},
      ${JSON.stringify(input.metadata || {})}::jsonb,
      ${input.createdAt}
    )
    RETURNING *
  `;

  return mapProjectActivityEventRow(rows[0] as Record<string, unknown>);
}

export async function insertProjectActivityEvents(
  events: Array<Parameters<typeof insertProjectActivityEvent>[0]>,
): Promise<ProjectActivityEvent[]> {
  const inserted: ProjectActivityEvent[] = [];

  for (const event of events) {
    inserted.push(await insertProjectActivityEvent(event));
  }

  return inserted;
}

export async function logProjectActivityEvent(input: Omit<Parameters<typeof insertProjectActivityEvent>[0], "id"> & {
  id?: string;
}): Promise<void> {
  try {
    await insertProjectActivityEvent({
      ...input,
      id: input.id || `activity_${crypto.randomUUID()}`,
    });
  } catch (error) {
    console.error("[project_activity_events] Failed to log activity event:", error);
  }
}

export async function getProjectActivityEventsByProjectId(
  projectId: string,
  limit: number,
): Promise<ProjectActivityEvent[]> {
  await ensureCollaborationSchema();

  const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
  const rows = await sql`
    SELECT *
    FROM project_activity_events
    WHERE project_id = ${projectId}
    ORDER BY created_at DESC
    LIMIT ${safeLimit}
  `;

  return rows.map((row) => mapProjectActivityEventRow(row as Record<string, unknown>));
}

export async function insertGithubCommitActivityEvents(
  events: Array<Parameters<typeof insertProjectActivityEvent>[0]>,
): Promise<{ inserted: ProjectActivityEvent[]; skippedCount: number }> {
  await ensureCollaborationSchema();

  const inserted: ProjectActivityEvent[] = [];

  for (const event of events) {
    const actorUserId = event.actorUserId ? normalizeUserId(event.actorUserId) : null;
    const rows = await sql`
      INSERT INTO project_activity_events (
        id,
        project_id,
        actor_user_id,
        source,
        event_type,
        entity_type,
        entity_id,
        summary,
        metadata,
        created_at
      )
      VALUES (
        ${event.id},
        ${event.projectId},
        ${actorUserId},
        ${event.source},
        ${event.eventType},
        ${event.entityType},
        ${event.entityId},
        ${event.summary},
        ${JSON.stringify(event.metadata || {})}::jsonb,
        ${event.createdAt}
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING *
    `;

    if (rows.length > 0) {
      inserted.push(mapProjectActivityEventRow(rows[0] as Record<string, unknown>));
    }
  }

  return {
    inserted,
    skippedCount: Math.max(0, events.length - inserted.length),
  };
}

// ---------------------------------------------------------------------------
// Project report artifacts
// ---------------------------------------------------------------------------

export async function insertProjectReport(input: {
  id: string;
  projectId: string;
  createdByUserId: string | null;
  period: ProjectReportPeriod;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  report: ProjectProgressReport;
  inputSnapshot: ProjectReportInputSnapshot;
  source: "manual";
  createdAt: string;
}): Promise<ProjectReportArtifact> {
  await ensureCollaborationSchema();

  const createdByUserId = input.createdByUserId ? normalizeUserId(input.createdByUserId) : null;
  const rows = await sql`
    INSERT INTO project_reports (
      id,
      project_id,
      created_by_user_id,
      period,
      period_start,
      period_end,
      generated_at,
      report,
      input_snapshot,
      source,
      created_at
    )
    VALUES (
      ${input.id},
      ${input.projectId},
      ${createdByUserId},
      ${input.period},
      ${input.periodStart},
      ${input.periodEnd},
      ${input.generatedAt},
      ${JSON.stringify(input.report)}::jsonb,
      ${JSON.stringify(input.inputSnapshot)}::jsonb,
      ${input.source},
      ${input.createdAt}
    )
    RETURNING *
  `;

  return mapProjectReportRow(rows[0] as Record<string, unknown>);
}

export async function getProjectReportsByProjectId(input: {
  projectId: string;
  period?: ProjectReportPeriod;
  limit: number;
}): Promise<ProjectReportArtifact[]> {
  await ensureCollaborationSchema();

  const safeLimit = Math.min(50, Math.max(1, Math.floor(input.limit)));
  const period = input.period ?? null;
  const rows = await sql`
    SELECT *
    FROM project_reports
    WHERE project_id = ${input.projectId}
      AND (${period}::text IS NULL OR period = ${period})
    ORDER BY generated_at DESC
    LIMIT ${safeLimit}
  `;

  return rows.map((row) => mapProjectReportRow(row as Record<string, unknown>));
}

export async function getLatestProjectReportByProjectId(input: {
  projectId: string;
  period?: ProjectReportPeriod;
}): Promise<ProjectReportArtifact | null> {
  const reports = await getProjectReportsByProjectId({
    projectId: input.projectId,
    period: input.period,
    limit: 1,
  });

  return reports[0] || null;
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

// ---------------------------------------------------------------------------
// Project member GitHub identities
// ---------------------------------------------------------------------------

function normalizeNullableIdentity(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export async function getGithubIdentityMappingsByProjectId(
  projectId: string,
): Promise<ProjectMemberGithubIdentity[]> {
  await ensureCollaborationSchema();

  const rows = await sql`
    SELECT *
    FROM project_member_github_identities
    WHERE project_id = ${projectId}
    ORDER BY created_at ASC
  `;

  return rows.map((row) => mapProjectMemberGithubIdentityRow(row as Record<string, unknown>));
}

export async function upsertGithubIdentityMapping(input: GithubIdentityMappingInput & {
  projectId: string;
  timestamp: string;
}): Promise<ProjectMemberGithubIdentity> {
  await ensureCollaborationSchema();

  const id = input.id || `github_identity_${crypto.randomUUID()}`;
  const memberId = normalizeUserId(input.memberId);
  const githubLogin = normalizeNullableIdentity(input.githubLogin);
  const githubName = normalizeNullableIdentity(input.githubName);
  const githubEmail = normalizeNullableIdentity(input.githubEmail)?.toLowerCase() || null;

  const rows = await sql`
    INSERT INTO project_member_github_identities (
      id,
      project_id,
      member_id,
      github_login,
      github_name,
      github_email,
      created_at,
      updated_at
    )
    VALUES (
      ${id},
      ${input.projectId},
      ${memberId},
      ${githubLogin},
      ${githubName},
      ${githubEmail},
      ${input.timestamp},
      ${input.timestamp}
    )
    ON CONFLICT (id)
    DO UPDATE SET
      member_id = EXCLUDED.member_id,
      github_login = EXCLUDED.github_login,
      github_name = EXCLUDED.github_name,
      github_email = EXCLUDED.github_email,
      updated_at = EXCLUDED.updated_at
    WHERE project_member_github_identities.project_id = EXCLUDED.project_id
    RETURNING *
  `;

  if (rows.length === 0) {
    throw new Error("GitHub identity mapping not found.");
  }

  return mapProjectMemberGithubIdentityRow(rows[0] as Record<string, unknown>);
}

export async function deleteGithubIdentityMapping(mappingId: string, projectId: string): Promise<boolean> {
  await ensureCollaborationSchema();

  const rows = await sql`
    DELETE FROM project_member_github_identities
    WHERE id = ${mappingId} AND project_id = ${projectId}
    RETURNING id
  `;

  return rows.length > 0;
}

export async function resolveGithubContributorToMember(
  projectId: string,
  contributor: GithubContributorIdentity,
): Promise<ProjectMember | null> {
  const [mappings, members] = await Promise.all([
    getGithubIdentityMappingsByProjectId(projectId),
    getProjectMembers(projectId),
  ]);

  return resolveGithubContributorFromMappings(mappings, members, contributor);
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
