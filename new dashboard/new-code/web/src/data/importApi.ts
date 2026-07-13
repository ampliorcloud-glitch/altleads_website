/**
 * importApi.ts — typed client for the import write-engine (DEC-14)
 *
 * Wraps `callGateway` for all three import actions (company / contact / lead)
 * and their corresponding undo actions.
 *
 * Feature flag: VITE_USE_WRITE_GATEWAY (default false)
 * ─────────────────────────────────────────────────────
 * When the flag is OFF, all calls return { ok: false, bypassed: true } and no
 * writes happen.  This is the current default — the import wizard shows a
 * "not enabled" notice in that case.  Flip the flag to enable real writes.
 *
 * Chunking
 * ────────
 * The server enforces ≤ 500 rows per call (MAX_CHUNK_ROWS).  `runImportChunked`
 * splits a larger array and calls the gateway once per chunk, collecting totals.
 * The UI receives progressive updates via an optional `onChunkDone` callback.
 *
 * Actions registered (gateway allow-list + server handlers):
 *   company.import      → upsert companies       (ADMIN only)
 *   contact.import      → upsert contacts         (ADMIN only)
 *   lead.import         → upsert leads            (ADMIN only)
 *   company.importUndo  → undo a company batch    (ADMIN only)
 *   contact.importUndo  → undo a contact batch    (ADMIN only)
 *   lead.importUndo     → undo a lead batch       (ADMIN only)
 */

import { callGateway, isWriteGatewayEnabled, type GatewayAction } from '../lib/writeGateway';
import type { MappedRow } from '../lib/importValidate';

/* ── Constants ────────────────────────────────────────────────────── */

export const IMPORT_CHUNK_SIZE = 500; // must match server MAX_CHUNK_ROWS

/* ── Entity type ─────────────────────────────────────────────────── */

export type ImportEntity = 'company' | 'contact' | 'lead';

/* ── Per-row result (mirrors server importEngine.js processRow return) */

export interface ImportRowResult {
  status: 'inserted' | 'updated' | 'skipped' | 'error';
  recordId: number | null;
  errorMsg: string | null;
}

/* ── Chunk response (single gateway call result) ─────────────────── */

export interface ImportChunkResult {
  ok: true;
  batchId: number | null;
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  error: number;
  rowResults: ImportRowResult[];
}

/* ── Aggregated result across all chunks ─────────────────────────── */

export interface ImportRunResult {
  /** True when the flag is OFF — nothing was written. */
  bypassed: boolean;
  /** All batchIds created across chunks (one per chunk call). */
  batchIds: number[];
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  error: number;
  /** Any network / gateway errors that caused a whole chunk to fail. */
  chunkErrors: string[];
}

/* ── Action name helpers ─────────────────────────────────────────── */

function importAction(entity: ImportEntity): GatewayAction {
  return `${entity}.import` as GatewayAction;
}

function undoAction(entity: ImportEntity): GatewayAction {
  return `${entity}.importUndo` as GatewayAction;
}

/* ── Single chunk call ────────────────────────────────────────────── */

async function importChunk(
  entity: ImportEntity,
  rows: MappedRow[],
  filename?: string,
): Promise<{ ok: boolean; result?: ImportChunkResult; error?: string; bypassed?: boolean }> {
  const res = await callGateway(importAction(entity), entity, {
    entity,
    rows: rows as unknown as Record<string, unknown>[],
    filename: filename ?? null,
  });

  if ('bypassed' in res && res.bypassed) {
    return { ok: false, bypassed: true };
  }
  if (!res.ok) {
    return { ok: false, error: (res as { error?: string }).error ?? 'Import chunk failed' };
  }

  return {
    ok: true,
    result: {
      ok: true,
      batchId:    (res as Record<string, unknown>).batchId as number | null,
      total:      (res as Record<string, unknown>).total    as number,
      inserted:   (res as Record<string, unknown>).inserted as number,
      updated:    (res as Record<string, unknown>).updated  as number,
      skipped:    (res as Record<string, unknown>).skipped  as number,
      error:      (res as Record<string, unknown>).error    as number,
      rowResults: (res as Record<string, unknown>).rowResults as ImportRowResult[],
    },
  };
}

/* ── Main: runImportChunked ───────────────────────────────────────── */

/**
 * Split `rows` into chunks of IMPORT_CHUNK_SIZE and call the gateway for each.
 * Returns aggregated totals across all chunks.
 *
 * @param entity    - 'company' | 'contact' | 'lead'
 * @param rows      - All valid mapped rows from the import wizard
 * @param filename  - Original filename (for batch history display)
 * @param onProgress- Optional callback called after each chunk with running totals
 */
export async function runImportChunked(
  entity: ImportEntity,
  rows: MappedRow[],
  filename?: string,
  onProgress?: (done: number, total: number, running: Omit<ImportRunResult, 'bypassed' | 'batchIds' | 'chunkErrors'>) => void,
): Promise<ImportRunResult> {
  const result: ImportRunResult = {
    bypassed:    false,
    batchIds:    [],
    total:       0,
    inserted:    0,
    updated:     0,
    skipped:     0,
    error:       0,
    chunkErrors: [],
  };

  if (!isWriteGatewayEnabled()) {
    result.bypassed = true;
    return result;
  }

  const chunks: MappedRow[][] = [];
  for (let i = 0; i < rows.length; i += IMPORT_CHUNK_SIZE) {
    chunks.push(rows.slice(i, i + IMPORT_CHUNK_SIZE));
  }

  let doneRows = 0;

  for (const chunk of chunks) {
    const res = await importChunk(entity, chunk, filename);

    if (res.bypassed) {
      result.bypassed = true;
      break;
    }

    if (!res.ok || !res.result) {
      result.chunkErrors.push(res.error ?? 'Unknown chunk error');
      doneRows += chunk.length;
      result.total   += chunk.length;
      result.error   += chunk.length;
    } else {
      const r = res.result;
      if (r.batchId != null) result.batchIds.push(r.batchId);
      result.total    += r.total;
      result.inserted += r.inserted;
      result.updated  += r.updated;
      result.skipped  += r.skipped;
      result.error    += r.error;
      doneRows        += chunk.length;
    }

    onProgress?.(doneRows, rows.length, {
      total:    result.total,
      inserted: result.inserted,
      updated:  result.updated,
      skipped:  result.skipped,
      error:    result.error,
    });
  }

  return result;
}

/* ── Undo a batch ────────────────────────────────────────────────── */

export interface ImportUndoResult {
  ok: boolean;
  batchId: number;
  undone: number;
  failed: number;
  errors: string[];
  error?: string;
}

/**
 * Undo an import batch by batchId.
 * Reverses all inserted and updated rows in that batch.
 */
export async function undoImportBatch(
  entity: ImportEntity,
  batchId: number,
): Promise<ImportUndoResult> {
  const res = await callGateway(undoAction(entity), entity, { batchId });

  if ('bypassed' in res && res.bypassed) {
    return { ok: false, batchId, undone: 0, failed: 0, errors: [], error: 'Write gateway is disabled' };
  }
  if (!res.ok) {
    return { ok: false, batchId, undone: 0, failed: 0, errors: [], error: (res as { error?: string }).error ?? 'Undo failed' };
  }

  return {
    ok:     true,
    batchId: (res as Record<string, unknown>).batchId as number,
    undone:  (res as Record<string, unknown>).undone  as number,
    failed:  (res as Record<string, unknown>).failed  as number,
    errors:  (res as Record<string, unknown>).errors  as string[],
  };
}
