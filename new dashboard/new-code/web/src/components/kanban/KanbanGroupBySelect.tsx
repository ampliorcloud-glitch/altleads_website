import React from 'react';

/**
 * KanbanGroupBySelect — a compact "Group by ▾" dropdown shown only in the Kanban
 * (Board) view (ALT-338). Each list page hard-grouped its board by ONE fixed
 * field (Contacts by contact_status, Leads by stage, …). This lets the user pick
 * the grouping field instead — status (default), city, industry, owner, etc.
 *
 * The page owns the options + the selected value (in-memory state); this is a
 * pure presentational control styled to match the toolbar (~32px tall, token
 * colors). Render it in the ListToolbar `left` slot or just before the board.
 */

export interface KanbanGroupOption {
  /** Stable key (also the value stored in the page's kanbanGroupBy state). */
  key: string;
  /** Human label shown in the dropdown. */
  label: string;
}

interface KanbanGroupBySelectProps {
  value: string;
  onChange: (key: string) => void;
  options: KanbanGroupOption[];
}

/* ------------------------------------------------------------------ */
/*  Group-by model + column builder (shared by every list page)         */
/* ------------------------------------------------------------------ */

/** Stable key used for the trailing "no value" lane. */
export const KANBAN_UNASSIGNED_KEY = '__unassigned';

/**
 * One groupable field for a module's board. `getGroup` returns the lane key for
 * a row (null/empty → the trailing "—" lane). If `lanes` is supplied, those are
 * the ordered columns (so a status field keeps its canonical order); otherwise
 * the lanes are derived from the distinct non-empty groups across the rows,
 * sorted alphabetically.
 */
export interface KanbanGroupDef<Row> extends KanbanGroupOption {
  getGroup: (row: Row) => string | null;
  lanes?: { key: string; label: string }[];
}

/**
 * Build the ordered `columns` + the `key → rows` map for a board from the
 * selected group definition. Centralizes the two lane modes (fixed `lanes`
 * vs. derived-from-data) so every page does it identically.
 */
export function buildKanbanGrouping<Row>(
  rows: Row[],
  group: KanbanGroupDef<Row> | undefined,
  unassignedLabel = '—',
): { columns: { key: string; label: string }[]; itemsByColumn: Map<string, Row[]> } {
  if (!group) return { columns: [], itemsByColumn: new Map() };

  const map = new Map<string, Row[]>();
  let columns: { key: string; label: string }[];

  if (group.lanes && group.lanes.length > 0) {
    // Fixed, ordered lanes (e.g. the canonical status list). Rows whose group
    // isn't one of the lanes fall into the trailing "unassigned" bucket.
    const known = new Set(group.lanes.map((l) => l.key));
    columns = [...group.lanes];
    let hasUnassigned = false;
    for (const l of columns) map.set(l.key, []);
    for (const row of rows) {
      const g = group.getGroup(row);
      const key = g && known.has(g) ? g : KANBAN_UNASSIGNED_KEY;
      if (key === KANBAN_UNASSIGNED_KEY) hasUnassigned = true;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    if (hasUnassigned) {
      columns.push({ key: KANBAN_UNASSIGNED_KEY, label: unassignedLabel });
    }
  } else {
    // Derive lanes from the distinct non-empty groups in the visible rows.
    const present = new Set<string>();
    let hasUnassigned = false;
    for (const row of rows) {
      const g = group.getGroup(row);
      if (g) present.add(g);
      else hasUnassigned = true;
    }
    columns = [...present].sort((a, b) => a.localeCompare(b)).map((g) => ({ key: g, label: g }));
    if (hasUnassigned) columns.push({ key: KANBAN_UNASSIGNED_KEY, label: unassignedLabel });
    for (const c of columns) map.set(c.key, []);
    for (const row of rows) {
      const g = group.getGroup(row);
      map.get(g && present.has(g) ? g : KANBAN_UNASSIGNED_KEY)?.push(row);
    }
  }

  return { columns, itemsByColumn: map };
}

export function KanbanGroupBySelect({ value, onChange, options }: KanbanGroupBySelectProps) {
  return (
    <label
      className="inline-flex items-center gap-1.5"
      style={{
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--color-gray-500)',
        whiteSpace: 'nowrap',
      }}
      title="Choose the field the board groups cards by"
    >
      Group by
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--color-gray-900)',
          height: 30,
          padding: '0 24px 0 8px',
          border: '1px solid var(--border-input)',
          borderRadius: 'var(--radius-input)',
          background: 'var(--color-surface)',
          cursor: 'pointer',
          outline: 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-brand)'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-input)'; }}
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export default KanbanGroupBySelect;
