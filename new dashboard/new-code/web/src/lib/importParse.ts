/**
 * importParse — read a user-supplied CSV / XLSX file into a flat
 * { headers, rows } shape for the in-app Import Wizard (ALT-399).
 *
 * Parsing only. This module performs NO database writes and never touches
 * Supabase — it just turns a File into rows in the browser using the same
 * SheetJS (`xlsx`) dependency the ExportButton already ships with, so we have
 * one spreadsheet engine across import + export.
 *
 * The first sheet is used. The first non-empty row is treated as the header
 * row; every following row becomes a Record keyed by those headers (all values
 * are coerced to trimmed strings so downstream mapping/validation is uniform).
 */
import * as XLSX from 'xlsx';

/** Hard cap on how many data rows we keep in memory / preview. */
export const MAX_IMPORT_ROWS = 5000;

export interface ParsedFile {
  /** Column headers in source order (de-duplicated, never empty strings). */
  headers: string[];
  /** Up to MAX_IMPORT_ROWS data rows, each keyed by header. */
  rows: Record<string, string>[];
  /** Total data rows found in the file (may exceed rows.length when capped). */
  totalRows: number;
  /** True when the file held more rows than MAX_IMPORT_ROWS (rows were capped). */
  truncated: boolean;
}

export class ImportParseError extends Error {}

/** Coerce any SheetJS cell value to a clean trimmed string. */
function cellToString(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

/**
 * Make a header list safe + unique: blank headers become "Column N", and any
 * duplicate header gets a " (2)", " (3)"… suffix so row keys never collide.
 */
function normalizeHeaders(raw: unknown[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((h, i) => {
    let name = cellToString(h);
    if (!name) name = `Column ${i + 1}`;
    const prior = seen.get(name);
    if (prior == null) {
      seen.set(name, 1);
      return name;
    }
    const next = prior + 1;
    seen.set(name, next);
    return `${name} (${next})`;
  });
}

/**
 * Parse a CSV or XLSX File into headers + rows. Throws ImportParseError with a
 * human-readable message for the empty-file / no-rows / unreadable cases so the
 * wizard can surface them via a toast.
 */
export async function parseImportFile(file: File): Promise<ParsedFile> {
  if (!file || file.size === 0) {
    throw new ImportParseError('That file is empty — please choose a file with data.');
  }

  let workbook: XLSX.WorkBook;
  try {
    const buf = await file.arrayBuffer();
    workbook = XLSX.read(buf, { type: 'array' });
  } catch {
    throw new ImportParseError('We could not read that file. Please upload a .csv or .xlsx file.');
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new ImportParseError('That file has no sheets to import.');
  }
  const sheet = workbook.Sheets[sheetName];

  // header:1 → array-of-arrays so we control header detection ourselves.
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: '',
  });

  if (matrix.length === 0) {
    throw new ImportParseError('That file has no rows to import.');
  }

  const headers = normalizeHeaders(matrix[0]);
  const dataRows = matrix.slice(1);

  // Drop rows that are entirely blank (e.g. trailing spacer rows).
  const nonEmpty = dataRows.filter((r) => r.some((c) => cellToString(c) !== ''));

  if (nonEmpty.length === 0) {
    throw new ImportParseError('That file has headers but no data rows.');
  }

  const totalRows = nonEmpty.length;
  const truncated = totalRows > MAX_IMPORT_ROWS;
  const kept = truncated ? nonEmpty.slice(0, MAX_IMPORT_ROWS) : nonEmpty;

  const rows: Record<string, string>[] = kept.map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = cellToString(r[i]);
    });
    return obj;
  });

  return { headers, rows, totalRows, truncated };
}
