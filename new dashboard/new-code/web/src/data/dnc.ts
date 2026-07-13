/**
 * dnc.ts — DNC (Do Not Contact) + Feasibility data layer for HungerBox.
 *
 * Both DNC and feasibility exist at two scopes:
 *   - "company"  : the whole company is DNC / non-feasible
 *   - "site"     : only the company+city site is DNC / non-feasible
 *
 * Schema tables (created by apply-hungerbox-dnc-feasibility.cjs):
 *   public.hb_dnc             — active DNC records (company-level + site-level)
 *   public.hb_feasibility     — active feasibility overrides (non-feasible records)
 *   public.hb_dnc_history     — full audit log of DNC changes (who/when/old→new)
 *   public.hb_feasibility_history — audit log of feasibility changes
 *
 * Contacts inherit the DNC/feasibility state from:
 *   1. Their company (whole-company DNC/feasibility)
 *   2. Their matching site (company + city_id match)
 * A contact is "non-contactable" if EITHER flag is active at either scope.
 *
 * ALL reads/writes guarded by HUNGERBOX_FEATURES.
 */

import { supabase } from '../lib/supabase';
import {
  HUNGERBOX_FEATURES,
  type HbScope,
  type DncReason,
  type NonFeasibleReason,
  nonContactableReason,
} from '../lib/hungerbox';

// -----------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------

export interface HbDncRecord {
  dnc_id: number;
  company_id: number;
  site_id: number | null; // null = whole-company
  scope: HbScope;
  reason: string;
  marked_by: string;
  marked_at: string;
  is_active: boolean;
}

export interface HbFeasibilityRecord {
  feasibility_id: number;
  company_id: number;
  site_id: number | null;
  scope: HbScope;
  is_feasible: boolean;
  reason: string;
  marked_by: string;
  marked_at: string;
}

export interface HbDncHistoryEntry {
  history_id: number;
  company_id: number;
  site_id: number | null;
  scope: HbScope;
  changed_by: string;
  changed_at: string;
  old_state: boolean;
  new_state: boolean;
  reason: string;
}

export interface HbFeasibilityHistoryEntry {
  history_id: number;
  company_id: number;
  site_id: number | null;
  scope: HbScope;
  changed_by: string;
  changed_at: string;
  old_feasible: boolean;
  new_feasible: boolean;
  reason: string;
}

/**
 * The computed non-contactable state of a contact (derived from company + site
 * DNC and feasibility). Used by the UI to apply the reddish-blur treatment.
 */
export interface ContactNonContactableState {
  is_non_contactable: boolean;
  /** Human-readable reason: "DNC", "Non-feasible", "DNC + Non-feasible", or null */
  reason: string | null;
  company_dnc: boolean;
  site_dnc: boolean;
  company_non_feasible: boolean;
  site_non_feasible: boolean;
}

// -----------------------------------------------------------------------
// Reads
// -----------------------------------------------------------------------

/** Fetch the active DNC record for a company (whole-company scope). */
export async function fetchCompanyDnc(
  companyId: number,
): Promise<HbDncRecord | null> {
  if (!HUNGERBOX_FEATURES) return null;

  const { data, error } = await supabase
    .from('hb_dnc')
    .select('*')
    .eq('company_id', companyId)
    .eq('scope', 'company')
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('[dnc] fetchCompanyDnc', error.message);
    return null;
  }
  return (data as HbDncRecord | null) ?? null;
}

/** Fetch the active DNC record for a specific site. */
export async function fetchSiteDnc(
  siteId: number,
): Promise<HbDncRecord | null> {
  if (!HUNGERBOX_FEATURES) return null;

  const { data, error } = await supabase
    .from('hb_dnc')
    .select('*')
    .eq('site_id', siteId)
    .eq('scope', 'site')
    .eq('is_active', true)
    .maybeSingle();

  if (error) return null;
  return (data as HbDncRecord | null) ?? null;
}

/** Fetch the active feasibility record for a company (whole-company scope). */
export async function fetchCompanyFeasibility(
  companyId: number,
): Promise<HbFeasibilityRecord | null> {
  if (!HUNGERBOX_FEATURES) return null;

  const { data, error } = await supabase
    .from('hb_feasibility')
    .select('*')
    .eq('company_id', companyId)
    .eq('scope', 'company')
    .maybeSingle();

  if (error) return null;
  return (data as HbFeasibilityRecord | null) ?? null;
}

/** Fetch the active feasibility record for a site. */
export async function fetchSiteFeasibility(
  siteId: number,
): Promise<HbFeasibilityRecord | null> {
  if (!HUNGERBOX_FEATURES) return null;

  const { data, error } = await supabase
    .from('hb_feasibility')
    .select('*')
    .eq('site_id', siteId)
    .maybeSingle();

  if (error) return null;
  return (data as HbFeasibilityRecord | null) ?? null;
}

/**
 * Compute the full non-contactable state for a contact, given:
 *   companyId   — contact.company_id
 *   siteId      — the site whose city matches the contact's city (may be null)
 *
 * Returns a lightweight object the UI uses directly for the blur treatment.
 */
export async function computeContactNonContactable(
  companyId: number,
  siteId: number | null,
): Promise<ContactNonContactableState> {
  const empty: ContactNonContactableState = {
    is_non_contactable: false,
    reason: null,
    company_dnc: false,
    site_dnc: false,
    company_non_feasible: false,
    site_non_feasible: false,
  };

  if (!HUNGERBOX_FEATURES) return empty;

  const [companyDnc, companyFeas, siteDnc, siteFeas] = await Promise.all([
    fetchCompanyDnc(companyId),
    fetchCompanyFeasibility(companyId),
    siteId != null ? fetchSiteDnc(siteId) : Promise.resolve(null),
    siteId != null ? fetchSiteFeasibility(siteId) : Promise.resolve(null),
  ]);

  const cDnc = companyDnc?.is_active ?? false;
  const sDnc = siteDnc?.is_active ?? false;
  const cNonFeas = companyFeas != null && !companyFeas.is_feasible;
  const sNonFeas = siteFeas != null && !siteFeas.is_feasible;

  const dncActive = cDnc || sDnc;
  const nonFeasActive = cNonFeas || sNonFeas;

  return {
    is_non_contactable: dncActive || nonFeasActive,
    reason: nonContactableReason(dncActive, nonFeasActive),
    company_dnc: cDnc,
    site_dnc: sDnc,
    company_non_feasible: cNonFeas,
    site_non_feasible: sNonFeas,
  };
}

/**
 * Batch-compute non-contactable states for multiple company-ids in one shot.
 * Used by the contacts list to colour rows without N round-trips.
 * Returns a map: company_id → ContactNonContactableState
 */
export async function batchComputeCompanyNonContactable(
  companyIds: number[],
): Promise<Map<number, ContactNonContactableState>> {
  const out = new Map<number, ContactNonContactableState>();
  if (!HUNGERBOX_FEATURES || companyIds.length === 0) return out;

  // One query each for DNC + feasibility at company scope
  const [dncRes, feasRes] = await Promise.all([
    supabase
      .from('hb_dnc')
      .select('company_id, is_active')
      .in('company_id', companyIds)
      .eq('scope', 'company')
      .eq('is_active', true),
    supabase
      .from('hb_feasibility')
      .select('company_id, is_feasible')
      .in('company_id', companyIds)
      .eq('scope', 'company'),
  ]);

  const dncSet = new Set<number>(
    ((dncRes.data ?? []) as { company_id: number }[]).map((r) => r.company_id),
  );
  const nonFeasSet = new Set<number>(
    ((feasRes.data ?? []) as { company_id: number; is_feasible: boolean }[])
      .filter((r) => !r.is_feasible)
      .map((r) => r.company_id),
  );

  for (const cid of companyIds) {
    const cDnc = dncSet.has(cid);
    const cNonFeas = nonFeasSet.has(cid);
    const dncActive = cDnc;
    const nonFeasActive = cNonFeas;
    out.set(cid, {
      is_non_contactable: dncActive || nonFeasActive,
      reason: nonContactableReason(dncActive, nonFeasActive),
      company_dnc: cDnc,
      site_dnc: false, // site-level not computed in batch (use computeContactNonContactable for detail)
      company_non_feasible: cNonFeas,
      site_non_feasible: false,
    });
  }

  return out;
}

// -----------------------------------------------------------------------
// DNC history
// -----------------------------------------------------------------------

/** Fetch full DNC history for a company (all scopes). */
export async function fetchDncHistory(
  companyId: number,
): Promise<HbDncHistoryEntry[]> {
  if (!HUNGERBOX_FEATURES) return [];

  const { data, error } = await supabase
    .from('hb_dnc_history')
    .select('*')
    .eq('company_id', companyId)
    .order('changed_at', { ascending: false });

  if (error) return [];
  return (data ?? []) as HbDncHistoryEntry[];
}

/** Fetch full feasibility history for a company (all scopes). */
export async function fetchFeasibilityHistory(
  companyId: number,
): Promise<HbFeasibilityHistoryEntry[]> {
  if (!HUNGERBOX_FEATURES) return [];

  const { data, error } = await supabase
    .from('hb_feasibility_history')
    .select('*')
    .eq('company_id', companyId)
    .order('changed_at', { ascending: false });

  if (error) return [];
  return (data ?? []) as HbFeasibilityHistoryEntry[];
}

// -----------------------------------------------------------------------
// Writes — DNC
// -----------------------------------------------------------------------

/**
 * Mark a company (or site) as DNC.
 * TODO(gatekeeper ALT-431): route through server-side write gateway
 */
export async function markDnc(params: {
  companyId: number;
  siteId: number | null;
  scope: HbScope;
  reason: DncReason | string;
  markedBy: string;
}): Promise<{ error: string | null }> {
  if (!HUNGERBOX_FEATURES) return { error: 'HungerBox features not enabled.' };

  const now = new Date().toISOString();

  // Upsert the active DNC row
  const { error: dncErr } = await supabase.from('hb_dnc').upsert(
    {
      company_id: params.companyId,
      site_id: params.siteId,
      scope: params.scope,
      reason: params.reason,
      marked_by: params.markedBy,
      marked_at: now,
      is_active: true,
    },
    {
      onConflict: params.scope === 'company' ? 'company_id,scope' : 'site_id,scope',
    },
  );
  if (dncErr) return { error: dncErr.message };

  // Write history
  const { error: histErr } = await supabase.from('hb_dnc_history').insert({
    company_id: params.companyId,
    site_id: params.siteId,
    scope: params.scope,
    changed_by: params.markedBy,
    changed_at: now,
    old_state: false,
    new_state: true,
    reason: params.reason,
  });
  if (histErr) console.warn('[dnc] markDnc history insert failed:', histErr.message);

  // Also flip the is_dnc flag on the site row when scope=site
  if (params.scope === 'site' && params.siteId != null) {
    await supabase
      .from('company_site')
      .update({ is_dnc: true, updated_at: now })
      .eq('site_id', params.siteId);
  }

  return { error: null };
}

/**
 * Unmark DNC (clear) for a company or site.
 * TODO(gatekeeper ALT-431): route through server-side write gateway
 */
export async function unmarkDnc(params: {
  companyId: number;
  siteId: number | null;
  scope: HbScope;
  reason: string;
  markedBy: string;
}): Promise<{ error: string | null }> {
  if (!HUNGERBOX_FEATURES) return { error: 'HungerBox features not enabled.' };

  const now = new Date().toISOString();

  const q =
    params.scope === 'company'
      ? supabase
          .from('hb_dnc')
          .update({ is_active: false, marked_by: params.markedBy, marked_at: now })
          .eq('company_id', params.companyId)
          .eq('scope', 'company')
      : supabase
          .from('hb_dnc')
          .update({ is_active: false, marked_by: params.markedBy, marked_at: now })
          .eq('site_id', params.siteId!)
          .eq('scope', 'site');

  const { error } = await q;
  if (error) return { error: error.message };

  await supabase.from('hb_dnc_history').insert({
    company_id: params.companyId,
    site_id: params.siteId,
    scope: params.scope,
    changed_by: params.markedBy,
    changed_at: now,
    old_state: true,
    new_state: false,
    reason: params.reason,
  });

  if (params.scope === 'site' && params.siteId != null) {
    await supabase
      .from('company_site')
      .update({ is_dnc: false, updated_at: now })
      .eq('site_id', params.siteId);
  }

  return { error: null };
}

// -----------------------------------------------------------------------
// Writes — Feasibility
// -----------------------------------------------------------------------

/**
 * Mark a company (or site) as non-feasible.
 * TODO(gatekeeper ALT-431): route through server-side write gateway
 */
export async function markNonFeasible(params: {
  companyId: number;
  siteId: number | null;
  scope: HbScope;
  reason: NonFeasibleReason | string;
  markedBy: string;
}): Promise<{ error: string | null }> {
  if (!HUNGERBOX_FEATURES) return { error: 'HungerBox features not enabled.' };

  const now = new Date().toISOString();

  const { error: feasErr } = await supabase.from('hb_feasibility').upsert(
    {
      company_id: params.companyId,
      site_id: params.siteId,
      scope: params.scope,
      is_feasible: false,
      reason: params.reason,
      marked_by: params.markedBy,
      marked_at: now,
    },
    {
      onConflict: params.scope === 'company' ? 'company_id,scope' : 'site_id,scope',
    },
  );
  if (feasErr) return { error: feasErr.message };

  await supabase.from('hb_feasibility_history').insert({
    company_id: params.companyId,
    site_id: params.siteId,
    scope: params.scope,
    changed_by: params.markedBy,
    changed_at: now,
    old_feasible: true,
    new_feasible: false,
    reason: params.reason,
  });

  // Flip the flag on the site row too when scope=site
  if (params.scope === 'site' && params.siteId != null) {
    await supabase
      .from('company_site')
      .update({ is_feasible: false, updated_at: now })
      .eq('site_id', params.siteId);
  }

  return { error: null };
}

/**
 * Mark a company (or site) as feasible again.
 * TODO(gatekeeper ALT-431): route through server-side write gateway
 */
export async function markFeasible(params: {
  companyId: number;
  siteId: number | null;
  scope: HbScope;
  reason: string;
  markedBy: string;
}): Promise<{ error: string | null }> {
  if (!HUNGERBOX_FEATURES) return { error: 'HungerBox features not enabled.' };

  const now = new Date().toISOString();

  const q =
    params.scope === 'company'
      ? supabase
          .from('hb_feasibility')
          .update({ is_feasible: true, marked_by: params.markedBy, marked_at: now, reason: params.reason })
          .eq('company_id', params.companyId)
          .eq('scope', 'company')
      : supabase
          .from('hb_feasibility')
          .update({ is_feasible: true, marked_by: params.markedBy, marked_at: now, reason: params.reason })
          .eq('site_id', params.siteId!)
          .eq('scope', 'site');

  const { error } = await q;
  if (error) return { error: error.message };

  await supabase.from('hb_feasibility_history').insert({
    company_id: params.companyId,
    site_id: params.siteId,
    scope: params.scope,
    changed_by: params.markedBy,
    changed_at: now,
    old_feasible: false,
    new_feasible: true,
    reason: params.reason,
  });

  if (params.scope === 'site' && params.siteId != null) {
    await supabase
      .from('company_site')
      .update({ is_feasible: true, updated_at: now })
      .eq('site_id', params.siteId);
  }

  return { error: null };
}
