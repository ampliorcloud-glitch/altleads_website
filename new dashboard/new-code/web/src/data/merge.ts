/**
 * Merge-duplicates data layer (ALT-293) — admin-only.
 *
 * Picks a SURVIVOR record, re-points every child row that referenced the LOSER
 * to the survivor, then soft-deletes the loser (deleted_by / deleted_date — the
 * same convention used across admin.ts / leadWorkspace.ts).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️  NOT ATOMIC — READ THIS (flag for the orchestrator).
 *
 * This is a CLIENT-SIDE SEQUENCE of independent Supabase calls. It is NOT a
 * transaction. If the browser/network dies (or RLS rejects) midway, you can be
 * left HALF-MERGED: some children re-pointed to the survivor, the loser still
 * alive (or vice-versa). There is no automatic rollback.
 *
 * The correct eventual home for this is a SINGLE `SECURITY DEFINER` Postgres RPC
 * that does all the UPDATEs + the soft-delete inside ONE transaction (BEGIN…
 * COMMIT), so the whole merge is all-or-nothing and runs with the privileges to
 * re-point rows the calling admin may not directly own under RLS. Until that RPC
 * exists, treat this as an admin-supervised tool: take a backup / run on a quiet
 * table, and eyeball the result.
 *
 * We mitigate by STOPPING at the first error (we never continue a half-merge),
 * and by doing the soft-delete of the loser LAST — so if re-pointing fails the
 * loser is still discoverable and nothing is orphaned.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Relationships re-pointed (verified against the data layer, not guessed):
 *
 *   COMPANY merge (loser company_id → survivor company_id):
 *     - contact_master.company_id           (companies.ts:108 ContactRow.company_id)
 *     - company_project_status.company_id    (projectStatus.ts:8, UNIQUE(company_id,project_id))
 *     - lead_master.company_id               (companies.ts:116 LeadRow.company_id)
 *     - interaction (record_type='company', record_id)  (contacts.ts:22-34 Interaction)
 *     NOTE: lead_master.client_assoc_id is NOT a company FK — it points at
 *     client_association (the separate "client" table, realLeads.ts:7,20). We do
 *     NOT touch it here.
 *
 *   CONTACT merge (loser contact_id → survivor contact_id):
 *     - lead_master.contact_id               (contacts.ts:159 fetchContactLeads)
 *     - contact_project_status.contact_id     (projectStatus.ts:7, UNIQUE(contact_id,project_id))
 *     - interaction (record_type='contact', record_id)  (contacts.ts:180-190)
 *
 * ⚠️  PER-PROJECT STATUS COLLISION (needs validation before real use):
 *   *_project_status has a UNIQUE(record_id, project_id). If the loser AND the
 *   survivor BOTH have a status row for the SAME project, the blunt
 *   `UPDATE … SET id = survivor WHERE id = loser` will hit a duplicate-key (23505)
 *   error and the whole merge STOPS (no half-merge). We surface that as a friendly
 *   message telling the admin to resolve the conflicting project status first. A
 *   real RPC should merge/dedupe these rows per project rather than failing.
 */

import { supabase } from '../lib/supabase';
import { humanizeWriteError } from '../lib/writeError';

/**
 * ALT-416 ATOMIC-MERGE FLAG.
 *
 * false (DEFAULT — PRODUCTION UNCHANGED): the legacy client-side sequence below
 * runs. Non-atomic, but exactly today's behavior.
 *
 * true: route through the `merge_records` Postgres RPC (one server-side
 * transaction — all-or-nothing). ⚠️ Flip this to `true` ONLY AFTER
 * new-code/migration/apply-merge-rpc.cjs has been applied to the database
 * (owner sign-off + throwaway-login validation). Flipping it before the
 * function exists makes every merge fail with "feature isn't enabled yet".
 */
const USE_MERGE_RPC = false;

export interface MergeArgs {
  /** The record that SURVIVES (children get re-pointed to it). */
  survivorId: string;
  /** The record that is soft-deleted after its children move. */
  loserId: string;
  /** Acting user_id as TEXT (audit convention across the app). */
  actor: string | null;
}

export interface MergeResult {
  ok: boolean;
  error: string | null;
  /** Per-relationship count of rows re-pointed, e.g. { 'contact_master.company_id': 3 }. */
  repointed: Record<string, number>;
}

/** Friendly text for the most common failure modes seen on a client-side merge. */
function friendlyError(error: { code?: string; message?: string } | null, fallback: string): string {
  if (!error) return fallback;
  if (error.code === '42501') {
    // RLS / row-level-security rejection.
    return 'You must be an admin to merge records. (This action is admin-only.)';
  }
  if (error.code === '23505') {
    // Unique violation — almost always the per-project status collision.
    return 'Both records already have a status for the same project. Resolve that conflicting project status first, then merge.';
  }
  // Missing-table / RLS / schema-cache (42P01 / PGRST205 / 42501) → friendly line;
  // otherwise the writer's own message, then the step fallback.
  return humanizeWriteError(error) || error.message || fallback;
}

const nowIso = () => new Date().toISOString();

/**
 * Re-point a single child FK from loser → survivor and return how many rows moved.
 * Stops the caller on any error. `.select(idCol)` makes PostgREST return the
 * affected rows so we can count them (and so RLS rejections surface as errors).
 */
async function repoint(
  table: string,
  fkCol: string,
  idCol: string,
  survivorId: number,
  loserId: number,
  actor: string | null,
): Promise<{ count: number; error: { code?: string; message?: string } | null }> {
  try {
    const patch: Record<string, unknown> = { [fkCol]: survivorId };
    // Stamp an audit trail where the table supports it. *_project_status,
    // contact_master, company_master and lead_master all carry updated_by/_date.
    patch.updated_by = actor;
    patch.updated_date = nowIso();

    const { data, error } = await supabase
      .from(table)
      .update(patch)
      .eq(fkCol, loserId)
      .select(idCol);
    if (error) return { count: 0, error };
    return { count: (data as unknown[] | null)?.length ?? 0, error: null };
  } catch (e) {
    return { count: 0, error: { message: (e as Error).message } };
  }
}

/**
 * Re-point interaction rows. The interaction table keys a record by the PAIR
 * (record_type, record_id) — there is no updated_by column on it, so we only
 * move record_id and scope by record_type.
 */
async function repointInteractions(
  recordType: 'company' | 'contact',
  survivorId: number,
  loserId: number,
): Promise<{ count: number; error: { code?: string; message?: string } | null }> {
  try {
    const { data, error } = await supabase
      .from('interaction')
      .update({ record_id: survivorId })
      .eq('record_type', recordType)
      .eq('record_id', loserId)
      .select('interaction_id');
    if (error) return { count: 0, error };
    return { count: (data as unknown[] | null)?.length ?? 0, error: null };
  } catch (e) {
    return { count: 0, error: { message: (e as Error).message } };
  }
}

/** Soft-delete the loser row (deleted_by / deleted_date). Runs LAST. */
async function softDeleteLoser(
  table: string,
  idCol: string,
  loserId: number,
  actor: string | null,
): Promise<{ error: { code?: string; message?: string } | null }> {
  try {
    const { error } = await supabase
      .from(table)
      .update({ deleted_by: actor, deleted_date: nowIso() })
      .eq(idCol, loserId)
      .is('deleted_date', null);
    return { error: error ?? null };
  } catch (e) {
    return { error: { message: (e as Error).message } };
  }
}

/* ------------------------------------------------------------------ */
/*  Atomic path (ALT-416) — one Postgres RPC, all-or-nothing.          */
/*  Used ONLY when USE_MERGE_RPC === true (see flag at top of file).   */
/* ------------------------------------------------------------------ */

/**
 * Call the `merge_records` SECURITY DEFINER RPC, which does the SAME FK
 * re-points + loser soft-delete as the client-side path below, but inside ONE
 * server-side transaction (so a mid-merge failure rolls the whole thing back —
 * no half-merge). Maps errors through the same friendly-error helper.
 */
async function mergeRecordsViaRpc(
  recordType: 'company' | 'contact',
  { survivorId, loserId, actor }: MergeArgs,
): Promise<MergeResult> {
  const repointed: Record<string, number> = {};
  const survivor = Number(survivorId);
  const loser = Number(loserId);

  if (!Number.isFinite(survivor) || !Number.isFinite(loser)) {
    return { ok: false, error: 'Invalid record id.', repointed };
  }
  if (survivor === loser) {
    return {
      ok: false,
      error: `Pick two different ${recordType === 'company' ? 'companies' : 'contacts'} to merge.`,
      repointed,
    };
  }

  const { data, error } = await supabase.rpc('merge_records', {
    p_record_type: recordType,
    p_survivor_id: survivor,
    p_loser_id: loser,
    p_actor: actor,
  });

  if (error) {
    return { ok: false, error: friendlyError(error, 'Merge failed.'), repointed };
  }

  // The RPC returns { ok, type, survivorId, loserId, repointed:{...} }. Surface
  // the per-relationship counts (numbers only) so the modal's "moved N" toast works.
  const payload = (data ?? {}) as { repointed?: Record<string, unknown> };
  for (const [k, v] of Object.entries(payload.repointed ?? {})) {
    if (typeof v === 'number') repointed[k] = v;
  }
  return { ok: true, error: null, repointed };
}

/* ------------------------------------------------------------------ */
/*  Company merge                                                      */
/* ------------------------------------------------------------------ */

export async function mergeCompanies(args: MergeArgs): Promise<MergeResult> {
  if (USE_MERGE_RPC) return mergeRecordsViaRpc('company', args);
  return mergeCompaniesClientSide(args);
}

async function mergeCompaniesClientSide({ survivorId, loserId, actor }: MergeArgs): Promise<MergeResult> {
  const repointed: Record<string, number> = {};
  const survivor = Number(survivorId);
  const loser = Number(loserId);

  if (!Number.isFinite(survivor) || !Number.isFinite(loser)) {
    return { ok: false, error: 'Invalid record id.', repointed };
  }
  if (survivor === loser) {
    return { ok: false, error: 'Pick two different companies to merge.', repointed };
  }

  // ── Re-point children (stop on first error → never a half-merge past this). ──
  const steps: Array<{ key: string; table: string; fk: string; id: string }> = [
    { key: 'contact_master.company_id', table: 'contact_master', fk: 'company_id', id: 'contact_id' },
    { key: 'company_project_status.company_id', table: 'company_project_status', fk: 'company_id', id: 'company_id' },
    { key: 'lead_master.company_id', table: 'lead_master', fk: 'company_id', id: 'lead_id' },
  ];

  for (const s of steps) {
    const r = await repoint(s.table, s.fk, s.id, survivor, loser, actor);
    if (r.error) {
      return { ok: false, error: friendlyError(r.error, `Failed re-pointing ${s.key}.`), repointed };
    }
    repointed[s.key] = r.count;
  }

  // interaction rows (record_type='company')
  const intr = await repointInteractions('company', survivor, loser);
  if (intr.error) {
    return { ok: false, error: friendlyError(intr.error, 'Failed re-pointing company activity.'), repointed };
  }
  repointed['interaction(company).record_id'] = intr.count;

  // ── Soft-delete the loser LAST. ──
  const del = await softDeleteLoser('company_master', 'company_id', loser, actor);
  if (del.error) {
    return {
      ok: false,
      error: friendlyError(
        del.error,
        'Children were re-pointed but the duplicate company could not be deleted — finish it manually.',
      ),
      repointed,
    };
  }

  return { ok: true, error: null, repointed };
}

/* ------------------------------------------------------------------ */
/*  Contact merge                                                      */
/* ------------------------------------------------------------------ */

export async function mergeContacts(args: MergeArgs): Promise<MergeResult> {
  if (USE_MERGE_RPC) return mergeRecordsViaRpc('contact', args);
  return mergeContactsClientSide(args);
}

async function mergeContactsClientSide({ survivorId, loserId, actor }: MergeArgs): Promise<MergeResult> {
  const repointed: Record<string, number> = {};
  const survivor = Number(survivorId);
  const loser = Number(loserId);

  if (!Number.isFinite(survivor) || !Number.isFinite(loser)) {
    return { ok: false, error: 'Invalid record id.', repointed };
  }
  if (survivor === loser) {
    return { ok: false, error: 'Pick two different contacts to merge.', repointed };
  }

  const steps: Array<{ key: string; table: string; fk: string; id: string }> = [
    { key: 'lead_master.contact_id', table: 'lead_master', fk: 'contact_id', id: 'lead_id' },
    { key: 'contact_project_status.contact_id', table: 'contact_project_status', fk: 'contact_id', id: 'contact_id' },
  ];

  for (const s of steps) {
    const r = await repoint(s.table, s.fk, s.id, survivor, loser, actor);
    if (r.error) {
      return { ok: false, error: friendlyError(r.error, `Failed re-pointing ${s.key}.`), repointed };
    }
    repointed[s.key] = r.count;
  }

  // interaction rows (record_type='contact')
  const intr = await repointInteractions('contact', survivor, loser);
  if (intr.error) {
    return { ok: false, error: friendlyError(intr.error, 'Failed re-pointing contact activity.'), repointed };
  }
  repointed['interaction(contact).record_id'] = intr.count;

  // ── Soft-delete the loser LAST. ──
  const del = await softDeleteLoser('contact_master', 'contact_id', loser, actor);
  if (del.error) {
    return {
      ok: false,
      error: friendlyError(
        del.error,
        'Children were re-pointed but the duplicate contact could not be deleted — finish it manually.',
      ),
      repointed,
    };
  }

  return { ok: true, error: null, repointed };
}
