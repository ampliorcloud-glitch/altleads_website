/**
 * CompanyPreview — compact "mini record" for a company, rendered INSIDE the
 * generic RecordPreviewPanel (ALT-327/328). A denser mirror of CompanyDetailPage
 * that reaches PARITY with the full page's "Account — Project Status" card:
 * header (avatar + name + domain/website + city); a per-project selector (seeded
 * from the global scope, ALT-294) that drives an EDITABLE status block — Owner
 * (+ Assign/Change owner via ReassignModal), Account Status + Feasibility +
 * Decision Power dropdowns, Description + Comments, and a Save button; plus key
 * fields (industry, size, CIN, revenue), associated Contacts + Leads, and a short
 * recent-activity list.
 *
 * Reuses the EXISTING data layer exactly like CompanyDetailPage:
 *   - getCompanyStatus / upsertCompanyStatus (data/projectStatus)
 *   - fetchActivity (data/projectStatus)
 *   - reassignCompany / fetchAssignableUsers / fetchUserLabel (data/assignment)
 *   - fetchCompanyById / fetchCompanyContacts / fetchCompanyDeals (data/companies)
 *   - fetchOptions('account_status'|'feasibility'|'decision_power') (data/dropdowns)
 *   - ProjectSelect + useProjectScope for the project picker
 *   - useAuth → profile.user_id (actor) + canReassign (gates Assign owner)
 * No new data fns are introduced.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2,
  Globe,
  MapPin,
  Building2,
  Users,
  Hash,
  Mail,
  Link2,
  IndianRupee,
  ExternalLink,
  AlertCircle,
  ClipboardList,
  Save,
  UserCheck,
  ChevronDown,
} from 'lucide-react';
import {
  fetchCompanyById,
  fetchCompanyContacts,
  fetchCompanyDeals,
  type Company,
  type CompanyContact,
  type CompanyDeal,
} from '../../data/companies';
import {
  getCompanyStatus,
  upsertCompanyStatus,
  fetchActivity,
  type CompanyProjectStatus,
} from '../../data/projectStatus';
import { reassignCompany, fetchAssignableUsers, fetchUserLabel } from '../../data/assignment';
import { humanizeWriteError } from '../../lib/writeError';
import { fetchOptions, type DropdownOption } from '../../data/dropdowns';
import type { UserOption } from '../../data/wishlist';
import type { Interaction } from '../../data/contacts';
import { useAuth } from '../../contexts/AuthContext';
import { useProjectScope } from '../../contexts/ProjectContext';
import { ProjectSelect } from '../ui/ProjectSelect';
import { ReassignModal } from '../common/ReassignModal';
import { CopyButton } from '../ui/CopyButton';
import { StatusBadge } from '../ui/StatusBadge';
import { StageBadge } from '../ui/Badge';
import { formatDate } from '../../data/account';
import { CallLogPreview } from '../calls/CallLogPreview';
import { PreviewCallLogger } from '../calls/PreviewCallLogger';

const BRAND = 'var(--color-brand, #1A7EE8)';

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

/** Format an employee count with Indian grouping; em-dash when unknown. */
function fmtSize(size: number | null): string {
  return size != null ? size.toLocaleString('en-IN') : '—';
}

/* Compact label/value row with optional link + copy (mirrors detail page). */
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

const selectStyle: React.CSSProperties = {
  fontSize: 13, padding: '6px 28px 6px 10px',
  border: '1px solid #d4d4d8', borderRadius: 6,
  background: '#fff', color: '#18181b', outline: 'none',
  cursor: 'pointer', height: 34, appearance: 'none', width: '100%',
};

const textareaStyle: React.CSSProperties = {
  fontSize: 13, padding: '6px 10px', resize: 'vertical',
  border: '1px solid #d4d4d8', borderRadius: 6,
  background: '#fff', color: '#18181b', outline: 'none',
  fontFamily: 'inherit', width: '100%',
};

function describeInteraction(it: Interaction): string {
  if (it.note_text) return it.note_text;
  if (it.disposition) return it.disposition;
  return it.type === 'status_change' ? 'Status updated' : it.type === 'call' ? 'Call logged' : it.type;
}

export function CompanyPreview({
  companyId,
  projectId: initialProjectId,
}: {
  companyId: number;
  projectId?: number | null;
}) {
  const { profile, canReassign } = useAuth();
  const { selectedProjectId } = useProjectScope();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [contacts, setContacts] = useState<CompanyContact[]>([]);
  const [deals, setDeals] = useState<CompanyDeal[]>([]);
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

  const [projectStatus, setProjectStatus] = useState<CompanyProjectStatus | null>(null);
  const [accountStatusOpts, setAccountStatusOpts] = useState<DropdownOption[]>([]);
  const [feasibilityOpts, setFeasibilityOpts] = useState<DropdownOption[]>([]);
  const [decisionPowerOpts, setDecisionPowerOpts] = useState<DropdownOption[]>([]);
  const [statusDraft, setStatusDraft] = useState<{
    account_status: string;
    is_feasible: string;
    decision_power: string;
    description: string;
    comments: string;
  }>({ account_status: '', is_feasible: '', decision_power: '', description: '', comments: '' });
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

  // Load dropdown options once (same source as the full page).
  useEffect(() => {
    fetchOptions('account_status').then(setAccountStatusOpts);
    fetchOptions('feasibility').then(setFeasibilityOpts);
    fetchOptions('decision_power').then(setDecisionPowerOpts);
  }, []);

  // Core company + associations.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setCompany(null);
    setContacts([]);
    setDeals([]);
    setActivity([]);

    (async () => {
      try {
        const co = await fetchCompanyById(companyId);
        if (cancelled) return;
        if (!co) {
          setError('Company not found.');
          setLoading(false);
          return;
        }
        setCompany(co);
        setLoading(false);

        // Secondary data — load in parallel, non-blocking for the header.
        const [cts, dls] = await Promise.all([
          fetchCompanyContacts(companyId),
          fetchCompanyDeals(companyId),
        ]);
        if (cancelled) return;
        setContacts(cts);
        setDeals(dls);
      } catch {
        if (!cancelled) {
          setError('Could not load this company.');
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [companyId]);

  // Per-project status + draft — reloads whenever the company or project changes.
  const loadProjectStatus = useCallback(async () => {
    if (!companyId || projectId == null) {
      setProjectStatus(null);
      setStatusDraft({ account_status: '', is_feasible: '', decision_power: '', description: '', comments: '' });
      return;
    }
    const ps = await getCompanyStatus(companyId, projectId);
    setProjectStatus(ps);
    setStatusDraft({
      account_status: ps?.account_status ?? '',
      is_feasible: ps?.is_feasible ?? '',
      decision_power: ps?.decision_power ?? '',
      description: ps?.description ?? '',
      comments: ps?.comments ?? '',
    });
  }, [companyId, projectId]);

  useEffect(() => { loadProjectStatus(); }, [loadProjectStatus]);

  // Per-project activity feed — reloads whenever the company or project changes.
  useEffect(() => {
    let cancelled = false;
    if (!companyId) { setActivity([]); return; }
    fetchActivity('company', companyId, projectId ?? undefined).then((rows) => {
      if (!cancelled) setActivity(rows);
    });
    return () => { cancelled = true; };
  }, [companyId, projectId]);

  // Resolve the owner label whenever the per-project owner changes.
  useEffect(() => {
    let cancelled = false;
    fetchUserLabel(projectStatus?.owner_user_id ?? null).then((n) => {
      if (!cancelled) setOwnerName(n);
    });
    return () => { cancelled = true; };
  }, [projectStatus?.owner_user_id]);

  /* ---- Save status (mirrors CompanyDetailPage AccountPanel.handleSave) ---- */
  async function saveProjectStatus() {
    if (!companyId || projectId == null) return;
    setSavingStatus(true);
    setStatusError(null);
    setStatusSuccess(false);
    const actorId = profile?.user_id != null ? String(profile.user_id) : null;
    const { error: err } = await upsertCompanyStatus(
      companyId,
      projectId,
      {
        account_status: statusDraft.account_status || null,
        is_feasible: statusDraft.is_feasible || null,
        decision_power: statusDraft.decision_power || null,
        description: statusDraft.description.trim() || null,
        comments: statusDraft.comments.trim() || null,
      },
      actorId,
    );
    setSavingStatus(false);
    if (err) {
      // The data layer already humanizes (RLS 42501 / missing-table); pass it
      // through humanizeWriteError as a final guard so nothing raw ever shows.
      setStatusError(humanizeWriteError(err));
      return;
    }
    setStatusSuccess(true);
    setTimeout(() => setStatusSuccess(false), 3000);
    await loadProjectStatus();
  }

  /* ---- Assign / change owner (mirrors CompanyDetailPage AccountPanel) ---- */
  const openReassign = async () => {
    if (projectId == null) return;
    setReassignError(null);
    setReassignOwners([]);
    setShowReassign(true);
    const owners = await fetchAssignableUsers(projectStatus?.owner_user_id ?? null);
    setReassignOwners(owners);
  };

  const handleReassign = async (newUserId: number) => {
    if (!companyId || projectId == null) return;
    setReassignSaving(true);
    setReassignError(null);
    const res = await reassignCompany({
      companyId,
      projectId,
      newUserId,
      actor: profile?.user_id != null ? String(profile.user_id) : '',
      companyName: company?.name || undefined,
      isReassign: projectStatus?.owner_user_id != null,
    });
    setReassignSaving(false);
    if (res?.error) { setReassignError(res.error); return; }
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

  if (error || !company) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '32px 0', textAlign: 'center' }}>
        <AlertCircle size={20} style={{ color: '#F87171' }} />
        <span style={{ fontSize: 13, color: '#6B7280' }}>{error ?? 'Company not found.'}</span>
      </div>
    );
  }

  const website = fullUrl(company.webUrl || company.domainClean);
  const linkedinHref = company.linkedin ? fullUrl(company.linkedin) : undefined;
  const recentActivity = activity.slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Header: avatar + name + domain/website + city */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            width: 46, height: 46, borderRadius: 10,
            background: 'var(--color-brand-light, #E8F2FD)', color: '#1A7EE8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 700, flexShrink: 0, letterSpacing: 0.4,
            border: '1px solid rgba(196,149,106,0.20)',
          }}
        >
          {companyInitials(company.name)}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1.2 }}>
              {company.name || 'Company'}
            </h2>
            {company.isDemo && (
              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.4, background: '#F3F4F6', color: '#9CA3AF', borderRadius: 3, padding: '1px 5px', textTransform: 'uppercase' }}>
                Demo
              </span>
            )}
          </div>
          {company.domainClean ? (
            <a
              href={website}
              target="_blank"
              rel="noreferrer noopener"
              title={company.domainClean}
              style={{ fontSize: 12.5, color: BRAND, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3 }}
            >
              <Globe size={12} />
              {company.domainClean}
              <ExternalLink size={10} style={{ opacity: 0.6 }} />
            </a>
          ) : null}
          {company.city && (
            <p style={{ fontSize: 12.5, color: '#6B7280', margin: '2px 0 0', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={12} /> {company.city}
            </p>
          )}
        </div>
      </div>

      {/* Account — Project Status — editable per-project block (parity with the full page) */}
      <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 14px', background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
          <SectionTitle>Account — Project Status</SectionTitle>
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
                  title="Assign this company (in this project) to a salesperson"
                >
                  <UserCheck size={13} />
                  {ownerName ? 'Change owner' : 'Assign owner'}
                </button>
              )}
            </div>

            {/* Current status badge */}
            {projectStatus?.account_status && (
              <div>
                <StatusBadge value={projectStatus.account_status} category="account_status" />
              </div>
            )}

            {/* Account Status dropdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10.5, color: '#6B7280', fontWeight: 500 }}>Account Status</label>
              <div style={{ position: 'relative' }}>
                <select
                  value={statusDraft.account_status}
                  onChange={(e) => setStatusDraft((d) => ({ ...d, account_status: e.target.value }))}
                  style={selectStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#d4d4d8'; }}
                >
                  <option value="">— none —</option>
                  {accountStatusOpts.map((o) => (
                    <option key={o.option_id} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <ChevronDown size={13} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
              </div>
            </div>

            {/* Feasibility + Decision Power */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10.5, color: '#6B7280', fontWeight: 500 }}>Feasibility</label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={statusDraft.is_feasible}
                    onChange={(e) => setStatusDraft((d) => ({ ...d, is_feasible: e.target.value }))}
                    style={selectStyle}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#d4d4d8'; }}
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
                  <ChevronDown size={13} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10.5, color: '#6B7280', fontWeight: 500 }}>Decision Power</label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={statusDraft.decision_power}
                    onChange={(e) => setStatusDraft((d) => ({ ...d, decision_power: e.target.value }))}
                    style={selectStyle}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#d4d4d8'; }}
                  >
                    <option value="">—</option>
                    {decisionPowerOpts.map((o) => (
                      <option key={o.option_id} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={13} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
                </div>
              </div>
            </div>

            {/* Description */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10.5, color: '#6B7280', fontWeight: 500 }}>Description</label>
              <textarea
                value={statusDraft.description}
                onChange={(e) => setStatusDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="Short description…"
                rows={2}
                style={textareaStyle}
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
                style={textareaStyle}
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
            entityLabel="Company"
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
          recordType="company"
          recordId={companyId}
          projectId={projectId}
          ownerUserId={projectStatus?.owner_user_id ?? null}
          actorId={profile?.user_id != null ? String(profile.user_id) : null}
          onLogged={() => setLogVersion((v) => v + 1)}
        />
      )}

      {/* Recent calls (logged dispositions, this project) */}
      <CallLogPreview entity="company" id={companyId} projectId={projectId} refreshSignal={logVersion} />

      {/* Key fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Field icon={<Building2 size={14} />} label="Industry" value={company.industry} />
        <Field icon={<Users size={14} />} label="Employees" value={fmtSize(company.size)} />
        <Field icon={<IndianRupee size={14} />} label="Revenue" value={company.turnover} />
        <Field
          icon={<Globe size={14} />}
          label="Website"
          value={company.domainClean || company.webUrl}
          href={website || undefined}
        />
        <Field
          icon={<Mail size={14} />}
          label="Email"
          value={company.email}
          href={company.email ? `mailto:${company.email}` : undefined}
          copyValue={company.email}
        />
        <Field
          icon={<Link2 size={14} />}
          label="LinkedIn"
          value={company.linkedin ? 'View profile' : ''}
          href={linkedinHref}
        />
        <Field icon={<Hash size={14} />} label="CIN" value={company.cin} copyValue={company.cin} />
      </div>

      {/* Associated Contacts */}
      <div>
        <SectionTitle>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Users size={12} /> Contacts ({contacts.length})
          </span>
        </SectionTitle>
        {contacts.length === 0 ? (
          <p style={{ fontSize: 12.5, color: '#9CA3AF', margin: 0 }}>No contacts at this company.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {contacts.slice(0, 5).map((c) => (
              <Link
                key={c.id}
                to={`/contacts/${c.id}`}
                target="_blank"
                rel="noreferrer noopener"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  fontSize: 12.5, color: '#374151', textDecoration: 'none', padding: '4px 6px', borderRadius: 6,
                }}
              >
                <span style={{ fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {c.fullName || '—'}
                  <ExternalLink size={10} style={{ color: '#9CA3AF' }} />
                </span>
                <span style={{ color: '#9CA3AF', fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.designation || ''}
                </span>
              </Link>
            ))}
            {contacts.length > 5 && (
              <span style={{ fontSize: 11.5, color: '#9CA3AF', padding: '2px 6px' }}>+{contacts.length - 5} more</span>
            )}
          </div>
        )}
      </div>

      {/* Associated Leads */}
      <div>
        <SectionTitle>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <ClipboardList size={12} /> Leads ({deals.length})
          </span>
        </SectionTitle>
        {deals.length === 0 ? (
          <p style={{ fontSize: 12.5, color: '#9CA3AF', margin: 0 }}>No leads linked.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {deals.slice(0, 5).map((d) => (
              <a
                key={d.id}
                href={`/leads/${d.id}`}
                target="_blank"
                rel="noreferrer noopener"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  border: '1px solid #E5E7EB', borderRadius: 8, padding: '6px 10px',
                  textDecoration: 'none', background: '#fff',
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {d.leadName || 'Untitled lead'}
                  <ExternalLink size={10} style={{ color: '#9CA3AF' }} />
                </span>
                {d.stage && <StageBadge stage={d.stage} />}
              </a>
            ))}
            {deals.length > 5 && (
              <span style={{ fontSize: 11.5, color: '#9CA3AF' }}>+{deals.length - 5} more</span>
            )}
          </div>
        )}
      </div>

      {/* Recent activity (last ~5, scoped to the selected project) */}
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

export default CompanyPreview;
