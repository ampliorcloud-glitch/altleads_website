/**
 * Admin activity timeline (ALT-268, owner #5).
 *
 * Read-only aggregation of org-wide activity for the admin "Activity" view. The
 * `interaction` table is the single richest activity store — appendInteraction()
 * (see projectStatus.ts) writes a row for every status change and every logged
 * call disposition, stamped with project_id, occurred_at and the acting user.
 * We read it newest-first, optionally scoped to one project (null = ALL projects),
 * and resolve actor + project names for display.
 *
 * No new table / migration — this only reads existing data.
 */

import { supabase } from '../lib/supabase';

interface InteractionRow {
  interaction_id: number;
  record_type: string;
  record_id: number;
  project_id: number | null;
  owner_user_id: number | null;
  type: string;
  disposition: string | null;
  note_text: string | null;
  occurred_at: string;
  created_by: string | null;
}

export type ActivityKind = 'status_change' | 'call' | 'other';

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  when: string;                 // occurred_at ISO
  actorName: string;            // resolved from created_by (user_id as text)
  recordType: string;          // 'contact' | 'company' | 'lead'
  recordId: number;
  projectId: number | null;
  projectName: string;
  disposition: string | null;
  note: string;
}

export interface ActivityTimelineResult {
  events: ActivityEvent[];
  /** True when the row cap was hit (older activity exists beyond what's shown). */
  truncated: boolean;
  error: string | null;
}

/**
 * Fetch the most recent activity across the org (admin-only caller).
 * projectId null = ALL projects. Capped at `limit` (default 200) newest-first.
 */
export async function fetchActivityTimeline(opts: {
  projectId: number | null;
  limit?: number;
}): Promise<ActivityTimelineResult> {
  const limit = opts.limit ?? 200;

  let query = supabase
    .from('interaction')
    .select(
      'interaction_id, record_type, record_id, project_id, owner_user_id, type, disposition, note_text, occurred_at, created_by',
    )
    .order('occurred_at', { ascending: false })
    .limit(limit);
  if (opts.projectId != null) query = query.eq('project_id', opts.projectId);

  const { data, error } = await query;
  if (error) return { events: [], truncated: false, error: error.message };
  const rows = (data ?? []) as InteractionRow[];

  // Resolve actor names (created_by is a user_id held as text) + project names.
  const userIds = [...new Set(rows.map((r) => Number(r.created_by)).filter((n) => !isNaN(n)))];
  const projectIds = [...new Set(rows.map((r) => r.project_id).filter((p): p is number => p != null))];

  const [usersRes, projectsRes] = await Promise.all([
    userIds.length
      ? supabase.from('user_master').select('user_id, full_name').in('user_id', userIds)
      : Promise.resolve({ data: [] as unknown[] }),
    projectIds.length
      ? supabase.from('project').select('project_id, project_name').in('project_id', projectIds)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const userMap = new Map<number, string>();
  ((usersRes.data ?? []) as { user_id: number; full_name: string | null }[]).forEach((u) =>
    userMap.set(u.user_id, u.full_name ?? ''),
  );
  const projMap = new Map<number, string>();
  ((projectsRes.data ?? []) as { project_id: number; project_name: string | null }[]).forEach((p) =>
    projMap.set(p.project_id, p.project_name ?? ''),
  );

  const events: ActivityEvent[] = rows.map((r) => ({
    id: String(r.interaction_id),
    kind: r.type === 'call' ? 'call' : r.type === 'status_change' ? 'status_change' : 'other',
    when: r.occurred_at,
    actorName: r.created_by ? userMap.get(Number(r.created_by)) || r.created_by : '',
    recordType: r.record_type,
    recordId: r.record_id,
    projectId: r.project_id,
    projectName: r.project_id != null ? projMap.get(r.project_id) ?? '' : '',
    disposition: r.disposition,
    note: r.note_text ?? '',
  }));

  return { events, truncated: rows.length >= limit, error: null };
}
