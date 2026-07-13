/**
 * concurrency.ts — Optimistic-concurrency / lost-update guard (ALT-430).
 *
 * Feature flag: CONCURRENCY_GUARD (default false).
 *   false → every update behaves exactly as before (no precondition).
 *   true  → each guarded update adds `.eq('updated_date', originalDate)` to the
 *            Supabase query. PostgREST executes this as a WHERE clause, so if
 *            another user has written the row since you loaded it the UPDATE
 *            matches ZERO rows — detected as a conflict and surfaced to the user.
 *
 * Ship "dark": this flag is false in production until we confirm that every
 * guarded table has a reliably trigger-maintained (or app-maintained) updated_date.
 * Confirmed in ALT-430 discovery (2026-06-28):
 *   lead_master           — updated_date column, set in app (leadsApi.updateLead)
 *   lead_report           — updated_date column, set in app (leadsApi.updateLeadStage + meetings)
 *   meeting_master        — updated_date column, set in app (meetings.ts writers)
 *   contact_master        — updated_date column, set in app (contacts.updateContactCompany)
 *   wishlist              — updated_date column, set in app (wishlist.ts writers)
 *   contact_project_status/company_project_status — SKIPPED (upsert-by-composite-PK;
 *     the status-tracking tables are not "edited from a loaded form" in the same way
 *     and the concurrency risk is lower — their writes are fire-and-forget status tags).
 */

/* ── Feature flag ────────────────────────────────────────────────────────── */

/**
 * Set to true (manually, in development) to activate the optimistic-concurrency
 * preconditions. Keep false until all tables' updated_date maintenance is verified
 * in production, and until QA sign-off on the conflict UX.
 */
export const CONCURRENCY_GUARD = false;

/* ── Conflict result type ────────────────────────────────────────────────── */

/**
 * Returned by a guarded update when another write has occurred since the record
 * was loaded. NOT a generic error — callers distinguish it with `isConflict()`.
 *
 * `kind: 'conflict'` is the discriminant.
 * `table`            is the DB table that conflicted (for logging / debug).
 */
export interface ConflictResult {
  kind: 'conflict';
  table: string;
  message: string;
}

/** Type-guard: true when the value is a ConflictResult. */
export function isConflict(v: unknown): v is ConflictResult {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as { kind?: unknown }).kind === 'conflict'
  );
}

/* ── Conflict UX copy ────────────────────────────────────────────────────── */

/** Friendly one-liner shown in-form when a conflict is detected. */
export const CONFLICT_MESSAGE =
  'This record changed since you opened it — reload to see the latest, then re-apply your change.';

/* ── Helper: build the `.eq` precondition for a guarded update ───────────── */

/**
 * Returns the original `updated_date` value that should be used as a precondition
 * on the Supabase `.update()` chain. When CONCURRENCY_GUARD is OFF it returns
 * undefined, which means the caller should skip adding the `.eq` filter (no-op).
 *
 * Usage:
 *   const guard = concurrencyPrecondition(originalUpdatedDate);
 *   let q = supabase.from('lead_master').update(payload).eq('lead_id', id);
 *   if (guard !== undefined) q = q.eq('updated_date', guard);
 *   const { data } = await q.select('lead_id');
 *   if (data && (data as unknown[]).length === 0 && guard !== undefined) { ...conflict... }
 */
export function concurrencyPrecondition(
  originalUpdatedDate: string | null | undefined
): string | null | undefined {
  if (!CONCURRENCY_GUARD) return undefined;
  return originalUpdatedDate ?? null;
}

/**
 * Build a ConflictResult for the given table.
 * Pass into the guarded update functions' return type when zero rows matched.
 */
export function makeConflict(table: string): ConflictResult {
  return { kind: 'conflict', table, message: CONFLICT_MESSAGE };
}
