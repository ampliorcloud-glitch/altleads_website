/**
 * MeetingPreview — compact "mini record" for a meeting, rendered INSIDE the
 * generic RecordPreviewPanel (ALT-327/328). A denser mirror of MeetingDetailPage
 * (and the sales "mobile-ditto" record) for the right-hand list-row preview:
 * header (meeting name / company + the contact); date / time / mode (virtual link
 * or location) / status (READ-ONLY badge here — reschedule / cancel are workflow
 * actions that stay on the full page); the assigned salesperson with a "Change
 * owner" action (reassignMeeting, gated by canReassign); key fields (agenda,
 * opportunity value, project / lead stage); company + contact links; and a short
 * recent reschedule/cancel history list.
 *
 * Reuses the EXISTING data layer exactly like MeetingDetailPage:
 *   - fetchMeetingDetail (data/meetings) for the whole record
 *   - reassignMeeting / fetchAssignableUsers (data/assignment) for change-owner
 *   - useAuth → profile.user_id (actor) + canReassign (gates the owner change)
 * No new data fns are introduced. Status editing is intentionally NOT here:
 * meeting status changes are reschedule/cancel flows handled on the full page.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2,
  AlertCircle,
  CalendarDays,
  Clock,
  Video,
  Phone,
  MapPin,
  Briefcase,
  User,
  Building2,
  ExternalLink,
  FileText,
  Target,
  History,
  CheckCircle2,
  UserCheck,
  Link2,
} from 'lucide-react';
import {
  fetchMeetingDetail,
  formatDate,
  formatTime,
  type MeetingDetail,
} from '../../data/meetings';
import { reassignMeeting, fetchAssignableUsers } from '../../data/assignment';
import type { UserOption } from '../../data/wishlist';
import { useAuth } from '../../contexts/AuthContext';
import { ReassignModal } from '../common/ReassignModal';
import { CopyButton } from '../ui/CopyButton';
import { MeetingStatusBadge } from '../meeting/MeetingStatusBadge';
import { CallLogPreview } from '../calls/CallLogPreview';
import { PreviewCallLogger } from '../calls/PreviewCallLogger';

const BRAND = 'var(--color-brand, #1A7EE8)';

function modeIcon(mode: string) {
  if (/online/i.test(mode)) return <Video size={14} />;
  if (/tele/i.test(mode)) return <Phone size={14} />;
  if (/offline/i.test(mode)) return <MapPin size={14} />;
  return <CalendarDays size={14} />;
}

/* Compact label/value row with optional link + copy (mirrors ContactPreview.Field). */
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

export function MeetingPreview({ meetingId }: { meetingId: number }) {
  const { profile, canReassign } = useAuth();
  const actor = profile?.user_id != null ? String(profile.user_id) : '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);

  // Bumped after a call is logged in the preview so CallLogPreview re-fetches (ALT-337).
  const [logVersion, setLogVersion] = useState(0);

  // Change-owner (ALT-288). A meeting's owner = its lead's assigned salesperson;
  // reassigning here reassigns the underlying lead (reassignMeeting).
  const [showReassign, setShowReassign] = useState(false);
  const [reassignSaving, setReassignSaving] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [reassignOwners, setReassignOwners] = useState<UserOption[]>([]);

  async function load() {
    const result = await fetchMeetingDetail(String(meetingId));
    setMeeting(result.meeting);
    setError(result.error ?? (result.meeting ? null : 'Meeting not found.'));
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setMeeting(null);
    (async () => {
      const result = await fetchMeetingDetail(String(meetingId));
      if (cancelled) return;
      setMeeting(result.meeting);
      setError(result.error ?? (result.meeting ? null : 'Meeting not found.'));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [meetingId]);

  const openReassign = async () => {
    setReassignError(null);
    setReassignOwners([]);
    setShowReassign(true);
    const owners = await fetchAssignableUsers(meeting?.salespersonUserId ?? null);
    setReassignOwners(owners);
  };

  const handleReassign = async (newUserId: number) => {
    if (!meeting) return;
    setReassignSaving(true);
    setReassignError(null);
    const res = await reassignMeeting({
      meetingId: Number(meeting.id),
      leadId: meeting.leadId != null ? Number(meeting.leadId) : null,
      newUserId,
      actor,
      meetingName: meeting.company || meeting.leadName || meeting.name || undefined,
      company: meeting.company || undefined,
      isReassign: meeting.salespersonUserId != null,
    });
    setReassignSaving(false);
    if (res?.error) { setReassignError(res.error); return; }
    setShowReassign(false);
    await load();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160 }}>
        <Loader2 size={20} className="animate-spin" style={{ color: '#9CA3AF' }} />
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '32px 0', textAlign: 'center' }}>
        <AlertCircle size={20} style={{ color: '#F87171' }} />
        <span style={{ fontSize: 13, color: '#6B7280' }}>{error ?? 'Meeting not found.'}</span>
      </div>
    );
  }

  const heading = meeting.company || meeting.leadName || meeting.name || 'Meeting';
  // Mode location: virtual link (Online/Telephonic) or physical address (Offline).
  const locationLine = [meeting.addressLine1, meeting.addressLine2, meeting.city].filter(Boolean).join(', ');
  const recentHistory = meeting.history.slice(0, 4);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Header: meeting name / company + the contact */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            width: 46, height: 46, borderRadius: 12,
            background: '#E8F2FD', color: '#1A7EE8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <CalendarDays size={22} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1.2 }}>
              {heading}
            </h2>
            <MeetingStatusBadge status={meeting.status} size="md" />
            {meeting.confirmed && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 500, background: '#F0FDF4', color: '#16A34A', borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap' }}>
                <CheckCircle2 size={11} /> Confirmed
              </span>
            )}
          </div>
          {meeting.name && meeting.name !== heading && (
            <p style={{ fontSize: 12.5, color: '#6B7280', margin: '2px 0 0' }}>{meeting.name}</p>
          )}
          {meeting.leadName && (
            <p style={{ fontSize: 12.5, color: '#6B7280', margin: '3px 0 0', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <User size={12} />
              {meeting.leadName}{meeting.leadDesignation ? ` · ${meeting.leadDesignation}` : ''}
            </p>
          )}
        </div>
      </div>

      {/* When / how */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Field icon={<CalendarDays size={14} />} label="Date" value={meeting.meetingDate ? formatDate(meeting.meetingDate) : ''} />
        <Field icon={<Clock size={14} />} label="Time" value={meeting.meetingTime ? formatTime(meeting.meetingTime) : ''} />
        <Field icon={modeIcon(meeting.mode)} label="Mode" value={meeting.mode} />
        {/* Virtual link for online/telephonic, location for offline. */}
        {meeting.meetingUrl ? (
          <Field icon={<Video size={14} />} label="Meeting link" value={meeting.meetingUrl} href={meeting.meetingUrl} copyValue={meeting.meetingUrl} />
        ) : locationLine ? (
          <Field icon={<MapPin size={14} />} label="Location" value={locationLine} />
        ) : null}
        {meeting.duration && <Field icon={<Clock size={14} />} label="Duration" value={meeting.duration} />}
        {meeting.followUpDate && (
          <Field icon={<CalendarDays size={14} />} label="Follow-up" value={formatDate(meeting.followUpDate)} />
        )}
      </div>

      {/* Salesperson + Change owner (gated by canReassign) */}
      <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 14px', background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 500 }}>Salesperson</span>
            <span style={{ fontSize: 12.5, color: meeting.salesperson ? '#18181b' : '#9CA3AF', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {meeting.salesperson || 'Unassigned'}
            </span>
          </div>
          {canReassign && meeting.leadId && (
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
              title="Reassign this meeting's lead to another salesperson"
            >
              <UserCheck size={13} />
              Change owner
            </button>
          )}
        </div>
        {meeting.agent && (
          <div style={{ marginTop: 10 }}>
            <Field icon={<User size={14} />} label="Agent" value={meeting.agent} />
          </div>
        )}
      </div>

      {/* Log a call (record_type='meeting' in the live interaction table — the same
          store CallLogPreview reads for this meeting; owner = lead's salesperson) */}
      <PreviewCallLogger
        recordType="meeting"
        recordId={meetingId}
        projectId={null}
        ownerUserId={meeting.salespersonUserId ?? null}
        actorId={actor || null}
        onLogged={() => setLogVersion((v) => v + 1)}
      />

      {/* Recent calls (logged dispositions) */}
      <CallLogPreview entity="meeting" id={meetingId} refreshSignal={logVersion} />

      {/* Key fields: agenda, opportunity, project / stage */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(meeting.oppValue || meeting.oppTitle) && (
          <Field
            icon={<Target size={14} />}
            label="Opportunity"
            value={[meeting.oppTitle, meeting.oppValue].filter(Boolean).join(' · ')}
          />
        )}
        <Field icon={<History size={14} />} label="Lead stage" value={meeting.leadStage} />
        <Field icon={<Building2 size={14} />} label="Client" value={meeting.client} />
        <Field icon={<MapPin size={14} />} label="Industry" value={meeting.industry} />
      </div>

      {/* Agenda */}
      {meeting.description && (
        <div>
          <SectionTitle>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <FileText size={12} /> Agenda
            </span>
          </SectionTitle>
          <p style={{ fontSize: 12.5, color: '#374151', margin: 0, whiteSpace: 'pre-line', lineHeight: 1.5 }}>
            {meeting.description}
          </p>
        </div>
      )}

      {/* Company + contact links */}
      <div>
        <SectionTitle>Links</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {meeting.leadId ? (
            <Link
              to={`/leads/${meeting.leadId}`}
              target="_blank"
              rel="noreferrer noopener"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                border: '1px solid #E5E7EB', borderRadius: 8, padding: '6px 10px',
                textDecoration: 'none', background: '#fff',
              }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Building2 size={12} style={{ color: '#9CA3AF' }} />
                {meeting.company || meeting.leadName || 'Lead'}
                <ExternalLink size={10} style={{ color: '#9CA3AF' }} />
              </span>
              {meeting.leadNumber && (
                <span style={{ fontSize: 11, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{meeting.leadNumber}</span>
              )}
            </Link>
          ) : (
            <p style={{ fontSize: 12.5, color: '#9CA3AF', margin: 0 }}>No linked lead for this meeting.</p>
          )}
          {meeting.leadMobile && (
            <Field icon={<Phone size={14} />} label="Contact" value={meeting.leadMobile} href={`tel:${meeting.leadMobile}`} copyValue={meeting.leadMobile} />
          )}
          {meeting.leadEmail && (
            <Field icon={<FileText size={14} />} label="Email" value={meeting.leadEmail} href={`mailto:${meeting.leadEmail}`} copyValue={meeting.leadEmail} />
          )}
          {meeting.leadLinkedin && (
            <Field
              icon={<Link2 size={14} />}
              label="LinkedIn"
              value={meeting.leadLinkedin}
              href={meeting.leadLinkedin.startsWith('http') ? meeting.leadLinkedin : `https://${meeting.leadLinkedin}`}
            />
          )}
        </div>
      </div>

      {/* Recent reschedule / cancel history */}
      <div>
        <SectionTitle>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <History size={12} /> Recent activity
          </span>
        </SectionTitle>
        {recentHistory.length === 0 ? (
          <p style={{ fontSize: 12.5, color: '#9CA3AF', margin: 0 }}>No reschedules or cancellations recorded.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentHistory.map((h) => (
              <li key={h.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <MeetingStatusBadge status={h.status} />
                  <span style={{ fontSize: 10.5, color: '#9CA3AF' }}>
                    {h.createdDate ? formatDate(String(h.createdDate).substring(0, 10)) : ''}
                  </span>
                </div>
                {h.reason && (
                  <span style={{ fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {h.reason}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {showReassign && (
        <ReassignModal
          entityLabel="Meeting"
          ownerLabel="Salesperson"
          currentOwnerId={meeting.salespersonUserId}
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

export default MeetingPreview;
