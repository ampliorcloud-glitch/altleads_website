/**
 * Real data types and fetcher for Supabase lead data.
 *
 * ROOT-CAUSE NOTES (why the old version showed missing / mismatched data):
 *   - "Company" was read from company_master via lead_master.company_id, but that
 *     column is NULL for 477 of 605 leads. The real client/company for EVERY lead
 *     lives in client_association.client_name (via lead_master.client_assoc_id,
 *     populated for all 605 leads).
 *   - "Agent"/owner was read from lead_master.agent_id, which is NULL for 476 leads
 *     (only 2 distinct values). The real owner is lead_master.created_by, a varchar
 *     holding the user_master.user_id (18 distinct salespeople). A few legacy rows
 *     store a free-text name there instead of an id — we fall back to that string.
 *   - "Project" was never fetched. It comes from lead_master.project_id -> project.
 *   - Lookups must cover EVERY referenced row, so we page through all rows with
 *     .range() (PostgREST caps a single select at 1000 rows) and do NOT filter the
 *     lookup tables by deleted_date (a soft-deleted lookup row must still resolve).
 *
 * Join map:
 *   lead_master        — core record + created_by (owner), project_id, source_id,
 *                        client_assoc_id, address_id
 *   client_association — client_name (the displayed "Company") + industry_id
 *   industry_master    — industry_name
 *   address_master     — city_id
 *   city_master        — city_name
 *   user_master        — full_name (owner, keyed by created_by)
 *   project            — project_name
 *   source_master      — source_name
 *   lead_report        — latest stage_id per lead
 *   stage_master       — stage name
 *   meeting_schedule + meeting_master — latest meeting_date per lead
 */

import { supabase } from '../lib/supabase';

export interface RealLead {
  id: string;
  leadNumber: string;
  company: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  industry: string;
  city: string;
  agent: string;
  /** Assigned salesperson — lead_report.user_id (latest report) → user_master.full_name. */
  salesperson: string;
  /** Numeric user_id of the assigned salesperson (lead_report.user_id), or null. */
  salespersonUserId: number | null;
  project: string;
  /** Numeric project id (lead_master.project_id) — the stable key for project scoping. */
  projectId: number | null;
  source: string;
  stage: string;
  meetingDate: string | null;
  leadGeneratedDate: string;
  lastUpdated: string;
}

export interface LeadsResult {
  leads: RealLead[];
  industries: string[];
  cities: string[];
  agents: string[];
  salespeople: string[];
  projects: string[];
  sources: string[];
  stages: string[];
  error: string | null;
}

export interface DashboardStats {
  totalLeads: number;
  meetingsThisWeek: number;
  meetingsSuccessful: number;
  /** Calls LOGGED today (IST), across the current project scope (ALT-269). */
  callsToday: number;
  stageBreakdown: { stage: string; count: number }[];
  recentActivity: {
    leadId: number;
    leadName: string;
    companyName: string;
    stage: string;
    lastUpdated: string;
  }[];
  error: string | null;
}

/* ------------------------------------------------------------------
   Row types
------------------------------------------------------------------ */
interface LeadMasterRow {
  lead_id: number;
  lead_number: string | null;
  lead_name: string | null;
  email: string | null;
  mobile_no: string | null;
  company_id: number | null;
  client_assoc_id: number | null;
  agent_id: number | null;
  created_by: string | null;
  project_id: number | null;
  source_id: number | null;
  address_id: number | null;
  created_date: string | null;
  updated_date: string | null;
}
interface ClientAssocRow { client_assoc_id: number; client_name: string | null; industry_id: number | null; }
interface IndustryRow { industry_id: number; industry_name: string; }
interface AddressRow { address_id: number; city_id: number; }
interface CityRow { city_id: number; city_name: string; }
interface UserRow { user_id: number; full_name: string | null; }
interface ProjectRow { project_id: number; project_name: string | null; }
interface SourceRow { source_id: number; source_name: string | null; }
interface ReportRow { report_id: number; lead_id: number; stage_id: number; user_id: number | null; updated_date: string | null; }
interface StageRow { stage_id: number; stage: string; }
interface MeetingScheduleRow { report_id: number; meeting_id: number; }
interface MeetingRow { meeting_id: number; meeting_date: string | null; }

/* ------------------------------------------------------------------
   Paged fetch — pull ALL rows of a table/select, 1000 at a time.
   PostgREST/supabase-js caps a single select at 1000 rows; without
   paging, lookups (and any large table) silently truncate and leads
   fail to resolve. We loop with .range() until a short page is returned.
------------------------------------------------------------------ */
// The supabase client is untyped here, so the query builder is effectively `any`;
// we keep the tweak callback loosely typed to avoid brittle generic gymnastics.
type QueryTweak = (query: any) => any;

async function fetchAll<T>(
  table: string,
  columns: string,
  tweak?: QueryTweak,
): Promise<{ rows: T[]; error: string | null }> {
  const PAGE = 1000;
  const out: T[] = [];
  let from = 0;
  for (;;) {
    let query: any = supabase.from(table).select(columns).range(from, from + PAGE - 1);
    if (tweak) query = tweak(query);
    const { data, error } = await query;
    if (error) return { rows: out, error: (error as { message: string }).message };
    const batch = (data ?? []) as T[];
    out.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return { rows: out, error: null };
}

/**
 * Fetch rows where `inColumn IN (values)`, chunking the id list so the request
 * URL never blows past PostgREST's length limit. Best-effort: on a chunk error
 * it stops and returns what it has (the dashboard should degrade, not throw).
 * Used to scope dashboard stats to a project's lead/meeting id set (owner #8).
 */
async function chunkedIn<T>(
  table: string,
  columns: string,
  inColumn: string,
  values: number[],
  tweak?: QueryTweak,
  chunkSize = 150,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < values.length; i += chunkSize) {
    const chunk = values.slice(i, i + chunkSize);
    let query: any = supabase.from(table).select(columns).in(inColumn, chunk);
    if (tweak) query = tweak(query);
    const { data, error } = await query;
    if (error) break;
    out.push(...((data ?? []) as T[]));
  }
  return out;
}

/**
 * Fetch all data via separate queries and join in JS.
 * Works whether or not FKs are declared in the DB, and resolves every lead.
 */
export async function fetchLeadsFallback(): Promise<LeadsResult> {
  const empty: LeadsResult = {
    leads: [], industries: [], cities: [], agents: [], salespeople: [], projects: [], sources: [], stages: [], error: null,
  };

  // 1. ALL leads (not capped) — newest first.
  const leadsRes = await fetchAll<LeadMasterRow>(
    'lead_master',
    'lead_id, lead_number, lead_name, email, mobile_no, company_id, client_assoc_id, agent_id, created_by, project_id, source_id, address_id, created_date, updated_date',
    (q) => q.is('deleted_date', null).order('updated_date', { ascending: false, nullsFirst: false }),
  );
  if (leadsRes.error) return { ...empty, error: leadsRes.error };
  const leads = leadsRes.rows;

  // 2..N. Lookups — fetch ALL rows (no deleted_date filter so every reference resolves).
  const [
    assocsRes, industriesRes, addressesRes, citiesRes,
    usersRes, projectsRes, sourcesRes, stageRowsRes,
  ] = await Promise.all([
    fetchAll<ClientAssocRow>('client_association', 'client_assoc_id, client_name, industry_id'),
    fetchAll<IndustryRow>('industry_master', 'industry_id, industry_name'),
    fetchAll<AddressRow>('address_master', 'address_id, city_id'),
    fetchAll<CityRow>('city_master', 'city_id, city_name'),
    fetchAll<UserRow>('user_master', 'user_id, full_name'),
    fetchAll<ProjectRow>('project', 'project_id, project_name'),
    fetchAll<SourceRow>('source_master', 'source_id, source_name'),
    fetchAll<StageRow>('stage_master', 'stage_id, stage'),
  ]);

  // Latest lead_report per lead (for stage). Fetch all reports for our leads.
  const leadIds = leads.map((l) => l.lead_id);
  const reportsRes = leadIds.length > 0
    ? await fetchAll<ReportRow>(
        'lead_report',
        'report_id, lead_id, stage_id, user_id, updated_date',
        // Deterministic tiebreaker: when two reports for the same lead share
        // updated_date (or it's null), the highest report_id (newest row) wins, so
        // the picked stage never flips between loads.
        (q) => q.is('deleted_date', null).in('lead_id', leadIds)
          .order('updated_date', { ascending: false, nullsFirst: false })
          .order('report_id', { ascending: false }),
      )
    : { rows: [] as ReportRow[], error: null };
  const reports = reportsRes.rows;

  // Latest meeting per lead via meeting_schedule -> meeting_master.
  const reportIds = reports.map((r) => r.report_id);
  const meetingSchedules = reportIds.length > 0
    ? (await fetchAll<MeetingScheduleRow>(
        'meeting_schedule',
        'report_id, meeting_id',
        (q) => q.is('deleted_date', null).in('report_id', reportIds),
      )).rows
    : [];
  const meetingIds = [...new Set(meetingSchedules.map((ms) => ms.meeting_id).filter(Boolean))];
  const meetings = meetingIds.length > 0
    ? (await fetchAll<MeetingRow>(
        'meeting_master',
        'meeting_id, meeting_date',
        (q) => q.is('deleted_date', null).in('meeting_id', meetingIds),
      )).rows
    : [];

  /* ---- Build lookup maps keyed by correct PK ---- */
  const assocMap = new Map<number, ClientAssocRow>();
  assocsRes.rows.forEach((a) => assocMap.set(a.client_assoc_id, a));

  const industryMap = new Map<number, string>();
  industriesRes.rows.forEach((i) => industryMap.set(i.industry_id, i.industry_name));

  const addressMap = new Map<number, AddressRow>();
  addressesRes.rows.forEach((a) => addressMap.set(a.address_id, a));

  const cityMap = new Map<number, string>();
  citiesRes.rows.forEach((c) => cityMap.set(c.city_id, c.city_name));

  // created_by holds a user_id as text -> resolve to full_name.
  const userMap = new Map<string, string>();
  usersRes.rows.forEach((u) => userMap.set(String(u.user_id), u.full_name ?? ''));

  const projectMap = new Map<number, string>();
  projectsRes.rows.forEach((p) => projectMap.set(p.project_id, p.project_name ?? ''));

  const sourceMap = new Map<number, string>();
  sourcesRes.rows.forEach((s) => sourceMap.set(s.source_id, s.source_name ?? ''));

  const stageMap = new Map<number, string>();
  stageRowsRes.rows.forEach((s) => stageMap.set(s.stage_id, s.stage));

  // reports are ordered newest-first; keep the first seen per lead.
  const latestReportMap = new Map<number, ReportRow>();
  reports.forEach((r) => {
    if (!latestReportMap.has(r.lead_id)) latestReportMap.set(r.lead_id, r);
  });

  const reportMeetingMap = new Map<number, number>();
  meetingSchedules.forEach((ms) => {
    if (!reportMeetingMap.has(ms.report_id)) reportMeetingMap.set(ms.report_id, ms.meeting_id);
  });

  const meetingDateMap = new Map<number, string>();
  meetings.forEach((m) => { if (m.meeting_date) meetingDateMap.set(m.meeting_id, m.meeting_date); });

  /* ---- Resolve each lead ---- */
  const mapped: RealLead[] = leads.map((l) => {
    const assoc = l.client_assoc_id != null ? assocMap.get(l.client_assoc_id) : undefined;
    const company = assoc?.client_name ?? '';
    const industryName = assoc?.industry_id != null ? (industryMap.get(assoc.industry_id) ?? '') : '';

    const address = l.address_id != null ? addressMap.get(l.address_id) : undefined;
    const cityName = address?.city_id != null ? (cityMap.get(address.city_id) ?? '') : '';

    // Owner: created_by is a user_id-as-text. Fall back to the raw value for
    // legacy free-text entries (e.g. "Mohit Sharma") so it never shows blank.
    let agentName = '';
    if (l.created_by != null && l.created_by !== '') {
      agentName = userMap.get(l.created_by) ?? l.created_by;
    }

    const projectName = l.project_id != null ? (projectMap.get(l.project_id) ?? '') : '';
    const sourceName = l.source_id != null ? (sourceMap.get(l.source_id) ?? '') : '';

    const report = latestReportMap.get(l.lead_id);
    const stageName = report?.stage_id != null ? (stageMap.get(report.stage_id) ?? '') : '';

    // Assigned salesperson (owner-of-record): lead_report.user_id (latest report).
    // Distinct from `agent` (created_by = immutable provenance; see DEC-03).
    // Fallback: if no active report row exists (legacy lead not yet backfilled),
    // fall back to created_by so the column never renders blank before the
    // apply-dec03-backfill.cjs migration runs (Step 4, DEC-03).
    const salespersonUserId = report?.user_id ?? null;
    let salespersonName: string;
    if (salespersonUserId != null) {
      salespersonName = userMap.get(String(salespersonUserId)) ?? '';
    } else {
      // No report row → fall back to created_by (provenance = temporary owner display)
      salespersonName = l.created_by != null && l.created_by !== ''
        ? (userMap.get(l.created_by) ?? l.created_by)
        : '';
    }

    let meetingDate: string | null = null;
    if (report) {
      const meetingId = reportMeetingMap.get(report.report_id);
      if (meetingId) meetingDate = meetingDateMap.get(meetingId) ?? null;
    }

    const leadDate = l.created_date ? l.created_date.substring(0, 10) : '';
    const lastUpdated = l.updated_date ? l.updated_date.substring(0, 10) : leadDate;

    return {
      id: String(l.lead_id),
      leadNumber: l.lead_number ?? '',
      company,
      contactName: l.lead_name ?? '',
      contactEmail: l.email ?? '',
      contactPhone: l.mobile_no ?? '',
      industry: industryName,
      city: cityName,
      agent: agentName,
      salesperson: salespersonName,
      salespersonUserId,
      project: projectName,
      projectId: l.project_id ?? null,
      source: sourceName,
      stage: stageName,
      meetingDate,
      leadGeneratedDate: leadDate,
      lastUpdated,
    };
  });

  const uniq = (vals: string[]) => [...new Set(vals.filter(Boolean))].sort();

  return {
    leads: mapped,
    industries: uniq(mapped.map((l) => l.industry)),
    cities: uniq(mapped.map((l) => l.city)),
    agents: uniq(mapped.map((l) => l.agent)),
    salespeople: uniq(mapped.map((l) => l.salesperson)),
    projects: uniq(mapped.map((l) => l.project)),
    sources: uniq(mapped.map((l) => l.source)),
    stages: uniq(mapped.map((l) => l.stage)),
    error: null,
  };
}

export async function fetchDashboardStats(projectId: number | null = null): Promise<DashboardStats> {
  const empty: DashboardStats = {
    totalLeads: 0, meetingsThisWeek: 0, meetingsSuccessful: 0, callsToday: 0,
    stageBreakdown: [], recentActivity: [], error: null,
  };

  // ── Project scope (owner #8). When scoped, resolve the project's lead + meeting
  //    id universe once and constrain every stat to it (so the dashboard's numbers
  //    match the project-scoped Leads/Meetings lists). Dataset is small (~600
  //    leads) so an in-memory id set + chunked .in() filters are cheap and exact.
  //    projectId null = "All projects" → the original global queries (unchanged). ──
  let projectLeadIds: number[] | null = null;
  let projectMeetingIds: number[] | null = null;
  if (projectId != null) {
    const leadIdRes = await fetchAll<{ lead_id: number }>(
      'lead_master', 'lead_id',
      (q) => q.is('deleted_date', null).eq('project_id', projectId),
    );
    if (leadIdRes.error) return { ...empty, error: leadIdRes.error };
    projectLeadIds = leadIdRes.rows.map((r) => r.lead_id);
    if (projectLeadIds.length === 0) return empty; // project has no leads → all zeros

    const reportRows = await chunkedIn<{ report_id: number }>(
      'lead_report', 'report_id', 'lead_id', projectLeadIds,
      (q) => q.is('deleted_date', null),
    );
    const reportIds = [...new Set(reportRows.map((r) => r.report_id).filter(Boolean))];
    const schedRows = reportIds.length
      ? await chunkedIn<{ meeting_id: number }>(
          'meeting_schedule', 'meeting_id', 'report_id', reportIds,
          (q) => q.is('deleted_date', null),
        )
      : [];
    projectMeetingIds = [...new Set(schedRows.map((s) => s.meeting_id).filter(Boolean))];
  }

  const weekStart = getWeekStart();
  const weekEnd = getWeekEnd();

  // ── Total leads ──
  let totalLeads = 0;
  let totalErr: string | null = null;
  if (projectLeadIds) {
    totalLeads = projectLeadIds.length;
  } else {
    const r = await supabase.from('lead_master').select('lead_id', { count: 'exact', head: true }).is('deleted_date', null);
    totalLeads = r.count ?? 0;
    totalErr = r.error?.message ?? null;
  }

  // ── Meetings this week ──
  let meetingsThisWeek = 0;
  if (projectMeetingIds) {
    if (projectMeetingIds.length) {
      const rows = await chunkedIn<{ meeting_id: number }>(
        'meeting_master', 'meeting_id', 'meeting_id', projectMeetingIds,
        (q) => q.is('deleted_date', null).gte('meeting_date', weekStart).lt('meeting_date', weekEnd),
      );
      meetingsThisWeek = rows.length;
    }
  } else {
    const r = await supabase.from('meeting_master').select('meeting_id', { count: 'exact', head: true }).is('deleted_date', null).gte('meeting_date', weekStart).lt('meeting_date', weekEnd);
    meetingsThisWeek = r.count ?? 0;
  }

  // ── Meetings Successful (lead_report stage_id=8) ──
  let meetingsSuccessful = 0;
  if (projectLeadIds) {
    const rows = await chunkedIn<{ lead_id: number }>(
      'lead_report', 'lead_id', 'lead_id', projectLeadIds,
      (q) => q.is('deleted_date', null).eq('stage_id', 8),
    );
    meetingsSuccessful = rows.length;
  } else {
    const r = await supabase.from('lead_report').select('lead_id', { count: 'exact', head: true }).is('deleted_date', null).eq('stage_id', 8);
    meetingsSuccessful = r.count ?? 0;
  }

  // ── Stage distribution ──
  let stageDistRows: { stage_id: number }[] = [];
  if (projectLeadIds) {
    stageDistRows = await chunkedIn<{ stage_id: number }>(
      'lead_report', 'stage_id', 'lead_id', projectLeadIds,
      (q) => q.is('deleted_date', null),
    );
  } else {
    const r = await supabase.from('lead_report').select('stage_id').is('deleted_date', null);
    stageDistRows = (r.data ?? []) as unknown as { stage_id: number }[];
  }

  // ── Recent activity: last 5 leads updated (scoped to the project when set) ──
  let recentQuery: any = supabase
    .from('lead_master')
    .select('lead_id, lead_name, updated_date, client_assoc_id')
    .is('deleted_date', null);
  if (projectId != null) recentQuery = recentQuery.eq('project_id', projectId);
  const recentRes = await recentQuery.order('updated_date', { ascending: false, nullsFirst: false }).limit(5);

  // Stage names for distribution
  const { data: stageNamesRaw } = await supabase.from('stage_master').select('stage_id, stage');
  const stageNameMap = new Map<number, string>();
  ((stageNamesRaw ?? []) as unknown as StageRow[]).forEach((s) => stageNameMap.set(s.stage_id, s.stage));

  const stageCounts = new Map<string, number>();
  stageDistRows.forEach((row) => {
    const stageName = row.stage_id ? (stageNameMap.get(row.stage_id) ?? 'Unknown') : 'Unknown';
    stageCounts.set(stageName, (stageCounts.get(stageName) ?? 0) + 1);
  });
  const stageBreakdown = [...stageCounts.entries()]
    .map(([stage, count]) => ({ stage, count }))
    .sort((a, b) => b.count - a.count);

  // Recent activity: resolve company (client) names and stages
  interface RecentRaw { lead_id: number; lead_name: string | null; updated_date: string | null; client_assoc_id: number | null; }
  const recentLeads = (recentRes.data ?? []) as unknown as RecentRaw[];
  const recentLeadIds = recentLeads.map((l) => l.lead_id);
  const recentAssocIds = [...new Set(recentLeads.map((l) => l.client_assoc_id).filter((id): id is number => id !== null))];

  const [recentReportsRes, recentAssocsRes] = await Promise.all([
    recentLeadIds.length > 0
      ? supabase
          .from('lead_report')
          .select('report_id, lead_id, stage_id')
          .in('lead_id', recentLeadIds)
          .is('deleted_date', null)
          // Deterministic tiebreaker so the per-lead "latest report" stage never
          // flips on equal/null updated_date (newest report_id wins).
          .order('updated_date', { ascending: false, nullsFirst: false })
          .order('report_id', { ascending: false })
      : Promise.resolve({ data: [] }),
    recentAssocIds.length > 0
      ? supabase
          .from('client_association')
          .select('client_assoc_id, client_name')
          .in('client_assoc_id', recentAssocIds)
      : Promise.resolve({ data: [] }),
  ]);

  const recentStageMap = new Map<number, string>();
  ((recentReportsRes.data ?? []) as unknown as { lead_id: number; stage_id: number }[]).forEach((r) => {
    if (!recentStageMap.has(r.lead_id)) {
      recentStageMap.set(r.lead_id, r.stage_id ? (stageNameMap.get(r.stage_id) ?? '') : '');
    }
  });

  const recentCompanyMap = new Map<number, string>();
  ((recentAssocsRes.data ?? []) as unknown as { client_assoc_id: number; client_name: string | null }[]).forEach((c) => {
    recentCompanyMap.set(c.client_assoc_id, c.client_name ?? '');
  });

  const recentActivity = recentLeads.map((l) => ({
    leadId: l.lead_id,
    leadName: l.lead_name ?? '',
    companyName: l.client_assoc_id ? (recentCompanyMap.get(l.client_assoc_id) ?? '') : '',
    stage: recentStageMap.get(l.lead_id) ?? '',
    lastUpdated: l.updated_date ? l.updated_date.substring(0, 10) : '',
  }));

  // ── Calls logged TODAY (IST) — ALT-269 dashboard stat. ──────────────────────
  // call_log is staged (migration not yet applied); guard so a missing table
  // returns 0 rather than failing the whole dashboard. When a project scope is
  // active, count only calls tied to leads in that project (matching the other
  // scoped stats); otherwise count all calls (RLS still applies server-side).
  let callsToday = 0;
  try {
    const { startISO, endISO } = istTodayWindow();
    if (projectLeadIds) {
      if (projectLeadIds.length) {
        const rows = await chunkedIn<{ call_id: number }>(
          'call_log', 'call_id', 'lead_id', projectLeadIds,
          (q) => q.is('deleted_date', null).gte('called_at', startISO).lt('called_at', endISO),
        );
        callsToday = rows.length;
      }
    } else {
      const r = await supabase
        .from('call_log')
        .select('call_id', { count: 'exact', head: true })
        .is('deleted_date', null)
        .gte('called_at', startISO)
        .lt('called_at', endISO);
      callsToday = r.count ?? 0;
    }
  } catch {
    callsToday = 0; // table not applied yet → show 0
  }

  return {
    totalLeads,
    meetingsThisWeek,
    meetingsSuccessful,
    callsToday,
    stageBreakdown,
    recentActivity,
    error: totalErr,
  };
}

/** [start, end) ISO instants bounding the current IST (Asia/Kolkata) day. */
function istTodayWindow(now: Date = new Date()): { startISO: string; endISO: string } {
  const IST_OFFSET_MIN = 5 * 60 + 30; // India observes no DST.
  const MS_PER_MIN = 60_000;
  const MS_PER_DAY = 24 * 60 * MS_PER_MIN;
  const shifted = new Date(now.getTime() + IST_OFFSET_MIN * MS_PER_MIN);
  const istMidnightUtcMs =
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), 0, 0, 0, 0) -
    IST_OFFSET_MIN * MS_PER_MIN;
  return {
    startISO: new Date(istMidnightUtcMs).toISOString(),
    endISO: new Date(istMidnightUtcMs + MS_PER_DAY).toISOString(),
  };
}

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const mon = new Date(now);
  mon.setDate(diff);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${mon.getFullYear()}-${p(mon.getMonth() + 1)}-${p(mon.getDate())}`;
}

function getWeekEnd(): string {
  const start = new Date(getWeekStart());
  start.setDate(start.getDate() + 7);
  return start.toISOString().substring(0, 10);
}
