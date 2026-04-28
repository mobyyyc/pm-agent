// Run with: npx tsx --env-file=.env.local scripts/normalize-task-assignees.ts
// Normalizes existing task assignees so they resolve to the project owner in the UI.

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  const timestamp = new Date().toISOString();

  const rows = await sql`
    WITH owner_members AS (
      SELECT
        p.id AS project_id,
        COALESCE(pm.user_id, LOWER(p.user_id)) AS owner_user_id
      FROM projects p
      LEFT JOIN project_members pm
        ON pm.project_id = p.id AND pm.role = 'owner'
    )
    UPDATE tasks t
    SET
      suggested_assignee = owner_members.owner_user_id,
      updated_at = ${timestamp}
    FROM owner_members
    WHERE t.project_id = owner_members.project_id
    RETURNING t.id
  `;

  console.log(`Updated ${rows.length} task${rows.length === 1 ? "" : "s"}.`);
}

main().catch((error) => {
  console.error("Task assignee normalization failed:", error);
  process.exit(1);
});