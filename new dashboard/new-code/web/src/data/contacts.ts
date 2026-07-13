import { supabase } from '../lib/supabase';
import { humanizeWriteError } from '../lib/writeError';
import { isMetroCity } from '../lib/hungerbox';
import {
  concurrencyPrecondition,
  makeConflict,
  type ConflictResult,
} from '../lib/concurrency';

export interface Contact {
  contact_id: number;
  full_name: string;
  email: string | null;
  mobile_no: string | null;
  alt_mobile_no: string | null;
  designation: string | null;
  linkedin_url: string | null;
  linkedin_clean: string | null;
  company_id: number | null;
  city_id: number | null;
  is_demo: boolean;
  created_by: string | null;
  created_date: string | null;
  /** ISO timestamp of last write — used as the optimistic-concurrency precondition (ALT-430). */
  updated_date: string | null;
  // joined
  company_name: string | null;
  city_name: string | null;
  /** True when the contact's city is a Tier-1 Indian metro (derived client-side). */
  isMetro: boolean;
}

export interface Interaction {
  interaction_id: number;
  record_type: string;
  record_id: number;
  project_id: number | null;
  owner_user_id: number | null;
  type: string;
  disposition: string | null;
  note_text: string | null;
  occurred_at: string;
  created_at: string;
  created_by: string | null;
}

export interface CompanyOption {
  company_id: number;
  company_name: string;
}

export interface CityOption {
  city_id: number;
  city_name: string;
}

/**
 * Derive linkedin_clean (the normalized match slug) from a linkedin_url.
 *
 * MUST stay byte-identical to the migration backfill (companies-contacts.sql:62-76),
 * which lower()s the result. Without the .toLowerCase() here, a contact created/edited
 * through the web app stores a mixed-case linkedin_clean that the exact-match lookup
 * `find_contact_dup(... linkedin_clean = p_linkedin)` then silently MISSES for any slug
 * with capitals — breaking the Chrome extension's LinkedIn→contact match. (Flagged in
 * docs/chrome-extension-rebuild/CRM-HANDOFF-FOR-CRM-OPUS.md TODO-1.)
 */
export function deriveLinkedinClean(url: string | null | undefined): string | null {
  if (!url) return null;
  const cleaned = url
    .replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, '')
    .replace(/\/$/, '')
    .trim()
    .toLowerCase();
  return cleaned || null;
}

const CONTACT_COLUMNS =
  'contact_id, full_name, email, mobile_no, alt_mobile_no, designation, linkedin_url, linkedin_clean, company_id, city_id, is_demo, created_by, created_date, updated_date, company_name, city_name';

function mapContactRow(row: Record<string, unknown>): Contact {
  return {
    contact_id: row.contact_id as number,
    full_name: (row.full_name as string) ?? '',
    email: row.email as string | null,
    mobile_no: row.mobile_no as string | null,
    alt_mobile_no: row.alt_mobile_no as string | null,
    designation: row.designation as string | null,
    linkedin_url: row.linkedin_url as string | null,
    linkedin_clean: row.linkedin_clean as string | null,
    company_id: row.company_id as number | null,
    city_id: row.city_id as number | null,
    is_demo: (row.is_demo as boolean) ?? false,
    created_by: row.created_by as string | null,
    created_date: row.created_date as string | null,
    updated_date: (row.updated_date as string | null) ?? null,
    company_name: (row.company_name as string | null) ?? null,
    city_name: (row.city_name as string | null) ?? null,
    isMetro: isMetroCity((row.city_name as string | null) ?? null),
  };
}

/** PostgREST returns at most 1000 rows per request; page through to get the full set. */
const CONTACTS_PAGE = 1000;
/** Safety ceiling so a runaway never loops forever (50k contacts = 50 requests). */
const CONTACTS_MAX = 50000;

/**
 * Fetch all contacts via the masked view (company_name + city_name are flat columns).
 *
 * Previously hard-capped at 1000 rows, which silently truncated the list AND broke
 * fetchContactById for any contact past the first 1000 (UX-AUDIT quick-win #13).
 * Now pages through with .range() up to CONTACTS_MAX; `truncated` flags the ceiling.
 */
export async function fetchAllContacts(): Promise<{
  contacts: Contact[];
  error: string | null;
  truncated?: boolean;
}> {
  const contacts: Contact[] = [];
  for (let from = 0; from < CONTACTS_MAX; from += CONTACTS_PAGE) {
    const { data, error } = await supabase
      .from('contact_master_masked')
      .select(CONTACT_COLUMNS)
      .order('full_name', { ascending: true })
      .range(from, from + CONTACTS_PAGE - 1);

    if (error) {
      // Return whatever we have plus the error (don't throw away earlier pages).
      return { contacts, error: error.message };
    }
    const rows = data ?? [];
    contacts.push(...rows.map(mapContactRow));
    if (rows.length < CONTACTS_PAGE) {
      return { contacts, error: null };
    }
  }
  // Hit the safety ceiling — more rows may exist than we fetched.
  return { contacts, error: null, truncated: true };
}

/** Fetch a single contact by id (direct row query — not bounded by the list cap). */
export async function fetchContactById(contactId: number): Promise<Contact | null> {
  const { data, error } = await supabase
    .from('contact_master_masked')
    .select(CONTACT_COLUMNS)
    .eq('contact_id', contactId)
    .maybeSingle();

  if (error || !data) return null;
  return mapContactRow(data as Record<string, unknown>);
}

/** A lead associated with a contact (HubSpot-style "associated leads" panel). */
export interface ContactLead {
  id: string;
  leadNumber: string;
  leadName: string;
  stage: string;
  createdDate: string;
}

/**
 * Leads directly associated with a contact.
 * Primary link is lead_master.contact_id (set when a lead is created from a
 * contact). If the contact was migrated from a lead, source_lead_id points back
 * at that originating lead, so include it too.
 */
export async function fetchContactLeads(
  contactId: number,
  sourceLeadId?: number | null,
): Promise<ContactLead[]> {
  const ors = [`contact_id.eq.${contactId}`];
  if (sourceLeadId != null) ors.push(`lead_id.eq.${sourceLeadId}`);

  const { data, error } = await supabase
    .from('lead_master')
    .select('lead_id, lead_number, lead_name, stage, created_date')
    .or(ors.join(','))
    .is('deleted_date', null)
    .order('created_date', { ascending: false, nullsFirst: false });

  if (error) return [];
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.lead_id),
    leadNumber: (r.lead_number as string | null) ?? '',
    leadName: (r.lead_name as string | null) ?? '',
    stage: (r.stage as string | null) ?? '',
    createdDate: r.created_date ? String(r.created_date).substring(0, 10) : '',
  }));
}

/** Fetch interactions for a contact */
export async function fetchContactInteractions(contactId: number): Promise<Interaction[]> {
  const { data, error } = await supabase
    .from('interaction')
    .select('*')
    .eq('record_type', 'contact')
    .eq('record_id', contactId)
    .order('occurred_at', { ascending: false });

  if (error) return [];
  return (data ?? []) as Interaction[];
}

/** Log a call interaction */
export async function logCallInteraction(params: {
  contactId: number;
  disposition: string;
  noteText: string;
  ownerUserId: number | null;
  createdBy: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from('interaction').insert({
    record_type: 'contact',
    record_id: params.contactId,
    project_id: null,
    owner_user_id: params.ownerUserId,
    type: 'call',
    disposition: params.disposition,
    note_text: params.noteText,
    occurred_at: new Date().toISOString(),
    created_by: params.createdBy,
  });
  return { error: error ? error.message : null };
}

/** Fetch companies for dropdown */
export async function fetchCompanyOptions(): Promise<CompanyOption[]> {
  const { data, error } = await supabase
    .from('company_master')
    .select('company_id, company_name')
    .order('company_name', { ascending: true })
    .limit(5000);
  if (error) console.error('[contacts] fetchCompanyOptions', error);
  return (data ?? []) as CompanyOption[];
}

/** Fetch cities for dropdown */
export async function fetchCityOptions(): Promise<CityOption[]> {
  const cities: CityOption[] = [];
  for (let from = 0; from < CONTACTS_MAX; from += CONTACTS_PAGE) {
    const { data, error } = await supabase
      .from('city_master')
      .select('city_id, city_name')
      .order('city_name', { ascending: true })
      .range(from, from + CONTACTS_PAGE - 1);
    if (error) {
      console.error('fetchCityOptions failed:', error.message);
      return cities;
    }
    const rows = (data ?? []) as CityOption[];
    cities.push(...rows);
    if (rows.length < CONTACTS_PAGE) break;
  }
  return cities;
}

/** Check for duplicate contact via the find_contact_dup RPC (SECURITY DEFINER, no detail leak). */
export async function findDuplicateContact(params: {
  email?: string;
  linkedinClean?: string;
  mobileNo?: string;
}): Promise<Contact | null> {
  if (!params.email && !params.linkedinClean && !params.mobileNo) return null;

  const { data, error } = await supabase.rpc('find_contact_dup', {
    p_email: params.email ?? null,
    p_linkedin: params.linkedinClean ?? null,
    p_mobile: params.mobileNo ?? null,
  });

  if (error || !data || (data as unknown[]).length === 0) return null;

  const row = (data as { contact_id: number; full_name: string; company_id: number; company_name: string }[])[0];
  return {
    contact_id: row.contact_id,
    full_name: row.full_name ?? '',
    email: null,
    mobile_no: null,
    alt_mobile_no: null,
    designation: null,
    linkedin_url: null,
    linkedin_clean: null,
    company_id: row.company_id ?? null,
    city_id: null,
    is_demo: false,
    created_by: null,
    created_date: null,
    updated_date: null,
    company_name: row.company_name ?? null,
    city_name: null,
    isMetro: false,
  };
}

/** Update company_id on an existing contact (set null to unlink) */
export async function updateContactCompany(
  contactId: number,
  companyId: number | null,
  /** Original updated_date of the contact row (used by the concurrency guard). */
  originalUpdatedDate?: string | null,
): Promise<{ error: string | null } | ConflictResult> {
  const patch = { company_id: companyId, updated_date: new Date().toISOString() };
  const guard = concurrencyPrecondition(originalUpdatedDate);

  if (guard !== undefined) {
    const { data, error } = await supabase
      .from('contact_master')
      .update(patch)
      .eq('contact_id', contactId)
      .eq('updated_date', guard)
      .select('contact_id');
    if (error) {
      if ((error as { code?: string }).code === '42501') {
        return { error: "You can only edit records you own (ask an admin or the owner's manager)." };
      }
      return { error: humanizeWriteError(error) };
    }
    if (!data || data.length === 0) return makeConflict('contact_master');
    return { error: null };
  }

  const { data, error } = await supabase
    .from('contact_master')
    .update(patch)
    .eq('contact_id', contactId)
    .select('contact_id');
  if (error) {
    if ((error as { code?: string }).code === '42501') {
      return { error: "You can only edit records you own (ask an admin or the owner's manager)." };
    }
    return { error: humanizeWriteError(error) };
  }
  if (!data || (data as { contact_id: number }[]).length === 0) {
    return { error: "You can only edit records you own (ask an admin or the owner's manager)." };
  }
  return { error: null };
}

/** Insert a new contact */
export async function insertContact(params: {
  fullName: string;
  designation: string;
  email: string;
  mobileNo: string;
  altMobileNo: string;
  linkedinUrl: string;
  linkedinClean: string | null;
  companyId: number | null;
  cityId: number | null;
  isDemo: boolean;
  createdBy: string;
}): Promise<{ contactId: number | null; error: string | null }> {
  const { data, error } = await supabase
    .from('contact_master')
    .insert({
      full_name: params.fullName,
      designation: params.designation || null,
      email: params.email || null,
      mobile_no: params.mobileNo || null,
      alt_mobile_no: params.altMobileNo || null,
      linkedin_url: params.linkedinUrl || null,
      linkedin_clean: params.linkedinClean,
      company_id: params.companyId,
      city_id: params.cityId,
      is_demo: params.isDemo,
      created_by: params.createdBy,
      created_date: new Date().toISOString(),
    })
    .select('contact_id')
    .single();

  if (error) return { contactId: null, error: humanizeWriteError(error) };
  return { contactId: (data as { contact_id: number }).contact_id, error: null };
}
