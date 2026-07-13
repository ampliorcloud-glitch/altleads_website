# Tasks Module Overhaul — Build Spec
**Ticket scope:** ALT-430 (umbrella)  
**Author:** PM session 2026-06-28 (spec only — no migrations executed, no app code written)  
**Status:** SPEC — awaiting owner approval before implementation

---

## 0. TL;DR gaps

| Gap | Severity |
|---|---|
| No Kanban view for Tasks | Major UX |
| `task` table NOT YET in production (migration staged, never applied) | Blocker for everything |
| No `completed_at` column on `task` — marking done only flips `status` | Data gap |
| No `linked_call_id` / `linked_interaction_id` on `task` — no call-to-task linkage | Data gap |
| Clicking a task row navigates to the record but opens nothing — no auto-complete flow | Major UX |
| No in-record activity hub (Tasks/Calls/Notes panel inside Lead/Contact/Company) | Missing feature |
| Bulk update not wired for tasks (pattern exists in Companies/Contacts pages) | Missing feature |
| `public.call_log` table ALSO not in production — "Log call" on detail pages currently writes to `interaction` via `LogDispositionModal` + `DispositionForm` | Critical context |

---

## 1. Current-State Audit

### 1.1 Task table (`public.task`)

**Schema (from `apply-create-task-table.cjs`):**

```
task_id                bigint IDENTITY PK
task_type              text NOT NULL  CHECK IN ('CALL','MEETING','TODO')
subject                text NOT NULL
body                   text
status                 text NOT NULL DEFAULT 'OPEN'  CHECK IN ('OPEN','DONE','SKIPPED')
priority               text NOT NULL DEFAULT 'NORMAL' CHECK IN ('LOW','NORMAL','HIGH')
owner_user_id          bigint NOT NULL
assigned_by_user_id    bigint
lead_id                bigint
company_id             bigint
contact_id             bigint
meeting_id             bigint
assoc_label            text           -- denormalized record name
assoc_phone            text           -- denormalized phone
due_at                 timestamptz NOT NULL
remind_offset_minutes  integer NOT NULL DEFAULT 0
reminder_at            timestamptz    -- trigger-maintained
reminder_sent_at       timestamptz
created_by             bigint
created_date           timestamptz DEFAULT now()
updated_date           timestamptz    -- trigger-maintained
deleted_date           timestamptz
```

**Migration status:** Staged in `new-code/migration/apply-create-task-table.cjs` + `apply-task-rls.cjs`. **NOT applied to production.** The data layer (`data/tasks.ts`) is complete; at runtime every query errors until the migration runs.

**What exists:**
- `task_type` (`CALL | MEETING | TODO`) — EXISTS
- Record links (`lead_id`, `company_id`, `contact_id`, `meeting_id`) — EXISTS
- Status enum (`OPEN | DONE | SKIPPED`) — EXISTS
- Due date (`due_at`) — EXISTS
- Assignee (`owner_user_id`) — EXISTS
- Priority (`LOW | NORMAL | HIGH`) — EXISTS

**What is MISSING (data-model gaps):**
- `completed_at` — no timestamp for when a task was completed; `updated_date` is the closest proxy but it moves on every edit
- `linked_interaction_id` — no foreign key to the `interaction` row (disposition) that triggered completion
- `outcome_note` — no separate outcome-capture field (re-uses `body` today, which is the pre-call prep note)

### 1.2 Data layer (`new-code/web/src/data/tasks.ts`)

Complete. Exports:
- `Task` interface, `TaskType`, `TaskStatus`, `TaskPriority`, `GroupedTasks`, `TaskBucket`
- `listMyTasks(userId)` — groups into Overdue/Today/Upcoming/Completed (IST)
- `createTask(input)`, `updateTask(id, patch)`, `markDone(id)`, `skipTask(id)`, `snoozeTask(id, newDueAt)`
- `getDigestPref`, `setDigestPref`

**Missing:** `listTasksForRecord(ref: { leadId?; companyId?; contactId? })` — no per-record task query exists yet.

### 1.3 MyTasksPage (`new-code/web/src/pages/MyTasksPage.tsx`)

- Tabbed list: Overdue / Today / Upcoming / Completed
- Per-row quick actions: Mark done / Skip / Snooze
- Clicking a task row navigates to the linked record (`/leads/:id`, `/contacts/:id`, `/companies/:id`) but **does not open any modal or trigger auto-complete**
- No Kanban view toggle
- No bulk selection/update
- "New task" opens `CreateTaskModal` (fully functional)

### 1.4 Call logging (CRITICAL CONTEXT)

`public.call_log` is also staged-only (never migrated). **All current call logging on detail pages uses `LogDispositionModal` → `DispositionForm` → writes to `public.interaction` table (type = 'call').** `LogCallModal` + `data/calls.ts` exist but are deliberately NOT wired to any detail page (the comment in `LeadDetailPage.tsx` line 187 explicitly says "LogCallModal / logCall() was removed: call_log table was never migrated to prod").

Therefore:
- The "Log call" action on Lead/Contact/Company detail pages already works (via `interaction` table)
- The auto-complete flow in this spec must trigger the SAME `LogDispositionModal` → `DispositionForm` path
- `linked_interaction_id` on `task` is the correct FK target (pointing at the `interaction` table row), NOT `call_log`

### 1.5 Existing detail page structure

**LeadDetailPage.tsx:**
- Tabs: `activity | report | meeting`
- Quick actions already present: "Call back" / "Schedule meeting" / "Add task" (create `Task`) + "Log call" (`LogDispositionModal`)
- Tab `activity` = `ActivityTab` component (reads `lead_activity` table via `leadWorkspace.ts`)
- No task panel inside the detail page

**ContactDetailPage.tsx / CompanyDetailPage.tsx:**
- Tabs: contacts/leads/activity/sites
- Same quick-action buttons (Call back / Schedule meeting / Add task / Log call)
- `ActivityTimeline` component (reads `interaction` rows)
- No task panel

**leadWorkspace.ts:** Full read/write layer for lead workspace (activities, report, meetings). The `lead_activity` table stores free-text comments + system events. The `interaction` table (read by `activityTimeline.ts` and `callLogs.ts`) stores structured call dispositions + status changes.

### 1.6 Kanban infrastructure

Two Kanban implementations exist:
- `KanbanBoard` + `KanbanColumn` + `KanbanCard` — lead-specific, tied to `RealLead` type (used only by `LeadsKanbanPage`)
- `GenericKanban` (`components/kanban/GenericKanban.tsx`) — generic, column/card/renderCard API, supports multi-select via `isSelected`/`onToggleSelect`. **This is the reuse target.**

### 1.7 Bulk action pattern

Pattern lives in `useRowSelection` hook + `BulkProgress` interface from `data/bulkActions.ts`. The `sel` object (`useRowSelection<string>()`) tracks selected IDs; bulk operations iterate with `onProgress` callback for the live progress bar. This is wired in CompaniesPage and ContactsPage. MyTasksPage has NO bulk selection today.

---

## 2. Data-Model Changes Required

### 2.1 New columns on `public.task` (ONE migration, staged)

```sql
-- Flag the migration file: new-code/migration/apply-task-enhancements.cjs
ALTER TABLE public.task
  ADD COLUMN IF NOT EXISTS completed_at        timestamptz,
  ADD COLUMN IF NOT EXISTS linked_interaction_id bigint REFERENCES public.interaction(interaction_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS outcome_note         text;
```

**Rationale:**
- `completed_at`: precise time when the task was completed (stamped by the auto-complete flow, NOT by the trigger). Enables "completed on" display and time-to-completion analytics.
- `linked_interaction_id`: FK to the `interaction` row created by `LogDispositionModal` / `DispositionForm`. Links the task to its completing action. Enables "show the call that closed this task."
- `outcome_note`: short outcome text captured in the complete-popup for TODO/MEETING tasks (separate from `body`, which is the pre-task note). `null` for tasks completed via a call (the call disposition is the outcome).

**CHECK constraint update:** No change to enums needed. `status` remains `OPEN | DONE | SKIPPED`.

### 2.2 No new tables required for v1

The in-record activity hub reads from existing tables: `task` (per-record tasks), `interaction` (calls + status changes), `lead_activity` (lead-specific comments). No new table needed.

### 2.3 Index additions

```sql
-- Already exists: task_lead_id_idx, task_company_id_idx, task_contact_id_idx
-- Add a compound index for the hub's "open tasks on a record" query
CREATE INDEX IF NOT EXISTS task_record_status_due_idx
  ON public.task (lead_id, status, due_at) WHERE lead_id IS NOT NULL AND deleted_date IS NULL;
-- same for company and contact
```

### 2.4 `data/tasks.ts` additions (pure FE, no migration)

Add `listTasksForRecord(ref: { leadId?; companyId?; contactId? }): Promise<{ tasks: Task[]; error: string | null }>` — mirrors `listCallsForRecord` in `data/calls.ts`. Query: select from `task` where matching FK, `status IN ('OPEN','DONE','SKIPPED')`, `deleted_date IS NULL`, ordered `due_at ASC` for open and `completed_at DESC` for done. Returns all tasks (caller filters by status in UI).

Add `completeTask(id: number, opts: { completedAt?: string; linkedInteractionId?: number | null; outcomeNote?: string | null }): Promise<{ task: Task | null; error: string | null }>` — calls `updateTask(id, { status: 'DONE', completed_at: ..., linked_interaction_id: ..., outcome_note: ... })`. This is the canonical auto-complete call.

Add `bulkUpdateTasks(ids: number[], patch: Pick<TaskPatch, 'status' | 'due_at' | 'owner_user_id' | 'priority'>, opts?: BulkProgress): Promise<BulkResult>` — loop over IDs calling `updateTask`, same `onProgress`/`signal` shape as `addToProjectLoop` in `bulkActions.ts`.

---

## 3. Task Kanban Spec (`TasksKanbanPage`)

### 3.1 Route

```
/tasks/board        (internal only, admin + agent roles)
```

Toggle between list and board inside MyTasksPage or via the nav. The list view already has tabs (Overdue/Today/Upcoming/Completed). The board is an alternative grouping. Add a list/board view-toggle button to the MyTasksPage header — same `List` / `LayoutGrid` icon buttons used in `LeadsKanbanPage`.

### 3.2 Columns (grouping options)

**Primary grouping: by status** (4 columns — matches the existing tab model):

| Column key | Label | Color accent |
|---|---|---|
| `OVERDUE` | Overdue | Red `#B91C1C` |
| `TODAY` | Today | Amber `#B45309` |
| `UPCOMING` | This week / Later | Blue `#1D4ED8` |
| `DONE` | Done | Gray `#6B7280` |

Bucketing logic: reuse `bucketOf(task.status, task.due_at)` from `components/tasks/taskScheduling.ts`. Column `OVERDUE` = `bucketOf === 'Overdue'`, `TODAY` = `bucketOf === 'Today'`, `UPCOMING` = `bucketOf === 'Upcoming'`, `DONE` = `bucketOf === 'Completed'`.

**Secondary grouping (v2, not in v1):** by priority (HIGH / NORMAL / LOW).

### 3.3 Reuse `GenericKanban`

`TasksKanbanPage` will use `GenericKanban<Task>` with:

```typescript
columns: [
  { key: 'OVERDUE', label: 'Overdue' },
  { key: 'TODAY',   label: 'Today' },
  { key: 'UPCOMING', label: 'Upcoming' },
  { key: 'DONE',    label: 'Done' },
]
itemsByColumn: Map<string, Task[]>   // built from listMyTasks() groups
getKey: (t) => t.task_id
renderCard: (t) => <TaskKanbanCard task={t} />
onCardClick: (t) => openRecord(t)   // same openRecord logic as MyTasksPage
isSelected / onToggleSelect: wired to useRowSelection<number>()
```

### 3.4 `TaskKanbanCard` component

New component at `components/tasks/TaskKanbanCard.tsx`. Shows:
- Type icon (Phone / CalendarDays / CheckSquare) — top-left
- Subject (truncated, 2 lines max)
- Association label (`assoc_label`) + phone in small gray text
- Priority chip (reuse `PriorityChip` from `MyTasksPage` or extract to `components/tasks/PriorityChip.tsx`)
- Due date relative label (`relativeDueLabel`) — bottom-right, red if overdue
- If task is CALL type: phone icon badge to visually distinguish

### 3.5 Drag-to-move (click-to-move in v1)

**v1: click-to-move only.** DnD is deferred (same decision as LeadsKanbanPage). Instead, each card has an inline "Move to..." kebab or right-click context menu that triggers `updateTask(id, { status: ... })`. This is the minimal viable board interaction — the user can change the status bucket without opening a full modal.

Alternatively (simpler): a card click opens the record, not a move action. Card has a "Done" button directly on it (like the row in list view). This keeps v1 simple.

**Recommendation:** v1 = card click opens linked record + opens the auto-complete flow. The Kanban is primarily a VIEW; mutations happen via the detail page or the in-row quick-actions (same as list view). No DnD for v1.

### 3.6 Files for Task Kanban

| File | Action |
|---|---|
| `pages/MyTasksPage.tsx` | Add view-toggle button (List / Board), conditionally render `TasksKanbanPage` inline or route to `/tasks/board` |
| `pages/TasksKanbanPage.tsx` | NEW — thin page shell, reuses `listMyTasks` + `GenericKanban` |
| `components/tasks/TaskKanbanCard.tsx` | NEW — card renderer |
| `components/tasks/PriorityChip.tsx` | EXTRACT from MyTasksPage (or inline in TaskKanbanCard) |
| Router config | Add `/tasks/board` route |

---

## 4. In-Record Activity Hub Spec

### 4.1 Philosophy (Zoho CRM inspiration adapted)

Zoho CRM shows inside each record:
- An "Open Activities" related list (open tasks + meetings due in future)
- A "Closed Activities" related list (completed tasks + past calls)
- A "Next Action" field
- Quick-create action bar: Log a Call | New Task | New Meeting | Send Email | Add Note

HubSpot shows a chronological activity feed with a filter bar (Calls / Emails / Notes / Tasks / Meetings) and a pinned "Next activity" at the top.

**Our adaptation:** A new `RecordActivityHub` tab (or section) inside each detail page. The hub has two sub-sections:
1. **Open tasks** — all `status=OPEN` tasks linked to this record, sorted by `due_at ASC`, with per-task quick actions (Complete / Log call / Skip / Snooze)
2. **Activity timeline** — chronological log of calls (from `interaction`), notes (from `lead_activity` on leads), status changes; newest first

Quick-action bar above: `[ Log call ] [ Add task ] [ Add note ]` (email deferred to v2).

### 4.2 Which panel/tab on each detail page

**LeadDetailPage.tsx** — currently has 3 tabs: `activity | report | meeting`. The existing `ActivityTab` shows `lead_activity` comments. 

Add `tasks` as a 4th tab: `activity | report | meeting | tasks`

The `tasks` tab renders `RecordActivityHub` with `{ leadId }`.

Alternatively (Zoho style): merge tasks INTO the existing `activity` tab — show tasks at the top of the `ActivityTab` as a "Open tasks" collapsible card, then the comment feed below. This is less disruptive. **Recommendation: merged approach for leads** (add `OpenTasksCard` to the top of `ActivityTab`), **separate "Tasks" tab for Contact and Company** (their existing `activity` tabs are already thin).

**ContactDetailPage.tsx** — tabs: `contacts | leads | activity`. Add `tasks` tab after `activity`.

**CompanyDetailPage.tsx** — tabs: `contacts | leads | activity | sites`. Add `tasks` tab after `activity`.

### 4.3 `RecordActivityHub` component

New file: `components/tasks/RecordActivityHub.tsx`

**Props:**
```typescript
interface RecordActivityHubProps {
  recordType: 'lead' | 'contact' | 'company';
  recordId: number;
  projectId?: number | null;       // for scoping interaction reads
  ownerUserId?: number | null;     // pre-fills new task/call owner
  actorId?: string | null;         // current user id as text
  assocLabel?: string | null;      // record name (for task pre-fill)
  assocPhone?: string | null;      // phone (for task pre-fill)
}
```

**Internal state:**
- `openTasks: Task[]` — from `listTasksForRecord({ leadId | contactId | companyId })`
- `callLog: CallLogEntry[]` — from `fetchCallLogs({ entity, id })` (already exists in `data/callLogs.ts`)
- `taskModalOpen: boolean` + `taskModalInitialType: TaskType`
- `logCallOpen: boolean`
- `activeTask: Task | null` — the task being actioned (for auto-complete flow)
- `completeTodoOpen: boolean` — popup for TODO/MEETING completion

**Renders:**

```
┌─────────────────────────────────────────────────────────┐
│  Quick actions:  [Log call]  [Add task]  [Add note]     │
├─────────────────────────────────────────────────────────┤
│  OPEN TASKS (3)                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ [Phone] Call back re: pricing        Due: Today  │  │
│  │         Acme Corp · +91 98765 43210  [Act] [Skip]│  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ [Check] Follow up on proposal        Due: Tomorrow│ │
│  │         [Complete] [Skip]                        │  │
│  └──────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  ACTIVITY (calls + notes)                               │
│  • 27 Jun — Call: Interested — "Discussed pricing"      │
│  • 25 Jun — Status change: Warm → Hot Prospect          │
└─────────────────────────────────────────────────────────┘
```

**Data loading sequence:**
1. On mount: `Promise.all([listTasksForRecord(ref), fetchCallLogs({ entity, id })])`
2. On task created/completed/skipped: re-fetch `listTasksForRecord`
3. On call logged: re-fetch `fetchCallLogs`

**Quick actions wiring:**
- "Log call" → opens `LogDispositionModal` with `recordType/recordId/projectId/ownerUserId/actorId` already filled (same props as current `QuickTaskActions` in detail pages) → `onLogged` refreshes call log
- "Add task" → opens `CreateTaskModal` with `association` pre-filled from hub props → `onCreated` refreshes open tasks
- "Add note" (v1, leads only) → inline textarea that calls `addActivityComment(leadId, text, createdBy)` from `leadWorkspace.ts`; for contacts/companies defers to v2

### 4.4 Open task row in the hub

Each open-task row in the hub shows:
- Type icon (Phone / CalendarDays / CheckSquare)
- Subject (truncated)
- Due badge (relative, red if overdue)
- Priority chip

**Action button per task type:**
- `CALL` task → "Log call" button (instead of generic "Complete") → triggers auto-complete flow (section 5)
- `MEETING` task → "Complete" button → triggers todo-complete popup (section 5)
- `TODO` task → "Complete" button → triggers todo-complete popup (section 5)

Plus: "Skip" button for all types (calls `skipTask(id)` then refreshes).

---

## 5. Auto-Complete Flow Spec

### 5.1 Design principle

The task should close automatically when its underlying action is logged. The user must never have to manually hunt-and-close a task after logging a call.

### 5.2 CALL-type task auto-complete (from MyTasksPage row OR from RecordActivityHub)

**Trigger:** User clicks the task row (from MyTasksPage) OR clicks "Log call" on a CALL task inside `RecordActivityHub`.

**Exact sequence:**

```
1. If triggered from MyTasksPage:
   a. Navigate to the linked record (`/leads/:id`, `/contacts/:id`, or `/companies/:id`)
   b. Pass the task id via router state: navigate(path, { state: { openLogCall: true, taskId: task.task_id } })

2. On the detail page, `useLocation().state` is read:
   a. If `openLogCall === true && taskId` is present → immediately open `LogDispositionModal`
   b. The modal is pre-filled with `recordType`, `recordId`, `projectId`, `ownerUserId`, `actorId` (all available from the page's own context)

3. If triggered from RecordActivityHub (already on the record page):
   a. Set `activeTask = task` (the CALL task being actioned)
   b. Open `LogDispositionModal` directly (no navigation needed)

4. User fills in LogDispositionModal (disposition + note) and clicks "Log call":
   a. `DispositionForm` → `logDisposition()` → inserts row into `interaction` table → returns `interaction_id`
   b. The `onLogged` callback receives the `interaction_id` (CHANGE REQUIRED: `DispositionForm.onLogged` currently fires with no payload — must be updated to pass the new `interaction_id`)
   c. On `onLogged(interactionId)`:
      - Call `completeTask(activeTask.task_id, { completedAt: new Date().toISOString(), linkedInteractionId: interactionId })`
      - This sets `status = 'DONE'`, `completed_at`, `linked_interaction_id`
      - Toast: "Call logged — task marked done"
      - Refresh open tasks in the hub (or re-fetch MyTasksPage)
   d. The task disappears from the Open Tasks list and moves to completed
```

**Where the wiring lives:**
- `RecordActivityHub.tsx` — manages `activeTask` state and the `onLogged` callback
- `LogDispositionModal.tsx` / `DispositionForm.tsx` — small change: `onLogged` becomes `onLogged(interactionId: number) => void` (currently `() => void`)
- `data/tasks.ts` — add `completeTask()` function
- `MyTasksPage.tsx` — `onOpen` handler passes router state `{ openLogCall: true, taskId }` for CALL tasks
- Each detail page — reads `location.state.openLogCall` on mount and opens the log-call modal if set

### 5.3 TODO/MEETING-type task auto-complete

**Trigger:** User clicks "Complete" on a TODO or MEETING task (in RecordActivityHub or MyTasksPage).

**Exact sequence:**

```
1. Open a lightweight "Complete task" popup (inline component, NOT a full Modal)
   - Title: "Complete — {task.subject}"
   - Outcome note textarea (optional): "What happened? (optional)"
   - [Cancel] [Mark complete]

2. User clicks "Mark complete":
   a. Call completeTask(task.task_id, { completedAt: new Date().toISOString(), outcomeNote: noteText.trim() || null })
   b. Toast: "Task marked complete"
   c. Refresh open tasks
```

**Component:** `components/tasks/CompleteTodoPopup.tsx` — a small inline card popup (same pattern as `SnoozeMenu` in MyTasksPage — absolutely positioned, closes on Escape/outside-click). NOT a full-screen modal.

**Props:**
```typescript
interface CompleteTodoPopupProps {
  task: Task;
  onClose: () => void;
  onCompleted: () => void;
}
```

### 5.4 From MyTasksPage (no record link)

If a task has NO linked record (`lead_id`, `company_id`, `contact_id` all null) but is CALL type: open `LogDispositionModal` without navigation (the modal can work standalone if `recordType/recordId` are provided). However, an unlinked CALL task is an edge case — in practice every CALL task should be linked to a record. For unlinked CALL tasks: fall back to the TODO complete popup (no call log written).

### 5.5 Summary: which function marks the task done

| Scenario | Who calls `completeTask()` |
|---|---|
| CALL task, from RecordActivityHub | `RecordActivityHub.tsx` in its `onLogged(interactionId)` callback |
| CALL task, from MyTasksPage → navigated to detail page | The detail page reads `location.state.taskId`; after successful log, calls `completeTask()` |
| TODO/MEETING task, from RecordActivityHub | `RecordActivityHub.tsx` after `CompleteTodoPopup` confirms |
| TODO/MEETING task, from MyTasksPage | `MyTasksPage.tsx` after `CompleteTodoPopup` confirms |
| Manual "Done" click (existing flow) | Existing `markDone(id)` in `MyTasksPage` — unchanged; does NOT set `completed_at` or `linked_interaction_id` (acceptable shortcut for manual close) |

---

## 6. Bulk Update in MyTasksPage

### 6.1 Fields to bulk-update

| Field | Values | Notes |
|---|---|---|
| Status | DONE / SKIPPED | Bulk mark done or skip |
| Due date | datetime-local input | Push all selected tasks to a new due date |
| Assignee (`owner_user_id`) | User picker | Reassign to a different agent |
| Priority | LOW / NORMAL / HIGH | Set priority on all selected |

### 6.2 Wiring (reuse existing pattern)

1. Add `useRowSelection<number>()` to `MyTasksPage` — `sel` object, same as `CompaniesPage`
2. Add checkbox column to each `TaskRow` (left edge, same as list pages) — only shown when in multi-select mode (toggle via a "Select" button in the header, same pattern)
3. When `sel.count > 0`, show a bulk action bar above the task list with the 4 action buttons
4. Each bulk action opens a small confirm/input popup then calls `bulkUpdateTasks(ids, patch, { onProgress })`
5. `bulkUpdateTasks` (new function in `data/tasks.ts`) loops over the IDs with `BulkProgress` — same shape as `addToProjectLoop` in `bulkActions.ts`

### 6.3 Bulk action bar component

Inline in MyTasksPage (no separate component needed for v1 — the bar is simple). Shows:
- `{count} tasks selected` label
- [Mark done] — bulk `status = 'DONE'`
- [Skip] — bulk `status = 'SKIPPED'`
- [Change due date] → inline datetime-local picker → bulk `due_at = newDate`
- [Reassign] → user dropdown → bulk `owner_user_id = newUserId`
- [Set priority] → dropdown (LOW/NORMAL/HIGH) → bulk `priority = value`
- [Clear] — `sel.clear()`

Progress bar: same `bulkProgress` state pattern as CompaniesPage (`useState<{ done: number; total: number } | null>`).

---

## 7. Phased Plan

### v1 (immediate — first sprint)

**Goal:** Kanban view + auto-complete flow + in-record activity hub (tasks + calls) + bulk update.

**Pure frontend changes (no migration needed — task table already staged):**

> NOTE: The `public.task` table migration (`apply-create-task-table.cjs` + `apply-task-rls.cjs`) must be applied to production first. Everything in v1 requires it. The new columns (`completed_at`, `linked_interaction_id`, `outcome_note`) are additive — apply them in the SAME migration run as the table creation.

| # | File | Change | Effort |
|---|---|---|---|
| 1 | `new-code/migration/apply-task-enhancements.cjs` | NEW — adds 3 columns + index | 1h |
| 2 | `data/tasks.ts` | Add `listTasksForRecord`, `completeTask`, `bulkUpdateTasks` | 1h |
| 3 | `components/tasks/RecordActivityHub.tsx` | NEW — universal hub component | 4h |
| 4 | `components/tasks/CompleteTodoPopup.tsx` | NEW — inline completion popup | 1h |
| 5 | `components/tasks/TaskKanbanCard.tsx` | NEW — kanban card renderer | 1h |
| 6 | `components/tasks/PriorityChip.tsx` | EXTRACT from MyTasksPage | 30m |
| 7 | `pages/TasksKanbanPage.tsx` | NEW — board view using GenericKanban | 2h |
| 8 | `pages/MyTasksPage.tsx` | Add view toggle + bulk select + bulk action bar + CALL task → navigate with state | 3h |
| 9 | `pages/LeadDetailPage.tsx` | Add `tasks` tab (or merge into activity tab) + read `location.state.taskId` on mount → open log-call modal + `completeTask` call | 2h |
| 10 | `pages/ContactDetailPage.tsx` | Add `tasks` tab + `RecordActivityHub` + same location.state handling | 2h |
| 11 | `pages/CompanyDetailPage.tsx` | Add `tasks` tab + `RecordActivityHub` + same location.state handling | 2h |
| 12 | `components/calls/LogDispositionModal.tsx` + `components/ui/DispositionForm.tsx` | Update `onLogged` callback to pass `interactionId: number` | 1h |
| 13 | Router config (`App.tsx` or routes file) | Add `/tasks/board` route | 30m |
| **Total** | | | **~20h** |

**v1 deliverables:**
- Tasks Kanban board at `/tasks/board` (grouped by Overdue/Today/Upcoming/Done, using GenericKanban)
- In-record Tasks + Activity hub on Lead, Contact, Company detail pages (open tasks list + call log feed + quick actions)
- CALL task → click → log-call modal opens → task auto-closes on save
- TODO/MEETING task → "Complete" → popup → mark done with optional outcome note
- Bulk update in MyTasksPage (status, due date, assignee, priority)

### v2 (next sprint)

| # | Feature | Notes |
|---|---|---|
| 1 | Email action on tasks | Task type `EMAIL` + compose modal (blocked on email integration) |
| 2 | Cadence / sequence builder | Predefined step sequences (call → wait → email → follow-up); requires new `cadence` + `cadence_step` tables |
| 3 | Task → project linkage | Add `project_id` to `task` (currently tasks are unscoped); enables project-filtered task boards |
| 4 | Kanban drag-to-move | Wire native DnD in `TasksKanbanPage` to call `updateTask(id, { due_at })` or change status |
| 5 | "Add note" for contacts/companies | Currently deferred — needs `contact_activity` / `company_activity` table or write to `interaction` |
| 6 | Meeting type task → calendar | When a MEETING task is completed, create/update a `meeting_master` row |
| 7 | Daily digest email | Already architected in `task_user_pref.daily_digest_opt_in` — wire the notify-service scanner |

---

## 8. What Is Pure-FE vs What Needs a Migration

| Item | Type | Migration? |
|---|---|---|
| `public.task` table + RLS | DB | YES — `apply-create-task-table.cjs` + `apply-task-rls.cjs` (already staged, run first) |
| `completed_at`, `linked_interaction_id`, `outcome_note` columns | DB | YES — new `apply-task-enhancements.cjs` |
| `listTasksForRecord`, `completeTask`, `bulkUpdateTasks` | Pure TS | No |
| `RecordActivityHub`, `TaskKanbanCard`, `CompleteTodoPopup`, `TasksKanbanPage` | Pure React | No |
| View toggle in MyTasksPage | Pure React | No |
| Bulk select + bulk action bar in MyTasksPage | Pure React | No |
| `onLogged(interactionId)` change in DispositionForm | Pure React (interface change) | No |
| Auto-complete wiring in detail pages | Pure React | No |

---

## 9. Key Risk Flags

1. **`public.task` not in prod** — this is the root blocker. ALL tasks features require the migration. Run `apply-create-task-table.cjs` + `apply-task-rls.cjs` before any v1 code ships.

2. **`public.call_log` not in prod** — do NOT use `LogCallModal` / `data/calls.ts` / `logCall()` in the auto-complete flow. Use `LogDispositionModal` → `DispositionForm` → `interaction` table. The spec above is already written against this reality.

3. **`DispositionForm.onLogged` interface change** — currently `() => void`. Changing it to `(interactionId: number) => void` may affect all callers. Audit before changing: grep for `onLogged` in `DispositionForm` usages.

4. **`interaction_id` availability** — `DispositionForm` calls `logDisposition()` from `data/projectStatus.ts`. Check whether `logDisposition()` returns the new row's `interaction_id` after insert. If not, add `.select('interaction_id').single()` to the insert there.

5. **Location state for auto-complete from MyTasksPage** — `navigate(path, { state })` works, but the detail page must read `location.state` in a `useEffect` that runs once on mount. Guard with `useRef(false)` to prevent double-firing from React StrictMode.

6. **RLS on `task` table** — RLS policy must allow each agent to SELECT tasks where `owner_user_id = auth.uid()` AND tasks linked to records they own. The `apply-task-rls.cjs` migration must be verified on the prod schema before launch.

---

## Implemented v1

**Session:** 2026-06-28 | **Ticket:** ALT-430 | **Build status:** CLEAN (`tsc -b && vite build` passes)

### Files created
| File | Purpose |
|---|---|
| `new-code/web/src/lib/tasksFlags.ts` | `TASKS_V2 = false` feature flag; flip to `true` after migration runs |
| `new-code/web/src/components/tasks/CompleteTodoPopup.tsx` | Outcome-note popup for TODO/MEETING completion; delegates to `markDone` when flag off |
| `new-code/web/src/components/tasks/TaskKanbanCard.tsx` | Single card for kanban board (type icon, subject, assoc label, priority chip, relative due) |
| `new-code/web/src/components/tasks/TasksKanbanView.tsx` | Kanban board using `GenericKanban<Task>` with OVERDUE/TODAY/UPCOMING/DONE columns; placeholder when flag off |
| `new-code/web/src/components/tasks/RecordActivityHub.tsx` | In-record activity hub (renders `null` when flag off); auto-complete CALL→LogDisposition→completeTask flow |
| `new-code/migration/apply-task-enhancements.cjs` | **STAGED — NOT run** (ALT-431): adds `completed_at`, `linked_interaction_id`, `outcome_note` columns + compound indexes to `public.task` |

### Files modified
| File | Change |
|---|---|
| `new-code/web/src/data/tasks.ts` | Added `listTasksForRecord`, `completeTask`, `bulkUpdateTasks`; added `TaskBulkPatch`, `BulkTaskResult`, `BulkTaskProgress` interfaces |
| `new-code/web/src/data/projectStatus.ts` | `appendInteraction()` now returns `{ interactionId, error }`; `logDisposition()` returns same; `logCompanyContactActivity` destructures correctly |
| `new-code/web/src/components/ui/DispositionForm.tsx` | `onLogged` prop now passes `{ disposition, noteText, interactionId }` |
| `new-code/web/src/components/calls/LogDispositionModal.tsx` | `onLogged` prop now `(interactionId?: number | null) => void`; forwards `interactionId` from DispositionForm |
| `new-code/web/src/pages/MyTasksPage.tsx` | Kanban toggle (TASKS_V2-gated), bulk select mode + bulk action bar (mark done / skip / set due date / set priority), `TasksKanbanView` integration |

### Architecture decisions
- **TASKS_V2 flag off by default** — zero impact on all existing pages until migration runs and flag is flipped. `RecordActivityHub` returns `null`; `TasksKanbanView` shows "coming soon" placeholder.
- **Auto-complete chain:** `LogDispositionModal.onLogged(interactionId)` → `completeTask(taskId, { linked_interaction_id: interactionId })` — only active when TASKS_V2=true.
- **Build fix:** `tsc -b` (composite build mode) choked on JSX inside `&&` chains inside JSX. Fixed by computing `kanbanSection: React.ReactNode` as a plain variable before the `return`, then rendering `{kanbanSection}` inline.
- **Smart-quote bug:** One edit session introduced Unicode curly-quote chars (U+201C/U+201D) into JSX attribute strings. Fixed by a Python byte-replace pass across MyTasksPage.tsx.

### What still requires owner action before v1 goes live
1. **Run staged migration** `node new-code/migration/apply-task-enhancements.cjs` (adds columns + indexes). Requires `.env` with `PG_CONNECTION_STRING` in `new-code/migration/`.
2. **Flip flag:** set `TASKS_V2 = true` in `new-code/web/src/lib/tasksFlags.ts` after migration.
3. **Push** (`git push altleads clean-main:main`) when owner says "push".
4. **`/tasks/board` route** — spec §3.1 mentions a standalone kanban route. Not added yet; kanban view is inline in MyTasksPage via view-mode toggle. Add route when standalone page is needed.
5. **RecordActivityHub wiring** — component is built but not yet dropped into LeadDetailPage / ContactDetailPage / CompanyDetailPage. Add `<RecordActivityHub recordType="lead" recordId={lead.lead_id} />` (guarded by flag so it's a no-op until migration runs).
6. **RLS verification** — validate `apply-task-rls.cjs` against prod schema before flipping flag to true.
