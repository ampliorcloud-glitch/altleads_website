/**
 * leadsApi.ts — all Supabase read/write operations for the Leads module.
 *
 * Stage workflow note: stage is stored in lead_report (joined to stage_master),
 * not in lead_master.stage (that column is legacy/mostly null).
 * Changing stage = updating the stage_id on the existing lead_report row.
 * Full stage workflow (approval flows, meeting creation, etc.) is phase-3 work.
 */

import { supabase } from './supabase';
import { notify, notifyInApp, resolveUserEmailAndName } from './notify';
import {
  concurrencyPrecondition,
  makeConflict,
  type ConflictResult,
} from './concurrency';

/* ── Types ─────────────────────────────────────────────────────────────── */

export interface LeadDetail {
  lead_id: number;
  lead_number: string;
  lead_name: string;
  email: string;
  mobile_no: string;
  alt_mobile_no: string;
  designation: string;
  title: string;
  description: string;
  area_of_interest: string;
  role_and_resp: string;
  value: string;
  linkedin_url: string;
  is_closed: boolean;
  created_date: string | null;
  updated_date: string | null;
  created_by: string;

  // resolved via FK
  agent_id: number | null;
  agent_name: string;
  company_id: number | null;
  company_name: string;
  company_industry: string;
  address_id: number | null;
  city_name: string;
  source_id: number | null;
  source_name: string;
  project_id: number | null;
  project_name: string;
  client_assoc_id: number | null;
  client_name: string;

  // current stage from lead_report
  report_id: number | null;
  stage_id: number | null;
  stage_name: string;

  // assigned salesperson (lead_report.user_id) — the reassignable owner (ALT-288)
  salesperson_user_id: number | null;
  salesperson_name: string;
}

export interface ActivityItem {
  activity_id: number;
  lead_comments: string;
  created_date: string;
  created_by_name: string;
}

export interface MeetingItem {
  meeting_id: number;
  meeting_name: string;
  meeting_date: string | null;
  meeting_time: string | null;
  meeting_mode: string | null;
  meeting_status: string | null;
  description: string;
}

export interface LookupOption {
  id: number;
  label: string;
}

export interface LeadFormData {
  lead_name: string;
  mobile_no: string;
  alt_mobile_no: string;
  email: string;
  designation: string;
  title: string;
  company_id: number | null;
  new_company_name: string; // if set, create a new company
  agent_id: number | null;
  source_id: number | null;
  project_id: number | null;
  client_assoc_id: number | null;
  city_id: number | null;
  area_of_interest: string;
  value: string;
  description: string;
  linkedin_url: string;
  role_and_resp: string;
  /** FK to contact_master — set when the lead is linked to an existing contact */
  contact_id: number | null;
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

function fmt(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ── Fetch single lead detail ───────────────────────────────────────────── */

export async function fetchLeadDetail(leadId: number): Promise<LeadDetail | null> {
  const { data: lm, error } = await supabase
    .from('lead_master')
    .select(
      'lead_id, lead_number, lead_name, email, mobile_no, alt_mobile_no, designation, title, description, area_of_interest, role_and_resp, value, linkedin_url, is_closed, created_date, updated_date, created_by, agent_id, company_id, address_id, source_id, project_id, client_assoc_id'
    )
    .eq('lead_id', leadId)
    .is('deleted_date', null)
    .maybeSingle();

  if (error || !lm) return null;

  const row = lm as Record<string, unknown>;

  // Parallel lookups
  const [
    companyRes,
    agentRes,
    sourceRes,
    projectRes,
    clientRes,
    reportRes,
  ] = await Promise.all([
    row.company_id
      ? supabase
          .from('company_master')
          .select('company_id, company_name, industry_id')
          .eq('company_id', row.company_id as number)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    row.agent_id
      ? supabase
          .from('user_master')
          .select('user_id, full_name')
          .eq('user_id', row.agent_id as number)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    row.source_id
      ? supabase
          .from('source_master')
          .select('source_id, source_name')
          .eq('source_id', row.source_id as number)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    row.project_id
      ? supabase
          .from('project')
          .select('project_id, project_name')
          .eq('project_id', row.project_id as number)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    row.client_assoc_id
      ? supabase
          .from('client_association')
          .select('client_assoc_id, client_name')
          .eq('client_assoc_id', row.client_assoc_id as number)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    // Latest lead_report
    supabase
      .from('lead_report')
      .select('report_id, stage_id, user_id, created_date, updated_date')
      .eq('lead_id', leadId)
      .is('deleted_date', null)
      .order('updated_date', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const company = companyRes.data as { company_id: number; company_name: string; industry_id: number } | null;
  const agent = agentRes.data as { user_id: number; full_name: string } | null;
  const source = sourceRes.data as { source_id: number; source_name: string } | null;
  const project = projectRes.data as { project_id: number; project_name: string } | null;
  const client = clientRes.data as { client_assoc_id: number; client_name: string } | null;
  const report = reportRes.data as { report_id: number; stage_id: number; user_id: number | null; created_date: string; updated_date: string } | null;

  // Resolve industry & city (+ assigned salesperson name)
  const [industryRes, cityRes, stageRes, salespersonRes] = await Promise.all([
    company?.industry_id
      ? supabase
          .from('industry_master')
          .select('industry_name')
          .eq('industry_id', company.industry_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    row.address_id
      ? supabase
          .from('address_master')
          .select('city_id')
          .eq('address_id', row.address_id as number)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    report?.stage_id
      ? supabase
          .from('stage_master')
          .select('stage')
          .eq('stage_id', report.stage_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    report?.user_id
      ? supabase
          .from('user_master')
          .select('full_name')
          .eq('user_id', report.user_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const industryName = (industryRes.data as { industry_name: string } | null)?.industry_name ?? '';
  const cityId = (cityRes.data as { city_id: number } | null)?.city_id ?? null;
  const stageName = (stageRes.data as { stage: string } | null)?.stage ?? '';
  const salespersonName = (salespersonRes.data as { full_name: string } | null)?.full_name ?? '';

  let cityName = '';
  if (cityId) {
    const { data: cityData } = await supabase
      .from('city_master')
      .select('city_name')
      .eq('city_id', cityId)
      .maybeSingle();
    cityName = (cityData as { city_name: string } | null)?.city_name ?? '';
  }

  return {
    lead_id: row.lead_id as number,
    lead_number: (row.lead_number as string) ?? '',
    lead_name: (row.lead_name as string) ?? '',
    email: (row.email as string) ?? '',
    mobile_no: (row.mobile_no as string) ?? '',
    alt_mobile_no: (row.alt_mobile_no as string) ?? '',
    designation: (row.designation as string) ?? '',
    title: (row.title as string) ?? '',
    description: (row.description as string) ?? '',
    area_of_interest: (row.area_of_interest as string) ?? '',
    role_and_resp: (row.role_and_resp as string) ?? '',
    value: (row.value as string) ?? '',
    linkedin_url: (row.linkedin_url as string) ?? '',
    is_closed: (row.is_closed as boolean) ?? false,
    created_date: (row.created_date as string) ?? null,
    updated_date: (row.updated_date as string) ?? null,
    created_by: (row.created_by as string) ?? '',
    agent_id: (row.agent_id as number) ?? null,
    agent_name: agent?.full_name ?? '',
    company_id: (row.company_id as number) ?? null,
    company_name: company?.company_name ?? '',
    company_industry: industryName,
    address_id: (row.address_id as number) ?? null,
    city_name: cityName,
    source_id: (row.source_id as number) ?? null,
    source_name: source?.source_name ?? '',
    project_id: (row.project_id as number) ?? null,
    project_name: project?.project_name ?? '',
    client_assoc_id: (row.client_assoc_id as number) ?? null,
    client_name: client?.client_name ?? '',
    report_id: report?.report_id ?? null,
    stage_id: report?.stage_id ?? null,
    stage_name: stageName,
    salesperson_user_id: report?.user_id ?? null,
    salesperson_name: salespersonName,
  };
}

/* ── Fetch activity timeline ─────────────────────────────────────────────── */

export async function fetchLeadActivity(leadId: number): Promise<ActivityItem[]> {
  const { data } = await supabase
    .from('lead_activity')
    .select('activity_id, lead_comments, created_date, created_by')
    .eq('lead_id', leadId)
    .is('deleted_date', null)
    .order('created_date', { ascending: false })
    .limit(50);

  if (!data || data.length === 0) return [];

  const rows = data as { activity_id: number; lead_comments: string; created_date: string; created_by: string }[];

  // Resolve creator names
  const creatorIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean))];
  const userMap = new Map<string, string>();
  if (creatorIds.length > 0) {
    const numericIds = creatorIds.map(Number).filter((n) => !isNaN(n));
    if (numericIds.length > 0) {
      const { data: users } = await supabase
        .from('user_master')
        .select('user_id, full_name')
        .in('user_id', numericIds);
      ((users ?? []) as { user_id: number; full_name: string }[]).forEach((u) => {
        userMap.set(String(u.user_id), u.full_name ?? '');
      });
    }
  }

  return rows.map((r) => ({
    activity_id: r.activity_id,
    lead_comments: r.lead_comments ?? '',
    created_date: fmt(r.created_date),
    created_by_name: userMap.get(r.created_by) || 'System',
  }));
}

/* ── Fetch related meetings ──────────────────────────────────────────────── */

export async function fetchLeadMeetings(leadId: number): Promise<MeetingItem[]> {
  // lead -> lead_report -> meeting_schedule -> meeting_master
  const { data: reports } = await supabase
    .from('lead_report')
    .select('report_id')
    .eq('lead_id', leadId)
    .is('deleted_date', null);

  if (!reports || reports.length === 0) return [];
  const reportIds = (reports as { report_id: number }[]).map((r) => r.report_id);

  const { data: schedules } = await supabase
    .from('meeting_schedule')
    .select('meeting_id')
    .in('report_id', reportIds)
    .is('deleted_date', null);

  if (!schedules || schedules.length === 0) return [];
  const meetingIds = [...new Set((schedules as { meeting_id: number }[]).map((s) => s.meeting_id).filter(Boolean))];

  if (meetingIds.length === 0) return [];

  const { data: meetings } = await supabase
    .from('meeting_master')
    .select('meeting_id, meeting_name, meeting_date, meeting_time, meeting_mode, meeting_status, description')
    .in('meeting_id', meetingIds)
    .is('deleted_date', null)
    .order('meeting_date', { ascending: false, nullsFirst: false });

  if (!meetings) return [];

  return (meetings as {
    meeting_id: number;
    meeting_name: string;
    meeting_date: string | null;
    meeting_time: string | null;
    meeting_mode: string | null;
    meeting_status: string | null;
    description: string;
  }[]).map((m) => ({
    meeting_id: m.meeting_id,
    meeting_name: m.meeting_name ?? '',
    meeting_date: m.meeting_date ? fmt(m.meeting_date) : null,
    meeting_time: m.meeting_time ?? null,
    meeting_mode: m.meeting_mode ?? null,
    meeting_status: m.meeting_status ?? null,
    description: m.description ?? '',
  }));
}

/* ── Lookup fetchers for dropdowns ──────────────────────────────────────── */

export async function fetchLookups(): Promise<{
  companies: LookupOption[];
  users: LookupOption[];
  sources: LookupOption[];
  projects: LookupOption[];
  clients: LookupOption[];
  cities: LookupOption[];
  stages: LookupOption[];
}> {
  const [companiesRes, usersRes, sourcesRes, projectsRes, clientsRes, citiesRes, stagesRes] = await Promise.all([
    supabase.from('company_master').select('company_id, company_name').is('deleted_date', null).order('company_name'),
    supabase.from('user_master').select('user_id, full_name').is('deleted_date', null).eq('enabled', true).order('full_name'),
    supabase.from('source_master').select('source_id, source_name').is('deleted_date', null).order('source_name'),
    supabase.from('project').select('project_id, project_name').is('deleted_date', null).eq('enabled', true).order('project_name'),
    supabase.from('client_association').select('client_assoc_id, client_name').is('deleted_date', null).order('client_name'),
    supabase.from('city_master').select('city_id, city_name').is('deleted_date', null).order('city_name'),
    supabase.from('stage_master').select('stage_id, stage').is('deleted_date', null).order('stage_id'),
  ]);

  return {
    companies: ((companiesRes.data ?? []) as { company_id: number; company_name: string }[]).map((c) => ({ id: c.company_id, label: c.company_name })),
    users: ((usersRes.data ?? []) as { user_id: number; full_name: string }[]).map((u) => ({ id: u.user_id, label: u.full_name ?? '' })).filter((u) => u.label),
    sources: ((sourcesRes.data ?? []) as { source_id: number; source_name: string }[]).map((s) => ({ id: s.source_id, label: s.source_name })),
    projects: ((projectsRes.data ?? []) as { project_id: number; project_name: string }[]).map((p) => ({ id: p.project_id, label: p.project_name })),
    clients: ((clientsRes.data ?? []) as { client_assoc_id: number; client_name: string }[]).map((c) => ({ id: c.client_assoc_id, label: c.client_name })),
    cities: ((citiesRes.data ?? []) as { city_id: number; city_name: string }[]).map((c) => ({ id: c.city_id, label: c.city_name ?? '' })).filter((c) => c.label),
    stages: ((stagesRes.data ?? []) as { stage_id: number; stage: string }[]).map((s) => ({ id: s.stage_id, label: s.stage })),
  };
}

/* ── Generate next lead_number ────────────────────────────────────────────── */

export async function generateLeadNumber(): Promise<string> {
  // Scan ALL lead numbers (one small column) for the true global max. A windowed
  // scan (e.g. last 50 by lead_id) misses the real max when lead_number and lead_id
  // diverge, producing a number that already exists.
  const { data } = await supabase
    .from('lead_master')
    .select('lead_number')
    .not('lead_number', 'is', null)
    .limit(100000);

  let max = 0;
  for (const row of (data ?? []) as { lead_number: string }[]) {
    const m = /^ALT(\d+)$/.exec(row.lead_number ?? '');
    if (m) {
      const num = parseInt(m[1], 10);
      if (num > max) max = num;
    }
  }
  return `ALT${max + 1}`;
}

/**
 * Insert a lead, allocating a unique lead_number and retrying if another insert
 * raced us to the same one (unique constraint lead_master_lead_number_key).
 * `payload` must NOT include lead_number — this function sets it.
 */
export async function insertLeadWithUniqueNumber(
  payload: Record<string, unknown>
): Promise<{ lead_id: number } | { error: string }> {
  let next = await generateLeadNumber();
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, error } = await supabase
      .from('lead_master')
      .insert({ ...payload, lead_number: next })
      .select('lead_id')
      .single();
    if (!error && data) return { lead_id: (data as { lead_id: number }).lead_id };
    const isDup =
      !!error &&
      (error.code === '23505' || /duplicate key|lead_number/i.test(error.message ?? ''));
    if (!isDup) return { error: error?.message ?? 'Failed to create lead' };
    const m = /^ALT(\d+)$/.exec(next);
    next = `ALT${(m ? parseInt(m[1], 10) : 0) + 1}`;
  }
  return { error: 'Could not allocate a unique lead number — please try again.' };
}

/* ── Create company if needed ─────────────────────────────────────────────── */

async function ensureCompany(
  companyId: number | null,
  newCompanyName: string,
  createdBy: string
): Promise<{ companyId: number | null } | { error: string }> {
  if (companyId) return { companyId };
  if (!newCompanyName.trim()) return { companyId: null };

  // Try to find existing (limit(1) guards against >1 same-named rows breaking maybeSingle)
  const { data: existing } = await supabase
    .from('company_master')
    .select('company_id')
    .ilike('company_name', newCompanyName.trim())
    .is('deleted_date', null)
    .limit(1)
    .maybeSingle();
  if (existing) return { companyId: (existing as { company_id: number }).company_id };

  // Create new. company_master's only NOT-NULL columns are company_name, created_by,
  // created_date. All lookup FKs (industry_id, domain_id, city_id, sector_id, ...) are
  // nullable, so we omit them — the previous code inserted non-existent columns
  // (address_id, country_code_id) and a FK-violating industry_id:1 (industry_master has
  // no id 1; valid ids are 2..21), which made every inline new-company create fail.
  const { data: newCo, error } = await supabase
    .from('company_master')
    .insert({
      company_name: newCompanyName.trim(),
      is_lead: true,
      created_by: createdBy,
      created_date: new Date().toISOString(),
    })
    .select('company_id')
    .single();

  if (error || !newCo) {
    return { error: error?.message ?? 'Failed to create company.' };
  }
  return { companyId: (newCo as { company_id: number }).company_id };
}

/* ── Ensure address row for city ──────────────────────────────────────────── */

async function ensureAddress(
  cityId: number | null,
  createdBy: string,
  existingAddressId: number | null = null
): Promise<number | null> {
  if (existingAddressId) return existingAddressId;
  if (!cityId) return null;

  const { data: addr, error } = await supabase
    .from('address_master')
    .insert({
      city_id: cityId,
      created_by: createdBy,
      created_date: new Date().toISOString(),
    })
    .select('address_id')
    .single();

  if (error || !addr) return null;
  return (addr as { address_id: number }).address_id;
}

/* ── Insert new lead ─────────────────────────────────────────────────────── */

export async function createLead(
  form: LeadFormData,
  createdBy: string,
  defaultSourceId: number,
  defaultClientAssocId: number
): Promise<{ lead_id: number } | { error: string }> {
  const now = new Date().toISOString();

  const companyRes = await ensureCompany(form.company_id, form.new_company_name, createdBy);
  if ('error' in companyRes) return { error: companyRes.error };
  const companyId = companyRes.companyId;
  const addressId = await ensureAddress(form.city_id, createdBy);

  // Ownership = lead_master.created_by (the list/detail resolve the owner from it,
  // NOT from agent_id). The "Agent (Owner)" dropdown is a user_id, so the chosen
  // agent must become the owner; fall back to the creating user when left blank.
  const ownerId = form.agent_id != null ? String(form.agent_id) : createdBy;

  const payload = {
    lead_name: form.lead_name.trim(),
    mobile_no: form.mobile_no.trim(),
    alt_mobile_no: form.alt_mobile_no.trim() || '',
    email: form.email.trim() || '',
    designation: form.designation.trim() || '',
    title: form.title.trim() || '',
    company_id: companyId,
    agent_id: form.agent_id,
    source_id: form.source_id ?? defaultSourceId,
    project_id: form.project_id,
    client_assoc_id: form.client_assoc_id ?? defaultClientAssocId,
    address_id: addressId,
    area_of_interest: form.area_of_interest.trim() || '',
    value: form.value.trim() || '0',
    description: form.description.trim() || '',
    linkedin_url: form.linkedin_url.trim() || '',
    role_and_resp: form.role_and_resp.trim() || '',
    is_closed: false,
    stage: '',
    created_by: ownerId,
    created_date: now,
    contact_id: form.contact_id ?? null,
  };

  const result = await insertLeadWithUniqueNumber(payload);

  // Seed an initial lead_report so the new lead has an assignee and stage from
  // the start (mirrors convertWishlistToLead in data/wishlist.ts).
  // user_id = ownerId (the agent if chosen, else the creator) — same value that
  // went into lead_master.created_by.  Best-effort: surface the error through
  // the return value if it fails, but do NOT roll back the lead_master row.
  if (!('error' in result)) {
    const reportUserId = Number(ownerId);
    const { error: reportError } = await supabase.from('lead_report').insert({
      lead_id: result.lead_id,
      user_id: reportUserId,
      stage_id: 1,            // "Warm" — lowest/initial stage in stage_master
      report_status: 'Warm',
      created_by: ownerId,
      created_date: now,
    });
    if (reportError) {
      return { error: `Lead created (id=${result.lead_id}) but failed to seed lead_report: ${reportError.message}` };
    }
  }

  // Fire-and-forget: notify assigned agent if one was chosen
  if (!('error' in result) && form.agent_id) {
    const leadId = result.lead_id;
    const agentId = form.agent_id;
    (async () => {
      try {
        const { email: agentEmail } = await resolveUserEmailAndName(supabase, agentId);
        const creatorInfo = await resolveUserEmailAndName(supabase, Number(createdBy));
        const eventData = {
          leadName: form.lead_name.trim(),
          company: form.new_company_name.trim() || '',
          assignedByName: creatorInfo.name || createdBy,
        };
        if (agentEmail) {
          await notify('lead_assigned', agentEmail, eventData);
        }
        await notifyInApp(supabase, agentId, {
          status: 'New Assignment',
          notif_descr: `New lead assigned to you: "${form.lead_name.trim()}"`,
          route: `/leads/${leadId}`,
          actor: createdBy,
        });
      } catch {
        /* non-fatal */
      }
    })();
  }

  return result;
}

/* ── Update existing lead ────────────────────────────────────────────────── */

export async function updateLead(
  leadId: number,
  form: LeadFormData,
  updatedBy: string,
  existingAddressId: number | null,
  existingCityId: number | null,
  /** Original updated_date loaded into the edit form (used by the concurrency guard). */
  originalUpdatedDate?: string | null
): Promise<{ error: string } | ConflictResult | null> {
  const now = new Date().toISOString();

  const companyRes = await ensureCompany(form.company_id, form.new_company_name, updatedBy);
  if ('error' in companyRes) return { error: companyRes.error };
  const companyId = companyRes.companyId;

  // Only create a new address if city changed
  let addressId: number | null = existingAddressId;
  if (form.city_id && form.city_id !== existingCityId) {
    addressId = await ensureAddress(form.city_id, updatedBy);
  }

  const payload: Record<string, unknown> = {
    lead_name: form.lead_name.trim(),
    mobile_no: form.mobile_no.trim(),
    alt_mobile_no: form.alt_mobile_no.trim() || '',
    email: form.email.trim() || '',
    designation: form.designation.trim() || '',
    title: form.title.trim() || '',
    company_id: companyId,
    // agent_id is kept for FK integrity (legacy column); still written so the
    // lead_master.agent_id column stays in sync with the picker value.
    agent_id: form.agent_id,
    source_id: form.source_id,
    project_id: form.project_id,
    client_assoc_id: form.client_assoc_id,
    area_of_interest: form.area_of_interest.trim() || '',
    value: form.value.trim() || '0',
    description: form.description.trim() || '',
    linkedin_url: form.linkedin_url.trim() || '',
    role_and_resp: form.role_and_resp.trim() || '',
    updated_by: updatedBy,
    updated_date: now,
    contact_id: form.contact_id ?? null,
    // DEC-03 (Step 3): created_by is IMMUTABLE PROVENANCE — never rewrite it from
    // the Edit form. Ownership = lead_report.user_id, changed only via ReassignModal
    // (assignment.ts reassignLead writes lead_report.user_id, gated to TL/Admin).
    // TODO(gatekeeper ALT-431): route reassign through ownership.reassign action
  };

  if (addressId !== existingAddressId) {
    payload.address_id = addressId;
  }

  const guard = concurrencyPrecondition(originalUpdatedDate);
  if (guard !== undefined) {
    // Guard active: add updated_date precondition and request affected rows back.
    const { data: affected, error } = await supabase
      .from('lead_master')
      .update(payload)
      .eq('lead_id', leadId)
      .eq('updated_date', guard)
      .select('lead_id');
    if (error) return { error: (error as { message: string }).message };
    if (!affected || affected.length === 0) return makeConflict('lead_master');
    return null;
  }

  // Guard off: original behaviour — no precondition, no row-count check.
  const { error } = await supabase.from('lead_master').update(payload).eq('lead_id', leadId);
  if (error) return { error: (error as { message: string }).message };
  return null;
}

/* ── Update stage ────────────────────────────────────────────────────────── */
// stage workflow: phase 3 follow-up
// Current behaviour: updates stage_id on the existing lead_report row (if any).
// Does NOT create meeting records or handle approval flows — those are phase-3.

export async function updateLeadStage(
  reportId: number,
  stageId: number,
  updatedBy: string,
  /** Original updated_date of the lead_report row (used by the concurrency guard). */
  originalUpdatedDate?: string | null
): Promise<{ error: string } | ConflictResult | null> {
  const payload = {
    stage_id: stageId,
    updated_by: updatedBy,
    updated_date: new Date().toISOString(),
  };
  const guard = concurrencyPrecondition(originalUpdatedDate);
  if (guard !== undefined) {
    const { data: affected, error } = await supabase
      .from('lead_report')
      .update(payload)
      .eq('report_id', reportId)
      .eq('updated_date', guard)
      .select('report_id');
    if (error) return { error: (error as { message: string }).message };
    if (!affected || affected.length === 0) return makeConflict('lead_report');
    return null;
  }

  const { error } = await supabase.from('lead_report').update(payload).eq('report_id', reportId);
  if (error) return { error: (error as { message: string }).message };
  return null;
}

/* ── Exported date formatter for use in components ─────────────────────── */

export { fmt as formatDate };
