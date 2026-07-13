/**
 * ContactPreview — compact "mini record" for a contact, rendered INSIDE the
 * generic RecordPreviewPanel (ALT-327/328). A denser mirror of ContactDetailPage
 * that now reaches PARITY with the full page's "Project Status" card:
 * header (avatar + name + designation + company); a per-project selector (seeded
 * from the global scope, ALT-294) that drives an EDITABLE status block — Owner
 * (+ Assign/Change owner via ReassignModal), Contact Status dropdown, Description
 * + Comments, and a Save button; plus quick contact methods, linked Leads +
 * Colleagues, and a short recent-activity list.
 *
 * Reuses the EXISTING data layer exactly like ContactDetailPage:
 *   - getContactStatus / upsertContactStatus (data/projectStatus)
 *   - reassignContact / fetchAssignableUsers / fetchUserLabel (data/assignment)
 *   - fetchOptions('contact_status') (data/dropdowns) for the status dropdown
 *   - ProjectSelect + useProjectScope for the project picker
 *   - useAuth → profile.user_id (actor) + canReassign (gates Assign owner)
 * No new data fns are introduced.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2,
  Mail,
  Phone,
  Building2,
  MapPin,
  Briefcase,
  Link2,
  ExternalLink,
  AlertCircle,
  Users,
  ClipboardList,
  Save,
  UserCheck,
} from 'lucide-react';
import {
  fetchContactById,
  fetchContactLeads,
  fetchContactInteractions,
  type Contact,
  type ContactLead,
  type Interaction,
} from '../../data/contacts';
import {
  getContactStatus,
  upsertContactStatus,
  type ContactProjectStatus,
} from '../../data/projectStatus';
import { fetchCompanyContacts, type CompanyContact } from '../../data/companies';
import { reassignContact, fetchAssignableUsers, fetchUserLabel } from '../../data/assignment';
import { fetchOptions, type DropdownOption } from '../../data/dropdowns';
import type { UserOption } from '../../data/wishlist';
import { useAuth } from '../../contexts/AuthContext';
import { useProjectScope } from '../../contexts/ProjectContext';
import { ProjectSelect } from '../ui/ProjectSelect';
import { ReassignModal } from '../common/ReassignModal';
import { CopyButton } from '../ui/CopyButton';
import { StatusBadge } from '../ui/StatusBadge';
import { StageBadge } from '../ui/Badge';
import { formatDate } from '../../data/account';
import { humanizeWriteError } from '../../lib/writeError';
import { CallLogPreview } from '../calls/CallLogPreview';
import { PreviewCallLogger } from '../calls/PreviewCallLogger';

const BRAND = 'var(--color-brand, #1A7EE8)';

function contactInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/* Compact label/value row with optional link + copy (mirrors detail page InfoRow). */
function Field({
  icon, label, value, href, copyValue,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  href?: string;
  copyValue?: string | null;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minHeight: 28 }}>
      <span style={{ color: '#9CA3AF', marginTop: 1, flexShrink: 0 }}>{icon}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <span style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 500 }}>{label}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              title={copyValue ?? (typeof value === 'string' ? value : undefined)}
              style={{ fontSize: 13, color: BRAND, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {value}
            </a>
          ) : (
            <span
              title={copyValue ?? (typeof value === 'string' ? value : undefined)}
              style={{ fontSize: 13, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {value || <span style={{ color: '#D1D5DB' }}>—</span>}
            </span>
          )}
          {copyValue ? <CopyButton value={copyValue} label={label} /> : null}
        </span>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 8px' }}>
      {children}
    </h3>
  );
}

function describeInteraction(it: Interaction): string {
  if (it.note_text) return it.note_text;
  if (it.disposition) return it.disposition;
  return it.type === 'status_change' ? 'Status updated' : it.type === 'call' ? 'Call logged' : it.type;
}

export function ContactPreview({
  contactId,
  projectId: initialProjectId,
}: {
  contactId: number;
  projectId?: number | null;
}) {
  const { profile, canReassign } = useAuth();
  const { selectedProjectId } = useProjectScope();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [leads, setLeads] = useState<ContactLead[]>([]);
  const [colleagues, setColleagues] = useState<CompanyContact[]>([]);
  const [activity, setActivity] = useState<Interaction[]>([]);

  // Per-project working panel — its OWN selector, seeded from the prop/global
  // scope (ALT-294). Changing it re-loads that project's status, owner + draft.
  const [projectId, setProjectId] = useState<number | null>(
    initialProjectId ?? selectedProjectId,
  );
  // Keep in sync if the global top-bar scope resolves/changes after mount.
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

  // Bumped after a call is logged in the preview so CallLogPreview re-fetches (ALT-337).
  const [logVersion, setLogVersion] = useState(0);

  // Per-project owner + reassignment (ALT-288)
  const [ownerName, setOwnerName] = useState<string>('');
  const [showReassign, setShowReassign] = useState(false);
  const [reassignSaving, setReassignSaving] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [reassignOwners, setReassignOwners] = useState<UserOption[]>([]);

  // Load contact_status dropdown options once (same source as the full page).
  useEffect(() => {
    fetchOptions('contact_status').then(setStatusOptions);
  }, []);

  // Core contact + associations.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setContact(null);
    setLeads([]);
    setColleagues([]);
    setActivity([]);

    (async () => {
      try {
        const c = await fetchContactById(contactId);
        if (cancelled) return;
        if (!c) {
          setError('Contact not found.');
          setLoading(false);
          return;
        }
        setContact(c);
        setLoading(false);

        // Secondary data — load in parallel, non-blocking for the header.
        const [ld, sib, acts] = await Promise.all([
          fetchContactLeads(c.contact_id),
          c.company_id ? fetchCompanyContacts(c.company_id) : Promise.resolve([] as CompanyContact[]),
          fetchContactInteractions(c.contact_id),
        ]);
        if (cancelled) return;
        setLeads(ld);
        setColleagues(sib.filter((s) => s.id !== String(c.contact_id)));
        setActivity(acts);
      } catch {
        if (!cancelled) {
          setError('Could not load this contact.');
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [contactId]);

  // Per-project status + draft — reloads whenever the contact or project changes.
  const loadProjectStatus = useCallback(async () => {
    if (!contactId || projectId == null) {
      setProjectStatus(null);
      setStatusDraft({ contact_status: '', description: '', comments: '' });
      return;
    }
    const ps = await getContactStatus(contactId, projectId);
    setProjectStatus(ps);
    setStatusDraft({
      contact_status: ps?.contact_status ?? '',
      description: ps?.description ?? '',
      comments: ps?.comments ?? '',
    });
  }, [contactId, projectId]);

  useEffect(() => { loadProjectStatus(); }, [loadProjectStatus]);

  // Resolve the owner label whenever the per-project owner changes.
  useEffect(() => {
    let cancelled = false;
    fetchUserLabel(projectStatus?.owner_user_id ?? null).then((n) => {
      if (!cancelled) setOwnerName(n);
    });
    return () => { cancelled = true; };
  }, [projectStatus?.owner_user_id]);

  /* ---- Save status (mirrors ContactDetailPage.saveProjectStatus) ---- */
  async function saveProjectStatus() {
    if (!contactId || projectId == null) return;
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
      setStatusError(humanizeWriteError(err));
      return;
    }
    setStatusSuccess(true);
    setTimeout(() => setStatusSuccess(false), 3000);
    await loadProjectStatus();
  }

  /* ---- Assign / change owner (mirrors ContactDetailPage) ---- */
  const openReassign = async () => {
    if (projectId == null) return;
    setReassignError(null);
    setReassignOwners([]);
    setShowReassign(true);
    const owners = await fetchAssignableUsers(projectStatus?.owner_user_id ?? null);
    setReassignOwners(owners);
  };

  const handleReassign = async (newUserId: number) => {
    if (!contactId || projectId == null) return;
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
    await loadProjectStatus();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160 }}>
        <Loader2 size={20} className="animate-spin" style={{ color: '#9CA3AF' }} />
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '32px 0', textAlign: 'center' }}>
        <AlertCircle size={20} style={{ color: '#F87171' }} />
        <span style={{ fontSize: 13, color: '#6B7280' }}>{error ?? 'Contact not found.'}</span>
      </div>
    );
  }

  const linkedinHref = contact.linkedin_url
    ? (contact.linkedin_url.startsWith('http') ? contact.linkedin_url : `https://linkedin.com/in/${contact.linkedin_url}`)
    : undefined;

  const recentActivity = activity.slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Header: avatar + name + designation + company */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            width: 46, height: 46, borderRadius: '50%',
            background: '#E8F2FD', color: '#1A7EE8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 700, flexShrink: 0, letterSpacing: 0.4,
          }}
        >
          {contactInitials(contact.full_name)}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1.2 }}>
              {contact.full_name || 'Contact'}
            </h2>
            {contact.is_demo && (
              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.4, background: '#F3F4F6', color: '#9CA3AF', borderRadius: 3, padding: '1px 5px' }}>
                DEMO
              </span>
            )}
          </div>
          {contact.designation && (
            <p style={{ fontSize: 12.5, color: '#6B7280', margin: '2px 0 0' }}>{contact.designation}</p>
          )}
          {contact.company_name && contact.company_id ? (
            <Link
              to={`/companies/${contact.company_id}`}
              target="_blank"
              rel="noreferrer noopener"
              title="Open company in a new tab"
              style={{ fontSize: 12.5, color: BRAND, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3 }}
            >
              <Building2 size={12} />
              {contact.company_name}
              <ExternalLink size={10} style={{ opacity: 0.6 }} />
            </Link>
          ) : contact.company_name ? (
            <span style={{ fontSize: 12.5, color: '#6B7280', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
              <Building2 size={12} /> {contact.company_name}
            </span>
          ) : null}
        </div>
      </div>

      {/* Project Status — editable per-project block (parity with the full page) */}
      <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 14px', background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
          <SectionTitle>Project Status</SectionTitle>
          <ProjectSelect value={projectId} onChange={setProjectId} />
        </div>

        {projectId == null ? (
          <p style={{ fontSize: 12.5, color: '#9CA3AF', margin: 0 }}>Select a project to view and edit status.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Owner (this project) + Assign / Change owner */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 500 }}>Owner (this project)</span>
                <span style={{ fontSize: 12.5, color: ownerName ? '#18181b' : '#9CA3AF', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ownerName || 'Unassigned'}
                </span>
              </div>
              {canReassign && (
                <button
                  type="button"
                  onClick={openReassign}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
                    fontSize: 11.5, fontWeight: 500,
                    background: '#fff', color: '#374151',
                    border: '1px solid #d4d4d8', borderRadius: 6,
                    padding: '5px 10px', height: 28, cursor: 'pointer',
                  }}
                  title="Assign this contact (in this project) to a salesperson"
                >
                  <UserCheck size={13} />
                  {ownerName ? 'Change owner' : 'Assign owner'}
                </button>
              )}
            </div>

            {/* Current status badge */}
            {projectStatus?.contact_status && (
              <div>
                <StatusBadge value={projectStatus.contact_status} category="contact_status" />
              </div>
            )}

            {/* Status dropdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10.5, color: '#6B7280', fontWeight: 500 }}>Contact Status</label>
              <select
                value={statusDraft.contact_status}
                onChange={(e) => setStatusDraft((d) => ({ ...d, contact_status: e.target.value }))}
                style={{
                  fontSize: 13, padding: '6px 10px',
                  border: '1px solid #d4d4d8', borderRadius: 6,
                  background: '#fff', color: '#18181b', outline: 'none',
                  cursor: 'pointer', height: 34, appearance: 'none', width: '100%',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#d4d4d8'; }}
              >
                <option value="">— none —</option>
                {statusOptions.map((o) => (
                  <option key={o.option_id} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10.5, color: '#6B7280', fontWeight: 500 }}>Description</label>
              <textarea
                value={statusDraft.description}
                onChange={(e) => setStatusDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="Short description…"
                rows={2}
                style={{
                  fontSize: 13, padding: '6px 10px', resize: 'vertical',
                  border: '1px solid #d4d4d8', borderRadius: 6,
                  background: '#fff', color: '#18181b', outline: 'none',
                  fontFamily: 'inherit', width: '100%',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#d4d4d8'; }}
              />
            </div>

            {/* Comments */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10.5, color: '#6B7280', fontWeight: 500 }}>Comments</label>
              <textarea
                value={statusDraft.comments}
                onChange={(e) => setStatusDraft((d) => ({ ...d, comments: e.target.value }))}
                placeholder="Internal comments…"
                rows={2}
                style={{
                  fontSize: 13, padding: '6px 10px', resize: 'vertical',
                  border: '1px solid #d4d4d8', borderRadius: 6,
                  background: '#fff', color: '#18181b', outline: 'none',
                  fontFamily: 'inherit', width: '100%',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#d4d4d8'; }}
              />
            </div>

            {statusError && <p style={{ fontSize: 12, color: '#EF4444', margin: 0 }}>{statusError}</p>}
            {statusSuccess && <p style={{ fontSize: 12, color: '#16A34A', margin: 0 }}>Status saved.</p>}

            <button
              type="button"
              onClick={saveProjectStatus}
              disabled={savingStatus || projectId == null}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
                fontSize: 12, fontWeight: 500,
                background: '#1A7EE8', color: '#fff',
                border: 'none', borderRadius: 6,
                padding: '6px 14px',
                cursor: (savingStatus || projectId == null) ? 'not-allowed' : 'pointer',
                opacity: (savingStatus || projectId == null) ? 0.6 : 1,
              }}
            >
              {savingStatus ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Save status
            </button>
          </div>
        )}

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

      {/* Log a call (writes to the live interaction table, same as the full record) */}
      {projectId != null && (
        <PreviewCallLogger
          recordType="contact"
          recordId={contactId}
          projectId={projectId}
          ownerUserId={projectStatus?.owner_user_id ?? null}
          actorId={profile?.user_id != null ? String(profile.user_id) : null}
          onLogged={() => setLogVersion((v) => v + 1)}
        />
      )}

      {/* Recent calls (logged dispositions, this project) */}
      <CallLogPreview entity="contact" id={contactId} projectId={projectId} refreshSignal={logVersion} />

      {/* Quick contact methods + key fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Field
          icon={<Mail size={14} />}
          label="Email"
          value={contact.email}
          href={contact.email ? `mailto:${contact.email}` : undefined}
          copyValue={contact.email}
        />
        <Field
          icon={<Phone size={14} />}
          label="Phone"
          value={contact.mobile_no}
          href={contact.mobile_no ? `tel:${contact.mobile_no}` : undefined}
          copyValue={contact.mobile_no}
        />
        <Field
          icon={<Phone size={14} />}
          label="Alt Phone"
          value={contact.alt_mobile_no}
          href={contact.alt_mobile_no ? `tel:${contact.alt_mobile_no}` : undefined}
          copyValue={contact.alt_mobile_no}
        />
        <Field
          icon={<Link2 size={14} />}
          label="LinkedIn"
          value={contact.linkedin_clean || contact.linkedin_url}
          href={linkedinHref}
        />
        <Field icon={<MapPin size={14} />} label="City" value={contact.city_name} />
        <Field icon={<Briefcase size={14} />} label="Designation" value={contact.designation} />
      </div>

      {/* Linked Leads */}
      <div>
        <SectionTitle>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <ClipboardList size={12} /> Leads ({leads.length})
          </span>
        </SectionTitle>
        {leads.length === 0 ? (
          <p style={{ fontSize: 12.5, color: '#9CA3AF', margin: 0 }}>No leads linked.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {leads.slice(0, 5).map((l) => (
              <a
                key={l.id}
                href={`/leads/${l.id}`}
                target="_blank"
                rel="noreferrer noopener"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  border: '1px solid #E5E7EB', borderRadius: 8, padding: '6px 10px',
                  textDecoration: 'none', background: '#fff',
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {l.leadName || 'Untitled lead'}
                  <ExternalLink size={10} style={{ color: '#9CA3AF' }} />
                </span>
                {l.stage && <StageBadge stage={l.stage} />}
              </a>
            ))}
            {leads.length > 5 && (
              <span style={{ fontSize: 11.5, color: '#9CA3AF' }}>+{leads.length - 5} more</span>
            )}
          </div>
        )}
      </div>

      {/* Colleagues */}
      <div>
        <SectionTitle>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Users size={12} /> Colleagues ({colleagues.length})
          </span>
        </SectionTitle>
        {!contact.company_id ? (
          <p style={{ fontSize: 12.5, color: '#9CA3AF', margin: 0 }}>Link a company to see colleagues.</p>
        ) : colleagues.length === 0 ? (
          <p style={{ fontSize: 12.5, color: '#9CA3AF', margin: 0 }}>No other contacts at this company.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {colleagues.slice(0, 5).map((s) => (
              <Link
                key={s.id}
                to={`/contacts/${s.id}`}
                target="_blank"
                rel="noreferrer noopener"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  fontSize: 12.5, color: '#374151', textDecoration: 'none', padding: '4px 6px', borderRadius: 6,
                }}
              >
                <span style={{ fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {s.fullName || '—'}
                  <ExternalLink size={10} style={{ color: '#9CA3AF' }} />
                </span>
                <span style={{ color: '#9CA3AF', fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.designation || ''}
                </span>
              </Link>
            ))}
            {colleagues.length > 5 && (
              <span style={{ fontSize: 11.5, color: '#9CA3AF', padding: '2px 6px' }}>+{colleagues.length - 5} more</span>
            )}
          </div>
        )}
      </div>

      {/* Recent activity (last ~5) */}
      <div>
        <SectionTitle>Recent activity</SectionTitle>
        {recentActivity.length === 0 ? (
          <p style={{ fontSize: 12.5, color: '#9CA3AF', margin: 0 }}>No activity yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentActivity.map((it) => (
              <li key={it.interaction_id} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 12.5, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {describeInteraction(it)}
                </span>
                <span style={{ fontSize: 10.5, color: '#9CA3AF' }}>
                  {it.type === 'call' ? 'Call' : it.type === 'status_change' ? 'Status change' : it.type}
                  {' · '}
                  {formatDate(it.occurred_at ? String(it.occurred_at).substring(0, 10) : null)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default ContactPreview;
