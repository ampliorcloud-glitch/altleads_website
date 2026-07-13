/**
 * REAL DATA layer for the Client Portal — reads the live CRM public tables
 * (meeting_master, meeting_schedule, lead_report, lead_master, company_master,
 * client_association, …) and maps them into the PortalMeeting shape the portal
 * pages already consume. Join chain verified against new-code/web/src/data/meetings.ts.
 *
 * Scoping (PortalScope):
 *   - { kind: 'all' }            → every meeting (admin / internal viewing)
 *   - { kind: 'user', userId }   → only meetings whose lead_report.user_id = userId
 *                                  (the assigned salesperson — NOT created_by)
 *
 * NOTE: the CRM currently runs with RLS OFF, so the authenticated client can read
 * all rows; scoping here is client-side. True per-tenant isolation requires the
 * RLS pass (separate, CRM-touching step).
 */
import { supabase } from '../lib/supabase'
import { PortalMeeting, PreSalesQA } from '../types/portal'

export type PortalScope = { kind: 'demo' } | { kind: 'all' } | { kind: 'user'; userId: number }

const CAP = 1500

function normTime(t: string | null | undefined): string {
  if (!t) return ''
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim())
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : t.trim()
}
function dateOnly(s: string | null | undefined): string | null {
  return s ? s.substring(0, 10) : null
}

/* small helper to load a lookup map id->name */
async function lookup(table: string, idCol: string, nameCol: string, ids: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>()
  if (!ids.length) return map
  const { data } = await supabase.from(table).select(`${idCol}, ${nameCol}`).in(idCol, ids)
  const rows = (data ?? []) as unknown as Record<string, unknown>[]
  rows.forEach((r) => map.set(Number(r[idCol]), String(r[nameCol] ?? '').trim()))
  return map
}

/**
 * Fetch meetings, scoped, mapped to PortalMeeting (list-level fields + assigned_user_id).
 */
export async function fetchRealMeetings(scope: PortalScope): Promise<PortalMeeting[]> {
  // 1. meetings
  const { data: mRaw, error } = await supabase
    .from('meeting_master')
    .select('meeting_id, meeting_name, meeting_date, meeting_time, meeting_mode, meeting_status, duration, meeting_url, description, reason, created_date')
    .is('deleted_date', null)
    .order('meeting_date', { ascending: false, nullsFirst: false })
    .limit(CAP)
  if (error || !mRaw) return []
  const meetings = mRaw as Array<Record<string, unknown>>
  const meetingIds = meetings.map((m) => Number(m.meeting_id))
  if (!meetingIds.length) return []

  // 2. schedule -> report
  const { data: schedRaw } = await supabase
    .from('meeting_schedule').select('meeting_id, report_id').is('deleted_date', null).in('meeting_id', meetingIds)
  const sched = (schedRaw ?? []) as Array<{ meeting_id: number; report_id: number }>
  const meetingReport = new Map<number, number>()
  sched.forEach((s) => { if (!meetingReport.has(s.meeting_id)) meetingReport.set(s.meeting_id, s.report_id) })

  // 3. reports -> lead + assigned user
  const reportIds = [...new Set(sched.map((s) => s.report_id).filter(Boolean))]
  const { data: repRaw } = reportIds.length
    ? await supabase.from('lead_report').select('report_id, lead_id, user_id, stage_id').is('deleted_date', null).in('report_id', reportIds)
    : { data: [] }
  const reports = (repRaw ?? []) as Array<{ report_id: number; lead_id: number; user_id: number | null; stage_id: number | null }>
  const reportMap = new Map<number, { lead_id: number; user_id: number | null }>()
  reports.forEach((r) => reportMap.set(r.report_id, { lead_id: r.lead_id, user_id: r.user_id }))

  // 4. leads
  const leadIds = [...new Set(reports.map((r) => r.lead_id).filter(Boolean))]
  const { data: leadRaw } = leadIds.length
    ? await supabase.from('lead_master').select('lead_id, lead_name, company_id, client_assoc_id, address_id, project_id, mobile_no').in('lead_id', leadIds)
    : { data: [] }
  const leads = (leadRaw ?? []) as Array<Record<string, unknown>>
  const leadMap = new Map<number, Record<string, unknown>>()
  leads.forEach((l) => leadMap.set(Number(l.lead_id), l))

  // 5. lookups: company, client, industry, city, reps
  const companyIds = [...new Set(leads.map((l) => l.company_id).filter((x): x is number => x != null))]
  const clientIds = [...new Set(leads.map((l) => l.client_assoc_id).filter((x): x is number => x != null))]
  const addressIds = [...new Set(leads.map((l) => l.address_id).filter((x): x is number => x != null))]
  const repIds = [...new Set(reports.map((r) => r.user_id).filter((x): x is number => x != null))]

  const companyMap = await lookup('company_master', 'company_id', 'company_name', companyIds)
  const repMap = await lookup('user_master', 'user_id', 'full_name', repIds)
  // client + industry
  const { data: clientRaw } = clientIds.length
    ? await supabase.from('client_association').select('client_assoc_id, client_name, industry_id').in('client_assoc_id', clientIds)
    : { data: [] }
  const clients = (clientRaw ?? []) as Array<{ client_assoc_id: number; client_name: string | null; industry_id: number | null }>
  const clientMap = new Map<number, { name: string; industry_id: number | null }>()
  clients.forEach((c) => clientMap.set(c.client_assoc_id, { name: (c.client_name ?? '').trim(), industry_id: c.industry_id }))
  const industryMap = await lookup('industry_master', 'industry_id', 'industry_name', [...new Set(clients.map((c) => c.industry_id).filter((x): x is number => x != null))])
  // address -> city
  const { data: addrRaw } = addressIds.length
    ? await supabase.from('address_master').select('address_id, city_id').in('address_id', addressIds)
    : { data: [] }
  const addrs = (addrRaw ?? []) as Array<{ address_id: number; city_id: number | null }>
  const addrCity = new Map<number, number>()
  addrs.forEach((a) => { if (a.city_id != null) addrCity.set(a.address_id, a.city_id) })
  const cityMap = await lookup('city_master', 'city_id', 'city_name', [...new Set(addrs.map((a) => a.city_id).filter((x): x is number => x != null))])

  // 6. build + scope
  const out: PortalMeeting[] = []
  for (const m of meetings) {
    const mid = Number(m.meeting_id)
    const reportId = meetingReport.get(mid)
    const rep = reportId != null ? reportMap.get(reportId) : undefined
    const assignedUserId = rep?.user_id ?? null

    // scope filter
    if (scope.kind === 'user' && assignedUserId !== scope.userId) continue

    const lead = rep?.lead_id != null ? leadMap.get(rep.lead_id) : undefined
    const clientRow = lead?.client_assoc_id != null ? clientMap.get(Number(lead.client_assoc_id)) : undefined
    const companyName = lead?.company_id != null ? companyMap.get(Number(lead.company_id)) ?? '' : ''
    const display = companyName || clientRow?.name || '—'
    const industry = clientRow?.industry_id != null ? industryMap.get(clientRow.industry_id) ?? '' : ''
    const cityId = lead?.address_id != null ? addrCity.get(Number(lead.address_id)) : undefined
    const city = cityId != null ? cityMap.get(cityId) ?? '' : ''

    out.push({
      meeting_id: mid,
      project_id: (lead?.project_id as number) ?? 0,
      client_assoc_id: (lead?.client_assoc_id as number) ?? 0,
      assigned_user_id: assignedUserId ?? 0,
      started_at: null,
      company_name: display,
      company_industry: industry || null,
      company_city: city || null,
      company_turnover: null, company_size: null, company_sector: null, company_sub_industry: null,
      company_web_url: null, company_linkedin_url: null, company_description: null,
      address_line_one: null, address_line_two: null, address_city: city || null, address_state: null, address_country: null,
      lead_name: ((lead?.lead_name as string) ?? '').trim() || null,
      lead_designation: null, lead_email: null,
      lead_mobile_no: ((lead?.mobile_no as string) ?? '').trim() || null,
      lead_alt_mobile_no: null, lead_linkedin_url: null, lead_role_and_resp: null, lead_area_of_interest: null,
      opportunity_title: null, opportunity_value: null, opportunity_description: null, sales_intelligence: null,
      meeting_name: ((m.meeting_name as string) ?? '').trim() || null,
      meeting_date: dateOnly(m.meeting_date as string),
      meeting_time: normTime(m.meeting_time as string),
      meeting_duration: ((m.duration as string) ?? '').trim() || null,
      meeting_mode: ((m.meeting_mode as string) ?? '').trim() || null,
      meeting_status: ((m.meeting_status as string) ?? '').trim() || null,
      meeting_url: ((m.meeting_url as string) ?? '').trim() || null,
      meeting_description: ((m.description as string) ?? '').trim() || null,
      meeting_reason: ((m.reason as string) ?? '').trim() || null,
      scheduled_by_name: null,
      assigned_rep_name: assignedUserId != null ? repMap.get(assignedUserId) ?? null : null,
      pre_sales_qa: null, agenda_discussion: null,
      snapshot_taken_at: (m.created_date as string) ?? new Date().toISOString(),
      snapshot_refreshed_at: null, snapshot_source: 'live',
    })
  }
  return out
}

/**
 * Full meeting detail (real), mapped to PortalMeeting. Scoped check applied by caller.
 */
export async function fetchRealMeetingDetail(meetingId: number): Promise<PortalMeeting | null> {
  const { data: mRaw } = await supabase
    .from('meeting_master')
    .select('meeting_id, meeting_name, meeting_date, meeting_time, meeting_mode, meeting_status, duration, meeting_url, description, reason, created_date')
    .eq('meeting_id', meetingId).is('deleted_date', null).maybeSingle()
  if (!mRaw) return null
  const m = mRaw as Record<string, unknown>

  const { data: schedRaw } = await supabase.from('meeting_schedule').select('report_id').eq('meeting_id', meetingId).is('deleted_date', null)
  const reportId = (schedRaw && schedRaw[0]) ? (schedRaw[0] as { report_id: number }).report_id : null

  let lead: Record<string, unknown> | null = null
  let assignedUserId: number | null = null
  let assignedRep: string | null = null
  let salesIntelligence: string | null = null
  let company = '—', industry = '', city = ''
  let preSalesQa: PreSalesQA[] | null = null
  let agenda: string | null = null

  if (reportId != null) {
    const { data: repRaw } = await supabase.from('lead_report').select('report_id, lead_id, user_id, sales_intelligence').eq('report_id', reportId).maybeSingle()
    const report = repRaw as { lead_id: number; user_id: number | null; sales_intelligence: string | null } | null
    assignedUserId = report?.user_id ?? null
    salesIntelligence = (report?.sales_intelligence ?? '') || null
    if (assignedUserId != null) {
      const { data: u } = await supabase.from('user_master').select('full_name').eq('user_id', assignedUserId).maybeSingle()
      assignedRep = ((u as { full_name: string } | null)?.full_name ?? '').trim() || null
    }
    if (report?.lead_id != null) {
      const { data: lRaw } = await supabase.from('lead_master')
        .select('lead_id, lead_name, company_id, client_assoc_id, address_id, project_id, email, mobile_no, alt_mobile_no, designation, linkedin_url, role_and_resp, area_of_interest, title, value, description')
        .eq('lead_id', report.lead_id).maybeSingle()
      lead = (lRaw as Record<string, unknown>) ?? null
      let companyName = ''
      if (lead?.company_id != null) {
        const { data: c } = await supabase.from('company_master').select('company_name').eq('company_id', lead.company_id as number).maybeSingle()
        companyName = ((c as { company_name: string } | null)?.company_name ?? '').trim()
      }
      if (lead?.client_assoc_id != null) {
        const { data: cl } = await supabase.from('client_association').select('client_name, industry_id').eq('client_assoc_id', lead.client_assoc_id as number).maybeSingle()
        const clRow = cl as { client_name: string | null; industry_id: number | null } | null
        company = companyName || (clRow?.client_name ?? '').trim() || '—'
        if (clRow?.industry_id != null) {
          const { data: ind } = await supabase.from('industry_master').select('industry_name').eq('industry_id', clRow.industry_id).maybeSingle()
          industry = ((ind as { industry_name: string } | null)?.industry_name ?? '').trim()
        }
      } else {
        company = companyName || '—'
      }
      if (lead?.address_id != null) {
        const { data: a } = await supabase.from('address_master').select('city_id').eq('address_id', lead.address_id as number).maybeSingle()
        const cityId = (a as { city_id: number | null } | null)?.city_id
        if (cityId != null) {
          const { data: ct } = await supabase.from('city_master').select('city_name').eq('city_id', cityId).maybeSingle()
          city = ((ct as { city_name: string } | null)?.city_name ?? '').trim()
        }
      }
    }
    // pre-sales Q&A
    const { data: psaRaw } = await supabase.from('pre_sales_answer').select('pre_sa_que_id, answer').eq('report_id', reportId).is('deleted_date', null)
    const psa = (psaRaw ?? []) as Array<{ pre_sa_que_id: number; answer: string | null }>
    if (psa.length) {
      const qMap = await (async () => {
        const { data } = await supabase.from('pre_sales_question').select('pre_sa_que_id, short_question, question').in('pre_sa_que_id', [...new Set(psa.map((p) => p.pre_sa_que_id))])
        const map = new Map<number, { short: string; q: string }>()
        ;(data ?? []).forEach((r: Record<string, unknown>) => map.set(Number(r.pre_sa_que_id), { short: String(r.short_question ?? ''), q: String(r.question ?? '') }))
        return map
      })()
      preSalesQa = psa.map((p) => {
        const q = qMap.get(p.pre_sa_que_id)
        return { question: q?.q ?? '', short_question: q?.short ?? '', answer: (p.answer ?? '').trim() }
      }).filter((x) => x.answer)
      agenda = preSalesQa.find((x) => x.short_question === 'Discussion')?.answer ?? null
    }
  }

  return {
    meeting_id: meetingId,
    project_id: (lead?.project_id as number) ?? 0,
    client_assoc_id: (lead?.client_assoc_id as number) ?? 0,
    assigned_user_id: assignedUserId ?? 0,
    started_at: null,
    company_name: company,
    company_industry: industry || null,
    company_city: city || null,
    company_turnover: null, company_size: null, company_sector: null, company_sub_industry: null,
    company_web_url: null, company_linkedin_url: null, company_description: null,
    address_line_one: null, address_line_two: null, address_city: city || null, address_state: null, address_country: null,
    lead_name: ((lead?.lead_name as string) ?? '').trim() || null,
    lead_designation: ((lead?.designation as string) ?? '').trim() || null,
    lead_email: ((lead?.email as string) ?? '').trim() || null,
    lead_mobile_no: ((lead?.mobile_no as string) ?? '').trim() || null,
    lead_alt_mobile_no: ((lead?.alt_mobile_no as string) ?? '').trim() || null,
    lead_linkedin_url: ((lead?.linkedin_url as string) ?? '').trim() || null,
    lead_role_and_resp: ((lead?.role_and_resp as string) ?? '').trim() || null,
    lead_area_of_interest: ((lead?.area_of_interest as string) ?? '').trim() || null,
    opportunity_title: ((lead?.title as string) ?? '').trim() || null,
    opportunity_value: lead?.value != null ? String(lead.value) : null,
    opportunity_description: ((lead?.description as string) ?? '').trim() || null,
    sales_intelligence: salesIntelligence,
    meeting_name: ((m.meeting_name as string) ?? '').trim() || null,
    meeting_date: dateOnly(m.meeting_date as string),
    meeting_time: normTime(m.meeting_time as string),
    meeting_duration: ((m.duration as string) ?? '').trim() || null,
    meeting_mode: ((m.meeting_mode as string) ?? '').trim() || null,
    meeting_status: ((m.meeting_status as string) ?? '').trim() || null,
    meeting_url: ((m.meeting_url as string) ?? '').trim() || null,
    meeting_description: ((m.description as string) ?? '').trim() || null,
    meeting_reason: ((m.reason as string) ?? '').trim() || null,
    scheduled_by_name: null,
    assigned_rep_name: assignedRep,
    pre_sales_qa: preSalesQa,
    agenda_discussion: agenda,
    snapshot_taken_at: (m.created_date as string) ?? new Date().toISOString(),
    snapshot_refreshed_at: null, snapshot_source: 'live',
  }
}

/** Status counts for the Home overview + dashboard, from a meeting list. */
export function metricsFromMeetings(ms: PortalMeeting[]) {
  return {
    scheduled: ms.filter((m) => ['Scheduled', 'Confirmed'].includes(m.meeting_status ?? '')).length,
    completed: ms.filter((m) => m.meeting_status === 'Completed').length,
    rescheduled: ms.filter((m) => m.meeting_status === 'Rescheduled').length,
    dropped: ms.filter((m) => m.meeting_status === 'Cancelled').length,
    missed: ms.filter((m) => m.meeting_status === 'Missed').length,
  }
}

/** Coverage-by-key aggregation for the dashboard (vertical/city). */
export function countBy(ms: PortalMeeting[], key: (m: PortalMeeting) => string | null, top = 6) {
  const map = new Map<string, number>()
  ms.forEach((m) => { const k = (key(m) ?? '').trim(); if (k) map.set(k, (map.get(k) ?? 0) + 1) })
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, top).map(([label, value]) => ({ label, value }))
}
