/**
 * ReportTab — the pre-sales Lead Report form. Locks after "Request Approval".
 *
 * Sections (in order, per spec):
 *  (A) Assign Salesperson / Sales Head  -> lead_report.user_id
 *  (B) Pre-Sales Questions (by domain)  -> pre_sales_answer
 *  (C) New (ad-hoc) Questions           -> new_sales_question
 *  (D) Discussion (a pre-sales question named "Discussion")
 *  (E) Sales Intelligence               -> lead_report.sales_intelligence
 *  (F) Agreed for the meeting? Yes/No/Tentative -> meeting_master/schedule/participant
 *
 * Actions: Save (upsert report + children), Request Approval (lock), View (read-only).
 *
 * NOTE: pre_sales_question in this DB has NO options JSON column — every question
 * is free text here. The spec says "radio if options JSON present else text"; since
 * none are present, all render as text inputs. The radio branch is wired and will
 * activate automatically if an options column is added later (see `q.options`).
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Plus, Trash2, Eye, Save, CheckCircle2, Lock, ThumbsUp, ThumbsDown, X } from 'lucide-react';
import {
  fetchSalespeople,
  fetchPreSalesQuestions,
  fetchReport,
  fetchLeadMeeting,
  saveReport,
  requestApproval,
  isReportLocked,
  type SalespersonOption,
  type PreSalesQuestion,
  type NewQuestionRow,
  type AgreeState,
} from '../../data/leadWorkspace';
import {
  approveReport,
  rejectReport,
  notifyApproversOfRequest,
} from '../../data/approvals';
import type { LeadDetail } from '../../lib/leadsApi';
import {
  card,
  inputCls,
  FieldLabel,
  PrimaryButton,
  SecondaryButton,
  LoadingBlock,
  InlineNote,
} from './primitives';
import { useConfirm } from '../ui/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';

const MODES = ['Telephonic', 'Online', 'Offline'];
const MAX_NEW_QUESTIONS = 5;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ReportTab({
  lead,
  domainId,
  actor,
  userRole,
  onReportSaved,
}: {
  lead: LeadDetail;
  domainId: number | null;
  actor: string;
  /** profile.role — used to show inline approve/reject for ADMIN and TEAM_LEAD */
  userRole?: string;
  onReportSaved: () => void; // tell the parent to refresh header/stage
}) {
  const confirm = useConfirm();
  const { isApprover } = useAuth();
  const [loading, setLoading] = useState(true);
  const [salespeople, setSalespeople] = useState<SalespersonOption[]>([]);
  const [questions, setQuestions] = useState<PreSalesQuestion[]>([]);

  // form state
  const [reportId, setReportId] = useState<number | null>(null);
  const [approval, setApproval] = useState<string | null>(null);
  const [reportStatus, setReportStatus] = useState<string | null>(null);
  const [assignedUserId, setAssignedUserId] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [newQuestions, setNewQuestions] = useState<NewQuestionRow[]>([]);
  const [salesIntelligence, setSalesIntelligence] = useState('');
  const [agree, setAgree] = useState<AgreeState>('');

  // meeting (agree=yes)
  const [mMode, setMMode] = useState('Online');
  const [mName, setMName] = useState('');
  const [mDate, setMDate] = useState('');
  const [mTime, setMTime] = useState('');
  const [mDuration, setMDuration] = useState('00:30');
  const [mCallRec, setMCallRec] = useState('');
  const [mSharePoint, setMSharePoint] = useState('');
  const [mAgenda, setMAgenda] = useState('');
  const [meetingId, setMeetingId] = useState<number | null>(null);

  // outcome (no / tentative)
  const [reason, setReason] = useState('');
  const [followUp, setFollowUp] = useState('');

  const [saving, setSaving] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [viewMode, setViewMode] = useState(false);

  // Inline approve/reject (for ADMIN + TEAM_LEAD when report is Pending)
  const [approvingInline, setApprovingInline] = useState(false);
  const [rejectingInline, setRejectingInline] = useState(false);
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const locked = isReportLocked(approval);
  const readOnly = locked || viewMode;

  const load = useCallback(async () => {
    setLoading(true);
    const [sp, qs, existing] = await Promise.all([
      fetchSalespeople(lead.project_id),
      fetchPreSalesQuestions(domainId),
      fetchReport(lead.lead_id),
    ]);
    setSalespeople(sp);
    setQuestions(qs);

    if (existing.report) {
      setReportId(existing.report.report_id);
      setApproval(existing.report.report_approval);
      setReportStatus(existing.report.report_status);
      setAssignedUserId(existing.report.user_id);
      setSalesIntelligence(existing.report.sales_intelligence ?? '');
      const ansMap: Record<number, string> = {};
      existing.answers.forEach((a) => (ansMap[a.pre_sa_que_id] = a.answer));
      setAnswers(ansMap);
      setNewQuestions(existing.newQuestions.map((n) => ({ ...n, _uid: n._uid ?? crypto.randomUUID() })));

      // Hydrate the previously-saved meeting / outcome so editing updates in place.
      const own = await fetchLeadMeeting(existing.report.report_id);
      if (own?.meeting) {
        const mtg = own.meeting;
        setMeetingId(mtg.meeting_id);
        setAgree('yes');
        if (mtg.meeting_mode) setMMode(mtg.meeting_mode);
        setMName(mtg.meeting_name ?? '');
        setMDate(mtg.meeting_date ?? '');
        setMTime(mtg.meeting_time ?? '');
        if (mtg.duration) setMDuration(mtg.duration);
        setMCallRec(mtg.call_recording ?? '');
        setMSharePoint(mtg.share_point_url ?? '');
        setMAgenda(mtg.description ?? '');
      } else if (existing.schedule && !existing.schedule.meeting_id) {
        // Restore a previously-saved "No" / "Tentative" decision (no linked meeting).
        if (existing.schedule.tentative) {
          setAgree('tentative');
          setFollowUp(existing.schedule.tentative);
        } else if (existing.schedule.reason != null) {
          setAgree('no');
          setReason(existing.schedule.reason);
        }
      }
    }
    setLoading(false);
  }, [lead.project_id, lead.lead_id, domainId]);

  useEffect(() => {
    load();
  }, [load]);

  // auto participants: lead email + selected salesperson email
  const participants = useMemo(() => {
    const sp = salespeople.find((s) => s.user_id === assignedUserId);
    return [lead.email, sp?.email].filter((e): e is string => !!e && e.trim() !== '');
  }, [salespeople, assignedUserId, lead.email]);

  const discussionQ = questions.find((q) => q.is_discussion) ?? null;
  const normalQs = questions.filter((q) => !q.is_discussion);

  const setAnswer = (qid: number, val: string) => setAnswers((prev) => ({ ...prev, [qid]: val }));

  const addNewQuestion = () => {
    if (newQuestions.length >= MAX_NEW_QUESTIONS) return;
    setNewQuestions((prev) => [...prev, { _uid: crypto.randomUUID(), question: '', answer: '' }]);
  };
  const updateNewQuestion = (idx: number, key: 'question' | 'answer', val: string) =>
    setNewQuestions((prev) => prev.map((n, i) => (i === idx ? { ...n, [key]: val } : n)));
  const removeNewQuestion = (idx: number) =>
    setNewQuestions((prev) => prev.filter((_, i) => i !== idx));

  function validate(forApproval: boolean): string | null {
    if (!assignedUserId) return 'Please assign a salesperson / sales head.';
    if (forApproval) {
      // require all pre-sales answers + discussion + an agree decision
      for (const q of normalQs) {
        if (!(answers[q.pre_sa_que_id] ?? '').trim()) return 'Please answer all pre-sales questions.';
      }
      if (discussionQ && !(answers[discussionQ.pre_sa_que_id] ?? '').trim())
        return 'Discussion is required.';
      if (!agree) return 'Please select "Agreed for the meeting?".';
    }
    if (agree === 'yes') {
      if (!mMode) return 'Please choose a meeting mode.';
      if (mName.trim().length < 3) return 'Meeting name must be at least 3 characters.';
      if (!mDate) return 'Please choose a meeting date.';
      if (mDate < todayStr()) return 'Meeting date cannot be in the past.';
      if (!mTime) return 'Please choose a meeting time.';
      if (!mDuration || mDuration === '00:00') return 'Please set a duration.';
      if (mAgenda.trim().length < 10) return 'Agenda must be at least 10 characters.';
    }
    if (agree === 'no' && !reason.trim()) return 'Please provide a reason.';
    if (agree === 'tentative' && !followUp) return 'Please choose a follow-up date.';
    return null;
  }

  const doSave = async (): Promise<number | null> => {
    if (!actor) {
      setError('Your account isn’t linked to a user profile yet, so the report can’t be saved.');
      return null;
    }
    const v = validate(false);
    if (v) {
      setError(v);
      return null;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    const res = await saveReport({
      leadId: lead.lead_id,
      reportId,
      assignedUserId,
      salesIntelligence,
      answers: Object.entries(answers).map(([qid, ans]) => ({ pre_sa_que_id: Number(qid), answer: ans })),
      newQuestions: newQuestions.filter((n) => n.question.trim()),
      agree,
      meeting:
        agree === 'yes'
          ? {
              meeting_id: meetingId,
              mode: mMode,
              name: mName,
              date: mDate,
              time: mTime,
              duration: mDuration,
              callRecording: mCallRec,
              sharePoint: mSharePoint,
              agenda: mAgenda,
              participants,
            }
          : undefined,
      reason: agree === 'no' ? reason : undefined,
      followUpDate: agree === 'tentative' ? followUp : undefined,
      actor,
    });
    setSaving(false);
    if ('error' in res) {
      setError(res.error);
      return null;
    }
    setReportId(res.report_id);
    setSuccess('Report saved.');
    onReportSaved();
    return res.report_id;
  };

  const handleRequestApproval = async () => {
    const v = validate(true);
    if (v) {
      setError(v);
      return;
    }
    const ok = await confirm({
      title: 'Submit this report for approval?',
      message: 'The report will be locked and sent to your Team Lead / Admin for review. You won\'t be able to edit it unless it\'s sent back.',
      confirmLabel: 'Submit for approval',
    });
    if (!ok) return;
    setRequesting(true);
    setError('');
    setSuccess('');
    const savedId = await doSave();
    if (savedId == null) {
      setRequesting(false);
      return;
    }
    const res = await requestApproval(savedId, lead.lead_id, actor);
    setRequesting(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setApproval('Pending');
    setReportStatus('New Meeting'); // requestApproval resets report_status; mirror locally
    setSuccess('Report submitted for approval. The form is now locked.');
    // Notify TL/Admin that a new report is awaiting approval
    notifyApproversOfRequest(
      savedId,
      lead.lead_id,
      lead.lead_name,
      lead.lead_number ?? null,
      lead.project_id ?? null,
      actor
    );
    onReportSaved();
  };

  const handleInlineApprove = async () => {
    if (!reportId) return;
    if (!actor) {
      setError('Your account isn’t linked to a user profile yet, so you can’t approve.');
      return;
    }
    const ok = await confirm({
      title: `Approve this report for "${lead.lead_name}"?`,
      message: 'This advances the lead to Meeting Scheduled and emails the agent and salesperson. This cannot be undone.',
      confirmLabel: 'Approve report',
    });
    if (!ok) return;
    setApprovingInline(true);
    setError('');
    setSuccess('');
    const agentIdStr = lead.created_by ? String(lead.created_by) : null;
    const res = await approveReport(
      reportId,
      lead.lead_id,
      lead.lead_name,
      lead.lead_number ?? null,
      agentIdStr,
      assignedUserId,
      actor
    );
    setApprovingInline(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setApproval('Approved');
    setSuccess('Report approved. Stage set to Meeting Scheduled.');
    onReportSaved();
  };

  const handleInlineReject = async () => {
    if (!reportId) return;
    if (!actor) {
      setError('Your account isn’t linked to a user profile yet, so you can’t reject.');
      return;
    }
    if (!rejectReason.trim()) {
      setError('A rejection reason is required.');
      return;
    }
    setRejectingInline(true);
    setError('');
    setSuccess('');
    const agentIdStr = lead.created_by ? String(lead.created_by) : null;
    const res = await rejectReport(
      reportId,
      lead.lead_id,
      lead.lead_name,
      lead.lead_number ?? null,
      agentIdStr,
      rejectReason,
      actor
    );
    setRejectingInline(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setApproval('Rejected');
    setReportStatus(`Rejected: ${rejectReason.trim()}`);
    setShowRejectBox(false);
    setRejectReason('');
    setSuccess('Report rejected. Stage set to Meeting Dropped by Amplior.');
    onReportSaved();
  };

  // isApprover is sourced from useAuth() (accounts for multi-role users via the
  // full roles[] array) instead of the legacy single-string userRole prop.

  if (loading) {
    return (
      <div className={`${card} p-6`}>
        <LoadingBlock label="Loading report..." />
      </div>
    );
  }

  // Approval status colours
  const approvalBannerStyle: Record<string, { bg: string; border: string; color: string }> = {
    Pending:  { bg: '#fffbeb', border: '#fde68a', color: '#92400e' },
    Approved: { bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d' },
    Rejected: { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c' },
    Created:  { bg: '#f4f4f5', border: '#d4d4d8', color: '#52525b' },
  };
  const bannerStyle = approvalBannerStyle[approval ?? 'Created'] ?? approvalBannerStyle['Created'];

  return (
    <div className="space-y-4">
      {/* Approval status banner — always shown when a report exists */}
      {approval && (
        <div
          className="rounded-lg px-4 py-3"
          style={{ background: bannerStyle.bg, border: `1px solid ${bannerStyle.border}`, color: bannerStyle.color, fontSize: 13 }}
        >
          <div className="flex items-start gap-2 flex-wrap">
            <Lock size={14} className="mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-semibold capitalize">{approval}</span>
              {approval === 'Pending' && ' — awaiting approval from Team Lead / Admin.'}
              {approval === 'Approved' && ' — meeting scheduled. Report is locked.'}
              {approval === 'Rejected' && (
                <>
                  {' — '}
                  <span>
                    Report was rejected
                    {/* report_status is stored as "Rejected: <reason>" — surface the reason */}
                    {reportStatus && /^rejected:/i.test(reportStatus.trim())
                      ? `: ${reportStatus.trim().replace(/^rejected:\s*/i, '')}`
                      : ''}
                    . Edit the form below and click <strong>Request Approval</strong> to resubmit.
                  </span>
                </>
              )}
              {approval === 'Created' && ' — draft. Save and request approval to proceed.'}
            </div>
          </div>

          {/* Inline approve/reject for ADMIN and TEAM_LEAD when Pending */}
          {isApprover && approval === 'Pending' && (
            <div className="mt-3 pt-3 border-t" style={{ borderColor: bannerStyle.border }}>
              {!showRejectBox ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleInlineApprove}
                    disabled={approvingInline}
                    className="inline-flex items-center gap-1.5 font-medium rounded-md transition-colors"
                    style={{
                      fontSize: 12,
                      padding: '5px 12px',
                      background: '#15803d',
                      color: '#fff',
                      border: 'none',
                      cursor: approvingInline ? 'not-allowed' : 'pointer',
                      opacity: approvingInline ? 0.7 : 1,
                    }}
                  >
                    <ThumbsUp size={12} />
                    {approvingInline ? 'Approving...' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRejectBox(true)}
                    className="inline-flex items-center gap-1.5 font-medium rounded-md transition-colors"
                    style={{
                      fontSize: 12,
                      padding: '5px 12px',
                      background: '#b91c1c',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <ThumbsDown size={12} />
                    Reject
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <label style={{ fontSize: 11, fontWeight: 500, color: bannerStyle.color, display: 'block' }}>
                    Rejection reason <span style={{ color: '#b91c1c' }}>*</span>
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={2}
                    placeholder="Explain why this report is being rejected..."
                    className={`${inputCls} resize-y`}
                    style={{ fontSize: 12 }}
                  />
                  <div className="flex gap-2 mt-1">
                    <button
                      type="button"
                      onClick={handleInlineReject}
                      disabled={rejectingInline || !rejectReason.trim()}
                      className="inline-flex items-center gap-1.5 font-medium rounded-md"
                      style={{
                        fontSize: 12,
                        padding: '5px 12px',
                        background: '#b91c1c',
                        color: '#fff',
                        border: 'none',
                        cursor: rejectingInline || !rejectReason.trim() ? 'not-allowed' : 'pointer',
                        opacity: rejectingInline || !rejectReason.trim() ? 0.6 : 1,
                      }}
                    >
                      <X size={12} />
                      {rejectingInline ? 'Rejecting...' : 'Confirm Reject'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowRejectBox(false); setRejectReason(''); }}
                      style={{ fontSize: 12, color: bannerStyle.color, background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* (A) Assign salesperson */}
      <div className={`${card} p-5`}>
        <FieldLabel required>Assign Salesperson / Sales Head</FieldLabel>
        <select
          value={assignedUserId ?? ''}
          onChange={(e) => setAssignedUserId(e.target.value ? Number(e.target.value) : null)}
          disabled={readOnly}
          className={inputCls}
          style={{ fontSize: 13 }}
        >
          <option value="">Select a salesperson...</option>
          {salespeople.map((s) => (
            <option key={s.user_id} value={s.user_id}>
              {s.full_name} ({s.role_name === 'SALES_HEAD' ? 'Sales Head' : 'Salesperson'})
            </option>
          ))}
        </select>
        {salespeople.length === 0 && (
          <InlineNote kind="error">No salespeople tagged on this project yet.</InlineNote>
        )}
      </div>

      {/* (B) Pre-sales questions */}
      <div className={`${card} p-5`}>
        <h3 className="font-semibold text-stone-700 mb-3" style={{ fontSize: 13 }}>
          Pre-Sales Questions
        </h3>
        {normalQs.length === 0 ? (
          <p className="text-stone-400" style={{ fontSize: 13 }}>
            No pre-sales questions configured for this domain.
          </p>
        ) : (
          <div className="space-y-4">
            {normalQs.map((q) => (
              <div key={q.pre_sa_que_id}>
                <FieldLabel required>{q.short_question || q.question}</FieldLabel>
                {q.question && q.question !== q.short_question && (
                  <p className="text-stone-400 mb-1.5" style={{ fontSize: 11 }}>
                    {q.question}
                  </p>
                )}
                {/* radio branch: activates only if an options array is added to the
                    question schema later; today every question is free text. */}
                <input
                  type="text"
                  value={answers[q.pre_sa_que_id] ?? ''}
                  onChange={(e) => setAnswer(q.pre_sa_que_id, e.target.value)}
                  disabled={readOnly}
                  placeholder="Type your answer..."
                  className={inputCls}
                  style={{ fontSize: 13 }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* (C) New (ad-hoc) questions */}
      <div className={`${card} p-5`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-stone-700" style={{ fontSize: 13 }}>
            New Questions
          </h3>
          {!readOnly && newQuestions.length < MAX_NEW_QUESTIONS && (
            <button
              type="button"
              onClick={addNewQuestion}
              className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium transition-colors"
              style={{ fontSize: 12 }}
            >
              <Plus size={13} />
              Add question
            </button>
          )}
        </div>
        {newQuestions.length === 0 ? (
          <p className="text-stone-400" style={{ fontSize: 13 }}>
            No custom questions added. You can add up to {MAX_NEW_QUESTIONS}.
          </p>
        ) : (
          <div className="space-y-3">
            {newQuestions.map((nq, idx) => (
              <div key={nq._uid ?? idx} className="flex gap-2 items-start">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={nq.question}
                    onChange={(e) => updateNewQuestion(idx, 'question', e.target.value)}
                    disabled={readOnly}
                    placeholder="Question"
                    className={inputCls}
                    style={{ fontSize: 13 }}
                  />
                  <input
                    type="text"
                    value={nq.answer}
                    onChange={(e) => updateNewQuestion(idx, 'answer', e.target.value)}
                    disabled={readOnly}
                    placeholder="Answer"
                    className={inputCls}
                    style={{ fontSize: 13 }}
                  />
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => removeNewQuestion(idx)}
                    className="text-stone-400 hover:text-red-600 transition-colors mt-2"
                    title="Remove"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* (D) Discussion */}
      {discussionQ && (
        <div className={`${card} p-5`}>
          <FieldLabel required>Discussion</FieldLabel>
          <textarea
            value={answers[discussionQ.pre_sa_que_id] ?? ''}
            onChange={(e) => setAnswer(discussionQ.pre_sa_que_id, e.target.value)}
            disabled={readOnly}
            rows={4}
            placeholder="Summarise the discussion with the prospect..."
            className={`${inputCls} resize-y`}
            style={{ fontSize: 13 }}
          />
        </div>
      )}

      {/* (E) Sales intelligence */}
      <div className={`${card} p-5`}>
        <FieldLabel>Sales Intelligence</FieldLabel>
        <textarea
          value={salesIntelligence}
          onChange={(e) => setSalesIntelligence(e.target.value)}
          disabled={readOnly}
          rows={3}
          placeholder="Any additional context for the sales team..."
          className={`${inputCls} resize-y`}
          style={{ fontSize: 13 }}
        />
      </div>

      {/* (F) Agreed for the meeting? */}
      <div className={`${card} p-5`}>
        <FieldLabel required>Agreed for the meeting?</FieldLabel>
        <div className="flex gap-5 mb-1" style={{ fontSize: 13 }}>
          {(['yes', 'no', 'tentative'] as AgreeState[]).map((opt) => (
            <label key={opt} className="flex items-center gap-1.5 text-stone-700 cursor-pointer">
              <input
                type="radio"
                name="agree"
                checked={agree === opt}
                onChange={() => setAgree(opt)}
                disabled={readOnly}
                className="accent-blue-600"
              />
              <span className="capitalize">{opt}</span>
            </label>
          ))}
        </div>

        {/* YES → meeting fields */}
        {agree === 'yes' && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel required>Mode</FieldLabel>
              <select
                value={mMode}
                onChange={(e) => setMMode(e.target.value)}
                disabled={readOnly}
                className={inputCls}
                style={{ fontSize: 13 }}
              >
                {MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel required>Meeting Name</FieldLabel>
              <input
                type="text"
                value={mName}
                onChange={(e) => setMName(e.target.value)}
                disabled={readOnly}
                className={inputCls}
                style={{ fontSize: 13 }}
              />
            </div>
            <div>
              <FieldLabel required>Date</FieldLabel>
              <input
                type="date"
                value={mDate}
                min={todayStr()}
                onChange={(e) => setMDate(e.target.value)}
                disabled={readOnly}
                className={inputCls}
                style={{ fontSize: 13 }}
              />
            </div>
            <div>
              <FieldLabel required>Time</FieldLabel>
              <input
                type="time"
                value={mTime}
                onChange={(e) => setMTime(e.target.value)}
                disabled={readOnly}
                className={inputCls}
                style={{ fontSize: 13 }}
              />
            </div>
            <div>
              <FieldLabel required>Duration (HH:mm)</FieldLabel>
              <input
                type="time"
                value={mDuration}
                onChange={(e) => setMDuration(e.target.value)}
                disabled={readOnly}
                className={inputCls}
                style={{ fontSize: 13 }}
              />
            </div>
            <div>
              <FieldLabel>Call Recording URL</FieldLabel>
              <input
                type="text"
                value={mCallRec}
                onChange={(e) => setMCallRec(e.target.value)}
                disabled={readOnly}
                placeholder="https://..."
                className={inputCls}
                style={{ fontSize: 13 }}
              />
            </div>
            <div>
              <FieldLabel>SharePoint Image URL</FieldLabel>
              <input
                type="text"
                value={mSharePoint}
                onChange={(e) => setMSharePoint(e.target.value)}
                disabled={readOnly}
                placeholder="https://..."
                className={inputCls}
                style={{ fontSize: 13 }}
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>Participants (auto-filled)</FieldLabel>
              <div
                className="flex flex-wrap gap-1.5 px-3 py-2 border border-stone-200 rounded-md bg-stone-50"
                style={{ minHeight: 38 }}
              >
                {participants.length === 0 ? (
                  <span className="text-stone-400" style={{ fontSize: 12 }}>
                    Lead email + assigned salesperson will appear here.
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
            <div className="sm:col-span-2">
              <FieldLabel required>Agenda</FieldLabel>
              <textarea
                value={mAgenda}
                onChange={(e) => setMAgenda(e.target.value)}
                disabled={readOnly}
                rows={3}
                placeholder="What should be covered in this meeting?"
                className={`${inputCls} resize-y`}
                style={{ fontSize: 13 }}
              />
            </div>
          </div>
        )}

        {/* NO → reason */}
        {agree === 'no' && (
          <div className="mt-4">
            <FieldLabel required>Reason</FieldLabel>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={readOnly}
              rows={2}
              placeholder="Why did the prospect not agree to a meeting?"
              className={`${inputCls} resize-y`}
              style={{ fontSize: 13 }}
            />
          </div>
        )}

        {/* TENTATIVE → follow-up */}
        {agree === 'tentative' && (
          <div className="mt-4 max-w-xs">
            <FieldLabel required>Follow-up Date</FieldLabel>
            <input
              type="date"
              value={followUp}
              min={todayStr()}
              onChange={(e) => setFollowUp(e.target.value)}
              disabled={readOnly}
              className={inputCls}
              style={{ fontSize: 13 }}
            />
          </div>
        )}
      </div>

      {/* Actions */}
      {(error || success) && (
        <div>
          {error && <InlineNote kind="error">{error}</InlineNote>}
          {success && <InlineNote kind="success">{success}</InlineNote>}
        </div>
      )}

      {!locked && (
        <div className="flex flex-wrap items-center gap-2">
          <PrimaryButton onClick={doSave} loading={saving} disabled={viewMode || requesting}>
            <Save size={14} />
            Save
          </PrimaryButton>
          <PrimaryButton onClick={handleRequestApproval} loading={requesting} disabled={viewMode || saving}>
            <CheckCircle2 size={14} />
            Request Approval
          </PrimaryButton>
          <SecondaryButton onClick={() => setViewMode((v) => !v)}>
            <Eye size={14} />
            {viewMode ? 'Exit Preview' : 'View'}
          </SecondaryButton>
        </div>
      )}
    </div>
  );
}
