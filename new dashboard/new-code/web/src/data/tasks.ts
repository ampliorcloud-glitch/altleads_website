/**
 * Task Manager — data layer (ALT-160).
 *
 * Supabase CRUD for the personal to-do / follow-up reminders module. Types here
 * mirror the canonical `public.task` data contract EXACTLY (column names + enums)
 * so the migration and the frontend never drift. The table does not exist in prod
 * yet (migration is staged) — at runtime queries will error until it is applied;
 * that is expected. Only TS compilation is required for this slice.
 *
 * IST bucketing note: per the spec (§6.5) the *display* layer buckets in
 * Asia/Kolkata. `listMyTasks` groups rows into Overdue / Today / Upcoming /
 * Completed using the Asia/Kolkata day boundary, computed in JS from `due_at`
 * (we do NOT rely on the DB for bucketing in this layer). See `bucketOf` in
 * components/tasks/taskScheduling.ts for the shared helper.
 */
import { supabase } from '../lib/supabase';
import { TASKS_V2 } from '../lib/tasksFlags';
import { humanizeWriteError } from '../lib/writeError';
import { bucketOf, type TaskBucket } from '../components/tasks/taskScheduling';

export type { TaskBucket };

/* ------------------------------------------------------------------ */
/*  Enums (match the CHECK constraints in the migration exactly)        */
/* ------------------------------------------------------------------ */

export type TaskType = 'CALL' | 'MEETING' | 'TODO';
export type TaskStatus = 'OPEN' | 'DONE' | 'SKIPPED';
export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH';

/**
 * A row of `public.task`. Column names are the canonical contract — do not
 * rename without changing the migration in lockstep.
 */
export interface Task {
  task_id: number;
  task_type: TaskType;
  subject: string;
  body: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  owner_user_id: number;
  assigned_by_user_id: number | null;
  lead_id: number | null;
  company_id: number | null;
  contact_id: number | null;
  meeting_id: number | null;
  assoc_label: string | null;
  assoc_phone: string | null;
  due_at: string;
  remind_offset_minutes: number;
  reminder_at: string | null;
  reminder_sent_at: string | null;
  created_by: number | null;
  created_date: string;
  updated_date: string | null;
  deleted_date: string | null;
}

/** All `task` columns, as a single select projection (kept in sync with `Task`). */
const TASK_COLUMNS =
  'task_id, task_type, subject, body, status, priority, owner_user_id, ' +
  'assigned_by_user_id, lead_id, company_id, contact_id, meeting_id, ' +
  'assoc_label, assoc_phone, due_at, remind_offset_minutes, reminder_at, ' +
  'reminder_sent_at, created_by, created_date, updated_date, deleted_date';

/**
 * Shape accepted by `createTask`. Server-maintained columns (task_id, status
 * default, reminder_at/reminder_sent_at trigger fields, audit dates) are NOT
 * part of the input. `owner_user_id` defaults to the creator at the call site.
 */
export interface TaskInput {
  task_type: TaskType;
  subject: string;
  body?: string | null;
  priority?: TaskPriority;
  owner_user_id: number;
  assigned_by_user_id?: number | null;
  lead_id?: number | null;
  company_id?: number | null;
  contact_id?: number | null;
  meeting_id?: number | null;
  assoc_label?: string | null;
  assoc_phone?: string | null;
  due_at: string;
  remind_offset_minutes?: number;
  created_by?: number | null;
}

/** Tasks grouped into the four My-Tasks buckets (IST day boundary). */
export interface GroupedTasks {
  Overdue: Task[];
  Today: Task[];
  Upcoming: Task[];
  Completed: Task[];
}

function emptyGroups(): GroupedTasks {
  return { Overdue: [], Today: [], Upcoming: [], Completed: [] };
}

/* ------------------------------------------------------------------ */
/*  Reads                                                               */
/* ------------------------------------------------------------------ */

/**
 * List the given user's tasks (owner = userId), newest-due first, grouped into
 * Overdue / Today / Upcoming / Completed computed in IST (Asia/Kolkata) in JS.
 *
 * RLS additionally lets TLs/Admins read team/all tasks, but this convenience
 * read filters to a single owner for the "My Tasks" page. Soft-deleted rows are
 * excluded. Returns empty groups (not an error) when the user has none.
 */
export async function listMyTasks(
  userId: number | null,
): Promise<{ groups: GroupedTasks; error: string | null }> {
  if (userId == null) {
    return { groups: emptyGroups(), error: null };
  }

  const { data, error } = await supabase
    .from('task')
    .select(TASK_COLUMNS)
    .eq('owner_user_id', userId)
    .is('deleted_date', null)
    .order('due_at', { ascending: true });

  if (error) {
    return { groups: emptyGroups(), error: error.message };
  }

  const rows = (data ?? []) as unknown as Task[];
  const groups = emptyGroups();
  for (const row of rows) {
    groups[bucketOf(row.status, row.due_at)].push(row);
  }
  return { groups, error: null };
}

/* ------------------------------------------------------------------ */
/*  Writes                                                              */
/* ------------------------------------------------------------------ */

/**
 * Create a task. `reminder_at` / `reminder_sent_at` are maintained by the DB
 * trigger from `due_at` + `remind_offset_minutes`, so we never set them here.
 */
export async function createTask(
  input: TaskInput,
): Promise<{ task: Task | null; error: string | null }> {
  const payload = {
    task_type: input.task_type,
    subject: input.subject,
    body: input.body ?? null,
    priority: input.priority ?? 'NORMAL',
    owner_user_id: input.owner_user_id,
    assigned_by_user_id: input.assigned_by_user_id ?? null,
    lead_id: input.lead_id ?? null,
    company_id: input.company_id ?? null,
    contact_id: input.contact_id ?? null,
    meeting_id: input.meeting_id ?? null,
    assoc_label: input.assoc_label ?? null,
    assoc_phone: input.assoc_phone ?? null,
    due_at: input.due_at,
    remind_offset_minutes: input.remind_offset_minutes ?? 0,
    created_by: input.created_by ?? input.owner_user_id,
  };

  const { data, error } = await supabase
    .from('task')
    .insert(payload)
    .select(TASK_COLUMNS)
    .single();

  if (error) return { task: null, error: humanizeWriteError(error) };
  return { task: data as unknown as Task, error: null };
}

/** Partial update of mutable task fields. `updated_date` is trigger-maintained. */
export type TaskPatch = Partial<
  Pick<
    Task,
    | 'task_type'
    | 'subject'
    | 'body'
    | 'status'
    | 'priority'
    | 'owner_user_id'
    | 'assigned_by_user_id'
    | 'lead_id'
    | 'company_id'
    | 'contact_id'
    | 'meeting_id'
    | 'assoc_label'
    | 'assoc_phone'
    | 'due_at'
    | 'remind_offset_minutes'
  >
>;

export async function updateTask(
  id: number,
  patch: TaskPatch,
): Promise<{ task: Task | null; error: string | null }> {
  const { data, error } = await supabase
    .from('task')
    .update(patch)
    .eq('task_id', id)
    .select(TASK_COLUMNS)
    .single();

  if (error) return { task: null, error: humanizeWriteError(error) };
  return { task: data as unknown as Task, error: null };
}

/** Mark a task done (status = DONE). */
export function markDone(id: number): Promise<{ task: Task | null; error: string | null }> {
  return updateTask(id, { status: 'DONE' });
}

/** Skip a task (status = SKIPPED) — no longer relevant, but not deleted. */
export function skipTask(id: number): Promise<{ task: Task | null; error: string | null }> {
  return updateTask(id, { status: 'SKIPPED' });
}

/**
 * Snooze = push `due_at` later. The DB trigger then recomputes `reminder_at`
 * and clears `reminder_sent_at` so the reminder can fire again — no special
 * casing needed here beyond the new due time.
 *
 * @param newDueAt ISO timestamptz string for the new due time.
 */
export function snoozeTask(
  id: number,
  newDueAt: string,
): Promise<{ task: Task | null; error: string | null }> {
  return updateTask(id, { due_at: newDueAt });
}

/* ------------------------------------------------------------------ */
/*  Digest preference (task_user_pref)                                  */
/* ------------------------------------------------------------------ */

/**
 * Read the user's daily-digest opt-in. Defaults to `false` (digest OFF) when no
 * pref row exists yet — matching the locked decision (per-task email default;
 * daily summary is opt-in).
 */
export async function getDigestPref(
  userId: number | null,
): Promise<{ optIn: boolean; error: string | null }> {
  if (userId == null) return { optIn: false, error: null };

  const { data, error } = await supabase
    .from('task_user_pref')
    .select('daily_digest_opt_in')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return { optIn: false, error: error.message };
  const row = data as { daily_digest_opt_in: boolean } | null;
  return { optIn: row?.daily_digest_opt_in ?? false, error: null };
}

/**
 * Set the user's daily-digest opt-in, upserting the pref row.
 */
export async function setDigestPref(
  userId: number,
  optIn: boolean,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('task_user_pref')
    .upsert(
      { user_id: userId, daily_digest_opt_in: optIn },
      { onConflict: 'user_id' },
    );

  return { error: error ? humanizeWriteError(error) : null };
}

/* ------------------------------------------------------------------ */
/*  Per-record task listing (ALT-430)                                  */
/* ------------------------------------------------------------------ */

/**
 * List all tasks linked to a specific record (lead / contact / company).
 * Returns all statuses (open + done + skipped); the caller filters in the UI.
 * Ordered: open tasks by due_at ASC, then completed/skipped by updated_date DESC.
 */
export async function listTasksForRecord(
  recordType: 'lead' | 'contact' | 'company',
  recordId: number | string,
): Promise<{ tasks: Task[]; error: string | null }> {
  const col =
    recordType === 'lead'
      ? 'lead_id'
      : recordType === 'contact'
        ? 'contact_id'
        : 'company_id';

  const { data, error } = await supabase
    .from('task')
    .select(TASK_COLUMNS)
    .eq(col, recordId)
    .is('deleted_date', null)
    .order('due_at', { ascending: true });

  if (error) return { tasks: [], error: error.message };
  return { tasks: (data ?? []) as unknown as Task[], error: null };
}

/* ------------------------------------------------------------------ */
/*  Task completion (ALT-430)                                          */
/* ------------------------------------------------------------------ */

/**
 * Complete a task — sets status = DONE.
 *
 * When TASKS_V2 = true (after apply-task-enhancements.cjs is run):
 *   - Also stamps completed_at
 *   - Optionally writes linked_interaction_id (interaction row that closed it)
 *   - Optionally writes outcome_note (short text for TODO/MEETING completions)
 *
 * When TASKS_V2 = false: only flips status to DONE (same as markDone()).
 *
 * TODO(gatekeeper ALT-431): flip TASKS_V2 after migration runs in prod.
 * TODO(event-spine): emit task-completed event here when the event bus is ready.
 */
export async function completeTask(
  taskId: number,
  opts: {
    linked_interaction_id?: number | null;
    outcome_note?: string | null;
  } = {},
): Promise<{ task: Task | null; error: string | null }> {
  const patch: Record<string, unknown> = { status: 'DONE' };

  if (TASKS_V2) {
    patch.completed_at = new Date().toISOString();
    if (opts.linked_interaction_id != null) {
      patch.linked_interaction_id = opts.linked_interaction_id;
    }
    if (opts.outcome_note != null) {
      patch.outcome_note = opts.outcome_note;
    }
  }

  const { data, error } = await supabase
    .from('task')
    .update(patch)
    .eq('task_id', taskId)
    .select(TASK_COLUMNS)
    .single();

  if (error) return { task: null, error: humanizeWriteError(error) };
  return { task: data as unknown as Task, error: null };
}

/* ------------------------------------------------------------------ */
/*  Bulk update (ALT-430)                                              */
/* ------------------------------------------------------------------ */

export interface TaskBulkPatch {
  status?: TaskStatus;
  due_at?: string;
  owner_user_id?: number;
  priority?: TaskPriority;
}

export interface BulkTaskResult {
  ok: number;
  failed: number;
  error: string | null;
}

export interface BulkTaskProgress {
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

/**
 * Bulk update tasks — loops over the ids calling updateTask one-by-one so
 * RLS is applied per-row and partial-success is tracked.
 * Reuses the same BulkProgress shape as bulkActions.ts.
 *
 * TODO(gatekeeper ALT-431): no migration required — works against existing columns.
 */
export async function bulkUpdateTasks(
  taskIds: number[],
  patch: TaskBulkPatch,
  opts?: BulkTaskProgress,
): Promise<BulkTaskResult> {
  let ok = 0;
  let failed = 0;
  let firstErr: string | null = null;
  const total = taskIds.length;

  for (const id of taskIds) {
    if (opts?.signal?.aborted) break;
    const { error } = await updateTask(id, patch as TaskPatch);
    if (error) {
      failed += 1;
      if (!firstErr) firstErr = error;
    } else {
      ok += 1;
    }
    opts?.onProgress?.(ok + failed, total);
  }

  return {
    ok,
    failed,
    error:
      failed > 0
        ? firstErr ?? `${failed} task${failed === 1 ? '' : 's'} could not be updated.`
        : null,
  };
}
