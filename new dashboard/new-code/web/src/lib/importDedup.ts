/**
 * importDedup.ts — match-key definitions + in-file duplicate detection for the
 * Import Wizard dedup QC preview (ALT-490).
 *
 * Pure functions, no DB calls. The read-only DB query lives in
 * data/importDedup.ts.  This module is only concerned with:
 *
 *   1. The catalogue of match keys available per entity (shown in the
 *      match-key selector UI).
 *   2. Classifying the import file's rows into NEW / UPDATE / IN-FILE-DUP
 *      using (a) the set of matched existing keys returned by the DB query,
 *      and (b) the file's own rows grouped by the chosen key.
 */

import type { MappedRow } from './importValidate';

/* ── Match-key catalogue ─────────────────────────────────────────── */

export interface MatchKeyDef {
  /** Stable identifier — what's stored in wizard state. */
  key: string;
  /** Human label for the selector UI. */
  label: string;
  /**
   * The target-field key (in the mapped row) that holds the value for this
   * match key.  Must match a key from ENTITY_CATALOGS[entity].fields[].key.
   */
  fieldKey: string;
  /** Show "(recommended)" in the UI. */
  recommended?: boolean;
}

/**
 * Match-key options per entity key (pluralised keys that match ENTITY_CATALOGS).
 *
 * Rule of thumb (mirrors HubSpot / Zoho / BULK-IMPORT-EXPORT.md):
 *   - Record-ID is always the first / most reliable option.
 *   - Unique-ish business identifiers come next.
 *   - Name/company is last-resort (collision-prone).
 */
export const ENTITY_MATCH_KEYS: Record<string, MatchKeyDef[]> = {
  companies: [
    { key: 'record_id', label: 'Record ID',   fieldKey: 'record_id' },
    // fieldKeys track ENTITY_CATALOGS keys, which are now REAL DB columns (2026-07-02).
    { key: 'website',   label: 'Website / domain', fieldKey: 'company_web_url' },
    { key: 'name',      label: 'Company name', fieldKey: 'company_name',    recommended: false },
  ],
  contacts: [
    { key: 'record_id', label: 'Record ID',   fieldKey: 'record_id' },
    { key: 'email',     label: 'Email',        fieldKey: 'email',  recommended: true  },
    { key: 'phone',     label: 'Phone',        fieldKey: 'mobile_no'  },
  ],
  leads: [
    { key: 'record_id', label: 'Record ID',   fieldKey: 'record_id' },
    { key: 'email',     label: 'Email',        fieldKey: 'email',  recommended: true  },
  ],
};

/** Default match-key key (string) for an entity. */
export function defaultMatchKey(entityKey: string): string {
  const defs = ENTITY_MATCH_KEYS[entityKey];
  if (!defs || defs.length === 0) return 'record_id';
  const rec = defs.find((d) => d.recommended);
  return rec ? rec.key : defs[0].key;
}

/** Look up the MatchKeyDef for a given entity + selected key string. */
export function getMatchKeyDef(entityKey: string, matchKey: string): MatchKeyDef | undefined {
  return (ENTITY_MATCH_KEYS[entityKey] ?? []).find((d) => d.key === matchKey);
}

/* ── Normalisation helpers ──────────────────────────────────────── */

/** Lower-case + collapse whitespace — used for name / text keys. */
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

/** Digits-only phone normaliser (same as findDuplicates.normPhone). */
function normPhone(v: string): string {
  return v.replace(/\D/g, '');
}

function normValue(matchKey: string, raw: string): string {
  if (!raw) return '';
  switch (matchKey) {
    case 'website': return normDomain(raw);
    case 'phone':   return normPhone(raw);
    default:        return normText(raw);
  }
}

/* ── Row-level outcome ───────────────────────────────────────────── */

export type RowOutcome = 'new' | 'update' | 'infile_dup';

export interface DedupClassifiedRow {
  row: MappedRow;
  /** 0-based index into the validRows array. */
  rowIndex: number;
  outcome: RowOutcome;
  /** The raw match-key value extracted from this row (may be empty). */
  keyValue: string;
  /** Normalised key value used for comparison. */
  normKeyValue: string;
}

/* ── DedupResult ─────────────────────────────────────────────────── */

export interface DedupResult {
  /** Which match key was used. */
  matchKey: string;
  fieldKey: string;
  /** Rows with no match in the DB and no in-file collision → will be INSERTED. */
  newRows: DedupClassifiedRow[];
  /** Rows that match an existing DB record by the chosen key → will be UPDATED. */
  updateRows: DedupClassifiedRow[];
  /** Second-or-later occurrence of the same key within the file → SKIPPED as in-file dup. */
  inFileDupRows: DedupClassifiedRow[];
  /** Rows whose key value is empty — can't match → treated as NEW (server decides). */
  emptyKeyRows: DedupClassifiedRow[];
}

/**
 * Classify an array of valid mapped rows into new / update / in-file-dup.
 *
 * @param validRows      - The already-validated rows from importValidate.
 * @param matchKey       - The chosen match-key key string (e.g. 'email').
 * @param entityKey      - The entity (e.g. 'contacts').
 * @param existingNorms  - Normalised key values that exist in the DB (from data/importDedup).
 */
export function classifyRows(
  validRows: MappedRow[],
  matchKey: string,
  entityKey: string,
  existingNorms: Set<string>,
): DedupResult {
  const def = getMatchKeyDef(entityKey, matchKey);
  const fieldKey = def?.fieldKey ?? matchKey;

  const newRows: DedupClassifiedRow[] = [];
  const updateRows: DedupClassifiedRow[] = [];
  const inFileDupRows: DedupClassifiedRow[] = [];
  const emptyKeyRows: DedupClassifiedRow[] = [];

  // Track normalised values we've already seen in the file.
  const seenInFile = new Set<string>();

  validRows.forEach((row, rowIndex) => {
    const raw = (row[fieldKey] ?? '').trim();
    const norm = normValue(matchKey, raw);

    const classified: DedupClassifiedRow = { row, rowIndex, outcome: 'new', keyValue: raw, normKeyValue: norm };

    if (!norm) {
      // Empty key — no match possible; let server decide.
      classified.outcome = 'new';
      emptyKeyRows.push(classified);
      return;
    }

    if (seenInFile.has(norm)) {
      // Duplicate within the file.
      classified.outcome = 'infile_dup';
      inFileDupRows.push(classified);
      return;
    }

    seenInFile.add(norm);

    if (existingNorms.has(norm)) {
      classified.outcome = 'update';
      updateRows.push(classified);
    } else {
      classified.outcome = 'new';
      newRows.push(classified);
    }
  });

  return { matchKey, fieldKey, newRows, updateRows, inFileDupRows, emptyKeyRows };
}
