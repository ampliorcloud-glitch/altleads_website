# HungerBox — First Internal Launch (domain spec)  (2026-06-28)

**Decision (Ankit, locked):** The **first real project we launch on the CRM is HungerBox.** We load all the data we already have and run live outreach on it. Everything below is the domain model the platform must support for that launch. Capture-first; build behind staged migrations + flags; nothing destructive without sign-off.

## 1. Data we will load (admin import, not agent-created)
- **~10,000 large companies** and **~100,000 contacts** that we already hold.
- Loaded by the **import engine** (admin/super-admin only) — see [BULK-IMPORT-EXPORT.md] / DEC-14. Upsert by Record-ID / email / domain; history + undo.

## 2. DNC (Do Not Contact) — compliance/opt-out gate
DNC can be set at **two scopes**:
- **Whole company** — nobody contacts any site of it.
- **Company at a specific location / city / site** — only that site is off-limits; other sites of the same company stay contactable.

Rules:
- **Who can mark DNC:** an **agent** (during outreach) or an **admin** (bulk). Marking records **who + when + reason** (history).
- **Effect on contacts:** every contact that belongs to a DNC company (or to a DNC company+location) is rendered with a **reddish blur** in lists and detail, and is **non-contactable** — call/email/log actions disabled. The intent: *no one on the team can reach a DNC contact at all.*
- DNC is **location-aware**: blur applies to contacts in the DNC'd city/site, not the company's other cities (unless the whole company is DNC).

## 3. Feasibility — business-fit gate (separate from DNC)
- A company (or a company **at a location/site**) can be **non-feasible** (we can't service it there).
- **Effect:** same reddish treatment so **no one reaches them**; tracked **separately** from DNC (DNC = opt-out/compliance; feasibility = business fit). A contact can be blurred for either reason; show which.
- Scope, like DNC: **whole company** or **company + location/site**.

## 4. Metro prioritisation of contacts
- Contacts are **prioritised by Indian metro cities** (Tier-1: Delhi/NCR, Mumbai, Bengaluru, Hyderabad, Chennai, Kolkata, Pune, Ahmedabad — final list in the migration) vs **"others."**
- Surfaced as a **priority flag / derived field** the team can **sort and filter** by (metro-first work queues).

## 5. Per-site pre-qualified questions (the "why call / why not" panel)
- A company operates at **multiple sites/locations**. For **each site** we already hold answers to a few **pre-qualified questions** — e.g. **total employees** and the **commercial model** of that site.
- These are **shown** on the company/site so agents understand **why** a site is or isn't worth calling.
- **Editable by users**, but **every change is history-logged** (what changed, **by whom, when** — old→new value).
- **Feasible-per-site filter:** the team can filter companies/contacts to the **feasible sites** (and by metro priority), so work queues only show reachable, in-scope, feasible, metro-first targets.

### Schema implication (for the migration agent to design schema-accurately)
- Introduce a **company-site / company-location** notion (a company has many sites; each site has city/location, total_employees, commercial_model, feasibility flag, DNC flag, prequalified answers).
- DNC + feasibility flags exist at **company level AND company-site level**.
- **Contacts attach to a site** (by city/location) so they inherit the site's DNC/feasibility → drives the reddish blur + non-contactable state.
- All edits to prequalified answers + DNC/feasibility go through an **audit/history** table (by/when/old→new). Marking actions route through the **write gatekeeper** (server-side, no UI bypass — ALT-431).

## 6. Role walkthroughs + standing QC (so Ankit doesn't UAT every change)
- Maintain **written, step-by-step walkthroughs** (user stories / happy paths) per role: **first login → what they see → where to go → what to do**, starting with **admin-data** and **agent**, then TL / QC / Sales-Head / Sales-Person.
- A **QC pass** verifies each role can actually do its steps after changes — see `docs/product/ROLE-WALKTHROUGHS.md` (living doc). This replaces Ankit hand-testing every user.

## Tickets (added to backlog)
- DNC model + reddish/non-contactable (company + site) — **ALT-452**
- Feasibility model + reddish (company + site) — **ALT-453**
- Metro prioritisation flag + sort/filter — **ALT-454**
- Company-site entity + per-site prequalified questions + edit history — **ALT-455**
- Feasible/metro work-queue filters — **ALT-456**
- Role walkthroughs + standing QC doc — **ALT-457**
- (rides on) Import engine DEC-14 · Write gatekeeper ALT-431 · DEC-03 ownership

---

## Implementation notes (2026-06-28 — domain model agent build)

### Schema discovered (live DB, read-only)
- **company_master** PK `company_id` (bigint). City link: `city_id integer → city_master.city_id`. Domain normalised: `domain_clean text`.
- **contact_master** PK `contact_id` (bigint). Links: `company_id bigint → company_master`, `city_id bigint → city_master` (the contact's own city).
- **city_master** PK `city_id` (integer), `city_name varchar`.
- A contact's "site" is identified by `(company_id, city_id)` — this is the unique key on `company_site`.
- No existing HungerBox-related tables found (clean slate).

### Tables created by migrations (STAGED — not yet applied to prod)

**`apply-hungerbox-company-sites.cjs`** (run first):
- `public.company_site` — PK `site_id` bigint, UNIQUE `(company_id, city_id)`. Cols: `total_employees integer`, `commercial_model text`, `notes text`, `is_feasible boolean DEFAULT true`, `is_dnc boolean DEFAULT false`, `created_at timestamptz`, `updated_at timestamptz`, `deleted_at timestamptz`. FKs → `company_master.company_id` (CASCADE) + `city_master.city_id` (RESTRICT).
- `public.hb_site_history` — PK `history_id` bigint. Audit trail for prequalified-answer edits. Cols: `site_id`, `changed_by text`, `changed_at timestamptz`, `field_name text`, `old_value text`, `new_value text`. FK → `company_site.site_id` (CASCADE).
- Also creates `public.touch_updated_at()` trigger function (touches `updated_at`).

**`apply-hungerbox-dnc-feasibility.cjs`** (run second, needs company_site):
- `public.hb_dnc` — active DNC flags. Cols: `dnc_id`, `company_id`, `site_id nullable`, `scope ('company'|'site')`, `reason text`, `marked_by text`, `marked_at timestamptz`, `is_active boolean`. Partial unique indexes enforce one active row per company-scope and one per site-scope.
- `public.hb_dnc_history` — immutable audit trail. Cols: `old_state boolean`, `new_state boolean`, `reason text`, `changed_by/at`.
- `public.hb_feasibility` — feasibility overrides. Same shape as hb_dnc + `is_feasible boolean`.
- `public.hb_feasibility_history` — immutable audit trail for feasibility changes. Cols: `old_feasible boolean`, `new_feasible boolean`.

### Feature flag
**`HUNGERBOX_FEATURES = false`** in `new-code/web/src/lib/hungerbox.ts`.
- When false: zero DB queries to new tables, zero UI changes (Sites tab hidden, metro filter hidden, DNC/feasibility actions hidden).
- To enable: edit `hungerbox.ts` line 1 to `export const HUNGERBOX_FEATURES = true;`, then apply both migrations.

### New files
| File | Purpose |
|---|---|
| `new-code/migration/apply-hungerbox-company-sites.cjs` | STAGED migration — company_site + hb_site_history |
| `new-code/migration/apply-hungerbox-dnc-feasibility.cjs` | STAGED migration — hb_dnc + hb_feasibility + history tables |
| `new-code/web/src/lib/hungerbox.ts` | Feature flag + metro city list + helpers + reason constants |
| `new-code/web/src/data/companySites.ts` | Data layer — CRUD for company_site + hb_site_history reads/writes |
| `new-code/web/src/data/dnc.ts` | Data layer — mark/unmark DNC + feasibility, batch non-contactable computation |
| `new-code/web/src/components/hungerbox/NonContactableBadge.tsx` | UI — reddish pill badge + blur wrapper + reason chip |
| `new-code/web/src/components/hungerbox/DncFeasibilityActions.tsx` | UI — mark/unmark DNC + non-feasible buttons with reason selects |
| `new-code/web/src/components/hungerbox/CompanySitesPanel.tsx` | UI — company detail "Sites" tab: per-site prequalified answers + edit + history |

### Files extended (additively)
| File | Change |
|---|---|
| `new-code/web/src/data/companies.ts` | Added `isMetro: boolean` to `Company` type; computed from city name via `isMetroCity()` |
| `new-code/web/src/data/contacts.ts` | Added `isMetro: boolean` to `Contact` type; computed in `mapContactRow` |
| `new-code/web/src/pages/CompanyDetailPage.tsx` | Added "Sites" tab (only shown when HUNGERBOX_FEATURES=true); imports CompanySitesPanel |
| `new-code/web/src/pages/CompaniesPage.tsx` | Added `metroOnly` filter (select: All / Metro only); only shown when HUNGERBOX_FEATURES=true |
| `new-code/web/src/pages/ContactsPage.tsx` | Added `metroOnly` filter (same pattern); only shown when HUNGERBOX_FEATURES=true |

### Route needed (add to App.tsx)
No new routes required. The Sites tab lives inside CompanyDetailPage at the existing `/companies/:id` route.

### What's dark-shipped (not visible until flag flips)
- Sites tab on company detail
- Metro-only filter on Companies + Contacts pages
- DNC / non-feasible action buttons
- Reddish-blur non-contactable treatment on contacts/companies
- All DB queries to the new tables

### What's deferred (requires future agent work)
- Non-contactable blur on ContactsPage individual rows (requires per-row DNC state lookup in the list — ALT-452 full list sweep; design choice: batch load on page load vs. lazy per-row)
- Write-gatekeeper routing (ALT-431) — all write functions have `// TODO(gatekeeper ALT-431)` markers
- RLS on the new tables (add a follow-up migration after ALT-431 gatekeeper is built)
- DNC/feasibility indicators on ContactDetailPage (needs similar component wiring as CompanyDetailPage)

---

## Implementation notes — ALT-464: Prequalified-question granularity toggle (2026-06-28)

### Setting storage
**Table: `public.project_hb_setting`** (new, staged in `apply-prequalified-granularity.cjs`)
- PK `project_id bigint` FK → `project_master.project_id` (CASCADE)
- `prequalified_granularity text NOT NULL DEFAULT 'site' CHECK IN ('company','site')`
- `updated_by text`, `updated_at timestamptz`
- One row per project; absent row treated as default `'site'`.

Data layer: `new-code/web/src/data/projectHbSettings.ts`
- `fetchProjectHbSetting(projectId)` — reads the row, falls back to `{prequalified_granularity: 'site'}` when absent.
- `upsertProjectHbSetting(projectId, granularity, actorId)` — upserts on `project_id`.

### Admin toggle UI location
**Admin → "HB Settings" tab** (visible only when `HUNGERBOX_FEATURES = true`)
- Component: `new-code/web/src/components/admin/HbProjectSettingsTab.tsx`
- Wired into `AdminPage.tsx` as a new tab key `'hbsettings'` appended to `NAV_ITEMS` behind `HUNGERBOX_FEATURES`.
- UI: project selector dropdown (same as Project Access tab) + a two-option segmented radio:
  - **Site-wise** — answers stored per `company_site` row (default, today's behaviour)
  - **Company-wide** — answers stored in `company_hb_prequal` (one row per company)
- Save/Reset/dirty-state pattern mirrors `ProjectAccessTab`.

### Company-vs-site answer storage
**Site-wise (granularity = 'site'):**
- Existing behaviour unchanged. Answers stored in `company_site` columns
  (`total_employees`, `commercial_model`, `notes`). History in `hb_site_history`.
- `CompanySitesPanel` renders one `SiteCard` per site row.

**Company-wide (granularity = 'company'):**
- **Table: `public.company_hb_prequal`** (new, same staged migration)
  - PK `company_id bigint` FK → `company_master.company_id` (CASCADE)
  - `total_employees integer`, `commercial_model text`, `notes text`
  - `updated_by text`, `updated_at timestamptz`
  - One row per company. Kept separate from `company_site` so switching back to site-wise leaves site rows untouched.
- **Why not a sentinel `company_site` row?** `company_site.city_id` is NOT NULL with an FK to `city_master` — no valid sentinel city_id exists. A separate table is the correct approach.
- History in **`public.hb_company_prequal_history`** (same migration):
  `history_id, company_id, changed_by, changed_at, field_name, old_value, new_value` — mirrors `hb_site_history`.
- Data layer: `fetchCompanyHbPrequal`, `fetchCompanyPrequalHistory`, `upsertCompanyHbPrequal` in `projectHbSettings.ts`.
- `CompanySitesPanel` renders a single `CompanyPrequalForm` (inline component) instead of the site list.

### Panel switching
`CompanySitesPanel` now accepts a `granularity?: PrequalGranularity` prop (default `'site'`).
- When `'company'`: renders `CompanyPrequalForm` (company-wide form + inline history).
- When `'site'`: renders the existing per-site `SiteCard` list (unchanged).
- Company-level DNC/feasibility action buttons are always rendered regardless of granularity.
- A small label chip ("Company-wide answers" / "Site-wise answers") shows the active mode.

`CompanyDetailPage` fetches `fetchProjectHbSetting(projectId)` whenever `projectId` changes (effect hook) and passes the result as `granularity` to `CompanySitesPanel`. Defaults to `'site'` while loading or when `HUNGERBOX_FEATURES = false`.

### Staged migration
`new-code/migration/apply-prequalified-granularity.cjs`
- Syntax-checked (`node -c` passes).
- NOT yet executed. Run after `apply-hungerbox-company-sites.cjs` and when `HUNGERBOX_FEATURES` is flipped to `true`.
- Creates: `project_hb_setting`, `company_hb_prequal`, `hb_company_prequal_history`.

### Feature flag safety
All new code paths (UI, data fetches, writes) are guarded by `HUNGERBOX_FEATURES`. When `false`:
- `HbProjectSettingsTab` returns `null`.
- `fetchProjectHbSetting` returns `{setting: {prequalified_granularity: 'site'}}` with no DB call.
- `fetchCompanyHbPrequal` / `fetchCompanyPrequalHistory` return empty/null with no DB call.
- `upsertCompanyHbPrequal` / `upsertProjectHbSetting` return a "not enabled" error string.
- `CompanySitesPanel` returns `null` (pre-existing gate).

### Write-gatekeeper note
All writes carry `// TODO(gatekeeper ALT-431)` comments — they go direct to Supabase for now, same as the rest of the HungerBox layer.
