import React from 'react';

/**
 * GenericKanban — a reusable, READ-ONLY board used by the list pages (Leads,
 * Companies, Contacts, Meetings, Wishlist) when the ViewSwitcher is set to
 * "kanban". It is the module-agnostic sibling of the Lead-specific KanbanBoard
 * (which LeadsKanbanPage still uses): same column/card look, but it takes a
 * generic column list + an items-by-column map + a `renderCard`/`onCardClick`
 * pair so any module can drive it.
 *
 * Read-only by design: there is no drag-to-change-status here. The standalone
 * LeadsKanbanPage keeps the disabled native-DnD seam (KanbanColumn/KanbanCard);
 * the inline list-page boards simply open the page's preview drawer on click.
 *
 * Card click === the page's row click → opens the RecordPreviewPanel via the
 * page's existing `setPreviewId(id)`.
 */

export interface KanbanColumnDef {
  /** Stable key used to bucket items + as the React key. */
  key: string;
  /** Human label rendered in the column header (chip). */
  label: string;
}

interface GenericKanbanProps<Item> {
  /** Ordered columns → one lane each. */
  columns: KanbanColumnDef[];
  /** Column key → the items in that column (already filtered/scoped). */
  itemsByColumn: Map<string, Item[]>;
  /** Stable React key for an item. */
  getKey: (item: Item) => React.Key;
  /** Render the card body (name + a few fields + a chip). */
  renderCard: (item: Item) => React.ReactNode;
  /** Click/Enter on a card → open the preview drawer (page wires setPreviewId). */
  onCardClick: (item: Item) => void;
  /** Optional accessible label for a card (defaults to "Open record"). */
  getCardLabel?: (item: Item) => string;
  /** Empty-lane message. */
  emptyColumnLabel?: string;
  /** Multi-select parity (ALT-332) — wire to the page's useRowSelection. */
  isSelected?: (item: Item) => boolean;
  onToggleSelect?: (item: Item) => void;
}

export function GenericKanban<Item>({
  columns,
  itemsByColumn,
  getKey,
  renderCard,
  onCardClick,
  getCardLabel,
  emptyColumnLabel = 'Nothing here',
  isSelected,
  onToggleSelect,
}: GenericKanbanProps<Item>) {
  const selectable = !!isSelected && !!onToggleSelect;

  // No columns (e.g. a derived group-by over zero rows) → a centered empty
  // state rather than a blank flex strip.
  if (columns.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 320,
          height: 'calc(100vh - 320px)',
          color: 'var(--color-gray-400, #9ca3af)',
          fontSize: 13,
        }}
      >
        Nothing to show.
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'stretch',
        overflowX: 'auto',
        // Fill the available area; columns scroll internally.
        minHeight: 320,
        height: 'calc(100vh - 320px)',
        paddingBottom: 4,
      }}
    >
      {columns.map((col) => {
        const items = itemsByColumn.get(col.key) ?? [];
        return (
          <section
            key={col.key}
            aria-label={`${col.label} — ${items.length} item${items.length === 1 ? '' : 's'}`}
            style={{
              flex: '0 0 280px',
              width: 280,
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--color-gray-50, #FAFAFA)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-card, 8px)',
              maxHeight: '100%',
            }}
          >
            {/* Column header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '10px 12px',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <span
                title={col.label}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--color-gray-700)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {col.label}
              </span>
              <span
                className="text-stone-500"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  background: 'var(--color-surface)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 999,
                  minWidth: 22,
                  height: 20,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 6px',
                  flexShrink: 0,
                }}
                aria-hidden="true"
              >
                {items.length}
              </span>
            </div>

            {/* Cards */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: 10,
                overflowY: 'auto',
                flex: 1,
              }}
            >
              {items.length === 0 ? (
                <p
                  className="text-stone-400"
                  style={{ fontSize: 12, textAlign: 'center', padding: '20px 8px' }}
                >
                  {emptyColumnLabel}
                </p>
              ) : (
                items.map((item) => {
                  const selected = selectable && isSelected!(item);
                  return (
                  <div
                    key={getKey(item)}
                    role="button"
                    tabIndex={0}
                    aria-label={getCardLabel ? getCardLabel(item) : 'Open record'}
                    onClick={() => onCardClick(item)}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                        e.preventDefault();
                        onCardClick(item);
                      }
                    }}
                    style={{
                      position: 'relative',
                      background: selected ? '#EFF6FF' : 'var(--color-surface)',
                      border: `1px solid ${selected ? 'var(--color-brand, #1A7EE8)' : 'var(--border-color)'}`,
                      borderRadius: 'var(--radius-card, 8px)',
                      padding: 10,
                      paddingLeft: selectable ? 30 : 10,
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(16,24,40,0.04)',
                      transition: 'border-color 0.12s, box-shadow 0.12s, background 0.12s',
                      outline: 'none',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-brand)';
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 6px rgba(16,24,40,0.08)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = selected ? 'var(--color-brand, #1A7EE8)' : 'var(--border-color)';
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 2px rgba(16,24,40,0.04)';
                    }}
                    onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-brand)'; }}
                    onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = selected ? 'var(--color-brand, #1A7EE8)' : 'var(--border-color)'; }}
                  >
                    {selectable && (
                      <input
                        type="checkbox"
                        aria-label="Select card"
                        checked={selected}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => { e.stopPropagation(); onToggleSelect!(item); }}
                        style={{ position: 'absolute', top: 10, left: 10, cursor: 'pointer', zIndex: 1 }}
                      />
                    )}
                    {renderCard(item)}
                  </div>
                  );
                })
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default GenericKanban;
