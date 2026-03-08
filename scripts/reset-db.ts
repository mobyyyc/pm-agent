// Drops old tables (no data) and recreates with the correct schema.
// Run with: npx tsx --env-file=.env.local scripts/reset-db.ts

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("Dropping old tables...");
  await sql`DROP TABLE IF EXISTS companies CASCADE`;
  await sql`DROP TABLE IF EXISTS tasks CASCADE`;
  await sql`DROP TABLE IF EXISTS projects CASCADE`;
  await sql`DROP TYPE IF EXISTS task_status CASCADE`;
  console.log("  ✓ dropped");

  console.log("Creating tables...");

  await sql`
    CREATE TABLE projects (
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
  console.log("  ✓ projects");

  await sql`
    CREATE TABLE tasks (
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
  console.log("  ✓ tasks");

  await sql`
    CREATE TABLE companies (
      user_id TEXT PRIMARY KEY,
      knowledge JSONB NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;
  console.log("  ✓ companies");

  await sql`CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_companies_user_id ON companies(user_id)`;
  console.log("  ✓ indexes");

  // Verify
  const cols = await sql`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'projects' ORDER BY ordinal_position
  `;
  console.log("\nProjects schema:");
  console.table(cols);

  console.log("Done!");
}

main().catch(console.error);
