/**
 * approvals.ts — data layer for the Lead Report Approval flow.
 *
 * DB facts confirmed against live schema:
 *  - stage_master: stage_id 4 = "Meeting Scheduled"
 *                  stage_id 6 = "Meeting Droped By Amplior" (reject target)
 *                  stage_id 3 = "New Meeting" (set by requestApproval in leadWorkspace.ts)
 *  - in_app_notification columns: notification_id (bigint PK), created_by, created_date,
 *    deleted_by, deleted_date, updated_by, updated_date, is_seen (bool),
 *    lead_number (varchar), notif_descr (varchar), route (varchar), status (varchar),
 *    lead_id (bigint), report_id (bigint), meeting_id (bigint), user_id (bigint)
 *
 * Stage-ID constants (DB values, not FRS numbering):
 *   STAGE_MEETING_SCHEDULED = 4
 *   STAGE_MEETING_DROPPED_BY_AMPLIOR = 6
 */

import { supabase } from '../lib/supabase';
import { logSystemActivity } from './leadWorkspace';
import { notify, resolveUserEmailAndName } from '../lib/notify';
import { humanizeWriteError } from '../lib/writeError';

/* ─────────────────────────── Types ─────────────────────────── */

export interface PendingApprovalRow {
  report_id: number;
  lead_id: number;
  lead_name: string;
  lead_number: string | null;
  client_name: string;
  requesting_agent_id: string | null;
  requesting_agent_name: string;
  assigned_sp_id: number | null;
  assigned_sp_name: string;
  created_date: string | null;
  updated_date: string | null;
  report_status: string | null;
}

export interface ReportDetail {
  report_id: number;
  lead_id: number;
  user_id: number | null; // assigned SP/SH
  assigned_sp_name: string;
  sales_intelligence: string | null;
  report_approval: string | null;
  report_status: string | null;
  pre_sales_answers: { question: string; short_question: string; answer: string }[];
  new_questions: { question: string; answer: string }[];
  meeting: {
    meeting_name: string;
    meeting_mode: string | null;
    meeting_date: string | null;
    meeting_time: string | null;
    duration: string | null;
    description: string | null;
    participants: string[];
  } | null;
}

/* ─────────────── Stage-ID constants ─────────────────────────── */
const STAGE_MEETING_SCHEDULED = 4;
const STAGE_MEETING_DROPPED_BY_AMPLIOR = 6;

/* ─────────────── Notifications helper ───────────────────────── */

/**
 * Write in_app_notification rows for a set of user IDs.
 * Non-fatal: failures are swallowed so they never block the primary action.
 *
 * NOTE: `status` is a human-readable LABEL column (live values 'New Meeting',
 * 'Approved', 'Rejected', NULL) — NOT a read/unread flag. Read state lives in
 * `is_seen`. Each row therefore supplies a meaningful `status` label which the
 * Notifications UI renders as the notification title. `user_id` is the
 * recipient and must always be populated so the notification is visible.
 */
async function createNotifications(rows: {
  user_id: number;
  lead_id: number;
  report_id: number;
  lead_number: string | null;
  status: string;
  notif_descr: string;
  route: string;
  actor: string;
  now: string;
}[]): Promise<void> {
  if (rows.length === 0) return;
  try {
    const inserts = rows
      .filter((r) => r.user_id != null && r.user_id > 0)
      .map((r) => ({
        user_id: r.user_id,
        lead_id: r.lead_id,
        report_id: r.report_id,
        lead_number: r.lead_number ?? null,
        notif_descr: r.notif_descr,
        route: r.route,
        is_seen: false,
        status: r.status,
        created_by: r.actor,
        created_date: r.now,
      }));
    if (inserts.length === 0) return;
    await supabase.from('in_app_notification').insert(inserts);
  } catch {
    /* non-fatal */
  }
}

/* ─────────────── Fetch pending approvals ────────────────────── */

/**
 * All lead_reports with report_approval = 'Pending', enriched with lead,
 * company, agent, and salesperson names.
 */
export async function fetchPendingApprovals(): Promise<PendingApprovalRow[]> {
  // Fetch pending reports
  const { data: reports } = await supabase
    .from('lead_report')
    .select('report_id, lead_id, user_id, created_by, created_date, updated_date, report_status')
    .eq('report_approval', 'Pending')
    .is('deleted_date', null)
    .order('updated_date', { ascending: false, nullsFirst: false })
    .order('created_date', { ascending: false, nullsFirst: false });

  const rows = (reports ?? []) as {
    report_id: number;
    lead_id: number;
    user_id: number | null;
    created_by: string | null;
    created_date: string | null;
    updated_date: string | null;
    report_status: string | null;
  }[];

  if (rows.length === 0) return [];

  // Collect IDs to batch-lookup
  const leadIds = [...new Set(rows.map((r) => r.lead_id))];
  const spIds = [...new Set(rows.map((r) => r.user_id).filter((v): v is number => v != null))];
  const agentIds = [
    ...new Set(rows.map((r) => r.created_by).filter((v): v is string => !!v)),
  ].map(Number).filter((n) => !isNaN(n));

  // Batch fetch leads + their client_assoc_id
  const { data: leads } = await supabase
    .from('lead_master')
    .select('lead_id, lead_name, lead_number, client_assoc_id')
    .in('lead_id', leadIds);

  const leadMap = new Map<number, { lead_name: string; lead_number: string | null; client_assoc_id: number | null }>();
  ((leads ?? []) as { lead_id: number; lead_name: string; lead_number: string | null; client_assoc_id: number | null }[])
    .forEach((l) => leadMap.set(l.lead_id, l));

  // Batch fetch client names
  const clientAssocIds = [
    ...new Set(
      [...leadMap.values()].map((l) => l.client_assoc_id).filter((v): v is number => v != null)
    ),
  ];
  const clientMap = new Map<number, string>();
  if (clientAssocIds.length > 0) {
    const { data: clients } = await supabase
      .from('client_association')
      .select('client_assoc_id, client_name')
      .in('client_assoc_id', clientAssocIds);
    ((clients ?? []) as { client_assoc_id: number; client_name: string }[]).forEach((c) =>
      clientMap.set(c.client_assoc_id, c.client_name ?? '')
    );
  }

  // Batch fetch user names (agents + SPs)
  const allUserIds = [...new Set([...agentIds, ...spIds])].filter((n) => n > 0);
  const userMap = new Map<number, string>();
  if (allUserIds.length > 0) {
    const { data: users } = await supabase
      .from('user_master')
      .select('user_id, full_name')
      .in('user_id', allUserIds);
    ((users ?? []) as { user_id: number; full_name: string }[]).forEach((u) =>
      userMap.set(u.user_id, u.full_name ?? '')
    );
  }

  return rows.map((r) => {
    const lead = leadMap.get(r.lead_id);
    const clientAssocId = lead?.client_assoc_id ?? null;
    const agentNumId = r.created_by ? Number(r.created_by) : NaN;
    return {
      report_id: r.report_id,
      lead_id: r.lead_id,
      lead_name: lead?.lead_name ?? '',
      lead_number: lead?.lead_number ?? null,
      client_name: clientAssocId ? clientMap.get(clientAssocId) ?? '' : '',
      requesting_agent_id: r.created_by ?? null,
      requesting_agent_name: !isNaN(agentNumId) ? userMap.get(agentNumId) ?? r.created_by ?? '' : r.created_by ?? '',
      assigned_sp_id: r.user_id ?? null,
      assigned_sp_name: r.user_id ? userMap.get(r.user_id) ?? '' : '',
      created_date: r.created_date ?? null,
      updated_date: r.updated_date ?? null,
      report_status: r.report_status ?? null,
    };
  });
}

/** Count of pending approvals (for the sidebar badge). */
export async function fetchPendingCount(): Promise<number> {
  const { count } = await supabase
    .from('lead_report')
    .select('report_id', { count: 'exact', head: true })
    .eq('report_approval', 'Pending')
    .is('deleted_date', null);
  return count ?? 0;
}

/* ─────────────── Fetch full report detail (for preview modal) ── */

export async function fetchReportDetail(reportId: number): Promise<ReportDetail | null> {
  const { data: lr } = await supabase
    .from('lead_report')
    .select('report_id, lead_id, user_id, sales_intelligence, report_approval, report_status')
    .eq('report_id', reportId)
    .maybeSingle();

  if (!lr) return null;
  const report = lr as {
    report_id: number;
    lead_id: number;
    user_id: number | null;
    sales_intelligence: string | null;
    report_approval: string | null;
    report_status: string | null;
  };

  // SP name
  let spName = '';
  if (report.user_id) {
    const { data: u } = await supabase
      .from('user_master')
      .select('full_name')
      .eq('user_id', report.user_id)
      .maybeSingle();
    spName = (u as { full_name: string } | null)?.full_name ?? '';
  }

  // Pre-sales answers with question text
  const [ansRes, nqRes, schedRes] = await Promise.all([
    supabase
      .from('pre_sales_answer')
      .select('pre_sa_que_id, answer')
      .eq('report_id', reportId)
      .is('deleted_date', null),
    supabase
      .from('new_sales_question')
      .select('question, answer')
      .eq('report_id', reportId)
      .is('deleted_date', null),
    supabase
      .from('meeting_schedule')
      .select('meeting_id')
      .eq('report_id', reportId)
      .not('meeting_id', 'is', null)
      .is('deleted_date', null)
      .order('meeting_sched_id', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const answerRows = (ansRes.data ?? []) as { pre_sa_que_id: number; answer: string }[];
  const questionIds = answerRows.map((a) => a.pre_sa_que_id);
  let questionMap = new Map<number, { question: string; short_question: string }>();
  if (questionIds.length > 0) {
    const { data: qs } = await supabase
      .from('pre_sales_question')
      .select('pre_sa_que_id, question, short_question')
      .in('pre_sa_que_id', questionIds);
    ((qs ?? []) as { pre_sa_que_id: number; question: string; short_question: string }[]).forEach((q) =>
      questionMap.set(q.pre_sa_que_id, { question: q.question ?? '', short_question: q.short_question ?? '' })
    );
  }

  const preSalesAnswers = answerRows.map((a) => {
    const q = questionMap.get(a.pre_sa_que_id) ?? { question: '', short_question: '' };
    return { question: q.question, short_question: q.short_question, answer: a.answer ?? '' };
  });

  const newQuestions = ((nqRes.data ?? []) as { question: string; answer: string }[]).map((n) => ({
    question: n.question ?? '',
    answer: n.answer ?? '',
  }));

  // Meeting details
  let meeting: ReportDetail['meeting'] = null;
  const schedMeetingId = (schedRes.data as { meeting_id: number } | null)?.meeting_id;
  if (schedMeetingId) {
    const [mRes, pRes] = await Promise.all([
      supabase
        .from('meeting_master')
        .select('meeting_name, meeting_mode, meeting_date, meeting_time, duration, description')
        .eq('meeting_id', schedMeetingId)
        .maybeSingle(),
      supabase
        .from('meeting_participant')
        .select('participant')
        .eq('meeting_id', schedMeetingId)
        .is('deleted_date', null),
    ]);
    if (mRes.data) {
      const m = mRes.data as {
        meeting_name: string;
        meeting_mode: string | null;
        meeting_date: string | null;
        meeting_time: string | null;
        duration: string | null;
        description: string | null;
      };
      meeting = {
        meeting_name: m.meeting_name ?? '',
        meeting_mode: m.meeting_mode,
        meeting_date: m.meeting_date,
        meeting_time: m.meeting_time,
        duration: m.duration,
        description: m.description,
        participants: ((pRes.data ?? []) as { participant: string }[]).map((p) => p.participant).filter(Boolean),
      };
    }
  }

  return {
    report_id: report.report_id,
    lead_id: report.lead_id,
    user_id: report.user_id,
    assigned_sp_name: spName,
    sales_intelligence: report.sales_intelligence,
    report_approval: report.report_approval,
    report_status: report.report_status,
    pre_sales_answers: preSalesAnswers,
    new_questions: newQuestions,
    meeting,
  };
}

/* ─────────────── Approve ────────────────────────────────────── */

/**
 * Approve a lead report:
 *  - set report_approval = 'Approved', stage_id = 4 (Meeting Scheduled),
 *    report_status = 'Meeting Scheduled'
 *  - log system activity
 *  - notify requesting agent + assigned salesperson
 */
export async function approveReport(
  reportId: number,
  leadId: number,
  leadName: string,
  leadNumber: string | null,
  agentIdStr: string | null,   // created_by (varchar)
  assignedSpId: number | null, // user_id
  actor: string
): Promise<{ error: string } | null> {
  const now = new Date().toISOString();

  const { data: updated, error } = await supabase
    .from('lead_report')
    .update({
      report_approval: 'Approved',
      stage_id: STAGE_MEETING_SCHEDULED,
      report_status: 'Meeting Scheduled',
      updated_by: actor,
      updated_date: now,
    })
    .eq('report_id', reportId)
    .eq('report_approval', 'Pending') // optimistic guard: only act on still-pending rows
    .select('report_id');

  if (error) return { error: humanizeWriteError(error) ?? error.message };
  if (!updated || updated.length === 0) {
    return { error: 'This report has already been processed.' };
  }

  await logSystemActivity(leadId, 'Lead report approved. Stage: Meeting Scheduled.', actor);

  // Notify agent + SP
  const notifyUserIds: number[] = [];
  const agentNumId = agentIdStr ? Number(agentIdStr) : NaN;
  if (!isNaN(agentNumId) && agentNumId > 0) notifyUserIds.push(agentNumId);
  if (assignedSpId && !notifyUserIds.includes(assignedSpId)) notifyUserIds.push(assignedSpId);

  const actorNum = Number(actor);
  const recipients = Number.isNaN(actorNum) ? notifyUserIds : notifyUserIds.filter((id) => id !== actorNum);

  const route = `/leads/${leadId}`;
  const descr = `Your lead report for "${leadName}" was approved — meeting scheduled.`;
  await createNotifications(
    recipients.map((uid) => ({
      user_id: uid,
      lead_id: leadId,
      report_id: reportId,
      lead_number: leadNumber,
      status: 'Approved',
      notif_descr: descr,
      route,
      actor,
      now,
    }))
  );

  // Fire-and-forget: send approval email to agent + SP
  (async () => {
    try {
      const approverInfo = await resolveUserEmailAndName(supabase, Number(actor));
      const eventData = {
        leadName,
        leadNumber: leadNumber ?? '',
        approvedByName: approverInfo.name || actor,
      };
      for (const uid of recipients) {
        const { email } = await resolveUserEmailAndName(supabase, uid);
        if (email) await notify('approval_approved', email, eventData);
      }
    } catch {
      /* non-fatal */
    }
  })();

  return null;
}

/* ─────────────── Reject ─────────────────────────────────────── */

/**
 * Reject a lead report:
 *  - stage_id = 6 (Meeting Droped By Amplior), report_approval = 'Rejected',
 *    report_status stores the rejection reason
 *  - log system activity
 *  - notify requesting agent with reason
 */
export async function rejectReport(
  reportId: number,
  leadId: number,
  leadName: string,
  leadNumber: string | null,
  agentIdStr: string | null,
  reason: string,
  actor: string
): Promise<{ error: string } | null> {
  const now = new Date().toISOString();
  const trimmedReason = reason.trim();
  if (!trimmedReason) return { error: 'A rejection reason is required.' };

  // `lead_report` has no dedicated rejection-reason column, so the reason is
  // recorded via the system activity log below and the rejection notification.
  // Keep `report_status` to a short canonical value so any status-chip consumer
  // renders cleanly and we never risk overflowing the varchar with a long reason.
  const { data: updated, error } = await supabase
    .from('lead_report')
    .update({
      report_approval: 'Rejected',
      stage_id: STAGE_MEETING_DROPPED_BY_AMPLIOR,
      report_status: 'Rejected',
      updated_by: actor,
      updated_date: now,
    })
    .eq('report_id', reportId)
    .eq('report_approval', 'Pending') // optimistic guard: only act on still-pending rows
    .select('report_id');

  if (error) return { error: humanizeWriteError(error) ?? error.message };
  if (!updated || updated.length === 0) {
    return { error: 'This report has already been processed.' };
  }

  await logSystemActivity(
    leadId,
    `Lead report rejected. Reason: ${trimmedReason}. Stage: Meeting Dropped by Amplior.`,
    actor
  );

  // Notify the requesting agent
  const agentNumId = agentIdStr ? Number(agentIdStr) : NaN;
  if (!isNaN(agentNumId) && agentNumId > 0) {
    await createNotifications([
      {
        user_id: agentNumId,
        lead_id: leadId,
        report_id: reportId,
        lead_number: leadNumber,
        status: 'Rejected',
        notif_descr: `Your lead report for "${leadName}" was rejected: ${trimmedReason} — please edit and resubmit.`,
        route: `/leads/${leadId}`,
        actor,
        now,
      },
    ]);

    // Fire-and-forget: send rejection email to agent
    (async () => {
      try {
        const rejectorInfo = await resolveUserEmailAndName(supabase, Number(actor));
        const { email: agentEmail } = await resolveUserEmailAndName(supabase, agentNumId);
        if (agentEmail) {
          await notify('approval_rejected', agentEmail, {
            leadName,
            leadNumber: leadNumber ?? '',
            reason: trimmedReason,
            rejectedByName: rejectorInfo.name || actor,
          });
        }
      } catch {
        /* non-fatal */
      }
    })();
  }

  return null;
}

/* ─────────────── Notify TL/Admin on approval request ───────── */

/**
 * Called from the "Request Approval" action in ReportTab.
 * Sends in_app_notification to the project's Team Leads / Admins plus the
 * system admin, resolving recipients from the role tables that actually back
 * those roles (`project_user`) rather than the sparse `profiles` table (which
 * holds only the single ADMIN and would leave Team Leads un-notified).
 */
export async function notifyApproversOfRequest(
  reportId: number,
  leadId: number,
  leadName: string,
  leadNumber: string | null,
  projectId: number | null,
  actor: string
): Promise<void> {
  const now = new Date().toISOString();

  const approverIdSet = new Set<number>();

  // Primary: the project's Team Leads and Admins from project_user (the role
  // table that actually backs these roles with usable user_ids).
  if (projectId) {
    const { data: puRows } = await supabase
      .from('project_user')
      .select('user_id')
      .eq('project_id', projectId)
      .in('role_name', ['TEAM_LEAD', 'ADMIN'])
      .is('deleted_date', null);
    ((puRows ?? []) as { user_id: number | null }[]).forEach((r) => {
      if (r.user_id != null) approverIdSet.add(r.user_id);
    });
  }

  // Always include the system admin(s) so the request is actionable even when
  // the project has no Team Lead assigned.
  const { data: adminRows } = await supabase
    .from('profiles')
    .select('user_id')
    .in('role', ['ADMIN', 'TEAM_LEAD']);
  ((adminRows ?? []) as { user_id: number | null }[]).forEach((r) => {
    if (r.user_id != null) approverIdSet.add(r.user_id);
  });

  const approverIds = [...approverIdSet];
  if (approverIds.length === 0) return;

  const descr = `New lead report awaiting approval: "${leadName}"`;
  const route = `/approvals`;
  await createNotifications(
    approverIds.map((uid) => ({
      user_id: uid,
      lead_id: leadId,
      report_id: reportId,
      lead_number: leadNumber,
      status: 'Approval Requested',
      notif_descr: descr,
      route,
      actor,
      now,
    }))
  );

  // Fire-and-forget: send approval-request email to all TL/Admin approvers
  (async () => {
    try {
      const agentInfo = await resolveUserEmailAndName(supabase, Number(actor));
      const eventData = {
        leadName,
        leadNumber: leadNumber ?? '',
        agentName: agentInfo.name || actor,
      };
      for (const uid of approverIds) {
        const { email } = await resolveUserEmailAndName(supabase, uid);
        if (email) await notify('approval_requested', email, eventData);
      }
    } catch {
      /* non-fatal */
    }
  })();
}
