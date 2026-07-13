/**
 * Companies data layer — Supabase reads/writes for the Companies module.
 *
 * Tables:
 *   company_master   — the company records (both is_demo=false and is_demo=true).
 *                      domain_clean is the normalised website domain used for dedup.
 *   contact_master   — contacts; contact.company_id -> company_master.company_id.
 *   lead_master      — deals; lead.company_id -> company_master.company_id.
 *   industry_master  — industry_id -> industry_name.
 *   city_master      — city_id -> city_name.
 *   project          — project_name (display-only selector in the detail header).
 *
 * NOTE: Owner is always "Unassigned" for now. company_master has no owner FK,
 * and ownership/assignment is a later phase. // TODO ownership
 *
 * All reads page through every row (PostgREST caps a single select at 1000),
 * mirroring the pattern in realLeads.ts so nothing silently truncates.
 */

import { supabase } from '../lib/supabase';
import { humanizeWriteError } from '../lib/writeError';
import { isMetroCity } from '../lib/hungerbox';

/* ------------------------------------------------------------------
   Public types
------------------------------------------------------------------ */

export interface Company {
  id: string;
  name: string;
  domainClean: string;
  webUrl: string;
  cin: string;
  industry: string;
  city: string;
  size: number | null;
  /** Revenue / turnover band label (from turnover_master.turnover), '' when unset. */
  turnover: string;
  /** Free-text company description from company_master.description, '' when unset. */
  description: string;
  email: string;
  linkedin: string;
  isDemo: boolean;
  owner: string; // always "Unassigned" // TODO ownership
  createdDate: string;
  /** True when the company's primary city is a Tier-1 Indian metro (derived client-side). */
  isMetro: boolean;
}

export interface CompaniesResult {
  companies: Company[];
  industries: string[];
  cities: string[];
  error: string | null;
}

export interface CompanyContact {
  id: string;
  fullName: string;
  designation: string;
  /** null when masked (caller does not own this contact) */
  email: string | null;
  /** null when masked */
  phone: string | null;
  /** null when masked */
  linkedin: string | null;
  city: string;
}

export interface CompanyDeal {
  id: string;
  leadNumber: string;
  leadName: string;
  stage: string;
  createdDate: string;
}

export interface ProjectOption {
  id: number;
  name: string;
}

/* ------------------------------------------------------------------
   Row types
------------------------------------------------------------------ */
interface CompanyRow {
  company_id: number;
  company_name: string | null;
  domain_clean: string | null;
  company_web_url: string | null;
  cin_number: string | null;
  industry_id: number | null;
  city_id: number | null;
  company_size: number | null;
  turnover_id: number | null;
  description: string | null;
  email: string | null;
  linkedin_url: string | null;
  is_demo: boolean | null;
  created_date: string | null;
}
interface IndustryRow { industry_id: number; industry_name: string; }
interface CityRow { city_id: number; city_name: string; }
interface ContactRow {
  contact_id: number;
  full_name: string | null;
  designation: string | null;
  email: string | null;
  mobile_no: string | null;
  linkedin_url: string | null;
  city_name: string | null; // from masked view
  company_id: number | null;
}
interface LeadRow {
  lead_id: number;
  lead_number: string | null;
  lead_name: string | null;
  stage: string | null;
  created_date: string | null;
  company_id: number | null;
}
interface ProjectRow { project_id: number; project_name: string | null; }

/* ------------------------------------------------------------------
   Paged fetch — pull ALL rows of a select, 1000 at a time.
------------------------------------------------------------------ */
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

const OWNER_UNASSIGNED = 'Unassigned'; // TODO ownership

/* ------------------------------------------------------------------
   Domain normalisation — used for both display and dedup.
   Lowercase, strip protocol, strip leading www., drop any path/query,
   and trim a trailing slash. Returns '' for blank/garbage input.
------------------------------------------------------------------ */
export function cleanDomain(raw: string | null | undefined): string {
  if (!raw) return '';
  let d = raw.trim().toLowerCase();
  if (!d) return '';
  d = d.replace(/^https?:\/\//, '');
  d = d.replace(/^www\./, '');
  d = d.split('/')[0]; // drop path
  d = d.split('?')[0]; // drop query
  d = d.split('#')[0]; // drop fragment
  d = d.replace(/\/+$/, '');
  return d.trim();
}

/* ------------------------------------------------------------------
   List page fetch — all companies (demo + normal) + filter options.
------------------------------------------------------------------ */
export async function fetchCompanies(): Promise<CompaniesResult> {
  const empty: CompaniesResult = { companies: [], industries: [], cities: [], error: null };

  const companiesRes = await fetchAll<CompanyRow>(
    'company_master',
    'company_id, company_name, domain_clean, company_web_url, cin_number, industry_id, city_id, company_size, email, linkedin_url, is_demo, created_date',
    (q) => q.is('deleted_date', null).order('company_name', { ascending: true, nullsFirst: false }),
  );
  if (companiesRes.error) return { ...empty, error: companiesRes.error };

  const [industriesRes, citiesRes] = await Promise.all([
    fetchAll<IndustryRow>('industry_master', 'industry_id, industry_name'),
    fetchAll<CityRow>('city_master', 'city_id, city_name'),
  ]);

  const industryMap = new Map<number, string>();
  industriesRes.rows.forEach((i) => industryMap.set(i.industry_id, i.industry_name));
  const cityMap = new Map<number, string>();
  citiesRes.rows.forEach((c) => cityMap.set(c.city_id, c.city_name));

  const companies: Company[] = companiesRes.rows.map((c) => ({
    id: String(c.company_id),
    name: c.company_name ?? '',
    domainClean: c.domain_clean ?? '',
    webUrl: c.company_web_url ?? '',
    cin: c.cin_number ?? '',
    industry: c.industry_id != null ? (industryMap.get(c.industry_id) ?? '') : '',
    city: c.city_id != null ? (cityMap.get(c.city_id) ?? '') : '',
    size: c.company_size ?? null,
    turnover: '', // not needed for the list view; populated on the detail fetch
    description: '',
    email: c.email ?? '',
    linkedin: c.linkedin_url ?? '',
    isDemo: Boolean(c.is_demo),
    owner: OWNER_UNASSIGNED,
    createdDate: c.created_date ? c.created_date.substring(0, 10) : '',
    isMetro: isMetroCity(c.city_id != null ? (cityMap.get(c.city_id) ?? '') : ''),
  }));

  const uniq = (vals: string[]) => [...new Set(vals.filter(Boolean))].sort();
  return {
    companies,
    industries: uniq(companies.map((c) => c.industry)),
    cities: uniq(companies.map((c) => c.city)),
    error: null,
  };
}

/* ------------------------------------------------------------------
   Detail page fetch — a single company by id.
------------------------------------------------------------------ */
export async function fetchCompanyById(companyId: number): Promise<Company | null> {
  const { data, error } = await supabase
    .from('company_master')
    .select(
      'company_id, company_name, domain_clean, company_web_url, cin_number, industry_id, city_id, company_size, turnover_id, description, email, linkedin_url, is_demo, created_date',
    )
    .eq('company_id', companyId)
    .is('deleted_date', null)
    .maybeSingle();
  if (error || !data) return null;
  const c = data as unknown as CompanyRow;

  let industry = '';
  if (c.industry_id != null) {
    const { data: ind } = await supabase
      .from('industry_master')
      .select('industry_name')
      .eq('industry_id', c.industry_id)
      .maybeSingle();
    industry = (ind as { industry_name: string } | null)?.industry_name ?? '';
  }
  let city = '';
  if (c.city_id != null) {
    const { data: cty } = await supabase
      .from('city_master')
      .select('city_name')
      .eq('city_id', c.city_id)
      .maybeSingle();
    city = (cty as { city_name: string } | null)?.city_name ?? '';
  }
  let turnover = '';
  if (c.turnover_id != null) {
    const { data: tov } = await supabase
      .from('turnover_master')
      .select('turnover')
      .eq('turnover_id', c.turnover_id)
      .maybeSingle();
    turnover = (tov as { turnover: string } | null)?.turnover ?? '';
  }

  return {
    id: String(c.company_id),
    name: c.company_name ?? '',
    domainClean: c.domain_clean ?? '',
    webUrl: c.company_web_url ?? '',
    cin: c.cin_number ?? '',
    industry,
    city,
    size: c.company_size ?? null,
    turnover,
    description: c.description ?? '',
    email: c.email ?? '',
    linkedin: c.linkedin_url ?? '',
    isDemo: Boolean(c.is_demo),
    owner: OWNER_UNASSIGNED,
    createdDate: c.created_date ? c.created_date.substring(0, 10) : '',
    isMetro: isMetroCity(city),
  };
}

/* ------------------------------------------------------------------
   Contacts for a company (for the CONTACTS tab).
   Reads from contact_master_masked — detail columns (email, mobile_no,
   linkedin_url) are NULL for contacts the caller does not own.
------------------------------------------------------------------ */
export async function fetchCompanyContacts(companyId: number): Promise<CompanyContact[]> {
  const { rows, error } = await fetchAll<ContactRow>(
    'contact_master_masked',
    'contact_id, full_name, designation, email, mobile_no, linkedin_url, city_name, company_id',
    (q) => q.eq('company_id', companyId).order('full_name', { ascending: true, nullsFirst: false }),
  );
  if (error) return [];

  return rows.map((r) => ({
    id: String(r.contact_id),
    fullName: r.full_name ?? '',
    designation: r.designation ?? '',
    email: r.email ?? null,
    phone: r.mobile_no ?? null,
    linkedin: r.linkedin_url ?? null,
    city: r.city_name ?? '',
  }));
}

/* ------------------------------------------------------------------
   Deals (leads) for a company (for the DEALS tab).
------------------------------------------------------------------ */
export async function fetchCompanyDeals(companyId: number): Promise<CompanyDeal[]> {
  const { rows, error } = await fetchAll<LeadRow>(
    'lead_master',
    'lead_id, lead_number, lead_name, stage, created_date, company_id',
    (q) => q.eq('company_id', companyId).is('deleted_date', null).order('created_date', { ascending: false, nullsFirst: false }),
  );
  if (error) return [];
  return rows.map((r) => ({
    id: String(r.lead_id),
    leadNumber: r.lead_number ?? '',
    leadName: r.lead_name ?? '',
    stage: r.stage ?? '',
    createdDate: r.created_date ? r.created_date.substring(0, 10) : '',
  }));
}

/* ------------------------------------------------------------------
   Projects — display-only selector in the detail header. // TODO ownership
------------------------------------------------------------------ */
export async function fetchProjects(): Promise<ProjectOption[]> {
  const { rows, error } = await fetchAll<ProjectRow>(
    'project',
    'project_id, project_name',
    (q) => q.is('deleted_date', null).order('project_name', { ascending: true, nullsFirst: false }),
  );
  if (error) return [];
  return rows.map((p) => ({ id: p.project_id, name: p.project_name ?? '' }));
}

/* ------------------------------------------------------------------
   New-company create flow with dedup.
------------------------------------------------------------------ */

export interface NewCompanyInput {
  company_name: string;
  company_web_url: string;
  cin_number: string;
  industry: string; // free-text industry name (resolved to industry_id if it matches)
  city: string;     // free-text city name (resolved to city_id if it matches)
  size: string;     // numeric string
  linkedin_url: string;
  email: string;
  is_demo: boolean;
}

export interface DuplicateMatch {
  id: string;
  name: string;
  owner: string; // "Unassigned" // TODO ownership
}

export type CreateCompanyResult =
  | { kind: 'created'; id: string }
  | { kind: 'duplicate'; match: DuplicateMatch }
  | { kind: 'error'; message: string };

/**
 * Dedup + insert.
 *
 * When is_demo is FALSE we run dedup: clean the website to a domain and look for an
 * existing non-demo company whose domain_clean matches OR whose cin_number matches.
 * A hit returns kind: 'duplicate' (no insert). When is_demo is TRUE we SKIP dedup
 * entirely and always insert.
 *
 * The audit field created_by stores the numeric user_id as text (matches the
 * convention used across lead_master / project), so ownership/RLS can key on it later.
 */
export async function createCompany(
  input: NewCompanyInput,
  createdByUserId: string,
): Promise<CreateCompanyResult> {
  const name = input.company_name.trim();
  if (!name) return { kind: 'error', message: 'Company name is required.' };

  const domainClean = cleanDomain(input.company_web_url);
  const cin = input.cin_number.trim();

  // Dedup only for real (non-demo) companies.
  //
  // Run domain + CIN as SEPARATE .eq() queries and combine in JS, rather than one
  // interpolated PostgREST .or('domain_clean.eq.${domainClean},cin_number.eq.${cin}')
  // string: a domain/CIN containing a comma or ')' would break that filter syntax
  // and the dedup would silently miss (→ duplicate inserted). .eq() sends the value
  // as a bound parameter, so any characters are safe. Keep domain-first-then-CIN.
  if (!input.is_demo && (domainClean || cin)) {
    const dedupHit = async (
      column: 'domain_clean' | 'cin_number',
      value: string,
    ): Promise<{ company_id: number; company_name: string | null } | null | { error: string }> => {
      const { data, error } = await supabase
        .from('company_master')
        .select('company_id, company_name')
        .eq('is_demo', false)
        .is('deleted_date', null)
        .eq(column, value)
        .limit(1);
      if (error) return { error: error.message };
      return (data as { company_id: number; company_name: string | null }[] | null)?.[0] ?? null;
    };

    // Domain first, then CIN — same precedence as the old .or() (first hit wins).
    let hit: { company_id: number; company_name: string | null } | null = null;
    if (domainClean) {
      const res = await dedupHit('domain_clean', domainClean);
      if (res && 'error' in res) return { kind: 'error', message: res.error };
      hit = res;
    }
    if (!hit && cin) {
      const res = await dedupHit('cin_number', cin);
      if (res && 'error' in res) return { kind: 'error', message: res.error };
      hit = res;
    }

    if (hit) {
      return {
        kind: 'duplicate',
        match: { id: String(hit.company_id), name: hit.company_name ?? '', owner: OWNER_UNASSIGNED },
      };
    }
  }

  // Resolve optional industry/city free-text to ids (best-effort, exact name match).
  const industryId = await resolveLookupId('industry_master', 'industry_id', 'industry_name', input.industry);
  const cityId = await resolveLookupId('city_master', 'city_id', 'city_name', input.city);

  const sizeNum = input.size.trim() ? Number(input.size.trim()) : null;

  const insertRow: Record<string, unknown> = {
    company_name: name,
    company_web_url: input.company_web_url.trim() || null,
    domain_clean: domainClean || null,
    cin_number: cin || null,
    industry_id: industryId,
    city_id: cityId,
    company_size: sizeNum != null && !Number.isNaN(sizeNum) ? sizeNum : null,
    linkedin_url: input.linkedin_url.trim() || null,
    email: input.email.trim() || null,
    is_demo: input.is_demo,
    created_by: createdByUserId,
    created_date: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('company_master')
    .insert(insertRow)
    .select('company_id')
    .single();
  if (error) return { kind: 'error', message: humanizeWriteError(error) ?? error.message };
  return { kind: 'created', id: String((data as { company_id: number }).company_id) };
}

async function resolveLookupId(
  table: string,
  idCol: string,
  nameCol: string,
  value: string,
): Promise<number | null> {
  const v = value.trim();
  if (!v) return null;
  const { data } = await supabase
    .from(table)
    .select(idCol)
    .ilike(nameCol, v)
    .limit(1);
  const row = (data as Record<string, number>[] | null)?.[0];
  return row ? (row[idCol] as number) : null;
}
