/**
 * ApprovalsPage — Lead Report Approval queue.
 *
 * Accessible only to ADMIN and TEAM_LEAD. Shows all lead_reports with
 * report_approval = 'Pending'. Each row has VIEW (modal), APPROVE, REJECT.
 *
 * Approve → stage 4 (Meeting Scheduled), notify agent + SP.
 * Reject  → mandatory reason required → stage 6 (Meeting Droped By Amplior),
 *           store reason, notify agent.
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, ThumbsUp, ThumbsDown, X, Loader2, ShieldOff, ChevronRight, Search } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../components/ui/ConfirmDialog';
import {
  fetchPendingApprovals,
  fetchReportDetail,
  approveReport,
  rejectReport,
  type PendingApprovalRow,
  type ReportDetail,
} from '../data/approvals';
import { fmtDate } from '../data/leadWorkspace';
import { humanizeWriteError } from '../lib/writeError';

/* ─────────────── Small primitives ───────────────────────────── */

function Cell({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <td className="px-4 py-3 align-middle" style={{ fontSize: 13, color: muted ? '#71717a' : '#18181b' }}>
      {children}
    </td>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const s = (status ?? '').toLowerCase();
  let bg = '#f4f4f5', color = '#52525b';
  if (s.includes('pending')) { bg = '#fffbeb'; color = '#92400e'; }
  else if (s.includes('meeting scheduled')) { bg = '#f0fdf4'; color = '#15803d'; }
  return (
    <span className="rounded px-2 py-0.5 font-medium" style={{ fontSize: 11, background: bg, color, border: `1px solid ${bg === '#f4f4f5' ? '#d4d4d8' : 'transparent'}` }}>
      {status ?? '—'}
    </span>
  );
}

/* ─────────────── SLA / age ───────────────────────────────────── */

/** Whole days since a date (or null if unparseable). */
function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86_400_000);
}

/** Age pill that escalates colour as a pending report sits longer (SLA cue). */
function SlaBadge({ dateStr }: { dateStr: string | null }) {
  const d = daysSince(dateStr);
  if (d === null) return <span style={{ fontSize: 12, color: '#a1a1aa' }}>—</span>;
  const label = d <= 0 ? 'Today' : d === 1 ? '1 day' : `${d} days`;
  let bg = '#f4f4f5', color = '#52525b'; // fresh: ≤1 day
  if (d >= 4) { bg = '#fef2f2'; color = '#b91c1c'; }       // overdue
  else if (d >= 2) { bg = '#fffbeb'; color = '#92400e'; }  // ageing
  return (
    <span
      className="rounded px-2 py-0.5 font-medium"
      style={{ fontSize: 11, background: bg, color }}
      title={d >= 4 ? 'Overdue — pending more than 3 days' : undefined}
    >
      {label}
    </span>
  );
}

/* ─────────────── Report preview modal ───────────────────────── */

function ReportPreviewModal({
  reportId,
  leadName,
  onClose,
  onApprove,
  onReject,
  approving,
}: {
  reportId: number;
  leadName: string;
  onClose: () => void;
  /** In-modal approve (ALT-204) — approver can act without closing first. */
  onApprove?: () => void;
  onReject?: () => void;
  approving?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<ReportDetail | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchReportDetail(reportId).then((d) => {
      if (!cancelled) { setDetail(d); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [reportId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg border border-stone-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 sticky top-0 bg-white z-10">
          <div>
            <h3 className="font-semibold text-stone-800" style={{ fontSize: 14 }}>
              Lead Report Preview
            </h3>
            <p className="text-stone-500 mt-0.5" style={{ fontSize: 12 }}>{leadName}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-stone-400 hover:text-stone-700 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-stone-400">
              <Loader2 size={16} className="animate-spin" />
              <span style={{ fontSize: 13 }}>Loading report...</span>
            </div>
          ) : !detail ? (
            <p className="text-stone-400 text-center py-8" style={{ fontSize: 13 }}>Could not load report.</p>
          ) : (
            <div className="space-y-5">
              {/* Assigned SP */}
              <Section title="Assigned Salesperson / Sales Head">
                <p style={{ fontSize: 13, color: '#18181b' }}>{detail.assigned_sp_name || '—'}</p>
              </Section>

              {/* Pre-sales Q&A */}
              {detail.pre_sales_answers.length > 0 && (
                <Section title="Pre-Sales Q&A">
                  <div className="space-y-3">
                    {detail.pre_sales_answers.map((a, i) => (
                      <div key={i}>
                        <p className="font-medium text-stone-600" style={{ fontSize: 12 }}>
                          {a.short_question || a.question || `Question ${i + 1}`}
                        </p>
                        <p style={{ fontSize: 13, color: '#18181b' }}>{a.answer || '—'}</p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Custom questions */}
              {detail.new_questions.length > 0 && (
                <Section title="Custom Questions">
                  <div className="space-y-3">
                    {detail.new_questions.map((n, i) => (
                      <div key={i}>
                        <p className="font-medium text-stone-600" style={{ fontSize: 12 }}>{n.question}</p>
                        <p style={{ fontSize: 13, color: '#18181b' }}>{n.answer || '—'}</p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Sales intelligence */}
              {detail.sales_intelligence && (
                <Section title="Sales Intelligence">
                  <p style={{ fontSize: 13, color: '#18181b', whiteSpace: 'pre-wrap' }}>{detail.sales_intelligence}</p>
                </Section>
              )}

              {/* Proposed meeting */}
              {detail.meeting ? (
                <Section title="Proposed Meeting">
                  <div className="grid grid-cols-2 gap-3">
                    <MField label="Name" value={detail.meeting.meeting_name} />
                    <MField label="Mode" value={detail.meeting.meeting_mode} />
                    <MField label="Date" value={fmtDate(detail.meeting.meeting_date)} />
                    <MField label="Time" value={detail.meeting.meeting_time} />
                    <MField label="Duration" value={detail.meeting.duration} />
                    <div className="col-span-2">
                      <MField label="Agenda" value={detail.meeting.description} />
                    </div>
                    {detail.meeting.participants.length > 0 && (
                      <div className="col-span-2">
                        <p style={{ fontSize: 11, color: '#71717a', fontWeight: 500, marginBottom: 4 }}>Participants</p>
                        <div className="flex flex-wrap gap-1">
                          {detail.meeting.participants.map((p) => (
                            <span key={p} className="rounded px-2 py-0.5" style={{ fontSize: 12, background: '#E8F2FD', color: '#1463B8' }}>
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Section>
              ) : (
                <Section title="Proposed Meeting">
                  <p className="text-stone-400" style={{ fontSize: 13 }}>No meeting proposed yet.</p>
                </Section>
              )}
            </div>
          )}
        </div>

        {/* In-modal actions (ALT-204) */}
        {(onApprove || onReject) && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-stone-100 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              style={{ fontSize: 13, fontWeight: 500, padding: '7px 16px', border: '1px solid #d4d4d8', borderRadius: 6, background: '#fff', color: '#52525b', cursor: 'pointer' }}
            >
              Close
            </button>
            {onReject && (
              <button
                type="button"
                onClick={onReject}
                className="inline-flex items-center gap-1.5"
                style={{ fontSize: 13, fontWeight: 500, padding: '7px 16px', border: 'none', borderRadius: 6, background: '#b91c1c', color: '#fff', cursor: 'pointer' }}
              >
                <ThumbsDown size={13} /> Reject
              </button>
            )}
            {onApprove && (
              <button
                type="button"
                onClick={onApprove}
                disabled={approving}
                className="inline-flex items-center gap-1.5"
                style={{ fontSize: 13, fontWeight: 500, padding: '7px 16px', border: 'none', borderRadius: 6, background: approving ? '#86efac' : '#15803d', color: '#fff', cursor: approving ? 'not-allowed' : 'pointer' }}
              >
                {approving ? <Loader2 size={13} className="animate-spin" /> : <ThumbsUp size={13} />} Approve
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="font-semibold text-stone-600 mb-2 pb-1 border-b border-stone-100" style={{ fontSize: 12 }}>
        {title}
      </h4>
      {children}
    </div>
  );
}

function MField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: '#71717a', fontWeight: 500, marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 13, color: value ? '#18181b' : '#d4d4d8' }}>{value || '—'}</p>
    </div>
  );
}

/* ─────────────── Reject modal ───────────────────────────────── */

function RejectModal({
  row,
  actor,
  onClose,
  onRejected,
}: {
  row: PendingApprovalRow;
  actor: string;
  onClose: () => void;
  onRejected: () => void;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async () => {
    if (!reason.trim()) { setErr('A rejection reason is required.'); return; }
    setSaving(true);
    setErr('');
    const res = await rejectReport(
      row.report_id,
      row.lead_id,
      row.lead_name,
      row.lead_number,
      row.requesting_agent_id,
      reason,
      actor
    );
    setSaving(false);
    if (res?.error) { setErr(humanizeWriteError(res.error) ?? 'Something went wrong. Please try again.'); return; }
    onRejected();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg border border-stone-200 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <h3 className="font-semibold text-stone-800" style={{ fontSize: 14 }}>
            Reject Report — {row.lead_name}
          </h3>
          <button onClick={onClose} aria-label="Close" className="text-stone-400 hover:text-stone-700 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-stone-600" style={{ fontSize: 13 }}>
            The agent will be notified of the rejection with your reason and prompted to edit and resubmit.
          </p>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#71717a', marginBottom: 5 }}>
              Rejection reason <span style={{ color: '#b91c1c' }}>*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="Explain why this report is being rejected..."
              style={{
                width: '100%',
                border: '1px solid #d4d4d8',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 13,
                resize: 'vertical',
                outline: 'none',
              }}
            />
          </div>
          {err && <p style={{ fontSize: 12, color: '#b91c1c', margin: '4px 0 0' }}>{err}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-stone-100">
          <button
            type="button"
            onClick={onClose}
            style={{
              fontSize: 13,
              fontWeight: 500,
              padding: '7px 16px',
              border: '1px solid #d4d4d8',
              borderRadius: 6,
              background: '#fff',
              color: '#52525b',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !reason.trim()}
            style={{
              fontSize: 13,
              fontWeight: 500,
              padding: '7px 16px',
              border: 'none',
              borderRadius: 6,
              background: saving || !reason.trim() ? '#d4d4d8' : '#b91c1c',
              color: '#fff',
              cursor: saving || !reason.trim() ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            <X size={13} />
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Page ───────────────────────────────────────── */

export function ApprovalsPage() {
  const { profile, isApprover } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();

  // Audit identifier must ALWAYS be the current user's user_id (never a name),
  // since created_by/updated_by are keyed on user_id for ownership/RLS.
  const actor = profile?.user_id != null ? String(profile.user_id) : null;

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PendingApprovalRow[]>([]);

  // modals
  const [viewRow, setViewRow] = useState<PendingApprovalRow | null>(null);
  const [approving, setApproving] = useState<number | null>(null); // report_id being approved
  const [rejectRow, setRejectRow] = useState<PendingApprovalRow | null>(null);

  const [err, setErr] = useState('');
  const [success, setSuccess] = useState('');

  // Search + sort + status filter. Default sort = oldest-requested first (SLA priority).
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'age' | 'name' | 'company' | 'agent'>('age');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchPendingApprovals();
    setRows(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Distinct report_status values for the status filter dropdown.
  const statusOptions = useMemo(() => {
    const seen = new Set<string>();
    rows.forEach((r) => { if (r.report_status) seen.add(r.report_status); });
    return [...seen].sort();
  }, [rows]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let filtered = q
      ? rows.filter((row) =>
          [row.lead_name, row.lead_number, row.client_name, row.requesting_agent_name, row.assigned_sp_name]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(q),
        )
      : rows;
    if (statusFilter) {
      filtered = filtered.filter((row) => row.report_status === statusFilter);
    }
    return [...filtered].sort((a, b) => {
      if (sortKey === 'name') return (a.lead_name || '').localeCompare(b.lead_name || '');
      if (sortKey === 'company') return (a.client_name || '').localeCompare(b.client_name || '');
      if (sortKey === 'agent') return (a.requesting_agent_name || '').localeCompare(b.requesting_agent_name || '');
      // age: oldest pending first (most urgent)
      const da = new Date(a.updated_date || a.created_date || 0).getTime();
      const db = new Date(b.updated_date || b.created_date || 0).getTime();
      return da - db;
    });
  }, [rows, search, sortKey, statusFilter]);

  const handleApprove = async (row: PendingApprovalRow) => {
    if (actor == null) {
      setErr('Your account is still loading. Please try again in a moment.');
      return;
    }
    const ok = await confirm({
      title: `Approve report for "${row.lead_name}"?`,
      message: 'This advances the lead to Meeting Scheduled and emails the agent and salesperson. This cannot be undone.',
      confirmLabel: 'Approve report',
    });
    if (!ok) return;
    setApproving(row.report_id);
    setErr('');
    setSuccess('');
    const res = await approveReport(
      row.report_id,
      row.lead_id,
      row.lead_name,
      row.lead_number,
      row.requesting_agent_id,
      row.assigned_sp_id,
      actor
    );
    setApproving(null);
    if (res?.error) { setErr(humanizeWriteError(res.error) ?? 'Something went wrong. Please try again.'); return; }
    setSuccess(`Report for "${row.lead_name}" approved — meeting scheduled.`);
    load();
  };

  if (!isApprover) {
    return (
      <AppShell title="Approvals">
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-stone-400">
          <ShieldOff size={32} />
          <div className="text-center">
            <p className="font-medium text-stone-600" style={{ fontSize: 15 }}>Access Restricted</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>Only Team Leads, QC, and Admins can access the approvals queue.</p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
            style={{ fontSize: 13 }}
          >
            Go to Dashboard
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Approvals">
      <div className="space-y-4 max-w-[1400px]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-stone-900" style={{ fontSize: 20 }}>
              Lead Report Approvals
            </h1>
            <p className="text-stone-500 mt-0.5" style={{ fontSize: 13 }}>
              Review and approve or reject pending lead reports.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative flex items-center">
              <Search size={13} className="absolute text-stone-400 pointer-events-none" style={{ left: 8 }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search lead, company, agent..."
                aria-label="Search approvals"
                style={{
                  fontSize: 13, height: 30, paddingLeft: 26, paddingRight: search ? 24 : 10,
                  border: '1px solid #d4d4d8', borderRadius: 6, background: '#fff', color: '#18181b',
                  outline: 'none', width: 230,
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute text-stone-400 hover:text-stone-700"
                  style={{ right: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 2 }}
                >
                  ×
                </button>
              )}
            </div>
            {/* Status filter — only shown if the data has varied report_status values */}
            {statusOptions.length > 1 && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
                style={{ fontSize: 12, height: 30, padding: '0 8px', border: '1px solid #d4d4d8', borderRadius: 6, background: '#fff', color: '#52525b', cursor: 'pointer' }}
              >
                <option value="">All statuses</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}
            {/* Sort */}
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as 'age' | 'name' | 'company' | 'agent')}
              aria-label="Sort approvals"
              style={{ fontSize: 12, height: 30, padding: '0 8px', border: '1px solid #d4d4d8', borderRadius: 6, background: '#fff', color: '#52525b', cursor: 'pointer' }}
            >
              <option value="age">Oldest first (SLA)</option>
              <option value="name">Lead name (A–Z)</option>
              <option value="company">Company (A–Z)</option>
              <option value="agent">Agent (A–Z)</option>
            </select>
            <button
              onClick={load}
              disabled={loading}
              className="text-blue-600 hover:text-blue-700 font-medium transition-colors disabled:opacity-50"
              style={{ fontSize: 13 }}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {err && (
          <div className="rounded-lg px-4 py-3" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13 }}>
            {err}
          </div>
        )}
        {success && (
          <div className="rounded-lg px-4 py-3" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', fontSize: 13 }}>
            {success}
          </div>
        )}

        {/* Table */}
        <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-stone-400">
              <Loader2 size={18} className="animate-spin" />
              <span style={{ fontSize: 14 }}>Loading pending approvals...</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-stone-400">
              <ThumbsUp size={28} />
              <p style={{ fontSize: 14 }}>No pending approvals.</p>
              <p style={{ fontSize: 12, color: '#a1a1aa' }}>All lead reports have been reviewed.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] border-collapse">
                <thead>
                  <tr style={{ borderBottom: '1px solid #e4e4e7', background: 'var(--color-page-bg)' }}>
                    {['Lead', 'Company', 'Requesting Agent', 'Assigned SP', 'Requested', 'Age', 'Actions'].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left font-semibold text-stone-500"
                        style={{ fontSize: 11 }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-stone-400" style={{ fontSize: 13 }}>
                        <span className="inline-flex items-center gap-2">
                          No approvals match “{search.trim()}”.
                          <button
                            type="button"
                            onClick={() => setSearch('')}
                            style={{ color: '#1A7EE8', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: 13 }}
                          >
                            Clear search
                          </button>
                        </span>
                      </td>
                    </tr>
                  ) : visibleRows.map((row) => (
                    <tr
                      key={row.report_id}
                      className="hover:bg-stone-50 transition-colors"
                      style={{ borderBottom: '1px solid #f4f4f5' }}
                    >
                      <Cell>
                        <button
                          onClick={() => navigate(`/leads/${row.lead_id}`)}
                          className="flex flex-col gap-0.5 text-left hover:text-blue-600 transition-colors"
                        >
                          <span className="font-medium">{row.lead_name || '—'}</span>
                          {row.lead_number && (
                            <span className="font-mono text-stone-400" style={{ fontSize: 11 }}>
                              {row.lead_number}
                            </span>
                          )}
                        </button>
                      </Cell>
                      <Cell muted>{row.client_name || '—'}</Cell>
                      <Cell muted>{row.requesting_agent_name || '—'}</Cell>
                      <Cell muted>{row.assigned_sp_name || '—'}</Cell>
                      <Cell muted>
                        {row.updated_date
                          ? fmtDate(row.updated_date)
                          : row.created_date
                          ? fmtDate(row.created_date)
                          : '—'}
                      </Cell>
                      <Cell>
                        <SlaBadge dateStr={row.updated_date || row.created_date} />
                      </Cell>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* VIEW */}
                          <button
                            type="button"
                            onClick={() => setViewRow(row)}
                            title="Preview report"
                            className="inline-flex items-center gap-1 font-medium rounded-md transition-colors"
                            style={{
                              fontSize: 12,
                              padding: '4px 10px',
                              border: '1px solid #d4d4d8',
                              background: '#fff',
                              color: '#1A7EE8',
                              cursor: 'pointer',
                            }}
                          >
                            <Eye size={12} />
                            View
                          </button>

                          {/* APPROVE */}
                          <button
                            type="button"
                            onClick={() => handleApprove(row)}
                            disabled={approving === row.report_id}
                            title="Approve report"
                            className="inline-flex items-center gap-1 font-medium rounded-md transition-colors"
                            style={{
                              fontSize: 12,
                              padding: '4px 10px',
                              border: 'none',
                              background: '#15803d',
                              color: '#fff',
                              cursor: approving === row.report_id ? 'not-allowed' : 'pointer',
                              opacity: approving === row.report_id ? 0.7 : 1,
                            }}
                          >
                            {approving === row.report_id
                              ? <Loader2 size={12} className="animate-spin" />
                              : <ThumbsUp size={12} />}
                            Approve
                          </button>

                          {/* REJECT */}
                          <button
                            type="button"
                            onClick={() => {
                              if (actor == null) {
                                setErr('Your account is still loading. Please try again in a moment.');
                                return;
                              }
                              setRejectRow(row);
                            }}
                            title="Reject report"
                            className="inline-flex items-center gap-1 font-medium rounded-md transition-colors"
                            style={{
                              fontSize: 12,
                              padding: '4px 10px',
                              border: 'none',
                              background: '#b91c1c',
                              color: '#fff',
                              cursor: 'pointer',
                            }}
                          >
                            <ThumbsDown size={12} />
                            Reject
                          </button>

                          {/* Quick link to lead */}
                          <button
                            type="button"
                            onClick={() => navigate(`/leads/${row.lead_id}`)}
                            title="Open lead detail"
                            style={{
                              fontSize: 12,
                              background: 'none',
                              border: 'none',
                              color: '#a1a1aa',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: 4,
                            }}
                          >
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Report preview modal — with in-modal approve/reject (ALT-204) */}
      {viewRow && (
        <ReportPreviewModal
          reportId={viewRow.report_id}
          leadName={viewRow.lead_name}
          onClose={() => setViewRow(null)}
          approving={approving === viewRow.report_id}
          onApprove={() => { const r = viewRow; setViewRow(null); handleApprove(r); }}
          onReject={() => {
            if (actor == null) { setErr('Your account is still loading. Please try again in a moment.'); return; }
            const r = viewRow; setViewRow(null); setRejectRow(r);
          }}
        />
      )}

      {/* Reject modal */}
      {rejectRow && actor != null && (
        <RejectModal
          row={rejectRow}
          actor={actor}
          onClose={() => setRejectRow(null)}
          onRejected={() => {
            setRejectRow(null);
            setSuccess(`Report for "${rejectRow.lead_name}" rejected.`);
            load();
          }}
        />
      )}
    </AppShell>
  );
}
