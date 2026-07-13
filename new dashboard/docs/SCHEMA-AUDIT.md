# Schema Audit — AltLeads CRM (Supabase/Postgres, migrated 1:1 from vendor MySQL)

**Auditor:** senior database engineer (read-only).
**Date:** 2026-06-24.
**Sources:** `docs/amplior_backup.sql` (pre-migration MySQL dump), `new-code/migration/*.sql` + appliers (`*.cjs`/`*.js`), `new-code/web/src/data/*.ts`, and a **read-only live introspection** of the production Supabase DB (`puvozfhypqbwbmbhrhcr`) via the connection string in `new-code/migration/.env` (mirrored `check-applied.cjs`; no writes). Row counts and distinct-value samples below are from the **live** database.

> TL;DR: The schema was lifted table-for-table from a Java/Hibernate + MySQL app built by developers, not data modellers. It carries every original sin: a split, ambiguous ownership model (the launch blocker), status and category stored as raw free text (already corrupted — e.g. 24+ spellings of "Security" in one column), audit columns that are strings holding numeric ids with no FK, no enforced soft-delete or de-dup, polymorphic associations with no foreign keys, and **four** competing "what happened to this lead" tables with no single clean interaction model for AI. Fixing one symptom surfaces the next because the root causes (ownership + uncontrolled vocabulary + no referential spine on the new columns) are shared.

---

## How to read this

Each flaw: **Problem → Why it bites → Fix → Migration risk**. Severity is **NOW** (blocks/ंendangers the internal launch or corrupts data daily), **SOON** (will hurt within weeks of launch / before sales portal + AI), **FUTURE** (debt to retire before scale / integrations).

Counts cited (live): `lead_master` 607, `lead_report` 594, `company_master` 525, `contact_master` 608, `meeting_master` 610, `meeting_master_audit` ~85k, `interaction` 18, `lead_activity` 2670, `task` 2, `call_log` **not present in live DB** (staged only).

---

# NOW — launch-blocking or actively corrupting

## N1. Split / ambiguous ownership: `created_by` ≠ assignee (THE launch blocker)
**Problem.** Every base record carries `created_by varchar` = the bulk-import actor (live values are numeric strings: `"7"` ×130, `"60"` ×99, `"59"` ×86, `"1"` ×49 …), **not** the person responsible for the lead. The real assignment lives in `lead_report.user_id`. There is *also* a dead `lead_master.agent_id` (populated on 132/607 rows, no FK, unused by RLS) and *also* `company_project_status.owner_user_id` / `contact_project_status.owner_user_id` (a third ownership channel, only 25/28 and 19/26 rows filled). So "who owns this lead" has **three** possible answers and the row-security write-path historically consulted the wrong one.
**Why it bites.** RLS UPDATE policies keyed on `created_by` mean an assigned agent is told "you can only edit records you own" for the 600 migrated leads. This is the documented internal-launch stopper (CLAUDE.md §4, `apply-assignment-rls.cjs` header). It also makes every "my leads" list, dashboard count, and future AI "what is this rep doing" query ambiguous.
**Fix.** Adopt ONE canonical assignment column per record and make RLS + the app read only that. The staged `apply-assignment-rls.cjs` is the right shape (adds an `assigned_to()` OR-term), but it *layers* assignment on top of the legacy `created_by` term rather than replacing it, and resolves "assignee" three different ways depending on record type. Land a single `assignee_user_id bigint REFERENCES user_master` (or a thin `assignment(record_type, record_id, user_id, role, assigned_at, assigned_by)` table) backfilled from `lead_report.user_id`; deprecate `agent_id`; keep `created_by` as audit-only.
**Migration risk.** Medium. Backfill is deterministic (latest non-deleted `lead_report.user_id` per lead — and 597/598 leads have exactly one report, so it's effectively 1:1). Risk is RLS regressions: must be validated with throwaway non-admin logins (the existing ALT-153/229 gate) before prod, because narrowing/rewriting policies can silently hide rows. Reversible (additive column).

## N2. Status stored as free text, no FK, already corrupted
**Problem.** Pipeline state lives in raw `varchar` columns with no FK to the `stage_master`/`status_master` lookup tables that *exist but sit unused*. Live distinct values:
- `lead_report.report_status`: 11 variants incl. casing/spacing drift — `"Meeting postponed by Salesperson"`, `"Meeting cancelled by Sales Team"`, `"Meeting cancelled by Lead"`, one `NULL`.
- `meeting_master.meeting_status`: `Missed` 331, `Completed` 204, `Scheduled` 39, `Confirmed` 22, **`NULL` 10, `""` 8**, `Rescheduled` 2 — plus a *second*, near-empty `meeting_master.status` column (615 NULL, 1 `Rescheduled`).
- `lead_report.active_status`: holds the string `"0"` on 128 rows (a boolean smuggled into a varchar).
- The new per-project status columns are *also* free text with no CHECK/FK: `company_project_status.account_status` (`qualified`), `is_feasible` (`feasible`), `decision_power` (`centralised`), `contact_project_status.contact_status` (`warm`/`hot`/`cold`/`not_interested`).
**Why it bites.** Every filter, kanban column, funnel metric, and future AI feature must defensively normalize casing/whitespace/synonyms or silently mis-count. Empty strings vs NULL split "no status" into two buckets. There is no way to rename a status safely or constrain new values — a typo becomes a new pipeline stage.
**Fix.** Define the canonical vocabularies, enforce them with `CHECK` constraints **now** (cheap, like `task`/`project_visibility_setting` already do) and migrate to FK-into-`dropdown_option` (that catalog table already exists, 28 rows) or to lookup-table FKs (`stage_master` is wired via `lead_report.stage_id` but largely unused). Collapse `meeting_master.status` into `meeting_status`. Convert `active_status` to a real `boolean`.
**Migration risk.** Low-medium. A one-time normalization UPDATE (trim/case-fold/synonym-map) precedes adding the CHECK. Must coordinate with `data/*.ts` which currently writes raw strings (e.g. `meetings.ts`, `projectStatus.ts`, `realLeads.ts`) — app must write canonical values after. Reversible.

## N3. Category free-text: `lead_master.area_of_interest` (worst-corrupted column in the DB)
**Problem.** `area_of_interest` is `NOT NULL` free text and is a textbook uncontrolled vocabulary. Live: `"Security "` 39 **and** `"Security"` 35 **and** `"security"` 7 **and** `"Security services"`/`"Security Services"`/`"Security and FM"`; `"HB Services"`/`"Hungerbox Services"`/`"Hungerbox services"`/`"HungerBox services"`/`"HungerBox Services"`/`"Hunger box services"`/`"Hunger box Services"`; plus `" "` 34 and `""` 5 (whitespace masquerading as a value). 24+ "distinct" values that are really ~4 concepts.
**Why it bites.** Segmentation, the HungerBox feedback report, and any AI fit-scoring are unusable without fuzzy cleanup on every read. `NOT NULL` is satisfied by a single space, so the constraint buys nothing.
**Fix.** Introduce a controlled list (`dropdown_option` category, or `interest_master` FK), backfill via a synonym map, and store free-text elaboration in a separate nullable `area_of_interest_note`. Drop the meaningless `NOT NULL` or replace with `CHECK (trim(area_of_interest) <> '')`.
**Migration risk.** Low. Pure data hygiene + new nullable column; the synonym map needs a human eyeball once (owner-facing). Reversible.

## N4. No single, clean interaction/activity model (blocks AI; data is scattered across 4 tables)
**Problem.** "What happened with this lead" is spread across: `lead_activity` (2670 rows, free-text `lead_comments`, no actor user_id — only `created_by` string), `meeting_master` (+ `meeting_reschedule`, `feedback_answer`), `lead_status_history` (a 50-column boolean-and-date "soup" table: `meeting_cancelled_by_altleads`, `meeting_postponed_by_salesperson`, … each with its own `_date`/`_updated_by`), and a brand-new generic `interaction` table (18 rows, dormant) plus a staged `call_log` that **isn't even applied to the live DB**. None is canonical; the good one (`interaction`) is empty.
**Why it bites.** The north-star "AI superpower over everything that was captured" (VISION.md) needs one chronological, typed, queryable activity stream per record. Today an AI/timeline must UNION four incompatible shapes, and `lead_status_history`'s wide-boolean design means "show me the timeline" is impossible without decoding 16 boolean/date pairs. `activityTimeline.ts` already has to stitch sources together.
**Fix.** Make `interaction(record_type, record_id, project_id, owner_user_id, type, disposition, note_text, occurred_at, …)` the **canonical** append-only event log; write all new calls/notes/status-changes/meetings-touches there; backfill `lead_activity` + `lead_status_history` transitions into it; keep `meeting_master` as the meeting entity but emit an `interaction` row on each meeting event. Retire `lead_status_history` to read-only history.
**Migration risk.** Medium (behavioural, not destructive): leave legacy tables in place, dual-write first, backfill, then cut reads over. `interaction.record_id` is polymorphic with **no FK** (see S2) — fix that as part of this.

## N5. No FORCE row-level security; RLS is the only barrier and it's not forced
**Problem.** Hot tables have `relrowsecurity = true` but `relforcerowsecurity = false` (verified: `lead_master`, `lead_report`, `company_master`, `contact_master`, `meeting_master`, `task`, both `*_project_status`, `user_master`, `wishlist`, `lead_activity`). The table **owner** therefore bypasses RLS, and Supabase ships broad default grants to `anon`/`authenticated`.
**Why it bites.** Given the masking/partial-reveal access model (`access-masking-v1b.sql`) and a public Supabase URL, any path that runs as table owner — or any forgotten grant — sidesteps row scoping. This is a launch-time security posture issue with PII (mobile numbers, emails) for 111 users + 600+ leads.
**Fix.** `ALTER TABLE … FORCE ROW LEVEL SECURITY` on all data tables; audit `anon` grants (the `call_log` applier's REVOKE-from-anon discipline should be applied table-wide, per `security-lockdown.sql`). Validate with throwaway logins.
**Migration risk.** Low technically, but **must** be validated against the service-role notify-service paths and the snapshot trigger so they don't break. Reversible.

---

# SOON — hurts within weeks of launch / before sales portal + AI

## S1. Audit columns are `varchar` holding numeric user ids, with no FK and inconsistent type
**Problem.** `created_by`/`updated_by`/`deleted_by` are `varchar(255)` across nearly every table, but live data is numeric user ids as strings (`"7"`, `"60"`, …, sometimes `NULL`, historically `"system"`). They reference `user_master.user_id` (a `bigint`) but **no FK enforces it**, and the new tables disagree on type: `task.created_by` and `call_log.created_by` are `bigint`, while everything migrated is `varchar`. `interaction`/`call_log`/`task` have **no `updated_by`** at all.
**Why it bites.** "Who last touched this" requires a string→bigint cast + manual join on every query; orphaned/garbage actor ids go undetected; you can't trust audit trails for compliance or for AI "rep activity" features; the type split forces per-table special-casing in the data layer.
**Fix.** Standardize actor columns to `bigint REFERENCES user_master(user_id)` (nullable), backfill by casting the numeric strings, add the missing `updated_by` to `interaction`/`call_log`/`task`. Where `created_by` legitimately means "system", model that as a sentinel user row, not the literal string.
**Migration risk.** Medium: casting must handle non-numeric legacy values (`'system'`, `''`, NULL) before adding the FK; do it as add-new-column + backfill + swap, not in-place type change, to stay reversible.

## S2. Polymorphic associations with no foreign keys (`interaction`, `call_log`, `task`, `in_app_notification`)
**Problem.** `interaction(record_type text, record_id bigint)`, `call_log(lead_id, company_id, contact_id, meeting_id all nullable)`, and `task(lead_id, company_id, contact_id, meeting_id)` associate to records with **no FK** on the polymorphic id, and `call_log`/`task` allow *all* association columns NULL (a row pointing at nothing) or several at once (a row pointing at many) with no CHECK enforcing "exactly one". `in_app_notification` requires `lead_id`+`report_id`+`meeting_id`+`user_id` all NOT NULL even when a notification has no meeting.
**Why it bites.** Orphan activity/tasks accumulate silently; deleting a lead leaves dangling interaction rows; AI timelines mis-join. The all-NOT-NULL notification design forces fake/zero ids.
**Fix.** Either split into per-type tables, or keep polymorphic but add a `CHECK` that exactly one association is non-null and a trigger/`record_type` discriminator validated against existing ids; relax `in_app_notification` NOT NULLs to match reality. For `task`/`call_log`, add the one-of CHECK now.
**Migration risk.** Low for new tables (few rows: task 2, interaction 18, call_log absent). `in_app_notification` (1359 rows) NOT NULL relaxation is additive/safe.

## S3. Contacts/companies have no enforced de-duplication
**Problem.** `contact_master` has **20 duplicate-email groups** live and `company_master` has duplicate-name groups, but there is **no unique constraint** on contact email / linkedin_clean / mobile, nor on company `cin_number`/`domain_clean` — only non-unique indexes. The migration `merge.ts` exists precisely because dupes already proliferated.
**Why it bites.** The outreach team and the Chrome extension match a person by `linkedin_clean` / email; duplicates mean split history, double-dialling, and broken extension lookups (the extension keys on `linkedin_url`). Every new import compounds it.
**Fix.** Clean existing dupes (via `merge.ts`), then add partial UNIQUE indexes: `UNIQUE (lower(email)) WHERE email IS NOT NULL AND deleted_date IS NULL`, similarly on `linkedin_clean`, and on company `cin_number`/`domain_clean`. Enforce upsert-on-import.
**Migration risk.** Medium: cannot add UNIQUE until dupes are merged; do merge first, then constraint. Partial (WHERE deleted_date IS NULL) indexes avoid blocking soft-deleted rows.

## S4. Inconsistent soft-delete; some new tables omit it, audit tables duplicate state
**Problem.** Most migrated tables have `deleted_date`/`deleted_by` (soft delete), but `interaction` has **none**, `in_app_notification` semantics are unclear, and there's a parallel `*_audit` shadow table for almost every table (`meeting_master_audit` ~85k rows, `lead_report_audit` ~2305, etc.) — a second, divergent audit mechanism on top of the `created/updated/deleted` columns. No table uses a partition or retention policy; `meeting_master_audit` at 85k vs 610 live rows shows unbounded growth.
**Why it bites.** Inconsistent soft-delete means some deletes are recoverable and some aren't; queries must remember per-table which model applies. The audit shadow tables balloon and overlap with the column-level audit, doubling write cost and confusing "source of truth".
**Fix.** Add `deleted_date`/`deleted_by` to `interaction` (and any new table); pick ONE audit strategy (column-level + `interaction` event log, OR `*_audit` triggers) and retire the other; add retention/archival on the audit tables.
**Migration risk.** Low (additive columns); retiring audit triggers is operational, do after the interaction model lands.

## S5. Weak tenant/project scoping on base records
**Problem.** "Project" is the tenant boundary, but it's modelled inconsistently: `lead_master.project_id` is **nullable** (so a lead can belong to no project), companies/contacts have **no** `project_id` on the base record — scoping is bolted on via the `company_project_status`/`contact_project_status` side tables (28/26 rows) and `project_visibility_setting`. Only one real project exists today, masking the gap.
**Why it bites.** When the second client/project lands (sales portal is priority #2), RLS scoping for companies/contacts depends entirely on the sparse side tables; a company with no `*_project_status` row is invisible-or-global depending on policy. Nullable `lead_master.project_id` lets leads escape tenant scoping.
**Fix.** Make `project_id` NOT NULL on `lead_master` (backfill to the single project), and decide the canonical company/contact↔project link (the `*_project_status` table is reasonable but must exist for every in-scope record; add a trigger/backfill so every company/contact has a status row per project it's used in).
**Migration risk.** Medium: backfilling project_id and ensuring status rows exist for all 525 companies / 608 contacts; validate RLS before prod.

## S6. Inconsistent id types across the model
**Problem.** PKs mix `bigint` (most masters), `int` (`city_master`, `state_master`, `countrycode_master`, `meeting_schedule.meeting_sched_id`, `meeting_participant`, `pre_sales_*`), and `uuid` (`profiles.id` = auth.uid). FKs cross the boundary: `company_master.city_id` is `integer` but `contact_master.city_id` is `bigint` (the same logical key, two types — and `contact_master.city_id` has **no FK**).
**Why it bites.** Type mismatches force casts in joins, can defeat index usage, and are a constant footgun for ORMs and the data layer. The `int` masters will need widening if volume grows.
**Fix.** Standardize surrogate keys to `bigint` (widen the `int` masters), align `city_id` type between contact and company, add the missing FK on `contact_master.city_id`.
**Migration risk.** Medium: widening `int`→`bigint` on referenced PKs touches FKs; do per-table with care. Lower priority since volumes are small.

---

# FUTURE — debt to retire before scale / integrations

## F1. Wide "boolean soup" tables instead of typed events
`lead_status_history` (50 columns: a boolean + date + updated_by triple per status) and the parallel `wishlist`/`wishlist_assign` pair encode state transitions as columns. This is unqueryable as a timeline and unextensible (a new status = a schema change). **Fix:** fold into the `interaction` event log (N4); keep the wide table read-only for history. **Risk:** low, behavioural.

## F2. Naming chaos / structural inconsistency
`_master` suffix on some tables but not others (`project`, `location`, `wishlist`, `task`, `interaction`); MySQL Hibernate-generated FK names survive (`FK5y9juh5jk6uobs557dawpuw5l`); `meeting_master` has both `meeting_status` and a near-empty `status`; `meeting_master.duration`/`meeting_time` are `varchar` (times/durations as strings); `lead_master.value` is `varchar` (deal value as text). **Fix:** rename FKs to readable names, type duration/time/value properly, drop the dead `status` column, settle a table-naming convention. **Risk:** low but wide-reaching (touches data layer); do opportunistically.

## F3. Lookup tables that exist but are bypassed
`stage_master`, `status_master`, `source_master`, `designation_master`, `lead_designation` all exist, yet pipeline state and designations are largely stored as free text on the records (`lead_master.designation`, `stage`, `lead_report.report_status`). `status_master` is **empty**. **Fix:** as enums/categories are reintroduced (N2/N3), wire records to these FKs and decommission the dead ones (`status_master`, `lead_designation` vs `designation_master` duplication). **Risk:** low.

## F4. Dead / redundant columns and tables
`lead_master.agent_id` (132 rows, no FK, unused — superseded by `lead_report.user_id`), `lead_master.contact_id` (FK exists but **0/607 populated** despite the contacts migration — the link was never backfilled), `lead_report.lead_request`/`sales_intelligence` (sparse), `user_ghost`, `user_searches`, two designation tables. **Fix:** backfill `lead_master.contact_id` from `contact_master.source_lead_id` (the data is there — `contact_master` has 608 rows keyed to leads), then drop `agent_id`; prune the rest after confirming no app use. **Risk:** low; `contact_id` backfill is genuinely useful (it currently breaks lead↔contact joins).

## F5. `meeting_*` over-fragmentation
`meeting_master` + `meeting_schedule` + `meeting_reschedule` + `meeting_participant` + `meeting_question` + `feedback_answer` + `new_sales_question` model one meeting across seven tables, several with overlapping reschedule/status fields. **Fix:** consolidate reschedule history into the interaction log; keep participants/questions as child tables. **Risk:** medium; large surface in `data/meetings.ts` (50KB) — defer until after launch.

## F6. `float` for money, `varchar` for dates/durations
`meeting_question.updated_in_price`/`updated_out_price` and `new_sales_question.*` use `float` (lossy for currency); `meeting_master.meeting_date` is a real `date` but `meeting_time`/`duration` are `varchar`; `lead_master.value` is `varchar`. **Fix:** `numeric` for money, proper `time`/`interval` (or combine into `timestamptz`), `numeric` for deal value. **Risk:** low-medium (parse + backfill); do before any revenue/forecast reporting.

---

## Cross-cutting root causes (fix these and the symptoms collapse)
1. **One ownership column, read by RLS and app alike** (N1) — kills the launch blocker and the three-way ambiguity.
2. **Controlled vocabularies via CHECK→`dropdown_option`/lookup FK** (N2, N3, F3) — stops status/category corruption at the source.
3. **One canonical `interaction` event log with real FKs** (N4, S2, F1, F5) — gives AI and timelines a single spine.
4. **Typed, FK-backed audit columns + forced RLS** (S1, N5) — makes the audit trail and access model trustworthy.

## Validation discipline (non-negotiable for any of the above)
Per CLAUDE.md: manual deploys, validate every RLS change with throwaway non-admin logins before prod, never destructive without showing the owner. All fixes above are stageable as additive migrations (new column / new constraint / backfill / swap) so each is reversible. The existing `apply-assignment-rls.cjs` is the template: single BEGIN/COMMIT, ROLLBACK on error, VERIFY queries, `--rollback` path.
