/**
 * LeadPreview — compact "mini record" for a lead, rendered INSIDE the generic
 * RecordPreviewPanel (ALT-327/328). A denser mirror of LeadDetailPage's header +
 * info panel, following the proven ContactPreview pattern.
 *
 * Unlike contacts (which carry a simple per-project status that's editable in the
 * drawer), a lead's status is its STAGE — and stage moves go through the
 * lead-report workflow on the full page (ReportTab / StageSelect / clinch). So the
 * drawer shows the stage READ-ONLY as a StageBadge and routes any deep edit through
 * the panel's "Open full record →" affordance. The one write action it offers is
 * reassigning the salesperson (reassignLead), gated by canReassign — identical to
 * the full page's "Change salesperson".
 *
 * Reuses the EXISTING data layer exactly like LeadDetailPage:
 *   - fetchLeadDetail (lib/leadsApi) for the core record + resolved lookups
 *   - fetchLeadActivity (lib/leadsApi) for recent activity
 *   - reassignLead / fetchAssignableUsers / fetchUserLabel (data/assignment)
 *   - useAuth → profile.user_id (actor) + canReassign (gates Change salesperson)
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
  Hash,
  CalendarClock,
  Clock,
  FolderKanban,
  Radio,
  ExternalLink,
  AlertCircle,
  UserCheck,
} from 'lucide-react';
import {
  fetchLeadDetail,
  fetchLeadActivity,
  type LeadDetail,
  type ActivityItem,
} from '../../lib/leadsApi';
import { reassignLead, fetchAssignableUsers, fetchUserLabel } from '../../data/assignment';
import type { UserOption } from '../../data/wishlist';
import { useAuth } from '../../contexts/AuthContext';
import { ReassignModal } from '../common/ReassignModal';
import { CopyButton } from '../ui/CopyButton';
import { StageBadge } from '../ui/Badge';
import { formatDate } from '../../data/meetings';
import { humanizeWriteError } from '../../lib/writeError';
import { CallLogPreview } from '../calls/CallLogPreview';
import { PreviewCallLogger } from '../calls/PreviewCallLogger';

const BRAND = 'var(--color-brand, #1A7EE8)';

function leadInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/* Compact label/value row with optional link + copy (mirrors ContactPreview Field). */
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

export function LeadPreview({ leadId }: { leadId: number }) {
  const { profile, canReassign } = useAuth();
  const actor = profile?.user_id != null ? String(profile.user_id) : '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  // Bumped after a call is logged in the preview so CallLogPreview re-fetches (ALT-337).
  const [logVersion, setLogVersion] = useState(0);

  // Salesperson label + reassignment (ALT-288), mirrors LeadDetailPage.
  const [salespersonName, setSalespersonName] = useState<string>('');
  const [showReassign, setShowReassign] = useState(false);
  const [reassignSaving, setReassignSaving] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [reassignOwners, setReassignOwners] = useState<UserOption[]>([]);

  const loadLead = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLead(null);
    setActivity([]);
    try {
      const data = await fetchLeadDetail(leadId);
      if (!data) {
        setError('Lead not found.');
        setLoading(false);
        return;
      }
      setLead(data);
      setLoading(false);

      // Secondary, non-blocking for the header.
      fetchLeadActivity(leadId).then(setActivity).catch(() => { /* non-fatal */ });
    } catch {
      setError('Could not load this lead.');
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => { loadLead(); }, [loadLead]);

  // Resolve the salesperson label (prefer the name the detail fetch already
  // resolved; fall back to a direct lookup if only the id came through).
  useEffect(() => {
    let cancelled = false;
    if (lead?.salesperson_name) {
      setSalespersonName(lead.salesperson_name);
      return;
    }
    fetchUserLabel(lead?.salesperson_user_id ?? null).then((n) => {
      if (!cancelled) setSalespersonName(n);
    });
    return () => { cancelled = true; };
  }, [lead?.salesperson_user_id, lead?.salesperson_name]);

  const openReassign = async () => {
    setReassignError(null);
    setReassignOwners([]);
    setShowReassign(true);
    const owners = await fetchAssignableUsers(lead?.salesperson_user_id ?? null);
    setReassignOwners(owners);
  };

  const handleReassign = async (newUserId: number) => {
    if (!lead || !actor) return;
    setReassignSaving(true);
    setReassignError(null);
    const res = await reassignLead({
      leadId: lead.lead_id,
      newUserId,
      actor,
      leadName: lead.client_name || lead.company_name || lead.lead_name,
      company: lead.client_name || lead.company_name || undefined,
      isReassign: lead.salesperson_user_id != null,
    });
    setReassignSaving(false);
    if (res?.error) { setReassignError(humanizeWriteError(res.error)); return; }
    setShowReassign(false);
    await loadLead();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160 }}>
        <Loader2 size={20} className="animate-spin" style={{ color: '#9CA3AF' }} />
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '32px 0', textAlign: 'center' }}>
        <AlertCircle size={20} style={{ color: '#F87171' }} />
        <span style={{ fontSize: 13, color: '#6B7280' }}>{error ?? 'Lead not found.'}</span>
      </div>
    );
  }

  const companyTitle = lead.client_name || lead.company_name || lead.lead_name || 'Lead';
  const recentActivity = activity.slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Header: avatar + company + contact + city */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            width: 46, height: 46, borderRadius: 8,
            background: 'var(--color-brand-light, #E8F2FD)', color: '#1A7EE8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 700, flexShrink: 0, letterSpacing: 0.4,
            border: '1px solid rgba(196,149,106,0.20)',
          }}
        >
          {leadInitials(companyTitle)}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1.2 }}>
              {companyTitle}
            </h2>
            {lead.is_closed && (
              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.4, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 3, padding: '1px 5px' }}>
                CLOSED
              </span>
            )}
          </div>
          {lead.lead_name && lead.lead_name !== companyTitle && (
            <p style={{ fontSize: 12.5, color: '#6B7280', margin: '2px 0 0', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Building2 size={12} /> {lead.lead_name}
            </p>
          )}
          {lead.city_name && (
            <p style={{ fontSize: 12.5, color: '#6B7280', margin: '2px 0 0', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={12} /> {lead.city_name}
            </p>
          )}
        </div>
      </div>

      {/* Stage + salesperson — view-only stage (workflow edits live on the full page) */}
      <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 14px', background: '#fff', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 500 }}>Stage</span>
          <div>
            {lead.stage_name
              ? <StageBadge stage={lead.stage_name} />
              : <span style={{ fontSize: 12.5, color: '#9CA3AF' }}>No stage yet</span>}
          </div>
          <span style={{ fontSize: 10.5, color: '#9CA3AF' }}>
            Stage changes go through the Lead Report on the full record.
          </span>
        </div>

        {/* Assigned salesperson (this lead) + Change salesperson */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 500 }}>Salesperson</span>
            <span style={{ fontSize: 12.5, color: salespersonName ? '#18181b' : '#9CA3AF', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {salespersonName || 'Unassigned'}
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
              title="Reassign this lead to another salesperson"
            >
              <UserCheck size={13} />
              {salespersonName ? 'Change salesperson' : 'Assign salesperson'}
            </button>
          )}
        </div>
      </div>

      {/* Log a call (writes to the live interaction table, same as the full record) */}
      <PreviewCallLogger
        recordType="lead"
        recordId={leadId}
        projectId={lead.project_id ?? null}
        ownerUserId={lead.salesperson_user_id ?? null}
        actorId={actor || null}
        onLogged={() => setLogVersion((v) => v + 1)}
      />

      {/* Recent calls (logged dispositions) */}
      <CallLogPreview entity="lead" id={leadId} refreshSignal={logVersion} />

      {/* Key fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Field
          icon={<Mail size={14} />}
          label="Email"
          value={lead.email}
          href={lead.email ? `mailto:${lead.email}` : undefined}
          copyValue={lead.email}
        />
        <Field
          icon={<Phone size={14} />}
          label="Phone"
          value={lead.mobile_no}
          href={lead.mobile_no ? `tel:${lead.mobile_no}` : undefined}
          copyValue={lead.mobile_no}
        />
        {lead.alt_mobile_no && (
          <Field
            icon={<Phone size={14} />}
            label="Alt Phone"
            value={lead.alt_mobile_no}
            href={`tel:${lead.alt_mobile_no}`}
            copyValue={lead.alt_mobile_no}
          />
        )}
        {lead.designation && (
          <Field icon={<Briefcase size={14} />} label="Designation" value={lead.designation} />
        )}
        <Field icon={<FolderKanban size={14} />} label="Project" value={lead.project_name} />
        <Field icon={<Radio size={14} />} label="Source" value={lead.source_name} />
        <Field icon={<Hash size={14} />} label="Lead #" value={lead.lead_number} copyValue={lead.lead_number} />
        <Field icon={<CalendarClock size={14} />} label="Last updated" value={lead.updated_date ? formatDate(lead.updated_date.substring(0, 10)) : ''} />
      </div>

      {/* Company + contact links */}
      <div>
        <SectionTitle>Links</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {lead.company_id ? (
            <Link
              to={`/companies/${lead.company_id}`}
              target="_blank"
              rel="noreferrer noopener"
              title="Open company in a new tab"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                border: '1px solid #E5E7EB', borderRadius: 8, padding: '6px 10px',
                textDecoration: 'none', background: '#fff',
              }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Building2 size={13} style={{ color: '#9CA3AF' }} />
                {lead.company_name || lead.client_name || 'Company'}
                <ExternalLink size={10} style={{ color: '#9CA3AF' }} />
              </span>
            </Link>
          ) : (
            <span style={{ fontSize: 12.5, color: '#9CA3AF' }}>No linked company.</span>
          )}
        </div>
      </div>

      {/* Recent activity (last ~5) */}
      <div>
        <SectionTitle>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Clock size={12} /> Recent activity
          </span>
        </SectionTitle>
        {recentActivity.length === 0 ? (
          <p style={{ fontSize: 12.5, color: '#9CA3AF', margin: 0 }}>No activity yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentActivity.map((it) => (
              <li key={it.activity_id} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 12.5, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {it.lead_comments || 'Activity logged'}
                </span>
                <span style={{ fontSize: 10.5, color: '#9CA3AF' }}>
                  {it.created_by_name || 'Someone'}
                  {' · '}
                  {formatDate(it.created_date ? String(it.created_date).substring(0, 10) : '')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showReassign && (
        <ReassignModal
          entityLabel="Lead"
          ownerLabel="Salesperson"
          currentOwnerId={lead.salesperson_user_id}
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

export default LeadPreview;
