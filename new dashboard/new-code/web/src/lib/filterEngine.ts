/**
 * filterEngine.ts — Advanced per-field filter model + client-side evaluator.
 *
 * ALT-270 · v1 (2026-06-28)
 *
 * Feature flag: import ADVANCED_FILTERS before using this module.
 * When ADVANCED_FILTERS is false the list pages skip FilterBuilder/ViewPicker
 * and keep today's basic filter panels unchanged.
 *
 * Operator set (v1):
 *   Text/Enum : contains · not_contains · is · is_not · is_any_of · is_none_of
 *               · is_known · is_unknown
 *   Date      : on · before · after · between · not_between · is_known · is_unknown
 *               · relative_past · relative_next   (value = number of days)
 *   Number    : eq · neq · gt · gte · lt · lte · between · is_known · is_unknown
 *   Boolean   : is · is_not
 *
 * Exclude/NOT is first-class: is_not, is_none_of, not_contains, not_between.
 *
 * v2 deferred: nested OR groups UI, server-side PostgREST query builder.
 * See docs/product/ADVANCED-FILTERS-SPEC.md §5 Phase 2.
 */

// -----------------------------------------------------------------------
// Feature flag
// -----------------------------------------------------------------------

/** Set to true to enable FilterBuilder + ViewPicker on all 5 list pages. */
export const ADVANCED_FILTERS = false;

// -----------------------------------------------------------------------
// Operator union
// -----------------------------------------------------------------------

export type FilterOperator =
  // Text / Enum
  | 'contains'
  | 'not_contains'
  | 'is'
  | 'is_not'
  | 'is_any_of'
  | 'is_none_of'
  | 'is_known'
  | 'is_unknown'
  // Date
  | 'on'
  | 'before'
  | 'after'
  | 'between'
  | 'not_between'
  // Number
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  // Relative date (value = number of days as number)
  | 'relative_past'
  | 'relative_next';

// -----------------------------------------------------------------------
// Field types
// -----------------------------------------------------------------------

export type FilterFieldType = 'text' | 'enum' | 'date' | 'number' | 'boolean';

// -----------------------------------------------------------------------
// Condition & Group model
// -----------------------------------------------------------------------

/** A single condition on one field. */
export interface FilterCondition {
  /** Client-only stable id (uuid-ish) for React keys + removal. */
  id: string;
  /** Field accessor path on the row object, e.g. "city_name", "is_dnc". */
  field: string;
  fieldType: FilterFieldType;
  op: FilterOperator;
  /**
   * The filter value.
   *  - string[]        → is_any_of / is_none_of
   *  - [string,string] → between / not_between  (date or number ranges)
   *  - string          → single text / date value
   *  - number          → numeric value or relative_past/relative_next days count
   *  - boolean         → boolean is / is_not
   *  - null            → is_known / is_unknown (no value needed)
   */
  value: string | string[] | number | boolean | [string, string] | null;
}

/**
 * A group of conditions.  Within a group, conditions are AND-ed or OR-ed
 * according to `combinator`.  Groups themselves are AND-ed at the outer level.
 * v1 ships with a single group (no nested-group UI); the data model already
 * supports multiple groups for v2.
 */
export interface FilterGroup {
  id: string;
  combinator: 'AND' | 'OR';
  conditions: FilterCondition[];
}

/**
 * Top-level filter state — replaces the flat per-page `Filters` type when
 * ADVANCED_FILTERS is on.  Serialises cleanly to JSON for saved-view storage.
 */
export interface AdvancedFilterState {
  groups: FilterGroup[];
}

/** Convenience: an empty state (no conditions). */
export const EMPTY_FILTER_STATE: AdvancedFilterState = { groups: [] };

// -----------------------------------------------------------------------
// Per-entity field catalogue
// -----------------------------------------------------------------------

export interface FieldDef {
  /** Field accessor key (must match the row object's property name). */
  field: string;
  /** Human label for the picker. */
  label: string;
  fieldType: FilterFieldType;
  /**
   * For enum/boolean fields: the fixed option list (string values).
   * Empty = free-text input.
   */
  options?: string[];
  /**
   * When true, this field is only offered when HUNGERBOX_FEATURES is on.
   * The FilterBuilder checks this and hides the field accordingly.
   */
  hungerboxOnly?: boolean;
}

/** Fields available on the Leads list (lead_report / lead_master). */
export const LEADS_FIELDS: FieldDef[] = [
  { field: 'company',           label: 'Company',         fieldType: 'text' },
  { field: 'city',              label: 'City',            fieldType: 'text' },
  { field: 'industry',          label: 'Industry',        fieldType: 'text' },
  { field: 'agentName',         label: 'Agent',           fieldType: 'text' },
  { field: 'salesperson',       label: 'Salesperson',     fieldType: 'text' },
  { field: 'source',            label: 'Source',          fieldType: 'text' },
  { field: 'stage',             label: 'Stage',           fieldType: 'enum',
    options: ['Cold', 'In Progress', 'Meeting Scheduled', 'Meeting Done', 'Qualified', 'Dropped'] },
  { field: 'leadGeneratedDate', label: 'Lead Generated',  fieldType: 'date' },
  { field: 'meetingDate',       label: 'Meeting Date',    fieldType: 'date' },
  { field: 'lastUpdated',       label: 'Last Updated',    fieldType: 'date' },
];

/** Fields available on the Companies list (company_master). */
export const COMPANIES_FIELDS: FieldDef[] = [
  { field: 'company_name',  label: 'Company',    fieldType: 'text' },
  { field: 'city_name',     label: 'City',       fieldType: 'text' },
  { field: 'industry_name', label: 'Industry',   fieldType: 'text' },
  { field: 'account_status',label: 'Account Status', fieldType: 'text' },
  { field: 'owner_name',    label: 'Owner',      fieldType: 'text' },
  { field: 'isMetro',       label: 'Metro City', fieldType: 'boolean' },
  { field: 'is_dnc',        label: 'DNC',        fieldType: 'boolean', hungerboxOnly: true },
  { field: 'is_feasible',   label: 'Feasible',   fieldType: 'boolean', hungerboxOnly: true },
];

/** Fields available on the Contacts list (contact_master). */
export const CONTACTS_FIELDS: FieldDef[] = [
  { field: 'full_name',      label: 'Name',           fieldType: 'text' },
  { field: 'company_name',   label: 'Company',        fieldType: 'text' },
  { field: 'city_name',      label: 'City',           fieldType: 'text' },
  { field: 'email',          label: 'Email',          fieldType: 'text' },
  { field: 'designation',    label: 'Designation',    fieldType: 'text' },
  { field: 'contact_status', label: 'Contact Status', fieldType: 'text' },
  { field: 'owner_name',     label: 'Owner',          fieldType: 'text' },
  { field: 'isMetro',        label: 'Metro City',     fieldType: 'boolean' },
  { field: 'is_dnc',         label: 'DNC',            fieldType: 'boolean', hungerboxOnly: true },
  { field: 'is_feasible',    label: 'Feasible',       fieldType: 'boolean', hungerboxOnly: true },
];

/** Fields available on the Meetings list (meeting_master). */
export const MEETINGS_FIELDS: FieldDef[] = [
  { field: 'company',     label: 'Company',     fieldType: 'text' },
  { field: 'city',        label: 'City',        fieldType: 'text' },
  { field: 'industry',    label: 'Industry',    fieldType: 'text' },
  { field: 'agent',       label: 'Agent',       fieldType: 'text' },
  { field: 'salesperson', label: 'Salesperson', fieldType: 'text' },
  { field: 'status',      label: 'Status',      fieldType: 'text' },
  { field: 'meetingDate', label: 'Meeting Date',fieldType: 'date' },
  { field: 'leadGenDate', label: 'Lead Generated', fieldType: 'date' },
  { field: 'confirmed',   label: 'Confirmed',   fieldType: 'boolean' },
  { field: 'mode',        label: 'Mode',        fieldType: 'enum',
    options: ['Online', 'Offline', 'Hybrid'] },
];

/** Fields available on the Wishlist (wishlist table). */
export const WISHLIST_FIELDS: FieldDef[] = [
  { field: 'company_name', label: 'Company',  fieldType: 'text' },
  { field: 'city_name',    label: 'City',     fieldType: 'text' },
  { field: 'industry',     label: 'Industry', fieldType: 'text' },
  { field: 'agent',        label: 'Agent',    fieldType: 'text' },
  { field: 'teamLead',     label: 'Team Lead',fieldType: 'text' },
  { field: 'status',       label: 'Status',   fieldType: 'text' },
];

/** Map entity name → field catalogue. */
export const ENTITY_FIELDS: Record<string, FieldDef[]> = {
  leads: LEADS_FIELDS,
  companies: COMPANIES_FIELDS,
  contacts: CONTACTS_FIELDS,
  meetings: MEETINGS_FIELDS,
  wishlist: WISHLIST_FIELDS,
};

// -----------------------------------------------------------------------
// Operators available per field type
// -----------------------------------------------------------------------

export const TEXT_OPS: FilterOperator[] = [
  'contains', 'not_contains', 'is', 'is_not',
  'is_any_of', 'is_none_of', 'is_known', 'is_unknown',
];

export const ENUM_OPS: FilterOperator[] = [
  'is_any_of', 'is_none_of', 'is', 'is_not', 'is_known', 'is_unknown',
];

export const DATE_OPS: FilterOperator[] = [
  'on', 'before', 'after', 'between', 'not_between',
  'relative_past', 'relative_next', 'is_known', 'is_unknown',
];

export const NUMBER_OPS: FilterOperator[] = [
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'is_known', 'is_unknown',
];

export const BOOLEAN_OPS: FilterOperator[] = ['is', 'is_not'];

export function opsForType(fieldType: FilterFieldType): FilterOperator[] {
  switch (fieldType) {
    case 'text':    return TEXT_OPS;
    case 'enum':    return ENUM_OPS;
    case 'date':    return DATE_OPS;
    case 'number':  return NUMBER_OPS;
    case 'boolean': return BOOLEAN_OPS;
  }
}

/** Human-readable labels for operators in the UI picker. */
export const OP_LABELS: Record<FilterOperator, string> = {
  contains:      'Contains',
  not_contains:  'Does not contain',
  is:            'Is',
  is_not:        'Is not',
  is_any_of:     'Is any of',
  is_none_of:    'Is none of',
  is_known:      'Has value',
  is_unknown:    'Is empty',
  on:            'Is on',
  before:        'Is before',
  after:         'Is after',
  between:       'Is between',
  not_between:   'Is not between',
  eq:            'Equals',
  neq:           'Does not equal',
  gt:            'Greater than',
  gte:           'Greater than or equal',
  lt:            'Less than',
  lte:           'Less than or equal',
  relative_past: 'In last N days',
  relative_next: 'In next N days',
};

/** True when the operator requires no value input (is_known / is_unknown). */
export function opNeedsNoValue(op: FilterOperator): boolean {
  return op === 'is_known' || op === 'is_unknown';
}

/** True when the operator takes a two-value range. */
export function opIsBetween(op: FilterOperator): boolean {
  return op === 'between' || op === 'not_between';
}

/** True when the operator takes a list of values. */
export function opIsMulti(op: FilterOperator): boolean {
  return op === 'is_any_of' || op === 'is_none_of';
}

// -----------------------------------------------------------------------
// Client-side evaluator
// -----------------------------------------------------------------------

/**
 * Resolve a (possibly nested) field path from a row object.
 * Supports dot-notation, e.g. "company_site.is_feasible".
 */
function getField(row: Record<string, unknown>, field: string): unknown {
  const parts = field.split('.');
  let cur: unknown = row;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/** Normalise a value to lowercase string for comparison. */
function str(v: unknown): string {
  if (v == null) return '';
  return String(v).toLowerCase();
}

/** True when the field value is considered "known" (non-null, non-empty-string). */
function isKnown(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  return true;
}

/**
 * Evaluate a single FilterCondition against a row.
 * Returns true when the row matches the condition.
 */
export function evalCondition(
  row: Record<string, unknown>,
  cond: FilterCondition,
): boolean {
  const raw = getField(row, cond.field);

  switch (cond.op) {
    case 'is_known':   return isKnown(raw);
    case 'is_unknown': return !isKnown(raw);

    case 'contains':
      return str(raw).includes(str(cond.value as string));

    case 'not_contains':
      return !str(raw).includes(str(cond.value as string));

    case 'is':
      if (cond.fieldType === 'boolean') return raw === cond.value;
      return str(raw) === str(cond.value as string);

    case 'is_not':
      if (cond.fieldType === 'boolean') return raw !== cond.value;
      return str(raw) !== str(cond.value as string);

    case 'is_any_of': {
      const vals = (cond.value as string[]).map((v) => v.toLowerCase());
      return vals.length === 0 ? true : vals.includes(str(raw));
    }

    case 'is_none_of': {
      const vals = (cond.value as string[]).map((v) => v.toLowerCase());
      return vals.length === 0 ? true : !vals.includes(str(raw));
    }

    case 'eq':   return Number(raw) === Number(cond.value);
    case 'neq':  return Number(raw) !== Number(cond.value);
    case 'gt':   return Number(raw) >   Number(cond.value);
    case 'gte':  return Number(raw) >=  Number(cond.value);
    case 'lt':   return Number(raw) <   Number(cond.value);
    case 'lte':  return Number(raw) <=  Number(cond.value);

    case 'on':
      return str(raw).startsWith(str(cond.value as string).slice(0, 10));

    case 'before':
      return !!raw && str(raw) < str(cond.value as string);

    case 'after':
      return !!raw && str(raw) > str(cond.value as string);

    case 'between': {
      const [from, to] = cond.value as [string, string];
      if (!raw) return false;
      if (cond.fieldType === 'number') {
        return Number(raw) >= Number(from) && Number(raw) <= Number(to);
      }
      return str(raw) >= str(from) && str(raw) <= str(to);
    }

    case 'not_between': {
      const [from, to] = cond.value as [string, string];
      if (!raw) return true; // null/empty is "not between" by definition
      if (cond.fieldType === 'number') {
        return Number(raw) < Number(from) || Number(raw) > Number(to);
      }
      return str(raw) < str(from) || str(raw) > str(to);
    }

    case 'relative_past': {
      const days = Number(cond.value);
      if (!raw || isNaN(days)) return false;
      const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
      return str(raw).slice(0, 10) >= cutoff;
    }

    case 'relative_next': {
      const days = Number(cond.value);
      if (!raw || isNaN(days)) return false;
      const cutoff = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
      const today  = new Date().toISOString().slice(0, 10);
      const d = str(raw).slice(0, 10);
      return d >= today && d <= cutoff;
    }

    default:
      return true;
  }
}

/**
 * Evaluate a FilterGroup against a row.
 * Conditions are AND-ed or OR-ed per group.combinator.
 */
export function evalGroup(
  row: Record<string, unknown>,
  group: FilterGroup,
): boolean {
  if (group.conditions.length === 0) return true;
  if (group.combinator === 'AND') {
    return group.conditions.every((c) => evalCondition(row, c));
  }
  return group.conditions.some((c) => evalCondition(row, c));
}

/**
 * Evaluate the full AdvancedFilterState against a row.
 * All groups are AND-ed at the outer level.
 * Returns true when the row passes all groups (or there are no groups).
 *
 * TODO(v2 server-side filter for contacts): for large data sets (100K+ contacts)
 * translate AdvancedFilterState to PostgREST operators instead of Array.filter
 * client-side. See ADVANCED-FILTERS-SPEC.md §3.4 and §5 Phase 2.
 */
export function evalFilterState(
  row: Record<string, unknown>,
  state: AdvancedFilterState,
): boolean {
  if (state.groups.length === 0) return true;
  return state.groups.every((g) => evalGroup(row, g));
}

// -----------------------------------------------------------------------
// Helpers for building AdvancedFilterState from the old flat Filters
// -----------------------------------------------------------------------

/**
 * Convert a multi-select array from the legacy flat Filters into a single
 * FilterCondition with `is_any_of` (empty = no filter).
 * Useful during the transition so old persisted filters still work.
 */
export function multiSelectCondition(
  field: string,
  values: string[],
): FilterCondition | null {
  if (!values || values.length === 0) return null;
  return {
    id: `legacy-${field}`,
    field,
    fieldType: 'text',
    op: 'is_any_of',
    value: values,
  };
}

/**
 * Build a simple AND-group AdvancedFilterState from an array of conditions.
 * Null entries (no filter) are filtered out automatically.
 */
export function buildSimpleState(
  conditions: (FilterCondition | null)[],
): AdvancedFilterState {
  const valid = conditions.filter((c): c is FilterCondition => c !== null);
  if (valid.length === 0) return EMPTY_FILTER_STATE;
  return { groups: [{ id: 'g1', combinator: 'AND', conditions: valid }] };
}

// -----------------------------------------------------------------------
// Chip label helper (for ActiveFilters bar)
// -----------------------------------------------------------------------

/**
 * Generate a human-readable chip label for a condition, e.g.
 * "City: is none of Delhi, Mumbai" or "DNC: is not true".
 */
export function conditionChipLabel(cond: FilterCondition, fieldLabel: string): string {
  const opLabel = OP_LABELS[cond.op] ?? cond.op;
  if (cond.op === 'is_known')   return `${fieldLabel}: has value`;
  if (cond.op === 'is_unknown') return `${fieldLabel}: is empty`;
  if (Array.isArray(cond.value)) {
    const vals = cond.value as string[];
    if (vals.length === 2 && opIsBetween(cond.op)) {
      return `${fieldLabel}: ${opLabel} ${vals[0]} – ${vals[1]}`;
    }
    return `${fieldLabel}: ${opLabel} ${vals.join(', ')}`;
  }
  return `${fieldLabel}: ${opLabel} ${String(cond.value ?? '')}`;
}
