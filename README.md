# FedOS Home

FedOS Home is the user-facing command center for FedOS.

It owns the approved task system and provides the one-stop interface for:
- today’s priorities
- agreed tasks
- approvals
- briefings
- recommendations
- links back to source context

FedOS Memory remains the canonical source for priorities, permissions,
decisions, feedback, learning, and operating context.

FedOS Intelligence remains the reasoning/orchestration service that ingests
fresh signals and proposes briefings, recommendations, and draft actions.

Only user-approved actions become durable tasks in FedOS Home.


## Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS v4
- PostgreSQL
- Prisma ORM
- Railway deployment

## Features (V1)

- Single-user auth gate
- Task CRUD plus complete, defer, drop
- Categories, projects, tags data model
- Search and filtering
- Group by category
- Task mutation history in task_events
- Mobile-first task controls with bottom navigation and fast add
- Desktop layout with left nav, list, and detail pane
- LLM-safe API contract routes

## Data Model

Implemented in prisma/schema.prisma with:

- tasks
- categories
- projects
- tags
- task_tags
- task_events
- task_sources

## Local Setup

1. Install dependencies

	npm install

2. Configure environment

	cp .env.example .env

3. Point DATABASE_URL to PostgreSQL

4. Run migrations and seed

	npm run db:generate
	npm run db:migrate
	npm run db:seed

5. Start app

	npm run dev

The app runs on http://localhost:3000.

## Auth

Single-user password auth uses bcrypt-hashed passwords:

- AUTH_PASSWORD_HASH (bcrypt hash of password)
- AUTH_SECRET

Generate a hash: `node -e "const b=require('bcryptjs');console.log(b.hashSync('your-password',10))"`

Login is rate-limited to 5 attempts per IP per 15 minutes.

Default fallback exists for development only (password: "fedos"). Set secure values before deployment.

## LLM API Contract

All routes are under /api/llm and require auth cookie.

- POST /api/llm/searchTasks
- POST /api/llm/getTask
- POST /api/llm/createTask
- POST /api/llm/updateTask
- POST /api/llm/completeTask
- POST /api/llm/deferTask
- POST /api/llm/addTaskNote
- POST /api/llm/getTaskHistory
- POST /api/llm/summarizeTasks
- GET /api/llm/listCategories
- POST /api/llm/createCategory
- POST /api/llm/updateTaskCategory

Every task mutation writes task_events.

## Railway Deployment

1. Create Railway project and PostgreSQL service
2. Set environment variables:

- DATABASE_URL
- AUTH_PASSWORD_HASH
- AUTH_SECRET

3. Connect GitHub repository
4. Deploy service

railway.json runs migrations at startup:

	npm run db:deploy && npm run start

## Mobile Use (PWA)

The app ships as a basic PWA — no offline task editing.

**Install on iOS (Safari):**

1. Deploy to Railway and open the HTTPS Railway URL in Safari.
2. Log in with your password.
3. Tap the Share icon → "Add to Home Screen".
4. Accept the default name ("FedOS Home") and tap Add.

**Install on Android (Chrome):**

1. Open the HTTPS Railway URL in Chrome.
2. Log in.
3. Tap the browser menu → "Add to Home Screen" (or accept the install banner if it appears).

**Environment variables required for deployment:**

```
DATABASE_URL=postgresql://...      # PostgreSQL connection string from Railway
AUTH_PASSWORD_HASH=...             # bcrypt hash: node -e "const b=require('bcryptjs');console.log(b.hashSync('your-password',10))"
AUTH_SECRET=...                    # Random string used as HMAC signing key
```

The app requires an active network connection. Offline task editing is not included in this PWA pass.

## GitHub Repository Setup

From this folder:

	git init
	git add .
	git commit -m "Initial fedos-home app"
	git branch -M main
	git remote add origin git@github.com:<your-user>/fedos-home.git
	git push -u origin main

## Morning Briefing Readiness

The schema supports future ingestion links via task_sources for:

- email
- calendar
- message
- llm
- fedos

V1 does not implement external ingestion pipelines.
