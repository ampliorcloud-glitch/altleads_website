/**
 * Call-log preview data layer (ALT-335).
 *
 * Reads the LIVE per-record call history straight from the `interaction` table —
 * the same store the DispositionForm writes to via logDisposition()
 * (data/projectStatus.ts), which appends a row with type `call`, the chosen
 * `disposition`, the `note_text` comment, `occurred_at` and the acting user in
 * `created_by` (a user_id held as TEXT).
 *
 * IMPORTANT: this deliberately does NOT read `public.call_log` / data/calls.ts —
 * that table is staged (migration not applied in production), so querying it
 * errors. Dispositions logged today land in `interaction`, so that is the only
 * source that reflects real activity.
 *
 * Read-only; no new table / migration. Mirrors the { data, error } conventions of
 * projectStatus.ts / activityTimeline.ts and resolves the actor name from
 * `user_master.full_name`, exactly like fetchActivityTimeline().
 */

import { supabase } from '../lib/supabase';

export type CallLogEntity = 'lead' | 'company' | 'contact' | 'meeting';

/** A single logged-call row, mapped for the compact preview list. */
export interface CallLogEntry {
  id: number;
  /** Raw disposition value as stored (already a human dropdown value/label). */
  disposition: string | null;
  /** The free-text comment / note captured with the call. */
  comment: string | null;
  /** occurred_at ISO string (newest-first ordering key). */
  date: string;
  /** Resolved actor name (falls back to the raw created_by id, or ''). */
  by: string;
}

export interface CallLogResult {
  calls: CallLogEntry[];
  /** True when the row cap was hit (older calls exist beyond what's shown). */
  truncated: boolean;
  error: string | null;
}

/** Shape of the columns we project from `interaction`. */
interface InteractionCallRow {
  interaction_id: number;
  disposition: string | null;
  note_text: string | null;
  occurred_at: string;
  created_at: string;
  created_by: string | null;
}

/**
 * Fetch the recent LOGGED calls for one record, newest-first.
 *
 * Reads `interaction` rows of type `call` for the given entity + id. When
 * `projectId` is provided the feed is scoped to that project (matching how the
 * preview's per-project status block is scoped); omit it (or pass null) to read
 * across all projects.
 *
 * Capped at `limit` (default 8) so the preview stays compact; `truncated` tells
 * the caller older calls exist. Returns an empty list (not an error) when no
 * calls have been logged.
 */
export async function fetchCallLogs(opts: {
  entity: CallLogEntity;
  id: number;
  projectId?: number | null;
  limit?: number;
}): Promise<CallLogResult> {
  const limit = opts.limit ?? 8;

  if (!opts.id) return { calls: [], truncated: false, error: null };

  let query = supabase
    .from('interaction')
    .select('interaction_id, disposition, note_text, occurred_at, created_at, created_by')
    .eq('record_type', opts.entity)
    .eq('record_id', opts.id)
    .eq('type', 'call')
    .order('occurred_at', { ascending: false })
    .limit(limit + 1); // fetch one extra to detect truncation
  if (opts.projectId != null) query = query.eq('project_id', opts.projectId);

  const { data, error } = await query;
  if (error) return { calls: [], truncated: false, error: error.message };

  const rows = (data ?? []) as InteractionCallRow[];
  const truncated = rows.length > limit;
  const visible = truncated ? rows.slice(0, limit) : rows;

  // Resolve actor names (created_by holds a user_id as text) in one round-trip.
  const userIds = [
    ...new Set(visible.map((r) => Number(r.created_by)).filter((n) => !Number.isNaN(n))),
  ];
  const userMap = new Map<number, string>();
  if (userIds.length) {
    const { data: users } = await supabase
      .from('user_master')
      .select('user_id, full_name')
      .in('user_id', userIds);
    ((users ?? []) as { user_id: number; full_name: string | null }[]).forEach((u) =>
      userMap.set(u.user_id, u.full_name ?? ''),
    );
  }

  const calls: CallLogEntry[] = visible.map((r) => ({
    id: r.interaction_id,
    disposition: r.disposition,
    comment: r.note_text,
    date: r.occurred_at ?? r.created_at,
    by: r.created_by ? userMap.get(Number(r.created_by)) || r.created_by : '',
  }));

  return { calls, truncated, error: null };
}
