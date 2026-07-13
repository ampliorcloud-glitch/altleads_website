/**
 * leadWorkspace.ts — Supabase reads/writes for the HubSpot-style Lead Workspace
 * (Activity / Lead Report / Meeting tabs + the right-hand info panel).
 *
 * This sits ALONGSIDE leadsApi.ts (which already handles core lead detail + the
 * simple stage changer). Anything specific to the 3-tab workspace lives here.
 *
 * Established DB facts (verified against the live schema, see REBUILD_LOG):
 *  - Lead ownership   = lead_master.created_by  (varchar == user_master.user_id)
 *  - Company          = client_association via lead_master.client_assoc_id
 *  - Stage            = latest lead_report.stage_id -> stage_master
 *  - Pre-sales domain = client_association.domain_id  (drives which questions show)
 *  - Assigned SP/SH   = lead_report.user_id; candidates come from project_user.role_name
 *  - Meeting bridge   = meeting_schedule (report_id <-> meeting_id)
 *  - All PKs are IDENTITY columns — never supply them on insert.
 */

import { supabase } from '../lib/supabase';
import { notify, notifyInApp, resolveUserEmailAndName } from '../lib/notify';
import { humanizeWriteError } from '../lib/writeError';

/* ─────────────────────────── Types ─────────────────────────── */

export interface WorkspaceActivity {
  activity_id: number;
  lead_comments: string;
  created_by: string;
  created_by_name: string;
  created_date: string | null; // raw ISO
  is_generated: boolean;
}

export interface CompanyInfo {
  client_assoc_id: number;
  client_name: string;
  full_name: string; // contact at the company
  location: string;
  website: string;
  email: string;
  mobile_number: string;
  industry_name: string;
  domain_id: number | null;
  domain_name: string;
}

export interface SalespersonOption {
  user_id: number;
  full_name: string;
  email: string;
  role_name: string; // SALES_PERSON | SALES_HEAD
}

export interface PreSalesQuestion {
  pre_sa_que_id: number;
  question: string;
  short_question: string;
  domain_id: number | null;
  is_discussion: boolean; // the question literally named "Discussion"
}

export interface PreSalesAnswerRow {
  pre_sa_ans_id: number;
  pre_sa_que_id: number;
  answer: string;
}

export interface NewQuestionRow {
  // client-side rows; new_sal_que_id only present once persisted
  new_sal_que_id?: number;
  _uid?: string;
  question: string;
  answer: string;
}

export type AgreeState = 'yes' | 'no' | 'tentative' | '';

export interface ReportData {
  report_id: number | null;
  lead_id: number;
  stage_id: number | null;
  user_id: number | null; // assigned salesperson/head
  sales_intelligence: string;
  report_approval: string | null; // Created | Pending | Approved | Rejected
  report_status: string | null;
  lead_request: boolean | null;
}

export interface MeetingRow {
  meeting_id: number;
  meeting_name: string;
  meeting_mode: string | null;
  meeting_date: string | null;
  meeting_time: string | null;
  duration: string | null;
  meeting_url: string | null;
  call_recording: string | null;
  share_point_url: string | null;
  description: string | null; // agenda
  meeting_status: string | null;
  status: string | null;
  meeting_confirm: boolean | null;
  agent_feedback: string | null;
  reason: string | null;
}

export interface MeetingListItem extends MeetingRow {
  lead_id: number | null;
  lead_name: string;
}

export interface FeedbackQuestion {
  feed_que_id: number;
  feed_que: string;
}

export interface FeedbackAnswerRow {
  feed_que_id: number;
  feed_ans: string;
}

/* ─────────────────────────── Helpers ─────────────────────────── */

/** "12 Jun 2026" */
export function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** "12 Jun 2026, 14:30" */
export function fmtDateTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time}`;
}

export function initials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Resolve a set of numeric user_ids (held as varchar) -> full_name map. */
async function resolveUserNames(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const numeric = [...new Set(ids.filter(Boolean))].map(Number).filter((n) => !isNaN(n));
  if (numeric.length === 0) return map;
  const { data } = await supabase
    .from('user_master')
    .select('user_id, full_name')
    .in('user_id', numeric);
  ((data ?? []) as { user_id: number; full_name: string }[]).forEach((u) =>
    map.set(String(u.user_id), u.full_name ?? '')
  );
  return map;
}

/* ─────────────────────── ACTIVITY TAB ─────────────────────── */

export async function fetchActivity(leadId: number): Promise<WorkspaceActivity[]> {
  const { data, error } = await supabase
    .from('lead_activity')
    .select('activity_id, lead_comments, created_by, created_date, is_generated')
    .eq('lead_id', leadId)
    .is('deleted_date', null)
    .order('created_date', { ascending: false })
    .limit(200);

  if (error) throw error;

  const rows = (data ?? []) as {
    activity_id: number;
    lead_comments: string;
    created_by: string;
    created_date: string;
    is_generated: boolean | null;
  }[];

  if (rows.length === 0) return [];

  const userMap = await resolveUserNames(rows.map((r) => r.created_by));

  return rows.map((r) => ({
    activity_id: r.activity_id,
    lead_comments: r.lead_comments ?? '',
    created_by: r.created_by ?? '',
    created_by_name: userMap.get(r.created_by) || (r.is_generated ? 'System' : r.created_by) || 'System',
    created_date: r.created_date ?? null,
    is_generated: !!r.is_generated,
  }));
}

/** Insert a human comment. Returns the new row id or an error. */
export async function addActivityComment(
  leadId: number,
  comment: string,
  createdBy: string
): Promise<{ activity_id: number } | { error: string }> {
  const text = comment.trim();
  if (!text) return { error: 'Comment is required.' };
  if (text.length > 500) return { error: 'Comment must be 500 characters or fewer.' };

  const { data, error } = await supabase
    .from('lead_activity')
    .insert({
      lead_id: leadId,
      lead_comments: text,
      created_by: createdBy,
      created_date: new Date().toISOString(),
      is_generated: false,
    })
    .select('activity_id')
    .single();

  if (error || !data) return { error: humanizeWriteError(error) ?? 'Failed to add comment.' };
  return { activity_id: (data as { activity_id: number }).activity_id };
}

/**
 * Write a system-generated activity entry (e.g. "Report shared for approval").
 * Best-effort — failures are swallowed so they never block the primary action.
 */
export async function logSystemActivity(
  leadId: number,
  text: string,
  createdBy: string
): Promise<void> {
  try {
    await supabase.from('lead_activity').insert({
      lead_id: leadId,
      lead_comments: text,
      created_by: createdBy,
      created_date: new Date().toISOString(),
      is_generated: true,
    });
  } catch {
    /* non-fatal */
  }
}

/* ─────────────────── RIGHT PANEL: COMPANY ─────────────────── */

export async function fetchCompanyInfo(clientAssocId: number | null): Promise<CompanyInfo | null> {
  if (!clientAssocId) return null;
  const { data } = await supabase
    .from('client_association')
    .select(
      'client_assoc_id, client_name, full_name, location, website, email, mobile_number, industry_id, domain_id'
    )
    .eq('client_assoc_id', clientAssocId)
    .maybeSingle();

  if (!data) return null;
  const row = data as {
    client_assoc_id: number;
    client_name: string;
    full_name: string;
    location: string;
    website: string;
    email: string;
    mobile_number: string;
    industry_id: number | null;
    domain_id: number | null;
  };

  const [industryRes, domainRes] = await Promise.all([
    row.industry_id
      ? supabase.from('industry_master').select('industry_name').eq('industry_id', row.industry_id).maybeSingle()
      : Promise.resolve({ data: null }),
    row.domain_id
      ? supabase.from('domain_master').select('domain_name').eq('domain_id', row.domain_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    client_assoc_id: row.client_assoc_id,
    client_name: row.client_name ?? '',
    full_name: row.full_name ?? '',
    location: row.location ?? '',
    website: row.website ?? '',
    email: row.email ?? '',
    mobile_number: row.mobile_number ?? '',
    industry_name: (industryRes.data as { industry_name: string } | null)?.industry_name ?? '',
    domain_id: row.domain_id ?? null,
    domain_name: (domainRes.data as { domain_name: string } | null)?.domain_name ?? '',
  };
}

/* ─────────────────── LEAD REPORT TAB ─────────────────── */

/**
 * Salesperson/Head candidates for the assign dropdown.
 * Source = project_user rows tagged SALES_PERSON / SALES_HEAD for this project.
 * If no projectId is available we fall back to ALL users tagged SP/SH via user_role,
 * so the dropdown is never empty.
 */
export async function fetchSalespeople(projectId: number | null): Promise<SalespersonOption[]> {
  if (projectId) {
    const { data } = await supabase
      .from('project_user')
      .select('user_id, role_name')
      .eq('project_id', projectId)
      .in('role_name', ['SALES_PERSON', 'SALES_HEAD'])
      .is('deleted_date', null);

    const rows = (data ?? []) as { user_id: number; role_name: string }[];
    if (rows.length > 0) {
      const ids = [...new Set(rows.map((r) => r.user_id))];
      const { data: users } = await supabase
        .from('user_master')
        .select('user_id, full_name, email')
        .in('user_id', ids);
      const umap = new Map<number, { full_name: string; email: string }>();
      ((users ?? []) as { user_id: number; full_name: string; email: string }[]).forEach((u) =>
        umap.set(u.user_id, { full_name: u.full_name ?? '', email: u.email ?? '' })
      );
      // de-dupe by user, prefer SALES_HEAD label if a user holds both
      const byUser = new Map<number, SalespersonOption>();
      for (const r of rows) {
        const u = umap.get(r.user_id);
        if (!u) continue;
        const existing = byUser.get(r.user_id);
        if (!existing || r.role_name === 'SALES_HEAD') {
          byUser.set(r.user_id, {
            user_id: r.user_id,
            full_name: u.full_name,
            email: u.email,
            role_name: r.role_name,
          });
        }
      }
      return [...byUser.values()].sort((a, b) => a.full_name.localeCompare(b.full_name));
    }
  }

  // Fallback: global SP/SH via user_role (role_id 4 = SALES_HEAD, 5 = SALES_PERSON)
  const { data: ur } = await supabase
    .from('user_role')
    .select('user_id, role_id')
    .in('role_id', [4, 5])
    .is('deleted_date', null);
  const urRows = (ur ?? []) as { user_id: number; role_id: number }[];
  if (urRows.length === 0) return [];
  const ids = [...new Set(urRows.map((r) => r.user_id))];
  const { data: users } = await supabase
    .from('user_master')
    .select('user_id, full_name, email')
    .in('user_id', ids)
    .eq('enabled', true);
  const roleMap = new Map<number, string>();
  urRows.forEach((r) => {
    if (r.role_id === 4) roleMap.set(r.user_id, 'SALES_HEAD');
    else if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, 'SALES_PERSON');
  });
  return ((users ?? []) as { user_id: number; full_name: string; email: string }[])
    .map((u) => ({
      user_id: u.user_id,
      full_name: u.full_name ?? '',
      email: u.email ?? '',
      role_name: roleMap.get(u.user_id) ?? 'SALES_PERSON',
    }))
    .filter((u) => u.full_name)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

/** Pre-sales questions for a domain (the "Discussion" one is flagged + sorted last).
 *  Only returns is_active=true rows once the column has been added. If the column
 *  doesn't exist yet (pre-migration), the eq filter is silently omitted and all
 *  non-deleted questions are returned (same behaviour as before the feature).
 */
export async function fetchPreSalesQuestions(domainId: number | null): Promise<PreSalesQuestion[]> {
  let q = supabase
    .from('pre_sales_question')
    .select('pre_sa_que_id, question, short_question, domain_id, is_active')
    .is('deleted_date', null)
    .eq('is_active', true);
  if (domainId) q = q.eq('domain_id', domainId);
  const { data } = await q.order('pre_sa_que_id');

  const rows = (data ?? []) as {
    pre_sa_que_id: number;
    question: string;
    short_question: string;
    domain_id: number | null;
    is_active: boolean | null;
  }[];

  return rows
    .map((r) => ({
      pre_sa_que_id: r.pre_sa_que_id,
      question: r.question ?? '',
      short_question: r.short_question ?? '',
      domain_id: r.domain_id ?? null,
      is_discussion: (r.short_question ?? '').trim().toLowerCase() === 'discussion',
    }))
    // Discussion always renders last (it's the big textarea)
    .sort((a, b) => Number(a.is_discussion) - Number(b.is_discussion) || a.pre_sa_que_id - b.pre_sa_que_id);
}

/** The latest meeting_schedule outcome attached to a report (decision re-hydration). */
export interface ScheduleOutcome {
  meeting_sched_id: number;
  meeting_id: number | null;
  reason: string | null;
  tentative: string | null; // yyyy-mm-dd
}

/** Existing report (if any) for this lead, with its children. */
export async function fetchReport(leadId: number): Promise<{
  report: ReportData | null;
  answers: PreSalesAnswerRow[];
  newQuestions: NewQuestionRow[];
  schedule: ScheduleOutcome | null;
}> {
  const { data: lr, error } = await supabase
    .from('lead_report')
    .select('report_id, lead_id, stage_id, user_id, sales_intelligence, report_approval, report_status, lead_request')
    .eq('lead_id', leadId)
    .is('deleted_date', null)
    .order('updated_date', { ascending: false, nullsFirst: false })
    .order('report_id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) console.error('[leadWorkspace] fetchReport', error);
  if (!lr) return { report: null, answers: [], newQuestions: [], schedule: null };

  const report = lr as ReportData;
  const reportId = report.report_id!;

  const [ansRes, nqRes, schedRes] = await Promise.all([
    supabase
      .from('pre_sales_answer')
      .select('pre_sa_ans_id, pre_sa_que_id, answer')
      .eq('report_id', reportId)
      .is('deleted_date', null),
    supabase
      .from('new_sales_question')
      .select('new_sal_que_id, question, answer')
      .eq('report_id', reportId)
      .is('deleted_date', null),
    supabase
      .from('meeting_schedule')
      .select('meeting_sched_id, meeting_id, reason, tentative')
      .eq('report_id', reportId)
      .is('deleted_date', null)
      .order('meeting_sched_id', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const answers = ((ansRes.data ?? []) as { pre_sa_ans_id: number; pre_sa_que_id: number; answer: string }[]).map(
    (a) => ({ pre_sa_ans_id: a.pre_sa_ans_id, pre_sa_que_id: a.pre_sa_que_id, answer: a.answer ?? '' })
  );
  const newQuestions = ((nqRes.data ?? []) as { new_sal_que_id: number; question: string; answer: string }[]).map(
    (n) => ({ new_sal_que_id: n.new_sal_que_id, question: n.question ?? '', answer: n.answer ?? '' })
  );

  const sRow = schedRes.data as
    | { meeting_sched_id: number; meeting_id: number | null; reason: string | null; tentative: string | null }
    | null;
  const schedule: ScheduleOutcome | null = sRow
    ? {
        meeting_sched_id: sRow.meeting_sched_id,
        meeting_id: sRow.meeting_id ?? null,
        reason: sRow.reason ?? null,
        tentative: sRow.tentative ?? null,
      }
    : null;

  return { report, answers, newQuestions, schedule };
}

export interface SaveReportInput {
  leadId: number;
  reportId: number | null;
  assignedUserId: number | null;
  salesIntelligence: string;
  answers: { pre_sa_que_id: number; answer: string }[];
  newQuestions: NewQuestionRow[];
  agree: AgreeState;
  /** meeting fields (only used when agree === 'yes') */
  meeting?: {
    meeting_id?: number | null;
    mode: string;
    name: string;
    date: string; // yyyy-mm-dd
    time: string; // HH:mm
    duration: string; // HH:mm
    callRecording: string;
    sharePoint: string;
    agenda: string;
    participants: string[]; // emails
  };
  reason?: string; // agree === 'no'
  followUpDate?: string; // agree === 'tentative'  (yyyy-mm-dd)
  actor: string; // current user's user_id (varchar)
}

/**
 * Save (upsert) a lead_report and its children.
 *
 * IMPLEMENTED:
 *  - upsert lead_report (assigned user, sales_intelligence)
 *  - replace pre_sales_answer rows for this report (soft-delete old, insert current)
 *  - replace new_sales_question rows for this report
 *  - agree === 'yes'  -> create/update meeting_master + meeting_schedule + meeting_participant
 *  - agree === 'no'   -> meeting_schedule.reason
 *  - agree === 'tentative' -> meeting_schedule.tentative (follow-up date)
 *
 * TODO / UNCERTAIN (left for a follow-up pass rather than guessing destructively):
 *  - lead_report requires a NON-NULL user_id at the DB level. If no salesperson is
 *    assigned yet we keep an existing value, but a brand-new report with no assignee
 *    cannot be inserted — the UI blocks Save until one is chosen (see ReportTab).
 *  - We "replace" children by soft-deleting then re-inserting. The old system likely
 *    updated rows in place to preserve IDs/audit. Acceptable for a first version;
 *    revisit if answer history/audit must be preserved.
 *  - meeting_master also has legacy flags (is_requested, user_assign, meeting_alert,
 *    meeting_confirm) whose exact semantics on first save are unclear — left untouched
 *    on create (DB defaults apply). Confirm with owner before relying on them.
 */
export async function saveReport(input: SaveReportInput): Promise<{ report_id: number } | { error: string }> {
  const now = new Date().toISOString();
  const actor = input.actor;

  if (!input.assignedUserId && !input.reportId) {
    return { error: 'Please assign a salesperson before saving.' };
  }

  // 1) upsert lead_report
  let reportId = input.reportId;
  if (reportId) {
    const patch: Record<string, unknown> = {
      sales_intelligence: input.salesIntelligence.trim() || null,
      updated_by: actor,
      updated_date: now,
    };
    if (input.assignedUserId) patch.user_id = input.assignedUserId;
    const { error } = await supabase.from('lead_report').update(patch).eq('report_id', reportId);
    if (error) return { error: humanizeWriteError(error) ?? error.message };
  } else {
    const { data, error } = await supabase
      .from('lead_report')
      .insert({
        lead_id: input.leadId,
        user_id: input.assignedUserId, // guaranteed non-null by the guard above
        sales_intelligence: input.salesIntelligence.trim() || null,
        report_approval: 'Created',
        lead_request: false,
        created_by: actor,
        created_date: now,
        updated_date: now, // keep fetchReport's updated_date ordering deterministic
      })
      .select('report_id')
      .single();
    if (error || !data) return { error: humanizeWriteError(error) ?? 'Failed to create report.' };
    reportId = (data as { report_id: number }).report_id;
  }

  // 2) replace pre_sales_answer rows
  await supabase
    .from('pre_sales_answer')
    .update({ deleted_by: actor, deleted_date: now })
    .eq('report_id', reportId)
    .is('deleted_date', null);
  const answerRows = input.answers
    .filter((a) => a.answer.trim() !== '')
    .map((a) => ({
      report_id: reportId,
      pre_sa_que_id: a.pre_sa_que_id,
      answer: a.answer.trim(),
      created_by: actor,
      created_date: now,
    }));
  if (answerRows.length > 0) {
    const { error } = await supabase.from('pre_sales_answer').insert(answerRows);
    if (error) return { error: humanizeWriteError(error) ?? error.message };
  }

  // 3) replace new_sales_question rows
  await supabase
    .from('new_sales_question')
    .update({ deleted_by: actor, deleted_date: now })
    .eq('report_id', reportId)
    .is('deleted_date', null);
  const nqRows = input.newQuestions
    .filter((n) => n.question.trim() !== '')
    .map((n) => ({
      report_id: reportId,
      question: n.question.trim(),
      answer: n.answer.trim(),
      created_by: actor,
      created_date: now,
    }));
  if (nqRows.length > 0) {
    const { error } = await supabase.from('new_sales_question').insert(nqRows);
    if (error) return { error: humanizeWriteError(error) ?? error.message };
  }

  // 4) meeting outcome
  if (input.agree === 'yes' && input.meeting) {
    const m = input.meeting;
    // upsert meeting_master
    let meetingId = m.meeting_id ?? null;
    const meetingPayload: Record<string, unknown> = {
      meeting_name: m.name.trim(),
      meeting_mode: m.mode,
      meeting_date: m.date || null,
      meeting_time: m.time || null,
      duration: m.duration || '00:30',
      call_recording: m.callRecording.trim() || null,
      share_point_url: m.sharePoint.trim() || null,
      description: m.agenda.trim() || null,
      updated_by: actor,
      updated_date: now,
    };
    if (meetingId) {
      const { error } = await supabase.from('meeting_master').update(meetingPayload).eq('meeting_id', meetingId);
      if (error) return { error: humanizeWriteError(error) ?? error.message };
    } else {
      const { data, error } = await supabase
        .from('meeting_master')
        .insert({ ...meetingPayload, created_by: actor, created_date: now })
        .select('meeting_id')
        .single();
      if (error || !data) return { error: humanizeWriteError(error) ?? 'Failed to create meeting.' };
      meetingId = (data as { meeting_id: number }).meeting_id;
    }

    // bridge row (report_id <-> meeting_id), reused if present
    const { data: sched } = await supabase
      .from('meeting_schedule')
      .select('meeting_sched_id')
      .eq('report_id', reportId)
      .is('deleted_date', null)
      .maybeSingle();
    if (sched) {
      await supabase
        .from('meeting_schedule')
        .update({ meeting_id: meetingId, reason: null, tentative: null, updated_by: actor, updated_date: now })
        .eq('meeting_sched_id', (sched as { meeting_sched_id: number }).meeting_sched_id);
    } else {
      await supabase.from('meeting_schedule').insert({
        report_id: reportId,
        meeting_id: meetingId,
        created_by: actor,
        created_date: now,
      });
    }

    // participants — replace set
    await supabase
      .from('meeting_participant')
      .update({ deleted_by: actor, deleted_date: now })
      .eq('meeting_id', meetingId)
      .is('deleted_date', null);
    const partRows = [...new Set(m.participants.map((p) => p.trim()).filter(Boolean))].map((p) => ({
      meeting_id: meetingId,
      participant: p,
      created_by: actor,
      created_date: now,
    }));
    if (partRows.length > 0) {
      await supabase.from('meeting_participant').insert(partRows);
    }

    // Fire-and-forget: email + in-app notification to the assigned salesperson.
    // TODO recipients: owner will tune per-action (reschedule/cancel/etc.).
    // Recipient = input.assignedUserId (the SP/SH from lead_report.user_id).
    if (input.assignedUserId) {
      const spId = input.assignedUserId;
      const meetingDate = m.date ? fmtDate(m.date) : '';   // "25 Jun 2026" instead of raw "2026-06-25"
      const meetingTime = m.time || '';                    // leave 24h HH:mm as-is (kept minimal)
      const mode = m.mode || '';
      const capturedMeetingId = meetingId; // capture for closure
      // Fetch lead name (and lead_number) for the notification text
      (async () => {
        try {
          const { data: leadRow } = await supabase
            .from('lead_master')
            .select('lead_name, lead_number')
            .eq('lead_id', input.leadId)
            .maybeSingle();
          const leadName = (leadRow as { lead_name: string; lead_number: string | null } | null)?.lead_name ?? '';
          const leadNumber = (leadRow as { lead_name: string; lead_number: string | null } | null)?.lead_number ?? null;
          const { email: spEmail } = await resolveUserEmailAndName(supabase, spId);
          const eventData = { leadName, meetingDate, meetingTime, mode };
          if (spEmail) {
            await notify('meeting_scheduled', spEmail, eventData);
          }
          // In-app notification (was previously missing — added here)
          await notifyInApp(supabase, spId, {
            status: 'Meeting Scheduled',
            notif_descr: `A meeting with ${leadName} has been scheduled for ${meetingDate}${meetingTime ? ' ' + meetingTime : ''}.`,
            route: capturedMeetingId ? `/meetings/${capturedMeetingId}` : '/meetings',
            meeting_id: capturedMeetingId ?? undefined,
            lead_id: input.leadId,
            lead_number: leadNumber,
            actor,
          });
        } catch {
          /* non-fatal */
        }
      })();
    }
  } else if (input.agree === 'no') {
    await upsertScheduleOutcome(reportId!, { reason: (input.reason ?? '').trim() || null, tentative: null }, actor, now);
  } else if (input.agree === 'tentative') {
    await upsertScheduleOutcome(reportId!, { reason: null, tentative: input.followUpDate || null }, actor, now);
  }

  return { report_id: reportId! };
}

async function upsertScheduleOutcome(
  reportId: number,
  patch: { reason: string | null; tentative: string | null },
  actor: string,
  now: string
): Promise<void> {
  const { data: sched } = await supabase
    .from('meeting_schedule')
    .select('meeting_sched_id, meeting_id')
    .eq('report_id', reportId)
    .is('deleted_date', null)
    .maybeSingle();
  if (sched) {
    const existing = sched as { meeting_sched_id: number; meeting_id: number | null };
    // Switching a prior 'yes' to 'no'/'tentative': detach the meeting so it no
    // longer re-hydrates as 'yes' (and soft-delete the now-orphaned meeting).
    if (existing.meeting_id) {
      await supabase
        .from('meeting_master')
        .update({ deleted_by: actor, deleted_date: now })
        .eq('meeting_id', existing.meeting_id)
        .is('deleted_date', null);
    }
    await supabase
      .from('meeting_schedule')
      .update({ ...patch, meeting_id: null, updated_by: actor, updated_date: now })
      .eq('meeting_sched_id', existing.meeting_sched_id);
  } else {
    await supabase.from('meeting_schedule').insert({
      report_id: reportId,
      ...patch,
      created_by: actor,
      created_date: now,
    });
  }
}

/**
 * Request Approval — transitions the report to Pending and flips lead_request.
 * Also nudges the lead stage to "New Meeting" (stage_id 3) per the spec, and logs
 * a system activity entry. After this, the form is treated as locked by the UI.
 */
export async function requestApproval(
  reportId: number,
  leadId: number,
  actor: string
): Promise<{ error: string } | null> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('lead_report')
    .update({
      report_approval: 'Pending',
      report_status: 'New Meeting',
      stage_id: 3, // New Meeting
      lead_request: true,
      updated_by: actor,
      updated_date: now,
    })
    .eq('report_id', reportId);
  if (error) return { error: humanizeWriteError(error) ?? error.message };
  await logSystemActivity(leadId, 'Lead report shared for approval.', actor);
  return null;
}

/**
 * True once the report can no longer be edited.
 * Locked while awaiting/holding a decision: Pending / Request Sent / Approved.
 * A REJECTED report stays editable so the agent can fix it and re-Request Approval
 * (the rejection banner + notification both promise an "edit and resubmit" flow).
 */
export function isReportLocked(approval: string | null): boolean {
  const a = (approval ?? '').toLowerCase();
  return a === 'pending' || a === 'request sent' || a === 'approved';
}

/* ─────────────────────── MEETING TAB ─────────────────────── */

/** The meeting attached to this lead's report (if any), plus its participants. */
export async function fetchLeadMeeting(reportId: number | null): Promise<{
  meeting: MeetingRow | null;
  participants: string[];
} | null> {
  if (!reportId) return { meeting: null, participants: [] };

  const { data: sched } = await supabase
    .from('meeting_schedule')
    .select('meeting_id')
    .eq('report_id', reportId)
    .is('deleted_date', null)
    .not('meeting_id', 'is', null)
    .order('meeting_sched_id', { ascending: false })
    .limit(1)
    .maybeSingle();

  const meetingId = (sched as { meeting_id: number } | null)?.meeting_id;
  if (!meetingId) return { meeting: null, participants: [] };

  const [mRes, pRes] = await Promise.all([
    supabase
      .from('meeting_master')
      .select(
        'meeting_id, meeting_name, meeting_mode, meeting_date, meeting_time, duration, meeting_url, call_recording, share_point_url, description, meeting_status, status, meeting_confirm, agent_feedback, reason'
      )
      .eq('meeting_id', meetingId)
      .maybeSingle(),
    supabase
      .from('meeting_participant')
      .select('participant')
      .eq('meeting_id', meetingId)
      .is('deleted_date', null),
  ]);

  const meeting = (mRes.data as MeetingRow | null) ?? null;
  const participants = ((pRes.data ?? []) as { participant: string }[]).map((p) => p.participant).filter(Boolean);
  return { meeting, participants };
}

/** Add / update the live meeting link (URL / phone / address). */
export async function updateMeetingUrl(
  meetingId: number,
  url: string,
  actor: string
): Promise<{ error: string } | null> {
  const { error } = await supabase
    .from('meeting_master')
    .update({ meeting_url: url.trim(), updated_by: actor, updated_date: new Date().toISOString() })
    .eq('meeting_id', meetingId);
  if (error) return { error: humanizeWriteError(error) ?? error.message };
  return null;
}

/** Statuses for which "confirm by prospect" still makes sense (meeting not concluded). */
const CONFIRMABLE_STATUSES = new Set(['scheduled', 'rescheduled', 'confirmed']);
/** Stages at/after which we must NOT regress to "Meeting Confirmed" (5). */
const TERMINAL_OR_AHEAD_STAGES = new Set([6, 8, 9, 10, 13, 14, 15]);

/**
 * Mark "Meeting confirmed by prospect" — one-way (matches old code) + stage 5.
 * Guarded: refuses to confirm a meeting that has already concluded/cancelled
 * (Completed / Missed / Cancelled / blank), and never regresses a lead that is
 * already at or beyond "Meeting Successful" back to "Meeting Confirmed".
 */
export async function confirmMeeting(
  meetingId: number,
  reportId: number | null,
  actor: string
): Promise<{ error: string } | null> {
  const now = new Date().toISOString();

  // Status guard — read current status before mutating.
  const { data: mRow } = await supabase
    .from('meeting_master')
    .select('meeting_status, status, meeting_confirm')
    .eq('meeting_id', meetingId)
    .maybeSingle();
  const m = (mRow as { meeting_status: string | null; status: string | null; meeting_confirm: boolean | null } | null);
  if (m?.meeting_confirm) return null; // already confirmed — one-way, no-op
  const effectiveStatus = (m?.status || m?.meeting_status || '').trim().toLowerCase();
  if (effectiveStatus && !CONFIRMABLE_STATUSES.has(effectiveStatus)) {
    return { error: 'This meeting has already concluded and can no longer be confirmed.' };
  }

  const { error } = await supabase
    .from('meeting_master')
    .update({ meeting_confirm: true, updated_by: actor, updated_date: now })
    .eq('meeting_id', meetingId);
  if (error) return { error: humanizeWriteError(error) ?? error.message };

  // Move lead to "Meeting Confirmed" (stage_id 5) — but never regress a lead that
  // has already progressed to/past "Meeting Successful" or a terminal/cancelled stage.
  if (reportId) {
    const { data: rpt } = await supabase
      .from('lead_report')
      .select('stage_id')
      .eq('report_id', reportId)
      .maybeSingle();
    const currentStage = (rpt as { stage_id: number | null } | null)?.stage_id ?? null;
    if (currentStage == null || !TERMINAL_OR_AHEAD_STAGES.has(currentStage)) {
      await supabase
        .from('lead_report')
        .update({ stage_id: 5, report_status: 'Meeting Confirmed', updated_by: actor, updated_date: now })
        .eq('report_id', reportId);
    }
  }
  return null;
}

/** Save the agent's feedback (single textarea; locks after first save in UI). */
export async function saveAgentFeedback(
  meetingId: number,
  feedback: string,
  actor: string
): Promise<{ error: string } | null> {
  const { error } = await supabase
    .from('meeting_master')
    .update({ agent_feedback: feedback.trim(), updated_by: actor, updated_date: new Date().toISOString() })
    .eq('meeting_id', meetingId);
  if (error) return { error: humanizeWriteError(error) ?? error.message };
  return null;
}

/** "Postponed by" / "Cancelled by" option sets (from old code id maps). */
export const POSTPONED_BY = [
  { value: 'Lead', label: 'Lead' },
  { value: 'Salesperson', label: 'Salesperson' },
];
export const CANCELLED_BY = [
  { value: 'Altleads', label: 'Altleads / Amplior' },
  { value: 'Sales Team', label: 'Sales Team' },
  { value: 'Lead', label: 'Lead' },
];

/**
 * Reschedule or cancel a meeting.
 *
 * IMPLEMENTED (best-effort):
 *  - reschedule -> update meeting_master date/time/duration + status, write reason,
 *    set the lead stage to the matching "postponed by ..." stage.
 *  - cancel     -> update meeting_master.status = 'Cancelled' + reason, set the lead
 *    stage to the matching "cancelled by ..." stage.
 *
 * TODO / UNCERTAIN:
 *  - The old DB has a dedicated `meeting_reschedule` history table (not in the table
 *    set I was asked to wire). For a first version we record the latest reason on
 *    meeting_master.reason and move the stage; a full reschedule HISTORY trail is a
 *    follow-up. Confirm whether each reschedule must be journaled separately.
 *  - Stage-id mapping below is a best guess from stage_master names; verify the exact
 *    intended stage for each postponed/cancelled-by option with the owner.
 */
export async function updateMeeting(input: {
  meetingId: number;
  reportId: number | null;
  action: 'reschedule' | 'cancel';
  by: string; // postponed-by / cancelled-by value
  reason: string;
  newDate?: string;
  newTime?: string;
  newDuration?: string;
  actor: string;
}): Promise<{ error: string } | null> {
  const now = new Date().toISOString();
  const { meetingId, action, by, reason, actor } = input;

  if (action === 'reschedule') {
    const patch: Record<string, unknown> = {
      status: 'Rescheduled',
      meeting_status: 'Rescheduled',
      reason: reason.trim() || null,
      updated_by: actor,
      updated_date: now,
    };
    if (input.newDate) patch.meeting_date = input.newDate;
    if (input.newTime) patch.meeting_time = input.newTime;
    if (input.newDuration) patch.duration = input.newDuration;
    const { error } = await supabase.from('meeting_master').update(patch).eq('meeting_id', meetingId);
    if (error) return { error: humanizeWriteError(error) ?? error.message };

    // Stage: "Meeting postponed by lead" (12) vs "Meeting postponed by Salesperson" (11)
    const stageId = by === 'Salesperson' ? 11 : 12;
    if (input.reportId) {
      await supabase
        .from('lead_report')
        .update({ stage_id: stageId, updated_by: actor, updated_date: now })
        .eq('report_id', input.reportId);
    }
  } else {
    const { error } = await supabase
      .from('meeting_master')
      .update({
        status: 'Cancelled',
        meeting_status: 'Cancelled',
        reason: reason.trim() || null,
        updated_by: actor,
        updated_date: now,
      })
      .eq('meeting_id', meetingId);
    if (error) return { error: humanizeWriteError(error) ?? error.message };

    // Stage: cancelled by Altleads (13) / sales team (14) / Lead (15)
    const stageId = by === 'Sales Team' ? 14 : by === 'Lead' ? 15 : 13;
    if (input.reportId) {
      await supabase
        .from('lead_report')
        .update({ stage_id: stageId, updated_by: actor, updated_date: now })
        .eq('report_id', input.reportId);
    }
  }
  return null;
}

/**
 * Upcoming + past meetings scoped to a SPECIFIC LEAD.
 *
 * Gathering path: lead_id → lead_report (for this lead) → meeting_schedule
 * → meeting_master. Only meetings whose schedule row links to this lead's
 * report(s) are returned. This replaces the old "all my meetings" approach
 * which incorrectly showed meetings from every lead the user owns.
 */
export async function fetchLeadMeetings(leadId: number): Promise<{
  upcoming: MeetingListItem[];
  past: MeetingListItem[];
  meetingIds: number[];
}> {
  // 1) get all report_ids for this lead
  const { data: reports } = await supabase
    .from('lead_report')
    .select('report_id')
    .eq('lead_id', leadId)
    .is('deleted_date', null);

  const reportRows = (reports ?? []) as { report_id: number }[];
  if (reportRows.length === 0) return { upcoming: [], past: [], meetingIds: [] };
  const reportIds = reportRows.map((r) => r.report_id);

  // 2) meeting_schedule rows for these reports
  const { data: scheds } = await supabase
    .from('meeting_schedule')
    .select('meeting_id')
    .in('report_id', reportIds)
    .not('meeting_id', 'is', null)
    .is('deleted_date', null);

  const schedRows = (scheds ?? []) as { meeting_id: number }[];
  if (schedRows.length === 0) return { upcoming: [], past: [], meetingIds: [] };
  const meetingIds = [...new Set(schedRows.map((s) => s.meeting_id))];

  // 3) fetch just these meetings
  const { data: meetings } = await supabase
    .from('meeting_master')
    .select(
      'meeting_id, meeting_name, meeting_mode, meeting_date, meeting_time, duration, meeting_url, call_recording, share_point_url, description, meeting_status, status, meeting_confirm, agent_feedback, reason'
    )
    .in('meeting_id', meetingIds)
    .is('deleted_date', null)
    .order('meeting_date', { ascending: false, nullsFirst: false });

  const mRows = (meetings ?? []) as MeetingRow[];

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const upcoming: MeetingListItem[] = [];
  const past: MeetingListItem[] = [];
  for (const m of mRows) {
    const item: MeetingListItem = { ...m, lead_id: leadId, lead_name: '' };
    const dateStr = (m.meeting_date ?? '').slice(0, 10);
    if (dateStr && dateStr >= todayStr) upcoming.push(item);
    else past.push(item);
  }
  upcoming.sort((a, b) => (a.meeting_date ?? '').localeCompare(b.meeting_date ?? ''));
  return { upcoming, past, meetingIds };
}

/* ─────────────────────────── CLINCH / CLOSE ─────────────────────────── */

/**
 * Clinch the deal. Only meant to be callable when the stage is "Meeting Successful".
 *
 * IMPLEMENTED: marks lead_master.is_closed = true + logs a system activity entry.
 *
 * TODO / UNCERTAIN: the old system also populates a "Closed Deal" record that feeds
 * the Sales Head mobile dashboard. The exact target table for that closed-deal record
 * is not in the table set I was asked to wire, so it is NOT written here — only the
 * lead is flagged closed. Confirm the closed-deal table with the owner before relying
 * on dashboards that read it.
 */
export async function clinchLead(leadId: number, actor: string): Promise<{ error: string } | null> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('lead_master')
    .update({ is_closed: true, updated_by: actor, updated_date: now })
    .eq('lead_id', leadId);
  if (error) return { error: humanizeWriteError(error) ?? error.message };
  await logSystemActivity(leadId, 'Deal clinched (closed).', actor);
  return null;
}

/* ─────────────── MEETING TAB: feedback (read-only SP + agent) ─────────────── */

export async function fetchFeedbackQuestions(): Promise<FeedbackQuestion[]> {
  const { data } = await supabase
    .from('feedback_question_master')
    .select('feed_que_id, feed_que')
    .is('deleted_date', null)
    .order('feed_que_id');
  return ((data ?? []) as FeedbackQuestion[]);
}

export async function fetchFeedbackAnswers(meetingId: number): Promise<FeedbackAnswerRow[]> {
  const { data } = await supabase
    .from('feedback_answer')
    .select('feed_que_id, feed_ans')
    .eq('meeting_id', meetingId)
    .is('deleted_date', null);
  return ((data ?? []) as FeedbackAnswerRow[]);
}

/* ─────────────── MEETING TAB: feedback WRITE (submit) ─────────────── */

/**
 * Decide whether a feedback question is FREE-TEXT (textarea) vs a Yes/No toggle.
 *
 * The vendor mobile app hard-coded `feed_que_id === 7` as the only free-text
 * ("discussion / comments") question. We deliberately do NOT hard-code the id —
 * questions are server-driven and could be re-numbered. Instead we treat a
 * question as free-text when its WORDING implies a written answer (discussion /
 * comment / note / detail / remark / suggestion / "please specify", etc.). The
 * legacy id 7 is kept only as a last-resort fallback so existing data still
 * renders a textarea even if the master question text is ever changed.
 *
 * If a future schema adds an explicit flag column (e.g. `is_free_text`/`answer_type`)
 * on feedback_question_master, prefer that here over the keyword heuristic.
 */
const FREE_TEXT_QUESTION_KEYWORDS = [
  'discuss',
  'comment',
  'remark',
  'note',
  'detail',
  'suggest',
  'feedback',
  'describe',
  'explain',
  'specify',
  'elaborate',
  'other',
  'reason',
];

export function isFreeTextQuestion(q: FeedbackQuestion): boolean {
  const text = (q.feed_que ?? '').toLowerCase();
  if (FREE_TEXT_QUESTION_KEYWORDS.some((kw) => text.includes(kw))) return true;
  // Last-resort fallback: the vendor's legacy free-text question id.
  return q.feed_que_id === 7;
}

export interface FeedbackAnswerInput {
  feed_que_id: number;
  feed_ans: string;
}

/**
 * Submit the "Successful" meeting outcome: persist one feedback_answer row per
 * question, then mark the meeting Completed and stamp the follow-up date.
 *
 * UPSERT semantics: feedback_answer has NO unique constraint on
 * (meeting_id, feed_que_id) — only a serial PK (feed_ans_id) — so PostgREST
 * `upsert(onConflict)` is not usable. We instead read the live rows for this
 * meeting and UPDATE the ones that already exist (keyed by meeting_id +
 * feed_que_id) / INSERT the rest. Audit columns are written as TEXT user_id,
 * matching projectStatus.ts and the existing meeting writers.
 *
 * Reschedule / Cancel are NOT handled here — the UI reuses the existing
 * `updateMeeting()` flow for those outcomes.
 *
 * Returns { error } on failure; a Postgres 42501 (RLS) is surfaced as a friendly
 * message, mirroring data/projectStatus.ts.
 */
export async function submitMeetingFeedback(params: {
  meetingId: number;
  answers: FeedbackAnswerInput[];
  followUpDate?: string | null;
  actorId: string;
}): Promise<{ error: string | null }> {
  const { meetingId, answers, followUpDate, actorId } = params;
  const now = new Date().toISOString();

  const friendly = (err: { code?: string; message: string }): string =>
    err.code === '42501'
      ? 'You can only submit feedback for meetings assigned to you (ask an admin or the owner’s manager).'
      : (humanizeWriteError(err) ?? err.message);

  // 1) Read existing answers so we update-in-place rather than duplicate rows.
  const { data: existingRaw, error: readErr } = await supabase
    .from('feedback_answer')
    .select('feed_ans_id, feed_que_id')
    .eq('meeting_id', meetingId)
    .is('deleted_date', null);
  if (readErr) return { error: friendly(readErr) };
  const existingByQue = new Map<number, number>(); // feed_que_id -> feed_ans_id
  ((existingRaw ?? []) as { feed_ans_id: number; feed_que_id: number }[]).forEach((r) =>
    existingByQue.set(r.feed_que_id, r.feed_ans_id)
  );

  // 2) Update existing rows / collect new rows to insert.
  const toInsert: Record<string, unknown>[] = [];
  for (const a of answers) {
    // feed_ans is NOT NULL in the schema; never write a null/blank-as-null.
    const ans = (a.feed_ans ?? '').trim();
    const existingId = existingByQue.get(a.feed_que_id);
    if (existingId != null) {
      const { error } = await supabase
        .from('feedback_answer')
        .update({ feed_ans: ans, updated_by: actorId, updated_date: now })
        .eq('feed_ans_id', existingId);
      if (error) return { error: friendly(error) };
    } else {
      toInsert.push({
        meeting_id: meetingId,
        feed_que_id: a.feed_que_id,
        feed_ans: ans,
        created_by: actorId,
        created_date: now,
      });
    }
  }
  if (toInsert.length > 0) {
    const { error } = await supabase.from('feedback_answer').insert(toInsert);
    if (error) return { error: friendly(error) };
  }

  // 3) Mark the meeting Completed + stamp the follow-up date.
  const patch: Record<string, unknown> = {
    meeting_status: 'Completed',
    updated_by: actorId,
    updated_date: now,
  };
  if (followUpDate !== undefined) patch.follow_up_date = followUpDate || null;
  const { error: mErr } = await supabase
    .from('meeting_master')
    .update(patch)
    .eq('meeting_id', meetingId);
  if (mErr) return { error: friendly(mErr) };

  return { error: null };
}
