/**
 * wishlist.ts — Supabase reads/writes for the Wishlist module.
 *
 * A wishlist row is a target company a field salesperson flags on mobile (with a
 * geo-tagged photo + location) as worth pursuing. It flows up to a Team Lead, who
 * assigns it to an Agent, who later CONVERTS it into a Lead.
 *
 * Established DB facts (verified against the live schema — see REBUILD_LOG):
 *  - The `wishlist` row stores everything inline: company_name, lead_name (contact),
 *    designation, lead_number (= the captured CONTACT PHONE, often blank),
 *    address_line1/2, pincode, description (notes), latitude/longitude, image_url
 *    (the geo-tagged photo), map_address, status, city_id, company_id (optional),
 *    assign_agent (-> user_master), assign_tl (-> user_master, the Team Lead),
 *    created_by (= the salesperson's user_id, held as varchar).
 *  - Assignment is stored DIRECTLY on the wishlist row. The older `wishlist_assign`
 *    table is DEAD (0 rows) — we mirror writes into it best-effort for audit parity
 *    but the wishlist row is the source of truth.
 *  - Statuses are exactly "WishList" (sent) and "Converted To Lead" (terminal).
 *  - There is NO project_id on a wishlist; the Team Lead IS `assign_tl`. So "the
 *    project has no Team Lead" (FRS Q13) maps to "assign_tl is null" here.
 *  - lead_master requires NON-NULL client_assoc_id + source_id + address_id +
 *    email + mobile_no + designation + lead_name + lead_number. The wishlist has no
 *    client/source, so Convert-to-Lead asks the user to pick Client + Project and
 *    forces Source = "Wishlist" (source_id 4).
 *  - There is NO foreign-key column on lead_master that points back at a wishlist,
 *    so "link the wishlist as converted" = flipping wishlist.status to
 *    "Converted To Lead" (terminal). See convertWishlistToLead().
 */

import { supabase } from '../lib/supabase';
import { insertLeadWithUniqueNumber } from '../lib/leadsApi';
import { notify, notifyInApp, resolveUserEmailAndName } from '../lib/notify';
import { humanizeWriteError } from '../lib/writeError';
import {
  concurrencyPrecondition,
  makeConflict,
  type ConflictResult,
} from '../lib/concurrency';

/* ── Constants ───────────────────────────────────────────────────────────── */

export const STATUS_WISHLIST = 'WishList';
export const STATUS_CONVERTED = 'Converted To Lead';
/** source_master row for "Wishlist". Verified id = 4 in the live DB. */
export const WISHLIST_SOURCE_ID = 4;

/* ── Types ───────────────────────────────────────────────────────────────── */

export interface WishlistItem {
  id: string;
  wishlistId: number;
  company: string;
  contactName: string;
  designation: string;
  industry: string;
  city: string;
  state: string;
  agent: string;
  teamLead: string;
  status: string;
  phone: string;
  pincode: string;
  description: string;
  createdDate: string; // yyyy-mm-dd
  lastUpdated: string; // yyyy-mm-dd

  // ids used by filters / detail / writes
  assignAgentId: number | null;
  assignTlId: number | null;
  companyId: number | null;
  cityId: number | null;
}

export interface WishlistResult {
  items: WishlistItem[];
  agents: string[];
  teamLeads: string[];
  cities: string[];
  industries: string[];
  statuses: string[];
  error: string | null;
}

/** Everything the detail page needs. */
export interface WishlistDetail extends WishlistItem {
  addressLine1: string;
  addressLine2: string;
  mapAddress: string;
  latitude: string;
  longitude: string;
  imageUrl: string;
  leadNumber: string; // raw captured phone

  sharedById: string; // created_by (varchar)
  sharedByName: string;
  createdDateRaw: string | null;
  updatedDateRaw: string | null;

  /** True if this row can still be converted (status is not terminal). */
  convertible: boolean;
}

export interface UserOption {
  id: number;
  label: string;
}
export interface LookupOption {
  id: number;
  label: string;
}

/** Dropdown sources for the assign / convert flows. */
export interface WishlistLookups {
  agents: UserOption[];
  teamLeads: UserOption[];
  clients: LookupOption[];
  projects: { id: number; label: string; clientAssocId: number | null }[];
}

/* ── Internal row shapes ─────────────────────────────────────────────────── */

interface WishlistRow {
  wishlist_id: number;
  company_name: string | null;
  lead_name: string | null;
  designation: string | null;
  lead_number: string | null;
  status: string | null;
  pincode: string | null;
  description: string | null;
  address_line1: string | null;
  address_line2: string | null;
  map_address: string | null;
  latitude: string | null;
  longitude: string | null;
  image_url: string | null;
  city_id: number | null;
  assign_agent: number | null;
  assign_tl: number | null;
  company_id: number | null;
  created_by: string | null;
  created_date: string | null;
  updated_date: string | null;
}
interface CityRow { city_id: number; city_name: string | null; state_id: number | null; }
interface StateRow { state_id: number; state_name: string | null; }
interface UserRow { user_id: number; full_name: string | null; }
interface CompanyRow { company_id: number; company_name: string | null; industry_id: number | null; }
interface IndustryRow { industry_id: number; industry_name: string | null; }

const WISHLIST_COLS =
  'wishlist_id, company_name, lead_name, designation, lead_number, status, pincode, ' +
  'description, address_line1, address_line2, map_address, latitude, longitude, image_url, ' +
  'city_id, assign_agent, assign_tl, company_id, created_by, created_date, updated_date';

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function toDate(iso: string | null): string {
  return iso ? iso.substring(0, 10) : '';
}

/**
 * Audit-field guard (SHARED RULE 1): created_by/updated_by must be the current
 * user's numeric user_id (as a string) — never a name/email. The page derives
 * `actor` from profile.user_id, but if the profile wasn't fully loaded it could
 * fall back to a name; reject that here so we never persist a non-resolvable
 * owner/actor (lead ownership + RLS key on created_by = user_id).
 */
function assertNumericActor(actor: string): { error: string } | null {
  if (!actor || isNaN(Number(actor))) {
    return { error: 'Your user profile is still loading. Please try again in a moment.' };
  }
  return null;
}

/** Resolve numeric user ids (some held as varchar) -> full_name map. */
async function resolveUsers(ids: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  const uniq = [...new Set(ids.filter((n): n is number => n != null && !isNaN(n)))];
  if (uniq.length === 0) return map;
  const { data } = await supabase.from('user_master').select('user_id, full_name').in('user_id', uniq);
  ((data ?? []) as UserRow[]).forEach((u) => map.set(u.user_id, (u.full_name ?? '').trim()));
  return map;
}

/* ── List fetch ──────────────────────────────────────────────────────────── */

/**
 * Fetch all wishlist rows and resolve their linked dimensions
 * (company/industry, city/state, assigned agent + team lead, shared-by).
 */
export async function fetchWishlist(): Promise<WishlistResult> {
  // 1. Core wishlist rows
  const { data: rowsRaw, error: rowsError } = await supabase
    .from('wishlist')
    .select(WISHLIST_COLS)
    .is('deleted_date', null)
    .order('created_date', { ascending: false, nullsFirst: false })
    .limit(2000);

  if (rowsError || !rowsRaw) {
    return {
      items: [],
      agents: [],
      teamLeads: [],
      cities: [],
      industries: [],
      statuses: [],
      error: rowsError?.message ?? 'Failed to fetch wishlist',
    };
  }
  const rows = rowsRaw as unknown as WishlistRow[];

  // 2. Cities + their states
  const cityIds = [...new Set(rows.map((r) => r.city_id).filter((id): id is number => id !== null))];
  const { data: citiesRaw } = cityIds.length > 0
    ? await supabase.from('city_master').select('city_id, city_name, state_id').in('city_id', cityIds)
    : { data: [] };
  const cityRows = (citiesRaw ?? []) as unknown as CityRow[];

  const stateIds = [...new Set(cityRows.map((c) => c.state_id).filter((id): id is number => id !== null))];
  const { data: statesRaw } = stateIds.length > 0
    ? await supabase.from('state_master').select('state_id, state_name').in('state_id', stateIds)
    : { data: [] };
  const stateRows = (statesRaw ?? []) as unknown as StateRow[];

  // 3. Users referenced as agent, TL or shared-by
  const numericCreatedBy = rows
    .map((r) => Number(r.created_by))
    .filter((n) => !isNaN(n));
  const userIds = [
    ...rows.flatMap((r) => [r.assign_agent, r.assign_tl]).filter((id): id is number => id !== null),
    ...numericCreatedBy,
  ];
  const userMap = await resolveUsers(userIds);

  // 4. Canonical companies (only where company_id is present) + industries
  const companyIds = [...new Set(rows.map((r) => r.company_id).filter((id): id is number => id !== null))];
  const { data: companiesRaw } = companyIds.length > 0
    ? await supabase.from('company_master').select('company_id, company_name, industry_id').in('company_id', companyIds)
    : { data: [] };
  const companyRows = (companiesRaw ?? []) as unknown as CompanyRow[];

  const industryIds = [...new Set(companyRows.map((c) => c.industry_id).filter((id): id is number => id !== null))];
  const { data: industriesRaw } = industryIds.length > 0
    ? await supabase.from('industry_master').select('industry_id, industry_name').in('industry_id', industryIds)
    : { data: [] };
  const industryRows = (industriesRaw ?? []) as unknown as IndustryRow[];

  // Lookup maps
  const stateMap = new Map<number, string>();
  stateRows.forEach((s) => stateMap.set(s.state_id, (s.state_name ?? '').trim()));
  const cityMap = new Map<number, { name: string; state: string }>();
  cityRows.forEach((c) =>
    cityMap.set(c.city_id, {
      name: (c.city_name ?? '').trim(),
      state: c.state_id != null ? stateMap.get(c.state_id) ?? '' : '',
    })
  );
  const companyMap = new Map<number, CompanyRow>();
  companyRows.forEach((c) => companyMap.set(c.company_id, c));
  const industryMap = new Map<number, string>();
  industryRows.forEach((i) => industryMap.set(i.industry_id, (i.industry_name ?? '').trim()));

  const items: WishlistItem[] = rows.map((r) => {
    const company = r.company_id ? companyMap.get(r.company_id) : null;
    const companyName = (r.company_name ?? '').trim() || (company?.company_name ?? '').trim();
    const industry = company?.industry_id != null ? industryMap.get(company.industry_id) ?? '' : '';
    const cityInfo = r.city_id != null ? cityMap.get(r.city_id) : undefined;

    return {
      id: String(r.wishlist_id),
      wishlistId: r.wishlist_id,
      company: companyName,
      contactName: (r.lead_name ?? '').trim(),
      designation: (r.designation ?? '').trim(),
      industry,
      city: cityInfo?.name ?? '',
      state: cityInfo?.state ?? '',
      agent: r.assign_agent != null ? userMap.get(r.assign_agent) ?? '' : '',
      teamLead: r.assign_tl != null ? userMap.get(r.assign_tl) ?? '' : '',
      status: (r.status ?? '').trim(),
      phone: (r.lead_number ?? '').trim(),
      pincode: (r.pincode ?? '').trim(),
      description: (r.description ?? '').trim(),
      createdDate: toDate(r.created_date),
      lastUpdated: toDate(r.updated_date) || toDate(r.created_date),
      assignAgentId: r.assign_agent ?? null,
      assignTlId: r.assign_tl ?? null,
      companyId: r.company_id ?? null,
      cityId: r.city_id ?? null,
    };
  });

  const agents = [...new Set(items.map((i) => i.agent).filter(Boolean))].sort();
  const teamLeads = [...new Set(items.map((i) => i.teamLead).filter(Boolean))].sort();
  const cities = [...new Set(items.map((i) => i.city).filter(Boolean))].sort();
  const industries = [...new Set(items.map((i) => i.industry).filter(Boolean))].sort();
  const statuses = [...new Set(items.map((i) => i.status).filter(Boolean))].sort();

  return { items, agents, teamLeads, cities, industries, statuses, error: null };
}

/* ── Detail fetch ────────────────────────────────────────────────────────── */

export async function fetchWishlistDetail(
  wishlistId: number
): Promise<{ item: WishlistDetail | null; error: string | null }> {
  const { data, error } = await supabase
    .from('wishlist')
    .select(WISHLIST_COLS)
    .eq('wishlist_id', wishlistId)
    .is('deleted_date', null)
    .maybeSingle();

  if (error) return { item: null, error: error.message };
  if (!data) return { item: null, error: null };

  const r = data as unknown as WishlistRow;

  // Resolve city/state, users, company/industry in parallel.
  const [cityRes, companyRes] = await Promise.all([
    r.city_id != null
      ? supabase.from('city_master').select('city_id, city_name, state_id').eq('city_id', r.city_id).maybeSingle()
      : Promise.resolve({ data: null }),
    r.company_id != null
      ? supabase
          .from('company_master')
          .select('company_id, company_name, industry_id')
          .eq('company_id', r.company_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const cityRow = cityRes.data as CityRow | null;
  const companyRow = companyRes.data as CompanyRow | null;

  const [stateRes, industryRes] = await Promise.all([
    cityRow?.state_id
      ? supabase.from('state_master').select('state_name').eq('state_id', cityRow.state_id).maybeSingle()
      : Promise.resolve({ data: null }),
    companyRow?.industry_id
      ? supabase.from('industry_master').select('industry_name').eq('industry_id', companyRow.industry_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const sharedById = (r.created_by ?? '').trim();
  const userIds = [r.assign_agent, r.assign_tl, Number(sharedById)].filter(
    (n): n is number => n != null && !isNaN(n)
  );
  const userMap = await resolveUsers(userIds);

  const companyName = (r.company_name ?? '').trim() || (companyRow?.company_name ?? '').trim();
  const industry = (industryRes.data as IndustryRow | null)?.industry_name?.trim() ?? '';
  const status = (r.status ?? '').trim();

  const item: WishlistDetail = {
    id: String(r.wishlist_id),
    wishlistId: r.wishlist_id,
    company: companyName,
    contactName: (r.lead_name ?? '').trim(),
    designation: (r.designation ?? '').trim(),
    industry,
    city: (cityRow?.city_name ?? '').trim(),
    state: (stateRes.data as StateRow | null)?.state_name?.trim() ?? '',
    agent: r.assign_agent != null ? userMap.get(r.assign_agent) ?? '' : '',
    teamLead: r.assign_tl != null ? userMap.get(r.assign_tl) ?? '' : '',
    status,
    phone: (r.lead_number ?? '').trim(),
    pincode: (r.pincode ?? '').trim(),
    description: (r.description ?? '').trim(),
    createdDate: toDate(r.created_date),
    lastUpdated: toDate(r.updated_date) || toDate(r.created_date),
    assignAgentId: r.assign_agent ?? null,
    assignTlId: r.assign_tl ?? null,
    companyId: r.company_id ?? null,
    cityId: r.city_id ?? null,

    addressLine1: (r.address_line1 ?? '').trim(),
    addressLine2: (r.address_line2 ?? '').trim(),
    mapAddress: (r.map_address ?? '').trim(),
    latitude: (r.latitude ?? '').trim(),
    longitude: (r.longitude ?? '').trim(),
    imageUrl: (r.image_url ?? '').trim(),
    leadNumber: (r.lead_number ?? '').trim(),

    sharedById,
    sharedByName: sharedById && !isNaN(Number(sharedById)) ? userMap.get(Number(sharedById)) ?? '' : '',
    createdDateRaw: r.created_date,
    updatedDateRaw: r.updated_date,

    convertible: status !== STATUS_CONVERTED,
  };

  return { item, error: null };
}

/* ── Lookups for assign / convert dropdowns ──────────────────────────────── */

/**
 * Agents + Team Leads come from project_user role tags (deduped to users) UNIONED
 * with whoever is already assigned across the wishlist rows — because most
 * already-assigned agents/TLs are NOT tagged in project_user, and dropping them
 * would make the currently-selected assignee vanish from the reassign dropdown.
 *
 * `currentAgentId` / `currentTlId` (optional) are the row's present assignee; they
 * are ALWAYS injected into the option list so the pre-selected <select> value
 * resolves, even if that user is disabled or holds no role tag.
 *
 * Clients + Projects power the Convert-to-Lead flow (lead_master needs a client).
 */
export async function fetchWishlistLookups(
  currentAgentId?: number | null,
  currentTlId?: number | null
): Promise<WishlistLookups> {
  const [agentRolesRes, tlRolesRes, assignedRes, clientsRes, projectsRes] = await Promise.all([
    supabase.from('project_user').select('user_id').eq('role_name', 'AGENT').is('deleted_date', null),
    supabase.from('project_user').select('user_id').eq('role_name', 'TEAM_LEAD').is('deleted_date', null),
    // Everyone already assigned on a live wishlist row — the real population of
    // agents/TLs in use, regardless of how they're role-tagged.
    supabase.from('wishlist').select('assign_agent, assign_tl').is('deleted_date', null),
    supabase
      .from('client_association')
      .select('client_assoc_id, client_name')
      .is('deleted_date', null)
      .order('client_name'),
    supabase
      .from('project')
      .select('project_id, project_name, client_assoc_id')
      .is('deleted_date', null)
      .eq('enabled', true)
      .order('project_name'),
  ]);

  const assignedRows = (assignedRes.data ?? []) as { assign_agent: number | null; assign_tl: number | null }[];
  const assignedAgentIds = assignedRows.map((r) => r.assign_agent).filter((id): id is number => id != null);
  const assignedTlIds = assignedRows.map((r) => r.assign_tl).filter((id): id is number => id != null);

  const agentIds = [
    ...new Set([
      ...((agentRolesRes.data ?? []) as { user_id: number }[]).map((r) => r.user_id),
      ...assignedAgentIds,
      ...(currentAgentId != null ? [currentAgentId] : []),
    ]),
  ];
  const tlIds = [
    ...new Set([
      ...((tlRolesRes.data ?? []) as { user_id: number }[]).map((r) => r.user_id),
      ...assignedTlIds,
      ...(currentTlId != null ? [currentTlId] : []),
    ]),
  ];
  const allUserIds = [...new Set([...agentIds, ...tlIds])];

  // Resolve names for ALL candidate users (no `enabled` filter — a disabled user
  // can still be the current assignee and must remain selectable/labelled).
  const userMap = new Map<number, string>();
  if (allUserIds.length > 0) {
    const { data: users } = await supabase
      .from('user_master')
      .select('user_id, full_name')
      .in('user_id', allUserIds);
    ((users ?? []) as UserRow[]).forEach((u) => userMap.set(u.user_id, (u.full_name ?? '').trim()));
  }

  const toOptions = (ids: number[]): UserOption[] =>
    ids
      .map((id) => ({ id, label: userMap.get(id) ?? `User #${id}` }))
      .filter((o) => o.label)
      .sort((a, b) => a.label.localeCompare(b.label));

  return {
    agents: toOptions(agentIds),
    teamLeads: toOptions(tlIds),
    clients: ((clientsRes.data ?? []) as { client_assoc_id: number; client_name: string }[]).map((c) => ({
      id: c.client_assoc_id,
      label: c.client_name ?? '',
    })),
    projects: ((projectsRes.data ?? []) as { project_id: number; project_name: string; client_assoc_id: number | null }[]).map(
      (p) => ({ id: p.project_id, label: p.project_name ?? '', clientAssocId: p.client_assoc_id ?? null })
    ),
  };
}

/* ── Assign / Reassign ───────────────────────────────────────────────────── */

/**
 * Assign or reassign a wishlist row to an agent (and optionally update its TL).
 * Writes the assignment onto the wishlist row (source of truth) and mirrors it
 * into the legacy wishlist_assign table best-effort for audit parity.
 */
export async function assignWishlist(input: {
  wishlistId: number;
  agentId: number;
  teamLeadId: number | null;
  addressId?: number | null;
  actor: string;
  /** Optional context for notifications — passed in by the caller from the loaded item. */
  leadName?: string;
  company?: string;
  isReassign?: boolean;
  /** Original wishlist.updated_date when the page loaded (concurrency guard). */
  originalUpdatedDate?: string | null;
}): Promise<{ error: string } | ConflictResult | null> {
  const actorErr = assertNumericActor(input.actor);
  if (actorErr) return actorErr;

  const now = new Date().toISOString();

  const patch: Record<string, unknown> = {
    assign_agent: input.agentId,
    updated_by: input.actor,
    updated_date: now,
  };
  if (input.teamLeadId != null) patch.assign_tl = input.teamLeadId;

  const guard = concurrencyPrecondition(input.originalUpdatedDate);
  if (guard !== undefined) {
    const { data: affected, error } = await supabase
      .from('wishlist').update(patch).eq('wishlist_id', input.wishlistId)
      .eq('updated_date', guard).select('wishlist_id');
    if (error) return { error: humanizeWriteError(error) ?? (error as { message: string }).message };
    if (!affected || affected.length === 0) return makeConflict('wishlist');
  } else {
    const { error } = await supabase.from('wishlist').update(patch).eq('wishlist_id', input.wishlistId);
    if (error) return { error: humanizeWriteError(error) ?? (error as { message: string }).message };
  }

  // Fire-and-forget: notify the assigned agent — BOTH email and in-app.
  // TODO recipients: owner will tune per-action later
  const agentId = input.agentId;
  const eventName = input.isReassign ? 'lead_reassigned' : 'lead_assigned';
  const leadName = input.leadName ?? '';
  const company = input.company ?? '';
  const wishlistId = input.wishlistId;
  ;(async () => {
    try {
      // Recipient = the agent the wishlist is being assigned to.
      const { email: agentEmail, name: agentName } = await resolveUserEmailAndName(supabase, agentId);
      const actorInfo = await resolveUserEmailAndName(supabase, Number(input.actor));
      const eventData = {
        leadName: leadName || `Wishlist #${wishlistId}`,
        company,
        assignedByName: actorInfo.name || input.actor,
      };
      if (agentEmail) {
        await notify(eventName, agentEmail, eventData);
      }
      void agentName; // resolved above; kept for future use
      await notifyInApp(supabase, agentId, {
        status: input.isReassign ? 'Wishlist Reassigned' : 'Wishlist Assigned',
        notif_descr: input.isReassign
          ? `A wishlist entry has been reassigned to you: "${leadName || `#${wishlistId}`}"`
          : `A new wishlist entry has been assigned to you: "${leadName || `#${wishlistId}`}"`,
        route: `/wishlist/${wishlistId}`,
        actor: input.actor,
      });
    } catch {
      /* non-fatal — never block the assignment */
    }
  })();

  // Mirror into the (legacy/dead) wishlist_assign table — non-fatal. Its columns
  // are NOT NULL incl. address_id, so we only write when we have one.
  if (input.teamLeadId != null && input.addressId != null) {
    try {
      await supabase.from('wishlist_assign').insert({
        assign_agent: input.agentId,
        assign_tl: input.teamLeadId,
        address_id: input.addressId,
        created_by: input.actor,
        created_date: now,
      });
    } catch {
      /* legacy table is unused; ignore */
    }
  }

  return null;
}

/* ── Status change ───────────────────────────────────────────────────────── */

export async function updateWishlistStatus(
  wishlistId: number,
  status: string,
  actor: string,
  /** Original wishlist.updated_date when the page loaded (concurrency guard). */
  originalUpdatedDate?: string | null,
): Promise<{ error: string } | ConflictResult | null> {
  const actorErr = assertNumericActor(actor);
  if (actorErr) return actorErr;

  const statusPatch = { status, updated_by: actor, updated_date: new Date().toISOString() };
  const guard = concurrencyPrecondition(originalUpdatedDate);
  if (guard !== undefined) {
    const { data, error } = await supabase
      .from('wishlist').update(statusPatch).eq('wishlist_id', wishlistId)
      .eq('updated_date', guard).select('wishlist_id');
    if (error) {
      console.error('[wishlist] updateWishlistStatus failed', error);
      return { error: humanizeWriteError(error) ?? 'Could not update the wishlist status.' };
    }
    if (!data || data.length === 0) return makeConflict('wishlist');
    return null;
  }
  const { data, error } = await supabase
    .from('wishlist').update(statusPatch).eq('wishlist_id', wishlistId).select('wishlist_id');
  if (error) {
    console.error('[wishlist] updateWishlistStatus failed', error);
    return { error: humanizeWriteError(error) ?? 'Could not update the wishlist status.' };
  }
  if (!data || (data as { wishlist_id: number }[]).length === 0) {
    return { error: 'You can only edit records assigned to you.' };
  }
  return null;
}

/* ── Convert to Lead ─────────────────────────────────────────────────────── */

export interface ConvertToLeadInput {
  wishlistId: number;
  clientAssocId: number;
  projectId: number | null;
  agentId: number | null;
  companyId: number | null; // carried from the wishlist (if any)
  // pre-filled (and editable) from the wishlist; can be overridden by the user
  leadName: string;
  designation: string;
  email: string;
  mobileNo: string;
  cityId: number | null;
  actor: string;
}

/** Create an address row for a city so lead_master.address_id (NOT NULL) is satisfied. */
async function ensureAddress(cityId: number | null, actor: string): Promise<number | null> {
  if (!cityId) return null;
  const { data, error } = await supabase
    .from('address_master')
    .insert({ city_id: cityId, created_by: actor, created_date: new Date().toISOString() })
    .select('address_id')
    .single();
  if (error || !data) return null;
  return (data as { address_id: number }).address_id;
}

/**
 * Convert a wishlist row into a Lead.
 *
 * Per FRS-parity (Owner Q12 default = convert to a LEAD, not a Meeting):
 *  - creates a lead_master row pre-filled from the wishlist company/contact data,
 *  - forces Source = "Wishlist" (source_id 4),
 *  - carries the wishlist's company_id (if any) onto the lead,
 *  - seeds an initial lead_report (stage "Warm") so the lead has a stage and can
 *    progress through the pipeline,
 *  - sets audit fields (created_by = current user_id, created_date),
 *  - marks the wishlist status "Converted To Lead" (terminal — Convert disables).
 *
 * // OWNER-DEFAULT: The CR (Layer 2) wants Wishlist to convert directly to a
 * // *Meeting* instead of a Lead. That is DEFERRED — we convert to a Lead per FRS.
 *
 * Note: lead_master has no column linking back to the wishlist, so the link is
 * recorded only by flipping the wishlist status. If a hard link is later required,
 * add a wishlist_id column to lead_master (or a bridge row) in a follow-up.
 */
export async function convertWishlistToLead(
  input: ConvertToLeadInput
): Promise<{ lead_id: number } | { error: string }> {
  const actor = input.actor;
  const actorErr = assertNumericActor(actor);
  if (actorErr) return actorErr;

  const now = new Date().toISOString();

  const addressId = await ensureAddress(input.cityId, actor);

  const payload = {
    lead_name: input.leadName.trim() || 'Unknown',
    designation: input.designation.trim() || 'Unknown',
    email: input.email.trim() || '',
    mobile_no: input.mobileNo.trim() || '',
    client_assoc_id: input.clientAssocId,
    project_id: input.projectId,
    agent_id: input.agentId,
    company_id: input.companyId, // carry the wishlist's company onto the lead (nullable)
    source_id: WISHLIST_SOURCE_ID, // forced to "Wishlist"
    address_id: addressId ?? 1, // placeholder address if no city (see leadsApi caveat)
    is_closed: false,
    created_by: actor,
    created_date: now,
  };

  // Collision-safe insert (shared helper retries on a duplicate lead_number).
  const result = await insertLeadWithUniqueNumber(payload);
  if ('error' in result) return result;

  // Seed an initial lead_report so the converted lead has a stage and can move
  // through the pipeline (Leads list/detail derive stage from the latest
  // lead_report; updateLeadStage needs an existing report). Best-effort — the
  // lead already exists, so a report failure must not block the conversion.
  const reportUserId = input.agentId ?? Number(actor);
  await supabase.from('lead_report').insert({
    lead_id: result.lead_id,
    user_id: reportUserId,
    stage_id: 1, // "Warm" — lowest/initial stage in stage_master
    report_status: 'Warm',
    created_by: actor,
    created_date: now,
  });

  // Mark the wishlist converted (terminal). Best-effort — the lead already exists.
  await supabase
    .from('wishlist')
    .update({ status: STATUS_CONVERTED, updated_by: actor, updated_date: now })
    .eq('wishlist_id', input.wishlistId);

  return { lead_id: result.lead_id };
}

/* ── Shared date formatter ───────────────────────────────────────────────── */

export function fmtLongDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ═══════════════════════════════════════════════════════════════════════════
   ADD A WISHLIST ENTRY (ALT-276) — sales / client-portal prospect capture.

   Mirrors the legacy mobile app (old-code/.../screens/wishlist/Wishlist.jsx).
   On mobile, the submit body (`newBody`) maps the form to these wishlist columns:
     companyName, leadName, leadNumber (=mobile), designation, description,
     addressLine1, addressLine2, status='WishList', pincode, latitude/longitude,
     image_url, assign_tl = assign_agent = current user, company.companyId,
     city.cityId.

   Web v1 differences (intentional):
     - SKIP the geo-tagged photo + GPS (camera/location are mobile-only). So
       image_url / latitude / longitude / map_address are left null.
     - The mobile form collects Country (default "India") and State, but the
       `wishlist` table has NEITHER a country column NOR a state_id column — only
       `city_id`. State is DERIVED from city_master.state_id. So Country/State are
       UI-only here and are NOT persisted (omitted — no backing column).
     - assign_tl / assign_agent are set to the current user's numeric user_id
       (mobile parity) ONLY when that resolves to a number; otherwise left null
       (a client-portal user has no user_master id and must not poison the FK).
══════════════════════════════════════════════════════════════════════════ */

export interface AddWishlistInput {
  /** Free-text company name (always sent — required). */
  companyName: string;
  /** Canonical company id if the user picked a match from the autocomplete. */
  companyId: number | null;
  /** Prospect / lead contact name (optional). */
  leadName: string;
  /** Captured contact phone — stored in lead_number (mobile parity). */
  mobile: string;
  designation: string;
  addressLine1: string;
  addressLine2: string;
  /** Resolved city id from the City dropdown (carries the state via city_master). */
  cityId: number | null;
  pincode: string;
  description: string;
  /**
   * Current user's numeric user_id (as string) for created_by + assign_*.
   * Pass profile.user_id; may be null for portal users without a user_master row.
   */
  actor: string | null;
}

/**
 * Insert ONE wishlist row from the Add-to-wishlist form. Defensive about which
 * columns exist: builds the payload from the REAL `wishlist` columns only
 * (verified against WishlistRow / DATA-DICTIONARY). status is forced to
 * "WishList" (the only "sent" status). Returns the new wishlist_id (if the DB
 * returns it) and an error string when the insert fails.
 */
export async function addWishlist(
  input: AddWishlistInput
): Promise<{ id?: number; error: string | null }> {
  const companyName = input.companyName.trim();
  if (!companyName) return { error: 'Company name is required.' };

  const now = new Date().toISOString();

  // Audit / assignment actor MUST resolve to a numeric user_id: wishlist.created_by
  // is NOT NULL and is the ownership/RLS key, so we cannot insert without it. The
  // Sales Wishlist page is gated to logged-in sales/internal users who have a
  // user_master id; reject a non-resolvable actor with a friendly retry message
  // (mirrors assignWishlist / convertWishlistToLead). True no-user client-portal
  // accounts are out of scope until ALT-274 (they'd need a system sentinel id).
  if (!input.actor) {
    return { error: 'Your user profile is still loading. Please try again in a moment.' };
  }
  const actorErr = assertNumericActor(input.actor);
  if (actorErr) return actorErr;
  const numericActor = Number(input.actor);
  const actorStr = String(numericActor);

  // wishlist.address_id is NOT NULL — create an address row for the chosen city
  // (mirrors the lead path) and fall back to placeholder id 1 when there's no city,
  // exactly like convertWishlistToLead / leadsApi.
  const addressId = await ensureAddress(input.cityId, actorStr);

  const row: Record<string, unknown> = {
    company_name: companyName,
    lead_name: input.leadName.trim() || null,
    lead_number: input.mobile.trim() || null, // captured contact phone
    designation: input.designation.trim() || null,
    description: input.description.trim() || null,
    address_line1: input.addressLine1.trim() || null,
    address_line2: input.addressLine2.trim() || null,
    pincode: input.pincode.trim() || null,
    status: STATUS_WISHLIST,
    city_id: input.cityId ?? null,
    company_id: input.companyId ?? null,
    address_id: addressId ?? 1, // NOT NULL column — placeholder when no city
    // created_by is held as varchar across the app — write the numeric id as text.
    created_by: actorStr,
    // Mobile parity: a self-captured wishlist is assigned to the capturer as both
    // the agent and the team lead. Both columns are numeric FKs to user_master.
    assign_agent: numericActor,
    assign_tl: numericActor,
    created_date: now,
  };

  const { data, error } = await supabase
    .from('wishlist')
    .insert(row)
    .select('wishlist_id')
    .maybeSingle();

  if (error) return { error: humanizeWriteError(error) ?? error.message };
  return { id: (data as { wishlist_id: number } | null)?.wishlist_id, error: null };
}

/* ── Company autocomplete (ALT-276) ──────────────────────────────────────── */

export interface CompanySearchOption {
  companyId: number;
  companyName: string;
  /** Best-effort address fields if present on company_master (else ''). */
  cityId: number | null;
}

/**
 * Autocomplete companies from company_master by name. Only runs at >= 2 chars
 * (mobile parity), case-insensitive, capped at 10. Returns the canonical company
 * id so a picked match carries company_id onto the wishlist row.
 */
export async function searchCompanies(term: string): Promise<CompanySearchOption[]> {
  const q = term.trim();
  if (q.length < 2) return [];
  const { data, error } = await supabase
    .from('company_master')
    .select('company_id, company_name, city_id')
    .ilike('company_name', `%${q}%`)
    .is('deleted_date', null)
    .order('company_name', { ascending: true, nullsFirst: false })
    .limit(10);
  if (error || !data) return [];
  return (data as { company_id: number; company_name: string | null; city_id: number | null }[]).map(
    (c) => ({ companyId: c.company_id, companyName: (c.company_name ?? '').trim(), cityId: c.city_id ?? null })
  );
}

/* ── Cascading State → City location dropdowns (ALT-276) ──────────────────── */

export interface StateOption { stateId: number; stateName: string; }
export interface CityOption { cityId: number; cityName: string; }

/**
 * All states (state_master), sorted by name. Used by the State dropdown that
 * drives the dependent City dropdown. city_master.state_id links a city to its
 * state, so this is a REAL cascade (no flat-search fallback needed).
 */
export async function listStates(): Promise<StateOption[]> {
  const { data, error } = await supabase
    .from('state_master')
    .select('state_id, state_name')
    .order('state_name', { ascending: true, nullsFirst: false })
    .limit(1000);
  if (error || !data) return [];
  return (data as { state_id: number; state_name: string | null }[]).map((s) => ({
    stateId: s.state_id,
    stateName: (s.state_name ?? '').trim(),
  }));
}

/**
 * Cities for a state (city_master.state_id = stateId), sorted by name. Powers
 * the City dropdown once a State is chosen. Returns city_id so the wishlist row
 * persists city_id (and the state is recoverable via city_master.state_id).
 */
export async function listCitiesByState(stateId: number): Promise<CityOption[]> {
  const { data, error } = await supabase
    .from('city_master')
    .select('city_id, city_name')
    .eq('state_id', stateId)
    .order('city_name', { ascending: true, nullsFirst: false })
    .limit(2000);
  if (error || !data) return [];
  return (data as { city_id: number; city_name: string | null }[]).map((c) => ({
    cityId: c.city_id,
    cityName: (c.city_name ?? '').trim(),
  }));
}

/* ── Leads-by-company (ALT-276, optional designation auto-fill) ───────────── */

export interface CompanyLeadOption {
  leadId: number;
  leadName: string;
  designation: string;
  mobileNo: string;
}

/**
 * Leads already on file for a company — used (best-effort) to offer a prospect
 * name + auto-fill the designation, mirroring the mobile getLeadList(). If the
 * query fails or the schema lacks the join, returns [] and the caller degrades
 * to free-text entry. lead_master links to a company via company_id.
 */
export async function leadsByCompany(companyId: number): Promise<CompanyLeadOption[]> {
  const { data, error } = await supabase
    .from('lead_master')
    .select('lead_id, lead_name, designation, mobile_no')
    .eq('company_id', companyId)
    .is('deleted_date', null)
    .order('lead_name', { ascending: true, nullsFirst: false })
    .limit(50);
  if (error || !data) return [];
  return (data as { lead_id: number; lead_name: string | null; designation: string | null; mobile_no: string | null }[])
    .map((l) => ({
      leadId: l.lead_id,
      leadName: (l.lead_name ?? '').trim(),
      designation: (l.designation ?? '').trim(),
      mobileNo: (l.mobile_no ?? '').trim(),
    }))
    .filter((l) => l.leadName);
}
