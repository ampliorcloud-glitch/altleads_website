import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type PaginationState,
} from '@tanstack/react-table';
import { motion } from 'framer-motion';
import { pageTransition, pageTransitionConfig } from '../lib/zenAnimations';
import { AppShell } from '../components/layout/AppShell';
import { StageBadge } from '../components/ui/Badge';
import { fetchLeadsFallback, type RealLead } from '../data/realLeads';
import { useAuth } from '../contexts/AuthContext';
import { useIsSalesShell } from '../contexts/SalesShellContext';
import { useProjectScope } from '../contexts/ProjectContext';
import { useRowSelection } from '../components/ui/useRowSelection';
import { useListKeyboardNav } from '../components/ui/useListKeyboardNav';
import { ExportButton } from '../components/ui/ExportButton';
import { BulkReassignModal } from '../components/common/ReassignModal';
import { reassignLeadsBulk, fetchAssignableUsers } from '../data/assignment';
import { distributeRecords } from '../data/bulkActions';
import { humanizeWriteError } from '../lib/writeError';
import type { UserOption } from '../data/wishlist';
import { useToast } from '../components/ui/Toast';
import { MultiSelectFilter } from '../components/ui/MultiSelectFilter';
import { formatDate } from '../data/meetings';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import {
  ColumnCustomizer,
  defaultColumnPrefs,
  reconcileColumns,
} from '../components/ui/ColumnCustomizer';
import { ViewSwitcher, useViewMode } from '../components/ui/ViewSwitcher';
import { DensityToggle } from '../components/ui/DensityToggle';
import { useDensity, getDensityMetrics } from '../components/ui/useDensity';
import { CardShell } from '../components/ui/CardGrid';
import { ListToolbar } from '../components/ui/ListToolbar';
import { ActiveFilters, type FilterChip } from '../components/ui/ActiveFilters';
import { EditableGrid, type EditableColumn } from '../components/ui/EditableGrid';
import { SelectAllMatchingBar } from '../components/ui/SelectAllMatchingBar';
import { useListFilters } from '../lib/listFilters';
import { ADVANCED_FILTERS, LEADS_FIELDS, EMPTY_FILTER_STATE, evalFilterState, type AdvancedFilterState } from '../lib/filterEngine';
import { FilterBuilderButton, FilterBuilderPanel } from '../components/filters/FilterBuilder';
import { ViewPicker } from '../components/filters/ViewPicker';
import type { SavedViewRecord } from '../data/savedViews';
import { useSortPersistence } from '../lib/useSortPersistence';
import { usePinPersistence } from '../lib/usePinPersistence';
import { isForeignRecord, maskContact, foreignRowStyle } from '../lib/safeView';
import { GenericKanban } from '../components/kanban/GenericKanban';
import {
  KanbanGroupBySelect,
  buildKanbanGrouping,
  type KanbanGroupDef,
} from '../components/kanban/KanbanGroupBySelect';
import { RecordPreviewPanel } from '../components/common/RecordPreviewPanel';
import { LeadPreview } from '../components/leads/LeadPreview';
import type { ColumnDef as ColDef, ExportColumn } from '../components/ui/columns';
import type { ColumnPref } from '../data/views';
import {
  Search,
  X,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  AlertCircle,
  UserCheck,
  Target,
} from 'lucide-react';

const columnHelper = createColumnHelper<RealLead>();

/* ------------------------------------------------------------------
   Company avatar — initials in a brand-tinted circle (Figma Leads list)
------------------------------------------------------------------ */

// Soft, muted tint palette (light bg + readable text) keyed deterministically
// off the company name so each company keeps a stable color.
const AVATAR_TINTS: { bg: string; text: string }[] = [
  { bg: '#E8F2FD', text: '#1A7EE8' }, // brand blue
  { bg: '#F5F3FF', text: '#7C3AED' }, // purple
  { bg: '#ECFEFF', text: '#0891B2' }, // cyan
  { bg: '#F0FDF4', text: '#16A34A' }, // green
  { bg: '#FFF7ED', text: '#EA580C' }, // orange
  { bg: 'rgba(196,77,77,0.06)', text: '#DC2626' }, // red
  { bg: '#FFFBEB', text: '#D97706' }, // amber
  { bg: '#EFF6FF', text: '#1D4ED8' }, // indigo-blue
];

function companyInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '—';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function avatarTint(name: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[hash % AVATAR_TINTS.length];
}

function CompanyAvatar({ name }: { name: string }) {
  const tint = name ? avatarTint(name) : { bg: 'var(--color-gray-100)', text: 'var(--color-gray-400)' };
  return (
    <span
      aria-hidden="true"
      style={{
        flexShrink: 0,
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: tint.bg,
        color: tint.text,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.2,
      }}
    >
      {name ? companyInitials(name) : '—'}
    </span>
  );
}

interface Filters {
  search: string;
  leadDateFrom: string;
  leadDateTo: string;
  // Multi-value facets (OR within a facet; empty array = no filter).
  agentName: string[];
  salesperson: string[];
  industry: string[];
  city: string[];
  project: string[];
  source: string[];
  meetingDateFrom: string;
  meetingDateTo: string;
  stage: string[];
}

const defaultFilters: Filters = {
  search: '',
  leadDateFrom: '',
  leadDateTo: '',
  agentName: [],
  salesperson: [],
  industry: [],
  city: [],
  project: [],
  source: [],
  meetingDateFrom: '',
  meetingDateTo: '',
  stage: [],
};

/* ------------------------------------------------------------------
   Column catalogue (all lead columns; drives ColumnCustomizer + ExportButton)
------------------------------------------------------------------ */

const ALL_COLUMNS: ColDef[] = [
  { key: 'company',          header: 'Company',        defaultVisible: true },
  { key: 'contactName',      header: 'Contact',        defaultVisible: true },
  { key: 'project',          header: 'Project',        defaultVisible: true },
  { key: 'city',             header: 'City',           defaultVisible: true },
  { key: 'agent',            header: 'Agent',          defaultVisible: true },
  { key: 'salesperson',      header: 'Salesperson',    defaultVisible: true },
  { key: 'source',           header: 'Source',         defaultVisible: true },
  { key: 'stage',            header: 'Stage',          defaultVisible: true },
  { key: 'meetingDate',      header: 'Meeting Date',   defaultVisible: true },
  { key: 'lastUpdated',      header: 'Last Updated',   defaultVisible: true },
  { key: 'leadNumber',       header: 'Lead #',         defaultVisible: false },
  { key: 'contactEmail',     header: 'Email',          defaultVisible: false },
  { key: 'contactPhone',     header: 'Phone',          defaultVisible: false },
  { key: 'industry',         header: 'Industry',       defaultVisible: false },
  { key: 'leadGeneratedDate',header: 'Lead Generated', defaultVisible: false },
];

// Export column definitions (maps keys to flat values for xlsx/csv)
const EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'leadNumber',        header: 'Lead #' },
  { key: 'company',           header: 'Company' },
  { key: 'contactName',       header: 'Contact Name' },
  { key: 'contactEmail',      header: 'Contact Email' },
  { key: 'contactPhone',      header: 'Contact Phone' },
  { key: 'industry',          header: 'Industry' },
  { key: 'city',              header: 'City' },
  { key: 'agent',             header: 'Agent' },
  { key: 'salesperson',       header: 'Salesperson' },
  { key: 'project',           header: 'Project' },
  { key: 'source',            header: 'Source' },
  { key: 'stage',             header: 'Stage' },
  { key: 'meetingDate',       header: 'Meeting Date',   accessor: (r) => r.meetingDate ?? '' },
  { key: 'leadGeneratedDate', header: 'Lead Generated' },
  { key: 'lastUpdated',       header: 'Last Updated' },
];

/* ------------------------------------------------------------------
   EditableGrid columns (the real inline "Grid" view, ALT-331).

   Mirrors the Table's data columns (same keys + order, minus the checkbox and
   any pure-action column). SAFE-EDITABLE SET for Leads: every column is
   READ-ONLY. This page has no simple inline writer:
     • stage is workflow-driven (lead_report) → render as the StageBadge.
     • Owner/Salesperson reassignment uses a people-picker (reassignLeadsBulk) via
       the bulk button + preview, not a free-text cell → read-only.
   The Company column renders the avatar+name block; dates use formatDate; all
   other cells fall back to EditableGrid's plain read-only display. Row open is
   handled by EditableGrid's ↗ button (onOpenRow → setPreviewId).
------------------------------------------------------------------ */

const EDITABLE_COLUMNS: EditableColumn<RealLead>[] = [
  {
    key: 'company',
    header: 'Company',
    getValue: (r) => r.company,
    render: (r) => {
      const name = r.company ?? '';
      const sub = r.city || r.industry || '';
      return (
        <div className="flex items-center gap-2.5">
          <CompanyAvatar name={name} />
          <div className="min-w-0">
            <p className="font-medium text-stone-900 truncate" style={{ fontSize: 13, maxWidth: 200 }} title={name || undefined}>
              {name || <span className="text-stone-400">—</span>}
            </p>
            {sub && (
              <p className="text-stone-400 truncate" style={{ fontSize: 11, maxWidth: 200 }} title={sub}>{sub}</p>
            )}
          </div>
        </div>
      );
    },
  },
  { key: 'contactName',  header: 'Contact',        getValue: (r) => r.contactName },
  { key: 'project',      header: 'Project',        getValue: (r) => r.project },
  { key: 'city',         header: 'City',           getValue: (r) => r.city },
  { key: 'agent',        header: 'Agent',          getValue: (r) => r.agent },
  { key: 'salesperson',  header: 'Salesperson',    getValue: (r) => r.salesperson },
  { key: 'source',       header: 'Source',         getValue: (r) => r.source },
  {
    key: 'stage',
    header: 'Stage',
    getValue: (r) => r.stage,
    render: (r) => <StageBadge stage={r.stage} />,
  },
  {
    key: 'meetingDate',
    header: 'Meeting Date',
    getValue: (r) => (r.meetingDate ? formatDate(r.meetingDate) : ''),
  },
  {
    key: 'lastUpdated',
    header: 'Last Updated',
    getValue: (r) => (r.lastUpdated ? formatDate(r.lastUpdated) : ''),
  },
  { key: 'leadNumber',   header: 'Lead #',         getValue: (r) => r.leadNumber },
  // SAFE_VIEW (ALT-492): getValue used for grid display — masking applied at render
  // time inside the column cell. Since EditableGrid uses getValue() as the display value
  // when no render() is provided, we supply a render() instead so masking is applied.
  // (Masking is presentational only; server-side redaction is a future RLS step.)
  { key: 'contactEmail', header: 'Email',          getValue: (r) => r.contactEmail },
  { key: 'contactPhone', header: 'Phone',          getValue: (r) => r.contactPhone },
  { key: 'industry',     header: 'Industry',       getValue: (r) => r.industry },
  {
    key: 'leadGeneratedDate',
    header: 'Lead Generated',
    getValue: (r) => (r.leadGeneratedDate ? formatDate(r.leadGeneratedDate) : ''),
  },
];

/* ------------------------------------------------------------------
   Filter sub-components
------------------------------------------------------------------ */

const inputBase: React.CSSProperties = {
  fontSize: 13,
  padding: '5px 8px',
  border: '1px solid var(--border-input)',
  borderRadius: 'var(--radius-input)',
  background: 'var(--color-surface)',
  color: 'var(--color-gray-900)',
  outline: 'none',
  height: 30,
  transition: 'border-color 0.15s, box-shadow 0.15s',
};


function DateRangeFilter({
  label,
  fromValue,
  toValue,
  onFromChange,
  onToChange,
}: {
  label: string;
  fromValue: string;
  toValue: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-medium text-stone-500" style={{ fontSize: 11 }}>{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={fromValue}
          onChange={(e) => onFromChange(e.target.value)}
          style={{ ...inputBase, width: 130 }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = '#d4d4d8'; }}
        />
        <span className="text-stone-400" style={{ fontSize: 11 }}>to</span>
        <input
          type="date"
          value={toValue}
          onChange={(e) => onToChange(e.target.value)}
          style={{ ...inputBase, width: 130 }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = '#d4d4d8'; }}
        />
      </div>
    </div>
  );
}

const PAGE_SIZE_OPTIONS = [25, 50, 100];

/* ------------------------------------------------------------------
   Main page
------------------------------------------------------------------ */

export function LeadsPage() {
  const navigate = useNavigate();
  const { profile, canCreateData, canReassign, isAdmin, isTeamLead, isQC } = useAuth();
  const userId = profile?.user_id ?? null;
  // SAFE_VIEW: admin / TL / QC always see everything; agents + salespeople get the safe view.
  const safeViewExempt = isAdmin || isTeamLead || isQC;
  const toast = useToast();
  // When reused inside the Sales Portal, keep navigation within /sales/*.
  const isSalesShell = useIsSalesShell();
  const leadBase = isSalesShell ? '/sales/leads' : '/leads';

  // Global project scope (owner ask #8). When a project is selected (not "All"),
  // the list additionally pre-filters to that project. We match on the NUMERIC
  // lead.projectId (lead_master.project_id) — the same stable id useProjectScope
  // returns — NOT the display name, so duplicate/blank project names and any drift
  // between the two `project` queries can never hide or mismatch records.
  // selectedProjectId === null = "All projects" → no project filter (unchanged).
  //
  // IGNORED in the Sales Portal (isSalesShell): the project switcher is an internal
  // control that sales users can't see (it's hidden for non-internal roles), so
  // applying its scope there would silently narrow their leads with no way to clear
  // it (review ALT-273B M2). The sales portal scopes by assignment, not by project.
  const { selectedProjectId } = useProjectScope();
  const projectScopeId = isSalesShell ? null : selectedProjectId;

  // Persisted across refresh per browser (ALT-369).
  const [filters, setFilters] = useListFilters<Filters>('leads', defaultFilters);
  // Advanced filter state (ALT-270) — only used when ADVANCED_FILTERS is on.
  const [advFilters, setAdvFilters] = useState<AdvancedFilterState>(EMPTY_FILTER_STATE);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [activeViewId, setActiveViewId] = useState<number | null>(null);
  // Persisted sort state (ALT-440) — mirrors density key convention: altleads:sort:<entity>:<userId>.
  const [sorting, setSorting] = useSortPersistence('leads', userId);
  // Persisted column pinning (ALT-440) — key: altleads:pin:leads:<userId>.
  const [columnPinning, setColumnPinning] = usePinPersistence('leads', userId);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 });

  // Column visibility / order state (seeded from catalogue defaults)
  const [columnPrefs, setColumnPrefs] = useState<ColumnPref[]>(() =>
    defaultColumnPrefs(ALL_COLUMNS),
  );

  // Row multi-selection
  const sel = useRowSelection<string>();
  const searchRef = useRef<HTMLInputElement>(null);

  // Row-click preview slide-over (ALT-327/328). Opening the panel replaces the
  // old navigate-away behaviour; the full detail page stays reachable via the
  // panel's "Open full record →" action (respecting the Sales-shell base).
  const [previewId, setPreviewId] = useState<string | null>(null);

  // Table / Grid view (persisted per user + entity in localStorage).
  const [view, setView] = useViewMode('leads', userId);

  // Row density (Comfortable / Compact) — persisted per user + entity. Applies to
  // the TABLE view only; comfortable keeps today's 44px rows exactly (ALT density win).
  const [density, setDensity] = useDensity('leads', userId);
  const densityMetrics = getDensityMetrics(density);

  const [allLeads, setAllLeads] = useState<RealLead[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [agents, setAgents] = useState<string[]>([]);
  const [salespeople, setSalespeople] = useState<string[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [stages, setStages] = useState<string[]>([]);
  // Kanban "Group by" field (ALT-338) — default = stage (the original fixed field).
  const [kanbanGroupBy, setKanbanGroupBy] = useState<string>('stage');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Bump to re-run the load effect (Retry on error). ALT-215 #12.
  const [reloadKey, setReloadKey] = useState(0);

  // Bulk reassign (ALT-291)
  const [showReassign, setShowReassign] = useState(false);
  const [reassignSaving, setReassignSaving] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [reassignOwners, setReassignOwners] = useState<UserOption[]>([]);

  // Shared bulk progress + cancel (ALT-413) — live "N of M" bar in the reassign modal.
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const bulkAbort = useRef<AbortController | null>(null);

  const openBulkReassign = async () => {
    setReassignError(null);
    setReassignOwners([]);
    setShowReassign(true);
    setReassignOwners(await fetchAssignableUsers(null));
  };
  const handleBulkReassign = async (ownerIds: number[], maxPerCompany?: number) => {
    const selectedLeads = allLeads.filter((l) => sel.selectedIds.has(l.id));
    const records = selectedLeads.map((l) => ({ id: Number(l.id), companyKey: l.company || null }));
    const actor = profile?.user_id != null ? String(profile.user_id) : '';
    setReassignSaving(true);
    setReassignError(null);
    const ac = new AbortController();
    bulkAbort.current = ac;

    // Distribute across owners (round-robin + optional per-company cap).
    const slices = distributeRecords(records, ownerIds, { maxPerCompany });
    const totalCount = records.length;
    setBulkProgress({ done: 0, total: totalCount });

    let totalOk = 0;
    let totalFailed = 0;
    let firstErr: string | null = null;
    let done = 0;

    try {
      for (const [ownerId, leadIds] of slices) {
        if (ac.signal.aborted) break;
        if (leadIds.length === 0) continue;
        const res = await reassignLeadsBulk(leadIds, ownerId, actor, {
          signal: ac.signal,
          onProgress: (ownerDone) => {
            done = done + ownerDone - (done - totalOk - totalFailed);
            setBulkProgress({ done: totalOk + totalFailed + ownerDone, total: totalCount });
          },
        });
        totalOk += res.ok;
        totalFailed += res.failed;
        if (!firstErr && res.error) firstErr = res.error;
        done = totalOk + totalFailed;
        setBulkProgress({ done, total: totalCount });
      }
    } finally {
      setReassignSaving(false);
      setBulkProgress(null);
      bulkAbort.current = null;
    }
    if (totalOk === 0 && (firstErr || totalFailed > 0)) {
      setReassignError(humanizeWriteError(firstErr ?? `${totalFailed} could not be reassigned.`));
      return;
    }
    setShowReassign(false);
    sel.clear();
    setReloadKey((k) => k + 1);
    toast.success(
      totalFailed > 0
        ? `Reassigned ${totalOk}; ${totalFailed} skipped (no permission or no report row).`
        : `Reassigned ${totalOk} lead${totalOk === 1 ? '' : 's'} — the new owner(s) were notified.`,
    );
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchLeadsFallback().then((result) => {
      if (cancelled) return;
      setAllLeads(result.leads);
      setIndustries(result.industries);
      setCities(result.cities);
      setAgents(result.agents);
      setSalespeople(result.salespeople);
      setProjects(result.projects);
      setSources(result.sources);
      setStages(result.stages);
      setLoadError(result.error);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    // Any filter change resets to the first page.
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    // Clear selection so a bulk action can't act on rows filtered out of view
    // (mirrors ContactsPage / CompaniesPage setFilter).
    sel.clear();
  };

  const hasActiveFilters = Object.values(filters).some((v) =>
    Array.isArray(v) ? v.length > 0 : v !== '',
  );

  // Active-filter chip bar (ALT). One chip per selected facet value + one chip
  // per date range; free-text search is excluded (it has its own clear box).
  const filterChips = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    const facets: { field: keyof Filters; label: string }[] = [
      { field: 'agentName', label: 'Agent' },
      { field: 'salesperson', label: 'Salesperson' },
      { field: 'industry', label: 'Industry' },
      { field: 'city', label: 'City' },
      { field: 'project', label: 'Project' },
      { field: 'source', label: 'Source' },
      { field: 'stage', label: 'Stage' },
    ];
    for (const { field, label } of facets) {
      const values = filters[field] as string[];
      for (const value of values) {
        chips.push({
          key: `${field}:${value}`,
          label: `${label}: ${value}`,
          onRemove: () =>
            setFilter(
              field,
              (filters[field] as string[]).filter((x) => x !== value),
            ),
        });
      }
    }
    if (filters.leadDateFrom || filters.leadDateTo) {
      chips.push({
        key: 'leadDate',
        label: `Lead date: ${filters.leadDateFrom || '…'} – ${filters.leadDateTo || '…'}`,
        onRemove: () => {
          setFilter('leadDateFrom', '');
          setFilter('leadDateTo', '');
        },
      });
    }
    if (filters.meetingDateFrom || filters.meetingDateTo) {
      chips.push({
        key: 'meetingDate',
        label: `Meeting date: ${filters.meetingDateFrom || '…'} – ${filters.meetingDateTo || '…'}`,
        onRemove: () => {
          setFilter('meetingDateFrom', '');
          setFilter('meetingDateTo', '');
        },
      });
    }
    return chips;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const filteredData = useMemo(() => {
    return allLeads.filter((lead) => {
      // Global project scope (AND with every page filter). null = "All projects"
      // → no project filter. Otherwise match the lead's numeric project id.
      if (projectScopeId != null && lead.projectId !== projectScopeId) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const searchable = [
          lead.company, lead.contactName, lead.contactEmail, lead.contactPhone,
          lead.leadNumber, lead.industry, lead.city, lead.agent, lead.salesperson,
          lead.project, lead.source, lead.stage,
        ].join(' ').toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      if (filters.leadDateFrom && lead.leadGeneratedDate < filters.leadDateFrom) return false;
      if (filters.leadDateTo && lead.leadGeneratedDate > filters.leadDateTo) return false;
      // Multi-value facets: empty array = no filter; otherwise the row must match any selected value.
      if (filters.agentName.length && !filters.agentName.includes(lead.agent)) return false;
      if (filters.salesperson.length && !filters.salesperson.includes(lead.salesperson)) return false;
      if (filters.industry.length && !filters.industry.includes(lead.industry)) return false;
      if (filters.city.length && !filters.city.includes(lead.city)) return false;
      if (filters.project.length && !filters.project.includes(lead.project)) return false;
      if (filters.source.length && !filters.source.includes(lead.source)) return false;
      if (filters.meetingDateFrom) {
        if (!lead.meetingDate || lead.meetingDate < filters.meetingDateFrom) return false;
      }
      if (filters.meetingDateTo) {
        if (!lead.meetingDate || lead.meetingDate > filters.meetingDateTo) return false;
      }
      if (filters.stage.length && !filters.stage.includes(lead.stage)) return false;
      // Advanced filter evaluation (ALT-270)
      if (ADVANCED_FILTERS && advFilters.groups.length > 0) {
        if (!evalFilterState(lead as unknown as Record<string, unknown>, advFilters)) return false;
      }
      return true;
    });
  }, [filters, advFilters, allLeads, projectScopeId]);

  // How many leads are hidden ONLY because they carry no project_id while a project
  // is scoped — surfaced as a small note so a project filter never looks like missing
  // data (review ALT-273B: NULL project_id rows silently hidden).
  const noProjectHidden = useMemo(
    () => (projectScopeId == null ? 0 : allLeads.filter((l) => l.projectId == null).length),
    [projectScopeId, allLeads],
  );

  // Kanban (Board) view — selectable "Group by" field (ALT-338). Default = stage
  // (the original fixed grouping): its lanes reuse the canonical stage order, so
  // the board looks identical to before. City / Industry / Salesperson derive
  // their lanes from the distinct values present. (Disposition grouping needs
  // latest-call data not carried on the lead row → skipped for now.)
  const kanbanGroupOptions = useMemo<KanbanGroupDef<RealLead>[]>(() => [
    {
      key: 'stage',
      label: 'Stage',
      getGroup: (l) => l.stage || null,
      // Canonical stage order, but only the stages actually present (matches the
      // old board which dropped empty stage lanes).
      lanes: stages
        .filter((s) => filteredData.some((l) => l.stage === s))
        .map((s) => ({ key: s, label: s })),
    },
    { key: 'city', label: 'City', getGroup: (l) => l.city || null },
    { key: 'industry', label: 'Industry', getGroup: (l) => l.industry || null },
    { key: 'salesperson', label: 'Salesperson', getGroup: (l) => l.salesperson || null },
  ], [stages, filteredData]);

  const { columns: kanbanColumns, itemsByColumn: leadsByGroup } = useMemo(() => {
    const group = kanbanGroupOptions.find((o) => o.key === kanbanGroupBy) ?? kanbanGroupOptions[0];
    return buildKanbanGrouping<RealLead>(filteredData, group, 'Unset');
  }, [filteredData, kanbanGroupOptions, kanbanGroupBy]);

  // Keep the kanban "Group by" selection valid: if the selected field is no longer
  // in the current options, reset to the first option so the <select> value can't
  // desync from the rendered board (mirrors Contacts/Companies).
  useEffect(() => {
    if (!kanbanGroupOptions.some((o) => o.key === kanbanGroupBy)) {
      setKanbanGroupBy(kanbanGroupOptions[0].key);
    }
  }, [kanbanGroupOptions, kanbanGroupBy]);

  // Clamp pageIndex into [0, pageCount-1] when the filtered set / project scope
  // shrinks, so the user can't land on an empty page while records exist earlier
  // (mirrors ContactsPage's safePage clamp). Recomputes from filteredData length
  // so it doesn't depend on the table's own pagination row model timing.
  useEffect(() => {
    const pageCount = Math.max(1, Math.ceil(filteredData.length / pagination.pageSize));
    if (pagination.pageIndex > pageCount - 1) {
      setPagination((p) => ({ ...p, pageIndex: pageCount - 1 }));
    }
  }, [filteredData.length, pagination.pageIndex, pagination.pageSize]);

  // Derive the ordered, visibility-filtered set of column keys from prefs.
  const visibleKeys = useMemo(
    () => columnPrefs.filter((p) => p.visible).map((p) => p.key),
    [columnPrefs],
  );

  // Build TanStack columns dynamically from visible prefs.
  const columns = useMemo(() => {
    // Checkbox column (always first, not in column catalogue)
    const checkboxCol = columnHelper.display({
      id: '__select',
      header: ({ table: t }) => {
        const pageIds = t.getRowModel().rows.map((r) => r.original.id);
        const allChecked = pageIds.length > 0 && sel.allSelected(pageIds);
        return (
          <input
            type="checkbox"
            checked={allChecked}
            onChange={() => sel.toggleAll(pageIds)}
            onClick={(e) => e.stopPropagation()}
            title={allChecked ? 'Deselect all on page' : 'Select all on page'}
            aria-label={allChecked ? 'Deselect all leads on this page' : 'Select all leads on this page'}
            style={{ cursor: 'pointer', accentColor: 'var(--color-brand)' }}
          />
        );
      },
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={sel.isSelected(row.original.id)}
          onChange={() => sel.toggle(row.original.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${row.original.company || row.original.contactName || 'lead'}`}
          style={{ cursor: 'pointer', accentColor: 'var(--color-brand)' }}
        />
      ),
      size: 40,
    });

    // Data columns — map each visible key to its TanStack column definition.
    const dataCols = visibleKeys
      .map((key) => {
        switch (key) {
          case 'company':
            return columnHelper.accessor('company', {
              id: 'company',
              header: 'Company',
              cell: (info) => {
                const name = info.getValue() ?? '';
                const sub = info.row.original.city || info.row.original.industry || '';
                return (
                  <div className="flex items-center gap-2.5">
                    <CompanyAvatar name={name} />
                    <div className="min-w-0">
                      <p className="font-medium text-stone-900 truncate" style={{ fontSize: 13, maxWidth: 200 }} title={name || undefined}>
                        {name || <span className="text-stone-400">—</span>}
                      </p>
                      {sub && (
                        <p className="text-stone-400 truncate" style={{ fontSize: 11, maxWidth: 200 }} title={sub}>{sub}</p>
                      )}
                    </div>
                  </div>
                );
              },
            });
          case 'contactName':
            return columnHelper.accessor('contactName', {
              id: 'contactName',
              header: 'Contact',
              cell: (info) => (
                <div>
                  <p className="text-stone-800" style={{ fontSize: 13 }}>{info.getValue() || '—'}</p>
                  <p className="text-stone-400" style={{ fontSize: 11 }}>{info.row.original.contactPhone || ''}</p>
                </div>
              ),
            });
          case 'project':
            return columnHelper.accessor('project', {
              id: 'project',
              header: 'Project',
              cell: (info) => (
                <span className="text-stone-600" style={{ fontSize: 13 }}>
                  {info.getValue() || <span className="text-stone-300">—</span>}
                </span>
              ),
            });
          case 'city':
            return columnHelper.accessor('city', {
              id: 'city',
              header: 'City',
              cell: (info) => (
                <span className="text-stone-600" style={{ fontSize: 13 }}>
                  {info.getValue() || <span className="text-stone-300">—</span>}
                </span>
              ),
            });
          case 'agent':
            return columnHelper.accessor('agent', {
              id: 'agent',
              header: 'Agent',
              cell: (info) => (
                <span className="text-stone-700" style={{ fontSize: 13 }}>
                  {info.getValue() || <span className="text-stone-300">—</span>}
                </span>
              ),
            });
          case 'salesperson':
            return columnHelper.accessor('salesperson', {
              id: 'salesperson',
              header: 'Salesperson',
              cell: (info) => (
                <span className="text-stone-700" style={{ fontSize: 13 }}>
                  {info.getValue() || <span className="text-stone-300">—</span>}
                </span>
              ),
            });
          case 'source':
            return columnHelper.accessor('source', {
              id: 'source',
              header: 'Source',
              cell: (info) => (
                <span className="text-stone-600" style={{ fontSize: 13 }}>
                  {info.getValue() || <span className="text-stone-300">—</span>}
                </span>
              ),
            });
          case 'stage':
            return columnHelper.accessor('stage', {
              id: 'stage',
              header: 'Stage',
              cell: (info) => <StageBadge stage={info.getValue()} />,
            });
          case 'meetingDate':
            return columnHelper.accessor('meetingDate', {
              id: 'meetingDate',
              header: 'Meeting Date',
              // ALT-437: sort chronologically; nulls/empty last regardless of direction.
              sortingFn: (rowA, rowB) => {
                const a = rowA.original.meetingDate;
                const b = rowB.original.meetingDate;
                if (!a && !b) return 0;
                if (!a) return 1;
                if (!b) return -1;
                return Date.parse(a) - Date.parse(b);
              },
              cell: (info) => (
                <span className="text-stone-500" style={{ fontSize: 13 }}>{info.getValue() ? formatDate(info.getValue()) : <span className="text-stone-300">—</span>}</span>
              ),
            });
          case 'lastUpdated':
            return columnHelper.accessor('lastUpdated', {
              id: 'lastUpdated',
              header: 'Last Updated',
              // ALT-437: sort chronologically; nulls/empty last regardless of direction.
              sortingFn: (rowA, rowB) => {
                const a = rowA.original.lastUpdated;
                const b = rowB.original.lastUpdated;
                if (!a && !b) return 0;
                if (!a) return 1;
                if (!b) return -1;
                return Date.parse(a) - Date.parse(b);
              },
              cell: (info) => (
                <span className="text-stone-400" style={{ fontSize: 13 }}>{info.getValue() ? formatDate(info.getValue()) : <span className="text-stone-300">—</span>}</span>
              ),
            });
          case 'leadNumber':
            return columnHelper.accessor('leadNumber', {
              id: 'leadNumber',
              header: 'Lead #',
              cell: (info) => (
                <span className="text-stone-500 font-mono" style={{ fontSize: 12 }}>{info.getValue() || '—'}</span>
              ),
            });
          case 'contactEmail':
            return columnHelper.accessor('contactEmail', {
              id: 'contactEmail',
              header: 'Email',
              cell: (info) => {
                // SAFE_VIEW (ALT-492): mask email for non-owned records when flag is on.
                // Presentational only — true server-side field redaction is a future RLS step.
                const row = info.row.original;
                const foreign = isForeignRecord(row.salespersonUserId, userId, safeViewExempt);
                const display = foreign
                  ? maskContact(info.getValue(), 'email')
                  : (info.getValue() || '—');
                return (
                  <span className="text-stone-600" style={{ fontSize: 13 }}>{display || '—'}</span>
                );
              },
            });
          case 'contactPhone':
            return columnHelper.accessor('contactPhone', {
              id: 'contactPhone',
              header: 'Phone',
              cell: (info) => {
                // SAFE_VIEW (ALT-492): mask phone for non-owned records when flag is on.
                // Presentational only — true server-side field redaction is a future RLS step.
                const row = info.row.original;
                const foreign = isForeignRecord(row.salespersonUserId, userId, safeViewExempt);
                const display = foreign
                  ? maskContact(info.getValue(), 'phone')
                  : (info.getValue() || '—');
                return (
                  <span className="text-stone-600" style={{ fontSize: 13 }}>{display || '—'}</span>
                );
              },
            });
          case 'industry':
            return columnHelper.accessor('industry', {
              id: 'industry',
              header: 'Industry',
              cell: (info) => (
                <span className="text-stone-600" style={{ fontSize: 13 }}>{info.getValue() || '—'}</span>
              ),
            });
          case 'leadGeneratedDate':
            return columnHelper.accessor('leadGeneratedDate', {
              id: 'leadGeneratedDate',
              header: 'Lead Generated',
              // ALT-437: sort chronologically; nulls/empty last regardless of direction.
              sortingFn: (rowA, rowB) => {
                const a = rowA.original.leadGeneratedDate;
                const b = rowB.original.leadGeneratedDate;
                if (!a && !b) return 0;
                if (!a) return 1;
                if (!b) return -1;
                return Date.parse(a) - Date.parse(b);
              },
              cell: (info) => (
                <span className="text-stone-500" style={{ fontSize: 13 }}>{info.getValue() ? formatDate(info.getValue()) : <span className="text-stone-300">—</span>}</span>
              ),
            });
          default:
            return null;
        }
      })
      .filter((c): c is NonNullable<typeof c> => c != null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return [checkboxCol, ...dataCols] as any[];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKeys, sel.selectedIds, userId, safeViewExempt]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, pagination, columnPinning },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onColumnPinningChange: setColumnPinning,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  // Pagination display values.
  const totalRows = filteredData.length;
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const firstRow = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const lastRow = Math.min((pageIndex + 1) * pageSize, totalRows);

  // Export columns limited to visible ones (in display order)
  const exportColumns = useMemo<ExportColumn[]>(() => {
    const exportMap = new Map(EXPORT_COLUMNS.map((c) => [c.key, c]));
    return visibleKeys
      .map((k) => exportMap.get(k))
      .filter((c): c is ExportColumn => c != null);
  }, [visibleKeys]);

  // Grid (EditableGrid) columns — same visible keys + display order as the Table.
  // SAFE_VIEW (ALT-492): email + phone columns get a masking render() when the flag is on.
  // (Presentational only; server-side field redaction is a future RLS step.)
  const gridColumns = useMemo<EditableColumn<RealLead>[]>(() => {
    const colMap = new Map(EDITABLE_COLUMNS.map((c) => [c.key, c]));
    return visibleKeys
      .map((k) => {
        const col = colMap.get(k);
        if (!col) return undefined;
        if (k === 'contactEmail') {
          return {
            ...col,
            render: (r: RealLead) => {
              const foreign = isForeignRecord(r.salespersonUserId, userId, safeViewExempt);
              const val = foreign ? maskContact(r.contactEmail, 'email') : (r.contactEmail || '');
              return <span>{val || '—'}</span>;
            },
          };
        }
        if (k === 'contactPhone') {
          return {
            ...col,
            render: (r: RealLead) => {
              const foreign = isForeignRecord(r.salespersonUserId, userId, safeViewExempt);
              const val = foreign ? maskContact(r.contactPhone, 'phone') : (r.contactPhone || '');
              return <span>{val || '—'}</span>;
            },
          };
        }
        return col;
      })
      .filter((c): c is EditableColumn<RealLead> => c != null);
  }, [visibleKeys, userId, safeViewExempt]);

  // The leads visible on the current page (drives the Grid's select-all state).
  const gridRows = useMemo(
    () => table.getRowModel().rows.map((r) => r.original),
    [table, filteredData, pagination, sorting],
  );

  // Keyboard-first row navigation (j/k move · Enter open · x select · / search · Esc clear).
  // Paused while a preview is open so j/k don't move the list under the panel.
  const keyNav = useListKeyboardNav({
    rows: gridRows,
    getId: (r) => r.id,
    onOpen: (r) => setPreviewId(r.id),
    onToggleSelect: (r) => sel.toggle(r.id),
    searchInputRef: searchRef,
    enabled: previewId == null,
  });
  const gridSelectAllState: 'all' | 'some' | 'none' = useMemo(() => {
    if (gridRows.length === 0) return 'none';
    const selectedOnPage = gridRows.filter((r) => sel.isSelected(r.id)).length;
    if (selectedOnPage === 0) return 'none';
    return selectedOnPage === gridRows.length ? 'all' : 'some';
  }, [gridRows, sel]);

  // "Select all N matching" (ALT-368) — every matching row is already in memory
  // (client-side pagination), so selecting them all is just sel.addAll(allIds).
  // The bar shows only once the whole current page/view is selected.
  const allMatchingIds = useMemo(() => filteredData.map((r) => r.id), [filteredData]);
  const pageRowIds = useMemo(
    () => (view === 'kanban' ? allMatchingIds : gridRows.map((r) => r.id)),
    [view, allMatchingIds, gridRows],
  );
  const pageSelectedCount = useMemo(
    () => pageRowIds.filter((id) => sel.isSelected(id)).length,
    [pageRowIds, sel],
  );

  return (
    <AppShell title="Leads">
      <motion.div
        variants={pageTransition}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransitionConfig}
        className="space-y-3"
      >
        {/* Filter panel */}
        <div className="rounded-lg p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--border-color)' }}>
          <div className="flex flex-wrap gap-4 items-end">
            {/* Search */}
            <div className="flex flex-col gap-1">
              <label className="font-medium text-stone-500" style={{ fontSize: 11 }}>Search</label>
              <div className="relative flex items-center">
                <Search
                  size={13}
                  className="absolute text-stone-400 pointer-events-none"
                  style={{ left: 8 }}
                />
                <input
                  ref={searchRef}
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilter('search', e.target.value)}
                  placeholder="Company, contact, lead #..."
                  style={{ ...inputBase, paddingLeft: 26, paddingRight: filters.search ? 26 : 10, width: 210 }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#d4d4d8'; }}
                />
                {filters.search && (
                  <button
                    type="button"
                    onClick={() => setFilter('search', '')}
                    aria-label="Clear search"
                    title="Clear search"
                    className="absolute text-stone-400 hover:text-stone-700"
                    style={{ right: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 2 }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            <DateRangeFilter
              label="Lead Generated"
              fromValue={filters.leadDateFrom}
              toValue={filters.leadDateTo}
              onFromChange={(v) => setFilter('leadDateFrom', v)}
              onToChange={(v) => setFilter('leadDateTo', v)}
            />

            <DateRangeFilter
              label="Meeting Date"
              fromValue={filters.meetingDateFrom}
              toValue={filters.meetingDateTo}
              onFromChange={(v) => setFilter('meetingDateFrom', v)}
              onToChange={(v) => setFilter('meetingDateTo', v)}
            />

            <MultiSelectFilter
              label="Agent"
              selected={filters.agentName}
              onChange={(v) => setFilter('agentName', v)}
              options={agents}
            />
            <MultiSelectFilter
              label="Salesperson"
              selected={filters.salesperson}
              onChange={(v) => setFilter('salesperson', v)}
              options={salespeople}
            />
            <MultiSelectFilter
              label="Project"
              selected={filters.project}
              onChange={(v) => setFilter('project', v)}
              options={projects}
            />
            <MultiSelectFilter
              label="City"
              selected={filters.city}
              onChange={(v) => setFilter('city', v)}
              options={cities}
            />
            <MultiSelectFilter
              label="Source"
              selected={filters.source}
              onChange={(v) => setFilter('source', v)}
              options={sources}
            />
            <MultiSelectFilter
              label="Industry"
              selected={filters.industry}
              onChange={(v) => setFilter('industry', v)}
              options={industries}
            />
            <MultiSelectFilter
              label="Stage"
              selected={filters.stage}
              onChange={(v) => setFilter('stage', v)}
              options={stages}
            />
          </div>
        </div>

        {/* Toolbar row: count + actions (standardized via ListToolbar, ALT-333) */}
        <ListToolbar
          left={
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
                  <span className="font-medium text-stone-700">{filteredData.length}</span> of{' '}
                  <span className="font-medium text-stone-700">{allLeads.length}</span> leads
                  {noProjectHidden > 0 && (
                    <span className="text-stone-400" title="These leads have no project assigned, so they're hidden while a project is selected.">
                      {' · '}{noProjectHidden} with no project hidden
                    </span>
                  )}
                  {sel.count > 0 && (
                    <>
                      {' ·'}{' '}
                      <span className="font-medium text-stone-700">{sel.count}</span> selected
                      <button
                        onClick={() => sel.clear()}
                        className="ml-2 text-stone-400 hover:text-stone-700 transition-colors"
                        style={{ fontSize: 12 }}
                      >
                        Clear
                      </button>
                    </>
                  )}
                  {hasActiveFilters && (
                    <button
                      onClick={() => { setFilters(defaultFilters); setPagination((p) => ({ ...p, pageIndex: 0 })); sel.clear(); }}
                      className="ml-3 text-stone-400 hover:text-stone-700 transition-colors"
                      style={{ fontSize: 12 }}
                    >
                      Clear filters
                    </button>
                  )}
                </>
              )}
            </p>
          }
          bulkActions={
            /* Bulk reassign selected leads (ALT-291) */
            canReassign && sel.count > 0 ? (
              <button
                onClick={openBulkReassign}
                className="inline-flex items-center gap-1.5 border border-stone-300 hover:border-stone-400 bg-white hover:bg-stone-50 text-stone-700 font-medium rounded-md transition-colors"
                style={{ fontSize: 13, padding: '6px 12px', height: 34 }}
                title="Reassign the selected leads to a salesperson"
              >
                <UserCheck size={14} />
                Reassign ({sel.count})
              </button>
            ) : null
          }
          viewSwitcher={
            <div className="inline-flex items-center" style={{ gap: 6 }}>
              {/* Advanced filter button (ALT-270) — only when flag is on. */}
              {ADVANCED_FILTERS && (
                <FilterBuilderButton
                  open={filterPanelOpen}
                  onToggle={() => setFilterPanelOpen((v) => !v)}
                  conditionCount={advFilters.groups[0]?.conditions.length ?? 0}
                />
              )}
              {ADVANCED_FILTERS && (
                <ViewPicker
                  entity="leads"
                  userId={profile?.user_id ?? null}
                  projectId={projectScopeId}
                  currentState={{ filter_state: advFilters }}
                  activeViewId={activeViewId}
                  onApply={(v: SavedViewRecord) => {
                    if (v.filter_state) setAdvFilters(v.filter_state);
                    setActiveViewId(v.id);
                  }}
                />
              )}
              {/* Density toggle only affects the Table view's row height. */}
              {view === 'table' && <DensityToggle value={density} onChange={setDensity} />}
              <ViewSwitcher value={view} onChange={setView} />
            </div>
          }
          columns={
            <ColumnCustomizer
              entity="leads"
              userId={userId}
              allColumns={ALL_COLUMNS}
              value={columnPrefs}
              onChange={(next) => setColumnPrefs(reconcileColumns(next, ALL_COLUMNS))}
              columnPinning={columnPinning}
              onColumnPinningChange={setColumnPinning}
            />
          }
          exportButton={
            <ExportButton
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              rows={filteredData as any[]}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              columns={exportColumns as any[]}
              filename="amplior-crm-leads"
              selectedIds={sel.selectedIds}
              idKey="id"
              idHeader="Lead ID"
              disabled={loading || filteredData.length === 0}
            />
          }
          create={
            /* Create is admin-only by default (ADR-21); hidden from outreach roles. */
            canCreateData ? (
              <button
                onClick={() => navigate('/leads/new')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'var(--color-brand)',
                  color: '#fff',
                  fontWeight: 500,
                  borderRadius: 'var(--radius-btn)',
                  border: 'none',
                  fontSize: 12,
                  padding: '5px 12px',
                  height: 30,
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-brand-dark)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-brand)'; }}
              >
                <Plus size={13} strokeWidth={2.25} />
                New Lead
              </button>
            ) : null
          }
        />

        {/* Advanced filter panel (ALT-270) — shown below toolbar when flag + open. */}
        {ADVANCED_FILTERS && filterPanelOpen && (
          <FilterBuilderPanel
            fields={LEADS_FIELDS}
            value={advFilters}
            onChange={(next) => { setAdvFilters(next); setPagination((p) => ({ ...p, pageIndex: 0 })); sel.clear(); }}
          />
        )}

        {/* Active-filter chips — shown in every view (table/grid/kanban). */}
        <ActiveFilters
          chips={filterChips}
          onClearAll={() => { setFilters(defaultFilters); setPagination((p) => ({ ...p, pageIndex: 0 })); sel.clear(); }}
        />

        {/* Select-all-matching bar — only when the whole page is selected and
            more matching rows exist beyond it (ALT-368). */}
        {!loading && !loadError && (
          <SelectAllMatchingBar
            noun="lead"
            pageCount={pageRowIds.length}
            pageSelectedCount={pageSelectedCount}
            totalMatching={allMatchingIds.length}
            totalSelected={sel.count}
            onSelectAllMatching={() => sel.addAll(allMatchingIds)}
            onClear={() => sel.clear()}
          />
        )}

        {/* Kanban (Board) view — group-by field is selectable (ALT-338); cards
            open the same preview drawer the row uses. */}
        {view === 'kanban' && !loading && !loadError && (
          <div className="flex items-center" style={{ marginBottom: 8 }}>
            <KanbanGroupBySelect
              value={kanbanGroupBy}
              onChange={setKanbanGroupBy}
              options={kanbanGroupOptions}
            />
          </div>
        )}
        {view === 'kanban' && !loading && !loadError && (
          <GenericKanban<RealLead>
            columns={kanbanColumns}
            itemsByColumn={leadsByGroup}
            getKey={(row) => row.id}
            getCardLabel={(row) => `Open ${row.company || row.contactName || 'lead'}`}
            onCardClick={(row) => setPreviewId(row.id)}
            isSelected={(row) => sel.isSelected(row.id)}
            onToggleSelect={(row) => sel.toggle(row.id)}
            renderCard={(row) => (
              <CardShell
                name={row.company || row.contactName || ''}
                subtitle={row.contactName || undefined}
                chip={row.stage ?? undefined}
                fields={[
                  { label: 'City', value: row.city ?? '' },
                  { label: 'Salesperson', value: row.salesperson ?? '' },
                ]}
              />
            )}
          />
        )}

        {/* Grid view — real inline-edit spreadsheet (ALT-331). For Leads every
            column is read-only (no safe inline writer); editing happens via the
            preview drawer / bulk reassign. */}
        {view === 'grid' && !loading && !loadError && (
          <EditableGrid<RealLead>
            rows={gridRows}
            getKey={(row) => row.id}
            columns={gridColumns}
            isSelected={(row) => sel.isSelected(row.id)}
            onToggleSelect={(row) => sel.toggle(row.id)}
            selectAllState={gridSelectAllState}
            onToggleSelectAll={() => sel.toggleAll(gridRows.map((r) => r.id))}
            onOpenRow={(row) => setPreviewId(row.id)}
            emptyLabel="No leads match."
          />
        )}

        {/* Table */}
        {(view === 'table' || loading || loadError) && (
        <div className="overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}>
            <table className="w-full">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--color-surface-alt)' }}>
                    {headerGroup.headers.map((header) => {
                      const canSort = header.column.getCanSort();
                      const sortDir = header.column.getIsSorted();
                      return (
                      <th
                        key={header.id}
                        role={canSort ? 'button' : undefined}
                        tabIndex={canSort ? 0 : undefined}
                        aria-sort={
                          sortDir === 'asc' ? 'ascending' : sortDir === 'desc' ? 'descending' : canSort ? 'none' : undefined
                        }
                        style={{
                          padding: header.id === '__select' ? '11px 12px' : '11px 16px',
                          textAlign: 'left',
                          fontWeight: 500,
                          fontSize: 12,
                          color: 'var(--color-gray-500)',
                          whiteSpace: 'nowrap',
                          userSelect: 'none',
                          cursor: canSort ? 'pointer' : 'default',
                          width: header.id === '__select' ? 40 : undefined,
                          // Sticky header (ALT-318): keep the header row visible while the
                          // body scrolls. Background + bottom border live on the cell so
                          // rows can't show through under the sticky header.
                          position: 'sticky',
                          top: 0,
                          // ALT-440: column pinning — pinned-left columns also stick
                          // horizontally. zIndex 3 so pinned headers sit above both the
                          // sticky body cells (zIndex 2) and normal headers (zIndex 2).
                          ...(header.column.getIsPinned() === 'left'
                            ? { left: header.column.getStart('left'), zIndex: 3 }
                            : { zIndex: 2 }),
                          background: 'var(--color-surface-alt)',
                          borderBottom: '1px solid var(--border-color)',
                          ...(header.column.getIsPinned() === 'left'
                            ? { boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)' }
                            : {}),
                        }}
                        onClick={header.column.getToggleSortingHandler()}
                        onKeyDown={(e) => {
                          if (canSort && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            header.column.getToggleSortingHandler()?.(e);
                          }
                        }}
                      >
                        <div className="flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort &&
                            ({
                              asc: <ChevronUp size={11} style={{ color: 'var(--color-brand)' }} />,
                              desc: <ChevronDown size={11} style={{ color: 'var(--color-brand)' }} />,
                            }[sortDir as string] ?? (
                              <ChevronsUpDown size={11} className="text-stone-300" />
                            ))}
                        </div>
                      </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {loading ? (
                  // Skeleton rows aligned to the visible columns (ALT-200).
                  Array.from({ length: 8 }).map((_, r) => (
                    <tr key={`sk-${r}`} style={{ borderBottom: '1px solid var(--color-surface-inset)', height: 44 }}>
                      {columns.map((_c, c) => (
                        <td key={c} style={{ padding: c === 0 ? '0 12px' : '0 16px' }}>
                          <Skeleton height={12} width={c === 0 ? 16 : `${48 + ((r + c) % 4) * 12}%`} radius={4} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : loadError ? (
                  // Error state with Retry (ALT-215 #12).
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-10 text-center">
                      <div className="flex flex-col items-center justify-center gap-3" style={{ fontSize: 13 }}>
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
                    </td>
                  </tr>
                ) : table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-6">
                      {hasActiveFilters ? (
                        <EmptyState
                          icon={<Target size={22} />}
                          title="No leads match these filters"
                          message="Try widening or clearing the filters to see more leads."
                          action={{
                            label: 'Clear filters',
                            onClick: () => {
                              setFilters(defaultFilters);
                              setPagination((p) => ({ ...p, pageIndex: 0 }));
                              sel.clear();
                            },
                          }}
                        />
                      ) : (
                        <EmptyState
                          icon={<Target size={22} />}
                          title="No leads yet"
                          message="Leads you’re assigned to will show up here."
                        />
                      )}
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => {
                    // SAFE_VIEW (ALT-493): grey out rows owned by another rep.
                    const leadForeign = isForeignRecord(row.original.salespersonUserId, userId, safeViewExempt);
                    return (
                    <tr
                      key={row.id}
                      role="button"
                      tabIndex={0}
                      data-rowid={row.original.id}
                      aria-label={`Preview ${row.original.company || row.original.contactName || 'lead'}`}
                      onClick={() => setPreviewId(row.original.id)}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                          e.preventDefault();
                          setPreviewId(row.original.id);
                        }
                      }}
                      style={{
                        borderBottom: '1px solid var(--color-surface-inset)',
                        height: densityMetrics.rowHeight,
                        cursor: 'pointer',
                        // Animate row height when toggling density (ALT density win).
                        transition: 'background 0.1s, height 0.15s ease',
                        background: sel.isSelected(row.original.id) ? 'var(--color-brand-subtle)' : undefined,
                        boxShadow:
                          keyNav.focusedId === row.original.id
                            ? 'inset 3px 0 0 0 var(--color-brand, #1A7EE8)'
                            : undefined,
                        // SAFE_VIEW (ALT-493): muted styling for foreign records.
                        ...foreignRowStyle(leadForeign),
                      }}
                      onMouseEnter={(e) => {
                        if (!sel.isSelected(row.original.id)) {
                          (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-hover)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = sel.isSelected(row.original.id)
                          ? 'var(--color-brand-subtle)'
                          : '';
                      }}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const isPinnedLeft = cell.column.getIsPinned() === 'left';
                        return (
                          <td
                            key={cell.id}
                            className="align-middle whitespace-nowrap"
                            style={{
                              padding: `${densityMetrics.cellPaddingY}px ${cell.column.id === '__select' ? 12 : 16}px`,
                              ...(densityMetrics.fontSize ? { fontSize: densityMetrics.fontSize } : null),
                              color: 'var(--color-gray-900)',
                              borderBottom: '1px solid var(--color-surface-inset)',
                              // ALT-440: sticky left for pinned columns.
                              ...(isPinnedLeft
                                ? {
                                    position: 'sticky',
                                    left: cell.column.getStart('left'),
                                    zIndex: 2,
                                    background: 'inherit',
                                    boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)',
                                  }
                                : {}),
                            }}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        );
                      })}
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          {!loading && !loadError && totalRows > 0 && (
            <div
              className="flex items-center justify-between px-4"
              style={{ height: 44, background: 'var(--color-gray-50)', borderTop: '1px solid var(--border-color)' }}
            >
              <div className="flex items-center gap-2">
                <span className="text-stone-500" style={{ fontSize: 12 }}>Rows per page</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    table.setPageSize(Number(e.target.value));
                    table.setPageIndex(0);
                  }}
                  style={{ ...inputBase, height: 28, paddingRight: 22, cursor: 'pointer', fontSize: 12 }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#d4d4d8'; }}
                >
                  {PAGE_SIZE_OPTIONS.map((sz) => (
                    <option key={sz} value={sz}>{sz}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-stone-500" style={{ fontSize: 12 }}>
                  Showing <span className="font-medium text-stone-700">{firstRow}</span>–
                  <span className="font-medium text-stone-700">{lastRow}</span> of{' '}
                  <span className="font-medium text-stone-700">{totalRows}</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      height: 28, padding: '0 10px', fontSize: 12,
                      border: '1px solid var(--border-input)',
                      borderRadius: 'var(--radius-btn)',
                      background: 'var(--color-surface)',
                      color: 'var(--color-gray-600)',
                      cursor: !table.getCanPreviousPage() ? 'not-allowed' : 'pointer',
                      opacity: !table.getCanPreviousPage() ? 0.4 : 1,
                      transition: 'border-color 0.12s',
                    }}
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={14} />
                    Prev
                  </button>
                  <span style={{ fontSize: 12, padding: '0 4px', color: 'var(--color-gray-500)' }}>
                    Page <span style={{ fontWeight: 600, color: 'var(--color-gray-700)' }}>{pageIndex + 1}</span> of{' '}
                    <span style={{ fontWeight: 600, color: 'var(--color-gray-700)' }}>{table.getPageCount()}</span>
                  </span>
                  <button
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      height: 28, padding: '0 10px', fontSize: 12,
                      border: '1px solid var(--border-input)',
                      borderRadius: 'var(--radius-btn)',
                      background: 'var(--color-surface)',
                      color: 'var(--color-gray-600)',
                      cursor: !table.getCanNextPage() ? 'not-allowed' : 'pointer',
                      opacity: !table.getCanNextPage() ? 0.4 : 1,
                      transition: 'border-color 0.12s',
                    }}
                    aria-label="Next page"
                  >
                    Next
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Grid-view pagination footer (table view has its own footer above) */}
        {view === 'grid' && !loading && !loadError && totalRows > 0 && (
          <div
            className="flex items-center justify-between px-4 rounded-lg"
            style={{ height: 44, background: 'var(--color-gray-50)', border: '1px solid var(--border-color)' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-stone-500" style={{ fontSize: 12 }}>Rows per page</span>
              <select
                value={pageSize}
                onChange={(e) => { table.setPageSize(Number(e.target.value)); table.setPageIndex(0); }}
                style={{ ...inputBase, height: 28, paddingRight: 22, cursor: 'pointer', fontSize: 12 }}
              >
                {PAGE_SIZE_OPTIONS.map((sz) => <option key={sz} value={sz}>{sz}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-stone-500" style={{ fontSize: 12 }}>
                Showing <span className="font-medium text-stone-700">{firstRow}</span>–
                <span className="font-medium text-stone-700">{lastRow}</span> of{' '}
                <span className="font-medium text-stone-700">{totalRows}</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, height: 28, padding: '0 10px', fontSize: 12,
                    border: '1px solid var(--border-input)', borderRadius: 'var(--radius-btn)',
                    background: 'var(--color-surface)', color: 'var(--color-gray-600)',
                    cursor: !table.getCanPreviousPage() ? 'not-allowed' : 'pointer', opacity: !table.getCanPreviousPage() ? 0.4 : 1,
                  }}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <span style={{ fontSize: 12, padding: '0 4px', color: 'var(--color-gray-500)' }}>
                  Page <span style={{ fontWeight: 600, color: 'var(--color-gray-700)' }}>{pageIndex + 1}</span> of{' '}
                  <span style={{ fontWeight: 600, color: 'var(--color-gray-700)' }}>{table.getPageCount()}</span>
                </span>
                <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, height: 28, padding: '0 10px', fontSize: 12,
                    border: '1px solid var(--border-input)', borderRadius: 'var(--radius-btn)',
                    background: 'var(--color-surface)', color: 'var(--color-gray-600)',
                    cursor: !table.getCanNextPage() ? 'not-allowed' : 'pointer', opacity: !table.getCanNextPage() ? 0.4 : 1,
                  }}
                  aria-label="Next page"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Row-click preview slide-over (ALT-327/328) */}
      {previewId != null && (
        <RecordPreviewPanel
          title="Lead"
          onClose={() => setPreviewId(null)}
          openFullHref={`${leadBase}/${previewId}`}
        >
          <LeadPreview leadId={Number(previewId)} />
        </RecordPreviewPanel>
      )}

      {showReassign && (
        <BulkReassignModal
          entityLabel="Lead"
          ownerLabel="Salesperson"
          count={sel.count}
          owners={reassignOwners}
          saving={reassignSaving}
          error={reassignError}
          progress={bulkProgress}
          onCancel={() => bulkAbort.current?.abort()}
          onConfirm={handleBulkReassign}
          onClose={() => setShowReassign(false)}
        />
      )}
    </AppShell>
  );
}

export default LeadsPage;
