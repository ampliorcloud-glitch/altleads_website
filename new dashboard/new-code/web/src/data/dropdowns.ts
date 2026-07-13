/**
 * Dropdown option data layer — reads/writes the `dropdown_option` table.
 *
 * Table schema:
 *   dropdown_option(
 *     option_id  bigint identity PK,
 *     category   text NOT NULL,
 *     value      text NOT NULL,
 *     label      text NOT NULL,
 *     sort_order int,
 *     is_active  boolean default true,
 *     created_by text, created_date text,
 *     updated_by text, updated_date text,
 *     UNIQUE(category, value)
 *   )
 *
 * Notes:
 *   - No hard deletes — use is_active = false to hide an option.
 *   - audit columns (created_by / updated_by) store user_id as text, matching admin.ts.
 *   - All functions return `string | null` for errors (null = success), matching admin.ts.
 */

import { supabase } from '../lib/supabase';
import { humanizeWriteError } from '../lib/writeError';

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export interface DropdownOption {
  option_id: number;
  category: string;
  value: string;
  label: string;
  sort_order: number | null;
  is_active: boolean;
}

/** Map of category -> options, used by the admin UI. */
export type DropdownGrouped = Record<string, DropdownOption[]>;

/** Friendly display names for known categories. */
export const CATEGORY_LABELS: Record<string, string> = {
  contact_status:   'Contact Status',
  call_disposition: 'Call Disposition',
  account_status:   'Account Status',
  decision_power:   'Decision Power',
  feasibility:      'Feasibility',
};

/** Ordered list of known categories (controls display order in admin UI). */
export const KNOWN_CATEGORIES = Object.keys(CATEGORY_LABELS);

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Derive a slug value from a label: lowercase, non-alphanumeric → underscore, trim underscores. */
function labelToSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function nowIso(): string {
  return new Date().toISOString();
}

/* ------------------------------------------------------------------ */
/*  Reads                                                               */
/* ------------------------------------------------------------------ */

/**
 * Fetch active options for a single category, ordered by sort_order asc, then label asc.
 * Used by forms / dropdowns in the main app.
 */
export async function fetchOptions(category: string): Promise<DropdownOption[]> {
  const { data, error } = await supabase
    .from('dropdown_option')
    .select('option_id, category, value, label, sort_order, is_active')
    .eq('category', category)
    .eq('is_active', true)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('label', { ascending: true });

  if (error) {
    console.error('[dropdowns] fetchOptions error', error);
    return [];
  }
  return (data ?? []) as unknown as DropdownOption[];
}

/**
 * Fetch ALL options (active + inactive) grouped by category.
 * Used by the admin Dropdowns panel.
 */
export async function fetchAllGrouped(): Promise<{ grouped: DropdownGrouped; error: string | null }> {
  const { data, error } = await supabase
    .from('dropdown_option')
    .select('option_id, category, value, label, sort_order, is_active')
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('label', { ascending: true });

  if (error) {
    return { grouped: {}, error: error.message };
  }

  const rows = (data ?? []) as unknown as DropdownOption[];
  const grouped: DropdownGrouped = {};

  for (const row of rows) {
    if (!grouped[row.category]) grouped[row.category] = [];
    grouped[row.category].push(row);
  }

  return { grouped, error: null };
}

/* ------------------------------------------------------------------ */
/*  Writes                                                              */
/* ------------------------------------------------------------------ */

/**
 * Create a new dropdown option.
 * If `value` is omitted, it is derived from `label` via labelToSlug().
 * Returns null on success or an error string.
 */
export async function createOption(params: {
  category: string;
  label: string;
  value?: string;
  sort_order?: number;
  actorId?: string | null;
}): Promise<string | null> {
  const { category, label, sort_order, actorId } = params;
  const value = params.value?.trim() || labelToSlug(label);

  const { error } = await supabase.from('dropdown_option').insert({
    category,
    label: label.trim(),
    value,
    sort_order: sort_order ?? null,
    is_active: true,
    created_by: actorId ?? null,
    created_date: nowIso(),
    updated_by: actorId ?? null,
    updated_date: nowIso(),
  });

  if (error) return humanizeWriteError(error);
  return null;
}

/**
 * Update label, sort_order, or is_active on an existing option.
 * Returns null on success or an error string.
 */
export async function updateOption(
  option_id: number,
  patch: { label?: string; sort_order?: number | null; is_active?: boolean },
  actorId?: string | null,
): Promise<string | null> {
  const updates: Record<string, unknown> = {
    updated_by: actorId ?? null,
    updated_date: nowIso(),
  };
  if (patch.label !== undefined) updates.label = patch.label.trim();
  if (patch.sort_order !== undefined) updates.sort_order = patch.sort_order;
  if (patch.is_active !== undefined) updates.is_active = patch.is_active;

  const { error } = await supabase
    .from('dropdown_option')
    .update(updates)
    .eq('option_id', option_id);

  if (error) return humanizeWriteError(error);
  return null;
}

/**
 * Enable or disable an option (soft toggle — never deletes).
 * Returns null on success or an error string.
 */
export async function setActive(
  option_id: number,
  is_active: boolean,
  actorId?: string | null,
): Promise<string | null> {
  return updateOption(option_id, { is_active }, actorId);
}

/**
 * Update the sort_order of an option.
 * Returns null on success or an error string.
 */
export async function reorderOption(
  option_id: number,
  sort_order: number,
  actorId?: string | null,
): Promise<string | null> {
  return updateOption(option_id, { sort_order }, actorId);
}
