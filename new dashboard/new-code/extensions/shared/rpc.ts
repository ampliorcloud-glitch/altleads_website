/**
 * shared/rpc.ts
 *
 * Wrappers for the two Supabase RPC calls used to match a LinkedIn profile
 * URL to a CRM contact.
 *
 * find_contact_dup  — EXISTS TODAY. Masking-safe SECURITY DEFINER lookup by
 *                     linkedin_clean.  Returns { contact_id, full_name,
 *                     company_id, company_name }.
 *
 * find_contact_for_panel — REQUESTED (ALT-282); may not exist yet.  Returns
 *                     the richer non-owned card fields.  If the RPC returns a
 *                     PGRST* 404 / function-not-found error, this module
 *                     gracefully falls back to find_contact_dup and returns a
 *                     ContactPanelResult with only the base fields populated.
 *
 * Both functions take the NORMALIZED slug (output of normalizeLinkedinSlug)
 * as the lookup key — the match is EXACT, so the slug must be byte-identical
 * to contact_master.linkedin_clean.
 */

import { getSupabaseClient } from './supabaseClient';
import type { ContactDupResult, ContactPanelResult } from './types';

// ---------------------------------------------------------------------------
// find_contact_dup (exists today)
// ---------------------------------------------------------------------------

/**
 * Look up a contact by their normalized LinkedIn slug.
 * Returns the ContactDupResult row, or null if no live non-demo contact
 * matches, or throws on unexpected errors.
 *
 * @param slug - normalized slug from normalizeLinkedinSlug()
 */
export async function findContactDup(slug: string): Promise<ContactDupResult | null> {
  if (!slug) return null;

  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('find_contact_dup', {
    p_email: null,
    p_linkedin: slug,
    p_mobile: null,
  });

  if (error) {
    console.error('[AltLeads] find_contact_dup error:', error.message, error.code);
    throw new Error(error.message);
  }

  // The RPC returns a set; we expect at most one row for a given linkedin_clean.
  // Supabase wraps SETOF returns as an array.
  const rows = data as ContactDupResult[] | null;
  if (!rows || rows.length === 0) return null;

  return rows[0];
}

// ---------------------------------------------------------------------------
// find_contact_for_panel (ALT-282 — may not exist yet; graceful fallback)
// ---------------------------------------------------------------------------

/**
 * Look up a contact for the side panel, returning the richer set of fields
 * needed for the non-owned limited card.
 *
 * If the RPC does not exist yet (function-not-found / 404), falls back to
 * findContactDup and returns a partial ContactPanelResult (company_status,
 * contact_status, last_activity_at, owner fields will be null; can_view_details
 * is left as false so the UI shows the degraded state).
 *
 * @param slug      - normalized slug from normalizeLinkedinSlug()
 * @param projectId - the currently-selected project_id (for per-project status)
 */
export async function findContactForPanel(
  slug: string,
  projectId: number | null
): Promise<ContactPanelResult | null> {
  if (!slug) return null;

  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('find_contact_for_panel', {
    p_linkedin: slug,
    p_project_id: projectId,
  });

  if (error) {
    // Detect "function does not exist" errors (PostgREST returns PGRST202 or
    // a 404-equivalent code when the RPC name is not found).
    const isNotFound =
      error.code === 'PGRST202' ||
      error.code === '42883' ||
      error.message?.toLowerCase().includes('function') ||
      error.message?.toLowerCase().includes('does not exist');

    if (isNotFound) {
      console.warn(
        '[AltLeads] find_contact_for_panel not found on this CRM (ALT-282 not yet applied). ' +
        'Falling back to find_contact_dup.'
      );
      // Graceful fallback: use find_contact_dup, return partial result
      const base = await findContactDup(slug);
      if (!base) return null;

      return {
        contact_id: base.contact_id,
        full_name: base.full_name,
        company_id: base.company_id,
        company_name: base.company_name,
        // Enriched fields not yet available
        company_status: null,
        contact_status: null,
        last_activity_at: null,
        owner_user_id: null,
        owner_name: null,
        can_view_details: false,
        email: null,
        mobile_no: null,
        linkedin_url: null,
      };
    }

    // Other error — bubble up so the UI shows an error state
    console.error('[AltLeads] find_contact_for_panel error:', error.message, error.code);
    throw new Error(error.message);
  }

  const rows = data as ContactPanelResult[] | null;
  if (!rows || rows.length === 0) return null;

  return rows[0];
}
