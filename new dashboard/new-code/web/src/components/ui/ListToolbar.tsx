/**
 * ListToolbar — ONE standardized toolbar layout for every list page (ALT-333).
 *
 * The toolbars had drifted: the view switcher / export / create / columns showed
 * up in different orders per page (Contacts even put Export before the switcher).
 * This component is the single source of truth for the layout so every module
 * looks and behaves identically. Pages pass their bits into named slots; the
 * component fixes the left→right order:
 *
 *   [ left: count + selection + Clear ]            … pushed to the far right →
 *   [ bulkActions ] [ ViewSwitcher ] [ Columns ] [ Export ] [ Create ]
 *
 * Only the order/spacing is owned here; each slot's contents stay page-specific
 * (different modules have different bulk actions, filters, etc.).
 */

import React from 'react';

interface ListToolbarProps {
  /** Left cluster — typically the result count + selection summary + Clear button. */
  left?: React.ReactNode;
  /** Page-specific bulk-action buttons (render only when rows are selected). */
  bulkActions?: React.ReactNode;
  /** The <ViewSwitcher/> (Table / Grid / Kanban). */
  viewSwitcher?: React.ReactNode;
  /** The <ColumnCustomizer/> button. */
  columns?: React.ReactNode;
  /** The <ExportButton/>. */
  exportButton?: React.ReactNode;
  /** The Create / New button (admins only — pages already gate this). */
  create?: React.ReactNode;
}

export function ListToolbar({
  left,
  bulkActions,
  viewSwitcher,
  columns,
  exportButton,
  create,
}: ListToolbarProps) {
  return (
    <div
      className="flex items-center justify-between gap-2"
      style={{ flexWrap: 'wrap', rowGap: 8 }}
    >
      <div className="flex items-center gap-2" style={{ minWidth: 0, flexWrap: 'wrap' }}>
        {left}
      </div>
      <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
        {bulkActions}
        {viewSwitcher}
        {columns}
        {exportButton}
        {create}
      </div>
    </div>
  );
}

export default ListToolbar;
