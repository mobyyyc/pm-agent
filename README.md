# AI PM Prototype (Gemini + Next.js)

Simple prototype for AI-assisted project planning.

## Stack

- Next.js App Router
- Tailwind
- Next.js API routes
- Neon Postgres for persistent storage
- Gemini API

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Add env var in `.env.local`:

   ```bash
   GEMINI_API_KEY=your_api_key_here
   ```

3. Run dev server:

   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000`.

## Workflow

1. Enter project idea on `/`.
2. Backend reads the signed-in user's company profile from DB (fallback: `data/company.json`).
3. Backend sends idea + company knowledge to Gemini.
4. Gemini returns structured JSON (`guideline`, `timeline`, `tasks`).
5. Backend validates output with Zod.
6. Backend saves project + tasks in Neon.
7. UI shows:
   - `My Projects` at `/projects`
   - Project dashboard at `/projects/[id]`
   - Task status updates on dashboard
8. Reminder endpoint checks near-due tasks.

## API Routes

- `GET /api/projects` - list projects
- `POST /api/projects` - create project from idea using Gemini
- `GET /api/projects/:id` - get single project + tasks
- `GET /api/company` - get current user's company profile
- `POST /api/company` - save/import current user's company profile
- `PATCH /api/tasks/:taskId/status` - update task status
- `GET /api/reminders?days=3` - near-due + overdue tasks

## Notes

- This is an MVP prototype only.
- Google auth + per-user data isolation are enabled.
