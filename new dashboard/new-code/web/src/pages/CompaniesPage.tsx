import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { pageTransition, pageTransitionConfig } from '../lib/zenAnimations';
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
import { AppShell } from '../components/layout/AppShell';
import { fetchCompanies, type Company } from '../data/companies';
import { useAuth } from '../contexts/AuthContext';
import { useProjectScope } from '../contexts/ProjectContext';
import { supabase } from '../lib/supabase';
import { humanizeWriteError } from '../lib/writeError';
import { useRowSelection } from '../components/ui/useRowSelection';
import { useListKeyboardNav } from '../components/ui/useListKeyboardNav';
import { ExportButton } from '../components/ui/ExportButton';
import { DuplicatesButton } from '../components/ui/DuplicatesButton';
import { MultiSelectFilter } from '../components/ui/MultiSelectFilter';
import { ColumnCustomizer, defaultColumnPrefs, reconcileColumns } from '../components/ui/ColumnCustomizer';
import { ViewSwitcher, useViewMode } from '../components/ui/ViewSwitcher';
import { DensityToggle } from '../components/ui/DensityToggle';
import { useDensity, getDensityMetrics } from '../components/ui/useDensity';
import { CardShell } from '../components/ui/CardGrid';
import { ListToolbar } from '../components/ui/ListToolbar';
import { ActiveFilters, type FilterChip } from '../components/ui/ActiveFilters';
import { SelectAllMatchingBar } from '../components/ui/SelectAllMatchingBar';
import { useListFilters } from '../lib/listFilters';
import { useSortPersistence } from '../lib/useSortPersistence';
import { HUNGERBOX_FEATURES } from '../lib/hungerbox';
import { isForeignRecord, foreignRowStyle } from '../lib/safeView';
import { ADVANCED_FILTERS, COMPANIES_FIELDS, EMPTY_FILTER_STATE, evalFilterState, type AdvancedFilterState } from '../lib/filterEngine';
import { FilterBuilderButton, FilterBuilderPanel } from '../components/filters/FilterBuilder';
import { ViewPicker } from '../components/filters/ViewPicker';
import type { SavedViewRecord } from '../data/savedViews';
import { usePinPersistence } from '../lib/usePinPersistence';
import { EditableGrid, type EditableColumn } from '../components/ui/EditableGrid';
import { GenericKanban } from '../components/kanban/GenericKanban';
import {
  KanbanGroupBySelect,
  buildKanbanGrouping,
  type KanbanGroupDef,
} from '../components/kanban/KanbanGroupBySelect';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ProjectSelect } from '../components/ui/ProjectSelect';
import { Skeleton } from '../components/ui/Skeleton';
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
  Plus,
  RefreshCw,
  AlertCircle,
  UserCheck,
  FolderPlus,
  Tag,
  Building2,
} from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { BulkReassignModal } from '../components/common/ReassignModal';
import { reassignCompaniesBulk, fetchAssignableUsers } from '../data/assignment';
import { distributeRecords } from '../data/bulkActions';
import { fetchOptions, type DropdownOption } from '../data/dropdowns';
import { BulkProjectModal } from '../components/common/BulkProjectModal';
import { BulkStatusModal } from '../components/common/BulkStatusModal';
import { addCompaniesToProject, setCompaniesStatus } from '../data/bulkActions';
import { upsertCompanyStatus } from '../data/projectStatus';
import type { UserOption } from '../data/wishlist';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { RecordPreviewPanel } from '../components/common/RecordPreviewPanel';
import { CompanyPreview } from '../components/companies/CompanyPreview';
import { InlineAccountStatusCell } from '../components/companies/InlineAccountStatusCell';

// TODO visibility: per-project status/notes are owner + admin only (security pass).

const columnHelper = createColumnHelper<Company>();

/* ------------------------------------------------------------------
   Company avatar — initials in a brand-tinted circle (matches Leads list)
------------------------------------------------------------------ */
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

/** Grey "DEMO" tag for is_demo rows. */
function DemoTag() {
  return (
    <span
      style={{
        background: '#F3F4F6',
        color: '#6B7280',
        fontSize: 10,
        fontWeight: 600,
        borderRadius: 4,
        padding: '1px 6px',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        lineHeight: '16px',
      }}
    >
      Demo
    </span>
  );
}

interface Filters {
  search: string;
  industry: string[]; // multi-value (OR; empty = all)
  city: string[];     // multi-value (OR; empty = all)
  /** HungerBox: filter to Tier-1 metro cities only ('metro' | '' = all). */
  metroOnly: string;
}

const defaultFilters: Filters = { search: '', industry: [], city: [], metroOnly: '' };

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


const PAGE_SIZE_OPTIONS = [25, 50, 100];

function fullUrl(webUrl: string): string {
  if (!webUrl) return '';
  return /^https?:\/\//.test(webUrl) ? webUrl : `https://${webUrl}`;
}

/* ------------------------------------------------------------------
   Lightweight company status shape for the list (batch-fetched per page).
------------------------------------------------------------------ */
interface CompanyStatusLite {
  account_status: string | null;
  owner_user_id: number | null;
  // Resolved per-project owner display name (null = truly unassigned).
  owner_name: string | null;
}

/**
 * Batch-fetch account statuses + per-project owner for an array of company_ids
 * within one project. Owner ids are resolved to display names in a single
 * user_master lookup (not N round-trips), then attached to each row.
 */
async function fetchCompanyStatuses(
  projectId: number,
  companyIds: number[],
): Promise<Record<number, CompanyStatusLite>> {
  const out: Record<number, CompanyStatusLite> = {};
  if (!projectId || companyIds.length === 0) return out;
  const CHUNK = 200;
  type Row = { company_id: number; account_status: string | null; owner_user_id: number | null };
  const rows: Row[] = [];
  for (let i = 0; i < companyIds.length; i += CHUNK) {
    const slice = companyIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('company_project_status')
      .select('company_id, account_status, owner_user_id')
      .eq('project_id', projectId)
      .in('company_id', slice);
    if (error) {
      console.error('[CompaniesPage] fetchCompanyStatuses error', error);
      continue;
    }
    rows.push(...((data ?? []) as Row[]));
  }

  // Resolve all distinct owner ids → full_name in one query.
  const ownerIds = [...new Set(rows.map((r) => r.owner_user_id).filter((id): id is number => id != null))];
  const nameById = new Map<number, string>();
  if (ownerIds.length > 0) {
    const { data: users } = await supabase
      .from('user_master')
      .select('user_id, full_name')
      .in('user_id', ownerIds);
    for (const u of (users ?? []) as { user_id: number; full_name: string | null }[]) {
      nameById.set(u.user_id, (u.full_name ?? '').trim() || `User #${u.user_id}`);
    }
  }

  for (const row of rows) {
    out[row.company_id] = {
      account_status: row.account_status ?? null,
      owner_user_id: row.owner_user_id ?? null,
      owner_name: row.owner_user_id != null ? (nameById.get(row.owner_user_id) ?? `User #${row.owner_user_id}`) : null,
    };
  }
  return out;
}

/**
 * Map each company to the DISTINCT project ids it has a per-project status row in
 * (company_project_status). Used to AUTO-RESOLVE the inline status edit when no
 * global project is scoped (AMBIG E1): a company with exactly one project resolves
 * to it, so single-project agents never hit the "select a project" wall. Chunked
 * like fetchCompanyStatuses to stay under PostgREST limits.
 */
async function fetchCompanyProjects(companyIds: number[]): Promise<Record<number, number[]>> {
  const out: Record<number, number[]> = {};
  if (companyIds.length === 0) return out;
  const CHUNK = 200;
  for (let i = 0; i < companyIds.length; i += CHUNK) {
    const slice = companyIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('company_project_status')
      .select('company_id, project_id')
      .in('company_id', slice);
    if (error) {
      console.error('[CompaniesPage] fetchCompanyProjects error', error);
      continue;
    }
    for (const row of (data ?? []) as { company_id: number; project_id: number }[]) {
      const list = out[row.company_id] ?? (out[row.company_id] = []);
      if (!list.includes(row.project_id)) list.push(row.project_id);
    }
  }
  return out;
}

/* ------------------------------------------------------------------
   Column catalogue — drives ColumnCustomizer + ExportButton.
   Keys must be stable; they are persisted in user_view_pref.
------------------------------------------------------------------ */
// ColDef used without a Row generic here — only key/header/defaultVisible are needed.
const ALL_COLUMNS: ColDef[] = [
  { key: 'name',          header: 'Company',        defaultVisible: true },
  { key: 'domainClean',   header: 'Domain',          defaultVisible: true },
  { key: 'industry',      header: 'Industry',        defaultVisible: true },
  { key: 'city',          header: 'City',            defaultVisible: true },
  { key: 'cin',           header: 'CIN',             defaultVisible: true },
  { key: 'owner',         header: 'Owner',           defaultVisible: true },
  { key: 'accountStatus', header: 'Account Status',  defaultVisible: true },
];

type ExportRow = Company & { accountStatus: string | null };

const EXPORT_COLUMNS: ExportColumn<ExportRow>[] = [
  { key: 'name',          header: 'Company' },
  { key: 'domainClean',   header: 'Domain' },
  { key: 'webUrl',        header: 'Website' },
  { key: 'industry',      header: 'Industry' },
  { key: 'city',          header: 'City' },
  { key: 'cin',           header: 'CIN' },
  { key: 'size',          header: 'Size',           accessor: (r) => r.size ?? '' },
  { key: 'email',         header: 'Email' },
  { key: 'linkedin',      header: 'LinkedIn' },
  { key: 'owner',         header: 'Owner' },
  { key: 'accountStatus', header: 'Account Status', accessor: (r) => r.accountStatus ?? '' },
  { key: 'isDemo',        header: 'Demo',           accessor: (r) => (r.isDemo ? 'Yes' : 'No') },
];

export function CompaniesPage() {
  const navigate = useNavigate();
  const { profile, canCreateData, canReassign, isAdmin, isTeamLead, isQC } = useAuth();
  const userId = profile?.user_id ?? null;
  // actorId is the numeric user_id as text for audit columns / status writes.
  const actorId = userId != null ? String(userId) : null;
  // SAFE_VIEW: admin / TL / QC always see everything.
  const safeViewExempt = isAdmin || isTeamLead || isQC;
  const toast = useToast();
  const confirm = useConfirm();

  // Persisted across refresh per browser (ALT-369).
  const [filters, setFilters] = useListFilters<Filters>('companies', defaultFilters);
  // Advanced filter state (ALT-270) — only used when ADVANCED_FILTERS is on.
  const [advFilters, setAdvFilters] = useState<AdvancedFilterState>(EMPTY_FILTER_STATE);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [activeViewId, setActiveViewId] = useState<number | null>(null);
  // Persisted sort state (ALT-440) — mirrors density key convention: altleads:sort:<entity>:<userId>.
  const [sorting, setSorting] = useSortPersistence('companies', userId);
  // Persisted column pinning (ALT-440) — key: altleads:pin:companies:<userId>.
  const [columnPinning, setColumnPinning] = usePinPersistence('companies', userId);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 });

  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Bump to re-run the load effect (Retry on error). ALT-215 #12.
  const [reloadKey, setReloadKey] = useState(0);

  // Project selection drives the per-project Account Status column. Companies are
  // cross-project entities (no project_id on the row), so we don't row-filter by
  // project — but this local picker is SEEDED + KEPT IN SYNC with the global project
  // switcher so a multi-project user sees one consistent project rather than two
  // competing controls (review ALT-273B M9). May still be overridden locally.
  const { selectedProjectId, projects } = useProjectScope();
  const [projectId, setProjectId] = useState<number | null>(selectedProjectId);

  // Bulk reassign (ALT-291) — per-project owner_user_id for the selected companies.
  const [showReassign, setShowReassign] = useState(false);
  const [reassignSaving, setReassignSaving] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [reassignOwners, setReassignOwners] = useState<UserOption[]>([]);

  // Bulk add-to-project (ALT-291) — enroll selected companies into a project.
  const [showAddProject, setShowAddProject] = useState(false);
  const [addProjectSaving, setAddProjectSaving] = useState(false);
  const [addProjectError, setAddProjectError] = useState<string | null>(null);

  // Bulk set-status (Step E) — set account_status on selected companies (per-project).
  const [showSetStatus, setShowSetStatus] = useState(false);
  const [setStatusSaving, setSetStatusSaving] = useState(false);
  const [setStatusError, setSetStatusError] = useState<string | null>(null);

  // Shared bulk progress + cancel (ALT-413) — live "N of M" bar across the bulk modals.
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const bulkAbort = useRef<AbortController | null>(null);

  const openBulkReassign = async () => {
    setReassignError(null);
    setReassignOwners([]);
    setShowReassign(true);
    setReassignOwners(await fetchAssignableUsers(null));
  };
  const handleBulkReassign = async (ownerIds: number[], maxPerCompany?: number) => {
    if (projectId == null) { setReassignError('Select a project first (top-bar selector).'); return; }
    const ids = [...sel.selectedIds].map(Number).filter((n) => !isNaN(n));
    const actor = profile?.user_id != null ? String(profile.user_id) : '';
    const records = ids.map((id) => ({ id, companyKey: id }));
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
      for (const [ownerId, companyIds] of slices) {
        if (ac.signal.aborted) break;
        if (companyIds.length === 0) continue;
        const res = await reassignCompaniesBulk(companyIds, projectId, ownerId, actor, {
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
    if (totalOk === 0 && (firstErr || totalFailed > 0)) {
      setReassignError(humanizeWriteError(firstErr ?? `${totalFailed} could not be reassigned.`));
      return;
    }
    setShowReassign(false);
    sel.clear();
    // Refresh the per-project owner/status for the reassigned rows so the Owner
    // column reflects the new owner immediately (don't wait for a project switch /
    // reload). Reuses the same fetch the project effect uses.
    loadStatuses(projectId, ids);
    toast.success(
      totalFailed > 0
        ? `Reassigned ${totalOk}; ${totalFailed} skipped (no permission).`
        : `Reassigned ${totalOk} compan${totalOk === 1 ? 'y' : 'ies'} — the new owner(s) were notified.`,
    );
  };
  const handleAddToProject = async (targetProjectId: number) => {
    const ids = [...sel.selectedIds].map(Number).filter((n) => !isNaN(n));
    setAddProjectSaving(true);
    setAddProjectError(null);
    const ac = new AbortController();
    bulkAbort.current = ac;
    setBulkProgress({ done: 0, total: ids.length });
    let res;
    try {
      res = await addCompaniesToProject(ids, targetProjectId, profile?.user_id != null ? String(profile.user_id) : '', {
        signal: ac.signal,
        onProgress: (done, total) => setBulkProgress({ done, total }),
      });
    } finally {
      setAddProjectSaving(false);
      setBulkProgress(null);
      bulkAbort.current = null;
    }
    if (res.ok === 0 && res.error) { setAddProjectError(humanizeWriteError(res.error)); return; }
    setShowAddProject(false);
    sel.clear();
    toast.success(
      res.failed > 0
        ? `Added ${res.ok}; ${res.failed} skipped (no permission).`
        : `Added ${res.ok} compan${res.ok === 1 ? 'y' : 'ies'} to the project.`,
    );
  };
  const handleSetStatus = async (status: string) => {
    if (projectId == null) { setSetStatusError('Select a project first.'); return; }
    const ids = [...sel.selectedIds].map(Number).filter((n) => !isNaN(n));
    setSetStatusSaving(true);
    setSetStatusError(null);
    const ac = new AbortController();
    bulkAbort.current = ac;
    setBulkProgress({ done: 0, total: ids.length });
    let res;
    try {
      res = await setCompaniesStatus(ids, projectId, status, actorId ?? '', {
        signal: ac.signal,
        onProgress: (done, total) => setBulkProgress({ done, total }),
      });
    } finally {
      setSetStatusSaving(false);
      setBulkProgress(null);
      bulkAbort.current = null;
    }
    if (res.ok === 0 && res.error) { setSetStatusError(humanizeWriteError(res.error)); return; }
    setShowSetStatus(false);
    sel.clear();
    // Refresh statuses for the affected rows so the new status shows immediately.
    loadStatuses(projectId, ids);
    toast.success(
      res.failed > 0
        ? `Updated ${res.ok}; ${res.failed} skipped (no permission).`
        : `Set status on ${res.ok} compan${res.ok === 1 ? 'y' : 'ies'}.`,
    );
  };
  useEffect(() => { setProjectId(selectedProjectId); }, [selectedProjectId]);

  // Per-project statuses keyed by numeric company_id.
  const [statusMap, setStatusMap] = useState<Record<number, CompanyStatusLite>>({});
  const [statusLoading, setStatusLoading] = useState(false);
  // Monotonic request id for loadStatuses: a fast project switch bumps this so a
  // slower in-flight fetch (project A) can't land its owners under project B
  // (mirrors ContactsPage's owner-effect `cancelled` guard).
  const statusReqRef = useRef(0);
  // account_status dropdown options (for the inline-editable status cell).
  const [statusOptions, setStatusOptions] = useState<DropdownOption[]>([]);

  // Per-company project membership (company_id -> distinct project ids). Only
  // loaded when NO global project is scoped, to auto-resolve the inline status
  // edit for single-project records (AMBIG E1). Empty/absent when a global
  // project is selected (the global scope is used directly).
  const [companyProjects, setCompanyProjects] = useState<Record<number, number[]>>({});

  // Inline status update — only called after a successful write; preserves the
  // already-resolved owner fields for the row.
  const handleStatusUpdated = useCallback((companyId: number, newStatus: string | null) => {
    setStatusMap((prev) => ({
      ...prev,
      [companyId]: {
        account_status: newStatus,
        owner_user_id: prev[companyId]?.owner_user_id ?? null,
        owner_name: prev[companyId]?.owner_name ?? null,
      },
    }));
  }, []);

  // Column prefs driven by ColumnCustomizer.
  const [columnPrefs, setColumnPrefs] = useState<ColumnPref[]>(() => defaultColumnPrefs(ALL_COLUMNS));

  // Row selection.
  const sel = useRowSelection<string>();
  const searchRef = useRef<HTMLInputElement>(null);

  // Table / Grid view (persisted per user + entity in localStorage).
  const [view, setView] = useViewMode('companies', userId);
  // Row density (Comfortable / Compact) — persisted per user + entity. Applies to
  // the TABLE view only; comfortable keeps today's 44px rows exactly (ALT density win).
  const [density, setDensity] = useDensity('companies', userId);
  const densityMetrics = getDensityMetrics(density);
  // Kanban "Group by" field (ALT-338) — default = account status (the original fixed field).
  const [kanbanGroupBy, setKanbanGroupBy] = useState<string>('account_status');

  // Row-click preview slide-over (ALT-327/328). Opening the panel replaces the
  // old navigate-away behaviour; the full detail page stays reachable via the
  // panel's "Open full record →" action.
  const [previewId, setPreviewId] = useState<number | null>(null);

  /* ---- load companies ---- */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchCompanies().then((result) => {
      if (cancelled) return;
      setAllCompanies(result.companies);
      setIndustries(result.industries);
      setCities(result.cities);
      setLoadError(result.error);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [reloadKey]);

  // Load account_status dropdown options once (for the inline status cell).
  useEffect(() => {
    fetchOptions('account_status').then(setStatusOptions);
  }, []);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    sel.clear();
  };

  const hasActiveFilters = Object.values(filters).some((v) =>
    Array.isArray(v) ? v.length > 0 : v !== '',
  );

  /* ---- active-filter chips (ALT delight) ----
     One chip per selected value for each multi-select facet (Industry, City);
     free-text search is excluded (it has its own clear button). Removing a chip
     drops just that value; "Clear all" resets all filters. */
  const filterChips = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    for (const value of filters.industry) {
      chips.push({
        key: `industry:${value}`,
        label: `Industry: ${value}`,
        onRemove: () => setFilter('industry', filters.industry.filter((x) => x !== value)),
      });
    }
    for (const value of filters.city) {
      chips.push({
        key: `city:${value}`,
        label: `City: ${value}`,
        onRemove: () => setFilter('city', filters.city.filter((x) => x !== value)),
      });
    }
    if (HUNGERBOX_FEATURES && filters.metroOnly === 'metro') {
      chips.push({
        key: 'metroOnly:metro',
        label: 'Metro cities only',
        onRemove: () => setFilter('metroOnly', ''),
      });
    }
    return chips;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const filteredData = useMemo(() => {
    return allCompanies.filter((c) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const searchable = [c.name, c.domainClean, c.cin, c.industry, c.city, c.email]
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      if (filters.industry.length && !filters.industry.includes(c.industry)) return false;
      if (filters.city.length && !filters.city.includes(c.city)) return false;
      // HungerBox: metro-only work queue filter (only active when HUNGERBOX_FEATURES=true)
      if (HUNGERBOX_FEATURES && filters.metroOnly === 'metro' && !c.isMetro) return false;
      // Advanced filter evaluation (ALT-270)
      if (ADVANCED_FILTERS && advFilters.groups.length > 0) {
        if (!evalFilterState(c as unknown as Record<string, unknown>, advFilters)) return false;
      }
      return true;
    });
  }, [filters, advFilters, allCompanies]);

  /* ---- on-demand export rows (ALT-429) ----
     statusMap is kept in sync with the full filtered set whenever a project is
     selected (see the effect below), so by export time the map is already complete.
     When no project is selected, account_status / owner are per-project and therefore
     N/A for the export (they'd be blank anyway). */
  const getExportRows = useCallback(async (): Promise<ExportRow[] | null> => {
    // ALT-450: warn when no project is selected — Account Status and Owner are
    // per-project and will be blank in the export without a selected project.
    if (projectId == null) {
      const proceed = await confirm({
        title: 'No project selected',
        message: 'Account Status and Owner are per-project fields and will be blank in this export because no project is currently selected. Export anyway?',
        confirmLabel: 'Export anyway',
        cancelLabel: 'Cancel',
        tone: 'default',
      });
      if (!proceed) return null;
    }
    // statusMap already covers the full filtered set — just map directly.
    return filteredData.map((c) => ({
      ...c,
      accountStatus: statusMap[Number(c.id)]?.account_status ?? null,
    }));
  }, [filteredData, projectId, statusMap, confirm]);

  /* ---- ALT-429: batch-load statuses for the FULL filtered set (not just the current page)
     so sort/filter/export on Account Status and Owner columns are correct across all pages.
     Mirrors ContactsPage's approach: load all ids up-front when project or filteredData
     changes; merge new results into the map so stale entries from prior filters aren't
     evicted unnecessarily. */

  // All company ids in the current filtered result set.
  const filteredCompanyIds = useMemo(
    () => filteredData.map((c) => Number(c.id)),
    [filteredData],
  );

  // Page-visible ids only — used for the AMBIG E1 no-project company-projects loader
  // below. We intentionally keep that one page-scoped to avoid fetching project
  // membership for all 10k companies when no global project is selected.
  const pageCompanyIds = useMemo(() => {
    const start = pagination.pageIndex * pagination.pageSize;
    const end = start + pagination.pageSize;
    return filteredData.slice(start, end).map((c) => Number(c.id));
  }, [filteredData, pagination.pageIndex, pagination.pageSize]);

  const loadStatuses = useCallback(async (pid: number, ids: number[]) => {
    if (!pid || ids.length === 0) return;
    // Take a token for this request; a newer call (e.g. project switch) bumps the
    // ref, so when this fetch resolves we drop its result if it's no longer current.
    const reqId = ++statusReqRef.current;
    setStatusLoading(true);
    const result = await fetchCompanyStatuses(pid, ids);
    if (reqId !== statusReqRef.current) return; // stale — a newer load superseded us
    setStatusMap((prev) => ({ ...prev, ...result }));
    setStatusLoading(false);
  }, []);

  // When project changes, clear the per-project cache and reload for the FULL
  // filtered set so every row's status is known from the start.
  useEffect(() => {
    if (projectId == null) return;
    setStatusMap({});
    loadStatuses(projectId, filteredCompanyIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // When the filtered set changes (filter/search change), load statuses for any
  // ids that aren't yet in the map (newly visible rows after a filter).
  useEffect(() => {
    if (projectId == null) return;
    const missing = filteredCompanyIds.filter((id) => !(id in statusMap));
    if (missing.length > 0) {
      loadStatuses(projectId, missing);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, filteredCompanyIds]);

  // No global project scoped → load each VISIBLE PAGE company's project membership
  // so a single-project company can auto-resolve its inline status edit (AMBIG E1).
  // Kept page-scoped intentionally: fetching all 10k companies' project membership
  // when no project is selected would be expensive and provides no benefit.
  useEffect(() => {
    if (projectId != null) { setCompanyProjects({}); return; }
    if (pageCompanyIds.length === 0) return;
    let cancelled = false;
    const missing = pageCompanyIds.filter((id) => !(id in companyProjects));
    if (missing.length === 0) return;
    void (async () => {
      const projMap = await fetchCompanyProjects(missing);
      if (cancelled) return;
      setCompanyProjects((prev) => ({ ...prev, ...projMap }));
      // For companies resolving to exactly one project, batch their status by
      // project so the cell renders the right badge. Group ids per project id.
      const byProject = new Map<number, number[]>();
      for (const id of missing) {
        const list = projMap[id];
        if (list && list.length === 1) {
          const arr = byProject.get(list[0]) ?? [];
          arr.push(id);
          byProject.set(list[0], arr);
        }
      }
      for (const [pid, ids] of byProject) {
        const result = await fetchCompanyStatuses(pid, ids);
        if (cancelled) return;
        setStatusMap((prev) => ({ ...prev, ...result }));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, pageCompanyIds]);

  /**
   * Resolve the project the inline status edit should write to for a company
   * (AMBIG E1): the global scope when set; else the company's sole project when it
   * belongs to exactly one; else null (genuinely ambiguous → cell stays read-only).
   */
  const resolveProjectFor = useCallback(
    (numId: number): number | null => {
      if (projectId != null) return projectId;
      const list = companyProjects[numId];
      return list && list.length === 1 ? list[0] : null;
    },
    [projectId, companyProjects],
  );

  /* ---- Kanban (Board) view ----
     Companies' status is PER PROJECT (company_project_status.account_status), so
     the board is only meaningful with a project selected. When none is selected
     the page shows a gentle inline note instead of a wrong/empty board. Columns
     are built from the known account_status options (+ an "Unset" bucket for
     blanks); cards open the same preview drawer the row uses.

     Statuses for the full filtered set are kept in sync by the filteredCompanyIds
     effect below, so by the time the board renders the map is already populated.
     This effect is retained as a safety net for any ids that might still be missing
     (e.g. rapid view-switch before the main effect fires). */
  useEffect(() => {
    if (view !== 'kanban' || projectId == null) return;
    const ids = filteredData.map((c) => Number(c.id)).filter((id) => !(id in statusMap));
    if (ids.length > 0) loadStatuses(projectId, ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, projectId, filteredData]);

  // Selectable "Group by" field (ALT-338). Default = Account Status (per-project:
  // its lanes come from the canonical account_status options + an "Unset" bucket,
  // and it's gated on a selected project). Owner is ALSO per-project (read from
  // statusMap). Industry / City live on the Company row, so they group without a
  // project. (Disposition grouping needs latest-call data not on the row → skip.)
  const kanbanGroupOptions = useMemo<KanbanGroupDef<Company>[]>(() => [
    {
      key: 'account_status',
      label: 'Status',
      getGroup: (c) => statusMap[Number(c.id)]?.account_status ?? null,
      lanes: statusOptions.map((o) => ({ key: o.value, label: o.label })),
    },
    { key: 'industry', label: 'Industry', getGroup: (c) => c.industry || null },
    { key: 'city', label: 'City', getGroup: (c) => c.city || null },
    { key: 'owner_name', label: 'Owner', getGroup: (c) => statusMap[Number(c.id)]?.owner_name || null },
  ], [statusOptions, statusMap]);

  // Status / Owner grouping is per-project (gated on a project); Industry / City
  // group without one.
  const kanbanNeedsProject = kanbanGroupBy === 'account_status' || kanbanGroupBy === 'owner_name';

  const { columns: kanbanColumns, itemsByColumn: companiesByGroup } = useMemo(() => {
    const group = kanbanGroupOptions.find((o) => o.key === kanbanGroupBy) ?? kanbanGroupOptions[0];
    return buildKanbanGrouping<Company>(filteredData, group, 'Unset');
  }, [filteredData, kanbanGroupOptions, kanbanGroupBy]);

  // Keep the kanban "Group by" selection valid: if the selected field is no longer
  // in the current options, reset to the first option so the <select> value can't
  // desync from the rendered board (e.g. project cleared while grouped by Owner).
  useEffect(() => {
    if (!kanbanGroupOptions.some((o) => o.key === kanbanGroupBy)) {
      setKanbanGroupBy(kanbanGroupOptions[0].key);
    }
  }, [kanbanGroupOptions, kanbanGroupBy]);

  /* ---- visible column keys (from prefs) ---- */
  const visibleKeys = useMemo(
    () => new Set(columnPrefs.filter((p) => p.visible).map((p) => p.key)),
    [columnPrefs],
  );

  /* ---- export columns: never leak a column the user has hidden in the
     customizer. Keys present in the column catalogue must be visible to be
     exported; export-only extras (Website/Email/LinkedIn/Size/Demo) that are
     not customizer-controlled are always included. ---- */
  const customizerKeys = useMemo(() => new Set(ALL_COLUMNS.map((c) => c.key)), []);
  const activeExportColumns = useMemo<ExportColumn<ExportRow>[]>(
    () =>
      EXPORT_COLUMNS.filter(
        (c) => !customizerKeys.has(c.key) || visibleKeys.has(c.key),
      ),
    [visibleKeys, customizerKeys],
  );

  /* ---- TanStack columns (filtered by prefs) ---- */
  const columns = useMemo(() => {
    const all = [
      // Checkbox column — always first, not managed by prefs.
      columnHelper.display({
        id: '__select',
        header: ({ table: t }) => {
          const pageRows = t.getRowModel().rows;
          const pageIds = pageRows.map((r) => r.original.id);
          const allSel = sel.allSelected(pageIds);
          return (
            <input
              type="checkbox"
              aria-label={allSel ? 'Deselect all companies on this page' : 'Select all companies on this page'}
              checked={allSel}
              onChange={() => sel.toggleAll(pageIds)}
              style={{ cursor: 'pointer' }}
              onClick={(e) => e.stopPropagation()}
            />
          );
        },
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={`Select ${row.original.name || 'company'}`}
            checked={sel.isSelected(row.original.id)}
            onChange={() => sel.toggle(row.original.id)}
            style={{ cursor: 'pointer' }}
            onClick={(e) => e.stopPropagation()}
          />
        ),
        size: 40,
        enableSorting: false,
      }),
      columnHelper.accessor('name', {
        id: 'name',
        header: 'Company',
        cell: (info) => {
          const name = info.getValue() ?? '';
          const row = info.row.original;
          return (
            <div className="flex items-center gap-2.5">
              <CompanyAvatar name={name} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-medium text-stone-900 truncate" style={{ fontSize: 13, maxWidth: 220 }} title={name || undefined}>
                    {name || <span className="text-stone-400">—</span>}
                  </p>
                  {row.isDemo && <DemoTag />}
                </div>
                {row.city && (
                  <p className="text-stone-400 truncate" style={{ fontSize: 11, maxWidth: 220 }} title={row.city}>{row.city}</p>
                )}
              </div>
            </div>
          );
        },
      }),
      columnHelper.accessor('domainClean', {
        id: 'domainClean',
        header: 'Domain',
        cell: (info) => {
          const domain = info.getValue() ?? '';
          const href = fullUrl(info.row.original.webUrl || domain);
          if (!domain) return <span className="text-stone-300" style={{ fontSize: 13 }}>—</span>;
          return (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              onClick={(e) => e.stopPropagation()}
              style={{ fontSize: 13, color: 'var(--color-brand)' }}
              className="hover:underline"
            >
              {domain}
            </a>
          );
        },
      }),
      columnHelper.accessor('industry', {
        id: 'industry',
        header: 'Industry',
        cell: (info) => (
          <span className="text-stone-600" style={{ fontSize: 13 }}>
            {info.getValue() || <span className="text-stone-300">—</span>}
          </span>
        ),
      }),
      columnHelper.accessor('city', {
        id: 'city',
        header: 'City',
        cell: (info) => (
          <span className="text-stone-600" style={{ fontSize: 13 }}>
            {info.getValue() || <span className="text-stone-300">—</span>}
          </span>
        ),
      }),
      columnHelper.accessor('cin', {
        id: 'cin',
        header: 'CIN',
        cell: (info) => (
          <span className="text-stone-500 font-mono" style={{ fontSize: 12 }}>
            {info.getValue() || <span className="text-stone-300 font-sans">—</span>}
          </span>
        ),
      }),
      columnHelper.accessor('owner', {
        id: 'owner',
        header: 'Owner',
        enableSorting: false,
        // Per-project owner resolved from company_project_status.owner_user_id
        // (scoped to the selected project). "Unassigned" when no project is
        // selected OR the row truly has no owner. (ALT-296 step B)
        cell: ({ row }) => {
          const numId = Number(row.original.id);
          if (projectId == null) {
            return <span className="text-stone-400" style={{ fontSize: 13 }}>Unassigned</span>;
          }
          if (statusLoading && !(numId in statusMap)) {
            return <Loader2 size={12} className="animate-spin text-stone-300" />;
          }
          const name = statusMap[numId]?.owner_name ?? null;
          return name
            ? <span className="text-stone-600" style={{ fontSize: 13 }}>{name}</span>
            : <span className="text-stone-400" style={{ fontSize: 13 }}>Unassigned</span>;
        },
      }),
      // Account Status — per-project, batch-loaded for current page.
      columnHelper.display({
        id: 'accountStatus',
        header: 'Account Status',
        enableSorting: false,
        cell: ({ row }) => {
          const numId = Number(row.original.id);
          // Resolve the edit project: global scope, else the company's sole
          // project (single-project records skip the "select a project" wall).
          const effectiveProjectId = resolveProjectFor(numId);
          if (statusLoading && !(numId in statusMap)) {
            return <Loader2 size={12} className="animate-spin text-stone-300" />;
          }
          const status = statusMap[numId]?.account_status ?? null;
          // Genuinely ambiguous only when there's no global scope AND the company
          // is in more than one project — explain why in the tooltip.
          const inMultiple = projectId == null && (companyProjects[numId]?.length ?? 0) > 1;
          return (
            <InlineAccountStatusCell
              companyId={numId}
              projectId={effectiveProjectId}
              current={status}
              options={statusOptions}
              actorId={actorId}
              blockedReason={inMultiple ? 'In multiple projects — pick one in the Project selector above' : 'Select a project first'}
              onUpdated={handleStatusUpdated}
            />
          );
        },
      }),
    ];

    // Filter out columns that are hidden via prefs (keep __select always).
    return all.filter((col) => {
      const id = col.id ?? ('accessorKey' in col ? String(col.accessorKey) : '');
      if (id === '__select') return true;
      return visibleKeys.has(id);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKeys, statusMap, statusLoading, projectId, sel, statusOptions, actorId, handleStatusUpdated, resolveProjectFor, companyProjects]);

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

  // The companies visible on the current page (drives keyboard row navigation).
  const navRows = useMemo(
    () => table.getRowModel().rows.map((r) => r.original),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table, filteredData, pagination, sorting],
  );

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

  /* ---- "Select all N matching" affordance (ALT) ----
     allMatchingIds = every id in the full filtered set; pageRowIds = the ids the
     user can actually see/select right now (current page in table/grid; all
     filtered rows in kanban, which renders the whole set). */
  const allMatchingIds = useMemo(() => filteredData.map((r) => r.id), [filteredData]);
  const pageRowIds = useMemo(
    () =>
      view === 'kanban'
        ? allMatchingIds
        : table.getRowModel().rows.map((r) => r.original.id),
    [view, allMatchingIds, table.getRowModel().rows],
  );
  const pageSelectedCount = useMemo(
    () => pageRowIds.filter((id) => sel.isSelected(id)).length,
    [pageRowIds, sel],
  );

  /* ---- EditableGrid columns (real "Grid" view, ALT-331) ----
     Mirrors the Table columns. SAFE EDITABLE SET: Account Status only — it's the
     only per-project field this page loads onto rows AND has an option list for
     (statusOptions). It saves through the SAME writer the inline status cell uses
     (upsertCompanyStatus with { account_status }). Other per-project fields
     (feasibility / decision-power / description) aren't loaded here, so they stay
     out rather than inventing new fetches/option lists. Per-project gating: the
     status cell is read-only with a tooltip until a project is selected (mirrors
     the Table's inline cell + Owner gating). The rest (name link, domain,
     industry, city, CIN, owner) are read-only. */
  const EDITABLE_COLUMNS = useMemo<EditableColumn<Company>[]>(() => {
    const statusSelectOptions = statusOptions.map((o) => ({ value: o.value, label: o.label }));
    return [
      {
        key: 'name',
        header: 'Company',
        width: 240,
        getValue: (r) => r.name ?? '',
        render: (r) => (
          <div className="flex items-center gap-2.5">
            <CompanyAvatar name={r.name || ''} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-medium text-stone-900 truncate" style={{ fontSize: 13, maxWidth: 200 }} title={r.name || undefined}>
                  {r.name || <span className="text-stone-400">—</span>}
                </p>
                {r.isDemo && <DemoTag />}
              </div>
              {r.city && (
                <p className="text-stone-400 truncate" style={{ fontSize: 11, maxWidth: 200 }} title={r.city}>{r.city}</p>
              )}
            </div>
          </div>
        ),
      },
      {
        key: 'domainClean',
        header: 'Domain',
        getValue: (r) => r.domainClean ?? '',
        render: (r) => {
          const domain = r.domainClean ?? '';
          if (!domain) return <span className="text-stone-300" style={{ fontSize: 13 }}>—</span>;
          return (
            <a
              href={fullUrl(r.webUrl || domain)}
              target="_blank"
              rel="noreferrer noopener"
              onClick={(e) => e.stopPropagation()}
              style={{ fontSize: 13, color: 'var(--color-brand)' }}
              className="hover:underline"
            >
              {domain}
            </a>
          );
        },
      },
      {
        key: 'industry',
        header: 'Industry',
        getValue: (r) => r.industry ?? '',
      },
      {
        key: 'city',
        header: 'City',
        getValue: (r) => r.city ?? '',
      },
      {
        key: 'cin',
        header: 'CIN',
        getValue: (r) => r.cin ?? '',
        render: (r) =>
          r.cin
            ? <span className="text-stone-500 font-mono" style={{ fontSize: 12 }}>{r.cin}</span>
            : <span className="text-stone-300" style={{ fontSize: 13 }}>—</span>,
      },
      {
        key: 'owner',
        header: 'Owner',
        getValue: (r) => (projectId == null ? 'Unassigned' : (statusMap[Number(r.id)]?.owner_name ?? 'Unassigned')),
        // Show a small spinner while this row's owner is still loading, instead of
        // flashing "Unassigned" before the per-project fetch resolves (mirrors the
        // Table cell's loading logic).
        render: (r) => {
          const numId = Number(r.id);
          if (projectId != null && statusLoading && !(numId in statusMap)) {
            return <Loader2 size={12} className="animate-spin text-stone-300" />;
          }
          const name = projectId == null ? null : (statusMap[numId]?.owner_name ?? null);
          return name
            ? <span className="text-stone-600" style={{ fontSize: 13 }}>{name}</span>
            : <span className="text-stone-400" style={{ fontSize: 13 }}>Unassigned</span>;
        },
      },
      {
        key: 'accountStatus',
        header: 'Account Status',
        width: 200,
        editable: true,
        type: 'select',
        options: statusSelectOptions,
        getValue: (r) => statusMap[Number(r.id)]?.account_status ?? '',
        // While this row's status is still loading, show a spinner rather than a
        // blank cell (mirrors the Table cell's loading logic). The render path is
        // only used while the cell is read-only, so we also gate editing on the
        // load via disabledReason below — that keeps render (spinner) in effect
        // until the real status lands, instead of seeding the editor with "".
        render: (r) => {
          const numId = Number(r.id);
          if (statusLoading && !(numId in statusMap)) {
            return <Loader2 size={12} className="animate-spin text-stone-300" />;
          }
          const status = statusMap[numId]?.account_status ?? null;
          return <StatusBadge value={status} category="account_status" />;
        },
        disabledReason: (r) => {
          const numId = Number(r.id);
          // Resolve the edit project (global scope, else the company's sole
          // project). Block only when genuinely ambiguous (AMBIG E1).
          if (resolveProjectFor(numId) == null) {
            return (companyProjects[numId]?.length ?? 0) > 1
              ? 'In multiple projects — pick one in the Project selector above'
              : 'Select a project first';
          }
          // Block editing (and let render show the spinner) until this row's
          // per-project status has loaded, so users can't edit a blank cell.
          if (statusLoading && !(numId in statusMap)) return 'Loading…';
          return null;
        },
        onSave: async (r, next) => {
          const pid = resolveProjectFor(Number(r.id));
          if (pid == null) return { error: 'Select a project first.' };
          const newStatus = next === '' ? null : next;
          const { error } = await upsertCompanyStatus(Number(r.id), pid, { account_status: newStatus }, actorId);
          if (!error) handleStatusUpdated(Number(r.id), newStatus);
          return { error };
        },
      },
    ];
  }, [statusOptions, statusMap, statusLoading, projectId, actorId, handleStatusUpdated, resolveProjectFor, companyProjects]);

  const totalRows = filteredData.length;
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const firstRow = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const lastRow = Math.min((pageIndex + 1) * pageSize, totalRows);

  return (
    <AppShell title="Companies">
      <motion.div variants={pageTransition} initial="initial" animate="animate" exit="exit" transition={pageTransitionConfig}>
      <div className="space-y-3">
        {/* Filter panel */}
        <div className="rounded-lg p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--border-color)' }}>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-col gap-1">
              <label className="font-medium text-stone-500" style={{ fontSize: 11 }}>Search</label>
              <div className="relative flex items-center">
                <Search size={13} className="absolute text-stone-400 pointer-events-none" style={{ left: 8 }} />
                <input
                  ref={searchRef}
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilter('search', e.target.value)}
                  placeholder="Company, domain, CIN..."
                  style={{ ...inputBase, paddingLeft: 26, paddingRight: filters.search ? 26 : 10, width: 240 }}
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

            {/* HungerBox: metro-first work queue filter (only shown when features are on) */}
            {HUNGERBOX_FEATURES && (
              <div className="flex flex-col gap-1">
                <label className="font-medium text-stone-500" style={{ fontSize: 11 }}>Metro priority</label>
                <select
                  value={filters.metroOnly}
                  onChange={(e) => setFilter('metroOnly', e.target.value)}
                  style={{ ...inputBase, width: 140 }}
                >
                  <option value="">All cities</option>
                  <option value="metro">Metro only</option>
                </select>
              </div>
            )}

            {/* Project selector for per-project Account Status column */}
            <div className="flex flex-col gap-1">
              <label className="font-medium text-stone-500" style={{ fontSize: 11 }}>Project</label>
              <ProjectSelect value={projectId} onChange={setProjectId} />
            </div>
          </div>
        </div>

        {/* Toolbar row: count + actions — standardized via ListToolbar (ALT-333) */}
        <ListToolbar
          left={
            <p className="text-stone-400" style={{ fontSize: 12 }}>
              {loading ? (
                <span className="flex items-center gap-1.5 text-stone-400">
                  <Loader2 size={12} className="animate-spin" />
                  Loading companies...
                </span>
              ) : loadError ? (
                <span className="text-red-500">{loadError}</span>
              ) : (
                <>
                  {sel.count > 0 && (
                    <span className="font-medium text-stone-700 mr-3">{sel.count} selected</span>
                  )}
                  <span className="font-medium text-stone-700">{filteredData.length}</span> of{' '}
                  <span className="font-medium text-stone-700">{allCompanies.length}</span> companies
                  {hasActiveFilters && (
                    <button
                      onClick={() => {
                        setFilters(defaultFilters);
                        setPagination((p) => ({ ...p, pageIndex: 0 }));
                        sel.clear();
                      }}
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
          bulkActions={sel.count > 0 ? (
            <>
              {/* Bulk reassign selected companies (ALT-291) — needs an active project.
                  ALT-435: show disabled + tooltip when no project is selected instead
                  of silently hiding. */}
              {canReassign && (
                projectId != null ? (
                  <button
                    onClick={openBulkReassign}
                    className="inline-flex items-center gap-1.5 border border-stone-300 hover:border-stone-400 bg-white hover:bg-stone-50 text-stone-700 font-medium rounded-md transition-colors"
                    style={{ fontSize: 13, padding: '6px 12px', height: 34 }}
                    title="Assign the selected companies (in this project) to a salesperson"
                  >
                    <UserCheck size={14} />
                    Reassign ({sel.count})
                  </button>
                ) : (
                  <button
                    disabled
                    className="inline-flex items-center gap-1.5 border border-stone-200 bg-stone-50 text-stone-400 font-medium rounded-md"
                    style={{ fontSize: 13, padding: '6px 12px', height: 34, cursor: 'not-allowed' }}
                    title="Select a project to enable bulk reassign"
                  >
                    <UserCheck size={14} />
                    Reassign ({sel.count})
                  </button>
                )
              )}

              {/* Bulk add-to-project (ALT-291) */}
              {canReassign && (
                <button
                  onClick={() => { setAddProjectError(null); setShowAddProject(true); }}
                  className="inline-flex items-center gap-1.5 border border-stone-300 hover:border-stone-400 bg-white hover:bg-stone-50 text-stone-700 font-medium rounded-md transition-colors"
                  style={{ fontSize: 13, padding: '6px 12px', height: 34 }}
                  title="Add the selected companies to a project"
                >
                  <FolderPlus size={14} />
                  Add to project ({sel.count})
                </button>
              )}

              {/* Bulk set-status (Step E) — per-project, needs an active project.
                  ALT-435: show disabled + tooltip when no project is selected. */}
              {canReassign && (
                projectId != null ? (
                  <button
                    onClick={() => { setSetStatusError(null); setShowSetStatus(true); }}
                    className="inline-flex items-center gap-1.5 border border-stone-300 hover:border-stone-400 bg-white hover:bg-stone-50 text-stone-700 font-medium rounded-md transition-colors"
                    style={{ fontSize: 13, padding: '6px 12px', height: 34 }}
                    title="Set the account status of the selected companies (in this project)"
                  >
                    <Tag size={14} />
                    Set status ({sel.count})
                  </button>
                ) : (
                  <button
                    disabled
                    className="inline-flex items-center gap-1.5 border border-stone-200 bg-stone-50 text-stone-400 font-medium rounded-md"
                    style={{ fontSize: 13, padding: '6px 12px', height: 34, cursor: 'not-allowed' }}
                    title="Select a project to enable bulk set-status"
                  >
                    <Tag size={14} />
                    Set status ({sel.count})
                  </button>
                )
              )}
            </>
          ) : undefined}
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
                  entity="companies"
                  userId={profile?.user_id ?? null}
                  projectId={selectedProjectId}
                  currentState={{ filter_state: advFilters }}
                  activeViewId={activeViewId}
                  onApply={(v: SavedViewRecord) => {
                    if (v.filter_state) setAdvFilters(v.filter_state);
                    setActiveViewId(v.id);
                    setPagination((p) => ({ ...p, pageIndex: 0 }));
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
              entity="companies"
              userId={userId}
              allColumns={ALL_COLUMNS}
              value={columnPrefs}
              onChange={(next) => setColumnPrefs(reconcileColumns(next, ALL_COLUMNS))}
              columnPinning={columnPinning}
              onColumnPinningChange={setColumnPinning}
            />
          }
          exportButton={
            <>
              <DuplicatesButton
                rows={filteredData}
                signals={[
                  { key: 'name', label: 'Same name', get: (r) => r.name },
                  { key: 'email', label: 'Same email', get: (r) => r.email },
                  { key: 'website', label: 'Same website', get: (r) => r.domainClean || r.webUrl },
                ]}
                getId={(r) => r.id}
                getTitle={(r) => r.name}
                getSubtitle={(r) => [r.city, r.industry].filter(Boolean).join(' · ')}
                getHref={(r) => `/companies/${r.id}`}
                entityLabel="companies"
              />
              <ExportButton
                rows={[] as unknown as Record<string, unknown>[]}
                getRows={getExportRows as unknown as () => Promise<Record<string, unknown>[] | null>}
                columns={activeExportColumns as unknown as ExportColumn<Record<string, unknown>>[]}
                filename="amplior-crm-companies"
                selectedIds={sel.selectedIds}
                idKey="id"
                idHeader="Company ID"
                disabled={loading || filteredData.length === 0}
              />
            </>
          }
          create={
            /* Create is admin-only by default (ADR-21); hidden from outreach roles. */
            canCreateData ? (
              <button
                onClick={() => navigate('/companies/new')}
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
                New Company
              </button>
            ) : undefined
          }
        />

        {/* Advanced filter panel (ALT-270) — shown below toolbar when flag + open. */}
        {ADVANCED_FILTERS && filterPanelOpen && (
          <FilterBuilderPanel
            fields={COMPANIES_FIELDS}
            value={advFilters}
            onChange={(next) => { setAdvFilters(next); setPagination((p) => ({ ...p, pageIndex: 0 })); sel.clear(); }}
          />
        )}

        {/* Active-filter chips — removable, with one-click Clear all (ALT). */}
        <ActiveFilters
          chips={filterChips}
          onClearAll={() => {
            setFilters(defaultFilters);
            setPagination((p) => ({ ...p, pageIndex: 0 }));
            sel.clear();
          }}
        />

        {/* "Select all N matching" bar — appears once the whole visible page is
            selected and more matching rows exist beyond it (ALT). */}
        {!loading && !loadError && (
          <SelectAllMatchingBar
            noun="company"
            nounPlural="companies"
            pageCount={pageRowIds.length}
            pageSelectedCount={pageSelectedCount}
            totalMatching={allMatchingIds.length}
            totalSelected={sel.count}
            onSelectAllMatching={() => sel.addAll(allMatchingIds)}
            onClear={() => sel.clear()}
          />
        )}

        {/* Kanban (Board) view — group-by field is selectable (ALT-338). Status
            and Owner grouping are per-project (gated on a project); Industry/City
            work without one. */}
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
          kanbanNeedsProject && projectId == null ? (
            <div
              className="rounded-lg flex items-center justify-center text-stone-500"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--border-color)', padding: '40px 16px', fontSize: 13, textAlign: 'center' }}
            >
              Select a project to group records by status or owner.
            </div>
          ) : (
            <GenericKanban<Company>
              columns={kanbanColumns}
              itemsByColumn={companiesByGroup}
              getKey={(row) => row.id}
              getCardLabel={(row) => `Open ${row.name || 'company'}`}
              onCardClick={(row) => setPreviewId(Number(row.id))}
              isSelected={(item) => sel.isSelected(item.id)}
              onToggleSelect={(item) => sel.toggle(item.id)}
              renderCard={(row) => {
                const lite = statusMap[Number(row.id)] ?? null;
                const status = lite?.account_status ?? null;
                return (
                  <CardShell
                    name={row.name || ''}
                    subtitle={row.domainClean || undefined}
                    chip={status ? <StatusBadge value={status} category="account_status" /> : undefined}
                    fields={[
                      { label: 'Industry', value: row.industry ?? '' },
                      { label: 'City', value: row.city ?? '' },
                      { label: 'Owner', value: lite?.owner_name ?? 'Unassigned' },
                    ]}
                  />
                );
              }}
            />
          )
        )}

        {/* Grid view — real spreadsheet-style inline editing (EditableGrid, ALT-331) */}
        {view === 'grid' && !loading && !loadError && (() => {
          const gridRows = table.getRowModel().rows.map((r) => r.original);
          const visibleIds = gridRows.map((r) => r.id);
          const selCount = visibleIds.filter((id) => sel.isSelected(id)).length;
          const selectAllState: 'none' | 'some' | 'all' =
            selCount === 0 ? 'none' : selCount === visibleIds.length ? 'all' : 'some';
          return (
            <EditableGrid<Company>
              rows={gridRows}
              getKey={(r) => r.id}
              columns={EDITABLE_COLUMNS}
              isSelected={(r) => sel.isSelected(r.id)}
              onToggleSelect={(r) => sel.toggle(r.id)}
              selectAllState={selectAllState}
              onToggleSelectAll={() => sel.toggleAll(visibleIds)}
              onOpenRow={(r) => setPreviewId(Number(r.id))}
              emptyLabel="No companies match."
            />
          );
        })()}

        {/* Table */}
        {(view === 'table' || loading || loadError) && (
        <div className="overflow-hidden" style={{ borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-sm)', background: 'var(--color-surface)', border: '1px solid var(--border-color)' }}>
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
                          padding: header.id === '__select' ? '11px 8px 11px 16px' : '11px 16px',
                          textAlign: 'left',
                          fontWeight: 500,
                          fontSize: 12,
                          color: 'var(--color-gray-500)',
                          whiteSpace: 'nowrap',
                          userSelect: 'none',
                          cursor: canSort ? 'pointer' : 'default',
                          width: header.id === '__select' ? 40 : undefined,
                          // Sticky header (ALT-318): background + bottom border on the cell
                          // so body rows can't show through under the sticky header.
                          position: 'sticky',
                          top: 0,
                          // ALT-440: column pinning — pinned-left columns also stick horizontally.
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
                    <tr key={`sk-${r}`} style={{ height: 44 }}>
                      {columns.map((_c, c) => (
                        <td key={c} style={{ borderBottom: '1px solid var(--color-surface-inset)', padding: c === 0 ? '0 8px 0 16px' : '0 16px' }}>
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
                    <td colSpan={columns.length} className="px-4 py-10 text-center text-stone-400" style={{ fontSize: 13 }}>
                      {hasActiveFilters ? (
                        <EmptyState
                          icon={<Building2 size={22} />}
                          title="No companies match these filters"
                          message="Try widening or clearing the filters above."
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
                          icon={<Building2 size={22} />}
                          title="No companies yet"
                          message="Companies will appear here once they've been added."
                        />
                      )}
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => {
                    const isSelected = sel.isSelected(row.original.id);
                    // SAFE_VIEW (ALT-493): grey out rows owned by another rep.
                    // company_project_status.owner_user_id is already in statusMap (CompanyStatusLite).
                    // When no project selected, statusMap is empty → isForeignRecord returns false.
                    const companyForeign = isForeignRecord(
                      statusMap[Number(row.original.id)]?.owner_user_id ?? null,
                      userId,
                      safeViewExempt,
                    );
                    return (
                      <tr
                        key={row.id}
                        role="button"
                        tabIndex={0}
                        data-rowid={row.original.id}
                        aria-label={`Preview ${row.original.name || 'company'}`}
                        onClick={() => setPreviewId(Number(row.original.id))}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                            e.preventDefault();
                            setPreviewId(Number(row.original.id));
                          }
                        }}
                        style={{
                          height: densityMetrics.rowHeight,
                          cursor: 'pointer',
                          // Animate row height when toggling density (ALT density win).
                          transition: 'background 0.1s, height 0.15s ease',
                          background: isSelected ? 'var(--color-brand-subtle)' : 'transparent',
                          boxShadow:
                            keyNav.focusedId === row.original.id
                              ? 'inset 3px 0 0 0 var(--color-brand, #1A7EE8)'
                              : undefined,
                          // SAFE_VIEW (ALT-493): muted styling for foreign records.
                          ...foreignRowStyle(companyForeign),
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-hover)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background = isSelected ? 'var(--color-brand-subtle)' : 'transparent';
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
                                padding: cell.column.id === '__select'
                                  ? `${densityMetrics.cellPaddingY}px 8px ${densityMetrics.cellPaddingY}px 16px`
                                  : `${densityMetrics.cellPaddingY}px 16px`,
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
      </div>

      {/* Row-click preview slide-over (ALT-327/328) */}
      {previewId != null && (
        <RecordPreviewPanel
          title="Company"
          onClose={() => setPreviewId(null)}
          openFullHref={`/companies/${previewId}`}
        >
          <CompanyPreview companyId={previewId} projectId={projectId} />
        </RecordPreviewPanel>
      )}

      {showReassign && (
        <BulkReassignModal
          entityLabel="Company"
          ownerLabel="Owner"
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

      {showAddProject && (
        <BulkProjectModal
          entityLabel="Company"
          count={sel.count}
          projects={projects}
          saving={addProjectSaving}
          error={addProjectError}
          progress={bulkProgress}
          onCancel={() => bulkAbort.current?.abort()}
          onConfirm={handleAddToProject}
          onClose={() => setShowAddProject(false)}
        />
      )}

      {showSetStatus && (
        <BulkStatusModal
          entityLabel="Company"
          count={sel.count}
          options={statusOptions.map((o) => ({ value: o.value, label: o.label }))}
          saving={setStatusSaving}
          error={setStatusError}
          progress={bulkProgress}
          onCancel={() => bulkAbort.current?.abort()}
          onConfirm={handleSetStatus}
          onClose={() => setShowSetStatus(false)}
        />
      )}
      </motion.div>
    </AppShell>
  );
}

export default CompaniesPage;
