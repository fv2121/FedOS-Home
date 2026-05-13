# FedOS Home

FedOS Home is the user-facing command center and product runtime for FedOS.

It owns the mobile-first and desktop-continuous experience for daily briefings,
recommendations, approvals, and agreed actions. Only user-approved actions
become durable tasks in FedOS Home.

FedOS Memory remains the canonical source for priorities, permissions,
decisions, feedback, learning, and operating context. FedOS Intelligence is
reference/lab material while useful reasoning and orchestration capabilities
migrate into the Home backend.

## Quick Start

```bash
npm install
cp .env.example .env
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

The app runs on [http://localhost:3000](http://localhost:3000).

## Stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS v4
- PostgreSQL
- Prisma ORM
- Railway deployment

## Documentation

Canonical product documentation lives in `docs/`:

- [Project brief](docs/PROJECT_BRIEF.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Home-centered intelligence integration](docs/HOME_CENTERED_INTELLIGENCE_INTEGRATION.md)
- [Backlog](docs/BACKLOG.md)

The docs folder is the source of truth for planning, architecture, and backlog
tracking. FedOS Intelligence docs should be treated as migration/reference
material unless they explicitly say otherwise.

## Environment

Required local and deployment variables:

- `DATABASE_URL`
- `AUTH_PASSWORD_HASH`
- `AUTH_SECRET`

Required for real intelligence runs:

- `ANTHROPIC_API_KEY`
- `FEDOS_MEMORY_ROOT`
- `FEDOS_DIGEST_ROOT`
- `M365_CLIENT_ID`
- `M365_CLIENT_SECRET`
- `M365_TOKEN_PATH`
- `M365_TOKEN_ENCRYPTION_KEY`

Optional Microsoft 365 settings:

- `M365_TENANT_ID`
- `M365_SCOPES`

Generate a bcrypt password hash:

```bash
node -e "const b=require('bcryptjs');console.log(b.hashSync('your-password',10))"
```

Local intelligence smoke checks:

```bash
npx tsx scripts/smoke-memory-digest.ts
npx tsx scripts/test-outlook-normalizer.ts
npx tsx scripts/smoke-outlook-signals.ts
npx tsx scripts/smoke-outlook-signals.ts --feed
```

`smoke-outlook-signals.ts --feed` fetches Outlook signals and passes them into
the Home briefing pipeline with a fake LLM response. Use the authenticated
briefing API with real signals when you want a persisted package from the real
LLM.

## Deployment

Railway is connected to the FedOS Home GitHub repository and uses
`railway.json` for startup:

```bash
npm run db:deploy && npm run start
```

## Product Surface

The current app includes single-user auth, task CRUD, categories, projects,
tags, task event history, mobile-first task controls, desktop task management,
and LLM-safe task API routes. The next product direction is tracked in
[docs/BACKLOG.md](docs/BACKLOG.md).
