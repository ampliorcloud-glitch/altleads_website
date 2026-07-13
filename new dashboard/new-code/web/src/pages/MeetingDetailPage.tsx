import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { useAuth } from '../contexts/AuthContext';
import { MeetingStatusBadge } from '../components/meeting/MeetingStatusBadge';
import { UpdateMeetingModal } from '../components/meeting/UpdateMeetingModal';
import { EditMeetingModal } from '../components/meeting/EditMeetingModal';
import { CreateTaskModal, type TaskAssociation } from '../components/tasks/CreateTaskModal';
import { LogDispositionModal } from '../components/calls/LogDispositionModal';
import type { TaskType } from '../data/tasks';
import {
  fetchMeetingDetail,
  confirmMeeting,
  canConfirmMeeting,
  formatDate,
  formatTime,
  type MeetingDetail,
} from '../data/meetings';
import { isConflict, CONFLICT_MESSAGE } from '../lib/concurrency';
import {
  ArrowLeft,
  Loader2,
  CalendarDays,
  Clock,
  Video,
  MapPin,
  Phone,
  Users,
  MessageSquare,
  FileText,
  ExternalLink,
  Building2,
  User,
  Briefcase,
  History,
  CheckCircle2,
  Pencil,
  RefreshCw,
  PhoneCall,
  PhoneOutgoing,
  CalendarPlus,
  ListPlus,
  UserCheck,
} from 'lucide-react';
import { ReassignModal } from '../components/common/ReassignModal';
import { reassignMeeting, fetchAssignableUsers } from '../data/assignment';
import { humanizeWriteError } from '../lib/writeError';
import type { UserOption } from '../data/wishlist';
import { CopyButton } from '../components/ui/CopyButton';
import { pushRecent } from '../lib/useRecentlyViewed';
import { COLLAB_ASSOC } from '../lib/collabAssoc';
import { CollaboratorsCard } from '../components/collab/CollaboratorsCard';
import { AssociationsPanel } from '../components/collab/AssociationsPanel';
import type { SearchSelectOption } from '../components/ui/SearchSelect';
import type { RecordType } from '../lib/collabAssoc';
import { fetchAllContacts, fetchCompanyOptions } from '../data/contacts';

/* ------------------------------------------------------------------ */
/* Small primitives                                                    */
/* ------------------------------------------------------------------ */

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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

function Avatar({ name }: { name: string }) {
  const tint = name ? avatarTint(name) : { bg: '#E8F2FD', text: '#1A7EE8' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        background: tint.bg,
        color: tint.text,
        fontWeight: 600,
        width: 30,
        height: 30,
        fontSize: 11,
        flexShrink: 0,
        letterSpacing: '0.02em',
      }}
    >
      {initials(name)}
    </span>
  );
}

function Card({
  title,
  icon,
  count,
  action,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid #F3F4F6',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Blue accent bar */}
          <span
            style={{
              display: 'block',
              width: 3,
              height: 16,
              background: '#1A7EE8',
              borderRadius: 2,
              flexShrink: 0,
            }}
          />
          <span style={{ color: '#6B7280' }}>{icon}</span>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>{title}</h3>
          {typeof count === 'number' && count > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                background: '#E8F2FD',
                color: '#1A7EE8',
                fontWeight: 600,
                fontSize: 11,
                minWidth: 18,
                height: 18,
                padding: '0 5px',
              }}
            >
              {count}
            </span>
          )}
        </div>
        {action && <span>{action}</span>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="text-stone-400" style={{ fontSize: 13 }}>{text}</p>;
}

function Meta({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-stone-400 font-medium uppercase tracking-wide" style={{ fontSize: 10 }}>
        {icon}
        {label}
      </span>
      <span className="text-stone-800" style={{ fontSize: 13 }}>{children}</span>
    </div>
  );
}

function modeIcon(mode: string) {
  if (/online/i.test(mode)) return <Video size={12} />;
  if (/tele/i.test(mode)) return <Phone size={12} />;
  if (/offline/i.test(mode)) return <MapPin size={12} />;
  return <CalendarDays size={12} />;
}

/* ------------------------------------------------------------------ */
/* One-click task actions (schedule a follow-up tied to this meeting)  */
/* ------------------------------------------------------------------ */

/**
 * QuickTaskActions — three one-click buttons (Call back / Schedule meeting /
 * Add task) that open the shared CreateTaskModal pre-filled with this meeting's
 * association and a sensible type + subject. Mirrors the affordance on the
 * Lead / Company / Contact detail pages for consistency (owner #3). Reuses
 * CreateTaskModal; no task logic is duplicated.
 */
function QuickTaskActions({
  association,
  meetingId,
  ownerUserId,
  actorId,
  recordName,
}: {
  association: TaskAssociation;
  meetingId: number;
  ownerUserId: number | null;
  actorId: string | null;
  recordName: string;
}) {
  const [modal, setModal] = useState<{ type: TaskType; subject: string } | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  const name = recordName || 'this meeting';
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
    borderRadius: 6,
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
          title={`Log a call that already happened for ${name}`}
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
        recordType="meeting"
        recordId={meetingId}
        projectId={null}
        ownerUserId={ownerUserId}
        actorId={actorId}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, canReassign } = useAuth();
  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showUpdate, setShowUpdate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [actionError, setActionError] = useState('');

  // Reassign / change-salesperson (ALT-288). A meeting's owner = its lead's
  // assigned salesperson; reassigning here reassigns the underlying lead.
  const [showReassign, setShowReassign] = useState(false);
  const [reassignSaving, setReassignSaving] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [reassignOwners, setReassignOwners] = useState<UserOption[]>([]);

  // COLLAB_ASSOC: user + target options for the collab/association cards.
  const [collabUserOptions, setCollabUserOptions] = useState<SearchSelectOption[]>([]);
  const [collabTargetOptions, setCollabTargetOptions] = useState<Record<RecordType, SearchSelectOption[]>>({
    lead: [], contact: [], company: [], meeting: [],
  });

  const actor = profile?.user_id != null ? String(profile.user_id) : '';
  const role = (profile?.role ?? '').toUpperCase();
  // Small-CR: only ADMIN / TEAM_LEAD may edit a concluded meeting's details.
  const canEdit = role === 'ADMIN' || role === 'TEAM_LEAD';

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const result = await fetchMeetingDetail(id);
    setMeeting(result.meeting);
    setError(result.error);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      const result = await fetchMeetingDetail(id);
      if (cancelled) return;
      setMeeting(result.meeting);
      setError(result.error);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  // Record this meeting in "recently viewed" once it loads.
  useEffect(() => {
    if (!meeting) return;
    const label = (meeting.name || meeting.company || '').trim();
    if (!label) return;
    pushRecent(
      { type: 'meeting', id: String(meeting.id), label, route: `/meetings/${meeting.id}` },
      profile?.user_id,
    );
  }, [meeting, profile?.user_id]);

  // COLLAB_ASSOC: load user + target options once the flag is enabled.
  useEffect(() => {
    if (!COLLAB_ASSOC) return;
    let cancelled = false;
    (async () => {
      const [users, contacts, companies] = await Promise.all([
        fetchAssignableUsers(null),
        fetchAllContacts(),
        fetchCompanyOptions(),
      ]);
      if (cancelled) return;
      setCollabUserOptions(users.map((u) => ({ id: u.id, label: u.label })));
      setCollabTargetOptions({
        lead: [],
        contact: contacts.contacts.map((c) => ({ id: c.contact_id, label: c.full_name })),
        company: companies.map((c) => ({ id: c.company_id, label: c.company_name })),
        meeting: [],
      });
    })();
    return () => { cancelled = true; };
  }, []);

  const handleConfirm = async () => {
    if (!meeting) return;
    setConfirming(true);
    setActionError('');
    // MeetingDetail does not currently expose updated_date; passing undefined means
    // the concurrency guard uses no precondition (safe default while CONCURRENCY_GUARD
    // is false). A follow-up can add updated_date to MeetingDetail and thread it here.
    const res = await confirmMeeting(Number(meeting.id), meeting.reportId, actor, undefined);
    setConfirming(false);
    if (isConflict(res)) {
      setActionError(CONFLICT_MESSAGE);
      await load();
      return;
    }
    if (res?.error) {
      setActionError(humanizeWriteError(res.error) ?? 'Something went wrong. Please try again.');
      return;
    }
    await load();
  };

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
    if (res?.error) {
      setReassignError(humanizeWriteError(res.error));
      return;
    }
    setShowReassign(false);
    await load();
  };

  const dash = <span className="text-stone-300">—</span>;

  // The 7 salesperson feedback questions only carry meaning once a meeting concludes.
  const feedbackVisible =
    !!meeting &&
    (/meeting successful|meeting follow-?up|completed/i.test(meeting.leadStage) ||
      /completed/i.test(meeting.status) ||
      meeting.feedback.length > 0);

  return (
    <AppShell title="Meeting">
      <div className="space-y-3" style={{ maxWidth: 940 }}>
        {/* Back link */}
        <button
          onClick={() => navigate('/meetings')}
          className="flex items-center gap-1.5 text-stone-500 hover:text-blue-600 transition-colors"
          style={{ fontSize: 13 }}
        >
          <ArrowLeft size={15} />
          Back to Meetings
        </button>

        {loading ? (
          <div className="bg-white border border-stone-200 rounded-lg px-4 py-16">
            <div className="flex items-center justify-center gap-2 text-stone-400" style={{ fontSize: 13 }}>
              <Loader2 size={16} className="animate-spin" />
              Loading meeting...
            </div>
          </div>
        ) : error ? (
          <div className="bg-white border border-stone-200 rounded-lg px-4 py-12 text-center">
            <p className="text-red-500" style={{ fontSize: 13 }}>{error}</p>
          </div>
        ) : !meeting ? (
          <div className="bg-white border border-stone-200 rounded-lg px-4 py-14 text-center">
            <div className="flex flex-col items-center justify-center gap-2 text-stone-400">
              <div className="rounded-full bg-stone-100 flex items-center justify-center" style={{ width: 44, height: 44 }}>
                <CalendarDays size={20} strokeWidth={1.5} className="text-stone-400" />
              </div>
              <p style={{ fontSize: 14 }} className="font-medium text-stone-600">Meeting not found</p>
              <p style={{ fontSize: 13 }}>This meeting may have been removed or never existed.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header card */}
            <div className="bg-white border border-stone-200 rounded-lg p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="font-semibold text-stone-900" style={{ fontSize: 18 }}>
                      {meeting.company || meeting.leadName || meeting.name || 'Meeting'}
                    </h1>
                    <MeetingStatusBadge status={meeting.status} size="md" />
                    {meeting.confirmed && (
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
                          padding: '2px 8px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <CheckCircle2 size={11} /> Confirmed by prospect
                      </span>
                    )}
                  </div>
                  {meeting.name && (
                    <p className="text-stone-500 mt-1" style={{ fontSize: 13 }}>{meeting.name}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {canEdit && (
                    <button
                      onClick={() => setShowEdit(true)}
                      className="inline-flex items-center gap-1.5 border border-stone-300 hover:border-stone-400 bg-white hover:bg-stone-50 text-stone-700 font-medium transition-colors"
                      style={{ fontSize: 12, padding: '5px 12px', height: 30, borderRadius: 6 }}
                    >
                      <Pencil size={13} />
                      Edit
                    </button>
                  )}
                  {canReassign && meeting.leadId && (
                    <button
                      onClick={openReassign}
                      className="inline-flex items-center gap-1.5 border border-stone-300 hover:border-stone-400 bg-white hover:bg-stone-50 text-stone-700 font-medium transition-colors"
                      style={{ fontSize: 12, padding: '5px 12px', height: 30, borderRadius: 6 }}
                      title="Reassign this meeting's lead to another salesperson"
                    >
                      <UserCheck size={13} />
                      Change salesperson
                    </button>
                  )}
                  <button
                    onClick={() => setShowUpdate(true)}
                    className="inline-flex items-center gap-1.5 border border-stone-300 hover:border-stone-400 bg-white hover:bg-stone-50 text-stone-700 font-medium transition-colors"
                    style={{ fontSize: 12, padding: '5px 12px', height: 30, borderRadius: 6 }}
                  >
                    <RefreshCw size={13} />
                    Reschedule / Cancel
                  </button>
                </div>
              </div>

              {/* One-click task actions — create a follow-up task tied to this
                  meeting (and its lead, if any). Mirrors Lead/Company/Contact. */}
              {actor && (
                <div className="mt-4 pt-4 border-t border-stone-100">
                  <QuickTaskActions
                    association={{
                      meetingId: Number(meeting.id),
                      leadId: meeting.leadId ? Number(meeting.leadId) : null,
                      assocLabel:
                        meeting.company || meeting.leadName || meeting.name || 'Meeting',
                      assocPhone: meeting.leadMobile || null,
                    }}
                    meetingId={Number(meeting.id)}
                    ownerUserId={profile?.user_id ?? null}
                    actorId={actor || null}
                    recordName={meeting.company || meeting.leadName || meeting.name || ''}
                  />
                </div>
              )}

              {/* Meta grid */}
              <div
                className="grid gap-5 mt-5 pt-5 border-t border-stone-100"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}
              >
                <Meta icon={<CalendarDays size={12} />} label="Date">
                  {meeting.meetingDate ? formatDate(meeting.meetingDate) : dash}
                </Meta>
                <Meta icon={<Clock size={12} />} label="Time">
                  {meeting.meetingTime ? formatTime(meeting.meetingTime) : dash}
                </Meta>
                <Meta icon={<Clock size={12} />} label="Duration">
                  {meeting.duration || dash}
                </Meta>
                <Meta icon={modeIcon(meeting.mode)} label="Mode">
                  {meeting.mode || dash}
                </Meta>
                <Meta icon={<Briefcase size={12} />} label="Salesperson">
                  {meeting.salesperson || dash}
                </Meta>
                <Meta icon={<User size={12} />} label="Agent">
                  {meeting.agent || dash}
                </Meta>
                <Meta icon={<CalendarDays size={12} />} label="Follow-up">
                  {meeting.followUpDate ? formatDate(meeting.followUpDate) : dash}
                </Meta>
                <Meta icon={<History size={12} />} label="Lead Stage">
                  {meeting.leadStage || dash}
                </Meta>
              </div>

              {/* Confirm by prospect — only for a still-pending meeting (Scheduled / Rescheduled).
                  A concluded (Completed / Missed) or Cancelled meeting must NOT be confirmable,
                  else confirming would overwrite its terminal status and regress the lead stage. */}
              {!meeting.confirmed && canConfirmMeeting(meeting.status) && (
                <div className="mt-5 pt-5 border-t border-stone-100 flex items-center gap-3 flex-wrap">
                  <button
                    onClick={handleConfirm}
                    disabled={confirming}
                    className="inline-flex items-center gap-1.5 disabled:opacity-50 text-white font-medium transition-colors"
                    style={{ fontSize: 12, padding: '6px 12px', height: 32, borderRadius: 6, background: '#1A7EE8', border: 'none', cursor: confirming ? 'not-allowed' : 'pointer' }}
                    onMouseEnter={(e) => { if (!confirming) (e.currentTarget as HTMLButtonElement).style.background = '#1463B8'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#1A7EE8'; }}
                  >
                    {confirming ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    Mark confirmed by prospect
                  </button>
                  <span className="text-stone-400" style={{ fontSize: 11 }}>
                    This is one-way and moves the lead to "Meeting Confirmed".
                  </span>
                  {actionError && <span className="text-red-500" style={{ fontSize: 12 }}>{actionError}</span>}
                </div>
              )}

              {/* Links */}
              {(meeting.meetingUrl || meeting.callRecording || meeting.sharePointUrl) && (
                <div className="flex items-center gap-4 flex-wrap mt-5 pt-5 border-t border-stone-100">
                  {meeting.meetingUrl && (
                    <a
                      href={meeting.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 transition-colors"
                      style={{ fontSize: 13 }}
                    >
                      <Video size={13} />
                      Meeting link
                      <ExternalLink size={11} />
                    </a>
                  )}
                  {meeting.callRecording && (
                    <a
                      href={meeting.callRecording}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 transition-colors"
                      style={{ fontSize: 13 }}
                    >
                      <Phone size={13} />
                      Call recording
                      <ExternalLink size={11} />
                    </a>
                  )}
                  {meeting.sharePointUrl && (
                    <a
                      href={meeting.sharePointUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 transition-colors"
                      style={{ fontSize: 13 }}
                    >
                      <FileText size={13} />
                      Document
                      <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              )}

              {/* Agenda */}
              {meeting.description && (
                <div className="mt-5 pt-5 border-t border-stone-100">
                  <p className="font-medium text-stone-500 mb-1" style={{ fontSize: 11 }}>Agenda</p>
                  <p className="text-stone-800 whitespace-pre-line" style={{ fontSize: 13, lineHeight: 1.55 }}>
                    {meeting.description}
                  </p>
                </div>
              )}
            </div>

            {/* Lead / company / client card */}
            <Card title="Lead, Company & Client" icon={<Building2 size={14} />}>
              {meeting.leadName || meeting.company ? (
                <div className="space-y-4">
                  <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                    <Meta icon={<Building2 size={12} />} label="Company">
                      {meeting.company || dash}
                    </Meta>
                    <Meta icon={<Briefcase size={12} />} label="Client">
                      {meeting.client || dash}
                    </Meta>
                    <Meta icon={<MapPin size={12} />} label="Industry">
                      {meeting.industry || dash}
                    </Meta>
                    <Meta icon={<MapPin size={12} />} label="City">
                      {meeting.city || dash}
                    </Meta>
                    <Meta icon={<FileText size={12} />} label="Lead #">
                      {meeting.leadNumber || dash}
                    </Meta>
                    <Meta icon={<User size={12} />} label="Contact">
                      {meeting.leadName || dash}
                    </Meta>
                    <Meta icon={<User size={12} />} label="Designation">
                      {meeting.leadDesignation || dash}
                    </Meta>
                    <Meta icon={<Phone size={12} />} label="Mobile">
                      {meeting.leadMobile ? (
                        <span className="inline-flex items-center gap-1.5">
                          {meeting.leadMobile}
                          <CopyButton value={meeting.leadMobile} label="Mobile" />
                        </span>
                      ) : dash}
                    </Meta>
                    <Meta icon={<MessageSquare size={12} />} label="Email">
                      {meeting.leadEmail ? (
                        <span className="inline-flex items-center gap-1.5">
                          {meeting.leadEmail}
                          <CopyButton value={meeting.leadEmail} label="Email" />
                        </span>
                      ) : dash}
                    </Meta>
                  </div>
                  {meeting.leadId && (
                    <Link
                      to={`/leads/${meeting.leadId}`}
                      className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 transition-colors"
                      style={{ fontSize: 13 }}
                    >
                      View lead
                      <ArrowLeft size={12} style={{ transform: 'rotate(180deg)' }} />
                    </Link>
                  )}
                </div>
              ) : (
                <EmptyRow text="No linked lead for this meeting." />
              )}
            </Card>

            {/* Participants */}
            <Card title="Participants" icon={<Users size={14} />} count={meeting.participants.length}>
              {meeting.participants.length === 0 ? (
                <EmptyRow text="No participants recorded for this meeting." />
              ) : (
                <ul className="space-y-2.5">
                  {meeting.participants.map((p) => (
                    <li key={p.id} className="flex items-center gap-2.5">
                      <Avatar name={p.participant} />
                      <span className="text-stone-800 break-all" style={{ fontSize: 13 }}>{p.participant}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Salesperson feedback (read-only, 7 questions) */}
            <Card title="Salesperson Feedback" icon={<MessageSquare size={14} />} count={meeting.feedback.length}>
              {!feedbackVisible ? (
                <EmptyRow text="Salesperson feedback becomes visible once the meeting concludes (stage 'Meeting Successful' / 'Meeting Follow-up')." />
              ) : meeting.feedback.length === 0 ? (
                <EmptyRow text="No salesperson feedback submitted yet." />
              ) : (
                <ul className="divide-y divide-stone-100">
                  {meeting.feedback.map((item, i) => (
                    <li key={i} className="py-3 first:pt-0 last:pb-0">
                      <p className="text-stone-500" style={{ fontSize: 12, lineHeight: 1.5 }}>{item.question || '—'}</p>
                      <p className="text-stone-900 font-medium mt-0.5" style={{ fontSize: 13 }}>
                        {item.answer || <span className="text-stone-300 font-normal">—</span>}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Agent feedback + free-text notes */}
            {(meeting.agentFeedback || meeting.reason) && (
              <Card title="Agent Feedback & Notes" icon={<FileText size={14} />}>
                <div className="space-y-4">
                  {meeting.agentFeedback && (
                    <div>
                      <p className="font-medium text-stone-500 mb-1" style={{ fontSize: 11 }}>Agent Feedback</p>
                      <p className="text-stone-800 whitespace-pre-line" style={{ fontSize: 13, lineHeight: 1.55 }}>
                        {meeting.agentFeedback}
                      </p>
                    </div>
                  )}
                  {meeting.reason && (
                    <div>
                      <p className="font-medium text-stone-500 mb-1" style={{ fontSize: 11 }}>Latest Reschedule / Cancel Reason</p>
                      <p className="text-stone-800 whitespace-pre-line" style={{ fontSize: 13, lineHeight: 1.55 }}>
                        {meeting.reason}
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Discussion notes (pre-sales) */}
            <Card title="Pre-Sales Discussion Notes" icon={<MessageSquare size={14} />} count={meeting.preSales.length}>
              {meeting.preSales.length === 0 ? (
                <EmptyRow text="No pre-sales discussion notes recorded for this meeting." />
              ) : (
                <div className="space-y-4">
                  {meeting.preSales.map((item, i) => (
                    <div key={i}>
                      {item.question && (
                        <p className="font-medium text-stone-500 mb-1" style={{ fontSize: 11 }}>{item.question}</p>
                      )}
                      <p className="text-stone-800 whitespace-pre-line" style={{ fontSize: 13, lineHeight: 1.55 }}>
                        {item.answer}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Reschedule / cancel history */}
            <Card title="Reschedule & Cancellation History" icon={<History size={14} />} count={meeting.history.length}>
              {meeting.history.length === 0 ? (
                <EmptyRow text="No reschedules or cancellations recorded." />
              ) : (
                <ul className="divide-y divide-stone-100">
                  {meeting.history.map((h) => (
                    <li key={h.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <MeetingStatusBadge status={h.status} />
                        <span className="text-stone-400" style={{ fontSize: 11 }}>
                          {h.createdDate ? formatDate(h.createdDate) : ''}
                          {h.date ? ` · new date ${formatDate(h.date)}${h.time ? ' ' + formatTime(h.time) : ''}` : ''}
                        </span>
                      </div>
                      {h.reason && (
                        <p className="text-stone-700 mt-1 whitespace-pre-line" style={{ fontSize: 13, lineHeight: 1.5 }}>
                          {h.reason}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>

      {/* Collaborators & Associations (ALT-441/442) — dark behind COLLAB_ASSOC */}
      {COLLAB_ASSOC && meeting && (
        <div className="space-y-3" style={{ maxWidth: 940 }}>
          <CollaboratorsCard
            recordType="meeting"
            recordId={Number(meeting.id)}
            userOptions={collabUserOptions}
            actorId={actor}
          />
          <AssociationsPanel
            recordType="meeting"
            recordId={Number(meeting.id)}
            targetOptions={collabTargetOptions}
            actorId={actor}
          />
        </div>
      )}

      {/* Modals */}
      {meeting && showUpdate && (
        <UpdateMeetingModal
          meeting={meeting}
          actor={actor}
          onClose={() => setShowUpdate(false)}
          onSaved={async () => {
            setShowUpdate(false);
            await load();
          }}
        />
      )}
      {meeting && showEdit && canEdit && (
        <EditMeetingModal
          meeting={meeting}
          actor={actor}
          onClose={() => setShowEdit(false)}
          onSaved={async () => {
            setShowEdit(false);
            await load();
          }}
        />
      )}
      {meeting && showReassign && (
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
    </AppShell>
  );
}

export default MeetingDetailPage;
