/**
 * MeetingTab — mostly read-only view of the report's meeting, plus:
 *  - add the live meeting URL/phone/address once stage = "Meeting Scheduled"
 *  - "Meeting confirmed by prospect" checkbox (one-way)
 *  - Upcoming + Past meetings for the current user
 *  - per-meeting Update modal (Reschedule / Cancel)
 *  - past meetings: an editable Salesperson Feedback form (Yes/No toggles + a
 *    free-text question + follow-up date) with three submit outcomes — Successful
 *    (save + mark Completed), Reschedule, Cancel/Drop — then locks to read-only.
 *    Plus Agent Feedback (editable once).
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Calendar, Clock, Link2, CheckCircle2, X, Loader2 } from 'lucide-react';
import { isConflict, CONFLICT_MESSAGE } from '../../lib/concurrency';
import {
  fetchLeadMeeting,
  fetchLeadMeetings,
  fetchFeedbackQuestions,
  fetchFeedbackAnswers,
  updateMeetingUrl,
  confirmMeeting,
  saveAgentFeedback,
  submitMeetingFeedback,
  isFreeTextQuestion,
  updateMeeting,
  fmtDate,
  POSTPONED_BY,
  CANCELLED_BY,
  type MeetingRow,
  type MeetingListItem,
  type FeedbackQuestion,
  type FeedbackAnswerRow,
} from '../../data/leadWorkspace';
import {
  card,
  inputCls,
  FieldLabel,
  PrimaryButton,
  SecondaryButton,
  LoadingBlock,
  EmptyBlock,
  InlineNote,
} from './primitives';
import { useConfirm } from '../ui/ConfirmDialog';

function modePlaceholder(mode: string | null): string {
  switch ((mode ?? '').toLowerCase()) {
    case 'telephonic':
      return 'Enter the phone number to dial...';
    case 'offline':
      return 'Enter the meeting address...';
    default:
      return 'Paste the meeting link (Zoom / Teams / Meet)...';
  }
}

function MeetingFieldRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span style={{ fontSize: 11 }} className="text-stone-400 font-medium">
        {label}
      </span>
      <span style={{ fontSize: 13 }} className="text-stone-800">
        {value && value.trim() ? value : <span className="text-stone-300">—</span>}
      </span>
    </div>
  );
}

export function MeetingTab({
  reportId,
  leadId,
  stageName,
  actor,
  onChanged,
}: {
  reportId: number | null;
  leadId: number;
  stageName: string;
  actor: string;
  onChanged: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [meeting, setMeeting] = useState<MeetingRow | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);

  const [urlInput, setUrlInput] = useState('');
  const [savingUrl, setSavingUrl] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  // lists — scoped to THIS lead only
  const [upcoming, setUpcoming] = useState<MeetingListItem[]>([]);
  const [past, setPast] = useState<MeetingListItem[]>([]);

  // feedback
  const [feedbackQs, setFeedbackQs] = useState<FeedbackQuestion[]>([]);

  // modal
  const [modalMeeting, setModalMeeting] = useState<MeetingListItem | MeetingRow | null>(null);

  const urlEditable = (stageName ?? '').toLowerCase() === 'meeting scheduled';

  // Only allow "confirm by prospect" while the meeting is still live (not concluded
  // / cancelled). Prevents overwriting a terminal status and regressing the stage.
  const meetingStatus = ((meeting?.status || meeting?.meeting_status) ?? '').trim().toLowerCase();
  const confirmable =
    !!meeting && (meetingStatus === '' || ['scheduled', 'rescheduled', 'confirmed'].includes(meetingStatus));

  const load = useCallback(async () => {
    setLoading(true);
    // fetchLeadMeetings is scoped to this lead; fetchLeadMeeting gets the single
    // meeting detail (with participants) for the current report.
    const [own, leadMeetings, fq] = await Promise.all([
      fetchLeadMeeting(reportId),
      fetchLeadMeetings(leadId),
      fetchFeedbackQuestions(),
    ]);
    setMeeting(own?.meeting ?? null);
    setParticipants(own?.participants ?? []);
    setUrlInput(own?.meeting?.meeting_url ?? '');
    setUpcoming(leadMeetings.upcoming);
    setPast(leadMeetings.past);
    setFeedbackQs(fq);
    setLoading(false);
  }, [reportId, leadId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaveUrl = async () => {
    if (!meeting) return;
    if (!actor) {
      setErr('Your account isn’t linked to a user profile yet, so changes can’t be saved.');
      return;
    }
    if (!urlInput.trim()) {
      setErr('A meeting link / phone / address is required.');
      return;
    }
    setSavingUrl(true);
    setErr('');
    setNote('');
    const res = await updateMeetingUrl(meeting.meeting_id, urlInput, actor);
    setSavingUrl(false);
    if (res?.error) {
      setErr(res.error);
      return;
    }
    setNote('Meeting link saved.');
    await load();
  };

  const handleConfirm = async () => {
    if (!meeting) return;
    if (!actor) {
      setErr('Your account isn’t linked to a user profile yet, so changes can’t be saved.');
      return;
    }
    setConfirming(true);
    setErr('');
    // leadWorkspace.confirmMeeting (3-arg version) — concurrency guard not wired
    // here (no updated_date available in MeetingRow). When CONCURRENCY_GUARD is ON
    // a follow-up pass should expose updated_date from the lead's meeting record.
    const res = await confirmMeeting(meeting.meeting_id, reportId, actor);
    setConfirming(false);
    if (isConflict(res)) {
      setErr(CONFLICT_MESSAGE);
      await load();
      return;
    }
    if (res?.error) {
      setErr(res.error);
      return;
    }
    setNote('Meeting confirmed by prospect.');
    onChanged();
    await load();
  };

  if (loading) {
    return (
      <div className={`${card} p-6`}>
        <LoadingBlock label="Loading meeting..." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* The lead's meeting (from the report) */}
      <div className={`${card} p-5`}>
        <h3 className="font-semibold text-stone-700 mb-4" style={{ fontSize: 13 }}>
          Meeting Details
        </h3>
        {!meeting ? (
          <EmptyBlock message="No meeting has been set up for this lead yet. Agree to a meeting in the Lead Report tab first." />
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
              <MeetingFieldRow label="Name" value={meeting.meeting_name} />
              <MeetingFieldRow label="Mode" value={meeting.meeting_mode} />
              <MeetingFieldRow label="Date" value={fmtDate(meeting.meeting_date)} />
              <MeetingFieldRow label="Time" value={meeting.meeting_time} />
              <MeetingFieldRow label="Duration" value={meeting.duration} />
              <MeetingFieldRow label="Status" value={meeting.status || meeting.meeting_status} />
            </div>
            <div className="mb-4">
              <MeetingFieldRow label="Agenda" value={meeting.description} />
            </div>
            <div className="mb-4">
              <span style={{ fontSize: 11 }} className="text-stone-400 font-medium">
                Participants
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {participants.length === 0 ? (
                  <span className="text-stone-300" style={{ fontSize: 13 }}>
                    —
                  </span>
                ) : (
                  participants.map((p) => (
                    <span
                      key={p}
                      className="rounded px-2 py-0.5"
                      style={{ fontSize: 12, background: '#E8F2FD', color: '#1463B8' }}
                    >
                      {p}
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Live meeting URL */}
            <div className="pt-4 border-t border-stone-100">
              <FieldLabel required>Meeting Link / Phone / Address</FieldLabel>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  disabled={!urlEditable}
                  placeholder={modePlaceholder(meeting.meeting_mode)}
                  className={inputCls}
                  style={{ fontSize: 13 }}
                />
                <PrimaryButton onClick={handleSaveUrl} loading={savingUrl} disabled={!urlEditable}>
                  <Link2 size={14} />
                  Save
                </PrimaryButton>
              </div>
              {!urlEditable && (
                <p className="text-stone-400 mt-1" style={{ fontSize: 11 }}>
                  The meeting link can be added once the stage is "Meeting Scheduled".
                </p>
              )}
            </div>

            {/* Confirm by prospect */}
            <div className="pt-4 mt-4 border-t border-stone-100 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex flex-col gap-0.5">
                <label
                  className="flex items-center gap-2 text-stone-700"
                  style={{ fontSize: 13, cursor: confirmable && !meeting.meeting_confirm ? 'pointer' : 'default' }}
                >
                  <input
                    type="checkbox"
                    checked={!!meeting.meeting_confirm}
                    disabled={!!meeting.meeting_confirm || confirming || !confirmable}
                    onChange={handleConfirm}
                    className="accent-blue-600"
                  />
                  Meeting confirmed by prospect
                  {confirming && <Loader2 size={13} className="animate-spin text-stone-400" />}
                </label>
                {!meeting.meeting_confirm && !confirmable && (
                  <span className="text-stone-400" style={{ fontSize: 11 }}>
                    This meeting has already concluded and can no longer be confirmed.
                  </span>
                )}
              </div>
              <SecondaryButton onClick={() => setModalMeeting(meeting)}>Update meeting</SecondaryButton>
            </div>

            {note && <InlineNote kind="success">{note}</InlineNote>}
            {err && <InlineNote kind="error">{err}</InlineNote>}
          </>
        )}
      </div>

      {/* Upcoming meetings */}
      <div className={`${card} p-5`}>
        <h3 className="font-semibold text-stone-700 mb-3" style={{ fontSize: 13 }}>
          Upcoming Meetings
        </h3>
        {upcoming.length === 0 ? (
          <EmptyBlock message="No upcoming meetings." />
        ) : (
          <div className="divide-y divide-stone-100">
            {upcoming.map((m) => (
              <MeetingListRow key={m.meeting_id} m={m} onUpdate={() => setModalMeeting(m)} />
            ))}
          </div>
        )}
      </div>

      {/* Past meeting reports */}
      <div className={`${card} p-5`}>
        <h3 className="font-semibold text-stone-700 mb-3" style={{ fontSize: 13 }}>
          Past Meeting Reports
        </h3>
        {past.length === 0 ? (
          <EmptyBlock message="No past meetings." />
        ) : (
          <div className="space-y-3">
            {past.map((m) => (
              <PastMeetingCard
                key={m.meeting_id}
                m={m}
                feedbackQs={feedbackQs}
                reportId={reportId}
                actor={actor}
                onChanged={async () => {
                  onChanged();
                  await load();
                }}
              />
            ))}
          </div>
        )}
      </div>

      {modalMeeting && (
        <UpdateMeetingModal
          meeting={modalMeeting}
          reportId={reportId}
          actor={actor}
          onClose={() => setModalMeeting(null)}
          onSaved={async () => {
            setModalMeeting(null);
            onChanged();
            await load();
          }}
        />
      )}
    </div>
  );
}

/* ── List row ─────────────────────────────────────────────────── */

function MeetingListRow({ m, onUpdate }: { m: MeetingListItem; onUpdate: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="font-medium text-stone-800 truncate" style={{ fontSize: 13 }}>
          {m.meeting_name || 'Untitled meeting'}
        </p>
        <div className="flex items-center gap-3 text-stone-400 mt-0.5" style={{ fontSize: 12 }}>
          {m.lead_name && <span className="truncate">{m.lead_name}</span>}
          {m.meeting_date && (
            <span className="flex items-center gap-1">
              <Calendar size={11} />
              {fmtDate(m.meeting_date)}
            </span>
          )}
          {m.meeting_time && (
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {m.meeting_time}
            </span>
          )}
          {m.meeting_mode && <span>{m.meeting_mode}</span>}
        </div>
      </div>
      <button
        type="button"
        onClick={onUpdate}
        className="text-blue-600 hover:text-blue-700 font-medium transition-colors shrink-0"
        style={{ fontSize: 12 }}
      >
        Update
      </button>
    </div>
  );
}

/* ── Past meeting card (feedback) ─────────────────────────────── */

function PastMeetingCard({
  m,
  feedbackQs,
  reportId,
  actor,
  onChanged,
}: {
  m: MeetingListItem;
  feedbackQs: FeedbackQuestion[];
  reportId: number | null;
  actor: string;
  onChanged: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const confirm = useConfirm();
  const [answers, setAnswers] = useState<FeedbackAnswerRow[]>([]);
  const [loadingFb, setLoadingFb] = useState(false);
  const [loadedFb, setLoadedFb] = useState(false);

  // Meeting status drives whether feedback is editable or already submitted.
  const status = (m.status || m.meeting_status || '').trim().toLowerCase();
  const isCompleted = status === 'completed';
  const isCancelled = status === 'cancelled';
  // Feedback already exists once the meeting is Completed OR rows are on file.
  const feedbackSubmitted = isCompleted || (loadedFb && answers.length > 0);

  // Editable form state ----------------------------------------------------
  // Yes/No toggle answers + free-text answers, keyed by feed_que_id.
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [followUp, setFollowUp] = useState('');
  const [outcome, setOutcome] = useState<'successful' | 'reschedule' | 'cancel'>('successful');
  // Reschedule / cancel sub-fields (reuse the same option sets as the modal).
  const [by, setBy] = useState(POSTPONED_BY[0].value);
  const [reason, setReason] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newDuration, setNewDuration] = useState(m.duration ?? '00:30');

  const [submitting, setSubmitting] = useState(false);
  const [fbErr, setFbErr] = useState('');

  // Agent feedback (editable once) -----------------------------------------
  const [agentFb, setAgentFb] = useState(m.agent_feedback ?? '');
  const [savingFb, setSavingFb] = useState(false);
  const [savedFb, setSavedFb] = useState(!!m.agent_feedback);
  const [agentErr, setAgentErr] = useState('');

  const today = new Date().toISOString().slice(0, 10);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !loadedFb) {
      setLoadingFb(true);
      const a = await fetchFeedbackAnswers(m.meeting_id);
      setAnswers(a);
      // Seed the editable draft: existing answers, else default Yes/No to "Yes"
      // (matches the vendor app) and free-text to blank.
      const seed: Record<number, string> = {};
      feedbackQs.forEach((q) => {
        const existing = a.find((x) => x.feed_que_id === q.feed_que_id)?.feed_ans;
        seed[q.feed_que_id] = existing ?? (isFreeTextQuestion(q) ? '' : 'Yes');
      });
      setDraft(seed);
      setLoadedFb(true);
      setLoadingFb(false);
    }
  };

  const ansFor = (qid: number) => answers.find((a) => a.feed_que_id === qid)?.feed_ans ?? '';

  const switchBy = (next: 'reschedule' | 'cancel') => {
    setOutcome(next);
    setBy((next === 'reschedule' ? POSTPONED_BY : CANCELLED_BY)[0].value);
  };

  const handleSubmit = async () => {
    if (!actor) {
      setFbErr('Your account isn’t linked to a user profile yet, so feedback can’t be saved.');
      return;
    }
    setFbErr('');

    if (outcome === 'successful') {
      // Every question must be answered (Yes/No always has a value; free-text required).
      const missing = feedbackQs.some((q) => !(draft[q.feed_que_id] ?? '').trim());
      if (missing) {
        setFbErr('Please answer all feedback questions before submitting.');
        return;
      }
      setSubmitting(true);
      const res = await submitMeetingFeedback({
        meetingId: m.meeting_id,
        answers: feedbackQs.map((q) => ({
          feed_que_id: q.feed_que_id,
          feed_ans: (draft[q.feed_que_id] ?? '').trim(),
        })),
        followUpDate: followUp || null,
        actorId: actor,
      });
      setSubmitting(false);
      if (res.error) {
        setFbErr(res.error);
        return;
      }
      // Reflect the submitted answers locally + lock the form.
      setAnswers(
        feedbackQs.map((q) => ({
          feed_que_id: q.feed_que_id,
          feed_ans: (draft[q.feed_que_id] ?? '').trim(),
        }))
      );
      await onChanged();
      return;
    }

    // Reschedule / Cancel — feedback answers are optional; reuse the existing flow.
    if (!reason.trim()) {
      setFbErr('Please provide a reason.');
      return;
    }
    if (outcome === 'reschedule' && !newDate) {
      setFbErr('Please choose a new date.');
      return;
    }
    if (outcome === 'cancel') {
      const ok = await confirm({
        title: 'Cancel / drop this meeting?',
        message: 'The meeting will be marked cancelled and the lead stage updated. This cannot be undone.',
        tone: 'danger',
        confirmLabel: 'Cancel meeting',
        cancelLabel: 'Keep meeting',
      });
      if (!ok) return;
    }
    setSubmitting(true);
    const res = await updateMeeting({
      meetingId: m.meeting_id,
      reportId,
      action: outcome,
      by,
      reason,
      newDate: outcome === 'reschedule' ? newDate : undefined,
      newTime: outcome === 'reschedule' ? newTime : undefined,
      newDuration: outcome === 'reschedule' ? newDuration : undefined,
      actor,
    });
    setSubmitting(false);
    if (res?.error) {
      setFbErr(res.error);
      return;
    }
    await onChanged();
  };

  const handleSaveAgentFb = async () => {
    if (!agentFb.trim()) return;
    if (!actor) {
      setAgentErr('Your account isn’t linked to a user profile yet, so feedback can’t be saved.');
      return;
    }
    setSavingFb(true);
    setAgentErr('');
    const res = await saveAgentFeedback(m.meeting_id, agentFb, actor);
    setSavingFb(false);
    if (res?.error) {
      setAgentErr(res.error);
      return;
    }
    setSavedFb(true);
  };

  const byOptions = outcome === 'reschedule' ? POSTPONED_BY : CANCELLED_BY;

  return (
    <div className="border border-stone-200 rounded-lg">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left"
      >
        <div className="min-w-0">
          <p className="font-medium text-stone-800 truncate" style={{ fontSize: 13 }}>
            {m.meeting_name || 'Untitled meeting'}
          </p>
          <div className="flex items-center gap-3 text-stone-400 mt-0.5" style={{ fontSize: 12 }}>
            {m.lead_name && <span className="truncate">{m.lead_name}</span>}
            {m.meeting_date && <span>{fmtDate(m.meeting_date)}</span>}
            {(m.status || m.meeting_status) && <span>{m.status || m.meeting_status}</span>}
          </div>
        </div>
        <span className="text-blue-600 shrink-0" style={{ fontSize: 12 }}>
          {open ? 'Hide' : 'Feedback'}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-stone-100 pt-3 space-y-4">
          {/* Salesperson feedback */}
          <div>
            <h4 className="font-semibold text-stone-600 mb-2" style={{ fontSize: 12 }}>
              Salesperson Feedback
            </h4>

            {loadingFb ? (
              <LoadingBlock />
            ) : feedbackSubmitted ? (
              /* Locked read-only view (reuses the existing question/answer display). */
              <div className="space-y-2">
                {feedbackQs.map((q) => (
                  <div key={q.feed_que_id}>
                    <p className="text-stone-500" style={{ fontSize: 12 }}>
                      {q.feed_que}
                    </p>
                    <p className="text-stone-800 whitespace-pre-wrap" style={{ fontSize: 13 }}>
                      {ansFor(q.feed_que_id) || <span className="text-stone-300">—</span>}
                    </p>
                  </div>
                ))}
                <p className="text-stone-400 pt-1" style={{ fontSize: 11 }}>
                  Feedback submitted — this meeting is marked Completed.
                </p>
              </div>
            ) : isCancelled ? (
              <p className="text-stone-400" style={{ fontSize: 12 }}>
                This meeting was cancelled — feedback can no longer be submitted.
              </p>
            ) : (
              /* Editable form: Yes/No toggles, free-text, follow-up + 3 outcomes. */
              <div className="space-y-3">
                {outcome === 'successful' && (
                  <>
                    {feedbackQs.map((q) => {
                      const freeText = isFreeTextQuestion(q);
                      const val = draft[q.feed_que_id] ?? '';
                      return (
                        <div key={q.feed_que_id}>
                          <p className="text-stone-600 mb-1" style={{ fontSize: 12 }}>
                            {q.feed_que}
                          </p>
                          {freeText ? (
                            <textarea
                              value={val}
                              onChange={(e) =>
                                setDraft((d) => ({ ...d, [q.feed_que_id]: e.target.value }))
                              }
                              rows={3}
                              maxLength={1000}
                              placeholder="Type here..."
                              className={`${inputCls} resize-y`}
                              style={{ fontSize: 13 }}
                            />
                          ) : (
                            <div className="flex gap-2">
                              {(['Yes', 'No'] as const).map((opt) => {
                                const active = (val || 'Yes') === opt;
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() =>
                                      setDraft((d) => ({ ...d, [q.feed_que_id]: opt }))
                                    }
                                    className="rounded-md px-4 py-1.5 font-medium transition-colors"
                                    style={{
                                      fontSize: 13,
                                      border: '1px solid',
                                      borderColor: active ? '#1A7EE8' : '#d4d4d8',
                                      background: active ? '#E8F2FD' : '#fff',
                                      color: active ? '#1463B8' : '#52525b',
                                    }}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <div>
                      <FieldLabel>Next meeting / follow-up date</FieldLabel>
                      <input
                        type="date"
                        value={followUp}
                        min={today}
                        onChange={(e) => setFollowUp(e.target.value)}
                        className={inputCls}
                        style={{ fontSize: 13 }}
                      />
                    </div>
                  </>
                )}

                {/* Outcome selector */}
                <div>
                  <FieldLabel>Meeting outcome</FieldLabel>
                  <div className="flex gap-2">
                    {([
                      ['successful', 'Successful'],
                      ['reschedule', 'Reschedule'],
                      ['cancel', 'Cancel / Drop'],
                    ] as const).map(([val, label]) => {
                      const active = outcome === val;
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => (val === 'successful' ? setOutcome('successful') : switchBy(val))}
                          className="flex-1 rounded-md py-2 font-medium transition-colors"
                          style={{
                            fontSize: 13,
                            border: '1px solid',
                            borderColor: active ? '#1A7EE8' : '#d4d4d8',
                            background: active ? '#E8F2FD' : '#fff',
                            color: active ? '#1463B8' : '#52525b',
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Reschedule / Cancel sub-fields */}
                {outcome !== 'successful' && (
                  <div className="space-y-3 rounded-md bg-stone-50 border border-stone-100 p-3">
                    <div>
                      <FieldLabel required>
                        {outcome === 'reschedule' ? 'Postponed by' : 'Cancelled by'}
                      </FieldLabel>
                      <select
                        value={by}
                        onChange={(e) => setBy(e.target.value)}
                        className={inputCls}
                        style={{ fontSize: 13 }}
                      >
                        {byOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {outcome === 'reschedule' && (
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
                        rows={2}
                        placeholder={
                          outcome === 'reschedule'
                            ? 'Why is the meeting being rescheduled?'
                            : 'Why is the meeting being cancelled / dropped?'
                        }
                        className={`${inputCls} resize-y`}
                        style={{ fontSize: 13 }}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <PrimaryButton onClick={handleSubmit} loading={submitting}>
                    {outcome === 'successful' ? (
                      <>
                        <CheckCircle2 size={14} /> Submit Feedback
                      </>
                    ) : outcome === 'reschedule' ? (
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
                {fbErr && <InlineNote kind="error">{fbErr}</InlineNote>}
              </div>
            )}
          </div>

          {/* Agent feedback (editable once) */}
          <div>
            <h4 className="font-semibold text-stone-600 mb-2" style={{ fontSize: 12 }}>
              Agent Feedback
            </h4>
            {savedFb ? (
              <p className="text-stone-800 whitespace-pre-wrap" style={{ fontSize: 13 }}>
                {agentFb || <span className="text-stone-300">—</span>}
              </p>
            ) : (
              <>
                <textarea
                  value={agentFb}
                  onChange={(e) => setAgentFb(e.target.value)}
                  rows={3}
                  placeholder="Your feedback to the Leadgen team..."
                  className={`${inputCls} resize-y`}
                  style={{ fontSize: 13 }}
                />
                <div className="mt-2">
                  <PrimaryButton onClick={handleSaveAgentFb} loading={savingFb} disabled={!agentFb.trim()}>
                    Save Feedback
                  </PrimaryButton>
                </div>
                {agentErr && <InlineNote kind="error">{agentErr}</InlineNote>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Update (reschedule / cancel) modal ───────────────────────── */

function UpdateMeetingModal({
  meeting,
  reportId,
  actor,
  onClose,
  onSaved,
}: {
  meeting: MeetingListItem | MeetingRow;
  reportId: number | null;
  actor: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [action, setAction] = useState<'reschedule' | 'cancel'>('reschedule');
  const [by, setBy] = useState(POSTPONED_BY[0].value);
  const [reason, setReason] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newDuration, setNewDuration] = useState(meeting.duration ?? '00:30');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const confirm = useConfirm();

  const today = new Date().toISOString().slice(0, 10);

  const byOptions = action === 'reschedule' ? POSTPONED_BY : CANCELLED_BY;

  const switchAction = (a: 'reschedule' | 'cancel') => {
    setAction(a);
    setBy((a === 'reschedule' ? POSTPONED_BY : CANCELLED_BY)[0].value);
  };

  const handleSave = async () => {
    if (!actor) {
      setErr('Your account isn’t linked to a user profile yet, so changes can’t be saved.');
      return;
    }
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
        message: 'The meeting will be marked cancelled and the lead stage updated. This cannot be undone.',
        tone: 'danger',
        confirmLabel: 'Cancel meeting',
        cancelLabel: 'Keep meeting',
      });
      if (!ok) return;
    }
    setSaving(true);
    setErr('');
    const res = await updateMeeting({
      meetingId: meeting.meeting_id,
      reportId,
      action,
      by,
      reason,
      newDate: action === 'reschedule' ? newDate : undefined,
      newTime: action === 'reschedule' ? newTime : undefined,
      newDuration: action === 'reschedule' ? newDuration : undefined,
      actor,
    });
    setSaving(false);
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
            Update Meeting
          </h3>
          <button onClick={onClose} aria-label="Close" className="text-stone-400 hover:text-stone-700 transition-colors">
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
              placeholder={action === 'reschedule' ? 'Why is the meeting being rescheduled?' : 'Why is the meeting being cancelled?'}
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
