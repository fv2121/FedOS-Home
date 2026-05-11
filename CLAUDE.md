@AGENTS.md

# FedOS Home

FedOS Home is the main user-facing shell for FedOS. It is evolving from a task execution app into the command center for daily priorities, agreed actions, approvals, briefings, and follow-up.

This app owns the canonical task system. Any action that Federico has approved should be represented here as a durable task with status, priority, due date, source linkage, and event history. Do not introduce a competing task source of truth elsewhere.

FedOS Home is one of three independent FedOS components:

- **FedOS Home**: user experience and canonical agreed-task store.
- **FedOS Memory**: Markdown memory for priorities, principles, permissions, decisions, feedback, learning, and context.
- **FedOS Intelligence**: reasoning/orchestration service for source ingestion, prioritization, briefings, and recommendations.

Important product rule: signals and recommendations are not tasks. FedOS Intelligence may propose draft actions, but they become real tasks only after Federico approves them. Once created, FedOS Home tasks become signals themselves: overdue work, blocked items, completions, changes, and repeated deferrals should feed future reasoning and briefings.

When making changes, preserve this boundary: FedOS Home records what has been agreed; FedOS Memory explains what matters and why; FedOS Intelligence interprets fresh signals and recommends what may need attention.


## Stack

- Next.js 16 (App Router) with `force-dynamic` rendering
- TypeScript 5 (strict mode)
- React 19
- Tailwind CSS v4 (utility-first, no separate CSS modules)
- PostgreSQL via Prisma ORM 6.18
- Zod 4 for runtime validation
- Railway deployment (NIXPACKS builder)

## Architecture

```
src/
├── proxy.ts                  # Auth proxy (Next.js 16 middleware convention)
├── app/
│   ├── layout.tsx            # Root layout (Manrope + Space Mono fonts, metadata)
│   ├── page.tsx              # Home: server-side data fetch → TaskDashboard
│   ├── login/page.tsx        # Login page
│   ├── globals.css           # Tailwind imports + CSS variables + scrollbar styles
│   └── api/
│       ├── auth/             # login/logout routes (rate-limited)
│       ├── health/           # Health check
│       └── llm/              # 12 LLM-safe API contract routes (all POST except listCategories GET)
├── components/
│   ├── task-dashboard.tsx    # Dashboard orchestrator (composes sub-components)
│   ├── dashboard-types.ts    # Shared types: TaskRow, Category, Project, Tag
│   ├── use-task-actions.ts   # Hook: mutations + URL state management
│   ├── task-card.tsx         # Single task card with actions
│   ├── task-filters.tsx      # Search bar + filter dropdowns
│   ├── task-detail-pane.tsx  # Right sidebar task detail view
│   ├── quick-add-bar.tsx     # Mobile quick-add form
│   ├── bottom-nav.tsx        # Mobile bottom navigation
│   └── login-form.tsx        # Password entry form
└── lib/
    ├── task-service.ts       # Business logic layer (all CRUD + queries)
    ├── auth.ts               # HMAC-SHA256 session tokens, bcrypt password validation
    ├── api-auth.ts           # Request-level auth check (cookie verification)
    ├── auth-constants.ts     # AUTH_COOKIE_NAME
    ├── constants.ts          # Enums: TASK_STATUSES, TASK_PRIORITIES, VIEW_OPTIONS, etc.
    ├── validators.ts         # Zod schemas for all API inputs
    ├── http.ts               # ok() and fail() response helpers
    ├── route-helpers.ts      # requireJson() and requireAuth() wrappers
    ├── rate-limit.ts         # In-memory sliding window rate limiter
    ├── slugify.ts            # Shared slugify utility
    └── prisma.ts             # Singleton PrismaClient
```

### Layer Responsibilities

- **Database (Prisma)**: 7 models — Task, Category, Project, Tag, TaskTag, TaskEvent, TaskSource. Enums for status, priority, source type, actor type, project status.
- **Service (lib/task-service.ts)**: All business logic. Transactional mutations. Query builder with dynamic filtering. Every mutation writes to task_events for audit trail.
- **API routes (app/api/llm/*)**: Thin delegation layer. Each route: validate with Zod → check auth → call service → return ok/fail response. No business logic in routes.
- **Components**: TaskDashboard orchestrator composes TaskFilters, TaskCard, TaskDetailPane, QuickAddBar, BottomNav. Mutation logic lives in useTaskActions hook.
- **Proxy (proxy.ts)**: Cookie-based session check, redirects unauthenticated users to /login.

### API Route Pattern

All 12 LLM routes follow this pattern:
```typescript
const parsed = await requireJson(request, schema);
if (parsed.error) return parsed.error;
try {
  const result = await serviceFunction(parsed.data);
  return ok(result);
} catch (error) {
  return fail("description", 500, String(error));
}
```

### Authentication

- Single-user password auth with bcrypt hashing (AUTH_PASSWORD_HASH env var)
- HMAC-SHA256 signed session tokens with 30-day TTL
- httpOnly, sameSite=lax cookies (secure in production)
- Middleware checks token structure/expiry; route helpers verify full signature
- Rate limiting on login: 5 attempts per IP per 15-minute window
- AUTH_PASSWORD_HASH must be set in all environments (no built-in fallback)

## Database

Schema: `prisma/schema.prisma`

Key indexes: task status, priority, due_at, category_id, project_id, composite (task_id, created_at) on events.

task_events stores old_value/new_value as JSON with actor (user/llm/system) and optional reason.

task_sources supports future ingestion: manual, email, calendar, message, llm, fedos.

## Commands

```bash
npm run dev              # Dev server on :3000
npm run build            # Production build
npm run lint             # ESLint (flat config, next/core-web-vitals + typescript)
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Dev migrations
npm run db:deploy        # Production migrations
npm run db:seed          # Seed categories + sample tasks
npm run db:studio        # Prisma Studio GUI
```

## Environment Variables

```
DATABASE_URL=postgresql://...    # Required
AUTH_PASSWORD_HASH=...           # Required for deployment (bcrypt hash)
AUTH_SECRET=...                  # Required for deployment (HMAC key)
```

Generate a password hash: `node -e "const b=require('bcryptjs');console.log(b.hashSync('your-password',10))"`

## Coding Standards

These principles guide implementation quality. They should be challenged against speed, simplicity, and the needs of an early-stage MVP where pragmatic exceptions make sense.

- **Separation of concerns**: Service logic in lib/, API delegation in routes, UI in components, validation in validators.ts, constants in constants.ts
- **Single responsibility**: Each lib module has one job. Route files are pure delegation. Keep this discipline as the app grows.
- **Reusability**: Service functions are shared between server-side rendering (page.tsx) and API routes. Zod schemas are defined once and reused.
- **Configuration over hardcoding**: Use constants.ts for enums, env vars for secrets/config. Avoid magic strings in business logic — import from constants.
- **Template-based rendering**: All HTML lives in React components. No HTML strings in service or API logic.
- **Consistent API contract**: Always use ok() and fail() from lib/http.ts for responses. Include `{ ok: boolean, data?, error?, details? }` shape.
- **Audit trail**: Every task mutation must write to task_events via createEvent(). Include actor type and reason where available.
- **Type safety**: Use Prisma-generated types and Zod inference. Avoid `any`. Use `as const` arrays for enum-like values.

## Known Debt and Improvement Areas

### Medium Priority

1. **No pagination**: searchTasks hardcodes `take: 250`. Add cursor-based pagination for scale.
2. **No error boundaries**: Component crashes take down the whole page.
3. **No test framework**: No unit or integration tests. Consider Vitest for task-service.ts.
4. **Silent mutation failures**: API errors in the dashboard are swallowed (if `!res.ok` return). Add user-facing error feedback.
5. **Unused public assets**: vercel.svg, next.svg, globe.svg, window.svg are Next.js defaults — remove if unused.
6. **Search not optimized**: OR queries across 4 fields with insensitive matching. PostgreSQL full-text search would scale better.
7. **Magic strings in component**: `task.status !== "done"` in dueTone() should reference TASK_STATUSES constant.

### Low Priority / Future

8. Task detail pane is read-only — no inline editing
9. No client-side input validation on quick-add form
10. Category colors/icons only configurable via seed — no admin UI
11. No toast/notification system for mutation feedback
12. PUBLIC_PATHS in proxy.ts is hardcoded — could be config-driven

## Conventions

- Path alias: `@/*` maps to `src/*`
- API routes: `/api/llm/{actionName}` (camelCase)
- Database columns: snake_case
- TypeScript: strict mode, no any
- CSS: Tailwind utility classes only (no CSS modules, no inline styles)
- Icons: lucide-react
- Dates: date-fns for formatting/comparison
