import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import { AppShell } from '../components/layout/AppShell';
import { MeetingStatusBadge } from '../components/meeting/MeetingStatusBadge';
import {
  fetchMeetings,
  formatDate,
  formatTime,
  type MeetingRow,
} from '../data/meetings';
import { pageTransition, pageTransitionConfig } from '../lib/zenAnimations';
import { useAuth } from '../contexts/AuthContext';
import { useIsSalesShell } from '../contexts/SalesShellContext';
import { useProjectScope } from '../contexts/ProjectContext';
import { useRowSelection } from '../components/ui/useRowSelection';
import { useListKeyboardNav } from '../components/ui/useListKeyboardNav';
import { ExportButton } from '../components/ui/ExportButton';
import { MultiSelectFilter } from '../components/ui/MultiSelectFilter';
import { humanizeWriteError } from '../lib/writeError';
import { Skeleton } from '../components/ui/Skeleton';
import {
  ColumnCustomizer,
  defaultColumnPrefs,
  reconcileColumns,
} from '../components/ui/ColumnCustomizer';
import { ViewSwitcher, useViewMode } from '../components/ui/ViewSwitcher';
import { CardShell } from '../components/ui/CardGrid';
import { ListToolbar } from '../components/ui/ListToolbar';
import { DensityToggle } from '../components/ui/DensityToggle';
import { useDensity, getDensityMetrics } from '../components/ui/useDensity';
import { EmptyState } from '../components/ui/EmptyState';
import { ActiveFilters, type FilterChip } from '../components/ui/ActiveFilters';
import { SelectAllMatchingBar } from '../components/ui/SelectAllMatchingBar';
import { useListFilters } from '../lib/listFilters';
import { ADVANCED_FILTERS, MEETINGS_FIELDS, EMPTY_FILTER_STATE, evalFilterState, type AdvancedFilterState } from '../lib/filterEngine';
import { FilterBuilderButton, FilterBuilderPanel } from '../components/filters/FilterBuilder';
import { ViewPicker } from '../components/filters/ViewPicker';
import type { SavedViewRecord } from '../data/savedViews';
import { useSortPersistence } from '../lib/useSortPersistence';
import { usePinPersistence } from '../lib/usePinPersistence';
import { EditableGrid, type EditableColumn } from '../components/ui/EditableGrid';
import { GenericKanban } from '../components/kanban/GenericKanban';
import {
  KanbanGroupBySelect,
  buildKanbanGrouping,
  type KanbanGroupDef,
} from '../components/kanban/KanbanGroupBySelect';
import type { ColumnDef as ColDef, ExportColumn } from '../components/ui/columns';
import type { ColumnPref } from '../data/views';
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CalendarDays,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  UserCheck,
} from 'lucide-react';
import { BulkReassignModal } from '../components/common/ReassignModal';
import { RecordPreviewPanel } from '../components/common/RecordPreviewPanel';
import { MeetingPreview } from '../components/meetings/MeetingPreview';
import { reassignMeetingsBulk, fetchAssignableUsers } from '../data/assignment';
import { distributeRecords } from '../data/bulkActions';
import type { UserOption } from '../data/wishlist';
import { useToast } from '../components/ui/Toast';

const columnHelper = createColumnHelper<MeetingRow>();
const PAGE_SIZE = 25;

/* ------------------------------------------------------------------ */
/* Column catalogue (used by ColumnCustomizer + ExportButton)          */
/* ------------------------------------------------------------------ */

// ColDef is parameterised on Row but ColumnCustomizer only needs key/header/defaultVisible.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ALL_COLUMNS: ColDef<any>[] = [
  { key: 'company',     header: 'Company / Lead',  defaultVisible: true },
  { key: 'client',      header: 'Client',           defaultVisible: true },
  { key: 'meetingDate', header: 'Meeting',          defaultVisible: true },
  { key: 'leadStage',   header: 'Lead Stage',       defaultVisible: true },  // ALT-437
  { key: 'mode',        header: 'Mode',             defaultVisible: true },
  { key: 'salesperson', header: 'Salesperson',      defaultVisible: true },
  { key: 'agent',       header: 'Agent',            defaultVisible: true },
  { key: 'confirmed',   header: 'Confirmed',        defaultVisible: true },
  { key: 'status',      header: 'Status',           defaultVisible: true },
];

const EXPORT_COLUMNS: ExportColumn<MeetingRow>[] = [
  { key: 'leadNumber',  header: 'Lead #' },
  { key: 'leadName',    header: 'Lead Name' },
  { key: 'company',     header: 'Company' },
  { key: 'client',      header: 'Client' },
  { key: 'industry',    header: 'Industry' },
  { key: 'city',        header: 'City' },
  { key: 'meetingDate', header: 'Meeting Date', accessor: (r) => r.meetingDate ? formatDate(r.meetingDate) : '' },
  { key: 'meetingTime', header: 'Meeting Time', accessor: (r) => r.meetingTime ? formatTime(r.meetingTime) : '' },
  { key: 'mode',        header: 'Mode' },
  { key: 'status',      header: 'Status' },
  { key: 'leadStage',   header: 'Lead Stage' },
  { key: 'confirmed',   header: 'Confirmed', accessor: (r) => r.confirmed ? 'Yes' : 'No' },
  { key: 'salesperson', header: 'Salesperson' },
  { key: 'agent',       header: 'Agent' },
  { key: 'contact',     header: 'Contact Number' },
  { key: 'leadGenDate', header: 'Lead Generated', accessor: (r) => r.leadGenDate ? formatDate(r.leadGenDate) : '' },
];

/* ------------------------------------------------------------------ */
/* Company avatar — deterministic tinted initials                      */
/* ------------------------------------------------------------------ */

const AVATAR_TINTS: { bg: string; text: string }[] = [
  { bg: '#E8F2FD', text: '#1A7EE8' },
  { bg: '#F5F3FF', text: '#7C3AED' },
  { bg: '#ECFEFF', text: '#0891B2' },
  { bg: '#F0FDF4', text: '#16A34A' },
  { bg: '#FFF7ED', text: '#EA580C' },
  { bg: 'rgba(196,77,77,0.06)', text: '#DC2626' },
  { bg: '#FFFBEB', text: '#D97706' },
  { bg: '#EFF6FF', text: '#1D4ED8' },
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
  const tint = name ? avatarTint(name) : { bg: '#F3F4F6', text: '#9CA3AF' };
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

/* ------------------------------------------------------------------ */
/* Filters — the 7 small-CR filters + search                           */
/* ------------------------------------------------------------------ */

interface Filters {
  search: string;
  leadDateFrom: string;
  leadDateTo: string;
  agent: string[];
  industry: string[];
  city: string[];
  meetingDateFrom: string;
  meetingDateTo: string;
  salesperson: string[];
  status: string[];
}

const defaultFilters: Filters = {
  search: '',
  leadDateFrom: '',
  leadDateTo: '',
  agent: [],
  industry: [],
  city: [],
  meetingDateFrom: '',
  meetingDateTo: '',
  salesperson: [],
  status: [],
};

const inputBase: React.CSSProperties = {
  fontSize: 13,
  padding: '5px 8px',
  border: '1px solid #d4d4d8',
  borderRadius: 6,
  background: '#fff',
  color: '#18181b',
  outline: 'none',
  height: 30,
  transition: 'border-color 0.15s',
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

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function MeetingsPage() {
  const navigate = useNavigate();
  const { profile, canReassign } = useAuth();
  const userId = profile?.user_id ?? null;
  const toast = useToast();

  // In the Sales Portal shell, open the "mobile-ditto" sales meeting record
  // (/sales/meetings/:id) — never the internal /meetings/:id screen (ALT-275).
  // Mirrors LeadsPage's isSalesShell/leadBase pattern.
  const isSalesShell = useIsSalesShell();
  const meetingBase = isSalesShell ? '/sales/meetings' : '/meetings';

  // Global project scope (owner ask #8). When a project is selected (not "All"),
  // pre-filter to that project — composed (AND) with every page filter/search,
  // and a no-op when selectedProjectId is null. A meeting's project comes from its
  // lead (lead_master.project_id), now surfaced as MeetingRow.projectId in
  // src/data/meetings.ts, matched on the same numeric id useProjectScope returns.
  const { selectedProjectId } = useProjectScope();

  // Persisted across refresh per browser (ALT-369).
  const [filters, setFilters] = useListFilters<Filters>('meetings', defaultFilters);
  // Advanced filter state (ALT-270) — only used when ADVANCED_FILTERS is on.
  const [advFilters, setAdvFilters] = useState<AdvancedFilterState>(EMPTY_FILTER_STATE);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [activeViewId, setActiveViewId] = useState<number | null>(null);
  // Persisted sort state (ALT-440) — mirrors density key convention: altleads:sort:<entity>:<userId>.
  const [sorting, setSorting] = useSortPersistence('meetings', userId);
  // Persisted column pinning (ALT-440) — key: altleads:pin:meetings:<userId>.
  const [columnPinning, setColumnPinning] = usePinPersistence('meetings', userId);
  const [pageIndex, setPageIndex] = useState(0);

  // Column visibility/order — seeded from defaults; ColumnCustomizer loads saved view on mount.
  const [colPrefs, setColPrefs] = useState<ColumnPref[]>(() => defaultColumnPrefs(ALL_COLUMNS));

  const sel = useRowSelection<string>();
  const searchRef = useRef<HTMLInputElement>(null);

  // Table / Grid view (persisted per user + entity in localStorage).
  const [view, setView] = useViewMode('meetings', userId);

  // Row density (comfortable/compact) — persisted per user + entity (ALT-375).
  const [density, setDensity] = useDensity('meetings', userId);
  const densityMetrics = getDensityMetrics(density);

  const [allMeetings, setAllMeetings] = useState<MeetingRow[]>([]);
  const [agents, setAgents] = useState<string[]>([]);
  const [salespeople, setSalespeople] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  // Kanban "Group by" field (ALT-338) — default = status (the original fixed field).
  const [kanbanGroupBy, setKanbanGroupBy] = useState<string>('status');
  const [industries, setIndustries] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // True when fetchMeetings hit its 2,000-row hard cap and older meetings were
  // dropped server-side (ALT-428). Surfaced as a banner so the list never looks
  // complete when it isn't.
  const [truncated, setTruncated] = useState(false);
  // Bump to re-run the load effect (Retry on error). ALT-215 #12.
  const [reloadKey, setReloadKey] = useState(0);

  // Row-click / card-click preview slide-over (ALT-327/328) — opens a compact
  // mini-record instead of navigating; "Open full record" goes to meetingBase/:id.
  const [previewId, setPreviewId] = useState<number | null>(null);

  // Bulk reassign (ALT-291) — reassigns each selected meeting's underlying lead.
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
    const ids = [...sel.selectedIds].map(Number).filter((n) => !isNaN(n));
    const actor = profile?.user_id != null ? String(profile.user_id) : '';
    const records = ids.map((id) => ({ id, companyKey: null }));
    const slices = distributeRecords(records, ownerIds, { maxPerCompany });
    const totalCount = ids.length;
    setReassignSaving(true);
    setReassignError(null);
    const ac = new AbortController();
    bulkAbort.current = ac;
    setBulkProgress({ done: 0, total: totalCount });

    let totalOk = 0;
    let totalFailed = 0;
    let firstErr: string | null = null;

    try {
      for (const [ownerId, meetingIds] of slices) {
        if (ac.signal.aborted) break;
        if (meetingIds.length === 0) continue;
        const res = await reassignMeetingsBulk(meetingIds, ownerId, actor, {
          signal: ac.signal,
          onProgress: () => setBulkProgress({ done: totalOk + totalFailed, total: totalCount }),
        });
        totalOk += res.ok;
        totalFailed += res.failed;
        if (!firstErr && res.error) firstErr = res.error;
        setBulkProgress({ done: totalOk + totalFailed, total: totalCount });
      }
    } finally {
      setReassignSaving(false);
      setBulkProgress(null);
      bulkAbort.current = null;
    }
    if (totalOk === 0 && (firstErr || totalFailed > 0)) { setReassignError(humanizeWriteError(firstErr ?? `${totalFailed} could not be reassigned.`)); return; }
    setShowReassign(false);
    sel.clear();
    setReloadKey((k) => k + 1);
    toast.success(
      totalFailed > 0
        ? `Reassigned ${totalOk}; ${totalFailed} skipped.`
        : `Reassigned ${totalOk} meeting${totalOk === 1 ? '' : 's'} — the new owner(s) were notified.`,
    );
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchMeetings().then((result) => {
      if (cancelled) return;
      setAllMeetings(result.meetings);
      setAgents(result.agents);
      setSalespeople(result.salespeople);
      setStatuses(result.statuses);
      setIndustries(result.industries);
      setCities(result.cities);
      setTruncated(result.truncated);
      setLoadError(result.error);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setLoadError('Could not load meetings.');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPageIndex(0);
    // Clear selection so a bulk action can't act on rows filtered out of view
    // (mirrors ContactsPage / CompaniesPage setFilter).
    sel.clear();
  };

  const hasActiveFilters = Object.values(filters).some((v) =>
    Array.isArray(v) ? v.length > 0 : v !== '',
  );

  // Shared clear-filters handler — used by the toolbar's "Clear filters" button
  // and the empty-state's action so they stay in lockstep.
  const clearFilters = () => { setFilters(defaultFilters); setPageIndex(0); sel.clear(); };

  // Active-filter chips (ALT) — one chip per selected facet value + one per date
  // range; free-text search is excluded (it has its own inline clear affordance).
  const filterChips = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    const facets: { field: keyof Filters; human: string }[] = [
      { field: 'agent', human: 'Agent' },
      { field: 'industry', human: 'Industry' },
      { field: 'city', human: 'City' },
      { field: 'salesperson', human: 'Sales Person / Head' },
      { field: 'status', human: 'Meeting Status' },
    ];
    for (const { field, human } of facets) {
      for (const value of filters[field] as string[]) {
        chips.push({
          key: `${field}:${value}`,
          label: `${human}: ${value}`,
          onRemove: () =>
            setFilter(field, (filters[field] as string[]).filter((x) => x !== value)),
        });
      }
    }
    if (filters.leadDateFrom || filters.leadDateTo) {
      chips.push({
        key: 'leadDate',
        label: `Lead Generated: ${filters.leadDateFrom || '…'} – ${filters.leadDateTo || '…'}`,
        onRemove: () => { setFilter('leadDateFrom', ''); setFilter('leadDateTo', ''); },
      });
    }
    if (filters.meetingDateFrom || filters.meetingDateTo) {
      chips.push({
        key: 'meetingDate',
        label: `Meeting Date: ${filters.meetingDateFrom || '…'} – ${filters.meetingDateTo || '…'}`,
        onRemove: () => { setFilter('meetingDateFrom', ''); setFilter('meetingDateTo', ''); },
      });
    }
    return chips;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const filteredData = useMemo(() => {
    return allMeetings.filter((m) => {
      // Global project scope (AND with every page filter). null = "All projects".
      if (selectedProjectId != null && m.projectId !== selectedProjectId) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const searchable = [
          m.name, m.leadName, m.leadNumber, m.company, m.client,
          m.agent, m.salesperson, m.status, m.mode, m.contact,
          m.industry, m.city, m.leadStage,
        ].join(' ').toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      if (filters.leadDateFrom) {
        if (!m.leadGenDate || m.leadGenDate < filters.leadDateFrom) return false;
      }
      if (filters.leadDateTo) {
        if (!m.leadGenDate || m.leadGenDate > filters.leadDateTo) return false;
      }
      if (filters.meetingDateFrom) {
        if (!m.meetingDate || m.meetingDate < filters.meetingDateFrom) return false;
      }
      if (filters.meetingDateTo) {
        if (!m.meetingDate || m.meetingDate > filters.meetingDateTo) return false;
      }
      if (filters.agent.length && !filters.agent.includes(m.agent)) return false;
      if (filters.industry.length && !filters.industry.includes(m.industry)) return false;
      if (filters.city.length && !filters.city.includes(m.city)) return false;
      if (filters.salesperson.length && !filters.salesperson.includes(m.salesperson)) return false;
      if (filters.status.length && !filters.status.includes(m.status)) return false;
      // Advanced filter evaluation (ALT-270)
      if (ADVANCED_FILTERS && advFilters.groups.length > 0) {
        if (!evalFilterState(m as unknown as Record<string, unknown>, advFilters)) return false;
      }
      return true;
    });
  }, [filters, advFilters, allMeetings, selectedProjectId]);

  // Meetings hidden ONLY because their lead carries no project_id while a project is
  // scoped — surfaced as a note so the filter never looks like missing data
  // (review ALT-273B: NULL project_id rows silently hidden).
  const noProjectHidden = useMemo(
    () => (selectedProjectId == null ? 0 : allMeetings.filter((m) => m.projectId == null).length),
    [selectedProjectId, allMeetings],
  );

  // Kanban (Board) view — selectable "Group by" field (ALT-338). Default = status
  // (the original fixed grouping): its lanes reuse the canonical status order so
  // the board looks identical to before. City / Industry / Salesperson derive
  // their lanes from the distinct values present. (Disposition grouping needs
  // latest-call data not carried on the meeting row → skipped for now.)
  const kanbanGroupOptions = useMemo<KanbanGroupDef<MeetingRow>[]>(() => [
    {
      key: 'status',
      label: 'Status',
      getGroup: (m) => m.status || null,
      lanes: statuses
        .filter((s) => filteredData.some((m) => m.status === s))
        .map((s) => ({ key: s, label: s })),
    },
    { key: 'city', label: 'City', getGroup: (m) => m.city || null },
    { key: 'industry', label: 'Industry', getGroup: (m) => m.industry || null },
    { key: 'salesperson', label: 'Salesperson', getGroup: (m) => m.salesperson || null },
  ], [statuses, filteredData]);

  const { columns: kanbanColumns, itemsByColumn: meetingsByGroup } = useMemo(() => {
    const group = kanbanGroupOptions.find((o) => o.key === kanbanGroupBy) ?? kanbanGroupOptions[0];
    return buildKanbanGrouping<MeetingRow>(filteredData, group, 'Unset');
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
  // (mirrors ContactsPage's safePage clamp).
  useEffect(() => {
    const pageCount = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));
    if (pageIndex > pageCount - 1) {
      setPageIndex(pageCount - 1);
    }
  }, [filteredData.length, pageIndex]);

  // Visible column keys in display order (driven by colPrefs).
  const visibleKeys = useMemo(
    () => colPrefs.filter((p) => p.visible).map((p) => p.key),
    [colPrefs],
  );

  // Export columns: never leak a column the user has hidden in the customizer.
  // Keys present in the column catalogue must be visible to be exported;
  // export-only extras (Lead #, Industry, City, etc.) that are not
  // customizer-controlled are always included.
  const customizerKeys = useMemo(() => new Set(ALL_COLUMNS.map((c) => c.key)), []);
  const activeExportColumns = useMemo<ExportColumn<MeetingRow>[]>(() => {
    const visible = new Set(visibleKeys);
    return EXPORT_COLUMNS.filter(
      (c) => !customizerKeys.has(c.key) || visible.has(c.key),
    );
  }, [visibleKeys, customizerKeys]);

  // Full column map (key -> TanStack column definition).
  const allColumnDefs = useMemo(
    () => ({
      company: columnHelper.accessor('company', {
        id: 'company',
        header: 'Company / Lead',
        cell: (info) => {
          const company = info.getValue() || info.row.original.leadName || info.row.original.name || '';
          return (
            <div className="flex items-center gap-2 min-w-0">
              <CompanyAvatar name={company} />
              <div className="min-w-0">
                <p className="font-medium text-stone-900 truncate" style={{ fontSize: 13, maxWidth: 200 }} title={company || undefined}>
                  {company || <span className="text-stone-400">Unlinked meeting</span>}
                </p>
                <p className="text-stone-400 truncate" style={{ fontSize: 11, maxWidth: 200 }} title={[info.row.original.leadName, info.row.original.city].filter(Boolean).join(' · ') || undefined}>
                  {[info.row.original.leadName, info.row.original.city].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
          );
        },
      }),
      client: columnHelper.accessor('client', {
        id: 'client',
        header: 'Client',
        cell: (info) => {
          const v = info.getValue() ?? '';
          return (
            <span className="text-stone-600 truncate" title={v || undefined} style={{ fontSize: 13 }}>
              {v || <span className="text-stone-300">—</span>}
            </span>
          );
        },
      }),
      meetingDate: columnHelper.accessor('meetingDate', {
        id: 'meetingDate',
        header: 'Meeting',
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
          <div className="whitespace-nowrap">
            <p className="text-stone-700" style={{ fontSize: 13 }}>
              {info.getValue() ? formatDate(info.getValue()) : <span className="text-stone-300">—</span>}
            </p>
            <p className="text-stone-400" style={{ fontSize: 11 }}>
              {info.row.original.meetingTime ? formatTime(info.row.original.meetingTime) : ''}
            </p>
          </div>
        ),
      }),
      // ALT-437: leadStage is carried on MeetingRow (from lead_report.stage_id) —
      // surface it as a small badge-style column so the list shows the lead's stage.
      leadStage: columnHelper.accessor('leadStage', {
        id: 'leadStage',
        header: 'Lead Stage',
        cell: (info) => {
          const v = info.getValue();
          return v ? (
            <span
              style={{
                display: 'inline-block',
                fontSize: 11,
                fontWeight: 500,
                background: '#F0F9FF',
                color: '#0369A1',
                borderRadius: 4,
                padding: '2px 7px',
                whiteSpace: 'nowrap',
              }}
            >
              {v}
            </span>
          ) : (
            <span className="text-stone-300" style={{ fontSize: 13 }}>—</span>
          );
        },
      }),
      mode: columnHelper.accessor('mode', {
        id: 'mode',
        header: 'Mode',
        cell: (info) => (
          <span className="text-stone-600" style={{ fontSize: 13 }}>
            {info.getValue() || <span className="text-stone-300">—</span>}
          </span>
        ),
      }),
      salesperson: columnHelper.accessor('salesperson', {
        id: 'salesperson',
        header: 'Salesperson',
        cell: (info) => (
          <span className="text-stone-700 truncate" style={{ fontSize: 13 }} title={(info.getValue() as string) || undefined}>
            {info.getValue() || <span className="text-stone-300">—</span>}
          </span>
        ),
      }),
      agent: columnHelper.accessor('agent', {
        id: 'agent',
        header: 'Agent',
        cell: (info) => (
          <span className="text-stone-700" style={{ fontSize: 13 }}>
            {info.getValue() || <span className="text-stone-300">—</span>}
          </span>
        ),
      }),
      confirmed: columnHelper.accessor('confirmed', {
        id: 'confirmed',
        header: 'Confirmed',
        cell: (info) =>
          info.getValue() ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                fontWeight: 500,
                background: '#F0FDF4',
                color: '#16A34A',
                borderRadius: 4,
                padding: '2px 7px',
                whiteSpace: 'nowrap',
              }}
            >
              <CheckCircle2 size={11} /> Yes
            </span>
          ) : (
            <span className="text-stone-400" style={{ fontSize: 13 }}>—</span>
          ),
      }),
      status: columnHelper.accessor('status', {
        id: 'status',
        header: 'Status',
        cell: (info) => <MeetingStatusBadge status={info.getValue()} />,
      }),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Checkbox column is built inside the table columns memo (needs sel, not table ref).
  const columns = useMemo(() => {
    const checkboxCol = columnHelper.display({
      id: '__select',
      header: ({ table: t }) => {
        const pageIds = t.getRowModel().rows.map((r) => r.original.id);
        const allSel = sel.allSelected(pageIds);
        return (
          <input
            type="checkbox"
            checked={allSel}
            onChange={() => sel.toggleAll(pageIds)}
            style={{ cursor: 'pointer', accentColor: '#1A7EE8' }}
            aria-label={allSel ? 'Deselect all meetings on this page' : 'Select all meetings on this page'}
          />
        );
      },
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={sel.isSelected(row.original.id)}
          onChange={(e) => { e.stopPropagation(); sel.toggle(row.original.id); }}
          onClick={(e) => e.stopPropagation()}
          style={{ cursor: 'pointer', accentColor: '#1A7EE8' }}
          aria-label={`Select ${row.original.company || row.original.leadName || row.original.name || 'meeting'}`}
        />
      ),
      size: 36,
    });
    const dataCols = visibleKeys
      .map((key) => allColumnDefs[key as keyof typeof allColumnDefs])
      .filter(Boolean);
    return [checkboxCol, ...dataCols];
  }, [visibleKeys, allColumnDefs, sel]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, pagination: { pageIndex, pageSize: PAGE_SIZE }, columnPinning },
    onSortingChange: setSorting,
    onPaginationChange: (updater) => {
      const next = typeof updater === 'function'
        ? updater({ pageIndex, pageSize: PAGE_SIZE })
        : updater;
      setPageIndex(next.pageIndex);
    },
    onColumnPinningChange: setColumnPinning,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const pageCount = table.getPageCount();
  const rowsOnPage = table.getRowModel().rows;
  const firstRow = filteredData.length === 0 ? 0 : pageIndex * PAGE_SIZE + 1;
  const lastRow = Math.min((pageIndex + 1) * PAGE_SIZE, filteredData.length);

  // "Select all N matching" affordance — ids the user can actually see/select now
  // (current table/grid page; all filtered rows in kanban) vs every id in the full
  // filtered set (ALT mirror of LeadsPage).
  const allMatchingIds = useMemo(() => filteredData.map((r) => r.id), [filteredData]);
  const pageRowIds = useMemo(
    () => (view === 'kanban' ? allMatchingIds : rowsOnPage.map((r) => r.original.id)),
    [view, allMatchingIds, rowsOnPage],
  );
  const pageSelectedCount = useMemo(
    () => pageRowIds.filter((id) => sel.isSelected(id)).length,
    [pageRowIds, sel],
  );

  // The meetings visible on the current page (drives keyboard-first row navigation).
  const navRows = useMemo(() => table.getRowModel().rows.map((r) => r.original), [table]);

  // Keyboard-first row navigation (j/k move · Enter open · x select · / search · Esc clear).
  // Paused while a preview is open so j/k don't move the list under the panel.
  const keyNav = useListKeyboardNav({
    rows: navRows,
    getId: (r) => r.id,
    onOpen: (r) => setPreviewId(Number(r.id)),
    onToggleSelect: (r) => sel.toggle(r.id),
    searchInputRef: searchRef,
    enabled: previewId == null,
  });

  /* ---- EditableGrid columns (real "Grid" view, ALT-331) ----
     Mirrors the Table columns. SAFE EDITABLE SET: ALL COLUMNS READ-ONLY. Meeting
     status is workflow-driven (it changes through the meeting record's flow, not a
     free dropdown) and owner reassignment goes through the people-picker
     (reassignMeeting / ReassignModal, available from the bulk toolbar), so there is
     no safe inline writer to wire here. The grid is therefore a denser, selectable
     spreadsheet view: status renders as the existing MeetingStatusBadge, dates via
     the existing formatters, and company/salesperson/agent as plain read-only
     text — matching the Table's cells. */
  const EDITABLE_COLUMNS = useMemo<EditableColumn<MeetingRow>[]>(() => [
    {
      key: 'company',
      header: 'Company / Lead',
      width: 240,
      getValue: (r) => r.company ?? '',
      render: (r) => {
        const company = r.company || r.leadName || r.name || '';
        return (
          <div className="flex items-center gap-2 min-w-0">
            <CompanyAvatar name={company} />
            <div className="min-w-0">
              <p className="font-medium text-stone-900 truncate" style={{ fontSize: 13, maxWidth: 200 }} title={company || undefined}>
                {company || <span className="text-stone-400">Unlinked meeting</span>}
              </p>
              <p className="text-stone-400 truncate" title={[r.leadName, r.city].filter(Boolean).join(' · ') || undefined} style={{ fontSize: 11, maxWidth: 200 }}>
                {[r.leadName, r.city].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'client',
      header: 'Client',
      getValue: (r) => r.client ?? '',
      render: (r) => (
        <span className="text-stone-600 truncate" title={r.client || undefined} style={{ fontSize: 13 }}>
          {r.client || <span className="text-stone-300">—</span>}
        </span>
      ),
    },
    {
      key: 'meetingDate',
      header: 'Meeting',
      getValue: (r) => (r.meetingDate ? formatDate(r.meetingDate) : ''),
      render: (r) => (
        <div className="whitespace-nowrap">
          <p className="text-stone-700" style={{ fontSize: 13 }}>
            {r.meetingDate ? formatDate(r.meetingDate) : <span className="text-stone-300">—</span>}
          </p>
          <p className="text-stone-400" style={{ fontSize: 11 }}>
            {r.meetingTime ? formatTime(r.meetingTime) : ''}
          </p>
        </div>
      ),
    },
    // ALT-437: lead stage badge in the grid view (mirrors the table column above).
    {
      key: 'leadStage',
      header: 'Lead Stage',
      getValue: (r) => r.leadStage ?? '',
      render: (r) =>
        r.leadStage ? (
          <span
            style={{
              display: 'inline-block',
              fontSize: 11,
              fontWeight: 500,
              background: '#F0F9FF',
              color: '#0369A1',
              borderRadius: 4,
              padding: '2px 7px',
              whiteSpace: 'nowrap',
            }}
          >
            {r.leadStage}
          </span>
        ) : (
          <span className="text-stone-300" style={{ fontSize: 13 }}>—</span>
        ),
    },
    {
      key: 'mode',
      header: 'Mode',
      getValue: (r) => r.mode ?? '',
      render: (r) => (
        <span className="text-stone-600" style={{ fontSize: 13 }}>
          {r.mode || <span className="text-stone-300">—</span>}
        </span>
      ),
    },
    {
      key: 'salesperson',
      header: 'Salesperson',
      getValue: (r) => r.salesperson ?? '',
      render: (r) => (
        <span className="text-stone-700 truncate" style={{ fontSize: 13 }} title={r.salesperson || undefined}>
          {r.salesperson || <span className="text-stone-300">—</span>}
        </span>
      ),
    },
    {
      key: 'agent',
      header: 'Agent',
      getValue: (r) => r.agent ?? '',
      render: (r) => (
        <span className="text-stone-700" style={{ fontSize: 13 }}>
          {r.agent || <span className="text-stone-300">—</span>}
        </span>
      ),
    },
    {
      key: 'confirmed',
      header: 'Confirmed',
      getValue: (r) => (r.confirmed ? 'Yes' : ''),
      render: (r) =>
        r.confirmed ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: 500,
              background: '#F0FDF4',
              color: '#16A34A',
              borderRadius: 4,
              padding: '2px 7px',
              whiteSpace: 'nowrap',
            }}
          >
            <CheckCircle2 size={11} /> Yes
          </span>
        ) : (
          <span className="text-stone-400" style={{ fontSize: 13 }}>—</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      getValue: (r) => r.status ?? '',
      render: (r) => <MeetingStatusBadge status={r.status} />,
    },
  ], []);

  return (
    <AppShell title="Meetings">
      <motion.div
        variants={pageTransition}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransitionConfig}
        className="space-y-3"
      >
        {/* Filter panel */}
        <div className="bg-white border border-stone-200 rounded-lg p-4">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Search */}
            <div className="flex flex-col gap-1">
              <label className="font-medium text-stone-500" style={{ fontSize: 11 }}>Search</label>
              <div className="relative flex items-center">
                <Search size={13} className="absolute text-stone-400 pointer-events-none" style={{ left: 8 }} />
                <input
                  ref={searchRef}
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilter('search', e.target.value)}
                  placeholder="Company, lead, salesperson..."
                  style={{ ...inputBase, paddingLeft: 26, paddingRight: filters.search ? 26 : 8, width: 210 }}
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
              selected={filters.agent}
              onChange={(v) => setFilter('agent', v)}
              options={agents}
            />
            <MultiSelectFilter
              label="Industry"
              selected={filters.industry}
              onChange={(v) => setFilter('industry', v)}
              options={industries}
            />
            <MultiSelectFilter
              label="City"
              selected={filters.city}
              onChange={(v) => setFilter('city', v)}
              options={cities}
            />
            <MultiSelectFilter
              label="Sales Person / Head"
              selected={filters.salesperson}
              onChange={(v) => setFilter('salesperson', v)}
              options={salespeople}
            />
            <MultiSelectFilter
              label="Meeting Status"
              selected={filters.status}
              onChange={(v) => setFilter('status', v)}
              options={statuses}
            />
          </div>
        </div>

        {/* Toolbar row: count + actions — standardized via ListToolbar (ALT-333) */}
        <ListToolbar
          left={
            <p className="text-stone-400" style={{ fontSize: 12 }}>
              {loading ? (
                <span className="flex items-center gap-1.5 text-stone-400">
                  <Loader2 size={12} className="animate-spin" />
                  Loading meetings...
                </span>
              ) : loadError ? (
                <span className="text-red-500">{loadError}</span>
              ) : (
                <>
                  {sel.count > 0 && (
                    <span className="font-medium text-stone-700 mr-2">{sel.count} selected ·</span>
                  )}
                  <span className="font-medium text-stone-700">{filteredData.length}</span> of{' '}
                  <span className="font-medium text-stone-700">{allMeetings.length}</span> meetings
                  {noProjectHidden > 0 && (
                    <span className="text-stone-400" title="These meetings' leads have no project assigned, so they're hidden while a project is selected.">
                      {' · '}{noProjectHidden} with no project hidden
                    </span>
                  )}
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
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
          bulkActions={canReassign && sel.count > 0 ? (
            <button
              onClick={openBulkReassign}
              className="inline-flex items-center gap-1.5 border border-stone-300 hover:border-stone-400 bg-white hover:bg-stone-50 text-stone-700 font-medium rounded-md transition-colors"
              style={{ fontSize: 13, padding: '6px 12px', height: 34 }}
              title="Reassign the selected meetings' leads to a salesperson"
            >
              <UserCheck size={14} />
              Reassign ({sel.count})
            </button>
          ) : null}
          viewSwitcher={
            <>
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
                  entity="meetings"
                  userId={profile?.user_id ?? null}
                  projectId={selectedProjectId}
                  currentState={{ filter_state: advFilters }}
                  activeViewId={activeViewId}
                  onApply={(v: SavedViewRecord) => {
                    if (v.filter_state) setAdvFilters(v.filter_state);
                    setActiveViewId(v.id);
                  }}
                />
              )}
              <ViewSwitcher value={view} onChange={setView} />
              {view === 'table' && <DensityToggle value={density} onChange={setDensity} />}
            </>
          }
          columns={
            <ColumnCustomizer
              entity="meetings"
              userId={userId}
              allColumns={ALL_COLUMNS}
              value={colPrefs}
              onChange={(next) => setColPrefs(reconcileColumns(next, ALL_COLUMNS))}
              columnPinning={columnPinning}
              onColumnPinningChange={setColumnPinning}
            />
          }
          exportButton={
            <ExportButton
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              rows={filteredData as any[]}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              columns={activeExportColumns as any[]}
              filename="amplior-crm-meetings"
              selectedIds={sel.selectedIds}
              idKey="id"
              idHeader="Meeting ID"
              disabled={loading || filteredData.length === 0}
            />
          }
          create={null}
        />

        {/* Advanced filter panel (ALT-270) — shown below toolbar when flag + open. */}
        {ADVANCED_FILTERS && filterPanelOpen && (
          <FilterBuilderPanel
            fields={MEETINGS_FIELDS}
            value={advFilters}
            onChange={(next) => { setAdvFilters(next); sel.clear(); }}
          />
        )}

        {/* Active-filter chips — what's filtering the list, removable + Clear all. */}
        <ActiveFilters chips={filterChips} onClearAll={clearFilters} />

        {/* Silent-truncation banner (ALT-428) — fetchMeetings caps at 2,000 rows
            and drops older meetings; warn so the list never looks complete when
            it isn't. This also qualifies the "select all N matching" claim below:
            allMatchingIds is built from the loaded (capped) set, so "all N" means
            all LOADED matching meetings — not every meeting that exists. */}
        {!loading && !loadError && truncated && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-md"
            style={{
              background: '#FFFBEB',
              border: '1px solid #FDE68A',
              color: '#92400E',
              fontSize: 12.5,
              padding: '7px 12px',
            }}
          >
            <AlertCircle size={14} style={{ color: '#D97706', flexShrink: 0 }} />
            <span>
              Showing the first <strong>2,000</strong> meetings. Refine filters to see the rest.
            </span>
          </div>
        )}

        {/* "Select all N matching" bar — bridges page-level checkbox to the full
            filtered set (mirrors LeadsPage). NOTE (ALT-436): when `truncated` is
            true the "N matching" set covers only the loaded (capped) rows; the
            banner above makes the cap explicit so select-all can't imply it hit
            meetings that were never loaded. */}
        {!loading && !loadError && (
          <SelectAllMatchingBar
            noun="meeting"
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
          <GenericKanban<MeetingRow>
            columns={kanbanColumns}
            itemsByColumn={meetingsByGroup}
            getKey={(row) => row.id}
            getCardLabel={(row) => `Open meeting for ${row.company || row.leadName || row.name || 'meeting'}`}
            onCardClick={(row) => setPreviewId(Number(row.id))}
            isSelected={(item) => sel.isSelected(item.id)}
            onToggleSelect={(item) => sel.toggle(item.id)}
            renderCard={(row) => {
              const title = row.name || row.company || row.leadName || '';
              return (
                <CardShell
                  name={title}
                  subtitle={[row.company, row.city].filter(Boolean).join(' · ') || undefined}
                  chip={<MeetingStatusBadge status={row.status} />}
                  fields={[
                    { label: 'Meeting Date', value: row.meetingDate ? formatDate(row.meetingDate) : '' },
                    { label: 'Salesperson', value: row.salesperson ?? '' },
                  ]}
                />
              );
            }}
          />
        )}

        {/* Grid view — real spreadsheet-style selectable view (EditableGrid, ALT-331).
            All columns are read-only here: meeting status is workflow-driven and owner
            changes go through the people-picker (bulk Reassign), so there's no safe
            inline writer to wire. */}
        {view === 'grid' && !loading && !loadError && (() => {
          const gridRows = rowsOnPage.map((r) => r.original);
          const visibleIds = gridRows.map((r) => r.id);
          const selCount = visibleIds.filter((id) => sel.isSelected(id)).length;
          const selectAllState: 'none' | 'some' | 'all' =
            selCount === 0 ? 'none' : selCount === visibleIds.length ? 'all' : 'some';
          return (
            <EditableGrid<MeetingRow>
              rows={gridRows}
              getKey={(r) => r.id}
              columns={EDITABLE_COLUMNS}
              isSelected={(r) => sel.isSelected(r.id)}
              onToggleSelect={(r) => sel.toggle(r.id)}
              selectAllState={selectAllState}
              onToggleSelectAll={() => sel.toggleAll(visibleIds)}
              onOpenRow={(r) => setPreviewId(Number(r.id))}
              emptyLabel="No meetings match."
            />
          );
        })()}

        {/* Table */}
        {(view === 'table' || loading || loadError) && (
        <div
          className="overflow-hidden"
          style={{
            borderRadius: 'var(--radius-card)',
            boxShadow: 'var(--shadow-sm)',
            background: 'var(--color-surface)',
            border: '1px solid var(--border-color)',
          }}
        >
          <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}>
            <table className="w-full">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
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
                        className="px-4 py-2.5 text-left whitespace-nowrap select-none"
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--color-gray-500)',
                          cursor: canSort ? 'pointer' : 'default',
                          position: 'sticky',
                          top: 0,
                          ...(header.column.getIsPinned() === 'left'
                            ? { left: header.column.getStart('left'), zIndex: 3 }
                            : { zIndex: 2 }),
                          background: 'var(--color-surface-alt)',
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
                              asc: <ChevronUp size={11} />,
                              desc: <ChevronDown size={11} />,
                            }[sortDir as string] ?? (
                              <ChevronsUpDown size={11} style={{ color: '#9CA3AF' }} />
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
                    <tr key={`sk-${r}`} style={{ height: 40 }}>
                      {columns.map((_c, c) => (
                        <td key={c} className="px-4 align-middle" style={{ borderBottom: '1px solid var(--color-surface-inset)' }}>
                          <Skeleton height={12} width={c === 0 ? 16 : `${48 + ((r + c) % 4) * 12}%`} radius={4} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : loadError ? (
                  // Error state with Retry (ALT-215 #12).
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-10 text-center" style={{ borderBottom: '1px solid var(--color-surface-inset)' }}>
                      <div className="flex flex-col items-center justify-center gap-3" style={{ fontSize: 13 }}>
                        <AlertCircle size={22} className="text-red-400" />
                        <span className="text-stone-600">{loadError}</span>
                        <button
                          type="button"
                          onClick={() => setReloadKey((k) => k + 1)}
                          className="inline-flex items-center gap-1.5"
                          style={{
                            fontSize: 13, fontWeight: 500, color: '#1A7EE8',
                            border: '1px solid #d4d4d8', borderRadius: 6,
                            background: '#fff', padding: '6px 14px', cursor: 'pointer',
                          }}
                        >
                          <RefreshCw size={13} /> Retry
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : rowsOnPage.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-6" style={{ borderBottom: '1px solid var(--color-surface-inset)' }}>
                      {hasActiveFilters ? (
                        <EmptyState
                          icon={<CalendarDays size={22} strokeWidth={1.5} />}
                          title="No meetings match these filters"
                          message="Try widening or clearing the filters above to see more meetings."
                          action={{ label: 'Clear filters', onClick: clearFilters }}
                        />
                      ) : (
                        <EmptyState
                          icon={<CalendarDays size={22} strokeWidth={1.5} />}
                          title="No meetings yet"
                          message="Meetings booked from leads will show up here."
                        />
                      )}
                    </td>
                  </tr>
                ) : (
                  rowsOnPage.map((row) => {
                    const isSelected = sel.isSelected(row.original.id);
                    return (
                      <tr
                        key={row.id}
                        role="link"
                        tabIndex={0}
                        data-rowid={row.original.id}
                        aria-label={`Open meeting for ${row.original.company || row.original.leadName || row.original.name || 'meeting'}`}
                        onClick={() => setPreviewId(Number(row.original.id))}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                            e.preventDefault();
                            setPreviewId(Number(row.original.id));
                          }
                        }}
                        className="last:border-0 cursor-pointer hover:[background:var(--color-surface-hover)]"
                        style={{
                          height: densityMetrics.rowHeight,
                          transition: 'background 0.1s, height 0.15s ease',
                          background: isSelected ? 'var(--color-brand-subtle)' : undefined,
                          boxShadow: keyNav.focusedId === row.original.id ? 'inset 3px 0 0 0 var(--color-brand, #1A7EE8)' : undefined,
                        }}
                      >
                        {row.getVisibleCells().map((cell) => {
                          const isPinnedLeft = cell.column.getIsPinned() === 'left';
                          return (
                            <td
                              key={cell.id}
                              className="align-middle whitespace-nowrap"
                              style={{
                                color: 'var(--color-gray-900)',
                                borderBottom: '1px solid var(--color-surface-inset)',
                                padding: `${densityMetrics.cellPaddingY}px 16px`,
                                ...(densityMetrics.fontSize ? { fontSize: densityMetrics.fontSize } : null),
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
          {!loading && !loadError && filteredData.length > 0 && (
            <div className="flex items-center justify-between border-t border-stone-200 px-4 py-2.5" style={{ background: '#F9FAFB' }}>
              <p className="text-stone-500" style={{ fontSize: 12 }}>
                Showing <span className="font-medium text-stone-700">{firstRow}</span>–
                <span className="font-medium text-stone-700">{lastRow}</span> of{' '}
                <span className="font-medium text-stone-700">{filteredData.length}</span>
              </p>
              <div className="flex items-center gap-2">
                <span className="text-stone-500" style={{ fontSize: 12 }}>
                  Page {pageIndex + 1} of {pageCount}
                </span>
                <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="flex items-center justify-center border border-stone-300 hover:border-stone-400 bg-white text-stone-600 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ width: 28, height: 28 }}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="flex items-center justify-center border border-stone-300 hover:border-stone-400 bg-white text-stone-600 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ width: 28, height: 28 }}
                  aria-label="Next page"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Grid-view pagination footer (table view has its own footer above) */}
        {view === 'grid' && !loading && !loadError && filteredData.length > 0 && (
          <div className="flex items-center justify-between border border-stone-200 rounded-lg px-4 py-2.5" style={{ background: '#F9FAFB' }}>
            <p className="text-stone-500" style={{ fontSize: 12 }}>
              Showing <span className="font-medium text-stone-700">{firstRow}</span>–
              <span className="font-medium text-stone-700">{lastRow}</span> of{' '}
              <span className="font-medium text-stone-700">{filteredData.length}</span>
            </p>
            <div className="flex items-center gap-2">
              <span className="text-stone-500" style={{ fontSize: 12 }}>Page {pageIndex + 1} of {pageCount}</span>
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="flex items-center justify-center border border-stone-300 hover:border-stone-400 bg-white text-stone-600 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ width: 28, height: 28 }}
                aria-label="Previous page"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="flex items-center justify-center border border-stone-300 hover:border-stone-400 bg-white text-stone-600 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ width: 28, height: 28 }}
                aria-label="Next page"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Row/card-click preview slide-over (ALT-327/328) */}
      {previewId != null && (
        <RecordPreviewPanel
          title="Meeting"
          onClose={() => setPreviewId(null)}
          openFullHref={`${meetingBase}/${previewId}`}
        >
          <MeetingPreview meetingId={previewId} />
        </RecordPreviewPanel>
      )}

      {showReassign && (
        <BulkReassignModal
          entityLabel="Meeting"
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

export default MeetingsPage;
