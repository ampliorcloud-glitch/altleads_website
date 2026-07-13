/**
 * Real data types, fetchers and writers for the Meetings module (internal web).
 *
 * Join chain (all verified against the live DB — see REBUILD_LOG):
 *   meeting_master       — core record: meeting_id, meeting_name, meeting_date, meeting_time,
 *                          meeting_mode, meeting_status, duration, follow_up_date, meeting_url,
 *                          agent_feedback, description (agenda), reason, call_recording,
 *                          share_point_url, meeting_confirm, created_date.
 *                          NOTE: the live status lives in `meeting_status`; the `status`
 *                          column is always null and is NOT used here.
 *   meeting_schedule     — bridge: meeting_id <-> report_id (+ tentative follow-up date).
 *   lead_report          — report_id -> lead_id, user_id (the ASSIGNED SALESPERSON/HEAD), stage_id.
 *   lead_master          — lead_name, company_id (the PROSPECT company, NULL for ~79% of leads),
 *                          client_assoc_id (the Amplior CLIENT / account), address_id, agent_id
 *                          (the Amplior agent/owner), mobile_no, email, designation, lead_number,
 *                          created_date (the lead-generation date).
 *   company_master       — prospect company: company_name (only when company_id is set).
 *   client_association   — Amplior client/account: client_name + industry_id.
 *   industry_master      — industry_name (by client_association.industry_id — same as the Leads
 *                          module; company_master is NOT used for industry).
 *   address_master       — city_id (by lead_master.address_id).
 *   city_master          — city_name (by address_master.city_id — same as the Leads module).
 *
 *   COMPANY/INDUSTRY/CITY RESOLUTION (must match src/data/realLeads.ts):
 *     - Company  : company_master.company_name WHEN lead_master.company_id is present,
 *                  otherwise client_association.client_name (which is what the Leads list shows).
 *                  ~79% of leads have NULL company_id, so most rows display the client_name.
 *     - Industry : client_association.industry_id -> industry_master.industry_name.
 *     - City     : lead_master.address_id -> address_master.city_id -> city_master.city_name.
 *   (Reading these from company_master.company_id alone left them blank for ~78% of meetings.)
 *   user_master          — full_name (agent + salesperson); user_role.role_id 4=SALES_HEAD, 5=SALES_PERSON.
 *   stage_master         — stage label (by lead_report.stage_id).
 *   meeting_participant  — participant (email/name) keyed by meeting_id.
 *   meeting_reschedule   — reschedule/cancel HISTORY keyed by meeting_id (resone, meeting_date,
 *                          meeting_time, duration, meeting_status).
 *   feedback_answer      — feed_ans keyed by meeting_id; question text via feedback_question_master.
 *   pre_sales_answer     — answer keyed by report_id; question text via pre_sales_question.
 *
 * RLS is OFF in this preview, so the authenticated client can read every row.
 * Queries are split per table and joined in JS so they work regardless of FK enforcement.
 */

import { supabase } from '../lib/supabase';
import { humanizeWriteError } from '../lib/writeError';
import {
  concurrencyPrecondition,
  makeConflict,
  type ConflictResult,
} from '../lib/concurrency';

/* ------------------------------------------------------------------ */
/* OWNER-DEFAULT decisions baked into this module                      */
/* ------------------------------------------------------------------ */

/** OWNER-DEFAULT: meeting modes = Telephonic / Online / Offline (3). (Open Q#5) */
export const MEETING_MODES = ['Telephonic', 'Online', 'Offline'] as const;

/**
 * OWNER-DEFAULT: meeting status model used across this module (Open Q#10).
 *  - Scheduled   — meeting created from an approved report (default).
 *  - Confirmed   — prospect confirmed (meeting_confirm = true).
 *  - Rescheduled — a reschedule was recorded (history row written).
 *  - Cancelled   — a cancel/drop was recorded.
 *  - Completed   — set from mobile when the salesperson marks it held (unlocks feedback).
 *  - Missed      — time passed without completion. NOT automated here (no cron yet) —
 *                  see the TODO in markMissed(); a scheduled job is required.
 */
export const MEETING_STATUSES = [
  'Scheduled',
  'Confirmed',
  'Rescheduled',
  'Cancelled',
  'Completed',
  'Missed',
] as const;

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
 * Stage-id mapping (verified against stage_master):
 *  11 = Meeting postponed by Salesperson, 12 = Meeting postponed by lead,
 *  13 = Meeting cancelled by Altleads, 14 = Meeting cancelled by sales team,
 *  15 = Meeting cancelled by Lead.
 * Kept consistent with src/data/leadWorkspace.ts updateMeeting().
 */
function rescheduleStageId(by: string): number {
  return by === 'Salesperson' ? 11 : 12;
}
function cancelStageId(by: string): number {
  return by === 'Sales Team' ? 14 : by === 'Lead' ? 15 : 13;
}

/**
 * Canonical report_status text for each stage_id (must mirror stage_master.stage).
 * Used to keep lead_report.report_status in sync with stage_id on reschedule/cancel
 * (confirmMeeting already keeps both in sync; this closes the same gap for the other writers).
 */
const STAGE_LABEL: Record<number, string> = {
  11: 'Meeting postponed by Salesperson',
  12: 'Meeting postponed by lead',
  13: 'Meeting cancelled by Altleads',
  14: 'Meeting cancelled by sales team',
  15: 'Meeting cancelled by Lead',
};

/* ------------------------------------------------------------------ */
/* Public types                                                        */
/* ------------------------------------------------------------------ */

export interface MeetingRow {
  id: string;            // meeting_id as string
  name: string;          // meeting_name
  leadId: string | null; // lead_id (for navigation)
  leadNumber: string;    // ALT123456
  leadName: string;
  /** Numeric project id of the meeting's lead (lead_master.project_id) — for project scoping. */
  projectId: number | null;
  company: string;       // prospect company (company_master)
  client: string;        // Amplior client (client_association)
  industry: string;      // prospect company industry
  city: string;          // prospect company city
  agent: string;         // Amplior agent (owner)
  salesperson: string;   // assigned SP/SH (with (SP)/(SH) suffix)
  contact: string;       // lead mobile
  leadStage: string;     // lead_report stage label
  leadGenDate: string | null; // lead_master.created_date (date-only)
  confirmed: boolean;    // meeting_confirm
  meetingDate: string | null; // 'YYYY-MM-DD'
  meetingTime: string;        // 'HH:MM' (raw, normalised)
  mode: string;               // Online / Offline / Telephonic
  status: string;             // Scheduled / Confirmed / Completed / Missed / ...
}

export interface MeetingsResult {
  meetings: MeetingRow[];
  agents: string[];
  salespeople: string[];
  statuses: string[];
  modes: string[];
  industries: string[];
  cities: string[];
  truncated: boolean; // true when the meeting list hit the hard cap and older rows were dropped
  error: string | null;
}

export interface MeetingParticipant {
  id: number;
  participant: string;
}

export interface FeedbackItem {
  question: string;
  answer: string;
}

export interface PreSalesItem {
  question: string;
  answer: string;
}

export interface RescheduleHistoryItem {
  id: number;
  date: string | null;
  time: string;
  duration: string;
  status: string;
  reason: string;
  createdDate: string | null;
}

export interface MeetingDetail {
  id: string;
  reportId: number | null;
  name: string;
  meetingDate: string | null;
  meetingTime: string;
  mode: string;
  status: string;
  duration: string;
  followUpDate: string | null;
  meetingUrl: string;
  callRecording: string;
  sharePointUrl: string;
  description: string; // agenda
  reason: string;
  agentFeedback: string;
  confirmed: boolean;
  createdDate: string | null;
  // related lead
  leadId: string | null;
  leadNumber: string;
  leadName: string;
  leadEmail: string;
  leadMobile: string;
  leadDesignation: string;
  leadStage: string;
  company: string;
  client: string;
  industry: string;
  city: string;
  agent: string;
  salesperson: string;
  salespersonUserId: number | null;  // numeric user_id for the assigned SP (for notifications)
  // ── ALT-275: extra fields for the "mobile-ditto" sales/portal meeting record ──
  // Lead/contact extras (lead_master)
  leadAltMobile: string;
  leadLinkedin: string;
  leadRoleAndResp: string;
  leadAreaOfInterest: string;
  // Opportunity (lead_master)
  oppTitle: string;
  oppValue: string;        // raw value as text, '' when unset
  oppDescription: string;
  // Sales intelligence + who scheduled (lead_report)
  salesIntelligence: string;
  scheduledByName: string; // lead_report.created_by -> user_master.full_name
  // Company extras (company_master, present only when company_id is set)
  companyTurnover: string; // turnover_master.turnover (band label), '' when unset
  companySector: string;   // company_sector.sector, '' when unset
  companySize: string;     // company_master.company_size as text, '' when unset
  companyWebsite: string;  // company_master.company_web_url
  companyLinkedin: string; // company_master.linkedin_url
  // Address (address_master)
  addressLine1: string;
  addressLine2: string;
  // related collections
  participants: MeetingParticipant[];
  feedback: FeedbackItem[];
  preSales: PreSalesItem[];
  history: RescheduleHistoryItem[];
}

export interface MeetingDetailResult {
  meeting: MeetingDetail | null;
  error: string | null;
}

/* ------------------------------------------------------------------ */
/* Internal row shapes                                                 */
/* ------------------------------------------------------------------ */

interface MeetingMasterRow {
  meeting_id: number;
  meeting_name: string | null;
  meeting_date: string | null;
  meeting_time: string | null;
  meeting_mode: string | null;
  meeting_status: string | null;
  duration: string | null;
  follow_up_date: string | null;
  meeting_url: string | null;
  call_recording: string | null;
  share_point_url: string | null;
  description: string | null;
  reason: string | null;
  agent_feedback: string | null;
  meeting_confirm: boolean | null;
  created_date: string | null;
}
interface ScheduleRow { meeting_id: number; report_id: number; }
interface ReportRow {
  report_id: number;
  lead_id: number;
  user_id: number | null;
  stage_id: number | null;
  // ALT-275 extras
  sales_intelligence?: string | null;
  created_by?: string | number | null; // user_id of who scheduled (stored as text/number)
}
interface LeadRow {
  lead_id: number;
  lead_name: string | null;
  lead_number: string | null;
  company_id: number | null;
  client_assoc_id: number | null;
  address_id: number | null;
  agent_id: number | null;
  project_id: number | null;
  email: string | null;
  mobile_no: string | null;
  designation: string | null;
  created_date: string | null;
  // ALT-275 extras
  alt_mobile_no?: string | null;
  linkedin_url?: string | null;
  role_and_resp?: string | null;
  area_of_interest?: string | null;
  title?: string | null;
  value?: string | number | null;
  description?: string | null;
}
interface CompanyRow {
  company_id: number;
  company_name: string | null;
  // ALT-275 extras
  company_size?: number | null;
  company_web_url?: string | null;
  linkedin_url?: string | null;
  turnover_id?: number | null;
  sector_id?: number | null;
}
interface ClientRow { client_assoc_id: number; client_name: string | null; industry_id: number | null; }
interface IndustryRow { industry_id: number; industry_name: string | null; }
interface AddressRow {
  address_id: number;
  city_id: number | null;
  // ALT-275 extras
  address_line1?: string | null;
  address_line2?: string | null;
}
interface CityRow { city_id: number; city_name: string | null; }
interface TurnoverRow { turnover_id: number; turnover: string | null; }
interface SectorRow { sector_id: number; sector: string | null; }
interface StageRow { stage_id: number; stage: string | null; }
interface UserRow { user_id: number; full_name: string | null; }
interface UserRoleRow { user_id: number; role_id: number; }
interface ParticipantRow { mtg_part_id: number; meeting_id: number; participant: string | null; }
interface FeedbackAnswerRow { meeting_id: number; feed_que_id: number; feed_ans: string | null; }
interface FeedbackQuestionRow { feed_que_id: number; feed_que: string | null; }
interface PreSalesAnswerRow { report_id: number; pre_sa_que_id: number; answer: string | null; }
interface PreSalesQuestionRow { pre_sa_que_id: number; short_question: string | null; question: string | null; }
interface RescheduleRow {
  mtg_resch_id: number;
  meeting_id: number;
  meeting_date: string | null;
  meeting_time: string | null;
  duration: string | null;
  meeting_status: string | null;
  resone: string | null;
  new_resone: string | null;
  created_date: string | null;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Normalise '16:16:00' -> '16:16'; leave anything odd as-is. */
function normaliseTime(t: string | null | undefined): string {
  if (!t) return '';
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  if (!m) return t.trim();
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

function dateOnly(s: string | null | undefined): string | null {
  return s ? s.substring(0, 10) : null;
}

/** Suffix a salesperson name with (SH)/(SP) given their highest role. */
function salespersonLabel(name: string, roleId: number | undefined): string {
  if (!name) return '';
  if (roleId === 4) return `${name} (SH)`;
  if (roleId === 5) return `${name} (SP)`;
  return name;
}

/* ------------------------------------------------------------------ */
/* List fetcher                                                        */
/* ------------------------------------------------------------------ */

export async function fetchMeetings(): Promise<MeetingsResult> {
  const empty: MeetingsResult = {
    meetings: [], agents: [], salespeople: [], statuses: [], modes: [],
    industries: [], cities: [], truncated: false, error: null,
  };

  const MEETINGS_CAP = 2000;

  // 1. Meetings (most recent first)
  const { data: meetingsRaw, error: meetingsError } = await supabase
    .from('meeting_master')
    .select(
      'meeting_id, meeting_name, meeting_date, meeting_time, meeting_mode, meeting_status, meeting_confirm, created_date'
    )
    .is('deleted_date', null)
    .order('meeting_date', { ascending: false, nullsFirst: false })
    .limit(MEETINGS_CAP);

  if (meetingsError || !meetingsRaw) {
    return { ...empty, error: meetingsError?.message ?? 'Failed to fetch meetings' };
  }
  const meetings = meetingsRaw as unknown as MeetingMasterRow[];
  // Signal to the UI when the hard cap was hit and older meetings were silently dropped.
  const truncated = meetings.length >= MEETINGS_CAP;
  const meetingIds = meetings.map((m) => m.meeting_id);

  // 2. Schedules -> report_id for each meeting
  const { data: schedulesRaw } = meetingIds.length
    ? await supabase
        .from('meeting_schedule')
        .select('meeting_id, report_id')
        .is('deleted_date', null)
        .in('meeting_id', meetingIds)
    : { data: [] };
  const schedules = (schedulesRaw ?? []) as unknown as ScheduleRow[];

  // 3. Reports -> lead_id + assigned salesperson + stage
  const reportIds = [...new Set(schedules.map((s) => s.report_id).filter(Boolean))];
  const { data: reportsRaw } = reportIds.length
    ? await supabase
        .from('lead_report')
        .select('report_id, lead_id, user_id, stage_id')
        .is('deleted_date', null)
        .in('report_id', reportIds)
    : { data: [] };
  const reports = (reportsRaw ?? []) as unknown as ReportRow[];

  // 4. Leads
  const leadIds = [...new Set(reports.map((r) => r.lead_id).filter(Boolean))];
  const { data: leadsRaw } = leadIds.length
    ? await supabase
        .from('lead_master')
        .select('lead_id, lead_name, lead_number, company_id, client_assoc_id, address_id, agent_id, project_id, mobile_no, created_date')
        .in('lead_id', leadIds)
    : { data: [] };
  const leads = (leadsRaw ?? []) as unknown as LeadRow[];

  // 5. Companies (prospect) — only when company_id is present (NULL for ~79% of leads).
  const companyIds = [...new Set(leads.map((l) => l.company_id).filter((id): id is number => id != null))];
  const { data: companiesRaw } = companyIds.length
    ? await supabase
        .from('company_master')
        .select('company_id, company_name')
        .in('company_id', companyIds)
    : { data: [] };
  const companies = (companiesRaw ?? []) as unknown as CompanyRow[];

  // 6. Clients (the displayed "Company" fallback + the source of Industry — matches the Leads module)
  const clientIds = [...new Set(leads.map((l) => l.client_assoc_id).filter((id): id is number => id != null))];
  const { data: clientsRaw } = clientIds.length
    ? await supabase
        .from('client_association')
        .select('client_assoc_id, client_name, industry_id')
        .in('client_assoc_id', clientIds)
    : { data: [] };
  const clients = (clientsRaw ?? []) as unknown as ClientRow[];

  // 7. Industries (by client_association.industry_id — same source the Leads module uses)
  const industryIds = [...new Set(clients.map((c) => c.industry_id).filter((id): id is number => id != null))];
  const { data: industriesRaw } = industryIds.length
    ? await supabase.from('industry_master').select('industry_id, industry_name').in('industry_id', industryIds)
    : { data: [] };
  const industries = (industriesRaw ?? []) as unknown as IndustryRow[];

  // 7b. Addresses -> cities (by lead_master.address_id — same source the Leads module uses)
  const addressIds = [...new Set(leads.map((l) => l.address_id).filter((id): id is number => id != null))];
  const { data: addressesRaw } = addressIds.length
    ? await supabase.from('address_master').select('address_id, city_id').in('address_id', addressIds)
    : { data: [] };
  const addresses = (addressesRaw ?? []) as unknown as AddressRow[];

  const cityIds = [...new Set(addresses.map((a) => a.city_id).filter((id): id is number => id != null))];
  const { data: citiesRaw } = cityIds.length
    ? await supabase.from('city_master').select('city_id, city_name').in('city_id', cityIds)
    : { data: [] };
  const cities = (citiesRaw ?? []) as unknown as CityRow[];

  // 8. Stages
  const stageIds = [...new Set(reports.map((r) => r.stage_id).filter((id): id is number => id != null))];
  const { data: stagesRaw } = stageIds.length
    ? await supabase.from('stage_master').select('stage_id, stage').in('stage_id', stageIds)
    : { data: [] };
  const stages = (stagesRaw ?? []) as unknown as StageRow[];

  // 9. Users (agents + salespeople) + their roles (for SP/SH suffix)
  const agentIds = leads.map((l) => l.agent_id).filter((id): id is number => id != null);
  const spIds = reports.map((r) => r.user_id).filter((id): id is number => id != null);
  const userIds = [...new Set([...agentIds, ...spIds])];
  const { data: usersRaw } = userIds.length
    ? await supabase.from('user_master').select('user_id, full_name').in('user_id', userIds)
    : { data: [] };
  const users = (usersRaw ?? []) as unknown as UserRow[];
  const { data: rolesRaw } = spIds.length
    ? await supabase.from('user_role').select('user_id, role_id').in('user_id', [...new Set(spIds)]).is('deleted_date', null)
    : { data: [] };
  const roleRows = (rolesRaw ?? []) as unknown as UserRoleRow[];

  /* Lookup maps */
  const companyMap = new Map<number, string>(); // company_id -> company_name
  companies.forEach((c) => companyMap.set(c.company_id, (c.company_name ?? '').trim()));
  const clientMap = new Map<number, ClientRow>();
  clients.forEach((c) => clientMap.set(c.client_assoc_id, c));
  const industryMap = new Map<number, string>();
  industries.forEach((i) => industryMap.set(i.industry_id, (i.industry_name ?? '').trim()));
  const addressMap = new Map<number, number>(); // address_id -> city_id
  addresses.forEach((a) => { if (a.city_id != null) addressMap.set(a.address_id, a.city_id); });
  const cityMap = new Map<number, string>();
  cities.forEach((c) => cityMap.set(c.city_id, (c.city_name ?? '').trim()));
  const stageMap = new Map<number, string>();
  stages.forEach((s) => stageMap.set(s.stage_id, (s.stage ?? '').trim()));
  const userMap = new Map<number, string>();
  users.forEach((u) => userMap.set(u.user_id, (u.full_name ?? '').trim()));
  // Sales role per user for the (SH)/(SP) suffix. Prefer the SALES role specifically
  // (4 SALES_HEAD over 5 SALES_PERSON) so a multi-role user who also holds a web role
  // (1-3) still shows their sales tag — don't pick the global-minimum role_id.
  const userRoleMap = new Map<number, number>();
  roleRows.forEach((r) => {
    if (r.role_id !== 4 && r.role_id !== 5) return; // only sales roles drive the suffix
    const cur = userRoleMap.get(r.user_id);
    if (cur == null || r.role_id < cur) userRoleMap.set(r.user_id, r.role_id); // 4 beats 5
  });

  const leadMap = new Map<number, LeadRow>();
  leads.forEach((l) => leadMap.set(l.lead_id, l));
  const reportMap = new Map<number, ReportRow>();
  reports.forEach((r) => reportMap.set(r.report_id, r));
  // first schedule per meeting
  const meetingReportMap = new Map<number, number>();
  schedules.forEach((s) => {
    if (!meetingReportMap.has(s.meeting_id)) meetingReportMap.set(s.meeting_id, s.report_id);
  });

  const mapped: MeetingRow[] = meetings.map((m) => {
    const reportId = meetingReportMap.get(m.meeting_id);
    const report = reportId != null ? reportMap.get(reportId) : undefined;
    const lead = report?.lead_id != null ? leadMap.get(report.lead_id) : undefined;
    const clientRow = lead?.client_assoc_id != null ? clientMap.get(lead.client_assoc_id) : undefined;
    const client = (clientRow?.client_name ?? '').trim();
    // Company: prospect company_master.company_name when set, else the client_name (Leads-module parity).
    const companyName = lead?.company_id != null ? companyMap.get(lead.company_id) ?? '' : '';
    const company = companyName || client;
    // Industry: from client_association.industry_id (same source as the Leads module).
    const industry = clientRow?.industry_id != null ? industryMap.get(clientRow.industry_id) ?? '' : '';
    // City: lead_master.address_id -> address_master.city_id -> city_master (same as the Leads module).
    const cityId = lead?.address_id != null ? addressMap.get(lead.address_id) : undefined;
    const city = cityId != null ? cityMap.get(cityId) ?? '' : '';
    const agent = lead?.agent_id != null ? userMap.get(lead.agent_id) ?? '' : '';
    const spName = report?.user_id != null ? userMap.get(report.user_id) ?? '' : '';
    const salesperson = report?.user_id != null
      ? salespersonLabel(spName, userRoleMap.get(report.user_id))
      : '';
    const leadStage = report?.stage_id != null ? stageMap.get(report.stage_id) ?? '' : '';

    return {
      id: String(m.meeting_id),
      name: (m.meeting_name ?? '').trim(),
      leadId: lead ? String(lead.lead_id) : null,
      leadNumber: (lead?.lead_number ?? '').trim(),
      leadName: (lead?.lead_name ?? '').trim(),
      projectId: lead?.project_id ?? null,
      company,
      client,
      industry,
      city,
      agent,
      salesperson,
      contact: (lead?.mobile_no ?? '').trim(),
      leadStage,
      leadGenDate: dateOnly(lead?.created_date),
      confirmed: !!m.meeting_confirm,
      meetingDate: dateOnly(m.meeting_date),
      meetingTime: normaliseTime(m.meeting_time),
      mode: (m.meeting_mode ?? '').trim(),
      status: (m.meeting_status ?? '').trim(),
    };
  });

  const uniq = (arr: string[]) => [...new Set(arr.filter(Boolean))].sort();
  return {
    meetings: mapped,
    agents: uniq(mapped.map((m) => m.agent)),
    salespeople: uniq(mapped.map((m) => m.salesperson)),
    statuses: uniq(mapped.map((m) => m.status)),
    modes: uniq(mapped.map((m) => m.mode)),
    industries: uniq(mapped.map((m) => m.industry)),
    cities: uniq(mapped.map((m) => m.city)),
    truncated,
    error: null,
  };
}

/* ------------------------------------------------------------------ */
/* Detail fetcher                                                      */
/* ------------------------------------------------------------------ */

export async function fetchMeetingDetail(meetingId: string): Promise<MeetingDetailResult> {
  const idNum = Number(meetingId);
  if (!Number.isFinite(idNum)) {
    return { meeting: null, error: 'Invalid meeting id' };
  }

  // 1. The meeting itself
  const { data: mRaw, error: mErr } = await supabase
    .from('meeting_master')
    .select(
      'meeting_id, meeting_name, meeting_date, meeting_time, meeting_mode, meeting_status, meeting_confirm, duration, follow_up_date, meeting_url, call_recording, share_point_url, description, reason, agent_feedback, created_date'
    )
    .eq('meeting_id', idNum)
    .is('deleted_date', null)
    .maybeSingle();

  if (mErr) return { meeting: null, error: mErr.message };
  if (!mRaw) return { meeting: null, error: null }; // not found -> empty state
  const m = mRaw as unknown as MeetingMasterRow;

  // 2. Schedule -> report_id (-> lead, salesperson, stage)
  const { data: schedRaw } = await supabase
    .from('meeting_schedule')
    .select('meeting_id, report_id')
    .eq('meeting_id', idNum)
    .is('deleted_date', null);
  const schedules = (schedRaw ?? []) as unknown as ScheduleRow[];
  const reportId = schedules.length ? schedules[0].report_id : null;

  let lead: LeadRow | null = null;
  let company = '';
  let client = '';
  let industry = '';
  let city = '';
  let agent = '';
  let salesperson = '';
  let salespersonUserId: number | null = null;
  let leadStage = '';
  // ALT-275 accumulators
  let salesIntelligence = '';
  let scheduledByName = '';
  let companyTurnover = '';
  let companySector = '';
  let companySize = '';
  let companyWebsite = '';
  let companyLinkedin = '';
  let addressLine1 = '';
  let addressLine2 = '';

  if (reportId != null) {
    const { data: repRaw } = await supabase
      .from('lead_report')
      .select('report_id, lead_id, user_id, stage_id, sales_intelligence, created_by')
      .eq('report_id', reportId)
      .is('deleted_date', null)
      .maybeSingle();
    const report = (repRaw as unknown as ReportRow) ?? null;

    salesIntelligence = ((report?.sales_intelligence ?? '') as string).trim();

    // "Meeting scheduled by" — lead_report.created_by holds the scheduler's user_id
    // (stored as text/number across the schema). Resolve to a full name.
    if (report?.created_by != null && String(report.created_by).trim() !== '') {
      const createdById = Number(report.created_by);
      if (Number.isFinite(createdById)) {
        const { data: cbRaw } = await supabase
          .from('user_master')
          .select('user_id, full_name')
          .eq('user_id', createdById)
          .maybeSingle();
        scheduledByName = ((cbRaw as unknown as UserRow | null)?.full_name ?? '').trim();
      }
    }

    if (report?.stage_id != null) {
      const { data: stageRaw } = await supabase
        .from('stage_master')
        .select('stage_id, stage')
        .eq('stage_id', report.stage_id)
        .maybeSingle();
      leadStage = ((stageRaw as unknown as StageRow | null)?.stage ?? '').trim();
    }
    if (report?.user_id != null) {
      const [{ data: spRaw }, { data: spRoleRaw }] = await Promise.all([
        supabase.from('user_master').select('user_id, full_name').eq('user_id', report.user_id).maybeSingle(),
        supabase.from('user_role').select('user_id, role_id').eq('user_id', report.user_id).is('deleted_date', null),
      ]);
      const spName = ((spRaw as unknown as UserRow | null)?.full_name ?? '').trim();
      const roles = ((spRoleRaw ?? []) as unknown as UserRoleRow[]).map((r) => r.role_id);
      const roleId = roles.includes(4) ? 4 : roles.includes(5) ? 5 : undefined;
      salesperson = salespersonLabel(spName, roleId);
      salespersonUserId = report.user_id;
    }
    if (report?.lead_id != null) {
      const { data: leadRaw } = await supabase
        .from('lead_master')
        .select('lead_id, lead_name, lead_number, company_id, client_assoc_id, address_id, agent_id, email, mobile_no, designation, created_date, alt_mobile_no, linkedin_url, role_and_resp, area_of_interest, title, value, description')
        .eq('lead_id', report.lead_id)
        .maybeSingle();
      lead = (leadRaw as unknown as LeadRow) ?? null;

      // Prospect company_master.company_name — only when company_id is present (NULL for ~79%).
      let companyName = '';
      if (lead?.company_id != null) {
        const { data: compRaw } = await supabase
          .from('company_master')
          .select('company_id, company_name, company_size, company_web_url, linkedin_url, turnover_id, sector_id')
          .eq('company_id', lead.company_id)
          .maybeSingle();
        const comp = (compRaw as unknown as CompanyRow | null) ?? null;
        companyName = (comp?.company_name ?? '').trim();
        companySize = comp?.company_size != null ? String(comp.company_size).trim() : '';
        companyWebsite = (comp?.company_web_url ?? '').trim();
        companyLinkedin = (comp?.linkedin_url ?? '').trim();
        // Turnover band label (same pattern as companies.ts).
        if (comp?.turnover_id != null) {
          const { data: tovRaw } = await supabase
            .from('turnover_master')
            .select('turnover_id, turnover')
            .eq('turnover_id', comp.turnover_id)
            .maybeSingle();
          companyTurnover = ((tovRaw as unknown as TurnoverRow | null)?.turnover ?? '').trim();
        }
        // Sector label (NEW lookup: company_sector(sector_id, sector)).
        if (comp?.sector_id != null) {
          const { data: secRaw } = await supabase
            .from('company_sector')
            .select('sector_id, sector')
            .eq('sector_id', comp.sector_id)
            .maybeSingle();
          companySector = ((secRaw as unknown as SectorRow | null)?.sector ?? '').trim();
        }
      }
      // Client + Industry from client_association (industry source = Leads-module parity).
      if (lead?.client_assoc_id != null) {
        const { data: clientRaw } = await supabase
          .from('client_association')
          .select('client_assoc_id, client_name, industry_id')
          .eq('client_assoc_id', lead.client_assoc_id)
          .maybeSingle();
        const clientRow = (clientRaw as unknown as ClientRow | null) ?? null;
        client = (clientRow?.client_name ?? '').trim();
        if (clientRow?.industry_id != null) {
          const { data: indRaw } = await supabase
            .from('industry_master')
            .select('industry_id, industry_name')
            .eq('industry_id', clientRow.industry_id)
            .maybeSingle();
          industry = ((indRaw as unknown as IndustryRow | null)?.industry_name ?? '').trim();
        }
      }
      // Company display = prospect company_name when set, else the client_name (Leads-module parity).
      company = companyName || client;
      // City via lead_master.address_id -> address_master.city_id -> city_master (same as Leads).
      if (lead?.address_id != null) {
        const { data: addrRaw } = await supabase
          .from('address_master')
          .select('address_id, city_id, address_line1, address_line2')
          .eq('address_id', lead.address_id)
          .maybeSingle();
        const addr = (addrRaw as unknown as AddressRow | null) ?? null;
        addressLine1 = (addr?.address_line1 ?? '').trim();
        addressLine2 = (addr?.address_line2 ?? '').trim();
        const cityId = addr?.city_id ?? null;
        if (cityId != null) {
          const { data: cityRaw } = await supabase
            .from('city_master')
            .select('city_id, city_name')
            .eq('city_id', cityId)
            .maybeSingle();
          city = ((cityRaw as unknown as CityRow | null)?.city_name ?? '').trim();
        }
      }
      if (lead?.agent_id != null) {
        const { data: userRaw } = await supabase
          .from('user_master')
          .select('user_id, full_name')
          .eq('user_id', lead.agent_id)
          .maybeSingle();
        agent = ((userRaw as unknown as UserRow | null)?.full_name ?? '').trim();
      }
    }
  }

  // 3. Participants
  const { data: partsRaw } = await supabase
    .from('meeting_participant')
    .select('mtg_part_id, meeting_id, participant')
    .eq('meeting_id', idNum)
    .is('deleted_date', null);
  const participants: MeetingParticipant[] = ((partsRaw ?? []) as unknown as ParticipantRow[])
    .map((p) => ({ id: p.mtg_part_id, participant: (p.participant ?? '').trim() }))
    .filter((p) => p.participant.length > 0);

  // 4. Feedback (by meeting_id) joined to question text
  const { data: faRaw } = await supabase
    .from('feedback_answer')
    .select('meeting_id, feed_que_id, feed_ans')
    .eq('meeting_id', idNum)
    .is('deleted_date', null);
  const feedbackAnswers = (faRaw ?? []) as unknown as FeedbackAnswerRow[];
  const feedQueIds = [...new Set(feedbackAnswers.map((f) => f.feed_que_id).filter(Boolean))];
  const { data: fqRaw } = feedQueIds.length
    ? await supabase
        .from('feedback_question_master')
        .select('feed_que_id, feed_que')
        .in('feed_que_id', feedQueIds)
    : { data: [] };
  const feedQueMap = new Map<number, string>();
  ((fqRaw ?? []) as unknown as FeedbackQuestionRow[]).forEach((q) =>
    feedQueMap.set(q.feed_que_id, (q.feed_que ?? '').trim())
  );
  const feedback: FeedbackItem[] = feedbackAnswers
    .map((f) => ({
      question: feedQueMap.get(f.feed_que_id) ?? '',
      answer: (f.feed_ans ?? '').trim(),
    }))
    .filter((f) => f.question.length > 0 || f.answer.length > 0);

  // 5. Pre-sales discussion notes (by report_id) joined to question text
  let preSales: PreSalesItem[] = [];
  if (reportId != null) {
    const { data: psaRaw } = await supabase
      .from('pre_sales_answer')
      .select('report_id, pre_sa_que_id, answer')
      .eq('report_id', reportId)
      .is('deleted_date', null);
    const psAnswers = (psaRaw ?? []) as unknown as PreSalesAnswerRow[];
    const psQueIds = [...new Set(psAnswers.map((p) => p.pre_sa_que_id).filter(Boolean))];
    const { data: psqRaw } = psQueIds.length
      ? await supabase
          .from('pre_sales_question')
          .select('pre_sa_que_id, short_question, question')
          .in('pre_sa_que_id', psQueIds)
      : { data: [] };
    const psQueMap = new Map<number, string>();
    ((psqRaw ?? []) as unknown as PreSalesQuestionRow[]).forEach((q) =>
      psQueMap.set(q.pre_sa_que_id, ((q.short_question || q.question) ?? '').trim())
    );
    preSales = psAnswers
      .map((p) => ({
        question: psQueMap.get(p.pre_sa_que_id) ?? '',
        answer: (p.answer ?? '').trim(),
      }))
      .filter((p) => p.answer.length > 0);
  }

  // 6. Reschedule / cancel history
  const { data: histRaw } = await supabase
    .from('meeting_reschedule')
    .select('mtg_resch_id, meeting_id, meeting_date, meeting_time, duration, meeting_status, resone, new_resone, created_date')
    .eq('meeting_id', idNum)
    .is('deleted_date', null)
    .order('mtg_resch_id', { ascending: false });
  const history: RescheduleHistoryItem[] = ((histRaw ?? []) as unknown as RescheduleRow[]).map((h) => ({
    id: h.mtg_resch_id,
    date: dateOnly(h.meeting_date),
    time: normaliseTime(h.meeting_time),
    duration: (h.duration ?? '').trim(),
    status: (h.meeting_status ?? '').trim(),
    reason: ((h.resone || h.new_resone) ?? '').trim(),
    createdDate: h.created_date ?? null,
  }));

  const meeting: MeetingDetail = {
    id: String(m.meeting_id),
    reportId,
    name: (m.meeting_name ?? '').trim(),
    meetingDate: dateOnly(m.meeting_date),
    meetingTime: normaliseTime(m.meeting_time),
    mode: (m.meeting_mode ?? '').trim(),
    status: (m.meeting_status ?? '').trim(),
    duration: (m.duration ?? '').trim(),
    followUpDate: dateOnly(m.follow_up_date),
    meetingUrl: (m.meeting_url ?? '').trim(),
    callRecording: (m.call_recording ?? '').trim(),
    sharePointUrl: (m.share_point_url ?? '').trim(),
    description: (m.description ?? '').trim(),
    reason: (m.reason ?? '').trim(),
    agentFeedback: (m.agent_feedback ?? '').trim(),
    confirmed: !!m.meeting_confirm,
    createdDate: dateOnly(m.created_date),
    leadId: lead ? String(lead.lead_id) : null,
    leadNumber: (lead?.lead_number ?? '').trim(),
    leadName: (lead?.lead_name ?? '').trim(),
    leadEmail: (lead?.email ?? '').trim(),
    leadMobile: (lead?.mobile_no ?? '').trim(),
    leadDesignation: (lead?.designation ?? '').trim(),
    leadStage,
    company,
    client,
    industry,
    city,
    agent,
    salesperson,
    salespersonUserId,
    // ALT-275 extras
    leadAltMobile: (lead?.alt_mobile_no ?? '').trim(),
    leadLinkedin: (lead?.linkedin_url ?? '').trim(),
    leadRoleAndResp: (lead?.role_and_resp ?? '').trim(),
    leadAreaOfInterest: (lead?.area_of_interest ?? '').trim(),
    oppTitle: (lead?.title ?? '').trim(),
    oppValue: lead?.value != null ? String(lead.value).trim() : '',
    oppDescription: (lead?.description ?? '').trim(),
    salesIntelligence,
    scheduledByName,
    companyTurnover,
    companySector,
    companySize,
    companyWebsite,
    companyLinkedin,
    addressLine1,
    addressLine2,
    participants,
    feedback,
    preSales,
    history,
  };

  return { meeting, error: null };
}

/* ------------------------------------------------------------------ */
/* Writers — reschedule / cancel / confirm / edit-after-conclusion     */
/* ------------------------------------------------------------------ */

/**
 * Reschedule or cancel a meeting. Mirrors src/components/lead/MeetingTab.tsx logic
 * but, unlike leadWorkspace.updateMeeting(), this:
 *   - writes the DISPLAYED `meeting_status` field (not the dead `status` column),
 *   - journals a row into the `meeting_reschedule` history table,
 *   - updates the lead_report stage (same id mapping as leadWorkspace).
 */
export async function updateMeetingStatus(input: {
  meetingId: number;
  reportId: number | null;
  action: 'reschedule' | 'cancel';
  by: string; // postponed-by / cancelled-by value
  reason: string;
  newDate?: string;
  newTime?: string;
  newDuration?: string;
  actor: string;
  /** Original meeting_master.updated_date when the page loaded (concurrency guard). */
  originalUpdatedDate?: string | null;
}): Promise<{ error: string } | ConflictResult | null> {
  const now = new Date().toISOString();
  const { meetingId, action, by, reason, actor } = input;
  const reasonTrim = reason.trim();
  const guard = concurrencyPrecondition(input.originalUpdatedDate);

  if (action === 'reschedule') {
    const patch: Record<string, unknown> = {
      meeting_status: 'Rescheduled',
      reason: reasonTrim || null,
      updated_by: actor,
      updated_date: now,
    };
    if (input.newDate) patch.meeting_date = input.newDate;
    if (input.newTime) patch.meeting_time = input.newTime;
    if (input.newDuration) patch.duration = input.newDuration;
    if (guard !== undefined) {
      const { data: affected, error } = await supabase
        .from('meeting_master').update(patch).eq('meeting_id', meetingId)
        .eq('updated_date', guard).select('meeting_id');
      if (error) return { error: humanizeWriteError(error) ?? (error as { message: string }).message };
      if (!affected || affected.length === 0) return makeConflict('meeting_master');
    } else {
      const { error } = await supabase.from('meeting_master').update(patch).eq('meeting_id', meetingId);
      if (error) return { error: humanizeWriteError(error) ?? (error as { message: string }).message };
    }

    // history row
    await supabase.from('meeting_reschedule').insert({
      meeting_id: meetingId,
      meeting_date: input.newDate || null,
      meeting_time: input.newTime || null,
      duration: input.newDuration || null,
      meeting_status: 'Rescheduled',
      resone: reasonTrim || null,
      created_by: actor,
      created_date: now,
    });

    if (input.reportId) {
      const sid = rescheduleStageId(by);
      await supabase
        .from('lead_report')
        .update({ stage_id: sid, report_status: STAGE_LABEL[sid], updated_by: actor, updated_date: now })
        .eq('report_id', input.reportId);
    }
  } else {
    const cancelPatch = {
      meeting_status: 'Cancelled',
      reason: reasonTrim || null,
      updated_by: actor,
      updated_date: now,
    };
    if (guard !== undefined) {
      const { data: affected, error } = await supabase
        .from('meeting_master').update(cancelPatch).eq('meeting_id', meetingId)
        .eq('updated_date', guard).select('meeting_id');
      if (error) return { error: humanizeWriteError(error) ?? (error as { message: string }).message };
      if (!affected || affected.length === 0) return makeConflict('meeting_master');
    } else {
      const { error } = await supabase.from('meeting_master').update(cancelPatch).eq('meeting_id', meetingId);
      if (error) return { error: humanizeWriteError(error) ?? (error as { message: string }).message };
    }

    // history row
    await supabase.from('meeting_reschedule').insert({
      meeting_id: meetingId,
      meeting_status: 'Cancelled',
      resone: reasonTrim || null,
      created_by: actor,
      created_date: now,
    });

    if (input.reportId) {
      const sid = cancelStageId(by);
      await supabase
        .from('lead_report')
        .update({ stage_id: sid, report_status: STAGE_LABEL[sid], updated_by: actor, updated_date: now })
        .eq('report_id', input.reportId);
    }
  }
  return null;
}

/**
 * Statuses from which a meeting may still be "confirmed by prospect".
 * Confirm only applies to a meeting that is still pending (Scheduled / Rescheduled);
 * it must NEVER overwrite a terminal status (Completed / Missed / Cancelled).
 */
export const CONFIRMABLE_STATUSES = ['Scheduled', 'Rescheduled'] as const;

/** True when this meeting status still allows a "confirm by prospect" action. */
export function canConfirmMeeting(status: string | null | undefined): boolean {
  const s = (status ?? '').trim().toLowerCase();
  // Blank/Unknown statuses are still pending in practice, so allow confirm there too.
  if (s === '') return true;
  return (CONFIRMABLE_STATUSES as readonly string[]).some((v) => v.toLowerCase() === s);
}

/**
 * Mark "Meeting confirmed by prospect" — one-way (matches old code + MeetingTab).
 * Flips meeting_status -> Confirmed and advances the lead to "Meeting Confirmed" (stage_id 5).
 *
 * GUARDS (verified against live DB: 197 Completed + 198 Missed meetings were unconfirmed):
 *  - Re-reads the live meeting_status and NO-OPs when the meeting is already concluded
 *    (Completed / Missed) or Cancelled — never overwrites a terminal status.
 *  - Only ADVANCES the lead stage to 5: if the lead is already at "Meeting Successful" (8) or
 *    any later/terminal stage, the stage_id is left untouched so confirm can't regress 8 -> 5.
 */
export async function confirmMeeting(
  meetingId: number,
  reportId: number | null,
  actor: string,
  /** Original meeting_master.updated_date when the page loaded (concurrency guard). */
  originalUpdatedDate?: string | null,
): Promise<{ error: string } | ConflictResult | null> {
  const now = new Date().toISOString();

  // Re-read the live status so a stale page can't confirm a concluded/cancelled meeting.
  const { data: cur, error: readErr } = await supabase
    .from('meeting_master')
    .select('meeting_status, meeting_confirm')
    .eq('meeting_id', meetingId)
    .is('deleted_date', null)
    .maybeSingle();
  if (readErr) return { error: (readErr as { message: string }).message };
  if (!cur) return { error: 'Meeting not found' };
  const curStatus = (cur as { meeting_status: string | null }).meeting_status;
  if (!canConfirmMeeting(curStatus)) {
    return { error: `Can't confirm a ${(curStatus ?? '').trim() || 'concluded'} meeting.` };
  }

  const confirmPatch = { meeting_confirm: true, meeting_status: 'Confirmed', updated_by: actor, updated_date: now };
  const guard = concurrencyPrecondition(originalUpdatedDate);
  if (guard !== undefined) {
    const { data: affected, error } = await supabase
      .from('meeting_master').update(confirmPatch).eq('meeting_id', meetingId)
      .eq('updated_date', guard).select('meeting_id');
    if (error) return { error: humanizeWriteError(error) ?? (error as { message: string }).message };
    if (!affected || affected.length === 0) return makeConflict('meeting_master');
  } else {
    const { error } = await supabase.from('meeting_master').update(confirmPatch).eq('meeting_id', meetingId);
    if (error) return { error: humanizeWriteError(error) ?? (error as { message: string }).message };
  }

  if (reportId) {
    // Only advance the stage — never regress a lead that is already at Meeting Successful (8)
    // or beyond. Stages 3 (New Meeting) and 4 (Meeting Scheduled) precede 5 (Meeting Confirmed).
    const { data: rep } = await supabase
      .from('lead_report')
      .select('stage_id')
      .eq('report_id', reportId)
      .maybeSingle();
    const stageId = (rep as { stage_id: number | null } | null)?.stage_id ?? null;
    const shouldAdvance = stageId == null || stageId < 5;
    if (shouldAdvance) {
      await supabase
        .from('lead_report')
        .update({ stage_id: 5, report_status: 'Meeting Confirmed', updated_by: actor, updated_date: now })
        .eq('report_id', reportId);
    }
  }
  return null;
}

/**
 * Small-CR: edit a CONCLUDED meeting's details. Gate to ADMIN / TEAM_LEAD in the UI.
 * Writes updated_by / updated_date. Only the editable fields are touched.
 */
export interface EditMeetingInput {
  meetingId: number;
  meetingDate: string | null;
  meetingTime: string;
  mode: string;
  agenda: string;
  meetingUrl: string;
  actor: string;
  /** Original meeting_master.updated_date when the page loaded (concurrency guard). */
  originalUpdatedDate?: string | null;
}
export async function editMeetingDetails(input: EditMeetingInput): Promise<{ error: string } | ConflictResult | null> {
  const editPatch = {
    meeting_date: input.meetingDate || null,
    meeting_time: input.meetingTime.trim() || null,
    meeting_mode: input.mode || null,
    description: input.agenda.trim() || null,
    meeting_url: input.meetingUrl.trim() || null,
    updated_by: input.actor,
    updated_date: new Date().toISOString(),
  };
  const guard = concurrencyPrecondition(input.originalUpdatedDate);
  if (guard !== undefined) {
    const { data: affected, error } = await supabase
      .from('meeting_master').update(editPatch).eq('meeting_id', input.meetingId)
      .eq('updated_date', guard).select('meeting_id');
    if (error) return { error: humanizeWriteError(error) ?? (error as { message: string }).message };
    if (!affected || affected.length === 0) return makeConflict('meeting_master');
    return null;
  }
  const { error } = await supabase.from('meeting_master').update(editPatch).eq('meeting_id', input.meetingId);
  if (error) return { error: humanizeWriteError(error) ?? (error as { message: string }).message };
  return null;
}

/*
 * TODO (no cron yet): auto-"Missed" status is NOT automated in this rebuild.
 * The old system flips a meeting to "Missed" via a background job once its time
 * passes without completion. A scheduled job (e.g. a Supabase cron / edge function)
 * is required to set meeting_status = 'Missed' for past, non-completed, non-cancelled
 * meetings. Until that exists, "Missed" only appears on rows the old system already set.
 * (Open Q#10 — owner confirmed auto-Missed is desired, but it is out of scope for the
 *  web module and must be wired server-side.)
 */

/* ------------------------------------------------------------------ */
/* Excel export builder (CR: ~18 core fields + feedback Q&A columns)    */
/* ------------------------------------------------------------------ */

/**
 * Build the export rows for a set of meetings (already filtered in the page).
 *
 * Produces the CR's ~18 core columns (meeting + lead fields) PLUS one column per
 * salesperson feedback question (7 questions via feedback_question_master), with the
 * answer pulled from feedback_answer for each meeting.
 *
 * TODO (Q&A columns): pre-sales question answers are NOT added as columns here.
 * Unlike the 7 fixed feedback questions, pre-sales questions vary by business domain
 * (HR / F&B / Security / IFM / Travel...), so a flat column-per-question export would
 * produce a very wide, sparse sheet. The core 18 + the 7 feedback columns are included;
 * wiring the per-domain pre-sales Q&A columns is left as a follow-up (Open: confirm the
 * desired layout — one sheet with all domains' questions vs. per-domain sheets).
 */
export async function buildMeetingExportRows(
  rows: MeetingRow[]
): Promise<Record<string, string>[]> {
  // Fixed 7 feedback questions (stable column order)
  const { data: fqRaw } = await supabase
    .from('feedback_question_master')
    .select('feed_que_id, feed_que')
    .is('deleted_date', null)
    .order('feed_que_id');
  const feedbackQuestions = ((fqRaw ?? []) as unknown as FeedbackQuestionRow[]).map((q) => ({
    id: q.feed_que_id,
    text: (q.feed_que ?? '').trim(),
  }));

  // All feedback answers for the meetings in scope.
  // CHUNKED: with 7 questions/meeting, the total feedback set (1435+ live rows) exceeds
  // PostgREST's default 1000-row page, which would silently drop columns past row 1000.
  // Chunk the meeting_id IN-list (≈700 feedback rows per chunk) to stay under the cap.
  const meetingIds = rows.map((r) => Number(r.id)).filter((n) => Number.isFinite(n));
  const answerMap = new Map<number, Map<number, string>>(); // meeting_id -> que_id -> ans
  const MEETING_CHUNK = 100;
  for (let i = 0; i < meetingIds.length; i += MEETING_CHUNK) {
    const chunk = meetingIds.slice(i, i + MEETING_CHUNK);
    const { data: faRaw } = await supabase
      .from('feedback_answer')
      .select('meeting_id, feed_que_id, feed_ans')
      .in('meeting_id', chunk)
      .is('deleted_date', null);
    ((faRaw ?? []) as unknown as FeedbackAnswerRow[]).forEach((a) => {
      if (!answerMap.has(a.meeting_id)) answerMap.set(a.meeting_id, new Map());
      answerMap.get(a.meeting_id)!.set(a.feed_que_id, (a.feed_ans ?? '').trim());
    });
  }

  return rows.map((m) => {
    const base: Record<string, string> = {
      'Lead #': m.leadNumber,
      'Lead Name': m.leadName,
      Company: m.company,
      Client: m.client,
      Industry: m.industry,
      City: m.city,
      'Meeting Name': m.name,
      'Meeting Date': m.meetingDate ? formatDate(m.meetingDate) : '',
      'Meeting Time': m.meetingTime ? formatTime(m.meetingTime) : '',
      Mode: m.mode,
      Status: m.status,
      'Lead Stage': m.leadStage,
      'Prospect Confirmed': m.confirmed ? 'Yes' : 'No',
      Salesperson: m.salesperson,
      Agent: m.agent,
      'Contact Number': m.contact,
      'Lead Generated': m.leadGenDate ? formatDate(m.leadGenDate) : '',
    };
    const answers = answerMap.get(Number(m.id));
    feedbackQuestions.forEach((q, i) => {
      base[`Feedback Q${i + 1}: ${q.text}`] = answers?.get(q.id) ?? '';
    });
    return base;
  });
}

/* ------------------------------------------------------------------ */
/* Formatting helpers (shared by pages)                                */
/* ------------------------------------------------------------------ */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2025-10-02' -> '02 Oct 2025'. Falls back to the raw string on parse failure. */
export function formatDate(d: string | null | undefined): string {
  if (!d) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!m) return d;
  const year = m[1];
  const month = MONTHS[Number(m[2]) - 1] ?? m[2];
  const day = m[3];
  return `${day} ${month} ${year}`;
}

/** '16:16' -> '4:16 PM'. Falls back to the raw string when it cannot parse. */
export function formatTime(t: string | null | undefined): string {
  if (!t) return '';
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return t;
  let h = Number(m[1]);
  const min = m[2];
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${min} ${period}`;
}
