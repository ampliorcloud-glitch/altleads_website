/**
 * bulkActions.ts — multi-record list actions (ALT-291, ALT-443).
 *
 * "Add to project" upserts a per-project status row for each selected
 * company/contact (company_project_status / contact_project_status). Because
 * those rows ARE the project membership, upserting an (id, project) row with no
 * status simply enrolls the record in the project — the data-prep step before a
 * project's records are worked. Reuses the audited single-record upserts so RLS,
 * history (interaction), and the 42501 friendly-message all behave identically.
 *
 * ALT-443: adds fair-distribution helpers for bulk reassignment across multiple
 * owners with an optional per-company cap (Apollo/HubSpot parity).
 */
import { upsertCompanyStatus, upsertContactStatus } from './projectStatus';

export interface BulkResult {
  ok: number;
  failed: number;
  error: string | null;
}

export interface BulkProgress {
  /** Called after each record is processed, with how many are done and the total. */
  onProgress?: (done: number, total: number) => void;
  /** When aborted, the loop stops cleanly BETWEEN records and returns partial counts. */
  signal?: AbortSignal;
}

async function addToProjectLoop(
  ids: number[],
  projectId: number,
  actor: string | null,
  kind: 'company' | 'contact',
  opts?: BulkProgress,
): Promise<BulkResult> {
  let ok = 0;
  let failed = 0;
  let firstErr: string | null = null;
  const total = ids.length;
  for (const id of ids) {
    if (opts?.signal?.aborted) break;
    const res =
      kind === 'company'
        ? await upsertCompanyStatus(id, projectId, {}, actor)
        : await upsertContactStatus(id, projectId, {}, actor);
    if (res.error) {
      failed += 1;
      if (!firstErr) firstErr = res.error;
    } else {
      ok += 1;
    }
    opts?.onProgress?.(ok + failed, total);
  }
  return {
    ok,
    failed,
    error: failed > 0 ? firstErr ?? `${failed} could not be added (no permission).` : null,
  };
}

/** Enroll selected companies into a project (creates their company_project_status row). */
export function addCompaniesToProject(ids: number[], projectId: number, actor: string | null, opts?: BulkProgress): Promise<BulkResult> {
  return addToProjectLoop(ids, projectId, actor, 'company', opts);
}

/** Enroll selected contacts into a project (creates their contact_project_status row). */
export function addContactsToProject(ids: number[], projectId: number, actor: string | null, opts?: BulkProgress): Promise<BulkResult> {
  return addToProjectLoop(ids, projectId, actor, 'contact', opts);
}

/**
 * Set the per-project status on each selected record (Step E, universal pass).
 *
 * Reuses the same audited single-record upserts as add-to-project, so RLS,
 * history (interaction), and the 42501 friendly-message all behave identically.
 * Mirrors addToProjectLoop's partial-result + friendly-error bubbling.
 */
async function setStatusLoop(
  ids: number[],
  projectId: number,
  status: string,
  actor: string | null,
  kind: 'company' | 'contact',
  opts?: BulkProgress,
): Promise<BulkResult> {
  let ok = 0;
  let failed = 0;
  let firstErr: string | null = null;
  const total = ids.length;
  for (const id of ids) {
    if (opts?.signal?.aborted) break;
    const res =
      kind === 'company'
        ? await upsertCompanyStatus(id, projectId, { account_status: status }, actor)
        : await upsertContactStatus(id, projectId, { contact_status: status }, actor);
    if (res.error) {
      failed += 1;
      if (!firstErr) firstErr = res.error;
    } else {
      ok += 1;
    }
    opts?.onProgress?.(ok + failed, total);
  }
  return {
    ok,
    failed,
    error: failed > 0 ? firstErr ?? `${failed} could not be updated (no permission).` : null,
  };
}

/** Set account_status on the selected companies (per-project). */
export function setCompaniesStatus(
  ids: number[],
  projectId: number,
  status: string,
  actor: string | null,
  opts?: BulkProgress,
): Promise<BulkResult> {
  return setStatusLoop(ids, projectId, status, actor, 'company', opts);
}

/** Set contact_status on the selected contacts (per-project). */
export function setContactsStatus(
  ids: number[],
  projectId: number,
  status: string,
  actor: string | null,
  opts?: BulkProgress,
): Promise<BulkResult> {
  return setStatusLoop(ids, projectId, status, actor, 'contact', opts);
}

/* ── ALT-443: Fair-distribution cap ─────────────────────────────────────── */

/**
 * A record to be bulk-reassigned, with an optional company label used by the
 * per-company cap to group records when distributing across owners.
 */
export interface DistributableRecord {
  id: number;
  /** Stable company identifier (client_assoc_id / company_id) for the cap grouping. */
  companyKey?: number | string | null;
}

/**
 * Options controlling the fair-distribution reassignment.
 *
 * When `maxPerCompany` is set, the round-robin distributor limits how many
 * records from the SAME company a single owner can receive in one batch. If the
 * cap is hit for an owner+company pair, the next eligible owner in the rotation
 * is tried instead (wrapping around). Any overflow (all owners capped for that
 * company) spills into the next rotation pass.
 */
export interface DistributionOptions {
  /** Cap: max records per (owner, company) pair. 0 / undefined = no cap. */
  maxPerCompany?: number;
}

/**
 * Distribute N record-IDs across K owners in round-robin order, optionally
 * capping how many records from the same company each owner receives.
 *
 * Returns a Map<ownerId, recordId[]> — the caller then bulk-writes each slice.
 *
 * Algorithm:
 *   1. Round-robin through `ownerIds`, skipping an owner if they've already
 *      received `maxPerCompany` records from `record.companyKey` this batch.
 *   2. If ALL owners are capped for the current company, reset that company's
 *      per-owner tally and continue (spill-over pass) — ensures every record is
 *      assigned even when there are more records from one company than
 *      owners × cap.
 */
export function distributeRecords(
  records: DistributableRecord[],
  ownerIds: number[],
  opts?: DistributionOptions,
): Map<number, number[]> {
  if (ownerIds.length === 0) return new Map();
  const cap = opts?.maxPerCompany && opts.maxPerCompany > 0 ? opts.maxPerCompany : Infinity;

  const result = new Map<number, number[]>(ownerIds.map((id) => [id, []]));
  // perOwnerCompany[ownerId][companyKey] = count this batch
  const perOwnerCompany = new Map<number, Map<string, number>>(
    ownerIds.map((id) => [id, new Map()]),
  );

  let ownerIdx = 0;

  for (const rec of records) {
    const ck = rec.companyKey != null ? String(rec.companyKey) : '__none__';
    let assigned = false;
    // Try each owner starting at ownerIdx; if all are capped, reset company
    // tallies for this key and try again (spill-over).
    let attempts = 0;
    while (!assigned) {
      // Check cap for ownerIds[ownerIdx % ownerIds.length]
      const triedAll = attempts >= ownerIds.length;
      if (triedAll) {
        // Spill-over: reset company tallies for this key for all owners and restart.
        for (const [, companyMap] of perOwnerCompany) {
          companyMap.delete(ck);
        }
        attempts = 0;
      }
      const oid = ownerIds[ownerIdx % ownerIds.length];
      const companyMap = perOwnerCompany.get(oid)!;
      const count = companyMap.get(ck) ?? 0;
      if (count < cap) {
        result.get(oid)!.push(rec.id);
        companyMap.set(ck, count + 1);
        ownerIdx = (ownerIdx + 1) % ownerIds.length;
        assigned = true;
      } else {
        ownerIdx = (ownerIdx + 1) % ownerIds.length;
        attempts += 1;
      }
    }
  }

  return result;
}
