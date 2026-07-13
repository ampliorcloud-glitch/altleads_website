/**
 * hungerbox.ts — HungerBox launch helpers, constants, and feature flag.
 *
 * Feature flag: HUNGERBOX_FEATURES (default false).
 * When false, all HungerBox-specific DB queries are skipped, the live app
 * behaves exactly as today, and no attempt is made to query tables that don't
 * exist in production yet. Flip to true AFTER applying the migrations:
 *   apply-hungerbox-company-sites.cjs
 *   apply-hungerbox-dnc-feasibility.cjs
 *
 * --- Canonical Tier-1 metro list for India (used for priority flagging) ---
 * NCR covers: Delhi, Gurgaon, Gurugram, Noida, Faridabad, Ghaziabad.
 * The list normalises each city to lowercase for comparison.
 */

// -----------------------------------------------------------------------
// FEATURE FLAG — default OFF (dark ship)
// -----------------------------------------------------------------------
export const HUNGERBOX_FEATURES = false;

// -----------------------------------------------------------------------
// Metro canonical list
// -----------------------------------------------------------------------
export interface MetroEntry {
  /** Display name (title-case). */
  name: string;
  /** Alternative spellings / sub-cities that resolve to this metro. Lowercase. */
  aliases: string[];
}

/**
 * Indian Tier-1 metros we prioritise for HungerBox outreach.
 * Agents filter / sort by `isMetroCity()` on the city name.
 */
export const METRO_CITIES: MetroEntry[] = [
  {
    name: 'Delhi / NCR',
    aliases: ['delhi', 'new delhi', 'ncr', 'gurugram', 'gurgaon', 'noida', 'faridabad', 'ghaziabad'],
  },
  {
    name: 'Mumbai',
    aliases: ['mumbai', 'bombay', 'navi mumbai', 'thane'],
  },
  {
    name: 'Bengaluru',
    aliases: ['bengaluru', 'bangalore'],
  },
  {
    name: 'Hyderabad',
    aliases: ['hyderabad', 'secunderabad', 'cyberabad'],
  },
  {
    name: 'Chennai',
    aliases: ['chennai', 'madras'],
  },
  {
    name: 'Kolkata',
    aliases: ['kolkata', 'calcutta'],
  },
  {
    name: 'Pune',
    aliases: ['pune', 'pimpri', 'pimpri-chinchwad', 'chinchwad'],
  },
  {
    name: 'Ahmedabad',
    aliases: ['ahmedabad', 'ahmedabad', 'gandhinagar'],
  },
];

/** Lowercase set of all metro alias strings for O(1) lookup. */
const _metroAliasSet: Set<string> = new Set(
  METRO_CITIES.flatMap((m) => m.aliases),
);

/**
 * Returns true when `cityName` (case-insensitive) is a Tier-1 metro or
 * one of its known sub-cities / aliases.
 */
export function isMetroCity(cityName: string | null | undefined): boolean {
  if (!cityName) return false;
  return _metroAliasSet.has(cityName.trim().toLowerCase());
}

/**
 * Returns the canonical MetroEntry for a city, or null when it's not a metro.
 * Useful for showing "Delhi / NCR" instead of the raw "Gurgaon".
 */
export function resolveMetro(cityName: string | null | undefined): MetroEntry | null {
  if (!cityName) return null;
  const lower = cityName.trim().toLowerCase();
  return METRO_CITIES.find((m) => m.aliases.includes(lower)) ?? null;
}

// -----------------------------------------------------------------------
// DNC/feasibility reason labels (drives dropdowns)
// -----------------------------------------------------------------------
export const DNC_REASONS = [
  'Opted out during call',
  'Company requested no contact',
  'Regulatory / legal hold',
  'Existing customer — suppress outreach',
  'Duplicate — merged into another record',
  'Other',
] as const;

export const NON_FEASIBLE_REASONS = [
  'Below employee threshold',
  'Wrong commercial model for our offering',
  'Geography not serviceable',
  'Budget constraints',
  'Competitor lock-in',
  'Already serviced by HungerBox',
  'Other',
] as const;

export type DncReason = (typeof DNC_REASONS)[number];
export type NonFeasibleReason = (typeof NON_FEASIBLE_REASONS)[number];

// -----------------------------------------------------------------------
// Scope type — which level a DNC / feasibility flag applies to
// -----------------------------------------------------------------------
export type HbScope = 'company' | 'site';

// -----------------------------------------------------------------------
// Pre-qualified question keys
// The canonical set for HungerBox. Stored as typed keys in the JSONB column
// `company_site.prequalified_answers` (via hb_site_history for changes).
// -----------------------------------------------------------------------
export interface HbPrequalifiedAnswers {
  /** Total headcount at this site (numeric). */
  total_employees: number | null;
  /** Commercial model, e.g. "Subsidised", "Revenue-share", "Contracted". */
  commercial_model: string | null;
  /** Any free-form notes captured at the site level. */
  notes: string | null;
}

export const EMPTY_PREQUALIFIED: HbPrequalifiedAnswers = {
  total_employees: null,
  commercial_model: null,
  notes: null,
};

export const COMMERCIAL_MODEL_OPTIONS = [
  'Subsidised',
  'Revenue-share',
  'Contracted',
  'Hybrid',
  'Unknown',
] as const;

export type CommercialModel = (typeof COMMERCIAL_MODEL_OPTIONS)[number];

// -----------------------------------------------------------------------
// Utility: build a "non-contactable" reason string from DNC + feasibility
// -----------------------------------------------------------------------
export function nonContactableReason(
  dncActive: boolean,
  feasibilityActive: boolean,
): string | null {
  if (dncActive && feasibilityActive) return 'DNC + Non-feasible';
  if (dncActive) return 'DNC';
  if (feasibilityActive) return 'Non-feasible';
  return null;
}
