/**
 * EditMeetingModal — small-CR "edit a concluded meeting".
 *
 * Lets ADMIN / TEAM_LEAD edit a concluded meeting's date / time / mode / agenda / URL.
 * The page gates rendering this modal on profile.role; the writer stamps updated_by/date.
 */
import React, { useState } from 'react';
import { Save, X } from 'lucide-react';
import {
  MEETING_MODES,
  editMeetingDetails,
  type MeetingDetail,
} from '../../data/meetings';
import {
  inputCls,
  FieldLabel,
  PrimaryButton,
  SecondaryButton,
  InlineNote,
} from '../lead/primitives';
import { isConflict, CONFLICT_MESSAGE } from '../../lib/concurrency';

function urlLabel(mode: string): string {
  switch (mode.toLowerCase()) {
    case 'telephonic':
      return 'Phone number';
    case 'offline':
      return 'Meeting address';
    default:
      return 'Meeting link';
  }
}

export function EditMeetingModal({
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
  const [date, setDate] = useState(meeting.meetingDate ?? '');
  const [time, setTime] = useState(/^\d{2}:\d{2}$/.test(meeting.meetingTime ?? '') ? meeting.meetingTime : '');
  const [mode, setMode] = useState(meeting.mode || MEETING_MODES[1]);
  const [agenda, setAgenda] = useState(meeting.description ?? '');
  const [url, setUrl] = useState(meeting.meetingUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSave = async () => {
    if (!date) {
      setErr('Please choose a meeting date.');
      return;
    }
    setSaving(true);
    setErr('');
    const res = await editMeetingDetails({
      meetingId: Number(meeting.id),
      meetingDate: date,
      meetingTime: time,
      mode,
      agenda,
      meetingUrl: url,
      actor,
      // MeetingDetail does not currently expose updated_date; the concurrency guard
      // therefore has no precondition here (safe default while CONCURRENCY_GUARD=false).
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
            Edit Meeting Details
          </h3>
          <button onClick={onClose} aria-label="Close" className="text-stone-400 hover:text-stone-700 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel required>Date</FieldLabel>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputCls}
                style={{ fontSize: 13 }}
              />
            </div>
            <div>
              <FieldLabel>Time</FieldLabel>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={inputCls}
                style={{ fontSize: 13 }}
              />
            </div>
          </div>

          <div>
            <FieldLabel>Mode</FieldLabel>
            <select value={mode} onChange={(e) => setMode(e.target.value)} className={inputCls} style={{ fontSize: 13 }}>
              {MEETING_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel>Agenda</FieldLabel>
            <textarea
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              rows={3}
              placeholder="Meeting agenda..."
              className={`${inputCls} resize-y`}
              style={{ fontSize: 13 }}
            />
          </div>

          <div>
            <FieldLabel>{urlLabel(mode)}</FieldLabel>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={urlLabel(mode)}
              className={inputCls}
              style={{ fontSize: 13 }}
            />
          </div>

          {err && <InlineNote kind="error">{err}</InlineNote>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-stone-100">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={handleSave} loading={saving}>
            <Save size={14} /> Save Changes
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

export default EditMeetingModal;
