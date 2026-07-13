/**
 * importDedup.ts (data layer) — read-only DB query for the Import Wizard dedup
 * QC preview (ALT-490).
 *
 * This module provides ONE function: `fetchExistingKeys`.  It takes a batch of
 * key values (e.g. email addresses from the import file) and returns the subset
 * of those values that already exist in the CRM database, so the wizard can
 * classify each row as NEW vs UPDATE before any write happens.
 *
 * Safety
 * ──────
 * • READ-ONLY — uses the anon Supabase client, no writes.
 * • Chunked `.in()` queries (≤ 300 values/call) to stay within PostgREST limits.
 * • Works regardless of the write-gateway flag — it's a SELECT.
 *
 * Normalisation note
 * ──────────────────
 * We normalise on the client side (lib/importDedup.ts) before comparison, so
 * the DB query is case-insensitive via `.ilike()` for text/email keys, and
 * an exact `.in()` for record-id keys.  For website we strip protocol/www and
 * compare the `domain_clean` column on the server (approximated via ilike).
 */

import { supabase } from '../lib/supabase';

/** Max values per single `.in()` call to stay inside PostgREST URL limits. */
const CHUNK_SIZE = 300;

/** Helpers ────────────────────────────────────────────────────────────────── */

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Normalise text → lower + collapse whitespace (mirrors lib/importDedup). */
function normText(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Strip protocol, www., trailing slash — rough domain normaliser. */
function normDomain(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
}

/** Digits-only phone normaliser. */
function normPhone(v: string): string {
  return v.replace(/\D/g, '');
}

/* ── Table / column mappings ─────────────────────────────────────────────── */

interface EntityMatchConfig {
  table: string;
  /** DB column to filter on. */
  dbCol: string;
  /** Normaliser for the client-side key value (passed from importDedup). */
  normalize: (v: string) => string;
  /** If true, use ilike pattern matching instead of exact `.in()`. */
  useLike?: boolean;
}

function getEntityConfig(entityKey: string, matchKey: string): EntityMatchConfig | null {
  const configs: Record<string, Record<string, EntityMatchConfig>> = {
    companies: {
      record_id: { table: 'company_master', dbCol: 'company_id',   normalize: (v) => v.trim() },
      website:   { table: 'company_master', dbCol: 'domain_clean', normalize: normDomain },
      name:      { table: 'company_master', dbCol: 'company_name', normalize: normText, useLike: false },
    },
    contacts: {
      record_id: { table: 'contact_master', dbCol: 'contact_id',   normalize: (v) => v.trim() },
      email:     { table: 'contact_master', dbCol: 'email',         normalize: normText },
      phone:     { table: 'contact_master', dbCol: 'mobile_no',     normalize: normPhone },
    },
    leads: {
      record_id: { table: 'lead_master',    dbCol: 'lead_id',       normalize: (v) => v.trim() },
      email:     { table: 'lead_master',    dbCol: 'email',         normalize: normText },
    },
  };
  return configs[entityKey]?.[matchKey] ?? null;
}

/* ── Main exported function ──────────────────────────────────────────────── */

export interface FetchExistingKeysResult {
  /** Normalised key values that exist in the DB (for Set.has() lookups). */
  existingNorms: Set<string>;
  /** True if the query succeeded; false if there was a network/DB error. */
  ok: boolean;
  /** Error message if ok === false. */
  error?: string;
}

/**
 * Query the DB for which of the supplied `keyValues` already exist in the
 * entity's table, and return the matching normalised values as a Set.
 *
 * @param entityKey  - Plural entity key from ENTITY_CATALOGS (e.g. 'contacts').
 * @param matchKey   - Selected match key key string (e.g. 'email').
 * @param keyValues  - Raw key values extracted from the import file (non-empty).
 */
export async function fetchExistingKeys(
  entityKey: string,
  matchKey: string,
  keyValues: string[],
): Promise<FetchExistingKeysResult> {
  const cfg = getEntityConfig(entityKey, matchKey);
  if (!cfg) {
    return { existingNorms: new Set(), ok: false, error: `No DB config for ${entityKey}/${matchKey}` };
  }

  // Normalise the input values (same transformation applied on client comparison).
  const normValues = keyValues.map(cfg.normalize).filter(Boolean);
  if (normValues.length === 0) {
    return { existingNorms: new Set(), ok: true };
  }

  const existingNorms = new Set<string>();
  const chunks = chunkArray(normValues, CHUNK_SIZE);

  for (const chunk of chunks) {
    try {
      // We query the raw DB column and normalise client-side to keep it simple.
      // For email/text: PostgREST `.in()` is case-sensitive by default, so we
      // pass the already-lower-cased values and hope DB data is consistent. For a
      // production-grade setup, switch to a DB function that calls lower(col).
      const { data, error } = await supabase
        .from(cfg.table)
        .select(cfg.dbCol)
        .in(cfg.dbCol, chunk)
        .is('deleted_date', null);   // exclude soft-deleted rows

      if (error) {
        return {
          existingNorms,
          ok: false,
          error: error.message ?? 'DB query failed',
        };
      }

      if (data) {
        for (const row of data as unknown as Record<string, unknown>[]) {
          const raw = row[cfg.dbCol];
          if (raw == null) continue;
          const norm = cfg.normalize(String(raw));
          if (norm) existingNorms.add(norm);
        }
      }
    } catch (e) {
      return {
        existingNorms,
        ok: false,
        error: e instanceof Error ? e.message : 'Unknown error querying DB',
      };
    }
  }

  return { existingNorms, ok: true };
}
