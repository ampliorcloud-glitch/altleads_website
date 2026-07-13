/**
 * companyHierarchy.ts — data layer for ALT-469 (parent company / account hierarchy).
 *
 * Called ONLY when COMPANY_HIERARCHY is true (the card is flag-gated at the page).
 * Until `apply-company-hierarchy.cjs` is applied, `parent_company_id` doesn't exist
 * and these queries would error — which is why the flag stays off in prod first.
 */

import { supabase } from '../lib/supabase';

export interface CompanyRef {
  company_id: number;
  company_name: string | null;
}

/** The parent company of `companyId`, or null when top-level / unset. */
export async function fetchParentCompany(companyId: number): Promise<CompanyRef | null> {
  const { data, error } = await supabase
    .from('company_master')
    .select('parent_company_id')
    .eq('company_id', companyId)
    .maybeSingle();
  if (error || !data || (data as { parent_company_id: number | null }).parent_company_id == null) {
    return null;
  }
  const parentId = (data as { parent_company_id: number }).parent_company_id;
  const { data: parent } = await supabase
    .from('company_master')
    .select('company_id, company_name')
    .eq('company_id', parentId)
    .maybeSingle();
  return (parent as CompanyRef) ?? null;
}

/** Direct subsidiaries of `companyId` (rows whose parent_company_id = companyId). */
export async function fetchSubsidiaries(companyId: number): Promise<CompanyRef[]> {
  const { data, error } = await supabase
    .from('company_master')
    .select('company_id, company_name')
    .eq('parent_company_id', companyId)
    .is('deleted_date', null)
    .order('company_name', { ascending: true });
  if (error || !data) return [];
  return data as CompanyRef[];
}

/**
 * Set (or clear) the parent of `companyId`. Refuses to point a company at itself.
 * parentId = null clears the parent (makes it top-level).
 */
export async function setParentCompany(
  companyId: number,
  parentId: number | null,
  actor: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (parentId != null && parentId === companyId) {
    return { ok: false, error: 'A company cannot be its own parent.' };
  }
  const { error } = await supabase
    .from('company_master')
    .update({ parent_company_id: parentId, updated_by: actor, updated_date: new Date().toISOString() })
    .eq('company_id', companyId);
  return error ? { ok: false, error: error.message } : { ok: true };
}
