/**
 * UpdateMeetingModal — reschedule or cancel a meeting from the Meetings module.
 *
 * Mirrors the Lead workspace's UpdateMeetingModal (src/components/lead/MeetingTab.tsx)
 * for behaviour and copy, but calls meetings.updateMeetingStatus() which writes the
 * displayed `meeting_status`, journals a meeting_reschedule history row, and updates
 * the lead_report stage with the same id mapping.
 */
import React, { useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import {
  POSTPONED_BY,
  CANCELLED_BY,
  updateMeetingStatus,
  type MeetingDetail,
} from '../../data/meetings';
import { isConflict, CONFLICT_MESSAGE } from '../../lib/concurrency';
import {
  inputCls,
  FieldLabel,
  PrimaryButton,
  SecondaryButton,
  InlineNote,
} from '../lead/primitives';
import { supabase } from '../../lib/supabase';
import { notify, notifyInApp, resolveUserEmailAndName } from '../../lib/notify';
import { useConfirm } from '../ui/ConfirmDialog';

export function UpdateMeetingModal({
  meeting,
  actor,
  onClose,
  onSaved,
}: {
  meeting: MeetingDetail;
  actor: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [action, setAction] = useState<'reschedule' | 'cancel'>('reschedule');
  const [by, setBy] = useState(POSTPONED_BY[0].value);
  const [reason, setReason] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newDuration, setNewDuration] = useState(meeting.duration || '00:30');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const confirm = useConfirm();

  const today = new Date().toISOString().slice(0, 10);
  const byOptions = action === 'reschedule' ? POSTPONED_BY : CANCELLED_BY;

  const switchAction = (a: 'reschedule' | 'cancel') => {
    setAction(a);
    setBy((a === 'reschedule' ? POSTPONED_BY : CANCELLED_BY)[0].value);
    setErr('');
  };

  const handleSave = async () => {
    if (!reason.trim()) {
      setErr('Please provide a reason.');
      return;
    }
    if (action === 'reschedule' && !newDate) {
      setErr('Please choose a new date.');
      return;
    }
    if (action === 'cancel') {
      const ok = await confirm({
        title: 'Cancel this meeting?',
        message: 'The meeting will be marked cancelled and the lead stage updated. The salesperson is notified. This cannot be undone.',
        tone: 'danger',
        confirmLabel: 'Cancel meeting',
        cancelLabel: 'Keep meeting',
      });
      if (!ok) return;
    }
    setSaving(true);
    setErr('');
    const res = await updateMeetingStatus({
      meetingId: Number(meeting.id),
      reportId: meeting.reportId,
      action,
      by,
      reason,
      newDate: action === 'reschedule' ? newDate : undefined,
      newTime: action === 'reschedule' ? newTime : undefined,
      newDuration: action === 'reschedule' ? newDuration : undefined,
      actor,
      // MeetingDetail does not currently expose updated_date in its type; when the
      // concurrency guard is ON (ALT-430) the page should pass this down. For now
      // the guard uses undefined (= no precondition) since we don't have the value
      // here. A future pass can add updatedDate to MeetingDetail and wire it through.
      originalUpdatedDate: undefined,
    });
    setSaving(false);
    if (isConflict(res)) {
      setErr(CONFLICT_MESSAGE);
      return;
    }
    if (res?.error) {
      setErr(res.error);
      return;
    }

    // Fire-and-forget: email + in-app notification to the meeting's salesperson.
    // TODO recipients: owner will tune per-action (reschedule/cancel/etc.).
    // Recipient = meeting.salespersonUserId (the assigned SP/SH from lead_report.user_id).
    (async () => {
      try {
        const recipientUserId = meeting.salespersonUserId;
        if (!recipientUserId) return;
        const { email: recipientEmail } = await resolveUserEmailAndName(supabase, recipientUserId);
        const route = `/meetings/${meeting.id}`;
        const leadName = meeting.leadName || meeting.company || 'Lead';

        if (action === 'reschedule') {
          const emailData = {
            leadName,
            oldDate: meeting.meetingDate ?? '',
            oldTime: meeting.meetingTime ?? '',
            newDate,
            newTime,
            mode: meeting.mode,
            reason: reason.trim(),
            rescheduledBy: by,
          };
          if (recipientEmail) {
            await notify('meeting_rescheduled', recipientEmail, emailData);
          }
          await notifyInApp(supabase, recipientUserId, {
            status: 'Meeting Rescheduled',
            notif_descr: `Meeting with ${leadName} has been rescheduled to ${newDate}${newTime ? ' ' + newTime : ''}.`,
            route,
            meeting_id: Number(meeting.id),
            lead_id: meeting.leadId ? Number(meeting.leadId) : undefined,
            lead_number: meeting.leadNumber || null,
            actor,
          });
        } else {
          const emailData = {
            leadName,
            meetingDate: meeting.meetingDate ?? '',
            meetingTime: meeting.meetingTime ?? '',
            mode: meeting.mode,
            reason: reason.trim(),
            cancelledBy: by,
          };
          if (recipientEmail) {
            await notify('meeting_cancelled', recipientEmail, emailData);
          }
          await notifyInApp(supabase, recipientUserId, {
            status: 'Meeting Cancelled',
            notif_descr: `Meeting with ${leadName} has been cancelled. Reason: ${reason.trim()}`,
            route,
            meeting_id: Number(meeting.id),
            lead_id: meeting.leadId ? Number(meeting.leadId) : undefined,
            lead_number: meeting.leadNumber || null,
            actor,
          });
        }
      } catch {
        /* non-fatal — never block or surface notification errors to the user */
      }
    })();

    onSaved();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.35)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg border border-stone-200 w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <h3 className="font-semibold text-stone-800" style={{ fontSize: 14 }}>
            Update Meeting
          </h3>
          <button type="button" aria-label="Close" onClick={onClose} className="text-stone-400 hover:text-stone-700 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* action toggle */}
          <div className="flex gap-2">
            {(['reschedule', 'cancel'] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => switchAction(a)}
                className="flex-1 rounded-md py-2 font-medium transition-colors capitalize"
                style={{
                  fontSize: 13,
                  border: '1px solid',
                  borderColor: action === a ? '#1A7EE8' : '#d4d4d8',
                  background: action === a ? '#E8F2FD' : '#fff',
                  color: action === a ? '#1463B8' : '#52525b',
                }}
              >
                {a}
              </button>
            ))}
          </div>

          <div>
            <FieldLabel required>{action === 'reschedule' ? 'Postponed by' : 'Cancelled by'}</FieldLabel>
            <select value={by} onChange={(e) => setBy(e.target.value)} className={inputCls} style={{ fontSize: 13 }}>
              {byOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {action === 'reschedule' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <FieldLabel required>New date</FieldLabel>
                <input
                  type="date"
                  value={newDate}
                  min={today}
                  onChange={(e) => setNewDate(e.target.value)}
                  className={inputCls}
                  style={{ fontSize: 13 }}
                />
              </div>
              <div>
                <FieldLabel>New time</FieldLabel>
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className={inputCls}
                  style={{ fontSize: 13 }}
                />
              </div>
              <div>
                <FieldLabel>Duration</FieldLabel>
                <input
                  type="time"
                  value={newDuration}
                  onChange={(e) => setNewDuration(e.target.value)}
                  className={inputCls}
                  style={{ fontSize: 13 }}
                />
              </div>
            </div>
          )}

          <div>
            <FieldLabel required>Reason</FieldLabel>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder={
                action === 'reschedule'
                  ? 'Why is the meeting being rescheduled?'
                  : 'Why is the meeting being cancelled?'
              }
              className={`${inputCls} resize-y`}
              style={{ fontSize: 13 }}
            />
          </div>

          {err && <InlineNote kind="error">{err}</InlineNote>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-stone-100">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={handleSave} loading={saving}>
            {action === 'reschedule' ? (
              <>
                <CheckCircle2 size={14} /> Reschedule
              </>
            ) : (
              <>
                <X size={14} /> Cancel Meeting
              </>
            )}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

export default UpdateMeetingModal;
