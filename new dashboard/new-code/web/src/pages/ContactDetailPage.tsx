import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  Mail,
  Phone,
  Building2,
  MapPin,
  Briefcase,
  Link2,
  Pencil,
  Check,
  X,
  Save,
  Plus,
  ExternalLink,
  PhoneCall,
  PhoneOutgoing,
  CalendarPlus,
  ListPlus,
  UserCheck,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { pageTransition, pageTransitionConfig } from '../lib/zenAnimations';
import { AppShell } from '../components/layout/AppShell';
import { ComposeEmailModal } from '../components/email/ComposeEmailModal';
import { EmailActivityPanel } from '../components/email/EmailActivityPanel';
import { useAuth } from '../contexts/AuthContext';
import { ReassignModal } from '../components/common/ReassignModal';
import { reassignContact, fetchAssignableUsers, fetchUserLabel } from '../data/assignment';
import { humanizeWriteError } from '../lib/writeError';
import { isConflict, CONFLICT_MESSAGE } from '../lib/concurrency';
import type { UserOption } from '../data/wishlist';
import { CreateTaskModal, type TaskAssociation } from '../components/tasks/CreateTaskModal';
import { LogDispositionModal } from '../components/calls/LogDispositionModal';
import { RecordActivityHub } from '../components/tasks/RecordActivityHub';
import type { TaskType } from '../data/tasks';
import {
  fetchContactById,
  fetchCompanyOptions,
  fetchCityOptions,
  fetchContactLeads,
  updateContactCompany,
  deriveLinkedinClean,
  type Contact,
  type CompanyOption,
  type CityOption,
  type ContactLead,
} from '../data/contacts';
import { fetchCompanyContacts, type CompanyContact } from '../data/companies';
import { CopyButton } from '../components/ui/CopyButton';
import { StageBadge } from '../components/ui/Badge';
import {
  getContactStatus,
  upsertContactStatus,
  fetchActivity,
  type ContactProjectStatus,
} from '../data/projectStatus';
import { fetchOptions, type DropdownOption } from '../data/dropdowns';
import { supabase } from '../lib/supabase';
import { SectionCard } from '../components/admin/primitives';
import { SearchSelect, type SearchSelectOption } from '../components/ui/SearchSelect';
import { ProjectSelect } from '../components/ui/ProjectSelect';
import { useProjectScope } from '../contexts/ProjectContext';
import { DispositionForm } from '../components/ui/DispositionForm';
import { ActivityTimeline } from '../components/ui/ActivityTimeline';
import { StatusBadge } from '../components/ui/StatusBadge';
import type { Interaction } from '../data/contacts';
import { formatDate } from '../data/account';
import { pushRecent } from '../lib/useRecentlyViewed';
import { gated } from '../lib/roleGating';
import { isForeignRecord, maskContact } from '../lib/safeView';
import { COLLAB_ASSOC } from '../lib/collabAssoc';
import { CollaboratorsCard } from '../components/collab/CollaboratorsCard';
import { STREAM_V1 } from '../lib/streamFlag';
import { StreamPanel } from '../components/stream/StreamPanel';
import { AssociationsPanel } from '../components/collab/AssociationsPanel';
import type { RecordType } from '../lib/collabAssoc';

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function contactInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/* ------------------------------------------------------------------ */
/*  Inline field editor sub-component                                  */
/* ------------------------------------------------------------------ */

function FieldEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 500 }}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          fontSize: 13,
          padding: '6px 10px',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-btn)',
          background: 'var(--color-surface)',
          color: '#18181b',
          outline: 'none',
          width: '100%',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Info row helper (read-only display)                                */
/* ------------------------------------------------------------------ */

function InfoRow({ icon, label, value, href, copyValue }: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  href?: string;
  /** When set, shows a copy-to-clipboard button next to the value. */
  copyValue?: string | null;
}) {
  return (
    <div className="flex items-start gap-3" style={{ minHeight: 32 }}>
      <span style={{ color: '#9CA3AF', marginTop: 2, flexShrink: 0 }}>{icon}</span>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 500 }}>{label}</span>
        <span className="flex items-center gap-1.5 min-w-0">
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" title={copyValue ?? (typeof value === 'string' ? value : undefined)} style={{ fontSize: 13, color: '#1A7EE8', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {value}
            </a>
          ) : (
            <span title={copyValue ?? (typeof value === 'string' ? value : undefined)} style={{ fontSize: 13, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value || <span style={{ color: '#D1D5DB' }}>—</span>}</span>
          )}
          {copyValue ? <CopyButton value={copyValue} label={label} /> : null}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  One-click task actions — schedule a follow-up tied to this contact. */
/*  Reuses the shared CreateTaskModal; no task logic duplicated here.    */
/* ------------------------------------------------------------------ */

function QuickTaskActions({
  association,
  contactId,
  ownerUserId,
  actorId,
  recordName,
}: {
  association: TaskAssociation;
  contactId: number;
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

  const chipStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    fontSize: 12, fontWeight: 500,
    background: '#F3F4F6', color: '#374151',
    border: '1px solid var(--border-color)', borderRadius: 'var(--radius-btn)',
    padding: '6px 12px', cursor: 'pointer',
  };

  return (
    <>
      {variants.map((v) => (
        <button
          key={v.key}
          type="button"
          onClick={() => setModal({ type: v.type, subject: v.subject })}
          style={chipStyle}
          title={`${v.label} (creates a task tied to ${name})`}
        >
          {v.icon} {v.label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setLogOpen(true)}
        style={chipStyle}
        title={`Log a call that already happened with ${name}`}
      >
        <PhoneOutgoing size={13} /> Log call
      </button>

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
        recordType="contact"
        recordId={contactId}
        projectId={null}
        ownerUserId={ownerUserId}
        actorId={actorId}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, canCreateData, canReassign, canEditCompanyContact, isAdmin, isTeamLead, isQC } = useAuth();

  const contactId = id ? Number(id) : null;

  // Core contact data
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit mode for contact fields
  const [editing, setEditing] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailsRefresh, setEmailsRefresh] = useState(0);
  const [editDraft, setEditDraft] = useState<{
    full_name: string;
    designation: string;
    email: string;
    mobile_no: string;
    alt_mobile_no: string;
    linkedin_url: string;
    city_id: number | null;
    company_id: number | null;
  } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Company / city option lists
  const [companyOptions, setCompanyOptions] = useState<CompanyOption[]>([]);
  const [cityOptions, setCityOptions] = useState<CityOption[]>([]);

  // Per-project working panel state
  // TODO visibility: per-project status/notes are owner + admin only (security pass)
  // Seeded from + synced with the GLOBAL top-bar project selector (ALT-273) so the
  // contact's per-project view opens in the project the user picked, not "the first".
  const { selectedProjectId } = useProjectScope();
  const [projectId, setProjectId] = useState<number | null>(selectedProjectId);
  useEffect(() => {
    if (selectedProjectId != null) setProjectId(selectedProjectId);
  }, [selectedProjectId]);
  const [projectStatus, setProjectStatus] = useState<ContactProjectStatus | null>(null);
  const [statusOptions, setStatusOptions] = useState<DropdownOption[]>([]);
  const [statusDraft, setStatusDraft] = useState<{
    contact_status: string;
    description: string;
    comments: string;
  }>({ contact_status: '', description: '', comments: '' });
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusSuccess, setStatusSuccess] = useState(false);

  // Per-project owner + reassignment (ALT-288)
  const [ownerName, setOwnerName] = useState('');
  const [showReassign, setShowReassign] = useState(false);
  const [reassignSaving, setReassignSaving] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [reassignOwners, setReassignOwners] = useState<UserOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchUserLabel(projectStatus?.owner_user_id ?? null).then((n) => { if (!cancelled) setOwnerName(n); });
    return () => { cancelled = true; };
  }, [projectStatus?.owner_user_id]);

  const openReassign = async () => {
    if (!projectId) return;
    setReassignError(null);
    setReassignOwners([]);
    setShowReassign(true);
    const owners = await fetchAssignableUsers(projectStatus?.owner_user_id ?? null);
    setReassignOwners(owners);
  };

  const handleReassign = async (newUserId: number) => {
    if (!contactId || !projectId) return;
    setReassignSaving(true);
    setReassignError(null);
    const res = await reassignContact({
      contactId,
      projectId,
      newUserId,
      actor: profile?.user_id != null ? String(profile.user_id) : '',
      contactName: contact?.full_name || undefined,
      isReassign: projectStatus?.owner_user_id != null,
    });
    setReassignSaving(false);
    if (res?.error) { setReassignError(humanizeWriteError(res.error)); return; }
    setShowReassign(false);
    const refreshed = await getContactStatus(contactId, projectId);
    setProjectStatus(refreshed);
  };

  // Activity timeline
  const [activity, setActivity] = useState<Interaction[]>([]);

  // COLLAB_ASSOC: user options for the collab card.
  const [collabUserOptions, setCollabUserOptions] = useState<SearchSelectOption[]>([]);
  const [collabTargetOptions, setCollabTargetOptions] = useState<Record<RecordType, SearchSelectOption[]>>({
    lead: [], contact: [], company: [], meeting: [],
  });

  // Associations (HubSpot-style): leads for this contact + colleagues at the same company
  const [leads, setLeads] = useState<ContactLead[]>([]);
  const [siblings, setSiblings] = useState<CompanyContact[]>([]);

  /* ---------------------------------------------------------------- */
  /*  Load contact + reference data                                    */
  /* ---------------------------------------------------------------- */

  const loadContact = useCallback(async () => {
    if (!contactId) { setError('Contact not found.'); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const [c, companies, cities] = await Promise.all([
        fetchContactById(contactId),
        fetchCompanyOptions(),
        fetchCityOptions(),
      ]);
      if (!c) {
        setError('Contact not found.');
        setLoading(false);
        return;
      }
      setContact(c);
      setCompanyOptions(companies);
      setCityOptions(cities);
      setLoading(false);
    } catch {
      setError('Could not load this contact.');
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => { loadContact(); }, [loadContact]);

  // Record this contact in "recently viewed" once it loads.
  useEffect(() => {
    if (!contact?.full_name) return;
    pushRecent(
      { type: 'contact', id: String(contact.contact_id), label: contact.full_name, route: `/contacts/${contact.contact_id}` },
      profile?.user_id,
    );
  }, [contact?.full_name, contact?.contact_id, profile?.user_id]);

  // Load associated leads + colleagues once the contact (and its company) is known.
  useEffect(() => {
    if (!contact) return;
    let cancelled = false;
    (async () => {
      const [ld, sib] = await Promise.all([
        fetchContactLeads(contact.contact_id),
        contact.company_id ? fetchCompanyContacts(contact.company_id) : Promise.resolve([] as CompanyContact[]),
      ]);
      if (cancelled) return;
      setLeads(ld);
      setSiblings(sib.filter((s) => s.id !== String(contact.contact_id)));
    })();
    return () => { cancelled = true; };
  }, [contact]);

  // Load contact_status dropdown options once
  useEffect(() => {
    fetchOptions('contact_status').then(setStatusOptions);
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Load per-project status whenever project changes                 */
  /* ---------------------------------------------------------------- */

  const loadProjectStatus = useCallback(async () => {
    if (!contactId || !projectId) return;
    const ps = await getContactStatus(contactId, projectId);
    setProjectStatus(ps);
    setStatusDraft({
      contact_status: ps?.contact_status ?? '',
      description: ps?.description ?? '',
      comments: ps?.comments ?? '',
    });
  }, [contactId, projectId]);

  useEffect(() => { loadProjectStatus(); }, [loadProjectStatus]);

  /* ---------------------------------------------------------------- */
  /*  Load activity timeline (all projects for this contact)          */
  /* ---------------------------------------------------------------- */

  const loadActivity = useCallback(async () => {
    if (!contactId) return;
    const rows = await fetchActivity('contact', contactId);
    setActivity(rows);
  }, [contactId]);

  useEffect(() => { loadActivity(); }, [loadActivity]);

  // COLLAB_ASSOC: load user + target options once the flag is enabled.
  useEffect(() => {
    if (!COLLAB_ASSOC) return;
    let cancelled = false;
    (async () => {
      const [users, companies] = await Promise.all([
        fetchAssignableUsers(null),
        fetchCompanyOptions(),
      ]);
      if (cancelled) return;
      setCollabUserOptions(users.map((u) => ({ id: u.id, label: u.label })));
      setCollabTargetOptions({
        lead: [],
        contact: [],
        company: companies.map((c) => ({ id: c.company_id, label: c.company_name })),
        meeting: [],
      });
    })();
    return () => { cancelled = true; };
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Edit contact fields                                              */
  /* ---------------------------------------------------------------- */

  function startEdit() {
    if (!contact) return;
    setEditDraft({
      full_name: contact.full_name ?? '',
      designation: contact.designation ?? '',
      email: contact.email ?? '',
      mobile_no: contact.mobile_no ?? '',
      alt_mobile_no: contact.alt_mobile_no ?? '',
      linkedin_url: contact.linkedin_url ?? '',
      city_id: contact.city_id,
      company_id: contact.company_id,
    });
    setEditError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setEditDraft(null);
    setEditError(null);
  }

  async function saveEdit() {
    if (!contactId || !editDraft || !contact) return;
    setSavingEdit(true);
    setEditError(null);

    const linkedinClean = deriveLinkedinClean(editDraft.linkedin_url);

    // If company changed, use the shared helper; otherwise skip
    const companyChanged = editDraft.company_id !== contact.company_id;

    // Update all scalar fields directly on contact_master
    const { data: updatedRows, error: updateErr } = await supabase
      .from('contact_master')
      .update({
        full_name: editDraft.full_name.trim() || null,
        designation: editDraft.designation.trim() || null,
        email: editDraft.email.trim() || null,
        mobile_no: editDraft.mobile_no.trim() || null,
        alt_mobile_no: editDraft.alt_mobile_no.trim() || null,
        linkedin_url: editDraft.linkedin_url.trim() || null,
        linkedin_clean: linkedinClean,
        city_id: editDraft.city_id,
        company_id: editDraft.company_id,
        updated_date: new Date().toISOString(),
      })
      .eq('contact_id', contactId)
      .select('contact_id');

    if (updateErr) {
      setEditError(
        updateErr.code === '42501'
          ? "You can only edit records you own (ask an admin or the owner's manager)."
          : updateErr.message,
      );
      setSavingEdit(false);
      return;
    }
    if (!updatedRows || (updatedRows as { contact_id: number }[]).length === 0) {
      setEditError("You can only edit records you own (ask an admin or the owner's manager).");
      setSavingEdit(false);
      return;
    }

    // If company changed, also run the dedicated helper (it may do extra work).
    // The main update above already succeeded; if this secondary call gets a conflict
    // (only possible when CONCURRENCY_GUARD=true), surface the message but don't
    // block the rest of the save path — the main record is already written.
    if (companyChanged) {
      const compRes = await updateContactCompany(contactId, editDraft.company_id, contact.updated_date ?? undefined);
      if (isConflict(compRes)) {
        setEditError(CONFLICT_MESSAGE);
      } else if (compRes.error) {
        setEditError(compRes.error);
      }
    }

    // Refresh contact
    await loadContact();
    setSavingEdit(false);
    setEditing(false);
    setEditDraft(null);
  }

  /* ---------------------------------------------------------------- */
  /*  Save project status                                              */
  /* ---------------------------------------------------------------- */

  async function saveProjectStatus() {
    if (!contactId || !projectId) return;
    setSavingStatus(true);
    setStatusError(null);
    setStatusSuccess(false);
    const actorId = profile?.user_id != null ? String(profile.user_id) : null;
    const { error: err } = await upsertContactStatus(
      contactId,
      projectId,
      {
        contact_status: statusDraft.contact_status || null,
        description: statusDraft.description.trim() || null,
        comments: statusDraft.comments.trim() || null,
      },
      actorId,
    );
    setSavingStatus(false);
    if (err) {
      setStatusError(err);
      return;
    }
    setStatusSuccess(true);
    setTimeout(() => setStatusSuccess(false), 3000);
    // Refresh both status and activity (status_change interaction is appended)
    await Promise.all([loadProjectStatus(), loadActivity()]);
  }

  /* ---------------------------------------------------------------- */
  /*  Build SearchSelect option lists                                  */
  /* ---------------------------------------------------------------- */

  const companySelectOptions: SearchSelectOption[] = companyOptions.map((c) => ({
    id: c.company_id,
    label: c.company_name,
  }));

  const citySelectOptions: SearchSelectOption[] = cityOptions.map((c) => ({
    id: c.city_id,
    label: c.city_name,
  }));

  /* ---------------------------------------------------------------- */
  /*  Render: loading / error states                                   */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <AppShell title="Contact">
        <div className="flex items-center justify-center" style={{ height: 200 }}>
          <Loader2 size={22} className="animate-spin text-stone-400" />
        </div>
      </AppShell>
    );
  }

  if (error || !contact) {
    return (
      <AppShell title="Contact">
        <div className="space-y-3">
          <button onClick={() => navigate('/contacts')} className="flex items-center gap-1.5 text-stone-500 hover:text-stone-800 transition-colors" style={{ fontSize: 13 }}>
            <ArrowLeft size={15} /> Back to Contacts
          </button>
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#EF4444', fontSize: 14 }}>
            {error ?? 'Contact not found.'}
          </div>
        </div>
      </AppShell>
    );
  }

  const linkedinHref = contact.linkedin_url
    ? (contact.linkedin_url.startsWith('http') ? contact.linkedin_url : `https://linkedin.com/in/${contact.linkedin_url}`)
    : undefined;

  const actorId = profile?.user_id != null ? String(profile.user_id) : null;
  const ownerUserId = profile?.user_id ?? null;

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <AppShell title={contact.full_name || 'Contact'}>
      <motion.div
        variants={pageTransition}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransitionConfig}
        className="space-y-4"
      >
        {/* Back nav */}
        <button
          onClick={() => navigate('/contacts')}
          className="flex items-center gap-1.5 text-stone-500 hover:text-stone-800 transition-colors"
          style={{ fontSize: 13 }}
        >
          <ArrowLeft size={15} />
          Back to Contacts
        </button>

        {/* Header card */}
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-sm)',
          padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 20,
        }}>
          {/* Avatar */}
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: '#E8F2FD', color: '#1A7EE8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 700, flexShrink: 0, letterSpacing: 0.5,
          }}>
            {contactInitials(contact.full_name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>
                {contact.full_name}
              </h1>
              {contact.is_demo && (
                <span style={{
                  fontSize: 10, fontWeight: 600, letterSpacing: 0.5,
                  background: '#F3F4F6', color: '#9CA3AF',
                  borderRadius: 4, padding: '2px 7px',
                }}>DEMO</span>
              )}
            </div>
            {contact.designation && (
              <p style={{ fontSize: 14, color: '#6B7280', margin: '3px 0 0' }}>{contact.designation}</p>
            )}
            {contact.company_name && contact.company_id && (
              <Link
                to={`/companies/${contact.company_id}`}
                target="_blank"
                rel="noreferrer noopener"
                title="Open company in a new tab"
                style={{ fontSize: 13, color: '#1A7EE8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}
              >
                <Building2 size={13} />
                {contact.company_name}
                <ExternalLink size={11} style={{ opacity: 0.6 }} />
              </Link>
            )}
          </div>

          {/* New Lead / Edit / Save / Cancel buttons */}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {!editing ? (
              <>
                {/* One-click follow-up tasks tied to this contact. */}
                {actorId && (
                  <QuickTaskActions
                    association={{
                      contactId: contact.contact_id,
                      companyId: contact.company_id ?? null,
                      assocLabel: contact.full_name,
                      assocPhone: contact.mobile_no || contact.alt_mobile_no || null,
                    }}
                    contactId={contact.contact_id}
                    ownerUserId={ownerUserId}
                    actorId={actorId}
                    recordName={contact.full_name}
                  />
                )}
                {/* Create is admin-only by default (ADR-21); hidden from outreach roles. */}
                {canCreateData && (
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/leads/new?contact=${contact.contact_id}` +
                        (contact.company_id ? `&company=${contact.company_id}` : ''),
                    )
                  }
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 12, fontWeight: 500,
                    background: '#1A7EE8', color: '#fff',
                    border: 'none', borderRadius: 'var(--radius-btn)',
                    padding: '6px 12px', cursor: 'pointer',
                  }}
                >
                  <Plus size={13} /> New Lead
                </button>
                )}
                {/* STRICT_ROLE_GATING (ALT-458): when enabled, only Admin/TL/QC may
                    edit contact_master. When flag is false, legacy open-edit preserved. */}
                {gated(canEditCompanyContact, true) && (
                <button
                  type="button"
                  onClick={startEdit}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 12, fontWeight: 500,
                    background: '#F3F4F6', color: '#374151',
                    border: '1px solid var(--border-color)', borderRadius: 'var(--radius-btn)',
                    padding: '6px 12px', cursor: 'pointer',
                  }}
                >
                  <Pencil size={13} /> Edit
                </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={savingEdit}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 12, fontWeight: 500,
                    background: '#1A7EE8', color: '#fff',
                    border: 'none', borderRadius: 'var(--radius-btn)',
                    padding: '6px 12px',
                    cursor: savingEdit ? 'not-allowed' : 'pointer',
                    opacity: savingEdit ? 0.6 : 1,
                  }}
                >
                  {savingEdit ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Save
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 12, fontWeight: 500,
                    background: 'none', color: '#6B7280',
                    border: '1px solid var(--border-color)', borderRadius: 'var(--radius-btn)',
                    padding: '6px 12px', cursor: 'pointer',
                  }}
                >
                  <X size={12} /> Cancel
                </button>
              </>
            )}
          </div>
        </div>

        {/* Edit error banner */}
        {editError && (
          <div style={{ fontSize: 13, color: '#EF4444', padding: '8px 14px', background: 'rgba(196,77,77,0.06)', borderRadius: 6, border: '1px solid rgba(196,77,77,0.15)' }}>
            {editError}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Contact Details — read view OR edit form */}
          <SectionCard title="Contact Details">
            {!editing ? (
              <div className="space-y-3">
                <InfoRow
                  icon={<Mail size={15} />}
                  label="Email"
                  value={contact.email}
                  href={contact.email ? `mailto:${contact.email}` : undefined}
                  copyValue={contact.email}
                />
                {contact.email ? (
                  <button
                    type="button"
                    onClick={() => setEmailOpen(true)}
                    className="inline-flex items-center gap-1.5 font-medium"
                    style={{ fontSize: 12, padding: '5px 11px', height: 30, borderRadius: 'var(--radius-btn)', border: '1px solid var(--border-color)', background: 'var(--color-surface)', color: '#374151', cursor: 'pointer' }}
                    title="Send an email as yourself — logged on the record (ALT-503)"
                  >
                    <Mail size={13} />
                    Send email
                  </button>
                ) : null}
                <ComposeEmailModal
                  open={emailOpen}
                  onClose={() => setEmailOpen(false)}
                  to={contact.email ?? ''}
                  contactId={contact.contact_id}
                  recordName={contact.full_name}
                  companyName={contact.company_name}
                  onSent={() => setEmailsRefresh((n) => n + 1)}
                />
                <InfoRow
                  icon={<Phone size={15} />}
                  label="Phone"
                  value={contact.mobile_no}
                  href={contact.mobile_no ? `tel:${contact.mobile_no}` : undefined}
                  copyValue={contact.mobile_no}
                />
                <InfoRow
                  icon={<Phone size={15} />}
                  label="Alt Phone"
                  value={contact.alt_mobile_no}
                  href={contact.alt_mobile_no ? `tel:${contact.alt_mobile_no}` : undefined}
                  copyValue={contact.alt_mobile_no}
                />
                <InfoRow
                  icon={<Link2 size={15} />}
                  label="LinkedIn"
                  value={contact.linkedin_clean || contact.linkedin_url}
                  href={linkedinHref}
                />
                <InfoRow icon={<MapPin size={15} />} label="City" value={contact.city_name} />
                <InfoRow icon={<Briefcase size={15} />} label="Designation" value={contact.designation} />
                {/* Company (read) */}
                <div className="flex items-start gap-3" style={{ minHeight: 32 }}>
                  <span style={{ color: '#9CA3AF', marginTop: 2, flexShrink: 0 }}><Building2 size={15} /></span>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 500 }}>Company</span>
                    {contact.company_name && contact.company_id ? (
                      <Link
                        to={`/companies/${contact.company_id}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        title="Open company in a new tab"
                        style={{ fontSize: 13, color: '#1A7EE8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        {contact.company_name}
                        <ExternalLink size={11} style={{ opacity: 0.6 }} />
                      </Link>
                    ) : (
                      <span style={{ fontSize: 13, color: '#D1D5DB' }}>—</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Edit form */
              editDraft && (
                <div className="space-y-3">
                  <FieldEditor
                    label="Full Name *"
                    value={editDraft.full_name}
                    onChange={(v) => setEditDraft((d) => d ? { ...d, full_name: v } : d)}
                  />
                  <FieldEditor
                    label="Designation"
                    value={editDraft.designation}
                    onChange={(v) => setEditDraft((d) => d ? { ...d, designation: v } : d)}
                  />
                  <FieldEditor
                    label="Email"
                    value={editDraft.email}
                    onChange={(v) => setEditDraft((d) => d ? { ...d, email: v } : d)}
                  />
                  <FieldEditor
                    label="Phone"
                    value={editDraft.mobile_no}
                    onChange={(v) => setEditDraft((d) => d ? { ...d, mobile_no: v } : d)}
                  />
                  <FieldEditor
                    label="Alt Phone"
                    value={editDraft.alt_mobile_no}
                    onChange={(v) => setEditDraft((d) => d ? { ...d, alt_mobile_no: v } : d)}
                  />
                  <FieldEditor
                    label="LinkedIn URL"
                    value={editDraft.linkedin_url}
                    onChange={(v) => setEditDraft((d) => d ? { ...d, linkedin_url: v } : d)}
                  />

                  {/* City picker */}
                  <div className="flex flex-col gap-1">
                    <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 500 }}>City</label>
                    <SearchSelect
                      options={citySelectOptions}
                      value={editDraft.city_id}
                      onChange={(v) => setEditDraft((d) => d ? { ...d, city_id: v } : d)}
                      placeholder="Search city…"
                    />
                  </div>

                  {/* Company picker */}
                  <div className="flex flex-col gap-1">
                    <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 500 }}>Company</label>
                    <SearchSelect
                      options={companySelectOptions}
                      value={editDraft.company_id}
                      onChange={(v) => setEditDraft((d) => d ? { ...d, company_id: v } : d)}
                      placeholder="Search company…"
                    />
                  </div>

                  {/* Inline save / cancel (mirrors header buttons) */}
                  <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                    <button
                      type="button"
                      onClick={saveEdit}
                      disabled={savingEdit}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 12, fontWeight: 500,
                        background: '#1A7EE8', color: '#fff',
                        border: 'none', borderRadius: 'var(--radius-btn)', padding: '5px 12px',
                        cursor: savingEdit ? 'not-allowed' : 'pointer',
                        opacity: savingEdit ? 0.6 : 1,
                      }}
                    >
                      {savingEdit ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      Save changes
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 12, color: '#6B7280',
                        background: 'none', border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-btn)', padding: '5px 8px', cursor: 'pointer',
                      }}
                    >
                      <X size={12} /> Cancel
                    </button>
                  </div>
                </div>
              )
            )}
          </SectionCard>

          {/* Per-project working panel */}
          {/* TODO visibility: per-project status/notes are owner + admin only (security pass) */}
          <SectionCard
            title="Project Status"
            action={
              <ProjectSelect
                value={projectId}
                onChange={setProjectId}
              />
            }
          >
            <div className="space-y-3">
              {/* Owner (this project) + reassign (ALT-288) */}
              {projectId && (
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 500 }}>Owner (this project)</label>
                    <div style={{ fontSize: 13, color: ownerName ? '#18181b' : '#9ca3af' }}>{ownerName || 'Unassigned'}</div>
                  </div>
                  {canReassign && (
                    <button
                      type="button"
                      onClick={openReassign}
                      className="inline-flex items-center gap-1.5 border border-stone-300 hover:border-stone-400 bg-white hover:bg-stone-50 text-stone-700 font-medium transition-colors"
                      style={{ fontSize: 12, padding: '5px 10px', height: 30, borderRadius: 'var(--radius-btn)' }}
                      title="Assign this contact (in this project) to a salesperson"
                    >
                      <UserCheck size={13} />
                      {ownerName ? 'Change owner' : 'Assign owner'}
                    </button>
                  )}
                </div>
              )}

              {/* Current status badge */}
              {projectStatus?.contact_status && (
                <div style={{ marginBottom: 4 }}>
                  <StatusBadge value={projectStatus.contact_status} category="contact_status" />
                </div>
              )}

              {/* Status dropdown */}
              <div className="flex flex-col gap-1">
                <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 500 }}>Contact Status</label>
                <select
                  value={statusDraft.contact_status}
                  onChange={(e) => setStatusDraft((d) => ({ ...d, contact_status: e.target.value }))}
                  style={{
                    fontSize: 13, padding: '6px 10px',
                    border: '1px solid var(--border-color)', borderRadius: 'var(--radius-btn)',
                    background: 'var(--color-surface)', color: '#18181b', outline: 'none',
                    cursor: 'pointer', height: 34, appearance: 'none',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                >
                  <option value="">— none —</option>
                  {statusOptions.map((o) => (
                    <option key={o.option_id} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1">
                <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 500 }}>Description</label>
                <textarea
                  value={statusDraft.description}
                  onChange={(e) => setStatusDraft((d) => ({ ...d, description: e.target.value }))}
                  placeholder="Short description…"
                  rows={2}
                  style={{
                    fontSize: 13, padding: '6px 10px', resize: 'vertical',
                    border: '1px solid var(--border-color)', borderRadius: 'var(--radius-btn)',
                    background: 'var(--color-surface)', color: '#18181b', outline: 'none',
                    fontFamily: 'inherit', width: '100%',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                />
              </div>

              {/* Comments */}
              <div className="flex flex-col gap-1">
                <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 500 }}>Comments</label>
                <textarea
                  value={statusDraft.comments}
                  onChange={(e) => setStatusDraft((d) => ({ ...d, comments: e.target.value }))}
                  placeholder="Internal comments…"
                  rows={2}
                  style={{
                    fontSize: 13, padding: '6px 10px', resize: 'vertical',
                    border: '1px solid var(--border-color)', borderRadius: 'var(--radius-btn)',
                    background: 'var(--color-surface)', color: '#18181b', outline: 'none',
                    fontFamily: 'inherit', width: '100%',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                />
              </div>

              {statusError && (
                <p style={{ fontSize: 12, color: '#EF4444' }}>{statusError}</p>
              )}
              {statusSuccess && (
                <p style={{ fontSize: 12, color: '#16A34A' }}>Status saved.</p>
              )}

              <button
                type="button"
                onClick={saveProjectStatus}
                disabled={savingStatus || !projectId}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 12, fontWeight: 500,
                  background: '#1A7EE8', color: '#fff',
                  border: 'none', borderRadius: 'var(--radius-btn)',
                  padding: '6px 14px',
                  cursor: (savingStatus || !projectId) ? 'not-allowed' : 'pointer',
                  opacity: (savingStatus || !projectId) ? 0.6 : 1,
                }}
              >
                {savingStatus ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Save status
              </button>

              {showReassign && (
                <ReassignModal
                  entityLabel="Contact"
                  ownerLabel="Owner"
                  currentOwnerId={projectStatus?.owner_user_id ?? null}
                  owners={reassignOwners}
                  saving={reassignSaving}
                  error={reassignError}
                  onConfirm={handleReassign}
                  onClose={() => setShowReassign(false)}
                />
              )}
            </div>
          </SectionCard>
        </div>

        {/* Associations — leads for this contact + colleagues at the same company */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <SectionCard
            title={`Leads (${leads.length})`}
            action={
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/leads/new?contact=${contact.contact_id}` +
                      (contact.company_id ? `&company=${contact.company_id}` : ''),
                  )
                }
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 12, fontWeight: 500, color: '#1A7EE8',
                  background: 'none', border: 'none', cursor: 'pointer',
                }}
              >
                <Plus size={13} /> New
              </button>
            }
          >
            {leads.length === 0 ? (
              <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
                No leads linked to this contact yet.
              </p>
            ) : (
              <div className="space-y-2">
                {leads.map((l) => (
                  <a
                    key={l.id}
                    href={`/leads/${l.id}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center justify-between gap-3 px-3 py-2 cursor-pointer"
                    style={{ border: '1px solid var(--border-color)', background: 'var(--color-surface)', textDecoration: 'none', borderRadius: 'var(--radius-card)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#F9FAFB'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface)'; }}
                  >
                    <div className="min-w-0">
                      <p className="truncate inline-flex items-center gap-1" style={{ fontSize: 13, fontWeight: 500, color: '#111827', margin: 0 }}>
                        {l.leadName || <span style={{ color: '#9CA3AF' }}>Untitled lead</span>}
                        <ExternalLink size={11} style={{ color: '#9CA3AF' }} />
                      </p>
                      {l.leadNumber && (
                        <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0, fontFamily: 'monospace' }}>
                          {l.leadNumber}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {l.stage && <StageBadge stage={l.stage} />}
                      <span style={{ fontSize: 11, color: '#9CA3AF' }}>{formatDate(l.createdDate || null)}</span>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title={`Colleagues${contact.company_name ? ' · ' + contact.company_name : ''} (${siblings.length})`}
          >
            {!contact.company_id ? (
              <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
                Link a company to see colleagues.
              </p>
            ) : siblings.length === 0 ? (
              <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
                No other contacts at this company yet.
              </p>
            ) : (
              <div className="space-y-1">
                {siblings.map((s) => (
                  <Link
                    key={s.id}
                    to={`/contacts/${s.id}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    title="Open contact in a new tab"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                      fontSize: 13, color: '#374151', textDecoration: 'none',
                      padding: '6px 8px', borderRadius: 'var(--radius-btn)',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#F9FAFB'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <span className="truncate inline-flex items-center gap-1" style={{ fontWeight: 500, color: '#111827' }}>
                      {s.fullName || '—'}
                      <ExternalLink size={11} style={{ color: '#9CA3AF' }} />
                    </span>
                    <span className="truncate" style={{ color: '#9CA3AF', fontSize: 12 }}>
                      {s.designation || ''}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Call Disposition Logger */}
        <SectionCard title="Log a Call">
          <DispositionForm
            recordType="contact"
            recordId={contactId!}
            projectId={projectId}
            ownerUserId={ownerUserId}
            actorId={actorId}
            onLogged={loadActivity}
          />
        </SectionCard>

        {/* Emails sent from the CRM to this contact (ALT-510) */}
        <EmailActivityPanel contactId={contact.contact_id} refreshKey={emailsRefresh} />

        {/* Activity Timeline */}
        <SectionCard title="Activity Timeline">
          <ActivityTimeline
            items={activity}
            emptyText="No activity yet. Use Log a Call above to record the first interaction."
          />
        </SectionCard>

        {/* In-record activity hub (ALT-466) — no-op while TASKS_V2 is off */}
        {contactId != null && <RecordActivityHub recordType="contact" recordId={contactId} />}

        {/* Record stream / chatter (ALT-476) — dark behind STREAM_V1 */}
        {STREAM_V1 && contactId != null && (
          <div className="mt-4">
            <StreamPanel
              recordType="contact"
              recordId={contactId}
              recordLabel={contact.full_name || `Contact #${contactId}`}
              actorUserId={profile?.user_id ?? null}
              actorName={profile?.full_name ?? null}
              canPost={profile?.user_id != null}
            />
          </div>
        )}

        {/* Collaborators & Associations (ALT-441/442) — dark behind COLLAB_ASSOC */}
        {COLLAB_ASSOC && contactId != null && (
          <>
            <CollaboratorsCard
              recordType="contact"
              recordId={contactId}
              userOptions={collabUserOptions}
              actorId={actorId ?? ''}
            />
            <AssociationsPanel
              recordType="contact"
              recordId={contactId}
              targetOptions={collabTargetOptions}
              actorId={actorId ?? ''}
            />
          </>
        )}

      </motion.div>
    </AppShell>
  );
}

export default ContactDetailPage;
