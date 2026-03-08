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

  // Add useful indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_teams_user_id ON teams(user_id)`;

  console.log("  ✓ indexes created");
  console.log("Done! Database is ready.");
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
