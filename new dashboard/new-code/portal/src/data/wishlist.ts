/**
 * wishlist.ts (portal) — faithful port of the CRM web app's Wishlist data layer
 * (new-code/web/src/data/wishlist.ts, ALT-276), which itself mirrors the legacy
 * mobile app (old-code/.../screens/wishlist/Wishlist.jsx) field-for-field.
 *
 * The portal user requests a target company they'd like Amplior to pursue:
 *   - COMPANY is picked from existing CRM companies (searchCompanies, typeahead)
 *     OR free-typed (free text → company_id stays null; the CRM agent settles the
 *     match / dedup when converting to a Lead).
 *   - CONTACT (lead) is picked from that company's existing CRM leads
 *     (leadsByCompany — auto-fills designation + phone) OR free-typed.
 *   - State → City is a real cascade (listStates / listCitiesByState).
 *
 * WRITES SAFETY: creating a row in the live `wishlist` table is a production write.
 * It is GATED behind VITE_PORTAL_WRITES (default off). When off, the form stages
 * the request locally (optimistic, shown in the list) so the full UX is reviewable
 * without touching the CRM DB. Flip the flag to '1' to persist real wishlist rows
 * (the CRM agent then triages + converts them — identical to the mobile flow).
 *
 * Web parity notes (same as the CRM page): geo-tagged photo + GPS are mobile-only
 * and skipped; Country/State are UI-only (the `wishlist` table has only city_id —
 * state is derived from city_master.state_id). created_by / assign_* require a
 * numeric user_master id (the row's ownership / RLS key).
 */
import { supabase } from '../lib/supabase'
import { PortalScope } from './crm'

export const WRITES_ENABLED =
  import.meta.env.VITE_PORTAL_WRITES === '1' || import.meta.env.VITE_PORTAL_WRITES === 'true'

export const STATUS_WISHLIST = 'WishList'
export const STATUS_CONVERTED = 'Converted To Lead'

/* ── Types ───────────────────────────────────────────────────────────────── */

export interface WishlistItem {
  wishlistId: number
  company: string
  contactName: string
  designation: string
  city: string
  state: string
  status: string
  phone: string
  pincode: string
  description: string
  createdDate: string
  /** True if this row is a local optimistic stage (writes disabled). */
  pendingLocal?: boolean
}

export interface CompanySearchOption {
  companyId: number
  companyName: string
  cityId: number | null
}
export interface CompanyLeadOption {
  leadId: number
  leadName: string
  designation: string
  mobileNo: string
}
export interface StateOption { stateId: number; stateName: string }
export interface CityOption { cityId: number; cityName: string }

/* ── Company autocomplete (mobile parity: >= 2 chars, capped 10) ──────────── */

export async function searchCompanies(term: string): Promise<CompanySearchOption[]> {
  const q = term.trim()
  if (q.length < 2) return []
  const { data, error } = await supabase
    .from('company_master')
    .select('company_id, company_name, city_id')
    .ilike('company_name', `%${q}%`)
    .is('deleted_date', null)
    .order('company_name', { ascending: true, nullsFirst: false })
    .limit(10)
  if (error || !data) return []
  return (data as Array<{ company_id: number; company_name: string | null; city_id: number | null }>).map((c) => ({
    companyId: c.company_id,
    companyName: (c.company_name ?? '').trim(),
    cityId: c.city_id ?? null,
  }))
}

/* ── Leads for a chosen company (auto-fill contact + designation + phone) ──── */

export async function leadsByCompany(companyId: number): Promise<CompanyLeadOption[]> {
  const { data, error } = await supabase
    .from('lead_master')
    .select('lead_id, lead_name, designation, mobile_no')
    .eq('company_id', companyId)
    .is('deleted_date', null)
    .order('lead_name', { ascending: true, nullsFirst: false })
    .limit(50)
  if (error || !data) return []
  return (data as Array<{ lead_id: number; lead_name: string | null; designation: string | null; mobile_no: string | null }>)
    .map((l) => ({
      leadId: l.lead_id,
      leadName: (l.lead_name ?? '').trim(),
      designation: (l.designation ?? '').trim(),
      mobileNo: (l.mobile_no ?? '').trim(),
    }))
    .filter((l) => l.leadName)
}

/* ── State → City cascade ─────────────────────────────────────────────────── */

export async function listStates(): Promise<StateOption[]> {
  const { data, error } = await supabase
    .from('state_master')
    .select('state_id, state_name')
    .order('state_name', { ascending: true, nullsFirst: false })
    .limit(1000)
  if (error || !data) return []
  return (data as Array<{ state_id: number; state_name: string | null }>).map((s) => ({
    stateId: s.state_id,
    stateName: (s.state_name ?? '').trim(),
  }))
}

export async function listCitiesByState(stateId: number): Promise<CityOption[]> {
  const { data, error } = await supabase
    .from('city_master')
    .select('city_id, city_name')
    .eq('state_id', stateId)
    .order('city_name', { ascending: true, nullsFirst: false })
    .limit(2000)
  if (error || !data) return []
  return (data as Array<{ city_id: number; city_name: string | null }>).map((c) => ({
    cityId: c.city_id,
    cityName: (c.city_name ?? '').trim(),
  }))
}

/* ── List the requester's own wishlist entries (scoped) ───────────────────── */

const WL_COLS =
  'wishlist_id, company_name, lead_name, designation, lead_number, status, pincode, ' +
  'description, city_id, company_id, created_by, assign_agent, assign_tl, created_date'

export async function fetchWishlist(scope: PortalScope): Promise<WishlistItem[]> {
  if (scope.kind === 'demo') return []
  const { data, error } = await supabase
    .from('wishlist')
    .select(WL_COLS)
    .is('deleted_date', null)
    .order('created_date', { ascending: false, nullsFirst: false })
    .limit(500)
  if (error || !data) return []
  let rows = data as unknown as Array<Record<string, unknown>>

  // Scope: a sales/user account sees rows they created or are assigned; admin sees all.
  if (scope.kind === 'user') {
    const uid = scope.userId
    rows = rows.filter(
      (r) =>
        Number(r.created_by) === uid ||
        Number(r.assign_agent) === uid ||
        Number(r.assign_tl) === uid,
    )
  }

  // Resolve city + state names.
  const cityIds = [...new Set(rows.map((r) => r.city_id).filter((x): x is number => x != null))]
  const cityMap = new Map<number, { name: string; stateId: number | null }>()
  if (cityIds.length) {
    const { data: cd } = await supabase.from('city_master').select('city_id, city_name, state_id').in('city_id', cityIds)
    ;(cd ?? []).forEach((c: Record<string, unknown>) =>
      cityMap.set(Number(c.city_id), { name: String(c.city_name ?? '').trim(), stateId: (c.state_id as number) ?? null }))
  }
  const stateIds = [...new Set([...cityMap.values()].map((c) => c.stateId).filter((x): x is number => x != null))]
  const stateMap = new Map<number, string>()
  if (stateIds.length) {
    const { data: sd } = await supabase.from('state_master').select('state_id, state_name').in('state_id', stateIds)
    ;(sd ?? []).forEach((s: Record<string, unknown>) => stateMap.set(Number(s.state_id), String(s.state_name ?? '').trim()))
  }
  // Resolve canonical company names when only company_id is set.
  const companyIds = [...new Set(rows.map((r) => r.company_id).filter((x): x is number => x != null))]
  const companyMap = new Map<number, string>()
  if (companyIds.length) {
    const { data: cm } = await supabase.from('company_master').select('company_id, company_name').in('company_id', companyIds)
    ;(cm ?? []).forEach((c: Record<string, unknown>) => companyMap.set(Number(c.company_id), String(c.company_name ?? '').trim()))
  }

  return rows.map((r) => {
    const ci = r.city_id != null ? cityMap.get(Number(r.city_id)) : undefined
    return {
      wishlistId: Number(r.wishlist_id),
      company: (String(r.company_name ?? '').trim()) || (r.company_id != null ? companyMap.get(Number(r.company_id)) ?? '' : ''),
      contactName: String(r.lead_name ?? '').trim(),
      designation: String(r.designation ?? '').trim(),
      city: ci?.name ?? '',
      state: ci?.stateId != null ? stateMap.get(ci.stateId) ?? '' : '',
      status: String(r.status ?? '').trim(),
      phone: String(r.lead_number ?? '').trim(),
      pincode: String(r.pincode ?? '').trim(),
      description: String(r.description ?? '').trim(),
      createdDate: r.created_date ? String(r.created_date).substring(0, 10) : '',
    }
  })
}

/* ── Add a wishlist entry (GATED by WRITES_ENABLED) ───────────────────────── */

export interface AddWishlistInput {
  companyName: string
  companyId: number | null
  leadName: string
  mobile: string
  designation: string
  addressLine1: string
  addressLine2: string
  cityId: number | null
  pincode: string
  description: string
  /** current user's numeric user_id (string); null for client-only accounts. */
  actor: string | null
}

/** Create an address row so wishlist.address_id (NOT NULL) is satisfied. */
async function ensureAddress(cityId: number | null, actor: string): Promise<number | null> {
  if (!cityId) return null
  const { data, error } = await supabase
    .from('address_master')
    .insert({ city_id: cityId, created_by: actor, created_date: new Date().toISOString() })
    .select('address_id')
    .single()
  if (error || !data) return null
  return (data as { address_id: number }).address_id
}

/**
 * Persist ONE wishlist row. Returns the new wishlist_id when writes are enabled.
 * When writes are disabled, returns { staged: true } WITHOUT touching the CRM DB —
 * the caller stages the entry locally so the full flow is reviewable.
 */
export async function addWishlist(
  input: AddWishlistInput,
): Promise<{ id?: number; staged?: boolean; error: string | null }> {
  const companyName = input.companyName.trim()
  if (!companyName) return { error: 'Company name is required.' }

  if (!WRITES_ENABLED) return { staged: true, error: null }

  if (!input.actor || isNaN(Number(input.actor))) {
    return { error: 'Your user profile is still loading. Please try again in a moment.' }
  }
  const actorStr = String(Number(input.actor))
  const now = new Date().toISOString()
  const addressId = await ensureAddress(input.cityId, actorStr)

  const row: Record<string, unknown> = {
    company_name: companyName,
    lead_name: input.leadName.trim() || null,
    lead_number: input.mobile.trim() || null,
    designation: input.designation.trim() || null,
    description: input.description.trim() || null,
    address_line1: input.addressLine1.trim() || null,
    address_line2: input.addressLine2.trim() || null,
    pincode: input.pincode.trim() || null,
    status: STATUS_WISHLIST,
    city_id: input.cityId ?? null,
    company_id: input.companyId ?? null,
    address_id: addressId ?? 1,
    created_by: actorStr,
    assign_agent: Number(input.actor),
    assign_tl: Number(input.actor),
    created_date: now,
  }

  const { data, error } = await supabase.from('wishlist').insert(row).select('wishlist_id').maybeSingle()
  if (error) return { error: error.message }
  return { id: (data as { wishlist_id: number } | null)?.wishlist_id, error: null }
}
