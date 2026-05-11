# Brief — Mobile gesture actions for the task list

**For:** Claude Code, executing in the FedOS Home repo root
**Author:** Federico (mobile design review, 7 May 2026)
**Mockup reference:** `design-explorations/mobile-review-2026-05-07.html` § Section 5

---

## 1. Goal

Make the task list usable on mobile without entering the editor for routine actions. Today the mobile row only shows the title and only the checkbox is interactive — every other action requires opening the full-screen editor.

Add **two new gestures** to the mobile-only render of `TaskCard`:

1. **Swipe left → Delete**, with a 5-second Undo toast.
2. **Long-press → Context sheet** exposing Complete · Edit · Reschedule · Delete plus inline Status, Priority, Category, Project pickers.

Out of scope: swipe-right (the existing checkbox stays the canonical "complete" affordance), desktop behavior (unchanged), bulk selection, drag-to-reorder.

---

## 2. Constraints

| Constraint | Detail |
|---|---|
| Browsers | Must work on **iOS Safari ≥ 16**, **iOS Chrome** (WebKit), and Chrome/Edge on Android. |
| No new runtime deps | Use Pointer Events + CSS transitions. **Do not** add `framer-motion`, `react-spring`, `hammer.js`, etc. |
| Mobile-only | All new gesture surface is gated by the existing `md:hidden` / `max-md:` Tailwind responsive boundary (768 px). Desktop renders are untouched. |
| Accessibility | Checkbox `role="checkbox"` stays. The pencil icon stays. The long-press sheet must be keyboard-dismissable (`Escape`). The delete sheet button on the swipe-revealed action must also be tappable directly without committing past 60%. |
| No haptics on iOS | Feature-detect `'vibrate' in navigator` and call `navigator.vibrate(…)` only where supported. iOS gets the visual feedback only — that's expected. |

---

## 3. Files to read before starting

- `CLAUDE.md` — repo conventions
- `src/components/task-card.tsx` — the row this work modifies
- `src/components/task-dashboard.tsx` — owns the list state, where Undo state will live
- `src/components/use-task-actions.ts` — `deleteTask` lives here
- `src/components/dashboard-types.ts` — `VisibleTaskRow`, `Category`, `PriorityConfig`, `StatusConfig` types
- `src/lib/constants.ts` — `TASK_STATUSES`, `TASK_PRIORITIES`
- `src/app/globals.css` — design tokens (mobile dark theme: `--color-app-bg`, `--color-panel`, `--color-accent`, etc.)
- `design-explorations/mobile-review-2026-05-07.html` — visual reference for the swipe states and the long-press sheet

---

## 4. Behavioral spec

### 4.1 Swipe left → Delete

| Phase | Trigger | Result |
|---|---|---|
| Idle | — | Card sits at `translateX(0)`. Behind it (revealed by translation) is a red action panel with a trash icon and the label "Delete", aligned to the right edge. |
| Track | `pointermove` with `deltaX < 0` | Apply `transform: translateX(deltaX)`, clamped: `max(deltaX, -100% of card width)`. Ignore positive `deltaX` (no swipe-right). |
| Reveal | `|deltaX| ≥ 12% of card width` | Action panel becomes fully opaque. |
| Tappable | `|deltaX| ∈ [25%, 60%]` and pointer up | Snap to a held position revealing the Delete button (~96 px). Tapping that button commits delete. Tapping the card body (or swiping back) snaps to 0. |
| Auto-commit | Pointer up with `|deltaX| ≥ 60%` of card width | Animate to `-100%`, fire `onSwipeDelete(task.id)`, light haptic. |
| Snap back | Pointer up with `|deltaX| < 25%` | Animate to 0, no action. |
| Cancel | `pointercancel`, gesture begins within ≤ 24 px of the right viewport edge, or another card already has a held-open Delete | Animate to 0. Only one row may be in the held state at a time. |

**Right-edge guard:** if `pointerdown.clientX > window.innerWidth - 24`, do not start the swipe — this avoids fighting iOS Safari's forward-history swipe.

**Animation:** `transition: transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1)` for snap; live-tracking has `transition: none`.

**Haptics (Android only):**
- Threshold cross at 60% → `navigator.vibrate(15)`.
- No haptic at the 25% reveal (visual only).

### 4.2 Long-press → Context sheet

| Phase | Trigger | Result |
|---|---|---|
| Arm | `pointerdown` on the card body (not the checkbox) | Start a 400 ms timer. |
| Cancel | `pointermove` past 6 px in any direction · `pointerup` · `pointercancel` · the swipe handler engages first | Clear timer, do nothing. |
| Fire | Timer expires with no movement / lift | Open the action sheet. Apply `box-shadow: 0 0 0 2px var(--color-accent), 0 14px 30px -10px rgba(34,197,94,0.35); transform: scale(1.02)` to the source card for 160 ms, then dismiss the lift state. Vibrate `[20]` on Android. |
| Dismiss sheet | Tap outside · drag the sheet down past 80 px · `Escape` · selecting any action | Slide sheet down (`transform: translateY(100%)`, 200 ms), then unmount. |

**iOS Safari hardening:** the card's outer `<article>` must include
```css
-webkit-touch-callout: none;
-webkit-user-select: none;
user-select: none;
touch-action: pan-y;
```
otherwise iOS will pop a text-selection callout on long-press, and horizontal swipes will fight the page's vertical scroll.

### 4.3 Action sheet contents

A bottom half-sheet (~55% viewport height, max 480 px). Layout per the mockup:

1. **Header:** colored vertical bar matching the task's priority color, the task title, and a subline "{Priority} · {Due relative} · {Category}".
2. **Quick action grid** (4 columns):
   - Complete (toggles `status === "done"`; calls existing `onComplete`)
   - Edit (closes sheet, calls existing `onEdit(task.id)`)
   - Reschedule (closes sheet, opens a date picker — for v1 just open the editor jumped to the date field, OK to defer the standalone picker)
   - Delete (closes sheet, fires the same delete + undo flow as the swipe)
3. **List rows** (full-width, with current value on the right):
   - Status — disclosure shows status options inline (or pushes a sub-sheet)
   - Priority — same
   - Category — same, listing all categories
   - Project — same, with "No project" first
4. **Trailing tap-out area** that dismisses the sheet.

For v1, the Status / Priority / Category / Project rows can each render an inline expandable list inside the sheet (no sub-sheets). Reuse the existing `Popover` style from `task-card.tsx` if the layout works.

### 4.4 Undo flow

When delete is committed (whether by swipe ≥ 60%, by tapping the revealed Delete button, or from the sheet):

1. **Optimistic remove** the task from the visible list in `TaskDashboard` state. The actual API call (`useTaskActions.deleteTask`) is **deferred 5 seconds**.
2. Render an `<UndoToast>` at `bottom: 88px` (above the bottom nav, below `pb-28` content). The toast shows: green check icon, "Task deleted — '{title}'", and an "Undo" button.
3. **If Undo is tapped** within 5 s: cancel the deferred API call and restore the task to the local state. No network request.
4. **If 5 s elapse**: fire `deleteTask(id)` for real. On error, restore the task and show the existing error banner.
5. Only one toast at a time — if the user deletes a second task while a toast is visible, commit the first delete immediately and replace the toast.

This is the primary safeguard for an irreversible destructive action — please don't skip it.

---

## 5. Files to create

```
src/components/use-swipe-action.ts        # custom hook, pointer-events based
src/components/use-long-press.ts          # custom hook, 400 ms timer
src/components/task-action-sheet.tsx      # the long-press half-sheet
src/components/undo-toast.tsx             # the 5-second undo toast
```

Hook signatures (suggested):

```ts
// use-swipe-action.ts
export function useSwipeLeftAction(args: {
  onCommit: () => void;             // called when threshold passed
  commitThreshold?: number;         // default 0.6 (60 %)
  revealThreshold?: number;         // default 0.25 (25 %)
  rightEdgeGuardPx?: number;        // default 24
  disabled?: boolean;               // disables the gesture (e.g. while sheet is open)
}): {
  bind: React.HTMLAttributes<HTMLElement>;  // spread on the row
  state: { offset: number; held: boolean }; // for inline transform
  reset: () => void;                        // imperative snap-back
};

// use-long-press.ts
export function useLongPress(args: {
  onLongPress: () => void;
  delayMs?: number;                 // default 400
  movementCancelPx?: number;        // default 6
  disabled?: boolean;
}): React.HTMLAttributes<HTMLElement>;
```

The hooks use Pointer Events only (`onPointerDown`, `onPointerMove`, `onPointerUp`, `onPointerCancel`, `setPointerCapture`). No `touchstart`/`mousedown` fallbacks — Pointer Events are supported on every browser in scope.

---

## 6. Files to modify

### `src/components/task-card.tsx`
- Add the swipe + long-press wiring on the **mobile branch only** (the existing `md:hidden` block around the title + pencil cluster). Wrap the row in a positioned container; add a sibling action panel behind it.
- Add `touch-action: pan-y; -webkit-touch-callout: none; -webkit-user-select: none; user-select: none;` to the row's outer element. (Tailwind: use a small inline `style` or extend with arbitrary values — `[touch-action:pan-y] [-webkit-touch-callout:none] select-none`.)
- New props: `onSwipeDelete(id)` and `onOpenSheet(task)` (or surface an internal sheet — see § 7).
- Long-press on the card body must NOT fire when the gesture started on the checkbox or the pencil button — those keep their own click semantics. Stop pointer event propagation on those elements' `onPointerDown`.

### `src/components/task-dashboard.tsx`
- New state: `pendingDelete: { task: VisibleTaskRow; commitAt: number; timeoutId: number } | null`.
- New state: `actionSheetTaskId: string | null` (or pass the full task to the sheet).
- When `onSwipeDelete(id)` fires from a card: optimistically remove from `tasks`, schedule the real `deleteTask` for 5000 ms, render `<UndoToast>`. If the user navigates away (route change), commit immediately.
- Render `<TaskActionSheet>` controlled by `actionSheetTaskId`. The sheet's actions reuse the existing dashboard handlers (`complete`, `setStatus`, `setPriority`, `setCategory`, `deleteTask`, `onEdit`).
- Existing `openTaskMenu` desktop pop-over state is unchanged.

### `src/components/use-task-actions.ts`
- Likely no API changes, but expose any helper needed for the deferred-delete commit path. If `deleteTask` already does the optimistic update internally, you may need a separate `confirmDelete(id)` that skips optimism (since the dashboard handles it now), or a flag. Keep the change minimal; if necessary, leave the existing `deleteTask` alone and let the dashboard call it directly after the timer.

### `src/app/globals.css`
- No required changes. If the action panel reveal needs a one-off color, add a CSS variable inline rather than expanding the token set.

---

## 7. Architectural decision to make

The action sheet can either live **on each `TaskCard`** (rendered conditionally per card) or **once on `TaskDashboard`** (controlled by `actionSheetTaskId`). Prefer the latter — it avoids 50× sheet portals on a long list, and matches how `TaskEditOverlay` is rendered today (single instance at the dashboard level keyed by `editingTaskId`). Pass the relevant task + categories + projects + configs into the sheet at render time.

---

## 8. Visual spec

Reuse existing tokens (`--color-app-bg`, `--color-panel`, `--color-surface-secondary`, `--color-line`, `--color-text-primary/secondary/tertiary`, `--color-accent`, `--color-text-danger`).

| Element | Spec |
|---|---|
| Card row outer | `position: relative; overflow: hidden; border-radius: 14px;` |
| Action panel (delete reveal) | Full-bleed under the card. `display: flex; align-items: center; justify-content: flex-end; padding-right: 22px; gap: 8px; background: var(--color-text-danger); color: #fff;` Icon = `Trash2` from `lucide-react`, 18 px. |
| Card surface | The current mobile row styles; add the constraints from § 4.2. |
| Sheet | `position: fixed; inset: auto 0 0 0; max-height: 70vh; min-height: 280px; background: var(--color-panel); border-top-left-radius: 22px; border-top-right-radius: 22px; padding: 14px 14px calc(env(safe-area-inset-bottom)+16px); border-top: 1px solid var(--color-line);` |
| Sheet grabber | `width: 36px; height: 4px; border-radius: 999px; background: rgba(255,255,255,0.18); margin: 0 auto 10px;` |
| Sheet backdrop | `background: rgba(0,0,0,0.55); backdrop-filter: blur(6px);` Tap closes. |
| Undo toast | Position above the bottom nav. `bg-[var(--color-surface-primary)] border border-[var(--color-line)] rounded-2xl shadow-xl`. Auto-dismiss countdown is internal — the toast component shouldn't run the delete itself, the dashboard does. |

Animation timings: 180 ms snap-back, 200 ms sheet enter/exit, 160 ms long-press lift. All `cubic-bezier(0.2, 0.8, 0.2, 1)` except the lift which can be `ease-out`.

---

## 9. Acceptance criteria

- [ ] Swiping a row left past 60 % triggers delete + undo toast; swiping past 25 % but releasing before 60 % leaves the row in a held-open state with a tappable Delete button.
- [ ] Tapping the revealed Delete button is equivalent to a past-60 % swipe.
- [ ] Snap-back animation runs at 180 ms.
- [ ] Swiping a second row resets any held-open row.
- [ ] Swiping right has no effect.
- [ ] Touch starting within 24 px of the right viewport edge is ignored.
- [ ] Long-pressing the card body (not the checkbox, not the pencil) for 400 ms without movement opens the action sheet with a brief lift + glow on the source card.
- [ ] Moving > 6 px during the press cancels the long-press.
- [ ] The action sheet contains: Complete, Edit, Reschedule, Delete in the grid, plus Status, Priority, Category, Project rows that show the current value and let the user change it.
- [ ] Edit closes the sheet and opens the existing `TaskEditOverlay` for the same task.
- [ ] Delete from the sheet uses the same optimistic-with-undo flow as the swipe.
- [ ] Undo toast appears above the bottom nav, stays for 5 s, can be dismissed early by Undo, and only one is on screen at a time.
- [ ] Undo restores the task to the same position in the list it occupied before delete.
- [ ] Tapping the row (no swipe, no long-press) still opens the editor — existing behavior unchanged.
- [ ] Tapping the checkbox still toggles complete — existing behavior unchanged.
- [ ] Desktop (≥ 768 px) renders are byte-identical to today; no new gesture handlers fire.
- [ ] iOS Safari does not show the text-selection callout on long-press, and the magnifier does not appear.
- [ ] iOS Safari forward-swipe is not triggered by a card swipe-left that originates within the row.
- [ ] No new runtime dependencies in `package.json`.

---

## 10. Test plan

Manual, on each target browser (iOS Safari, iOS Chrome, Android Chrome, Android Edge):

1. Slow swipe a row left → release before 25 % → snaps back.
2. Slow swipe to ~40 % → release → row held open with Delete button visible. Tap Delete → row removed, toast shown.
3. Fast swipe left to past 60 % → row removed, toast shown.
4. Tap Undo within 5 s → row reappears at original position. No `DELETE` request was sent (verify in Network tab).
5. Wait 5 s → `DELETE /api/tasks/:id` fires (verify in Network tab).
6. Delete two tasks within 1 s → first toast replaced, first delete commits immediately.
7. Long-press a row → sheet opens with lift effect.
8. Long-press, then drag finger 10 px → sheet does NOT open.
9. Long-press → tap each sheet action; verify the right handler is called.
10. Long-press → drag the sheet grabber down past 80 px → sheet closes.
11. Long-press → tap backdrop → sheet closes.
12. Long-press → press `Escape` (Bluetooth keyboard or simulator) → sheet closes.
13. Tap row body (no hold) → editor opens. Tap checkbox → status toggles.
14. Resize to ≥ 768 px → none of the above fires; existing pop-overs work as today.
15. iOS Safari only: long-press on a row's title → no native callout, no magnifier.
16. iOS Safari only: swipe left starting near the right edge (~10 px in) → swipe is ignored, browser-forward gesture is preserved.

---

## 11. Open questions for Federico (please ask before guessing)

1. **Reschedule action** — for v1, OK to open the editor focused on the date field, rather than building a standalone date picker?
2. **"Save & new" / quick-add** — out of scope here, or wanted as a follow-up?
3. **Undo position** — is `bottom: 88px` (above the 2-tab nav) acceptable, or should it dock at the very bottom and push the nav up? Default plan is the former.
4. **Sheet close on action** — should picking a status/priority/category close the sheet immediately, or stay open so the user can change several things at once? Default plan is to close on Status/Priority/Category change (faster perceived flow), but stay open for the inline list expansions.

---

## 12. Don't change

- `task-edit-overlay.tsx` (the editor itself) — only call sites should change.
- `bottom-nav.tsx`.
- Any API route, Prisma model, or server action.
- Desktop pop-over UX inside `task-card.tsx`.
- `globals.css` tokens.
- `next.config.ts`, `eslint.config.mjs`, `tsconfig.json`.

---

## 13. Definition of done

- Lint passes (`npm run lint`).
- Type-check passes (TS strict).
- Manual test plan in § 10 passes on iOS Safari (real device or Simulator) and Chrome desktop with device-toolbar mobile emulation.
- A short note added to `BACKLOG.md` summarising the change.
