import React, { useState } from 'react';
import { StageBadge } from '../ui/Badge';
import { KanbanCard } from './KanbanCard';
import type { RealLead } from '../../data/realLeads';

/**
 * KanbanColumn — one pipeline stage: a header (stage badge + count) and the
 * scrollable stack of lead cards in that stage.
 *
 * Drag-to-change-stage is OFF by default (`dragEnabled=false`) because the board
 * is read-only today: RealLead (from fetchLeadsFallback) carries only `stage`
 * (a string) — NOT the `report_id` / numeric `stage_id` that
 * updateLeadStage(reportId, stageId, actor) requires. We do NOT guess those ids.
 *
 * TODO(ALT-292): wire drag→updateLeadStage once report_id/stage_id are available.
 *   When `dragEnabled` is true, this column is already a native HTML5 drop target:
 *   it accepts the dragged lead id (set in KanbanCard's onDragStart) and calls
 *   `onDropLead(leadId, stageId)`. To enable end-to-end:
 *     1. Extend the fetch so each card knows its lead_report.report_id and the
 *        target stage's numeric stage_id (e.g. from fetchLookups().stages).
 *     2. Pass `dragEnabled` + `stageId` (number) + an `onDropLead` that calls
 *        updateLeadStage(reportId, stageId, actor) then refreshes the board.
 */

interface KanbanColumnProps {
  stage: string;
  leads: RealLead[];
  onOpenLead: (leadId: string) => void;

  /** Enable native HTML5 drag-and-drop into/out of this column. Default false (read-only). */
  dragEnabled?: boolean;
  /** Numeric stage id for this column — required to write a stage change. */
  stageId?: number | null;
  /** Id of the card currently being dragged (so the source card dims). */
  draggingLeadId?: string | null;
  onCardDragStart?: (e: React.DragEvent<HTMLDivElement>, leadId: string) => void;
  onCardDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
  /** Called when a lead card is dropped into this column. */
  onDropLead?: (leadId: string, stageId: number | null) => void;
}

export function KanbanColumn({
  stage,
  leads,
  onOpenLead,
  dragEnabled = false,
  stageId = null,
  draggingLeadId = null,
  onCardDragStart,
  onCardDragEnd,
  onDropLead,
}: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!dragEnabled) return;
    e.preventDefault(); // required so onDrop fires
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (!dragEnabled) return;
    e.preventDefault();
    setIsDragOver(false);
    const leadId = e.dataTransfer.getData('text/plain');
    if (leadId) onDropLead?.(leadId, stageId);
  };

  return (
    <section
      aria-label={`${stage || 'Unstaged'} — ${leads.length} lead${leads.length === 1 ? '' : 's'}`}
      onDragOver={handleDragOver}
      onDragLeave={dragEnabled ? () => setIsDragOver(false) : undefined}
      onDrop={handleDrop}
      style={{
        flex: '0 0 280px',
        width: 280,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-gray-50, #FAFAFA)',
        border: isDragOver ? '1px dashed var(--color-brand)' : '1px solid var(--border-color)',
        borderRadius: 'var(--radius-card, 8px)',
        maxHeight: '100%',
        transition: 'border-color 0.12s, background 0.12s',
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
        <StageBadge stage={stage || 'Unstaged'} />
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
          }}
          aria-hidden="true"
        >
          {leads.length}
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
        {leads.length === 0 ? (
          <p
            className="text-stone-400"
            style={{ fontSize: 12, textAlign: 'center', padding: '20px 8px' }}
          >
            No leads in this stage
          </p>
        ) : (
          leads.map((lead) => (
            <KanbanCard
              key={lead.id}
              lead={lead}
              onOpen={onOpenLead}
              draggable={dragEnabled}
              dragging={draggingLeadId === lead.id}
              onDragStart={onCardDragStart}
              onDragEnd={onCardDragEnd}
            />
          ))
        )}
      </div>
    </section>
  );
}

export default KanbanColumn;
