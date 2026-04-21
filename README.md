# PM Agent (AI PM Prototype)

AI-assisted project planning app built with Next.js, Gemini, NextAuth, and Neon Postgres.

This README has been updated to include feature coverage through **2026-04-21**.

## Current Feature Set

### Project Planning + AI

- Generate project plans from a plain-language idea using Gemini.
- Multi-step refinement flow before final plan creation.
- AI returns structured output (project name, guideline, timeline, tasks) validated with Zod.
- Team profile context is injected into planning/analyze requests for better relevance.
- Project analyze endpoint supports chat-style follow-up with history.

### Project Dashboard

- View project details, guideline, timeline, and tasks on the project page.
- Inline edit for timeline items (update/remove).
- Inline edit for task details (title, description, deadline, assignee, status).
- Add/remove timeline items and tasks from the dashboard.
- Edit project title inline with a minimal icon trigger.
- Title editor supports Enter to save, Escape to cancel, and blur-save behavior.
- Full-width title underline in edit mode with theme-specific 50% contrast line color.
- Sidebar project name updates immediately after title rename (no refresh required).

### Tasks + Status + Reminders

- Task status switching (`todo`, `in_progress`, `done`) from the dashboard.
- Dedicated status API endpoint.
- Reminder endpoint for upcoming/overdue tasks by configurable day window.

### Team Profile / Company Context

- Team/company profile import from text or JSON.
- AI-powered profile analysis and normalization endpoint.
- Profile overview, import workflow, reset workflow.
- Upload UX improvements and import progress bar.

### Authentication + Data Access

- Google sign-in via NextAuth.
- Per-user project/task/team data isolation.
- Guest mode support (temporary in-memory projects/tasks).
- Correct project visibility and authorization checks across APIs.

### Settings + Integrations

- Redesigned settings page.
- GitHub account linking via OAuth start/callback flow.
- GitHub unlink + token revoke attempt.
- Linked GitHub account display includes login/name/email metadata and avatar.
- GitHub-related settings and API scaffolding for repo-connected workflows.

### UI / Product Polish

- Dark/light theme support.
- Visual background/effects updates.
- Normalized spacing/paddings and continued UI cleanup.
- Improved not-found page.
- Added Terms/Privacy/Cookies pages.
- Members tab scaffold on project details.
- Font updates and style refinements.

## Commit-Derived Milestone Timeline

Reviewed from first commit through latest commit on 2026-04-21.

- **2026-03-04**: Initial app scaffold, core planning flow, Google credential setup, workflow redesign, project auth, refinement process.
- **2026-03-05**: UI format updates, visual effects/background upgrades.
- **2026-03-06**: Database connection, visibility/auth bug fixes, guest mode, deployment and RAG fixes.
- **2026-03-07**: Refinement stability and UX improvements.
- **2026-03-08**: Company/team info upload, reset/import UX, progress bar, optimized AI responses, terms page, improved 404, additional UI/deployment fixes.
- **2026-03-09**: Members tab added.
- **2026-03-10 to 2026-03-17**: Ongoing UI and bug-fix iterations.
- **2026-04-17**: Padding normalization and optimization/UI tuning.
- **2026-04-18**: Edit feature introduced and subsequent bug-fix follow-up.
- **2026-04-19**: Light mode, font changes, settings redesign, GitHub account/repo integration groundwork, deployment/UI fixes.
- **2026-04-20**: Additional feature expansion.
- **2026-04-21**: Editable project title shipped; latest updates include title-edit UX polish, nav-name sync on rename, and GitHub avatar display in settings.

## Tech Stack

- Next.js App Router
- React
- Tailwind CSS
- NextAuth (Google provider)
- Neon Postgres (`@neondatabase/serverless`)
- Gemini API
- Zod validation

## Environment Variables

Create `.env.local` and set:

```bash
GEMINI_API_KEY=your_gemini_key
DATABASE_URL=your_neon_database_url

GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret

GITHUB_CLIENT_ID=your_github_oauth_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_client_secret

# Recommended for NextAuth in production
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000
```

## Local Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run the app:

   ```bash
   npm run dev
   ```

3. Open `http://localhost:3000`.

## API Routes

### Auth

- `GET/POST /api/auth/[...nextauth]`

### Projects

- `GET /api/projects` - list projects for current user
- `POST /api/projects` - create project from idea (guest or signed-in)
- `POST /api/projects/analyze` - analyze/refine project input
- `GET /api/projects/:id` - get project + tasks
- `PATCH /api/projects/:id` - update project fields (name and/or timeline)
- `DELETE /api/projects/:id` - delete project

### Tasks

- `POST /api/tasks` - create task under a project
- `PATCH /api/tasks/:taskId` - update full task details
- `DELETE /api/tasks/:taskId` - delete task
- `PATCH /api/tasks/:taskId/status` - update status only

### Team Profile

- `GET /api/team` - fetch saved team profile (or default)
- `POST /api/team` - save manual profile or import profile content
- `DELETE /api/team` - reset team profile
- `POST /api/team/analyze` - AI analyze imported profile content

### GitHub Linking

- `GET /api/github/link` - fetch linked GitHub account info
- `DELETE /api/github/link` - unlink GitHub account (with revoke attempt)
- `GET /api/github/link/start` - start GitHub OAuth
- `GET /api/github/link/callback` - complete OAuth callback

### Reminders

- `GET /api/reminders?days=3` - get upcoming/overdue reminders

## Notes

- This remains an MVP with active iteration.
- Commit history includes many bug-fix and UI polish commits in addition to feature commits.
