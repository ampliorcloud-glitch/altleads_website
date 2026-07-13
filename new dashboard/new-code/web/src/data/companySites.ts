/**
 * companySites.ts — Data layer for the HungerBox company-site entity.
 *
 * A company has many sites (one per city/location). Each site carries:
 *   - city reference (city_id → city_master.city_id)
 *   - total_employees + commercial_model (prequalified answers)
 *   - is_feasible, is_dnc flags (company-site level)
 *
 * Schema tables (created by apply-hungerbox-company-sites.cjs):
 *   public.company_site        — the site entity
 *   public.hb_site_history     — audit log for prequalified-answer edits
 *
 * ALL reads/writes in this file are guarded by HUNGERBOX_FEATURES.
 * When the flag is false every function returns an empty/null result and
 * no DB round-trips are made — so the live app works without the new tables.
 *
 * Tables referenced (existing):
 *   company_master.company_id  bigint PK
 *   city_master.city_id        integer PK  / city_name varchar
 *   contact_master.company_id  bigint FK → company_master
 *   contact_master.city_id     bigint → city_master (contact's city)
 */

import { supabase } from '../lib/supabase';
import { HUNGERBOX_FEATURES, type HbPrequalifiedAnswers } from '../lib/hungerbox';

// -----------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------

export interface CompanySite {
  site_id: number;
  company_id: number;
  city_id: number;
  city_name: string;
  total_employees: number | null;
  commercial_model: string | null;
  notes: string | null;
  is_feasible: boolean;
  is_dnc: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface SiteHistory {
  history_id: number;
  site_id: number;
  changed_by: string;
  changed_at: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
}

export interface SiteWithHistory extends CompanySite {
  history: SiteHistory[];
}

// -----------------------------------------------------------------------
// Row types (DB columns)
// -----------------------------------------------------------------------
interface SiteRow {
  site_id: number;
  company_id: number;
  city_id: number;
  total_employees: number | null;
  commercial_model: string | null;
  notes: string | null;
  is_feasible: boolean;
  is_dnc: boolean;
  created_at: string;
  updated_at: string | null;
  // joined
  city_name: string | null;
}

interface HistoryRow {
  history_id: number;
  site_id: number;
  changed_by: string;
  changed_at: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------
function mapSiteRow(r: SiteRow, cityName?: string): CompanySite {
  return {
    site_id: r.site_id,
    company_id: r.company_id,
    city_id: r.city_id,
    city_name: cityName ?? r.city_name ?? '',
    total_employees: r.total_employees ?? null,
    commercial_model: r.commercial_model ?? null,
    notes: r.notes ?? null,
    is_feasible: r.is_feasible ?? true,
    is_dnc: r.is_dnc ?? false,
    created_at: r.created_at,
    updated_at: r.updated_at ?? null,
  };
}

// -----------------------------------------------------------------------
// Reads
// -----------------------------------------------------------------------

/**
 * Fetch all sites for a company (for the company detail "Sites" panel).
 * Joins city_name via a PostgREST foreign-key embed.
 */
export async function fetchCompanySites(
  companyId: number,
): Promise<CompanySite[]> {
  if (!HUNGERBOX_FEATURES) return [];

  const { data, error } = await supabase
    .from('company_site')
    .select('*, city_master(city_name)')
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .order('city_name', { foreignTable: 'city_master', ascending: true });

  if (error) {
    console.error('[companySites] fetchCompanySites', error.message);
    return [];
  }

  return (data ?? []).map((r: Record<string, unknown>) => {
    const cityName = (r.city_master as { city_name: string | null } | null)?.city_name ?? '';
    return mapSiteRow(r as unknown as SiteRow, cityName);
  });
}

/**
 * Fetch a single site with its full edit history.
 */
export async function fetchSiteWithHistory(
  siteId: number,
): Promise<SiteWithHistory | null> {
  if (!HUNGERBOX_FEATURES) return null;

  const [siteRes, histRes] = await Promise.all([
    supabase
      .from('company_site')
      .select('*, city_master(city_name)')
      .eq('site_id', siteId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('hb_site_history')
      .select('*')
      .eq('site_id', siteId)
      .order('changed_at', { ascending: false }),
  ]);

  if (siteRes.error || !siteRes.data) return null;

  const r = siteRes.data as Record<string, unknown>;
  const cityName = (r.city_master as { city_name: string | null } | null)?.city_name ?? '';
  const site = mapSiteRow(r as unknown as SiteRow, cityName);
  const history: SiteHistory[] = ((histRes.data ?? []) as HistoryRow[]).map((h) => ({
    history_id: h.history_id,
    site_id: h.site_id,
    changed_by: h.changed_by,
    changed_at: h.changed_at,
    field_name: h.field_name,
    old_value: h.old_value ?? null,
    new_value: h.new_value ?? null,
  }));

  return { ...site, history };
}

/**
 * Given a contact's company_id + city_id, find the matching site (if any).
 * Used by the contacts layer to derive non-contactable state.
 */
export async function findSiteForContact(
  companyId: number,
  cityId: number,
): Promise<CompanySite | null> {
  if (!HUNGERBOX_FEATURES) return null;

  const { data, error } = await supabase
    .from('company_site')
    .select('*, city_master(city_name)')
    .eq('company_id', companyId)
    .eq('city_id', cityId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) return null;
  const r = data as Record<string, unknown>;
  const cityName = (r.city_master as { city_name: string | null } | null)?.city_name ?? '';
  return mapSiteRow(r as unknown as SiteRow, cityName);
}

// -----------------------------------------------------------------------
// Writes — prequalified answers
// -----------------------------------------------------------------------

/**
 * Upsert a site for a company+city pair. Creates on first call, updates on subsequent.
 * Writes each changed field to hb_site_history.
 *
 * TODO(gatekeeper ALT-431): route through server-side write gateway
 */
export async function upsertSitePrequalified(params: {
  companyId: number;
  cityId: number;
  answers: Partial<HbPrequalifiedAnswers>;
  changedBy: string;
}): Promise<{ siteId: number | null; error: string | null }> {
  if (!HUNGERBOX_FEATURES) return { siteId: null, error: 'HungerBox features not enabled.' };

  // Upsert the site row
  const { data: upserted, error: upsertErr } = await supabase
    .from('company_site')
    .upsert(
      {
        company_id: params.companyId,
        city_id: params.cityId,
        total_employees: params.answers.total_employees ?? null,
        commercial_model: params.answers.commercial_model ?? null,
        notes: params.answers.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,city_id', ignoreDuplicates: false },
    )
    .select('site_id, total_employees, commercial_model, notes')
    .single();

  if (upsertErr || !upserted) {
    return { siteId: null, error: upsertErr?.message ?? 'Upsert failed.' };
  }

  const siteId = (upserted as { site_id: number }).site_id;

  // Write history for each changed field
  const historyRows: Array<{
    site_id: number;
    changed_by: string;
    changed_at: string;
    field_name: string;
    old_value: string | null;
    new_value: string | null;
  }> = [];
  const now = new Date().toISOString();

  for (const [field, newVal] of Object.entries(params.answers)) {
    historyRows.push({
      site_id: siteId,
      changed_by: params.changedBy,
      changed_at: now,
      field_name: field,
      old_value: null, // could fetch prev value for richer history — deferred
      new_value: newVal != null ? String(newVal) : null,
    });
  }

  if (historyRows.length > 0) {
    const { error: histErr } = await supabase
      .from('hb_site_history')
      .insert(historyRows);
    if (histErr) {
      console.warn('[companySites] history insert failed:', histErr.message);
      // Non-fatal: the site itself was saved.
    }
  }

  return { siteId, error: null };
}

// -----------------------------------------------------------------------
// Site create (admin use — creates a new site row)
// TODO(gatekeeper ALT-431): route through server-side write gateway
// -----------------------------------------------------------------------
export async function createSite(params: {
  companyId: number;
  cityId: number;
  answers?: Partial<HbPrequalifiedAnswers>;
  createdBy: string;
}): Promise<{ siteId: number | null; error: string | null }> {
  if (!HUNGERBOX_FEATURES) return { siteId: null, error: 'HungerBox features not enabled.' };

  const { data, error } = await supabase
    .from('company_site')
    .insert({
      company_id: params.companyId,
      city_id: params.cityId,
      total_employees: params.answers?.total_employees ?? null,
      commercial_model: params.answers?.commercial_model ?? null,
      notes: params.answers?.notes ?? null,
      is_feasible: true,
      is_dnc: false,
      created_at: new Date().toISOString(),
    })
    .select('site_id')
    .single();

  if (error) return { siteId: null, error: error.message };
  return { siteId: (data as { site_id: number }).site_id, error: null };
}
