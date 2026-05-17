// Run with: npx tsx --env-file=.env.local scripts/setup-db.ts
// Creates the projects and tasks tables in the Neon database.

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  console.log("Creating tables...");

  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      idea TEXT NOT NULL,
      guideline TEXT NOT NULL,
      timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
      task_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;

  console.log("  ✓ projects table created");

  await sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      deadline TEXT NOT NULL,
      suggested_assignee TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'todo',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;

  console.log("  ✓ tasks table created");

  await sql`
    CREATE TABLE IF NOT EXISTS teams (
      user_id TEXT PRIMARY KEY,
      knowledge JSONB NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;

  console.log("  ✓ teams table created");

  await sql`
    CREATE TABLE IF NOT EXISTS github_links (
      user_id TEXT PRIMARY KEY,
      github_user_id BIGINT NOT NULL UNIQUE,
      github_login TEXT NOT NULL,
      github_name TEXT,
      github_avatar_url TEXT,
      github_email TEXT,
      access_token TEXT NOT NULL,
      scope TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;

  console.log("  ✓ github_links table created");

  await sql`
    CREATE TABLE IF NOT EXISTS app_users (
      user_id TEXT PRIMARY KEY,
      display_name TEXT,
      image_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;

  console.log("  ✓ app_users table created");

  await sql`
    CREATE TABLE IF NOT EXISTS project_members (
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TEXT NOT NULL,
      PRIMARY KEY (project_id, user_id)
    )
  `;

  console.log("  ✓ project_members table created");

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

  console.log("  ✓ project_invitations table created");

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

  console.log("  ✓ project_member_github_identities table created");

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

  console.log("  ✓ project_repositories table created");

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

  console.log("  ✓ project_agents table created");

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

  console.log("  ✓ project_activity_events table created");

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
      source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'scheduled')),
      created_at TEXT NOT NULL
    )
  `;

  console.log("  ✓ project_reports table created");

  await sql`ALTER TABLE project_reports DROP CONSTRAINT IF EXISTS project_reports_source_check`;
  await sql`
    ALTER TABLE project_reports
    ADD CONSTRAINT project_reports_source_check CHECK (source IN ('manual', 'scheduled'))
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS notification_deliveries (
      id TEXT PRIMARY KEY,
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT,
      recipient_email TEXT NOT NULL,
      channel TEXT NOT NULL CHECK (channel IN ('email')),
      event_type TEXT NOT NULL CHECK (event_type IN ('project_report_generated', 'login_info', 'project_risk_alert', 'task_deadline_alert')),
      subject TEXT NOT NULL,
      body_preview TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
      provider_message_id TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      sent_at TEXT
    )
  `;

  console.log("  notification_deliveries table created");

  // Add useful indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_teams_user_id ON teams(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_github_links_user_id ON github_links(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_github_links_github_user_id ON github_links(github_user_id)`;
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
  await sql`CREATE INDEX IF NOT EXISTS idx_notification_deliveries_project_id_created_at ON notification_deliveries(project_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_notification_deliveries_user_id_created_at ON notification_deliveries(user_id, created_at DESC)`;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_project_invitations_pending_unique
    ON project_invitations(project_id, invitee_user_id)
    WHERE status = 'pending'
  `;

  const bootstrapTimestamp = new Date().toISOString();
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

  console.log("  ✓ indexes created");
  console.log("Done! Database is ready.");
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
