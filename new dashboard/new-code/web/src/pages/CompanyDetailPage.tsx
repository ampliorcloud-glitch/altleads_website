import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { pageTransition, pageTransitionConfig } from '../lib/zenAnimations';
import {
  ArrowLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Globe,
  MapPin,
  Building2,
  Hash,
  Mail,
  Link2,
  Plus,
  ChevronDown,
  UserPlus,
  X,
  Check,
  Save,
  ExternalLink,
  Users,
  IndianRupee,
  PhoneCall,
  PhoneOutgoing,
  CalendarPlus,
  ListPlus,
  UserCheck,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { ComposeEmailModal } from '../components/email/ComposeEmailModal';
import { EmailActivityPanel } from '../components/email/EmailActivityPanel';
import { ReassignModal } from '../components/common/ReassignModal';
import { reassignCompany, fetchAssignableUsers, fetchUserLabel } from '../data/assignment';
import { humanizeWriteError } from '../lib/writeError';
import type { UserOption } from '../data/wishlist';
import { StageBadge } from '../components/ui/Badge';
import { CopyButton } from '../components/ui/CopyButton';
import { CreateTaskModal, type TaskAssociation } from '../components/tasks/CreateTaskModal';
import { LogDispositionModal } from '../components/calls/LogDispositionModal';
import { RecordActivityHub } from '../components/tasks/RecordActivityHub';
import type { TaskType } from '../data/tasks';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ProjectSelect } from '../components/ui/ProjectSelect';
import { useProjectScope } from '../contexts/ProjectContext';
import { DispositionForm } from '../components/ui/DispositionForm';
import { ActivityTimeline } from '../components/ui/ActivityTimeline';
import {
  fetchCompanyById,
  fetchCompanyContacts,
  fetchCompanyDeals,
  type Company,
  type CompanyContact,
  type CompanyDeal,
} from '../data/companies';
import { fetchAllContacts, updateContactCompany, type Contact } from '../data/contacts';
import { isConflict, CONFLICT_MESSAGE } from '../lib/concurrency';
import {
  getCompanyStatus,
  upsertCompanyStatus,
  fetchContactStatuses,
  upsertContactStatus,
  fetchActivity,
  logCompanyContactActivity,
  type CompanyProjectStatus,
  type ContactStatusLite,
} from '../data/projectStatus';
import { fetchOptions, type DropdownOption } from '../data/dropdowns';
import { SearchSelect, type SearchSelectOption } from '../components/ui/SearchSelect';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { pushRecent } from '../lib/useRecentlyViewed';
import type { Interaction } from '../data/contacts';
import { HUNGERBOX_FEATURES } from '../lib/hungerbox';
import { CompanySitesPanel } from '../components/hungerbox/CompanySitesPanel';
import { fetchProjectHbSetting, type PrequalGranularity } from '../data/projectHbSettings';
import { gated } from '../lib/roleGating';
import { COLLAB_ASSOC } from '../lib/collabAssoc';
import { CollaboratorsCard } from '../components/collab/CollaboratorsCard';
import { AssociationsPanel } from '../components/collab/AssociationsPanel';
import type { RecordType } from '../lib/collabAssoc';
import { COMPANY_HIERARCHY } from '../lib/companyHierarchyFlag';
import { CompanyHierarchyCard } from '../components/company/CompanyHierarchyCard';
import { STREAM_V1 } from '../lib/streamFlag';
import { StreamPanel } from '../components/stream/StreamPanel';
import { fetchCompanyOptions } from '../data/contacts';

/* ------------------------------------------------------------------
   Helpers
------------------------------------------------------------------ */
function companyInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '—';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function fullUrl(webUrl: string): string {
  if (!webUrl) return '';
  return /^https?:\/\//.test(webUrl) ? webUrl : `https://${webUrl}`;
}

type TabKey = 'contacts' | 'leads' | 'activity' | 'sites';
const TABS: { key: TabKey; label: string; hbOnly?: boolean }[] = [
  { key: 'contacts', label: 'Contacts' },
  { key: 'leads', label: 'Leads' },
  { key: 'activity', label: 'Activity' },
  // Sites tab only shown when HUNGERBOX_FEATURES is enabled (dark-shipped)
  ...(HUNGERBOX_FEATURES ? [{ key: 'sites' as const, label: 'Sites', hbOnly: true }] : []),
];

/* ------------------------------------------------------------------
   Meta item in the header (icon + value)
------------------------------------------------------------------ */
function MetaItem({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-stone-500" style={{ fontSize: 13 }}>
      <span className="text-stone-400">{icon}</span>
      {children}
    </span>
  );
}

/* Labelled detail cell for the company "About" grid (icon + label + value). */
function Detail({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
      <span style={{ color: '#9CA3AF', marginTop: 1, flexShrink: 0 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
        <div style={{ fontSize: 13, color: '#374151', wordBreak: 'break-word' }}>{children}</div>
      </div>
    </div>
  );
}

/** Format an employee count with Indian grouping; em-dash when unknown. */
function fmtSize(size: number | null): string {
  return size != null ? size.toLocaleString('en-IN') : '—';
}

/* ------------------------------------------------------------------
   Link-existing-contact modal (Fix #6)
------------------------------------------------------------------ */
interface LinkContactModalProps {
  companyId: number;
  companyName: string;
  onLinked: () => void;
  onClose: () => void;
}

function LinkContactModal({ companyId, companyName, onLinked, onClose }: LinkContactModalProps) {
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    fetchAllContacts().then(({ contacts }) => {
      setAllContacts(contacts);
      setLoadingContacts(false);
    });
  }, []);

  const contactOptions: SearchSelectOption[] = allContacts.map((c) => {
    const hint = c.company_name && c.company_id !== companyId
      ? `currently: ${c.company_name}`
      : c.company_id === companyId
      ? 'already linked'
      : undefined;
    return {
      id: c.contact_id,
      label: c.full_name,
      sublabel: [c.email ?? undefined, hint].filter(Boolean).join(' · ') || undefined,
    };
  });

  async function handleLink() {
    if (!selectedId) return;
    setSaving(true);
    setSaveError(null);
    const res = await updateContactCompany(selectedId, companyId);
    setSaving(false);
    if (isConflict(res)) {
      setSaveError(CONFLICT_MESSAGE);
      return;
    }
    if (res.error) {
      setSaveError(res.error);
      return;
    }
    onLinked();
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 500,
    background: 'rgba(0,0,0,0.35)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  const modalStyle: React.CSSProperties = {
    background: '#fff', borderRadius: 10,
    padding: '24px 28px', width: '100%', maxWidth: 480,
    boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
    position: 'relative',
  };

  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>
            Link existing contact
          </h3>
          <button aria-label="Close" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}>
            <X size={16} />
          </button>
        </div>

        <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 14 }}>
          Select a contact to link to <strong>{companyName}</strong>. Their company will be updated.
        </p>

        {loadingContacts ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9CA3AF', fontSize: 13 }}>
            <Loader2 size={14} className="animate-spin" /> Loading contacts…
          </div>
        ) : (
          <SearchSelect
            options={contactOptions}
            value={selectedId}
            onChange={setSelectedId}
            placeholder="Search contacts by name, email or company…"
          />
        )}

        {saveError && (
          <p style={{ fontSize: 12, color: '#EF4444', marginTop: 10 }}>{saveError}</p>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              fontSize: 13, padding: '7px 14px',
              border: '1px solid #d4d4d8', borderRadius: 'var(--radius-btn)',
              background: '#fff', color: '#6B7280', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleLink}
            disabled={!selectedId || saving}
            style={{
              fontSize: 13, padding: '7px 16px',
              background: selectedId && !saving ? '#1A7EE8' : '#93c5fd',
              color: '#fff', border: 'none', borderRadius: 'var(--radius-btn)',
              cursor: selectedId && !saving ? 'pointer' : 'not-allowed',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
            {saving ? 'Linking…' : 'Link contact'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   ACCOUNT PANEL (per-project status, feasibility, decision power)
   // TODO visibility: per-project status/notes are owner + admin only (security pass)
------------------------------------------------------------------ */
interface AccountPanelProps {
  companyId: number;
  projectId: number | null;
  actorId: string | null;
}

function AccountPanel({ companyId, projectId, actorId }: AccountPanelProps) {
  const [status, setStatus] = useState<CompanyProjectStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  // Per-project owner + reassignment (ALT-288)
  const { canReassign } = useAuth();
  const [ownerName, setOwnerName] = useState('');
  const [showReassign, setShowReassign] = useState(false);
  const [reassignSaving, setReassignSaving] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [reassignOwners, setReassignOwners] = useState<UserOption[]>([]);

  // Dropdown options
  const [accountStatusOpts, setAccountStatusOpts] = useState<DropdownOption[]>([]);
  const [feasibilityOpts, setFeasibilityOpts] = useState<DropdownOption[]>([]);
  const [decisionPowerOpts, setDecisionPowerOpts] = useState<DropdownOption[]>([]);

  // Form state (local draft)
  const [draft, setDraft] = useState<{
    account_status: string;
    is_feasible: string; // 'feasible' | 'not_feasible' | 'unknown' | ''
    decision_power: string;
    description: string;
    comments: string;
  }>({ account_status: '', is_feasible: '', decision_power: '', description: '', comments: '' });

  // Load dropdown options once
  useEffect(() => {
    fetchOptions('account_status').then(setAccountStatusOpts);
    fetchOptions('feasibility').then(setFeasibilityOpts);
    fetchOptions('decision_power').then(setDecisionPowerOpts);
  }, []);

  // Load saved status when project changes
  useEffect(() => {
    if (!projectId || !companyId) {
      setStatus(null);
      setDraft({ account_status: '', is_feasible: '', decision_power: '', description: '', comments: '' });
      return;
    }
    let cancelled = false;
    setLoading(true);
    getCompanyStatus(companyId, projectId).then((s) => {
      if (cancelled) return;
      setStatus(s);
      setDraft({
        account_status: s?.account_status ?? '',
        is_feasible: s?.is_feasible ?? '',
        decision_power: s?.decision_power ?? '',
        description: s?.description ?? '',
        comments: s?.comments ?? '',
      });
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [companyId, projectId]);

  // Resolve the per-project owner's display name whenever it changes.
  useEffect(() => {
    let cancelled = false;
    fetchUserLabel(status?.owner_user_id ?? null).then((n) => { if (!cancelled) setOwnerName(n); });
    return () => { cancelled = true; };
  }, [status?.owner_user_id]);

  const openReassign = async () => {
    if (!projectId) return;
    setReassignError(null);
    setReassignOwners([]);
    setShowReassign(true);
    const owners = await fetchAssignableUsers(status?.owner_user_id ?? null);
    setReassignOwners(owners);
  };

  const handleReassign = async (newUserId: number) => {
    if (!projectId) return;
    setReassignSaving(true);
    setReassignError(null);
    const res = await reassignCompany({
      companyId,
      projectId,
      newUserId,
      actor: actorId ?? '',
      isReassign: status?.owner_user_id != null,
    });
    setReassignSaving(false);
    if (res?.error) { setReassignError(humanizeWriteError(res.error)); return; }
    setShowReassign(false);
    const refreshed = await getCompanyStatus(companyId, projectId);
    setStatus(refreshed);
  };

  async function handleSave() {
    if (!projectId) return;
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    const patch = {
      account_status: draft.account_status || null,
      is_feasible: draft.is_feasible || null,
      decision_power: draft.decision_power || null,
      description: draft.description || null,
      comments: draft.comments || null,
    };
    const { error } = await upsertCompanyStatus(companyId, projectId, patch, actorId);
    setSaving(false);
    if (error) { setSaveError(error); return; }
    setSaveOk(true);
    setTimeout(() => setSaveOk(false), 2000);
    // Refresh saved status
    const refreshed = await getCompanyStatus(companyId, projectId);
    setStatus(refreshed);
  }

  const fieldStyle: React.CSSProperties = {
    fontSize: 12,
    padding: '5px 8px',
    border: '1px solid #d4d4d8',
    borderRadius: 5,
    background: '#fff',
    color: '#18181b',
    width: '100%',
    appearance: 'none' as const,
  };

  const labelStyle: React.CSSProperties = { fontSize: 11, color: '#6B7280', fontWeight: 500, marginBottom: 3, display: 'block' };

  if (!projectId) {
    return (
      <div style={{ fontSize: 13, color: '#9ca3af', padding: '4px 0' }}>Select a project to view account status.</div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#9ca3af', fontSize: 13 }}>
        <Loader2 size={13} className="animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Owner (this project) + reassign (ALT-288) */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <label style={labelStyle}>Owner (this project)</label>
          <div style={{ fontSize: 13, color: ownerName ? '#18181b' : '#9ca3af' }}>
            {ownerName || 'Unassigned'}
          </div>
        </div>
        {canReassign && (
          <button
            type="button"
            onClick={openReassign}
            className="inline-flex items-center gap-1.5 border border-stone-300 hover:border-stone-400 bg-white hover:bg-stone-50 text-stone-700 font-medium transition-colors"
            style={{ fontSize: 12, padding: '5px 10px', height: 30, borderRadius: 'var(--radius-btn)' }}
            title="Assign this company (in this project) to a salesperson"
          >
            <UserCheck size={13} />
            {ownerName ? 'Change owner' : 'Assign owner'}
          </button>
        )}
      </div>

      {/* Row 1: account_status + feasibility + decision_power */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div>
          <label style={labelStyle}>Account Status</label>
          <div className="relative">
            <select
              value={draft.account_status}
              onChange={(e) => setDraft((d) => ({ ...d, account_status: e.target.value }))}
              style={{ ...fieldStyle, paddingRight: 22, height: 30 }}
            >
              <option value="">—</option>
              {accountStatusOpts.map((o) => (
                <option key={o.option_id} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown size={12} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
          </div>
          {draft.account_status && (
            <div style={{ marginTop: 4 }}>
              <StatusBadge value={draft.account_status} category="account_status" />
            </div>
          )}
        </div>

        <div>
          <label style={labelStyle}>Feasibility</label>
          <div className="relative">
            <select
              value={draft.is_feasible}
              onChange={(e) => setDraft((d) => ({ ...d, is_feasible: e.target.value }))}
              style={{ ...fieldStyle, paddingRight: 22, height: 30 }}
            >
              <option value="">—</option>
              {feasibilityOpts.length > 0
                ? feasibilityOpts.map((o) => (
                    <option key={o.option_id} value={o.value}>{o.label}</option>
                  ))
                : (
                  <>
                    <option value="feasible">Feasible</option>
                    <option value="not_feasible">Not Feasible</option>
                    <option value="unknown">Unknown</option>
                  </>
                )}
            </select>
            <ChevronDown size={12} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
          </div>
          {draft.is_feasible !== '' && (
            <div style={{ marginTop: 4 }}>
              <StatusBadge value={draft.is_feasible} category="feasibility" />
            </div>
          )}
        </div>

        <div>
          <label style={labelStyle}>Decision Power</label>
          <div className="relative">
            <select
              value={draft.decision_power}
              onChange={(e) => setDraft((d) => ({ ...d, decision_power: e.target.value }))}
              style={{ ...fieldStyle, paddingRight: 22, height: 30 }}
            >
              <option value="">—</option>
              {decisionPowerOpts.map((o) => (
                <option key={o.option_id} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown size={12} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
          </div>
          {draft.decision_power && (
            <div style={{ marginTop: 4 }}>
              <StatusBadge value={draft.decision_power} category="decision_power" />
            </div>
          )}
        </div>
      </div>

      {/* Row 2: description */}
      <div>
        <label style={labelStyle}>Description</label>
        <textarea
          value={draft.description}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          rows={2}
          placeholder="Brief description…"
          style={{ ...fieldStyle, resize: 'vertical', fontFamily: 'inherit', fontSize: 12, lineHeight: 1.4 }}
        />
      </div>

      {/* Row 3: comments */}
      <div>
        <label style={labelStyle}>Comments</label>
        <textarea
          value={draft.comments}
          onChange={(e) => setDraft((d) => ({ ...d, comments: e.target.value }))}
          rows={2}
          placeholder="Internal comments…"
          style={{ ...fieldStyle, resize: 'vertical', fontFamily: 'inherit', fontSize: 12, lineHeight: 1.4 }}
        />
      </div>

      {saveError && <div style={{ fontSize: 11, color: '#dc2626' }}>{saveError}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !projectId}
          style={{
            fontSize: 12, fontWeight: 600,
            padding: '5px 14px',
            border: 'none', borderRadius: 'var(--radius-btn)',
            background: saving ? '#93c5fd' : '#1A7EE8',
            color: '#fff',
            cursor: saving ? 'not-allowed' : 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saveOk && <span style={{ fontSize: 11, color: '#16a34a' }}>Saved</span>}
        {status && (status.account_status || status.description || status.comments) && (
          <span style={{ fontSize: 11, color: '#9ca3af' }}>Status saved</span>
        )}
      </div>

      {showReassign && (
        <ReassignModal
          entityLabel="Company"
          ownerLabel="Owner"
          currentOwnerId={status?.owner_user_id ?? null}
          owners={reassignOwners}
          saving={reassignSaving}
          error={reassignError}
          onConfirm={handleReassign}
          onClose={() => setShowReassign(false)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------
   Per-contact inline row panel — disposition + per-project status fields
   // TODO visibility: per-project status/notes are owner + admin only (security pass)
------------------------------------------------------------------ */
interface ContactRowPanelProps {
  contact: CompanyContact;
  companyId: number;
  projectId: number | null;
  actorId: string | null;
  ownerUserId: number | null;
  statusLite: ContactStatusLite | undefined;
  onStatusChange: (contactId: number, lite: ContactStatusLite) => void;
  /** Bump to tell the page an activity was logged so the company feed can refresh. */
  onActivityLogged: () => void;
  linkedinAsText: boolean;
  showDisposition: boolean;
  showDescription: boolean;
  showComments: boolean;
}

function ContactRowPanel({
  contact,
  companyId,
  projectId,
  actorId,
  ownerUserId,
  statusLite,
  onStatusChange,
  onActivityLogged,
  linkedinAsText,
  showDisposition,
  showDescription,
  showComments,
}: ContactRowPanelProps) {
  const contactIdNum = Number(contact.id);
  const toast = useToast();
  const [logOpen, setLogOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [contactStatusOpts, setContactStatusOpts] = useState<DropdownOption[]>([]);
  const [draftStatus, setDraftStatus] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [draftComments, setDraftComments] = useState('');
  const [saving, setSaving] = useState(false);
  const [dispKey, setDispKey] = useState(0); // forces DispositionForm remount on log

  // The last-saved values (from statusLite) — drafts are "dirty" when they differ.
  const savedStatus = statusLite?.contact_status ?? '';
  const savedDesc = statusLite?.description ?? '';
  const savedComments = statusLite?.comments ?? '';

  // Seed draft from statusLite whenever it changes
  useEffect(() => {
    setDraftStatus(savedStatus);
    setDraftDesc(savedDesc);
    setDraftComments(savedComments);
  }, [statusLite]);

  // Load contact_status options once
  useEffect(() => {
    fetchOptions('contact_status').then(setContactStatusOpts);
  }, []);

  const dirty =
    draftStatus !== savedStatus || draftDesc !== savedDesc || draftComments !== savedComments;

  function discard() {
    setDraftStatus(savedStatus);
    setDraftDesc(savedDesc);
    setDraftComments(savedComments);
  }

  async function handleSave() {
    if (!projectId || !dirty) return;
    setSaving(true);
    const patch = {
      contact_status: draftStatus || null,
      description: draftDesc || null,
      comments: draftComments || null,
    };
    const { error } = await upsertContactStatus(contactIdNum, projectId, patch, actorId);
    setSaving(false);
    if (error) { toast.error(humanizeWriteError(error) ?? 'Something went wrong. Please try again.'); return; }
    onStatusChange(contactIdNum, {
      contact_status: draftStatus || null,
      description: draftDesc || null,
      comments: draftComments || null,
    });
    // Mirror this contact activity onto the COMPANY's project feed so it shows
    // in the company's Activity tab (separate per project), not just the
    // contact's own timeline. Reuses the shared interaction table.
    const changes: string[] = [];
    if (draftStatus !== savedStatus) changes.push(`status → ${draftStatus || '—'}`);
    if (draftDesc !== savedDesc) changes.push('description updated');
    if (draftComments !== savedComments) changes.push('comments updated');
    void logCompanyContactActivity({
      companyId,
      projectId,
      contactName: contact.fullName,
      type: 'status_change',
      noteText: changes.length ? changes.join('; ') : 'status updated',
      ownerUserId,
      actorId,
    }).then(() => onActivityLogged());
    toast.success(`Saved ${contact.fullName || 'contact'}`);
  }

  const inputSm: React.CSSProperties = {
    fontSize: 12, padding: '5px 8px',
    border: `1px solid ${dirty ? '#93c5fd' : '#d4d4d8'}`, borderRadius: 5,
    background: '#fff', color: '#18181b', width: '100%', fontFamily: 'inherit',
  };

  return (
    <div
      className="rounded-lg"
      style={{ border: `1px solid ${dirty ? '#bfdbfe' : 'var(--border-color)'}`, background: 'var(--color-surface)' }}
    >
      {/* Main contact row: identity (left) + Log-call toggle (right) */}
      <div className="flex items-start justify-between gap-4 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Name → opens the contact record in a NEW TAB */}
            <a
              href={`/contacts/${contactIdNum}`}
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium text-stone-900 hover:text-blue-600 hover:underline inline-flex items-center gap-1"
              style={{ fontSize: 14 }}
              title="Open contact in a new tab"
            >
              {contact.fullName || <span className="text-stone-400">Unnamed contact</span>}
              <ExternalLink size={11} className="text-stone-400" />
            </a>
            {contact.designation && (
              <span className="text-stone-500" style={{ fontSize: 12 }}>· {contact.designation}</span>
            )}
            {statusLite?.contact_status && (
              <StatusBadge value={statusLite.contact_status} category="contact_status" />
            )}
          </div>
          {/* SAFE_VIEW (ALT-492): contact email/phone masking — the record owner is
              company_project_status.owner_user_id, held inside AccountPanel state and
              not propagated here without a prop/fetch change. Masking is N/A at this
              level; will be wired when ownership is unified (TODO ownership). */}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {contact.email ? (
              <span className="flex items-center gap-2">
                <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-stone-500 hover:text-blue-600" style={{ fontSize: 12 }}>
                  <Mail size={12} /> {contact.email}
                </a>
                <button
                  type="button"
                  onClick={() => setEmailOpen(true)}
                  className="hover:text-blue-600"
                  style={{ fontSize: 11.5, color: 'var(--color-brand)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 500 }}
                  title="Send an email as yourself — logged on the record (ALT-503)"
                >Send email</button>
                <ComposeEmailModal
                  open={emailOpen}
                  onClose={() => setEmailOpen(false)}
                  to={contact.email}
                  projectId={projectId}
                  contactId={contactIdNum}
                  recordName={contact.fullName}
                />
              </span>
            ) : (
              <span className="flex items-center gap-1" style={{ fontSize: 12, color: '#D1D5DB' }}>
                <Mail size={12} /> —
              </span>
            )}
            {contact.phone ? (
              <span className="flex items-center gap-1 text-stone-500" style={{ fontSize: 12 }}>
                {contact.phone}
              </span>
            ) : (
              <span style={{ fontSize: 12, color: '#D1D5DB' }}>—</span>
            )}
            {contact.linkedin ? (
              <a
                href={fullUrl(contact.linkedin)}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-1 text-stone-500 hover:text-blue-600"
                title={contact.linkedin}
                style={{ fontSize: 12 }}
              >
                {linkedinAsText ? <ExternalLink size={12} /> : <Link2 size={12} />}
                {linkedinAsText ? contact.linkedin : 'LinkedIn'}
              </a>
            ) : (
              <span style={{ fontSize: 12, color: '#D1D5DB' }}>—</span>
            )}
          </div>
        </div>

        {/* Log-call toggle (replaces the bare expand arrow) */}
        {showDisposition && projectId && (
          <button
            type="button"
            onClick={() => setLogOpen((v) => !v)}
            className="shrink-0 inline-flex items-center gap-1.5 font-medium transition-colors"
            style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 'var(--radius-btn)',
              border: '1px solid #d4d4d8', background: logOpen ? '#EFF6FF' : '#fff',
              color: logOpen ? '#1A7EE8' : '#6B7280', cursor: 'pointer',
            }}
            title="Log a call for this contact"
          >
            <ChevronDown size={12} style={{ transform: logOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            Log call
          </button>
        )}
      </div>

      {/* Inline editor strip — uses the row width; tick (✓) saves, ✗ discards.
          No need to expand a panel; edit any field then click the green check. */}
      {projectId ? (
        <div
          className="px-4 pb-3"
          style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}
        >
          <div style={{ minWidth: 150 }}>
            <label style={{ fontSize: 10, color: '#6B7280', fontWeight: 600, display: 'block', marginBottom: 2 }}>Status</label>
            <div className="relative">
              <select
                value={draftStatus}
                onChange={(e) => setDraftStatus(e.target.value)}
                title="Contact status for this project"
                style={{ ...inputSm, padding: '5px 22px 5px 8px', appearance: 'none', cursor: 'pointer', color: '#374151' }}
              >
                <option value="">Status…</option>
                {contactStatusOpts.map((o) => (
                  <option key={o.option_id} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown size={11} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
            </div>
          </div>

          {showDescription && (
            <div style={{ flex: 1, minWidth: 180 }}>
              <label style={{ fontSize: 10, color: '#6B7280', fontWeight: 600, display: 'block', marginBottom: 2 }}>Description</label>
              <input
                value={draftDesc}
                onChange={(e) => setDraftDesc(e.target.value)}
                placeholder="Add a description…"
                style={inputSm}
                onKeyDown={(e) => { if (e.key === 'Enter' && dirty) void handleSave(); }}
              />
            </div>
          )}

          {showComments && (
            <div style={{ flex: 1, minWidth: 180 }}>
              <label style={{ fontSize: 10, color: '#6B7280', fontWeight: 600, display: 'block', marginBottom: 2 }}>Comments</label>
              <input
                value={draftComments}
                onChange={(e) => setDraftComments(e.target.value)}
                placeholder="Add a comment…"
                style={inputSm}
                onKeyDown={(e) => { if (e.key === 'Enter' && dirty) void handleSave(); }}
              />
            </div>
          )}

          {/* Save (tick) / Discard (✗) — only while there are unsaved changes */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 30 }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving}
              title={dirty ? 'Save changes' : 'No changes to save'}
              style={{
                width: 30, height: 30, borderRadius: 'var(--radius-btn)', border: 'none',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: dirty && !saving ? '#16A34A' : '#E5E7EB',
                color: dirty && !saving ? '#fff' : '#9CA3AF',
                cursor: dirty && !saving ? 'pointer' : 'not-allowed',
              }}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={16} strokeWidth={2.5} />}
            </button>
            {dirty && !saving && (
              <button
                type="button"
                onClick={discard}
                title="Discard changes"
                style={{
                  width: 30, height: 30, borderRadius: 'var(--radius-btn)',
                  border: '1px solid #E5E7EB', background: '#fff', color: '#9CA3AF',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="px-4 pb-3" style={{ fontSize: 11, color: '#9CA3AF' }}>
          Select a project (top-right) to update this contact's status.
        </div>
      )}

      {/* Log-call panel (toggled) */}
      {logOpen && showDisposition && projectId && (
        <div style={{ borderTop: '1px solid #e5e7eb', background: '#f9fafb', padding: '10px 14px', borderRadius: '0 0 var(--radius-card) var(--radius-card)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Log call
          </div>
          <DispositionForm
            key={dispKey}
            recordType="contact"
            recordId={contactIdNum}
            projectId={projectId}
            ownerUserId={ownerUserId}
            actorId={actorId}
            onLogged={({ disposition, noteText }) => {
              // interactionId is also available here (ALT-430) but not needed
              // for the company-mirror path — only used in RecordActivityHub.
              setDispKey((k) => k + 1);
              // Mirror the logged call onto the COMPANY's project feed.
              void logCompanyContactActivity({
                companyId,
                projectId,
                contactName: contact.fullName,
                type: 'call',
                disposition,
                noteText,
                ownerUserId,
                actorId,
              }).then(() => onActivityLogged());
            }}
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------
   CONTACTS tab — grouped by city, with per-project inline fields
------------------------------------------------------------------ */
interface ContactsTabProps {
  contacts: CompanyContact[];
  companyId: string;
  companyIdNum: number;
  projectId: number | null;
  actorId: string | null;
  ownerUserId: number | null;
  onActivityLogged: () => void;
}

function ContactsTab({ contacts, companyId, companyIdNum, projectId, actorId, ownerUserId, onActivityLogged }: ContactsTabProps) {
  const navigate = useNavigate();

  // Per-contact status lite (keyed by numeric contact_id)
  const [statusMap, setStatusMap] = useState<Record<number, ContactStatusLite>>({});
  const [loadingStatuses, setLoadingStatuses] = useState(false);

  // Field visibility toggles (compact toggle set)
  const [linkedinAsText, setLinkedinAsText] = useState(false);
  const [showDisposition, setShowDisposition] = useState(true);
  const [showDescription, setShowDescription] = useState(true);
  const [showComments, setShowComments] = useState(true);

  // Load per-contact statuses for selected project
  useEffect(() => {
    if (!projectId || contacts.length === 0) {
      setStatusMap({});
      return;
    }
    let cancelled = false;
    setLoadingStatuses(true);
    const ids = contacts.map((c) => Number(c.id));
    fetchContactStatuses(projectId, ids).then((map) => {
      if (cancelled) return;
      setStatusMap(map);
      setLoadingStatuses(false);
    });
    return () => { cancelled = true; };
  }, [projectId, contacts]);

  const handleStatusChange = useCallback((contactId: number, lite: ContactStatusLite) => {
    setStatusMap((prev) => ({ ...prev, [contactId]: lite }));
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, CompanyContact[]>();
    contacts.forEach((c) => {
      const key = c.city || 'No city';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [contacts]);

  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <Building2 size={28} className="text-stone-300" />
        <p className="text-stone-500" style={{ fontSize: 14 }}>No contacts yet for this company.</p>
        <button
          onClick={() => navigate(`/contacts/new?company=${companyId}`)}
          className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-medium transition-colors"
          style={{ fontSize: 13 }}
        >
          <Plus size={14} />
          Add Contact
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Field-visibility toggles */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        paddingBottom: 10, borderBottom: '1px solid #f3f4f6',
      }}>
        <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.4 }}>Show per row:</span>
        {[
          { key: 'disposition', label: 'Disposition', value: showDisposition, set: setShowDisposition },
          { key: 'description', label: 'Description', value: showDescription, set: setShowDescription },
          { key: 'comments', label: 'Comments', value: showComments, set: setShowComments },
        ].map(({ key, label, value, set }) => (
          <button
            key={key}
            type="button"
            onClick={() => set((v) => !v)}
            style={{
              fontSize: 11, padding: '2px 8px',
              border: `1px solid ${value ? '#1A7EE8' : '#d4d4d8'}`,
              borderRadius: 'var(--radius-btn)',
              background: value ? '#EFF6FF' : '#fff',
              color: value ? '#1D4ED8' : '#6B7280',
              cursor: 'pointer', fontWeight: value ? 600 : 400,
            }}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setLinkedinAsText((v) => !v)}
          style={{
            fontSize: 11, padding: '2px 8px',
            border: `1px solid ${linkedinAsText ? '#1A7EE8' : '#d4d4d8'}`,
            borderRadius: 'var(--radius-btn)',
            background: linkedinAsText ? '#EFF6FF' : '#fff',
            color: linkedinAsText ? '#1D4ED8' : '#6B7280',
            cursor: 'pointer', fontWeight: linkedinAsText ? 600 : 400,
          }}
        >
          LinkedIn: {linkedinAsText ? 'full URL' : 'icon'}
        </button>
        {loadingStatuses && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#9ca3af' }}>
            <Loader2 size={11} className="animate-spin" /> Loading statuses…
          </span>
        )}
      </div>

      {/* Grouped contacts */}
      {grouped.map(([city, items]) => (
        <div key={city}>
          <div className="flex items-center gap-2 mb-2">
            <MapPin size={13} className="text-stone-400" />
            <h4 className="font-semibold text-stone-700" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {city}
            </h4>
            <span className="text-stone-300" style={{ fontSize: 12 }}>({items.length})</span>
          </div>
          <div className="space-y-2">
            {items.map((c) => (
              <ContactRowPanel
                key={c.id}
                contact={c}
                companyId={companyIdNum}
                projectId={projectId}
                actorId={actorId}
                ownerUserId={ownerUserId}
                statusLite={statusMap[Number(c.id)]}
                onStatusChange={handleStatusChange}
                onActivityLogged={onActivityLogged}
                linkedinAsText={linkedinAsText}
                showDisposition={showDisposition}
                showDescription={showDescription}
                showComments={showComments}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------
   DEALS tab
------------------------------------------------------------------ */
function DealsTab({ deals }: { deals: CompanyDeal[] }) {
  if (deals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <Hash size={28} className="text-stone-300" />
        <p className="text-stone-500" style={{ fontSize: 14 }}>No leads linked to this company yet.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {deals.map((d) => (
        <a
          key={d.id}
          href={`/leads/${d.id}`}
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-center justify-between gap-4 rounded-lg px-4 py-3 cursor-pointer transition-colors"
          style={{ border: '1px solid var(--border-color)', background: 'var(--color-surface)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-gray-50)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface)'; }}
        >
          <div className="min-w-0">
            <p className="font-medium text-stone-900 truncate inline-flex items-center gap-1" style={{ fontSize: 14 }}>
              {d.leadName || <span className="text-stone-400">Untitled lead</span>}
              <ExternalLink size={11} className="text-stone-400" />
            </p>
            {d.leadNumber && (
              <p className="text-stone-400 font-mono" style={{ fontSize: 11 }}>{d.leadNumber}</p>
            )}
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <StageBadge stage={d.stage} />
            <span className="text-stone-400" style={{ fontSize: 12 }}>{d.createdDate || '—'}</span>
          </div>
        </a>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------
   ACTIVITY tab — full interaction timeline for this company
------------------------------------------------------------------ */
interface ActivityTabProps {
  companyId: number;
  projectId: number | null;
  /** Bumped by the parent when a related-contact activity is logged, to re-fetch. */
  refreshKey: number;
}

function ActivityTab({ companyId, projectId, refreshKey }: ActivityTabProps) {
  const [items, setItems] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchActivity('company', companyId, projectId ?? undefined).then((rows) => {
      if (cancelled) return;
      setItems(rows);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [companyId, projectId, refreshKey]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#9ca3af', fontSize: 13 }}>
        <Loader2 size={14} className="animate-spin" /> Loading activity…
      </div>
    );
  }

  return <ActivityTimeline items={items} emptyText="No activity yet for this company." />;
}

/* ------------------------------------------------------------------
   One-click task actions — schedule a follow-up tied to this company.
   Reuses the shared CreateTaskModal; no task logic duplicated here.
------------------------------------------------------------------ */
function QuickTaskActions({
  association,
  companyId,
  projectId: logProjectId,
  ownerUserId,
  actorId,
  recordName,
}: {
  association: TaskAssociation;
  companyId: number;
  projectId?: number | null;
  ownerUserId: number | null;
  actorId: string | null;
  recordName: string;
}) {
  const [modal, setModal] = useState<{ type: TaskType; subject: string } | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  const name = recordName || 'this record';
  const variants: {
    key: string;
    label: string;
    icon: React.ReactNode;
    type: TaskType;
    subject: string;
  }[] = [
    { key: 'call', label: 'Call back', icon: <PhoneCall size={13} />, type: 'CALL', subject: `Call back — ${name}` },
    { key: 'meeting', label: 'Schedule meeting', icon: <CalendarPlus size={13} />, type: 'MEETING', subject: `Meeting — ${name}` },
    { key: 'task', label: 'Add task', icon: <ListPlus size={13} />, type: 'TODO', subject: '' },
  ];

  const btnStyle: React.CSSProperties = {
    fontSize: 12,
    padding: '5px 11px',
    height: 30,
    borderRadius: 'var(--radius-btn)',
    border: '1px solid #d4d4d8',
    background: '#fff',
    color: '#374151',
    cursor: 'pointer',
  };
  const onEnter = (e: React.MouseEvent) => {
    (e.currentTarget as HTMLElement).style.borderColor = '#1A7EE8';
    (e.currentTarget as HTMLElement).style.color = '#1A7EE8';
  };
  const onLeave = (e: React.MouseEvent) => {
    (e.currentTarget as HTMLElement).style.borderColor = '#d4d4d8';
    (e.currentTarget as HTMLElement).style.color = '#374151';
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {variants.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setModal({ type: v.type, subject: v.subject })}
            className="inline-flex items-center gap-1.5 font-medium transition-colors"
            style={btnStyle}
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            title={`${v.label} (creates a task tied to ${name})`}
          >
            {v.icon}
            {v.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setLogOpen(true)}
          className="inline-flex items-center gap-1.5 font-medium transition-colors"
          style={btnStyle}
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          title={`Log a call that already happened with ${name}`}
        >
          <PhoneOutgoing size={13} />
          Log call
        </button>
      </div>

      <CreateTaskModal
        open={modal !== null}
        onClose={() => setModal(null)}
        association={association}
        initialType={modal?.type}
        initialSubject={modal?.subject}
      />

      <LogDispositionModal
        open={logOpen}
        onClose={() => setLogOpen(false)}
        recordType="company"
        recordId={companyId}
        projectId={logProjectId ?? null}
        ownerUserId={ownerUserId}
        actorId={actorId}
      />
    </>
  );
}

/* ------------------------------------------------------------------
   Page
------------------------------------------------------------------ */
export function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, canCreateData, canEditCompanyContact } = useAuth();
  const companyId = Number(id);

  // actorId is the acting user's user_id as text
  const actorId = profile?.user_id != null ? String(profile.user_id) : null;
  const ownerUserId = profile?.user_id ?? null;

  const [company, setCompany] = useState<Company | null>(null);
  const [contacts, setContacts] = useState<CompanyContact[]>([]);
  const [deals, setDeals] = useState<CompanyDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [companyEmailOpen, setCompanyEmailOpen] = useState(false);
  const [emailsRefresh, setEmailsRefresh] = useState(0);
  const [tab, setTab] = useState<TabKey>(() => {
    // ALT-UX-10: persist active tab across reloads, per-company.
    try {
      const stored = localStorage.getItem(`altleads:tab:company:${id}`);
      const VALID: TabKey[] = ['contacts', 'leads', 'activity', 'sites'];
      if (stored && (VALID as string[]).includes(stored)) return stored as TabKey;
    } catch { /* localStorage unavailable */ }
    return 'contacts';
  });

  // Shared project selection — lifted to page level so header + contacts tab stay in sync.
  // Seeded from (and kept in sync with) the GLOBAL top-bar project selector (ALT-273)
  // so this record's per-project view opens in the project the user picked.
  const { selectedProjectId } = useProjectScope();
  const [projectId, setProjectId] = useState<number | null>(selectedProjectId);
  useEffect(() => {
    if (selectedProjectId != null) setProjectId(selectedProjectId);
  }, [selectedProjectId]);

  // ALT-464: prequalified-question granularity for the active project (HungerBox only).
  // Defaults to 'site' while loading or when HUNGERBOX_FEATURES is off.
  const [hbGranularity, setHbGranularity] = useState<PrequalGranularity>('site');
  useEffect(() => {
    if (!HUNGERBOX_FEATURES || projectId == null) { setHbGranularity('site'); return; }
    fetchProjectHbSetting(projectId).then(({ setting }) => {
      setHbGranularity(setting.prequalified_granularity);
    });
  }, [projectId]);

  // Fix #6 — link existing contact
  const [showLinkModal, setShowLinkModal] = useState(false);

  // Bumped whenever an activity is logged on a related contact, so the company
  // Activity tab re-fetches and shows the mirrored company-scoped entry.
  const [activityRefresh, setActivityRefresh] = useState(0);
  const handleActivityLogged = useCallback(() => setActivityRefresh((n) => n + 1), []);

  // COLLAB_ASSOC: user + target options for the collab/association cards.
  const [collabUserOptions, setCollabUserOptions] = useState<SearchSelectOption[]>([]);
  const [collabTargetOptions, setCollabTargetOptions] = useState<Record<RecordType, SearchSelectOption[]>>({
    lead: [], contact: [], company: [], meeting: [],
  });

  useEffect(() => {
    let cancelled = false;
    if (!companyId) { setNotFound(true); setLoading(false); return; }
    setLoading(true);
    (async () => {
      const co = await fetchCompanyById(companyId);
      if (cancelled) return;
      if (!co) { setNotFound(true); setLoading(false); return; }
      setCompany(co);
      const [c, d] = await Promise.all([
        fetchCompanyContacts(companyId),
        fetchCompanyDeals(companyId),
      ]);
      if (cancelled) return;
      setContacts(c);
      setDeals(d);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  // Record this company in "recently viewed" once it loads.
  useEffect(() => {
    if (!company?.name) return;
    pushRecent(
      { type: 'company', id: String(companyId), label: company.name, route: `/companies/${companyId}` },
      profile?.user_id,
    );
  }, [company?.name, companyId, profile?.user_id]);

  // COLLAB_ASSOC: load user + target options once the flag is enabled.
  useEffect(() => {
    if (!COLLAB_ASSOC) return;
    let cancelled = false;
    (async () => {
      const [users, companies_] = await Promise.all([
        fetchAssignableUsers(null),
        fetchCompanyOptions(),
      ]);
      if (cancelled) return;
      setCollabUserOptions(users.map((u) => ({ id: u.id, label: u.label })));
      setCollabTargetOptions({
        lead: [],
        contact: [],
        company: companies_.map((c) => ({ id: c.company_id, label: c.company_name })),
        meeting: [],
      });
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleContactLinked() {
    setShowLinkModal(false);
    const refreshed = await fetchCompanyContacts(companyId);
    setContacts(refreshed);
  }

  if (loading) {
    return (
      <AppShell title="Company">
        <div className="flex items-center justify-center h-64 gap-2 text-stone-400">
          <Loader2 size={18} className="animate-spin" />
          <span style={{ fontSize: 14 }}>Loading company...</span>
        </div>
      </AppShell>
    );
  }

  if (notFound || !company) {
    return (
      <AppShell title="Company">
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-stone-400">
          <AlertCircle size={24} />
          <p style={{ fontSize: 14 }}>Company not found.</p>
          <button onClick={() => navigate('/companies')} className="text-blue-600 hover:text-blue-700 font-medium" style={{ fontSize: 13 }}>
            Back to Companies
          </button>
        </div>
      </AppShell>
    );
  }

  const website = fullUrl(company.webUrl || company.domainClean);

  return (
    <AppShell title="Company">
      <motion.div variants={pageTransition} initial="initial" animate="animate" exit="exit" transition={pageTransitionConfig} className="space-y-4 max-w-[1200px]">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-stone-400" style={{ fontSize: 12 }}>
          <button onClick={() => navigate('/companies')} className="flex items-center gap-1 hover:text-stone-700 transition-colors">
            <ArrowLeft size={13} />
            Companies
          </button>
          <ChevronRight size={11} />
          <span className="text-stone-600 truncate" style={{ maxWidth: 320 }} title={company.name || undefined}>{company.name}</span>
        </div>

        {/* HubSpot-style header */}
        <div className="bg-[var(--color-surface)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] rounded-[var(--radius-card)] px-6 py-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4 min-w-0">
              <span
                aria-hidden
                style={{
                  width: 52, height: 52, borderRadius: 10, flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 17, fontWeight: 700,
                  background: 'var(--color-brand-light)', color: 'var(--color-brand)',
                  border: '1px solid rgba(196,149,106,0.20)',
                }}
              >
                {companyInitials(company.name)}
              </span>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-semibold text-stone-900" style={{ fontSize: 20, lineHeight: 1.2 }}>{company.name}</h1>
                  {company.isDemo && (
                    <span style={{ background: '#F3F4F6', color: '#6B7280', fontSize: 10, fontWeight: 600, borderRadius: 4, padding: '2px 7px', letterSpacing: 0.4, textTransform: 'uppercase' }}>
                      Demo
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-x-4 gap-y-1 mt-2 flex-wrap">
                  {company.domainClean && (
                    <MetaItem icon={<Globe size={13} />}>
                      <a href={website} target="_blank" rel="noreferrer noopener" className="hover:underline" style={{ color: 'var(--color-brand)' }}>
                        {company.domainClean}
                      </a>
                    </MetaItem>
                  )}
                  {company.industry && <MetaItem icon={<Building2 size={13} />}>{company.industry}</MetaItem>}
                  {company.city && <MetaItem icon={<MapPin size={13} />}>{company.city}</MetaItem>}
                  {company.cin && <MetaItem icon={<Hash size={13} />}>CIN {company.cin}</MetaItem>}
                </div>
              </div>
            </div>

            {/* Right block: project selector + owner + one-click task actions */}
            <div className="flex flex-col items-end gap-2 shrink-0">
              <ProjectSelect value={projectId} onChange={setProjectId} />
              <div className="flex items-center gap-1.5">
                <span className="text-stone-400" style={{ fontSize: 11 }}>Owner</span>
                {/* Owner is always "Unassigned" for now. // TODO ownership */}
                <span className="text-stone-600 font-medium" style={{ fontSize: 12 }}>{company.owner}</span>
              </div>
              {actorId && (
                <QuickTaskActions
                  association={{
                    companyId: companyId,
                    assocLabel: company.name,
                    assocPhone: null,
                  }}
                  companyId={companyId}
                  projectId={projectId}
                  ownerUserId={ownerUserId}
                  actorId={actorId}
                  recordName={company.name}
                />
              )}
            </div>
          </div>

          {/* ABOUT — company details grid (revenue, employees, website, etc.) */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #f3f4f6' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
              About this company
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                gap: 14,
              }}
            >
              <Detail icon={<Building2 size={14} />} label="Industry">
                {company.industry || '—'}
              </Detail>
              <Detail icon={<Users size={14} />} label="Employees">
                {fmtSize(company.size)}
              </Detail>
              <Detail icon={<IndianRupee size={14} />} label="Revenue">
                {company.turnover || '—'}
              </Detail>
              <Detail icon={<MapPin size={14} />} label="City">
                {company.city || '—'}
              </Detail>
              <Detail icon={<Globe size={14} />} label="Website">
                {website ? (
                  <a href={website} target="_blank" rel="noreferrer noopener" className="hover:underline" style={{ color: 'var(--color-brand)' }}>
                    {company.domainClean || company.webUrl}
                  </a>
                ) : '—'}
              </Detail>
              <Detail icon={<Mail size={14} />} label="Email">
                {/* SAFE_VIEW (ALT-492): company.email is a business address, not a personal
                    contact field. company_master has no owner_user_id (ownership TODO).
                    Masking is N/A here — no owner field in scope without a new fetch. */}
                {company.email ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <a href={`mailto:${company.email}`} className="hover:underline" style={{ color: 'var(--color-brand)' }}>
                      {company.email}
                    </a>
                    <CopyButton value={company.email} label="Email" />
                    <button
                      type="button"
                      onClick={() => setCompanyEmailOpen(true)}
                      className="hover:underline"
                      style={{ fontSize: 11.5, color: 'var(--color-brand)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 500 }}
                      title="Send an email as yourself — logged on the record (ALT-503)"
                    >Send email</button>
                    <ComposeEmailModal
                      open={companyEmailOpen}
                      onClose={() => setCompanyEmailOpen(false)}
                      to={company.email}
                      companyId={companyId}
                      recordName={company.name}
                      companyName={company.name}
                      onSent={() => setEmailsRefresh((n) => n + 1)}
                    />
                  </span>
                ) : '—'}
              </Detail>
              <Detail icon={<Link2 size={14} />} label="LinkedIn">
                {company.linkedin ? (
                  <a href={fullUrl(company.linkedin)} target="_blank" rel="noreferrer noopener" className="hover:underline" style={{ color: 'var(--color-brand)' }}>
                    View profile
                  </a>
                ) : '—'}
              </Detail>
              <Detail icon={<Hash size={14} />} label="CIN">
                {company.cin || '—'}
              </Detail>
            </div>
            {company.description && (
              <div style={{ marginTop: 12, fontSize: 13, color: '#4B5563', lineHeight: 1.5 }}>
                {company.description}
              </div>
            )}
          </div>

          {/* Emails sent from the CRM on this company (ALT-510) */}
          <div style={{ marginTop: 16 }}>
            <EmailActivityPanel companyId={companyId} refreshKey={emailsRefresh} />
          </div>

          {/* ACCOUNT PANEL (per-project status) — shown below the details */}
          {/* // TODO visibility: per-project status/notes are owner + admin only (security pass) */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #f3f4f6' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              Account — Project Status
            </div>
            <AccountPanel
              companyId={companyId}
              projectId={projectId}
              actorId={actorId}
            />
          </div>
        </div>

        {/* Tabs card */}
        <div className="bg-[var(--color-surface)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] rounded-[var(--radius-card)]">
          <div className="flex items-center justify-between px-3 border-b border-stone-200">
            <div className="flex items-center">
              {TABS.map((t) => {
                const isActive = tab === t.key;
                const count = t.key === 'contacts' ? contacts.length : t.key === 'leads' ? deals.length : null;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => { setTab(t.key); try { localStorage.setItem(`altleads:tab:company:${id}`, t.key); } catch { /* ignore */ } }}
                    className="relative font-medium transition-colors"
                    style={{ fontSize: 13, padding: '12px 14px', color: isActive ? '#1A7EE8' : '#6B7280' }}
                    onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.color = '#374151'; }}
                    onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.color = '#6B7280'; }}
                  >
                    {t.label}{count != null ? ` (${count})` : ''}
                    {isActive && (
                      <span style={{ position: 'absolute', left: 8, right: 8, bottom: -1, height: 2, background: '#1A7EE8', borderRadius: '2px 2px 0 0' }} />
                    )}
                  </button>
                );
              })}
            </div>
            {tab === 'contacts' && (
              <div className="flex items-center gap-2" style={{ paddingRight: 6 }}>
                {/* STRICT_ROLE_GATING (ALT-458): "Link existing contact" writes to
                    contact_master (updates company_id) — only Admin/TL/QC when strict. */}
                {gated(canEditCompanyContact, true) && (
                <button
                  onClick={() => setShowLinkModal(true)}
                  className="inline-flex items-center gap-1.5 text-stone-600 hover:text-stone-800 font-medium transition-colors"
                  style={{ fontSize: 12, padding: '4px 8px', border: '1px solid #d4d4d8', borderRadius: 'var(--radius-btn)', background: '#fff' }}
                >
                  <UserPlus size={13} />
                  Link existing contact
                </button>
                )}
                {canCreateData && (
                  <button
                    onClick={() => navigate(`/contacts/new?company=${company.id}`)}
                    className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-medium transition-colors"
                    style={{ fontSize: 12 }}
                  >
                    <Plus size={13} />
                    Add new contact
                  </button>
                )}
              </div>
            )}
            {tab === 'leads' && canCreateData && (
              <div className="flex items-center gap-2" style={{ paddingRight: 6 }}>
                <button
                  onClick={() => navigate(`/leads/new?company=${company.id}`)}
                  className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-medium transition-colors"
                  style={{ fontSize: 12 }}
                >
                  <Plus size={13} />
                  New lead
                </button>
              </div>
            )}
          </div>

          <div className="p-4">
            {tab === 'contacts' && (
              <ContactsTab
                contacts={contacts}
                companyId={company.id}
                companyIdNum={companyId}
                projectId={projectId}
                actorId={actorId}
                ownerUserId={ownerUserId}
                onActivityLogged={handleActivityLogged}
              />
            )}
            {tab === 'leads' && <DealsTab deals={deals} />}
            {tab === 'activity' && (
              <ActivityTab companyId={companyId} projectId={projectId} refreshKey={activityRefresh} />
            )}
            {tab === 'sites' && HUNGERBOX_FEATURES && actorId != null && (
              <CompanySitesPanel companyId={companyId} actorId={actorId} granularity={hbGranularity} />
            )}
          </div>
        </div>
      </motion.div>

      {/* In-record activity hub (ALT-466) — no-op while TASKS_V2 is off */}
      <RecordActivityHub recordType="company" recordId={companyId} />

      {/* Account hierarchy (ALT-469) — dark behind COMPANY_HIERARCHY */}
      {COMPANY_HIERARCHY && (
        <div className="mt-4">
          <CompanyHierarchyCard
            companyId={companyId}
            actorUserId={profile?.user_id ?? null}
            canEdit={canEditCompanyContact}
          />
        </div>
      )}

      {/* Record stream / chatter (ALT-476) — dark behind STREAM_V1 */}
      {STREAM_V1 && (
        <div className="mt-4">
          <StreamPanel
            recordType="company"
            recordId={companyId}
            recordLabel={company?.name ?? `Company #${companyId}`}
            actorUserId={profile?.user_id ?? null}
            actorName={profile?.full_name ?? null}
            canPost={profile?.user_id != null}
          />
        </div>
      )}

      {/* Collaborators & Associations (ALT-441/442) — dark behind COLLAB_ASSOC */}
      {COLLAB_ASSOC && (
        <div className="space-y-4 mt-4">
          <CollaboratorsCard
            recordType="company"
            recordId={companyId}
            userOptions={collabUserOptions}
            actorId={actorId ?? ''}
          />
          <AssociationsPanel
            recordType="company"
            recordId={companyId}
            targetOptions={collabTargetOptions}
            actorId={actorId ?? ''}
          />
        </div>
      )}

      {/* Link-existing-contact modal (Fix #6) */}
      {showLinkModal && (
        <LinkContactModal
          companyId={companyId}
          companyName={company.name}
          onLinked={handleContactLinked}
          onClose={() => setShowLinkModal(false)}
        />
      )}
    </AppShell>
  );
}

export default CompanyDetailPage;
