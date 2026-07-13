import React from 'react';
import { KanbanColumn } from './KanbanColumn';
import type { RealLead } from '../../data/realLeads';

/**
 * KanbanBoard — horizontal scroll container of stage columns.
 *
 * Presentational: it receives the ordered stage list + the leads-by-stage map and
 * renders one KanbanColumn each. Data fetching, project scoping, navigation and
 * (future) drag-write all live in the owning page (LeadsKanbanPage).
 */

interface KanbanBoardProps {
  /** Ordered stage names → one column each. */
  stages: string[];
  /** Stage name → leads in that stage (already project-scoped/filtered). */
  leadsByStage: Map<string, RealLead[]>;
  onOpenLead: (leadId: string) => void;
}

export function KanbanBoard({ stages, leadsByStage, onOpenLead }: KanbanBoardProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'stretch',
        overflowX: 'auto',
        // Fill the AppShell main area minus the toolbar; columns scroll internally.
        height: 'calc(100vh - 190px)',
        paddingBottom: 4,
      }}
    >
      {stages.map((stage) => (
        <KanbanColumn
          key={stage}
          stage={stage}
          leads={leadsByStage.get(stage) ?? []}
          onOpenLead={onOpenLead}
          // Read-only board today (see KanbanColumn TODO(ALT-292)). Leaving
          // dragEnabled off until report_id/stage_id are available on the data.
          dragEnabled={false}
        />
      ))}
    </div>
  );
}

export default KanbanBoard;
