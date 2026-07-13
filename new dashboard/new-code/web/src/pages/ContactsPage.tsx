// TODO(ALT-440): pin support for hand-rolled contacts table — ContactsPage uses a
// hand-rolled <table> without TanStack Table, so ColumnPinningState / usePinPersistence
// cannot be wired here with the same pattern as the other list pages. Defer until
// ContactsPage is refactored to useReactTable.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { motion } from 'framer-motion';
import { pageTransition, pageTransitionConfig } from '../lib/zenAnimations';
import { fetchAllContacts, type Contact } from '../data/contacts';
import {
  fetchContactStatuses,
  upsertContactStatus,
  type ContactStatusLite,
} from '../data/projectStatus';
import { fetchOptions, type DropdownOption } from '../data/dropdowns';
import { useAuth } from '../contexts/AuthContext';
import { useProjectScope } from '../contexts/ProjectContext';
import { ProjectSelect } from '../components/ui/ProjectSelect';
import { useRowSelection } from '../components/ui/useRowSelection';
import { useListKeyboardNav } from '../components/ui/useListKeyboardNav';
import { ExportButton } from '../components/ui/ExportButton';
import { DuplicatesButton } from '../components/ui/DuplicatesButton';
import { normPhone } from '../lib/findDuplicates';
import { ColumnCustomizer, defaultColumnPrefs } from '../components/ui/ColumnCustomizer';
import { ViewSwitcher, useViewMode } from '../components/ui/ViewSwitcher';
import { DensityToggle } from '../components/ui/DensityToggle';
import { useDensity, getDensityMetrics } from '../components/ui/useDensity';
import { CardShell } from '../components/ui/CardGrid';
import { ListToolbar } from '../components/ui/ListToolbar';
import { ActiveFilters, type FilterChip } from '../components/ui/ActiveFilters';
import { SelectAllMatchingBar } from '../components/ui/SelectAllMatchingBar';
import { useListFilters } from '../lib/listFilters';
import { sortKey } from '../lib/useSortPersistence';
import { humanizeWriteError } from '../lib/writeError';
import { EditableGrid, type EditableColumn } from '../components/ui/EditableGrid';
import { GenericKanban } from '../components/kanban/GenericKanban';
import {
  KanbanGroupBySelect,
  buildKanbanGrouping,
  type KanbanGroupDef,
} from '../components/kanban/KanbanGroupBySelect';
import { StatusBadge } from '../components/ui/StatusBadge';
import { MultiSelectFilter } from '../components/ui/MultiSelectFilter';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/ConfirmDialog';
import type { ColumnDef, ExportColumn } from '../components/ui/columns';
import type { ColumnPref } from '../data/views';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Loader2,
  Plus,
  Link2,
  RefreshCw,
  AlertCircle,
  UserCheck,
  FolderPlus,
  Tag,
  Users,
} from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { BulkReassignModal } from '../components/common/ReassignModal';
import { reassignContactsBulk, fetchAssignableUsers } from '../data/assignment';
import { distributeRecords } from '../data/bulkActions';
import { supabase } from '../lib/supabase';
import { BulkProjectModal } from '../components/common/BulkProjectModal';
import { BulkStatusModal } from '../components/common/BulkStatusModal';
import { addContactsToProject, setContactsStatus } from '../data/bulkActions';
import type { UserOption } from '../data/wishlist';
import { RecordPreviewPanel } from '../components/common/RecordPreviewPanel';
import { ContactPreview } from '../components/contacts/ContactPreview';
import { HUNGERBOX_FEATURES } from '../lib/hungerbox';
import { isForeignRecord, maskContact, foreignRowStyle } from '../lib/safeView';
import { ADVANCED_FILTERS, CONTACTS_FIELDS, EMPTY_FILTER_STATE, evalFilterState, type AdvancedFilterState } from '../lib/filterEngine';
import { FilterBuilderButton, FilterBuilderPanel } from '../components/filters/FilterBuilder';
import { ViewPicker } from '../components/filters/ViewPicker';
import type { SavedViewRecord } from '../data/savedViews';

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
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

function avatarTint(name: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[hash % AVATAR_TINTS.length];
}

function contactInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function ContactAvatar({ name }: { name: string }) {
  const tint = name ? avatarTint(name) : { bg: '#F3F4F6', text: '#9CA3AF' };
  return (
    <span
      aria-hidden="true"
      style={{
        flexShrink: 0,
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: tint.bg,
        color: tint.text,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.3,
      }}
    >
      {name ? contactInitials(name) : '?'}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Input style                                                         */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Filters                                                             */
/* ------------------------------------------------------------------ */

interface Filters {
  search: string;
  company: string[]; // multi-value (OR; empty = all)
  city: string[];    // multi-value (OR; empty = all)
  hasLinkedin: string; // 'yes' | 'no' | ''
  showDemo: string;    // 'all' | 'real' | 'demo'
  /** HungerBox: 'metro' to show only metro-city contacts, '' = all */
  metroOnly: string;
}

const defaultFilters: Filters = {
  search: '',
  company: [],
  city: [],
  hasLinkedin: '',
  showDemo: 'real',
  metroOnly: '',
};

/* ------------------------------------------------------------------ */
/*  Column catalogue                                                    */
/* ------------------------------------------------------------------ */

// ContactRow is a Contact enriched with per-project status fields.
// The index signature lets it satisfy Record<string,unknown> for the shared
// generic components (ColumnCustomizer, ExportButton).
interface ContactRow extends Contact, ContactStatusLite {
  // Per-project owner display name (resolved from contact_project_status
  // .owner_user_id). Empty string when no project / unassigned. ALT-296 step B.
  owner_name: string;
  [key: string]: unknown;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'full_name',       header: 'Name',           defaultVisible: true },
  { key: 'company_name',    header: 'Company',        defaultVisible: true },
  { key: 'city_name',       header: 'City',           defaultVisible: true },
  { key: 'email',           header: 'Email',          defaultVisible: true },
  { key: 'linkedin_url',    header: 'LinkedIn',       defaultVisible: true },
  { key: 'phone_combined',  header: 'Phone',          defaultVisible: true },
  { key: 'contact_status',  header: 'Contact Status', defaultVisible: true },
  // Per-project owner (contact_project_status.owner_user_id, resolved to a name).
  // Project-gated like the status column. ALT-296 step B.
  { key: 'owner_name',      header: 'Owner',          defaultVisible: true },
  { key: 'description',     header: 'Description',    defaultVisible: true },
  { key: 'comments',        header: 'Comments',       defaultVisible: true },
  // Hidden by default — reachable via customizer
  { key: 'designation',     header: 'Designation',    defaultVisible: false },
  { key: 'mobile_no',       header: 'Mobile',         defaultVisible: false },
  { key: 'alt_mobile_no',   header: 'Alt Phone',      defaultVisible: false },
];

// Export columns for the ExportButton — use accessors for computed/enriched cells.
const EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'full_name',      header: 'Name' },
  { key: 'company_name',   header: 'Company' },
  { key: 'city_name',      header: 'City' },
  { key: 'email',          header: 'Email' },
  { key: 'linkedin_url',   header: 'LinkedIn' },
  { key: 'mobile_no',      header: 'Mobile' },
  { key: 'alt_mobile_no',  header: 'Alt Phone' },
  { key: 'designation',    header: 'Designation' },
  { key: 'contact_status', header: 'Contact Status' },
  { key: 'owner_name',     header: 'Owner' },
  { key: 'description',    header: 'Description' },
  { key: 'comments',       header: 'Comments' },
];

const PAGE_SIZE_OPTIONS = [25, 50, 100];

/* ------------------------------------------------------------------ */
/*  Inline status cell                                                  */
/* ------------------------------------------------------------------ */

interface InlineStatusCellProps {
  contactId: number;
  /**
   * The project this inline edit writes to — RESOLVED by the parent (AMBIG E1):
   * the global scope when set, else the contact's sole project when it belongs to
   * exactly one. Only null when genuinely ambiguous (no global scope AND the
   * contact is in multiple projects), in which case the cell stays read-only.
   */
  projectId: number | null;
  current: string | null;
  options: DropdownOption[];
  actorId: string | null;
  /** Tooltip when read-only (projectId null). Defaults to "Select a project first". */
  blockedReason?: string;
  onUpdated: (contactId: number, newStatus: string | null) => void;
}

function InlineStatusCell({
  contactId, projectId, current, options, actorId, blockedReason, onUpdated,
}: InlineStatusCellProps) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const toast = useToast();

  // Close on outside click
  useEffect(() => {
    if (!editing) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setEditing(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editing]);

  async function handleChange(value: string) {
    if (!projectId) return;
    setBusy(true);
    const newStatus = value === '' ? null : value;
    const { error } = await upsertContactStatus(contactId, projectId, { contact_status: newStatus }, actorId);
    setBusy(false);
    setEditing(false);
    // Surface failures instead of silently flipping the badge (e.g. RLS 42501
    // "you can only edit records you own"). Only update on success.
    if (error) { toast.error(humanizeWriteError(error) ?? 'Something went wrong. Please try again.'); return; }
    onUpdated(contactId, newStatus);
    toast.success('Status updated');
  }

  if (!editing) {
    return (
      <span
        onClick={(e) => { e.stopPropagation(); if (projectId) setEditing(true); }}
        title={projectId ? 'Click to change status' : (blockedReason ?? 'Select a project first')}
        style={{ cursor: projectId ? 'pointer' : 'default', display: 'inline-block' }}
      >
        <StatusBadge value={current} category="contact_status" />
      </span>
    );
  }

  return (
    <div ref={ref} onClick={(e) => e.stopPropagation()} style={{ position: 'relative', display: 'inline-block' }}>
      <select
        autoFocus
        value={current ?? ''}
        disabled={busy}
        onChange={(e) => void handleChange(e.target.value)}
        style={{ ...inputBase, height: 26, fontSize: 12, paddingRight: 24, cursor: 'pointer' }}
      >
        <option value="">— none —</option>
        {options.map((o) => (
          <option key={o.option_id} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sort state                                                          */
/* ------------------------------------------------------------------ */

type SortKey = keyof ContactRow | 'phone_combined' | null;
interface SortState { key: SortKey; dir: 'asc' | 'desc' }

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export function ContactsPage() {
  const navigate = useNavigate();
  const { profile, canCreateData, canReassign, isAdmin, isTeamLead, isQC } = useAuth();
  const userId = profile?.user_id ?? null;
  // SAFE_VIEW: admin / TL / QC always see everything.
  const safeViewExempt = isAdmin || isTeamLead || isQC;
  const toast = useToast();
  const confirm = useConfirm();
  // actorId is numeric user_id as text for audit columns
  const actorId = userId != null ? String(userId) : null;

  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // True when fetchAllContacts hit its safety ceiling (CONTACTS_MAX = 50,000) and
  // more rows may exist server-side than were loaded (ALT-428). Surfaced as a banner.
  const [truncated, setTruncated] = useState(false);
  // Bump to re-run the contacts-load effect (Retry on error). ALT-215 #12.
  const [reloadKey, setReloadKey] = useState(0);
  // Persisted across refresh per browser (ALT-369).
  const [filters, setFilters] = useListFilters<Filters>('contacts', defaultFilters);
  // Advanced filter state (ALT-270) — only used when ADVANCED_FILTERS is on.
  const [advFilters, setAdvFilters] = useState<AdvancedFilterState>(EMPTY_FILTER_STATE);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [activeViewId, setActiveViewId] = useState<number | null>(null);
  // Persisted sort state (ALT-440) — key: altleads:sort:contacts:<userId>.
  const [sort, setSort] = useState<SortState>(() => {
    try {
      const raw = localStorage.getItem(sortKey('contacts', userId));
      if (raw) {
        const p = JSON.parse(raw) as unknown;
        if (p && typeof p === 'object' && !Array.isArray(p)) {
          const { key, dir } = p as Record<string, unknown>;
          if ((typeof key === 'string' || key === null) && (dir === 'asc' || dir === 'desc')) {
            return { key: key as SortKey, dir };
          }
        }
      }
    } catch { /* ignore */ }
    return { key: 'full_name', dir: 'asc' };
  });
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  // Per-project status map: contact_id -> ContactStatusLite.
  // The project here drives the per-project STATUS column. Contacts are cross-project
  // entities (no project_id on the row), so we don't row-filter by project — but the
  // local picker is SEEDED + KEPT IN SYNC with the global project switcher so a
  // multi-project user sees one consistent project, not two competing controls
  // (review ALT-273B M8). The user may still override it locally for the status view.
  const { selectedProjectId, projects } = useProjectScope();
  const [projectId, setProjectId] = useState<number | null>(selectedProjectId);

  // Bulk reassign (ALT-291) — per-project owner_user_id for the selected contacts.
  const [showReassign, setShowReassign] = useState(false);
  const [reassignSaving, setReassignSaving] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [reassignOwners, setReassignOwners] = useState<UserOption[]>([]);

  // Bulk add-to-project (ALT-291).
  const [showAddProject, setShowAddProject] = useState(false);
  const [addProjectSaving, setAddProjectSaving] = useState(false);
  const [addProjectError, setAddProjectError] = useState<string | null>(null);

  // Bulk set-status (Step E) — set contact_status on selected contacts (per-project).
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
    const ids = [...sel.selectedIds];
    const actor = profile?.user_id != null ? String(profile.user_id) : '';
    // Build distributable records — use company_id as the companyKey for the cap.
    const contactMap = new Map(allContacts.map((c) => [c.contact_id, c.company_id]));
    const records = ids.map((id) => ({ id, companyKey: contactMap.get(id) ?? null }));
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
      for (const [ownerId, contactIds] of slices) {
        if (ac.signal.aborted) break;
        if (contactIds.length === 0) continue;
        const res = await reassignContactsBulk(contactIds, projectId, ownerId, actor, {
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
    // Refresh the per-project owner names for the reassigned rows so the Owner
    // column reflects the new owner immediately (don't wait for a project switch /
    // reload). Reuses the same fetch the project effect uses.
    loadOwners(projectId, ids);
    toast.success(
      totalFailed > 0
        ? `Reassigned ${totalOk}; ${totalFailed} skipped (no permission).`
        : `Reassigned ${totalOk} contact${totalOk === 1 ? '' : 's'} — the new owner(s) were notified.`,
    );
  };
  const handleAddToProject = async (targetProjectId: number) => {
    const ids = [...sel.selectedIds];
    setAddProjectSaving(true);
    setAddProjectError(null);
    const ac = new AbortController();
    bulkAbort.current = ac;
    setBulkProgress({ done: 0, total: ids.length });
    let res;
    try {
      res = await addContactsToProject(ids, targetProjectId, profile?.user_id != null ? String(profile.user_id) : '', {
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
        : `Added ${res.ok} contact${res.ok === 1 ? '' : 's'} to the project.`,
    );
  };
  const handleSetStatus = async (status: string) => {
    if (projectId == null) { setSetStatusError('Select a project first.'); return; }
    const ids = [...sel.selectedIds];
    setSetStatusSaving(true);
    setSetStatusError(null);
    const ac = new AbortController();
    bulkAbort.current = ac;
    setBulkProgress({ done: 0, total: ids.length });
    let res;
    try {
      res = await setContactsStatus(ids, projectId, status, actorId ?? '', {
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
    // Reflect the new statuses. On a clean run we can optimistically flip each
    // badge; if some rows were skipped (no permission) we don't know which, so
    // re-fetch the affected rows from the server to stay truthful.
    if (res.failed > 0) {
      const fresh = await fetchContactStatuses(projectId, ids);
      setStatusMap((prev) => ({ ...prev, ...fresh }));
    } else {
      for (const id of ids) handleStatusUpdated(id, status);
    }
    toast.success(
      res.failed > 0
        ? `Updated ${res.ok}; ${res.failed} skipped (no permission).`
        : `Set status on ${res.ok} contact${res.ok === 1 ? '' : 's'}.`,
    );
  };
  useEffect(() => { setProjectId(selectedProjectId); }, [selectedProjectId]);
  const [statusMap, setStatusMap] = useState<Record<number, ContactStatusLite>>({});
  const [statusLoading, setStatusLoading] = useState(false);
  // Per-project owner map: contact_id -> resolved owner display name.
  // Built from contact_project_status.owner_user_id (same per-project rows that
  // power the status column), with ids resolved to names via user_master.
  // null owner_user_id (or a row that exists but is unassigned) → "Unassigned".
  // ALT-296 step B. Lives separately from statusMap because the shared
  // fetchContactStatuses() helper doesn't return owner_user_id.
  const [ownerMap, setOwnerMap] = useState<Record<number, string>>({});
  // SAFE_VIEW (ALT-492): per-project numeric owner_user_id per contact.
  // Parallel to ownerMap (which stores display names). Used by isForeignRecord.
  const [ownerIdMap, setOwnerIdMap] = useState<Record<number, number | null>>({});
  // contact_status dropdown options
  const [statusOptions, setStatusOptions] = useState<DropdownOption[]>([]);

  // Per-contact project membership (contact_id -> distinct project ids). Only
  // loaded when NO global project is scoped, to auto-resolve the inline status
  // edit for single-project contacts (AMBIG E1). Cleared when a global project is
  // selected (the global scope is used directly).
  const [contactProjects, setContactProjects] = useState<Record<number, number[]>>({});

  // Column customizer state
  const [columnPrefs, setColumnPrefs] = useState<ColumnPref[]>(() => defaultColumnPrefs(ALL_COLUMNS));

  // Table / Grid view (persisted per user + entity in localStorage).
  const [view, setView] = useViewMode('contacts', userId);
  // Row density (comfortable/compact), persisted per user + entity (ALT-375).
  const [density, setDensity] = useDensity('contacts', userId);
  const densityMetrics = getDensityMetrics(density);
  // Kanban "Group by" field (ALT-338) — default = status (the original fixed field).
  const [kanbanGroupBy, setKanbanGroupBy] = useState<string>('contact_status');

  // Row selection
  const sel = useRowSelection<number>();
  const searchRef = useRef<HTMLInputElement>(null);

  // Row-click preview slide-over (ALT-327/328). Opening the panel replaces the
  // old navigate-away behaviour; the full detail page stays reachable via the
  // panel's "Open full record →" action.
  const [previewId, setPreviewId] = useState<number | null>(null);

  // Load contacts
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchAllContacts().then(({ contacts, error, truncated: cap }) => {
      if (cancelled) return;
      setAllContacts(contacts);
      setLoadError(error);
      setTruncated(!!cap);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [reloadKey]);

  // Load contact_status dropdown options once
  useEffect(() => {
    fetchOptions('contact_status').then(setStatusOptions);
  }, []);

  // Load per-project statuses whenever project or contacts change
  useEffect(() => {
    if (!projectId || allContacts.length === 0) {
      setStatusMap({});
      return;
    }
    let cancelled = false;
    setStatusLoading(true);
    const ids = allContacts.map((c) => c.contact_id);
    fetchContactStatuses(projectId, ids).then((map) => {
      if (cancelled) return;
      setStatusMap(map);
      setStatusLoading(false);
    });
    return () => { cancelled = true; };
  }, [projectId, allContacts]);

  // Fetch per-project OWNER names for a set of contact ids within one project and
  // MERGE them into ownerMap. Batches contact_project_status(contact_id,
  // owner_user_id) in chunks (mirrors fetchContactStatuses' paging), then resolves
  // the distinct owner_user_ids to names in a single user_master lookup. Kept in
  // ContactsPage because the shared status helper can't be widened from here.
  // Reused by the project effect (all ids) AND after a bulk reassign (the affected
  // ids), so the Owner column refreshes without a project switch / reload.
  // `shouldApply` lets the caller drop a stale result (mirrors the original
  // effect's `cancelled` guard): the project effect passes a predicate bound to
  // its cleanup flag; the post-reassign call omits it (always applies).
  const loadOwners = useCallback(async (pid: number, ids: number[], shouldApply?: () => boolean) => {
    if (!pid || ids.length === 0) return;
    const ownerByContact: Record<number, number | null> = {};
    const CHUNK = 200;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from('contact_project_status')
        .select('contact_id, owner_user_id')
        .eq('project_id', pid)
        .in('contact_id', slice);
      if (error) {
        console.error('[ContactsPage] owner fetch error', error);
        continue;
      }
      for (const row of (data ?? []) as { contact_id: number; owner_user_id: number | null }[]) {
        ownerByContact[row.contact_id] = row.owner_user_id;
      }
    }

    // Resolve distinct owner ids → names in one query.
    const distinctIds = [...new Set(Object.values(ownerByContact).filter((v): v is number => v != null))];
    const nameById = new Map<number, string>();
    if (distinctIds.length > 0) {
      const { data: users } = await supabase
        .from('user_master')
        .select('user_id, full_name')
        .in('user_id', distinctIds);
      ((users ?? []) as { user_id: number; full_name: string | null }[]).forEach((u) =>
        nameById.set(u.user_id, (u.full_name ?? '').trim() || `User #${u.user_id}`),
      );
    }

    if (shouldApply && !shouldApply()) return; // stale — a newer load superseded us
    setOwnerMap((prev) => {
      const next = { ...prev };
      for (const [cid, uid] of Object.entries(ownerByContact)) {
        next[Number(cid)] = uid != null ? (nameById.get(uid) ?? `User #${uid}`) : '';
      }
      return next;
    });
    // SAFE_VIEW (ALT-492): store the numeric owner_user_id per contact so
    // isForeignRecord() can compare against the current user's numeric id.
    setOwnerIdMap((prev) => {
      const next = { ...prev };
      for (const [cid, uid] of Object.entries(ownerByContact)) {
        next[Number(cid)] = uid ?? null;
      }
      return next;
    });
  }, []);

  // Load per-project OWNER names whenever project or contacts change.
  useEffect(() => {
    if (!projectId || allContacts.length === 0) {
      setOwnerMap({});
      setOwnerIdMap({});
      return;
    }
    let cancelled = false;
    const ids = allContacts.map((c) => c.contact_id);
    // Reset for a fresh project so stale owners from the previous project can't
    // linger, then load the current project's owners (dropping the result if this
    // effect is cleaned up first).
    setOwnerMap({});
    void loadOwners(projectId, ids, () => !cancelled);
    return () => { cancelled = true; };
  }, [projectId, allContacts, loadOwners]);

  // No global project scoped → load each contact's project membership so a
  // single-project contact can auto-resolve its inline status edit (AMBIG E1).
  // Then load that resolved project's status into statusMap so the badge shows
  // the real value (not a blank that only appears once a project is picked).
  useEffect(() => {
    if (projectId != null || allContacts.length === 0) { setContactProjects({}); return; }
    let cancelled = false;
    const ids = allContacts.map((c) => c.contact_id);
    void (async () => {
      // Membership: contact_id -> distinct project ids (chunked like the status fetch).
      const projMap: Record<number, number[]> = {};
      const CHUNK = 200;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        const { data, error } = await supabase
          .from('contact_project_status')
          .select('contact_id, project_id')
          .in('contact_id', slice);
        if (error) { console.error('[ContactsPage] contact projects fetch error', error); continue; }
        for (const row of (data ?? []) as { contact_id: number; project_id: number }[]) {
          const list = projMap[row.contact_id] ?? (projMap[row.contact_id] = []);
          if (!list.includes(row.project_id)) list.push(row.project_id);
        }
      }
      if (cancelled) return;
      setContactProjects(projMap);
      // For contacts resolving to exactly one project, load that project's status
      // so the badge renders the real value. Group ids per project id.
      const byProject = new Map<number, number[]>();
      for (const id of ids) {
        const list = projMap[id];
        if (list && list.length === 1) {
          const arr = byProject.get(list[0]) ?? [];
          arr.push(id);
          byProject.set(list[0], arr);
        }
      }
      for (const [pid, pids] of byProject) {
        const map = await fetchContactStatuses(pid, pids);
        if (cancelled) return;
        setStatusMap((prev) => ({ ...prev, ...map }));
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, allContacts]);

  /**
   * Resolve the project the inline status edit should write to for a contact
   * (AMBIG E1): the global scope when set; else the contact's sole project when it
   * belongs to exactly one; else null (genuinely ambiguous → read-only).
   */
  const resolveProjectFor = useCallback(
    (contactId: number): number | null => {
      if (projectId != null) return projectId;
      const list = contactProjects[contactId];
      return list && list.length === 1 ? list[0] : null;
    },
    [projectId, contactProjects],
  );

  // TODO visibility: per-project status/notes are owner + admin only (security pass).

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPageIndex(0);
    // Clear selection so a bulk action can't act on rows filtered out of view
    // (mirrors Leads / Companies / Wishlist / Meetings setFilter). ALT-436.
    sel.clear();
  };

  // Unique companies and cities for filter dropdowns
  const companyOptions = useMemo(() => {
    const set = new Set<string>();
    allContacts.forEach((c) => { if (c.company_name) set.add(c.company_name); });
    return Array.from(set).sort();
  }, [allContacts]);

  const cityOptions = useMemo(() => {
    const set = new Set<string>();
    allContacts.forEach((c) => { if (c.city_name) set.add(c.city_name); });
    return Array.from(set).sort();
  }, [allContacts]);

  // Filtered data
  const filteredData = useMemo<ContactRow[]>(() => {
    const filtered = allContacts.filter((c) => {
      if (filters.showDemo === 'real' && c.is_demo) return false;
      if (filters.showDemo === 'demo' && !c.is_demo) return false;

      if (filters.search) {
        const q = filters.search.toLowerCase();
        const searchable = [
          c.full_name, c.email, c.mobile_no, c.designation, c.company_name, c.city_name,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!searchable.includes(q)) return false;
      }

      if (filters.company.length && !filters.company.includes(c.company_name ?? '')) return false;
      if (filters.city.length && !filters.city.includes(c.city_name ?? '')) return false;
      if (filters.hasLinkedin === 'yes' && !c.linkedin_url) return false;
      if (filters.hasLinkedin === 'no' && c.linkedin_url) return false;
      // HungerBox: metro-first work queue filter (only when features are on)
      if (HUNGERBOX_FEATURES && filters.metroOnly === 'metro' && !c.isMetro) return false;

      return true;
    });

    // Merge per-project status
    const enriched: ContactRow[] = filtered.map((c) => {
      const ps = statusMap[c.contact_id];
      return {
        ...c,
        contact_status: ps?.contact_status ?? null,
        description: ps?.description ?? null,
        comments: ps?.comments ?? null,
        // Per-project owner name (resolved). Empty when unresolved; the cell /
        // export render "Unassigned" when a project is selected but no owner.
        owner_name: ownerMap[c.contact_id] ?? '',
      };
    });

    // Sort (ALT-437): nulls/empties last regardless of direction; numeric values
    // compared numerically; everything else compared with localeCompare (case-insensitive).
    if (sort.key) {
      const key = sort.key;
      enriched.sort((a, b) => {
        let av: unknown;
        let bv: unknown;
        if (key === 'phone_combined') {
          av = a.mobile_no ?? a.alt_mobile_no ?? null;
          bv = b.mobile_no ?? b.alt_mobile_no ?? null;
        } else {
          av = (a as Record<string, unknown>)[key as string];
          bv = (b as Record<string, unknown>)[key as string];
        }
        // Nulls / empty strings always sort last, regardless of direction.
        const aEmpty = av == null || av === '';
        const bEmpty = bv == null || bv === '';
        if (aEmpty && bEmpty) return 0;
        if (aEmpty) return 1;  // a goes after b
        if (bEmpty) return -1; // b goes after a
        // Both non-empty: numeric comparison when both values parse as numbers.
        const aStr = av!.toString().trim();
        const bStr = bv!.toString().trim();
        const aNum = Number(aStr);
        const bNum = Number(bStr);
        let cmp: number;
        if (!isNaN(aNum) && !isNaN(bNum) && aStr !== '' && bStr !== '') {
          cmp = aNum - bNum;
        } else {
          cmp = aStr.localeCompare(bStr, undefined, { sensitivity: 'base' });
        }
        return sort.dir === 'asc' ? cmp : -cmp;
      });
    }

    // Advanced filter evaluation (ALT-270) — applied after basic filters when flag is on.
    // TODO(v2 server-side filter for contacts): for 100K+ contacts translate
    // advFilters to PostgREST operators instead of Array.filter client-side.
    const result = ADVANCED_FILTERS && advFilters.groups.length > 0
      ? enriched.filter((r) => evalFilterState(r as unknown as Record<string, unknown>, advFilters))
      : enriched;

    return result;
  }, [allContacts, filters, advFilters, statusMap, ownerMap, sort]);

  // Kanban (Board) view — selectable "Group by" field (ALT-338). Default =
  // Contact Status, which is PER PROJECT (contact_project_status.contact_status):
  // its lanes come from the canonical contact_status options (+ an "Unset"
  // bucket) and it's only meaningful with a project selected (the render gates
  // status grouping on a project + shows a gentle note otherwise). City / Company
  // / Owner derive their lanes from the distinct values present and DON'T need a
  // project (though owner_name is itself only resolved when a project is chosen).
  // (Disposition grouping needs latest-call data not on the contact row → skip.)
  const kanbanGroupOptions = useMemo<KanbanGroupDef<ContactRow>[]>(() => [
    {
      key: 'contact_status',
      label: 'Status',
      getGroup: (c) => c.contact_status ?? null,
      lanes: statusOptions.map((o) => ({ key: o.value, label: o.label })),
    },
    { key: 'city_name', label: 'City', getGroup: (c) => c.city_name || null },
    { key: 'company_name', label: 'Company', getGroup: (c) => c.company_name || null },
    { key: 'owner_name', label: 'Owner', getGroup: (c) => c.owner_name || null },
  ], [statusOptions]);

  // Status grouping is gated on a selected project (same as before); the other
  // fields can group without one.
  const kanbanNeedsProject = kanbanGroupBy === 'contact_status';

  const { columns: kanbanColumns, itemsByColumn: contactsByGroup } = useMemo(() => {
    const group = kanbanGroupOptions.find((o) => o.key === kanbanGroupBy) ?? kanbanGroupOptions[0];
    return buildKanbanGrouping<ContactRow>(filteredData, group, 'Unset');
  }, [filteredData, kanbanGroupOptions, kanbanGroupBy]);

  // Keep the kanban "Group by" selection valid: if the selected field is no longer
  // in the current options, reset to the first option so the <select> value can't
  // desync from the rendered board.
  useEffect(() => {
    if (!kanbanGroupOptions.some((o) => o.key === kanbanGroupBy)) {
      setKanbanGroupBy(kanbanGroupOptions[0].key);
    }
  }, [kanbanGroupOptions, kanbanGroupBy]);

  // Pagination
  const totalRows = filteredData.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(pageIndex, pageCount - 1);
  const pageRows = filteredData.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const firstRow = totalRows === 0 ? 0 : safePage * pageSize + 1;
  const lastRow = Math.min((safePage + 1) * pageSize, totalRows);

  // Keyboard-first row navigation (j/k move · Enter open · x select · / search · Esc clear).
  // Paused while a preview is open so j/k don't move the list under the panel.
  // Mirrors LeadsPage; ContactsPage has no TanStack table, so the visible rows are
  // the hand-rolled `pageRows` slice and rows are plain ContactRow (no row.original).
  const keyNav = useListKeyboardNav({
    rows: pageRows,
    getId: (r) => r.contact_id,
    onOpen: (r) => setPreviewId(r.contact_id),
    onToggleSelect: (r) => sel.toggle(r.contact_id),
    searchInputRef: searchRef,
    enabled: previewId == null,
  });

  const hasActiveFilters = filters.search !== '' || filters.company.length > 0 ||
    filters.city.length > 0 || filters.hasLinkedin !== '' || filters.showDemo !== 'real' ||
    (HUNGERBOX_FEATURES && filters.metroOnly !== '');

  // Removable-chip bar showing exactly what's filtering the list (free-text
  // search is excluded — it has its own clear "×"). Multi-select facets emit one
  // chip per value; single-value filters emit one chip when set to a non-default.
  const filterChips = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];

    // Company (multi-select facet) — one chip per selected value.
    for (const value of filters.company) {
      chips.push({
        key: `company:${value}`,
        label: `Company: ${value}`,
        onRemove: () => setFilter('company', filters.company.filter((x) => x !== value)),
      });
    }

    // City (multi-select facet) — one chip per selected value.
    for (const value of filters.city) {
      chips.push({
        key: `city:${value}`,
        label: `City: ${value}`,
        onRemove: () => setFilter('city', filters.city.filter((x) => x !== value)),
      });
    }

    // LinkedIn (single-value) — chip when set; label mirrors the panel options.
    if (filters.hasLinkedin !== '') {
      chips.push({
        key: `hasLinkedin:${filters.hasLinkedin}`,
        label: `LinkedIn: ${filters.hasLinkedin === 'yes' ? 'Has LinkedIn' : 'No LinkedIn'}`,
        onRemove: () => setFilter('hasLinkedin', ''),
      });
    }

    // Data type (single-value) — default is 'real', so chip only off-default;
    // clearing resets to the 'real' default (mirrors hasActiveFilters baseline).
    if (filters.showDemo !== 'real') {
      chips.push({
        key: `showDemo:${filters.showDemo}`,
        label: `Data type: ${filters.showDemo === 'demo' ? 'Demo only' : 'All'}`,
        onRemove: () => setFilter('showDemo', 'real'),
      });
    }

    // HungerBox: metro-only chip
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

  // Visible page contact ids (for select-all on current page)
  const pageIds = pageRows.map((r) => r.contact_id);

  // "Select all N matching" affordance (mirrors LeadsPage). allMatchingIds = every
  // id in the full filtered set; pageRowIds = the ids the user can see/select right
  // now (all filtered rows in kanban, else the current page).
  const allMatchingIds = useMemo(() => filteredData.map((r) => r.contact_id), [filteredData]);
  const pageRowIds = useMemo(
    () => (view === 'kanban' ? allMatchingIds : pageIds),
    [view, allMatchingIds, pageIds],
  );
  const pageSelectedCount = useMemo(
    () => pageRowIds.filter((id) => sel.isSelected(id)).length,
    [pageRowIds, sel],
  );

  // Inline status update handler
  function handleStatusUpdated(contactId: number, newStatus: string | null) {
    setStatusMap((prev) => ({
      ...prev,
      [contactId]: {
        contact_status: newStatus,
        description: prev[contactId]?.description ?? null,
        comments: prev[contactId]?.comments ?? null,
      },
    }));
  }

  // Sorting toggle — persists new sort to localStorage (ALT-440).
  function handleSort(key: SortKey) {
    setSort((prev) => {
      const next = { key, dir: (prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc') as 'asc' | 'desc' };
      try { localStorage.setItem(sortKey('contacts', userId), JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    setPageIndex(0);
  }

  // Column visibility lookup
  const visibleKeys = useMemo(() => {
    const set = new Set(columnPrefs.filter((c) => c.visible).map((c) => c.key));
    return set;
  }, [columnPrefs]);

  // Export columns filtered to currently visible columns (in pref order)
  const exportColumns = useMemo<ExportColumn<ContactRow>[]>(() => {
    return columnPrefs
      .filter((p) => p.visible)
      .flatMap<ExportColumn<ContactRow>>((p) => {
        const col = EXPORT_COLUMNS.find((ec) => ec.key === p.key) as ExportColumn<ContactRow> | undefined;
        if (!col) return [];
        // Owner is project-gated like the status column: blank without a project,
        // "Unassigned" when a project is selected but the row has no owner.
        if (col.key === 'owner_name') {
          return [{
            ...col,
            accessor: (row: ContactRow) =>
              projectId == null ? '' : (row.owner_name || 'Unassigned'),
          }];
        }
        return [col];
      });
  }, [columnPrefs, projectId]);

  /* ---- on-demand export rows for Contacts (ALT-450) ----
     When no project is selected, Contact Status and Owner will be blank
     (they are per-project). Warn the user and let them cancel. */
  const getContactExportRows = useCallback(async (): Promise<ContactRow[] | null> => {
    if (projectId == null) {
      const proceed = await confirm({
        title: 'No project selected',
        message: 'Contact Status and Owner are per-project fields and will be blank in this export because no project is currently selected. Export anyway?',
        confirmLabel: 'Export anyway',
        cancelLabel: 'Cancel',
        tone: 'default',
      });
      if (!proceed) return null;
    }
    return filteredData;
  }, [projectId, filteredData, confirm]);

  /* ----------------------------------------------------------------- */
  /*  EditableGrid columns (ALT-331) — mirror the visible Table columns. */
  /*  Editable: Contact Status (select) + Description / Comments (text), */
  /*  all per-project and gated on a selected project; all other columns */
  /*  (name link, designation, email/phone/LinkedIn, company, city,      */
  /*  owner) are read-only. Saves reuse the page's existing audited       */
  /*  writer (upsertContactStatus), same as the inline status cell.       */
  /* ----------------------------------------------------------------- */
  // Per-row gate for the editable per-project cells: resolve the edit project
  // (global scope, else the contact's sole project — AMBIG E1). Read-only only
  // when genuinely ambiguous (no global scope AND the contact is in >1 project).
  const projectGate = (r: ContactRow): string | null => {
    if (resolveProjectFor(r.contact_id) != null) return null;
    return (contactProjects[r.contact_id]?.length ?? 0) > 1
      ? 'In multiple projects — pick one in the Project selector above'
      : 'Select a project first';
  };

  const EDITABLE_COLUMNS = useMemo<EditableColumn<ContactRow>[]>(() => [
    {
      key: 'full_name',
      header: 'Name',
      // Read-only — name stays a link to the full record (mirrors the table).
      getValue: (r) => r.full_name ?? '',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <ContactAvatar name={r.full_name ?? ''} />
          <a
            href={`/contacts/${r.contact_id}`}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/contacts/${r.contact_id}`); }}
            title={r.full_name || undefined}
            style={{ fontWeight: 500, color: '#1A7EE8', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {r.full_name || '—'}
          </a>
          {r.is_demo && (
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.4, background: '#F3F4F6', color: '#9CA3AF', borderRadius: 3, padding: '1px 5px' }}>DEMO</span>
          )}
        </div>
      ),
    },
    { key: 'company_name', header: 'Company', getValue: (r) => r.company_name ?? '' },
    { key: 'city_name', header: 'City', getValue: (r) => r.city_name ?? '' },
    // Email / phone / LinkedIn are sensitive — display as-is, NOT editable.
    // SAFE_VIEW (ALT-492): email/phone are masked for non-owned rows via render().
    // Presentational only; server-side redaction is a future RLS step.
    {
      key: 'email',
      header: 'Email',
      getValue: (r) => r.email ?? '',
      render: (r: ContactRow) => {
        const foreign = isForeignRecord(ownerIdMap[r.contact_id] ?? null, userId, safeViewExempt);
        const val = foreign ? maskContact(r.email, 'email') : (r.email ?? '');
        return <span>{val || '—'}</span>;
      },
    },
    {
      key: 'linkedin_url',
      header: 'LinkedIn',
      align: 'center',
      width: 70,
      getValue: (r) => r.linkedin_url ?? '',
      render: (r) => {
        const url = r.linkedin_url;
        if (!url) return <span style={{ color: '#e5e7eb' }}>—</span>;
        return (
          <a
            href={url.startsWith('http') ? url : `https://linkedin.com/in/${url}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ color: '#0A66C2', display: 'inline-flex', alignItems: 'center' }}
          >
            <Link2 size={14} />
          </a>
        );
      },
    },
    {
      key: 'phone_combined',
      header: 'Phone',
      getValue: (r) => r.mobile_no ?? r.alt_mobile_no ?? '',
      render: (r: ContactRow) => {
        // SAFE_VIEW (ALT-492): mask phone for non-owned contacts in grid view.
        // Presentational only; server-side redaction is a future RLS step.
        const foreign = isForeignRecord(ownerIdMap[r.contact_id] ?? null, userId, safeViewExempt);
        const primary = r.mobile_no || r.alt_mobile_no;
        if (!primary) return <span style={{ color: '#d1d5db' }}>—</span>;
        if (foreign) return <span style={{ color: 'var(--color-gray-400)' }}>{maskContact(primary, 'phone')}</span>;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {r.mobile_no && <span style={{ fontSize: 13 }}>{r.mobile_no}</span>}
            {r.alt_mobile_no && <span style={{ fontSize: 11, color: '#9ca3af' }}>{r.alt_mobile_no}</span>}
          </div>
        );
      },
    },
    {
      key: 'contact_status',
      header: 'Contact Status',
      type: 'select',
      width: 170,
      editable: true,
      options: statusOptions.map((o) => ({ value: o.value, label: o.label })),
      getValue: (r) => r.contact_status ?? '',
      disabledReason: projectGate,
      render: (r) => <StatusBadge value={r.contact_status} category="contact_status" />,
      onSave: async (r, next) => {
        const pid = resolveProjectFor(r.contact_id);
        if (pid == null) return { error: 'Select a project first' };
        const newStatus = next === '' ? null : next;
        const res = await upsertContactStatus(r.contact_id, pid, { contact_status: newStatus }, actorId);
        if (!res.error) handleStatusUpdated(r.contact_id, newStatus);
        return res;
      },
    },
    {
      key: 'owner_name',
      header: 'Owner',
      // Read-only — reassignment stays via the bulk toolbar / preview.
      getValue: (r) => (projectId == null ? '' : (r.owner_name || 'Unassigned')),
      // Show a small spinner while the per-project owner is still loading rather
      // than flashing "Unassigned" before the fetch resolves (mirrors the Table
      // cell's loading logic; statusLoading is the per-project load proxy).
      render: (r) => {
        if (projectId == null) return <span style={{ color: '#d1d5db' }}>—</span>;
        if (statusLoading) return <Loader2 size={12} className="animate-spin text-stone-300" />;
        return r.owner_name
          ? <span title={r.owner_name}>{r.owner_name}</span>
          : <span style={{ color: '#9ca3af' }}>Unassigned</span>;
      },
    },
    {
      key: 'description',
      header: 'Description',
      type: 'text',
      width: 220,
      editable: true,
      getValue: (r) => r.description ?? '',
      disabledReason: projectGate,
      onSave: async (r, next) => {
        const pid = resolveProjectFor(r.contact_id);
        if (pid == null) return { error: 'Select a project first' };
        const value = next.trim() === '' ? null : next;
        const res = await upsertContactStatus(r.contact_id, pid, { description: value }, actorId);
        if (!res.error) {
          setStatusMap((prev) => ({
            ...prev,
            [r.contact_id]: {
              contact_status: prev[r.contact_id]?.contact_status ?? null,
              description: value,
              comments: prev[r.contact_id]?.comments ?? null,
            },
          }));
        }
        return res;
      },
    },
    {
      key: 'comments',
      header: 'Comments',
      type: 'text',
      width: 220,
      editable: true,
      getValue: (r) => r.comments ?? '',
      disabledReason: projectGate,
      onSave: async (r, next) => {
        const pid = resolveProjectFor(r.contact_id);
        if (pid == null) return { error: 'Select a project first' };
        const value = next.trim() === '' ? null : next;
        const res = await upsertContactStatus(r.contact_id, pid, { comments: value }, actorId);
        if (!res.error) {
          setStatusMap((prev) => ({
            ...prev,
            [r.contact_id]: {
              contact_status: prev[r.contact_id]?.contact_status ?? null,
              description: prev[r.contact_id]?.description ?? null,
              comments: value,
            },
          }));
        }
        return res;
      },
    },
    { key: 'designation', header: 'Designation', getValue: (r) => r.designation ?? '' },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [statusOptions, projectId, actorId, statusLoading, resolveProjectFor, contactProjects, ownerIdMap, userId, safeViewExempt]);

  /* -------------------------------------------------------- render -- */

  const sortIcon = (key: SortKey) => {
    if (sort.key !== key) return <span style={{ color: '#d1d5db', marginLeft: 2 }}>↕</span>;
    return sort.dir === 'asc'
      ? <ChevronUp size={11} style={{ color: '#1A7EE8' }} />
      : <ChevronDown size={11} style={{ color: '#1A7EE8' }} />;
  };

  const thStyle: React.CSSProperties = {
    padding: '10px 14px',
    textAlign: 'left',
    fontWeight: 600,
    fontSize: 13,
    color: 'var(--color-gray-500)',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    borderBottom: '2px solid #1A7EE8',
    // Sticky header (ALT-318): background on the cell (not just the row) so body
    // rows can't show through under the sticky header while the body scrolls.
    position: 'sticky',
    top: 0,
    zIndex: 2,
    background: 'var(--color-surface-alt)',
  };

  const tdStyle: React.CSSProperties = {
    // Vertical padding is density-driven (ALT-375); horizontal stays 14px.
    padding: `${densityMetrics.cellPaddingY}px 14px`,
    fontSize: densityMetrics.fontSize ?? 13,
    color: 'var(--color-gray-900)',
    verticalAlign: 'middle',
    maxWidth: 200,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--color-surface-inset)',
  };

  // Compute number of visible columns + checkbox col
  const visibleColCount = columnPrefs.filter((p) => p.visible).length + 1; // +1 for checkbox

  return (
    <AppShell title="Contacts">
      <motion.div variants={pageTransition} initial="initial" animate="animate" exit="exit" transition={pageTransitionConfig}>
      <div className="space-y-3">

        {/* Filter panel */}
        <div className="rounded-lg p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--border-color)' }}>
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
                  placeholder="Name, email, phone, company..."
                  style={{ ...inputBase, paddingLeft: 26, paddingRight: filters.search ? 26 : 10, width: 220 }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-input)'; }}
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

            {/* Company filter (multi-select) */}
            <MultiSelectFilter
              label="Company"
              selected={filters.company}
              onChange={(v) => setFilter('company', v)}
              options={companyOptions}
              minWidth={160}
            />

            {/* City filter (multi-select) */}
            <MultiSelectFilter
              label="City"
              selected={filters.city}
              onChange={(v) => setFilter('city', v)}
              options={cityOptions}
            />

            {/* LinkedIn filter */}
            <div className="flex flex-col gap-1" style={{ minWidth: 120 }}>
              <label className="font-medium text-stone-500" style={{ fontSize: 11 }}>LinkedIn</label>
              <select
                value={filters.hasLinkedin}
                onChange={(e) => setFilter('hasLinkedin', e.target.value)}
                style={{ ...inputBase, paddingRight: 24, cursor: 'pointer' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-input)'; }}
              >
                <option value="">All</option>
                <option value="yes">Has LinkedIn</option>
                <option value="no">No LinkedIn</option>
              </select>
            </div>

            {/* Demo filter */}
            <div className="flex flex-col gap-1" style={{ minWidth: 110 }}>
              <label className="font-medium text-stone-500" style={{ fontSize: 11 }}>Data type</label>
              <select
                value={filters.showDemo}
                onChange={(e) => setFilter('showDemo', e.target.value)}
                style={{ ...inputBase, paddingRight: 24, cursor: 'pointer' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-input)'; }}
              >
                <option value="real">Real only</option>
                <option value="demo">Demo only</option>
                <option value="all">All</option>
              </select>
            </div>

            {/* HungerBox: metro-first work queue filter */}
            {HUNGERBOX_FEATURES && (
              <div className="flex flex-col gap-1" style={{ minWidth: 130 }}>
                <label className="font-medium text-stone-500" style={{ fontSize: 11 }}>Metro priority</label>
                <select
                  value={filters.metroOnly}
                  onChange={(e) => setFilter('metroOnly', e.target.value)}
                  style={{ ...inputBase, paddingRight: 24, cursor: 'pointer' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-input)'; }}
                >
                  <option value="">All cities</option>
                  <option value="metro">Metro only</option>
                </select>
              </div>
            )}

            {/* Project selector (for per-project status columns) */}
            <div className="flex flex-col gap-1">
              <label className="font-medium text-stone-500" style={{ fontSize: 11 }}>Project</label>
              <ProjectSelect value={projectId} onChange={setProjectId} />
            </div>
          </div>
        </div>

        {/* Toolbar (standardized via ListToolbar — ALT-333). Slots enforce the
            universal order: bulkActions → ViewSwitcher → Columns → Export →
            Create. Export now comes AFTER the switcher + columns (was before). */}
        <ListToolbar
          left={
            <p className="text-stone-400" style={{ fontSize: 12 }}>
              {loading ? (
                <span className="flex items-center gap-1.5 text-stone-400">
                  <Loader2 size={12} className="animate-spin" />
                  Loading contacts...
                </span>
              ) : loadError ? (
                <span className="text-red-500">{loadError}</span>
              ) : (
                <>
                  {sel.count > 0 && (
                    <span className="text-stone-700 font-medium mr-2">{sel.count} selected</span>
                  )}
                  <span className="font-medium text-stone-700">{filteredData.length}</span> of{' '}
                  <span className="font-medium text-stone-700">{allContacts.length}</span> contacts
                  {hasActiveFilters && (
                    <button
                      onClick={() => { setFilters(defaultFilters); setPageIndex(0); sel.clear(); }}
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
            sel.count > 0 ? (
              <>
                {/* Bulk reassign selected contacts (ALT-291) — needs an active project.
                    ALT-435: show disabled + tooltip when no project is selected instead
                    of silently hiding. */}
                {canReassign && (
                  projectId != null ? (
                    <button
                      onClick={openBulkReassign}
                      className="inline-flex items-center gap-1.5 border border-stone-300 hover:border-stone-400 bg-white hover:bg-stone-50 text-stone-700 font-medium rounded-md transition-colors"
                      style={{ fontSize: 13, padding: '6px 12px', height: 34 }}
                      title="Assign the selected contacts (in this project) to a salesperson"
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
                    title="Add the selected contacts to a project"
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
                      title="Set the contact status of the selected contacts (in this project)"
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
            ) : undefined
          }
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
                  entity="contacts"
                  userId={profile?.user_id ?? null}
                  projectId={projectId}
                  currentState={{ filter_state: advFilters }}
                  activeViewId={activeViewId}
                  onApply={(v: SavedViewRecord) => {
                    if (v.filter_state) setAdvFilters(v.filter_state);
                    setActiveViewId(v.id);
                    setPageIndex(0);
                  }}
                />
              )}
              <ViewSwitcher value={view} onChange={setView} />
              {view === 'table' && <DensityToggle value={density} onChange={setDensity} />}
            </>
          }
          columns={
            <ColumnCustomizer
              entity="contacts"
              userId={userId}
              allColumns={ALL_COLUMNS}
              value={columnPrefs}
              onChange={setColumnPrefs}
            />
          }
          exportButton={
            <>
              <DuplicatesButton
                rows={filteredData}
                signals={[
                  { key: 'email', label: 'Same email', get: (r) => r.email },
                  { key: 'phone', label: 'Same mobile', get: (r) => r.mobile_no, normalize: normPhone },
                  { key: 'name', label: 'Same name', get: (r) => r.full_name },
                ]}
                getId={(r) => r.contact_id}
                getTitle={(r) => r.full_name}
                getSubtitle={(r) => [r.company_name, r.email].filter(Boolean).join(' · ')}
                getHref={(r) => `/contacts/${r.contact_id}`}
                entityLabel="contacts"
              />
              <ExportButton<ContactRow>
                rows={[] as unknown as ContactRow[]}
                getRows={getContactExportRows}
                columns={exportColumns}
                filename="amplior-contacts"
                selectedIds={sel.selectedIds}
                idKey="contact_id"
                idHeader="Contact ID"
                disabled={loading || filteredData.length === 0}
              />
            </>
          }
          create={
            /* Create is admin-only by default (ADR-21); hidden from outreach roles. */
            canCreateData ? (
              <button
                onClick={() => navigate('/contacts/new')}
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
                New Contact
              </button>
            ) : undefined
          }
        />

        {/* Advanced filter panel (ALT-270) — shown below toolbar when flag + open. */}
        {ADVANCED_FILTERS && filterPanelOpen && (
          <FilterBuilderPanel
            fields={CONTACTS_FIELDS}
            value={advFilters}
            onChange={(next) => { setAdvFilters(next); setPageIndex(0); sel.clear(); }}
          />
        )}

        {/* Silent-truncation banner (ALT-428) — the loader stops at a 50,000-row
            safety ceiling; warn so the list never looks complete when it isn't. */}
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
              Showing the first <strong>50,000</strong> contacts. Refine filters to see the rest.
            </span>
          </div>
        )}

        {/* Active-filter chips (ALT) — removable chips for every applied filter
            (free-text search excluded). "Clear all" reuses the same reset the
            toolbar's "Clear filters" button uses. */}
        <ActiveFilters
          chips={filterChips}
          onClearAll={() => { setFilters(defaultFilters); setPageIndex(0); sel.clear(); }}
        />

        {/* "Select all N matching" — appears when the page selection doesn't yet
            cover every filtered contact (mirrors LeadsPage). */}
        {!loading && !loadError && (
          <SelectAllMatchingBar
            noun="contact"
            pageCount={pageRowIds.length}
            pageSelectedCount={pageSelectedCount}
            totalMatching={allMatchingIds.length}
            totalSelected={sel.count}
            onSelectAllMatching={() => sel.addAll(allMatchingIds)}
            onClear={() => sel.clear()}
          />
        )}

        {/* Kanban (Board) view — group-by field is selectable (ALT-338). Status
            grouping is per-project (gated on a project); City/Company/Owner work
            without one. */}
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
              Select a project to group records by status.
            </div>
          ) : (
            <GenericKanban<ContactRow>
              columns={kanbanColumns}
              itemsByColumn={contactsByGroup}
              getKey={(row) => row.contact_id}
              getCardLabel={(row) => `Open ${row.full_name || row.company_name || 'contact'}`}
              onCardClick={(row) => setPreviewId(row.contact_id)}
              isSelected={(row) => sel.isSelected(row.contact_id)}
              onToggleSelect={(row) => sel.toggle(row.contact_id)}
              renderCard={(row) => (
                <CardShell
                  name={row.full_name || ''}
                  subtitle={row.designation || row.company_name || undefined}
                  chip={row.contact_status ? <StatusBadge value={row.contact_status} category="contact_status" /> : undefined}
                  fields={[
                    { label: 'Company', value: row.company_name ?? '' },
                    { label: 'City', value: row.city_name ?? '' },
                  ]}
                />
              )}
            />
          )
        )}

        {/* Grid view — spreadsheet-style EditableGrid (ALT-331/332). Inline-edits
            Contact Status / Description / Comments (per-project, gated on a
            project) via the same audited writer as the table's inline cell; all
            other columns are read-only. Leading checkbox wires to the shared
            selection so the bulk toolbar works from the Grid too. */}
        {view === 'grid' && !loading && !loadError && (
          <EditableGrid<ContactRow>
            rows={pageRows}
            getKey={(row) => row.contact_id}
            columns={EDITABLE_COLUMNS}
            isSelected={(row) => sel.isSelected(row.contact_id)}
            onToggleSelect={(row) => sel.toggle(row.contact_id)}
            selectAllState={
              pageIds.length > 0 && sel.allSelected(pageIds)
                ? 'all'
                : pageIds.some((id) => sel.isSelected(id))
                  ? 'some'
                  : 'none'
            }
            onToggleSelectAll={() => sel.toggleAll(pageIds)}
            onOpenRow={(row) => setPreviewId(row.contact_id)}
            emptyLabel="No contacts match."
          />
        )}

        {/* Grid loading / error placeholders reuse the table block below; only
            render the table container when in table view (or while loading). */}

        {/* Table */}
        {(view === 'table' || loading || loadError) && (
        <div className="rounded-lg overflow-hidden" style={{ borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-sm)', background: 'var(--color-surface)', border: '1px solid var(--border-color)' }}>
          <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}>
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #1A7EE8', background: 'var(--color-surface-alt)' }}>
                  {/* Checkbox column */}
                  <th style={{ ...thStyle, width: 36, paddingLeft: 14, paddingRight: 8 }}>
                    <input
                      type="checkbox"
                      checked={pageIds.length > 0 && sel.allSelected(pageIds)}
                      onChange={() => sel.toggleAll(pageIds)}
                      title="Select / deselect page"
                      aria-label={pageIds.length > 0 && sel.allSelected(pageIds) ? 'Deselect all contacts on this page' : 'Select all contacts on this page'}
                      style={{ cursor: 'pointer', accentColor: '#1A7EE8' }}
                    />
                  </th>

                  {/* Dynamic columns */}
                  {columnPrefs.filter((p) => p.visible).map((p) => {
                    const col = ALL_COLUMNS.find((c) => c.key === p.key);
                    const isSortable = !['linkedin_url', 'phone_combined', 'contact_status', 'owner_name', 'description', 'comments'].includes(p.key);
                    const isSorted = isSortable && sort.key === p.key;
                    return (
                      <th
                        key={p.key}
                        role={isSortable ? 'button' : undefined}
                        tabIndex={isSortable ? 0 : undefined}
                        aria-sort={
                          isSorted
                            ? (sort.dir === 'asc' ? 'ascending' : 'descending')
                            : isSortable ? 'none' : undefined
                        }
                        style={{
                          ...thStyle,
                          cursor: isSortable ? 'pointer' : 'default',
                        }}
                        onClick={isSortable ? () => handleSort(p.key as SortKey) : undefined}
                        onKeyDown={isSortable ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSort(p.key as SortKey);
                          }
                        } : undefined}
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {col?.header ?? p.key}
                          {isSortable && sortIcon(p.key as SortKey)}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  // Skeleton rows aligned to the visible columns (ALT-200).
                  Array.from({ length: 8 }).map((_, r) => (
                    <tr key={`sk-${r}`} style={{ borderBottom: '1px solid var(--color-gray-100)', height: 48 }}>
                      {Array.from({ length: visibleColCount }).map((_c, c) => (
                        <td key={c} style={{ padding: c === 0 ? '0 8px 0 14px' : '0 14px' }}>
                          <Skeleton height={12} width={c === 0 ? 16 : `${48 + ((r + c) % 4) * 12}%`} radius={4} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : loadError ? (
                  // Error state with Retry (ALT-215 #12).
                  <tr>
                    <td colSpan={visibleColCount} className="px-4 py-10 text-center">
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
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColCount} className="px-4 py-6">
                      {hasActiveFilters ? (
                        <EmptyState
                          icon={<Users size={22} />}
                          title="No contacts match these filters"
                          message="Try widening or clearing the filters above to see more contacts."
                          action={{
                            label: 'Clear filters',
                            onClick: () => { setFilters(defaultFilters); setPageIndex(0); sel.clear(); },
                          }}
                        />
                      ) : (
                        <EmptyState
                          icon={<Users size={22} />}
                          title="No contacts yet"
                          message="Contacts you can work will appear here once they're added."
                        />
                      )}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row) => {
                    const isSelected = sel.isSelected(row.contact_id);
                    // SAFE_VIEW (ALT-493): grey out rows owned by another rep.
                    // ownerIdMap holds numeric owner_user_id per contact (loaded alongside ownerMap).
                    // When no project is selected, ownerIdMap is empty → isForeignRecord returns false.
                    const contactForeign = isForeignRecord(ownerIdMap[row.contact_id] ?? null, userId, safeViewExempt);
                    return (
                      <tr
                        key={row.contact_id}
                        role="button"
                        tabIndex={0}
                        data-rowid={row.contact_id}
                        aria-label={`Preview ${row.full_name || row.company_name || 'contact'}`}
                        onClick={() => setPreviewId(row.contact_id)}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                            e.preventDefault();
                            setPreviewId(row.contact_id);
                          }
                        }}
                        style={{
                          borderBottom: '1px solid var(--color-gray-100)',
                          height: densityMetrics.rowHeight,
                          cursor: 'pointer',
                          transition: 'background 0.1s, height 0.15s ease',
                          background: isSelected ? 'var(--color-brand-subtle)' : undefined,
                          boxShadow: keyNav.focusedId === row.contact_id ? 'inset 3px 0 0 0 var(--color-brand, #1A7EE8)' : undefined,
                          // SAFE_VIEW (ALT-493): muted styling for foreign records.
                          ...foreignRowStyle(contactForeign),
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-hover)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background = isSelected ? 'var(--color-brand-subtle)' : '';
                        }}
                      >
                        {/* Checkbox */}
                        <td
                          style={{ padding: `${densityMetrics.cellPaddingY}px 8px ${densityMetrics.cellPaddingY}px 14px`, verticalAlign: 'middle', width: 36 }}
                          onClick={(e) => { e.stopPropagation(); sel.toggle(row.contact_id); }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => sel.toggle(row.contact_id)}
                            aria-label={`Select ${row.full_name || row.company_name || 'contact'}`}
                            style={{ cursor: 'pointer', accentColor: '#1A7EE8' }}
                          />
                        </td>

                        {/* Dynamic cells */}
                        {columnPrefs.filter((p) => p.visible).map((p) => {
                          switch (p.key) {
                            case 'full_name':
                              return (
                                <td key={p.key} style={{ ...tdStyle, maxWidth: 220 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <ContactAvatar name={row.full_name ?? ''} />
                                    <div style={{ minWidth: 0 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span title={row.full_name || undefined} style={{ fontWeight: 500, color: '#18181b', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                                          {row.full_name || <span style={{ color: '#d1d5db' }}>—</span>}
                                        </span>
                                        {row.is_demo && (
                                          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.4, background: '#F3F4F6', color: '#9CA3AF', borderRadius: 3, padding: '1px 5px' }}>DEMO</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              );

                            case 'company_name':
                              return (
                                <td key={p.key} style={tdStyle}>
                                  {row.company_name || <span style={{ color: '#d1d5db' }}>—</span>}
                                </td>
                              );

                            case 'city_name':
                              return (
                                <td key={p.key} style={tdStyle}>
                                  {row.city_name || <span style={{ color: '#d1d5db' }}>—</span>}
                                </td>
                              );

                            case 'email': {
                              // SAFE_VIEW (ALT-492): mask email for non-owned contacts.
                              // Presentational only; server-side redaction is a future RLS step.
                              const emailDisplay = contactForeign
                                ? maskContact(row.email, 'email')
                                : row.email;
                              return (
                                <td key={p.key} style={{ ...tdStyle, maxWidth: 220 }}>
                                  {emailDisplay || <span style={{ color: '#d1d5db' }}>—</span>}
                                </td>
                              );
                            }

                            case 'linkedin_url': {
                              const url = row.linkedin_url;
                              return (
                                <td key={p.key} style={{ ...tdStyle, width: 60, textAlign: 'center' }}>
                                  {url ? (
                                    <a
                                      href={url.startsWith('http') ? url : `https://linkedin.com/in/${url}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      style={{ color: '#0A66C2', display: 'inline-flex', alignItems: 'center' }}
                                    >
                                      <Link2 size={14} />
                                    </a>
                                  ) : (
                                    <span style={{ color: '#e5e7eb' }}>—</span>
                                  )}
                                </td>
                              );
                            }

                            case 'phone_combined': {
                              // SAFE_VIEW (ALT-492): mask phone for non-owned contacts.
                              // Presentational only; server-side redaction is a future RLS step.
                              if (contactForeign) {
                                const primary = row.mobile_no || row.alt_mobile_no;
                                return (
                                  <td key={p.key} style={{ ...tdStyle, maxWidth: 160 }}>
                                    {primary
                                      ? <span style={{ fontSize: 13, color: 'var(--color-gray-400)' }}>{maskContact(primary, 'phone')}</span>
                                      : <span style={{ color: '#d1d5db' }}>—</span>}
                                  </td>
                                );
                              }
                              return (
                                <td key={p.key} style={{ ...tdStyle, maxWidth: 160 }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    {row.mobile_no && (
                                      <span style={{ fontSize: 13, color: 'var(--color-gray-700)' }}>{row.mobile_no}</span>
                                    )}
                                    {row.alt_mobile_no && (
                                      <span style={{ fontSize: 11, color: '#9ca3af' }}>{row.alt_mobile_no}</span>
                                    )}
                                    {!row.mobile_no && !row.alt_mobile_no && (
                                      <span style={{ color: '#d1d5db' }}>—</span>
                                    )}
                                  </div>
                                </td>
                              );
                            }

                            case 'contact_status': {
                              // Resolve the edit project: global scope, else the
                              // contact's sole project (AMBIG E1) — single-project
                              // contacts skip the "select a project" wall.
                              const effectiveProjectId = resolveProjectFor(row.contact_id);
                              const inMultiple = projectId == null && (contactProjects[row.contact_id]?.length ?? 0) > 1;
                              return (
                                <td key={p.key} style={{ ...tdStyle, maxWidth: 160 }}>
                                  {statusLoading ? (
                                    <Loader2 size={12} className="animate-spin text-stone-300" />
                                  ) : (
                                    <InlineStatusCell
                                      contactId={row.contact_id}
                                      projectId={effectiveProjectId}
                                      current={row.contact_status}
                                      options={statusOptions}
                                      actorId={actorId}
                                      blockedReason={inMultiple ? 'In multiple projects — pick one in the Project selector above' : 'Select a project first'}
                                      onUpdated={handleStatusUpdated}
                                    />
                                  )}
                                </td>
                              );
                            }

                            case 'owner_name':
                              return (
                                <td key={p.key} style={{ ...tdStyle, maxWidth: 160 }}>
                                  {!projectId ? (
                                    <span title="Select a project first" style={{ color: '#d1d5db' }}>—</span>
                                  ) : statusLoading ? (
                                    <Loader2 size={12} className="animate-spin text-stone-300" />
                                  ) : row.owner_name ? (
                                    <span title={row.owner_name}>{row.owner_name}</span>
                                  ) : (
                                    <span style={{ color: '#9ca3af' }}>Unassigned</span>
                                  )}
                                </td>
                              );

                            case 'description':
                              return (
                                <td key={p.key} style={{ ...tdStyle, maxWidth: 200 }}>
                                  {row.description
                                    ? <span title={row.description}>{row.description}</span>
                                    : <span style={{ color: '#d1d5db' }}>—</span>}
                                </td>
                              );

                            case 'comments':
                              return (
                                <td key={p.key} style={{ ...tdStyle, maxWidth: 200 }}>
                                  {row.comments
                                    ? <span title={row.comments}>{row.comments}</span>
                                    : <span style={{ color: '#d1d5db' }}>—</span>}
                                </td>
                              );

                            case 'designation':
                              return (
                                <td key={p.key} style={{ ...tdStyle, maxWidth: 160 }}>
                                  {row.designation || <span style={{ color: '#d1d5db' }}>—</span>}
                                </td>
                              );

                            case 'mobile_no':
                              return (
                                <td key={p.key} style={tdStyle}>
                                  {row.mobile_no || <span style={{ color: '#d1d5db' }}>—</span>}
                                </td>
                              );

                            case 'alt_mobile_no':
                              return (
                                <td key={p.key} style={tdStyle}>
                                  {row.alt_mobile_no || <span style={{ color: '#d1d5db' }}>—</span>}
                                </td>
                              );

                            default:
                              return (
                                <td key={p.key} style={tdStyle}>
                                  {String((row as Record<string, unknown>)[p.key] ?? '—')}
                                </td>
                              );
                          }
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
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPageIndex(0); }}
                  style={{ ...inputBase, height: 28, paddingRight: 22, cursor: 'pointer', fontSize: 12 }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-input)'; }}
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
                    onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
                    disabled={safePage === 0}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      height: 28, padding: '0 10px', fontSize: 12,
                      border: '1px solid var(--border-input)',
                      borderRadius: 'var(--radius-btn)',
                      background: 'var(--color-surface)',
                      color: 'var(--color-gray-600)',
                      cursor: safePage === 0 ? 'not-allowed' : 'pointer',
                      opacity: safePage === 0 ? 0.4 : 1,
                    }}
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={14} />
                    Prev
                  </button>
                  <span style={{ fontSize: 12, padding: '0 4px', color: 'var(--color-gray-500)' }}>
                    Page <span style={{ fontWeight: 600, color: 'var(--color-gray-700)' }}>{safePage + 1}</span> of{' '}
                    <span style={{ fontWeight: 600, color: 'var(--color-gray-700)' }}>{pageCount}</span>
                  </span>
                  <button
                    onClick={() => setPageIndex((i) => Math.min(pageCount - 1, i + 1))}
                    disabled={safePage >= pageCount - 1}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      height: 28, padding: '0 10px', fontSize: 12,
                      border: '1px solid var(--border-input)',
                      borderRadius: 'var(--radius-btn)',
                      background: 'var(--color-surface)',
                      color: 'var(--color-gray-600)',
                      cursor: safePage >= pageCount - 1 ? 'not-allowed' : 'pointer',
                      opacity: safePage >= pageCount - 1 ? 0.4 : 1,
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
                onChange={(e) => { setPageSize(Number(e.target.value)); setPageIndex(0); }}
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
                  onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
                  disabled={safePage === 0}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, height: 28, padding: '0 10px', fontSize: 12,
                    border: '1px solid var(--border-input)', borderRadius: 'var(--radius-btn)',
                    background: 'var(--color-surface)', color: 'var(--color-gray-600)',
                    cursor: safePage === 0 ? 'not-allowed' : 'pointer', opacity: safePage === 0 ? 0.4 : 1,
                  }}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <span style={{ fontSize: 12, padding: '0 4px', color: 'var(--color-gray-500)' }}>
                  Page <span style={{ fontWeight: 600, color: 'var(--color-gray-700)' }}>{safePage + 1}</span> of{' '}
                  <span style={{ fontWeight: 600, color: 'var(--color-gray-700)' }}>{pageCount}</span>
                </span>
                <button
                  onClick={() => setPageIndex((i) => Math.min(pageCount - 1, i + 1))}
                  disabled={safePage >= pageCount - 1}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, height: 28, padding: '0 10px', fontSize: 12,
                    border: '1px solid var(--border-input)', borderRadius: 'var(--radius-btn)',
                    background: 'var(--color-surface)', color: 'var(--color-gray-600)',
                    cursor: safePage >= pageCount - 1 ? 'not-allowed' : 'pointer', opacity: safePage >= pageCount - 1 ? 0.4 : 1,
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
          title="Contact"
          onClose={() => setPreviewId(null)}
          openFullHref={`/contacts/${previewId}`}
        >
          <ContactPreview contactId={previewId} projectId={projectId} />
        </RecordPreviewPanel>
      )}

      {showReassign && (
        <BulkReassignModal
          entityLabel="Contact"
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
          entityLabel="Contact"
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
          entityLabel="Contact"
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

export default ContactsPage;
