# Backlog

## Pagination

**File:** `src/lib/task-service.ts` — `searchTasks`, and `src/app/page.tsx`

**Problem:** `take: 250` is a silent ceiling. Tasks beyond 250 are never returned or shown — no error, no indication. Every page load also serializes up to 250 full task objects including all relations.

**Recommended approach:** Offset pagination (`skip`/`take`) is sufficient at personal scale and much simpler than cursor-based. Add `skip` + `limit` params to `searchTasks`, pass `page` as a URL search param, and add a "Load more" button in `TaskDashboard` that fetches the next page via a `/api/tasks` route.

**Notes:**
- Cursor pagination is the "correct" choice at scale but complex with multi-column `orderBy` (due_at + priority + updated_at)
- Offset pagination is fine for hundreds of tasks; revisit if the list grows significantly
- The UI is currently fully client-side after initial load, so "load more" can append to the existing task list without a full page reload
