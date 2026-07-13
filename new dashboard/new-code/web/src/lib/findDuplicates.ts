/**
 * findDuplicates — surface likely duplicate records from a list the user is
 * already looking at, WITHOUT any write (merging stays gated under ALT-379).
 *
 * A data team's #1 hygiene need: "are we calling the same company twice?".
 * HubSpot/Zoho auto-surface duplicates; this brings the read-only half of that
 * here. It groups the currently-loaded rows by each signal (name / email /
 * phone / website) and returns every group with 2+ matches. Pure + synchronous
 * — it works on whatever rows are passed (the filtered set), so "clear filters"
 * scans more.
 */

export interface DuplicateSignal<Row> {
  /** Stable key for the signal (e.g. 'email'). */
  key: string;
  /** Human reason shown as the group header (e.g. 'Same email'). */
  label: string;
  /** Pull the comparable value from a row (null/'' rows are skipped). */
  get: (row: Row) => string | null | undefined;
  /** Optional normaliser; defaults to trim+lowercase+collapse-whitespace. */
  normalize?: (v: string) => string;
}

export interface DuplicateGroup<Row> {
  signal: string;
  label: string;
  /** The shared (normalised) value the rows collide on — shown to the user. */
  value: string;
  rows: Row[];
}

/** Default text normaliser: trim, lowercase, collapse internal whitespace. */
export function normText(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Phone normaliser: keep digits only (so "+91 98765 43210" == "9876543210"). */
export function normPhone(v: string): string {
  return v.replace(/\D/g, '');
}

export function findDuplicateGroups<Row>(
  rows: Row[],
  signals: DuplicateSignal<Row>[],
): DuplicateGroup<Row>[] {
  const groups: DuplicateGroup<Row>[] = [];
  for (const sig of signals) {
    const norm = sig.normalize ?? normText;
    const byValue = new Map<string, Row[]>();
    for (const row of rows) {
      const raw = sig.get(row);
      if (raw == null) continue;
      const v = norm(String(raw));
      if (!v) continue;
      const arr = byValue.get(v);
      if (arr) arr.push(row);
      else byValue.set(v, [row]);
    }
    for (const [value, matched] of byValue) {
      if (matched.length >= 2) {
        groups.push({ signal: sig.key, label: sig.label, value, rows: matched });
      }
    }
  }
  // Biggest collisions first — they're the most worth reconciling.
  groups.sort((a, b) => b.rows.length - a.rows.length);
  return groups;
}
