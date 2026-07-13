# Advanced Per-Field Filters + Saved Views — Build Spec

**Tickets:** ALT-270 (Advanced filters with exclude) · backlog row "Saved views capturing filters+sort+density"
**Status:** ✅ v1 IMPLEMENTED (2026-06-28) — see "Implemented v1" section below
**Author:** Claude (research + spec, 2026-06-28)

---

## Implemented v1 (2026-06-28)

### Files added
- `new-code/web/src/lib/filterEngine.ts` — serialisable filter model + client-side evaluator + per-entity field catalogues
- `new-code/web/src/components/filters/FilterBuilder.tsx` — FilterBuilderButton + FilterBuilderPanel + combined FilterBuilder
- `new-code/web/src/components/filters/ViewPicker.tsx` — toolbar dropdown (list / save / load / delete / set-default)
- `new-code/web/src/data/savedViews.ts` — CRUD for `saved_view` table (listSavedViews, createSavedView, updateSavedView, deleteSavedView, setDefaultView, unsetDefaultView)
- `new-code/migration/apply-saved-views.cjs` — staged (NOT executed) migration: `public.saved_view` table with RLS

### Feature flag
`ADVANCED_FILTERS = false` in `filterEngine.ts`. When false, all 5 list pages render exactly as before (the FilterBuilderButton + FilterBuilderPanel + ViewPicker are wrapped in `{ADVANCED_FILTERS && ...}` and never mount). Flip to `true` and apply the migration to activate.

### Operator set shipped (v1)
Text/Enum: `contains`, `not_contains`, `is`, `is_not`, `is_any_of`, `is_none_of` (**exclude/NOT first-class**), `is_known`, `is_unknown`
Date: `on`, `before`, `after`, `between`, `not_between`, `relative_past`, `relative_next`, `is_known`, `is_unknown`
Number: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `between`, `is_known`, `is_unknown`
Boolean: `is`, `is_not`

### saved_view table keying
Per `(user_id, entity, project_id)`. Cross-project views have `project_id IS NULL` and appear in every project scope. Partial-unique index enforces at most one `is_default=true` per scope. `UNIQUE NULLS NOT DISTINCT` prevents duplicate names.

### HungerBox fields
`is_dnc` and `is_feasible` are in the Companies + Contacts field catalogues but gated on `hungerboxOnly: true` — `FilterBuilderPanel` hides them when `HUNGERBOX_FEATURES` is false. `isMetro` is always offered.

### Pages wired
All 5: LeadsPage, CompaniesPage, ContactsPage, MeetingsPage, WishlistPage. Each has:
- `advFilters: AdvancedFilterState` state + `filterPanelOpen` + `activeViewId`
- `FilterBuilderButton` in the toolbar's `viewSwitcher` slot
- `ViewPicker` in the toolbar's `viewSwitcher` slot
- `FilterBuilderPanel` injected below the `</ListToolbar>` (flag-gated)
- Advanced filter evaluation added to `filteredData` `useMemo` (after basic filters; flag-gated)

### Deferred to v2
- Nested OR group UI (data model already supports it)
- Server-side PostgREST query builder (`buildSupabaseQuery`) — marked with `TODO(v2 server-side filter for contacts)` in ContactsPage
- View sharing / `is_shared` column
- Chip bar surfacing advanced conditions (can be added by looping `advFilters.groups[0].conditions` in the page's `filterChips` memo)
- Write gatekeeper — marked with `TODO(gatekeeper ALT-431)` in every savedViews write call

---
**Scope:** All 5 list pages — Leads, Companies, Contacts, Meetings, Wishlist

---

## 0. What exists today (baseline)

| Layer | Current state |
|---|---|
| Filter type per page | A flat `Filters` TypeScript object with typed fields: `string` (search/date range) or `string[]` (multi-select facets) |
| Persistence | `useListFilters` hook — per-entity localStorage (`altleads:filters:<entity>`). Per-browser, race-free, PII-safe (strips `search`). |
| Operators | Exactly two: **is-any-of** (the `string[]` facets) and **date-between** (via `from`/`to` pair). No "is not", no "contains", no "is known/unknown". |
| Filter evaluation | Client-side, in-memory `Array.filter` inside `useMemo`. All rows are loaded up-front. |
| Views / saved state | `user_view_pref` table + `data/views.ts` — persists **column layout only** (`columns: ColumnPref[]`). The `name` column exists but `saveView` stores only one anonymous active row per (user, entity). No filter state, no sort, no project scope, no "multiple named views" UX. |
| Project scope | `ProjectContext` — a separate `selectedProjectId` stored per-user in localStorage; AND-ed as a pre-filter before the page `Filters`. |

**Gap summary (from backlog):** No `contains`/`is-empty`/`AND-OR`; customizer-added columns are un-filterable; no exclude/NOT operator; `user_view_pref` only captures columns, not filters/sort/density; only one anonymous slot per entity.

---

## 1. Operator Catalogue per Field Type

### 1.1 Text fields (company name, contact name, city, industry, source, agent, salesperson, etc.)

| Operator | Label in UI | PostgREST / Supabase call | Notes |
|---|---|---|---|
| `contains` | Contains | `.ilike('field', '%value%')` | Case-insensitive LIKE |
| `not_contains` | Does not contain | `.not('field', 'ilike', '%value%')` | |
| `is` | Is exactly | `.eq('field', value)` | Exact match |
| `is_not` | Is not | `.neq('field', value)` | Single-value exclude |
| `is_any_of` | Is any of | `.in('field', [v1, v2, ...])` | Replaces current multi-select |
| `is_none_of` | Is none of | `.not('field', 'in', '(v1,v2,...)')` | **The DNC exclude operator** — see §2.2 |
| `is_known` | Has value | `.not('field', 'is', null).neq('field', '')` | Field is set (non-null, non-empty) |
| `is_unknown` | Is empty | `.or('field.is.null,field.eq.')` | Field is null or blank |

> **PostgREST note on `is_none_of`:** PostgREST supports `.not('col', 'in', '(a,b,c)')` which generates `col NOT IN (a,b,c)`. This is fully supported without a view or RPC. Nulls require care — add `.not('col', 'is', null)` if nulls should not appear in exclude results, or leave them in if "not DNC" means "either not DNC or unknown".

### 1.2 Enum / dropdown fields (stage, status, meeting mode, source, hasLinkedin, metroOnly)

Same operators as text, but value picker shows a fixed or loaded option list instead of free-text input:

| Operator | Label | Implementation |
|---|---|---|
| `is_any_of` | Is any of | `.in(...)` |
| `is_none_of` | Is none of | `.not(..., 'in', ...)` |
| `is` | Is | `.eq(...)` |
| `is_not` | Is not | `.neq(...)` |
| `is_known` | Is set | `.not('field', 'is', null)` |
| `is_unknown` | Not set | `.is('field', null)` |

Boolean fields (e.g. `is_feasible`, `is_dnc`, HungerBox flags) are enum with just `true`/`false`.

### 1.3 Date fields (leadGeneratedDate, meetingDate, lastUpdated)

| Operator | Label | PostgREST | Notes |
|---|---|---|---|
| `on` | Is on | `.eq('date_col', value)` | |
| `before` | Is before | `.lt('date_col', value)` | |
| `after` | Is after | `.gt('date_col', value)` | |
| `between` | Is between | `.gte('date_col', from).lte('date_col', to)` | Two-date picker; replaces current from/to pair |
| `not_between` | Is not between | `.or('date_col.lt.from,date_col.gt.to')` | |
| `is_known` | Has date | `.not('date_col', 'is', null)` | |
| `is_unknown` | No date | `.is('date_col', null)` | |
| `relative_past_N_days` | In last N days | `.gte('date_col', computed-date)` | Compute `new Date(now - N*86400000).toISOString()` on the client |
| `relative_next_N_days` | In next N days | `.lte('date_col', computed-date)` | |

> **PostgREST note on `not_between`:** Use `.or('col.lt.X,col.gt.Y')`. This is a single `.or()` call. Fully supported.

### 1.4 Numeric fields (total_employees on company_site, lead number)

| Operator | Label | PostgREST |
|---|---|---|
| `eq` | Equals | `.eq(...)` |
| `neq` | Does not equal | `.neq(...)` |
| `gt` | Greater than | `.gt(...)` |
| `gte` | Greater than or equal | `.gte(...)` |
| `lt` | Less than | `.lt(...)` |
| `lte` | Less than or equal | `.lte(...)` |
| `between` | Between | `.gte(..., from).lte(..., to)` |
| `is_known` | Has value | `.not('field', 'is', null)` |
| `is_unknown` | Has no value | `.is('field', null)` |

### 1.5 Relationship / boolean flag fields (HungerBox-specific)

These fields live on joined tables (`company_site`, `hb_dnc`, `hb_feasibility`) and are not direct columns on the primary entity. They require a JOIN or a computed boolean on the query. Options:

**Option A — Supabase `.select()` with joins** (preferred for v1): Use Supabase's PostgREST foreign-table embedding, e.g. `company_site(is_feasible, is_dnc)`. Filter with `.eq('company_site.is_feasible', true)`. Works when the FK relationship is known to PostgREST.

**Option B — computed view** (fallback): Create a Postgres view `company_with_flags` that left-joins `company_master` to `hb_dnc` and `hb_feasibility` and exposes `is_dnc boolean` and `is_feasible boolean` as flat columns. Then filter with `.eq('is_dnc', false)`. This is the most PostgREST-friendly approach and eliminates client-side join complexity.

**Recommendation:** Create `company_with_flags` view in v1 for HungerBox; use embedded select for contacts.

---

## 2. Concrete Named Queries — DNC + Feasibility + Metro

These are the highest-priority "exclude" use cases from HUNGERBOX-LAUNCH.md.

### 2.1 "Exclude DNC companies" (the explicit owner ask)

**Target:** Companies list, Contacts list
**Filter definition:**
```
field: is_dnc (boolean, from hb_dnc / company_with_flags view)
operator: is_not
value: true
```
**Supabase equivalent (via view):**
```ts
supabase.from('company_with_flags')
  .select('...')
  .eq('is_dnc', false)   // or .neq('is_dnc', true) — same result for non-null
  .is('is_dnc', null)    // include companies with no DNC record at all
```
More precisely: `is_dnc IS NOT TRUE` (which includes both `false` and `null`). PostgREST supports `.not('is_dnc', 'is', true)` for this exact semantic. This is the correct "exclude DNC" — companies with no DNC row appear in results.

**For `is_none_of` on company name (alternate UX):** If the user builds a filter "Company is none of [Infosys, TCS]", the JSON shape is:
```json
{ "field": "company_name", "op": "is_none_of", "value": ["Infosys", "TCS"] }
```
Maps to: `.not('company_name', 'in', '(Infosys,TCS)')`.

### 2.2 "Feasible sites only" work queue

```
field: is_feasible (boolean, company_site or company_with_flags)
operator: is
value: true
```
PostgREST: `.eq('is_feasible', true)` or `.not('is_feasible', 'is', false)` (the second includes nulls = no override = assumed feasible).

### 2.3 "Metro-only" contacts / companies

```
field: isMetro (boolean computed in mapContactRow / isMetroCity())
operator: is
value: true
```
`isMetro` is already computed client-side and stored on each `Contact` and `Company` object. For v1 filter this works in-memory. For server-side filtering, add a `is_metro boolean` generated column or include it in the view.

---

## 3. Filter-Group Model — AND/OR Serializable JSON

### 3.1 Core types

```ts
// A single condition on one field
interface FilterCondition {
  id: string;          // client-only uuid, for React keys + remove
  field: string;       // e.g. "city", "stage", "is_dnc", "leadGeneratedDate"
  fieldType: 'text' | 'enum' | 'date' | 'number' | 'boolean';
  op: FilterOperator;  // see §1 — "is_any_of" | "is_none_of" | "contains" | etc.
  value: string | string[] | number | [string, string] | null;
  // null = operator needs no value (is_known / is_unknown)
}

// A group of conditions combined by AND or OR
interface FilterGroup {
  id: string;          // client-only uuid
  combinator: 'AND' | 'OR';
  conditions: FilterCondition[];
}

// Top-level filter state (replaces the current flat Filters object per page)
interface AdvancedFilterState {
  groups: FilterGroup[];
  // Groups themselves are combined with AND (outermost combinator).
  // So the full predicate is: group1 AND group2 AND ...
  // Within each group: conditions are combined by group.combinator.
}

type FilterOperator =
  | 'contains' | 'not_contains'
  | 'is' | 'is_not'
  | 'is_any_of' | 'is_none_of'
  | 'is_known' | 'is_unknown'
  | 'before' | 'after' | 'on'
  | 'between' | 'not_between'
  | 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq'
  | 'relative_past' | 'relative_next'; // value = number of days
```

### 3.2 Example: "Exclude DNC AND city is any of [Delhi, Mumbai]"

```json
{
  "groups": [
    {
      "id": "g1",
      "combinator": "AND",
      "conditions": [
        {
          "id": "c1",
          "field": "is_dnc",
          "fieldType": "boolean",
          "op": "is_not",
          "value": true
        },
        {
          "id": "c2",
          "field": "city",
          "fieldType": "text",
          "op": "is_any_of",
          "value": ["Delhi", "Mumbai"]
        }
      ]
    }
  ]
}
```

### 3.3 Example: "Feasible AND metro-only" work queue

```json
{
  "groups": [
    {
      "id": "g1",
      "combinator": "AND",
      "conditions": [
        { "id": "c1", "field": "is_feasible", "fieldType": "boolean", "op": "is", "value": true },
        { "id": "c2", "field": "isMetro",     "fieldType": "boolean", "op": "is", "value": true }
      ]
    }
  ]
}
```

### 3.4 Evaluation strategy: client-side vs. server-side

Current filtering is entirely **client-side** (all rows loaded into `allLeads`/`allCompanies` etc., then `Array.filter`). This approach works at current data volumes (~10K companies, ~100K contacts for HungerBox) but will degrade. The advanced filter JSON is designed to support both:

- **v1 (client-side):** Translate `AdvancedFilterState` to a JS predicate function. Zero server round-trips, consistent with existing data-fetch pattern. Ship quickly.
- **v2 (server-side):** Translate the same JSON to a Supabase/PostgREST query chain. The JSON shape is already designed to map 1:1 to PostgREST operators listed in §1. A `buildSupabaseQuery(entity, filterState)` function is the migration path.

**PostgREST limitation to flag:** Nested OR within AND across different tables (e.g. "company IS NOT DNC OR company is flagged HB-skip") requires a Postgres view or RPC — PostgREST can't express this in a single REST call. For v1 (client-side) this is a non-issue. Flag it before enabling server-side mode.

---

## 4. Saved Views — Data Model

### 4.1 What `views.ts` / `user_view_pref` covers today

```
user_view_pref(id, user_id, entity, name, columns jsonb, is_active, created_date)
```

- Keyed by **(user_id, entity)** — NOT by project_id.
- Stores: `columns: ColumnPref[]` only.
- One active row per (user, entity) — "deactivate old, insert new" pattern.
- `name` column exists but `saveView()` passes `name ?? null` — always null in practice.
- No filter state, no sort, no density, no multiple named views.

**Decision: EXTEND, do not replace.** The table schema needs two changes — add `project_id` and widen `columns` → `payload jsonb`. The existing `data/views.ts` functions need updates but the table and RLS patterns are correct. Replacing is more disruptive with no benefit.

### 4.2 Extended `saved_view` table (new table, separate from `user_view_pref`)

Rather than mutating `user_view_pref` (which has RLS and usage across the app), create a **new `saved_view` table** for the richer model. The existing `user_view_pref` continues to serve column layout persistence as today. The new table serves "named, multiple, sharable-in-future views."

**Columns:**

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint generated always as identity PRIMARY KEY` | |
| `user_id` | `integer NOT NULL` | FK → `user_master.user_id`. Per-user. |
| `project_id` | `integer` | FK → `project_master.project_id`. NULL = "All projects" (view applies regardless of project scope). |
| `entity` | `text NOT NULL` | `'leads'` \| `'companies'` \| `'contacts'` \| `'meetings'` \| `'wishlist'` |
| `name` | `text NOT NULL` | User-visible name, e.g. "Metro feasible DNC-free" |
| `is_default` | `boolean NOT NULL DEFAULT false` | True = this view auto-loads when the user opens this entity+project. At most one per (user, entity, project_id). |
| `filter_state` | `jsonb` | Serialized `AdvancedFilterState` (§3.1). Null = no filter saved. |
| `sort_state` | `jsonb` | `{ key: string, dir: 'asc' \| 'desc' }[]` — mirrors TanStack `SortingState`. |
| `column_prefs` | `jsonb` | `ColumnPref[]` — same shape as `user_view_pref.columns`. |
| `density` | `text` | `'comfortable'` \| `'compact'` — mirrors `useDensity`. |
| `page_size` | `integer` | e.g. 25, 50, 100. |
| `view_mode` | `text` | `'table'` \| `'grid'` \| `'kanban'` — mirrors `useViewMode`. |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | Auto-touch via trigger. |

**Unique constraint:** `UNIQUE (user_id, entity, project_id, name)` — prevents duplicate names per scope. `project_id` should use `COALESCE` in the unique expression if needed: `UNIQUE NULLS NOT DISTINCT (user_id, entity, project_id, name)` (Postgres 15+, which Supabase supports).

**Default-view constraint:** At most one `is_default=true` per `(user_id, entity, project_id)`. Enforce via partial unique index:
```sql
CREATE UNIQUE INDEX saved_view_one_default_per_scope
  ON saved_view (user_id, entity, project_id)
  WHERE is_default = true;
```

### 4.3 Per-project-per-user semantics

**Decision (locked):** Views are scoped by `(user_id, project_id)`. This means:
- A view saved while "HungerBox" project is active is a HungerBox-specific view.
- A view saved while "All projects" is active (`project_id IS NULL`) appears in every project context (it is a cross-project default).
- When loading views for a given entity, the UI fetches: `(user_id = me AND entity = 'companies' AND (project_id = :currentProject OR project_id IS NULL))` ordered by name.
- The `is_default` flag is evaluated within that scoped fetch.

### 4.4 Default-view behavior

1. On page load: fetch all views for `(userId, entity, currentProjectId | null)`.
2. If a view with `is_default = true` exists for the exact project scope, apply it (loads filter, sort, columns, density, page size, view mode).
3. If no project-specific default but a cross-project default (`project_id IS NULL, is_default = true`) exists, apply that.
4. If no default, fall back to current behavior: `defaultFilters`, default columns, persisted localStorage sort/density.
5. **Override:** The user can switch to any saved view by name via the view picker dropdown in the toolbar. This does not change their default — it is a session-level activation.

### 4.5 What to do with `user_view_pref` and `data/views.ts`

`user_view_pref` continues to be used for the **column layout** feature (ColumnCustomizer / "Save columns" button). No changes needed to it or `data/views.ts` for v1 of saved views — they remain independent.

The new `saved_view` table and a new `data/savedViews.ts` file handle the advanced saved-view feature. This separation avoids touching RLS on `user_view_pref` and keeps the simpler column-layout feature working unchanged.

---

## 5. Phased Build Plan

### Phase 1 — v1 (high value, ship first) — Estimated effort: **M (1–2 engineer-weeks)**

**Scope:**
- Advanced filter UI: a "Filters" button opens a filter builder panel. Per-condition: field picker, operator picker (limited to field type), value input/multi-select. "Add condition" button. "AND / OR" combinator toggle per group. Single group only in v1 (no nested groups).
- Operator set in v1: `is_any_of`, `is_none_of`, `contains`, `not_contains`, `is_known`, `is_unknown`, `between` (dates), `before`, `after`, `relative_past_N_days` — the 90% of value.
- Exclude / DNC: `is_none_of` on enum/text + `is_not` on boolean covers the DNC/feasibility use case immediately.
- Evaluation: client-side (existing pattern). `AdvancedFilterState` replaces the per-page flat `Filters` type. `useListFilters` updated to accept the new shape (the localStorage key schema changes — existing stored filters silently ignored / merged with defaults on upgrade).
- Active-filter chip bar: each condition renders as a removable chip (same `ActiveFilters` component, fed from the new state). Consistent with existing UX.
- Saved views: new `saved_view` table + `data/savedViews.ts` (CRUD: save, load, list, delete, set-default). View picker in the toolbar (dropdown, "Save as..." modal, "Set as default" menu item). Apply view = loads filter + sort + columns + density in one shot.
- Backward compatibility: the flat `Filters` type in each page is converted to `AdvancedFilterState`. The default state uses `is_any_of` for existing multi-selects (no behavior change). Existing localStorage keys (`altleads:filters:<entity>`) cannot deserialize to the new shape — they are silently dropped and the user starts with defaults. This is acceptable (filters were non-sensitive view state).

**Files that change:**
- `new-code/web/src/lib/listFilters.ts` — update to serialize/deserialize `AdvancedFilterState`
- `new-code/web/src/pages/LeadsPage.tsx`, `CompaniesPage.tsx`, `ContactsPage.tsx`, `MeetingsPage.tsx`, `WishlistPage.tsx` — replace flat `Filters` type with `AdvancedFilterState`; replace filter-panel JSX with new `<FilterBuilder>` component
- New: `new-code/web/src/components/ui/FilterBuilder.tsx` — the filter UI component
- New: `new-code/web/src/lib/filterEngine.ts` — JS predicate evaluator for `AdvancedFilterState`
- New: `new-code/web/src/data/savedViews.ts` — CRUD for `saved_view` table
- New: `new-code/web/src/components/ui/ViewPicker.tsx` — toolbar dropdown for named views
- Migration: `new-code/migration/apply-saved-view.cjs` — creates `saved_view` table (not executed here; described in §6)

**Does NOT change:**
- `new-code/web/src/data/views.ts` — column layout feature untouched
- `new-code/web/src/components/ui/ColumnCustomizer.tsx` — untouched
- `new-code/web/src/contexts/ProjectContext.tsx` — untouched (its `selectedProjectId` is read by `savedViews.ts`)

### Phase 2 — v2 (nested OR groups + server-side evaluation) — Estimated effort: **L (2–4 engineer-weeks)**

**Scope:**
- Nested filter groups: the `groups[]` array in `AdvancedFilterState` is exposed in the UI. Each group has its own AND/OR combinator. Groups are combined with AND (outer level fixed to AND).
- Server-side query building: `buildSupabaseQuery(entity, filterState)` translates the JSON to PostgREST operators. Requires server-side pagination (replace client `Array.filter` with server `.range()`). This is a significant architectural lift.
- HungerBox joined fields (`is_dnc`, `is_feasible`) as filterable server-side: requires `company_with_flags` view (or Postgres generated column on company_master).
- View sharing: optional per-team or cross-user shared views (admin-created). Requires adding `created_by`, `is_shared` columns to `saved_view`.

---

## 6. Migration Needed — `saved_view` Table

Do not write or execute the migration here. The migration agent should create `new-code/migration/apply-saved-view.cjs` with the following schema:

**Table `public.saved_view`:**
```
id            bigint generated always as identity PRIMARY KEY
user_id       integer NOT NULL REFERENCES user_master(user_id) ON DELETE CASCADE
project_id    integer REFERENCES project_master(project_id) ON DELETE SET NULL
entity        text NOT NULL  CHECK (entity IN ('leads','companies','contacts','meetings','wishlist'))
name          text NOT NULL
is_default    boolean NOT NULL DEFAULT false
filter_state  jsonb
sort_state    jsonb
column_prefs  jsonb
density       text CHECK (density IN ('comfortable','compact'))
page_size     integer CHECK (page_size IN (25,50,100))
view_mode     text CHECK (view_mode IN ('table','grid','kanban'))
created_at    timestamptz NOT NULL DEFAULT now()
updated_at    timestamptz NOT NULL DEFAULT now()
```

**Indexes / constraints:**
```sql
-- Prevent duplicate names per (user, entity, project)
UNIQUE NULLS NOT DISTINCT (user_id, entity, project_id, name);

-- At most one default per scope
CREATE UNIQUE INDEX saved_view_one_default
  ON saved_view (user_id, entity, project_id)
  WHERE is_default = true;
```

**RLS policy (own rows only):**
```sql
ALTER TABLE saved_view ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own saved views"
  ON saved_view FOR ALL
  USING  (user_id = current_user_id())
  WITH CHECK (user_id = current_user_id());
```
(`current_user_id()` is the helper already used on `user_view_pref` — ALT-131.)

**No migration to `user_view_pref`** — it stays as-is.

---

## 7. Open Questions / Decisions Before Building

1. **Filter evaluation model for v1:** Confirmed client-side? With 100K contacts the `Array.filter` over a fully-loaded array will be slow. The builder should still produce a serializable JSON (so v2 can switch to server-side) but the data-fetch pattern may need a hard server-side cap for Contacts before v1 ships. **Flag for Ankit to decide** — current Contacts page already loads all contacts client-side; if that's acceptable, v1 filter is fine too.

2. **`is_dnc` / `is_feasible` in v1 client-side:** These fields are computed by the HungerBox domain agent and attached to `Company` / `Contact` objects as `isMetro: boolean`. The same pattern should add `isDnc: boolean` and `isFeasible: boolean` to each row before the advanced filter evaluates them. Confirm the domain agent adds these (HUNGERBOX_FEATURES flag gate).

3. **View picker placement:** The toolbar already has ColumnCustomizer, DensityToggle, ViewSwitcher, ExportButton, and sometimes a Create button. Adding a ViewPicker (dropdown) should replace or merge with ColumnCustomizer to avoid crowding. Recommend: ViewPicker is a primary toolbar slot; "Columns" moves inside the view save/load panel.

4. **`name` uniqueness UX:** The `UNIQUE NULLS NOT DISTINCT` constraint means saving a view with a duplicate name fails. The UI should warn inline before insert, not rely on a DB error.
