import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, RefreshCw, LayoutGrid, List } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { KanbanBoard } from '../components/kanban/KanbanBoard';
import { fetchLeadsFallback, type RealLead } from '../data/realLeads';
import { useProjectScope } from '../contexts/ProjectContext';
import { useIsSalesShell } from '../contexts/SalesShellContext';

/**
 * LeadsKanbanPage (ALT-292) — pipeline/Kanban board of leads grouped by stage.
 *
 * Mirrors LeadsPage for data + scoping so the two views never disagree:
 *   - Same fetch: fetchLeadsFallback() (returns leads + the derived stage set).
 *   - Same project scope: useProjectScope() matched on the numeric lead.projectId,
 *     ignored inside the Sales Portal (the project switcher is internal-only).
 *   - Same noProjectHidden note when a project is scoped.
 *
 * Drag-to-change-stage: NOT wired. RealLead carries only `stage` (string), not the
 * lead_report.report_id / numeric stage_id that updateLeadStage(reportId, stageId,
 * actor) needs — and we do not guess those ids. The board is therefore READ-ONLY:
 * cards open the lead. The native-DnD seam is in place in KanbanColumn/KanbanCard.
 * TODO(ALT-292): wire drag→updateLeadStage once report_id/stage_id are on the data.
 */

export function LeadsKanbanPage() {
  const navigate = useNavigate();
  const isSalesShell = useIsSalesShell();
  const leadBase = isSalesShell ? '/sales/leads' : '/leads';
  const listHref = isSalesShell ? '/sales/leads' : '/leads';

  // Project scope — identical posture to LeadsPage (ignored in the sales shell).
  const { selectedProjectId } = useProjectScope();
  const projectScopeId = isSalesShell ? null : selectedProjectId;

  const [allLeads, setAllLeads] = useState<RealLead[]>([]);
  const [stages, setStages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchLeadsFallback().then((result) => {
      if (cancelled) return;
      setAllLeads(result.leads);
      setStages(result.stages);
      setLoadError(result.error);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [reloadKey]);

  // Project-scope filter — mirrors LeadsPage.filteredData (project facet only).
  const scopedLeads = useMemo(
    () =>
      allLeads.filter((lead) => {
        if (projectScopeId != null && lead.projectId !== projectScopeId) return false;
        return true;
      }),
    [allLeads, projectScopeId],
  );

  // Leads hidden ONLY because they carry no project while a project is scoped — same
  // note LeadsPage surfaces so a scoped board never looks like missing data.
  const noProjectHidden = useMemo(
    () => (projectScopeId == null ? 0 : allLeads.filter((l) => l.projectId == null).length),
    [projectScopeId, allLeads],
  );

  // Column set: prefer the canonical stage list from the fetch, but always include
  // any stage actually present on a scoped lead (so no lead is orphaned), plus an
  // "Unstaged" bucket when some scoped lead has no stage.
  const columnStages = useMemo(() => {
    const present = new Set<string>();
    let hasUnstaged = false;
    for (const l of scopedLeads) {
      if (l.stage) present.add(l.stage);
      else hasUnstaged = true;
    }
    // Canonical order first (only those with leads OR globally known), then any
    // extra present stage not in the canonical list, appended.
    const ordered: string[] = [];
    for (const s of stages) {
      if (present.has(s)) { ordered.push(s); present.delete(s); }
    }
    for (const s of [...present].sort()) ordered.push(s);
    if (hasUnstaged) ordered.push('Unstaged');
    return ordered;
  }, [scopedLeads, stages]);

  // Group scoped leads by stage ("Unstaged" for blank).
  const leadsByStage = useMemo(() => {
    const map = new Map<string, RealLead[]>();
    for (const s of columnStages) map.set(s, []);
    for (const l of scopedLeads) {
      const key = l.stage || 'Unstaged';
      const bucket = map.get(key);
      if (bucket) bucket.push(l);
    }
    return map;
  }, [scopedLeads, columnStages]);

  const toolbarBtn: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    fontWeight: 500,
    padding: '6px 12px',
    height: 34,
    borderRadius: 'var(--radius-btn)',
    border: '1px solid var(--border-input)',
    background: 'var(--color-surface)',
    color: 'var(--color-gray-700)',
    cursor: 'pointer',
  };

  return (
    <AppShell title="Leads Board">
      <div className="flex flex-col" style={{ gap: 12, height: '100%' }}>
        {/* Toolbar: count + view toggle (back to the list) */}
        <div className="flex items-center justify-between">
          <p className="text-stone-400" style={{ fontSize: 12 }}>
            {loading ? (
              <span className="flex items-center gap-1.5 text-stone-400">
                <Loader2 size={12} className="animate-spin" />
                Loading leads...
              </span>
            ) : loadError ? (
              <span className="text-red-500">{loadError}</span>
            ) : (
              <>
                <span className="font-medium text-stone-700">{scopedLeads.length}</span>{' '}
                lead{scopedLeads.length === 1 ? '' : 's'} across{' '}
                <span className="font-medium text-stone-700">{columnStages.length}</span>{' '}
                stage{columnStages.length === 1 ? '' : 's'}
                {noProjectHidden > 0 && (
                  <span
                    className="text-stone-400"
                    title="These leads have no project assigned, so they're hidden while a project is selected."
                  >
                    {' · '}{noProjectHidden} with no project hidden
                  </span>
                )}
              </>
            )}
          </p>

          <button
            type="button"
            onClick={() => navigate(listHref)}
            style={toolbarBtn}
            title="Switch to the list view"
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-gray-400)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-input)'; }}
          >
            <List size={14} />
            List view
          </button>
        </div>

        {/* Board / states */}
        {loading ? (
          <div
            role="status"
            aria-busy="true"
            aria-label="Loading board"
            className="flex items-center justify-center text-stone-400"
            style={{ flex: 1, fontSize: 13, gap: 8 }}
          >
            <Loader2 size={18} className="animate-spin" />
            Loading board…
          </div>
        ) : loadError ? (
          <div
            className="flex flex-col items-center justify-center gap-3"
            style={{ flex: 1, fontSize: 13 }}
          >
            <AlertCircle size={22} className="text-red-400" />
            <span className="text-stone-600">{loadError}</span>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="inline-flex items-center gap-1.5"
              style={{
                fontSize: 13, fontWeight: 500, color: 'var(--color-brand)',
                border: '1px solid var(--border-input)', borderRadius: 'var(--radius-btn)',
                background: 'var(--color-surface)', padding: '6px 14px', cursor: 'pointer',
              }}
            >
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        ) : columnStages.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-2 text-stone-400"
            style={{ flex: 1, fontSize: 13 }}
          >
            <LayoutGrid size={22} className="text-stone-300" />
            {allLeads.length === 0 ? 'No leads yet.' : 'No leads in the current project scope.'}
          </div>
        ) : (
          <KanbanBoard
            stages={columnStages}
            leadsByStage={leadsByStage}
            onOpenLead={(id) => navigate(`${leadBase}/${id}`)}
          />
        )}
      </div>
    </AppShell>
  );
}

export default LeadsKanbanPage;
