# Master Findings Index — AltLeads CRM

> **Generated 2026-06-28.** Single source of truth for navigation across every research / audit / discovery doc we have produced. **This supersedes the scattered audits for *finding* and *deciding* things fast** — when a future session (whose chat memory is gone) needs to know "have we already looked at X? is there a ticket? was it corrected since?", start here. The detail docs remain authoritative for depth; this index just deduplicates, cross-references, and reconciles them. **AI forgets; the repo remembers.**

**How this was built:** read all findings/audit/discovery docs under `docs/` + `docs/product/`, the full ticket list in `new-code/web/scripts/gen-backlog-tracker.cjs` (ALT-001..449) and the decision/risk register in `new-code/web/scripts/gen-review-tracker.cjs` (DEC-01..14), plus the discovery sidecar `new-code/web/scripts/discovery-backlog.json` (PD-001..084, DO-085..135). Every ALT/DEC/PD/DO id below is real and was seen in those sources — none invented. Where a finding has no ticket it is marked **(no ticket — candidate)**.

---

## 1. How the source docs relate (and which were superseded/corrected)

Effort key used throughout: **S** < 1 day · **M** 1–3 days · **L** ≥ 1 week. Severity: Critical / High / Med / Low.

| Doc | Date | What it covers | Status vs newer docs |
|---|---|---|---|
| `docs/product/PLATFORM-DISCOVERY.md` | 2026-06-27 (corr. 06-28) | 26-domain platform-maturity map (~13% maturity); PD-001..084 in sidecar; the north-star "capture everything → intelligence" architecture (event spine, outbox, metadata registry, pgvector) | **PARTIALLY CORRECTED** by CRM-CAPABILITY-CENSUS (see §3 conflicts): record-merge "MISSING" claim, import "MEDIUM-HIGH/Phase 3" rating, bulk "spinner-only" claim. Architecture half stands. |
| `docs/product/CRM-CAPABILITY-CENSUS.md` | 2026-06-28 | Re-derives capabilities from live platforms (HubSpot via MCP) + code audit; **corrects** PLATFORM-DISCOVERY; names ~12 omitted table-stakes (ALT-416..427) | **NEWEST capability lens.** Where it disagrees with PLATFORM-DISCOVERY, this wins. |
| `docs/product/DATA-OPS-LAUNCH-BLOCKERS.md` | 2026-06-28 | The **launch lens**: data-admin gaps + BUGS that cause data loss/corruption on day one with ~110 users on 100%-migrated data. Defines ALT-428..449 | **NEWEST launch-blocker lens.** Companion to the census. |
| `docs/product/DATA-OPS-AUDIT.md` | 2026-06-27 | 43-agent data-ops audit (admin + analyst personas); DO-085..135 sidecar; the UNDO/REDO + service-role-endpoint unlock (→ DEC-14) | Largely rolled into the census + launch-blockers + ALT-395..413. |
| `docs/product/BULK-OPS-AUDIT.md` | 2026-06-27 | Data-admin bulk tooling matrix (A–I); ALT-376..385; flags merge as **dead code** | Merge "dead code/unreachable" **CONFLICTS** with census "merge EXISTS (ALT-293)" — resolution in §3. |
| `docs/product/CRM-PARITY-HUBSPOT-ZOHO.md` | 2026-06-27 | Live HubSpot (portal 9264506) + Zoho parity gap analysis; biggest gap = **no Deal/Pipeline object** (→ DEC-11/ALT-386) | Current. Feeds DEC-11/12. |
| `docs/product/HUBSPOT-ZOHO-UX-RESEARCH.md` | 2026-06-23 | UX-lens HubSpot/Zoho study; defines ALT-340 (merge), 341 (associations), 342 (multi phone/email), 343 (collaborators), 344 (dashboards), 345/346/347 (masking/assignment/roles), 348 (the doc) | Current. |
| `docs/product/UX-AUDIT.md` | 2026-06-21 | 26-agent UX/UI/feature audit, 718→170 findings, 13 themes, Top-30, 27 missing-capabilities, 14 quick-wins; §8 launch lens | Tickets = ALT-177..215. Many shipped (see §7). Fresh-UX deltas captured later in DATA-OPS-LAUNCH-BLOCKERS §E. |
| `docs/product/PERSONA-AUDIT-2026-06.md` | 2026-06-22 | 4-persona (Admin/TL, Agent/QC, Sales/Client, UI) audit; ALT-296..323 | Current. |
| `docs/product/VIEWS-AND-PREVIEW-PLAN.md` | 2026-06-22 | Multi-view (Table/Grid/Kanban/+) + right-hand preview panel; ALT-324..336 | Mostly **SHIPPED** (Grid/Kanban/preview pilot). |
| `docs/product/FOUNDATION-BUILD-PLAN.md` | 2026-06-27 | 7-block additive foundation (feature_flag, event spine, capture path, metadata registry, identity resolution, one automation, versioned API); maps to PD-### | Engineering plan behind PLATFORM-DISCOVERY; not yet ticketed individually. |
| `docs/SECURITY-AUDIT.md` | 2026-06-17 | 29 findings (14 High/Crit): client-side-only protection, unauth admin endpoints, open email relay, no FORCE RLS, plaintext-pw column, xlsx CVE | Several **FIXED** same day (ALT-127..134); RLS/FORCE-RLS still open → DEC-04/ALT-353. |
| `docs/QA-AUDIT.md` | 2026-06-15 | 11-agent functional QA: 3 Crit / 9 High / 13 Med / 16 Low | Crit/High mostly **RESOLVED** (ALT-113/114 + hardening). |
| `docs/SCHEMA-AUDIT.md` | 2026-06-24 | Live DB introspection: ownership split, corrupted statuses, no FORCE RLS, dup contacts; ALT-349..360 | Drives DEC-03/04/05; feeds the Data-Health scorecard in the Review Hub. |
| `docs/product/ACCESS-CONTROL-MODEL.md` | 2026-06-17 | Design-only per-project visibility/masking model (D1–D8, helper RPCs, V1/V2/V3) | Design; built incrementally as ALT-132..134; refined by ALT-345/347. |
| `docs/product/BULK-IMPORT-EXPORT.md` | 2026-06-18 | Import wizard + service-role `/api/<entity>/bulk-update` spec, Record-ID match key | Spec behind ALT-376/396/397/399; Record-ID shipped (ALT-377). |
| `docs/product/DECISIONS.md` | 2026-06-19 | 23 ADRs (ADR-01..23) — the *settled* architecture/product decisions | Stable. NB: the newer **DEC-##** queue (open decisions) lives in `gen-review-tracker.cjs`, not here — see §5. |
| `new-code/web/scripts/gen-backlog-tracker.cjs` | living | The Jira-style backlog — ALT-001..449 with status/notes (source of truth; .xlsx regenerates from it) | Current. |
| `new-code/web/scripts/gen-review-tracker.cjs` | 2026-06-25 | The owner Review Hub — DEC-01..14 decisions, RSK-01..12 risks, Data-Health scorecard | Current. The DEC-## decision queue. |

**Index-integrity notes for future sessions:**
- The **backlog tracker is the authority on ticket status**; the audit docs sometimes describe a ticket as "Backlog/not started" while the tracker shows it shipped (e.g. ALT-377/401/414). Trust the tracker for status.
- ADR numbering (`DECISIONS.md`) and DEC numbering (`gen-review-tracker.cjs`) are **separate schemes** — ADR = settled, DEC = pending owner call. Don't conflate them.

---

## 2. Unified findings register

One row per **distinct** finding/gap. Duplicates that appeared in multiple audits are collapsed and all source docs listed. `Status` reflects the **backlog tracker**. Sources abbreviated: **CENSUS**=CRM-CAPABILITY-CENSUS · **DOLB**=DATA-OPS-LAUNCH-BLOCKERS · **DOA**=DATA-OPS-AUDIT · **BOA**=BULK-OPS-AUDIT · **PD**=PLATFORM-DISCOVERY · **PARITY**=CRM-PARITY-HUBSPOT-ZOHO · **UXR**=HUBSPOT-ZOHO-UX-RESEARCH · **UXA**=UX-AUDIT · **PERS**=PERSONA-AUDIT · **VIEWS**=VIEWS-AND-PREVIEW · **SEC**=SECURITY-AUDIT · **QA**=QA-AUDIT · **SCHEMA**=SCHEMA-AUDIT · **ACM**=ACCESS-CONTROL-MODEL · **BIE**=BULK-IMPORT-EXPORT · **FBP**=FOUNDATION-BUILD-PLAN.

### A. Data Import / Export

| Finding | Sev | Eff | Ticket | Status | Sources |
|---|---|---|---|---|---|
| No in-app bulk IMPORT / re-import engine (CSV/Excel; create/update/upsert; the #1 adoption killer). Build = service-role `/api/<entity>/bulk-update` + wizard. | Critical | L | ALT-376 / ALT-397 (dup; same engine) | Backlog (gated DEC-03/14) | CENSUS, DOLB#1, DOA(DO-086), BOA#1, PARITY, BIE, PD(§13/PD-061) |
| Record-ID column on export (= the import template / round-trip key) | High | S | ALT-377 | **Done (2026-06-27)** | BOA#2, DOA, PARITY |
| Import dry-run diff + staged commit (preview create/update/skip/error counts) | High | M | ALT-399 (FE wizard) + endpoint | Backlog (FE buildable now) | CENSUS, DOLB, DOA(DO-088/089), BIE |
| Import skipped-row / error file (per-row reason, not just a count) | High | S | ALT-418 | Backlog | CENSUS(§3), DOLB, DOA(DO-091) |
| Import field-mapping screen (auto-match + manual remap + row preview) | Med | M | ALT-399 | Backlog (FE buildable now) | DOA(DO-088), BIE, PD(PD-061) |
| Saved / reusable import field-mapping templates | Med | M | ALT-419 | Backlog | CENSUS(§3), DOLB |
| Don't-overwrite-with-blank guard on update imports | High | S | folded into ALT-397 | Backlog | DOA(DO-090), BIE |
| In-flight dedup at import time (match preview, dedup-choice) | High | M | folded into ALT-397/399 | Backlog | DOA(DO-093), DOLB |
| Scheduled / recurring imports (FTP/cloud/URL) | Low-Med | L | ALT-420 | Backlog | CENSUS(§3), DOA(DO-131-adj) |
| Server-streamed full-dataset export + reconciliation "N of N" count (client-side export silently caps at what's loaded) | High | M | ALT-412 | Backlog | DOLB, DOA(DO-109) |
| CSV/Excel formula-injection hardening on export (`= + - @` prefixing) | High | S | ALT-395 | **Done (2026-06-27, all 5 modules)** | DOA(DO-107), SEC, CENSUS(confirmed clean) |
| Replay / re-run a saved export configuration | Low | M | (no ticket — candidate; DO-111) | Backlog | DOA(DO-111) |

### B. Dedup / Merge

| Finding | Sev | Eff | Ticket | Status | Sources |
|---|---|---|---|---|---|
| **Atomic record-merge** — merge EXISTS (`merge.ts`/`MergeDuplicatesModal.tsx`, ALT-293) but is **non-atomic** (client-side call sequence; crash mid-merge half-merges, no rollback). Move into ONE SECURITY DEFINER RPC. **⚠ see §3 conflict.** | Critical (risk) | M | ALT-416 (+ ALT-379 wire-up + ALT-293 base) | Backlog (validate on throwaway login) | CENSUS§2, DOLB#2, BOA#4, DOA(DO-097/098), UXR(ALT-340), HIGH-IMPACT(ALT-293) |
| Read-only duplicate **detector** (exact-ish name/email/phone/site over loaded rows) | Med | S | ALT-394 | **In Progress (built, not pushed)** | DOLB, DOA(DO-118-adj), CENSUS(§1 confirmed HAVE) |
| Fuzzy / cross-table dup detection (name+company, whole-table scan; current finder is exact + loaded-rows only) | Med | M | ALT-439 | Backlog | DOLB, DOA(DO-093/118), CENSUS(D4/D5) |
| Merge survivorship rules + association re-parenting + de-merge/unmerge (snapshot loser) | High | M | folded into ALT-340/416 | Backlog | UXR(ALT-340), DOA(DO-098) |
| Enforce contact/company de-dup with UNIQUE indexes after a cleanup merge (20 dup-email groups live; no constraint) | Med | M | ALT-355 | Backlog | SCHEMA, DOA(DO-104), Review-Hub Data-Health |
| Write-time exact-match dedup on create (prevent dupes at source) — **partly HAVE** (new-company/contact create dedup ALT-070/075) | Med | S | PD-032 / DO-104 | Backlog | PD(PD-032), DOA(DO-104); HAVE per ADR-13 |

### C. Bulk Operations

| Finding | Sev | Eff | Ticket | Status | Sources |
|---|---|---|---|---|---|
| Bulk-action toolbar on all lists (reassign / set-status / add-to-project on a selection) | High | L | ALT-291 (+ UXA Top#1) | **In Progress (shipped core)** | UXA(Top#1), HIGH-IMPACT, PERS |
| Progress bar + cancel on bulk loops | High | S/M | ALT-401 (= ALT-381 dup) | **Done (commit 3d266c7, 2026-06-28)** | CENSUS(HAVE), DOLB, BOA#6, DOA(DO-103) |
| Generalized bulk field-edit (any whitelisted field; today status-only, Leads excluded) | High | M | ALT-380 | Backlog | BOA#5, DOA(DO-099) |
| "Select all N matching" across pages (not just current page) | Med | M | ALT-368 (FE) / ALT-385 (server, large data) | **In Progress (FE built)** | UXA(Top#10), BOA#10, DOA |
| Count-confirmation on bulk set-status / add-to-project | Med | S | ALT-382 | Backlog (reassign already has it) | BOA#7, DOA(DO-095) |
| Bulk-selection safety: clear selection on filter change (Contacts doesn't); select-all respects true filtered set; off-screen max guard | High | S | ALT-436 | Backlog | DOLB§B (L8/L9/L10) |
| Bulk-action audit receipt + "undo last bulk action" (no batch log/undo today) | Med | M | ALT-384 / ALT-402 | Backlog | BOA#9, DOA(DO-100/101/102) |
| Partial-failure surfacing + retry-failed-subset | Med | S | ALT-381 / ALT-435 | Backlog | DOA(DO-102), DOLB |
| Bulk delete / archive (admin soft-delete + recycle bin; no delete UI anywhere) | High | M | ALT-378 | Backlog | BOA#3, DOA(DO-095/096) |
| Bulk-assign owner + "max per company" cap + departure reassignment | Med | M | ALT-443 | Backlog | DOLB, DOA(DO-135-adj) |

### D. Recycle / Restore / History / Undo

| Finding | Sev | Eff | Ticket | Status | Sources |
|---|---|---|---|---|---|
| Recycle bin — list + restore soft-deleted records (`deleted_date/deleted_by` columns exist but NO write ever sets them and no restore UI) | High | S/M | ALT-400 | Backlog (read+restore buildable now) | CENSUS(§3), DOLB, DOA(DO-094), PD(PD-031), BOA#3 |
| Safe reversible import/export — one-button UNDO + **REDO** + persisted history log (real differentiator; no competitor ships REDO) | Critical (flagged) | L | ALT-396 | Backlog (admin-only buildable now via service-role; agent path waits DEC-03) | DOA§2(DO-085), DOLB, CENSUS, **DEC-14** |
| Import rollback (undo a specific import batch) | High | M | ALT-417 / ALT-398 | Backlog | CENSUS(§3), DOA(DO-087) |
| Field-level change history (old→new, who, when, source) — `appendInteraction` writes free-text only, no `{field,old,new}` diff | High | M | ALT-407 | Backlog (render buildable now) | CENSUS(§3), DOLB, DOA(DO-117), PD(PD-037), QA |
| Point-in-time rollback ("restore CRM changes" within N days, by user/import) — HubSpot safety net we lack | Med | L | ALT-438 | Backlog (**needs decision**: retention window) | DOLB, DOA(DO-130) |
| Undo / undo-toast for status, disposition, single bulk edits | Med | M | folded into ALT-384/UXA-MC17 | Backlog | UXA(MC17), UXR(#9) |

### E. Search

| Finding | Sev | Eff | Ticket | Status | Sources |
|---|---|---|---|---|---|
| Global search / Cmd-K command palette (was none) | High | L | ALT-188 / ALT-272 / ALT-393 | **Done** (palette + top-bar bar + quick-nav actions) | UXA(Top#11), PERS, UXR |
| In-memory keyword search only — NOT fuzzy, NOT full-text/semantic (no pgvector) | High | L | ALT-359/360 (semantic) / PD-072 | Backlog | PD(§16/PD-072), CENSUS(§1 confirmed) |
| Global search index goes stale within a session (cached at module scope, cleared only on logout) | Med | S | ALT-310 | Backlog | PERS(ALT-310) |
| Search-index cache leaked across sessions on shared device | High | S | ALT-220 | **Done** | UXA, SEC-adj |

### F. Lists / Segments / Saved Views

| Finding | Sev | Eff | Ticket | Status | Sources |
|---|---|---|---|---|---|
| **Saved filter segments** (named, multiple; dynamic vs static lists) — only one ad-hoc set today | High | M | ALT-404 (+ ALT-389 dynamic lists) | Backlog (**DEC-07**: local-now vs server-backed) | **collapses** UXA(Top#8), PD(§11/PD-058), DOA(DO-112), DOLB§D, PARITY, HIGH-IMPACT |
| Saved **column** views (per-user) — **HAVE** (`views.ts`/ColumnCustomizer) | — | — | ALT-035/044/050/081/089 | **Done** | CENSUS(§1), UXA |
| Multiple list VIEWS per module — Table / Grid / Kanban switcher | High | M | ALT-324/325/326 | **Done** (Grid+Kanban shipped; drag-to-stage deferred) | VIEWS |
| Real editable (Excel) grid — inline-edit cells from the list | High | M | ALT-331 | **Done** | VIEWS, UXR |
| Right-hand record PREVIEW panel (slide-over) on row click | High | M | ALT-327/328 | **In Progress (Contacts pilot shipped)** | VIEWS, UXR |
| Per-view column sets ("Sales view" vs "Ops view") | Med | M | ALT-445 | Backlog (**needs decision**: how many) | DOLB§D |
| Default sort per view + user-pinned/frozen columns (sort resets on refresh) | Med | S | ALT-440 | Backlog (buildable now) | DOLB§D, CENSUS |
| Persist list state (filters/sort/page/tab) across refresh / in URL | High | M | ALT-186 / ALT-369 | **In Progress** (filters persisted; URL pending) | UXA(Top#9, QW10), VIEWS |
| Active-filter chips (removable + Clear all) | Med | S | ALT-413 | **In Progress (built)** | UXA(Top#24), DOLB |
| Searchable multi-select facet filters (replace native single-selects) | High | M | ALT-183 | **Done** (all 5 lists) | UXA(Top#6) |
| Advanced per-column / per-field filters (contains/is-empty/AND-OR; customizer columns un-filterable; missing facets) | High | L | ALT-184 / ALT-270 | Backlog | UXA(Top#7), HIGH-IMPACT, PERS |
| Calendar / Map / Split views (Map ties to site-feasibility ALT-277/278) | Low | L | ALT-329 | Backlog | VIEWS |
| Collapsible filter panels + per-filter clear | Med | M | ALT-178-set/UXA Top#24 | Backlog | UXA(Top#24) |

### G. Records / Fields / Customization

| Finding | Sev | Eff | Ticket | Status | Sources |
|---|---|---|---|---|---|
| No-code custom fields (admin adds typed property without a migration) | High | L | ALT-387 (+ PD-033..037, FBP Block 4 metadata registry) | Backlog (**DEC-12**) | PARITY, PD(§2), CENSUS, FBP, DOA |
| Validation-rules engine (required-when / regex / range / cross-field; block save) | High | M | ALT-421 | Backlog | CENSUS(§3), DOLB, DOA(DO-106), PD(PD-034), PARITY |
| Dependent / cascading picklists + reusable global picklist sets | Med | M | ALT-422 | Backlog | CENSUS(§3), PD(PD-035) |
| Record types — layout + picklist per segment | Med | L | ALT-423 | Backlog | CENSUS(§3), PD(PD-039) |
| Tags / labels with filter-by-tag | Med | S/M | ALT-424 | Backlog | CENSUS(§3) |
| ~12 field types (formula/rollup/lookup/file/rich-text/encrypted-PII) | High | L | PD-033/036 (no ALT) | Backlog | PD(§2), FBP |
| Multiple emails / phones per contact with Primary flag + make-primary | Med | M | ALT-342 | Backlog (owner-gated; needs child table) | UXR(ALT-342), VIEWS |
| Calculated / derived fields (Days-Since-Update, Size Tier) | Med | M | ALT-114-adj / DO-114 | Backlog | DOA(DO-114) |
| Reorderable / collapsible detail-page sections | Low | M | ALT-447 | Backlog | DOLB§D |
| Controlled-dropdown enforcement on status fields (DB-level CHECK/FK) | High | M | ALT-350 (+ DO-105) | Backlog | SCHEMA, DOA(DO-105), Review-Hub(DEC-05) |
| Surface freshness fields: last-contacted / days-since-touch / next-step | Med | M | ALT-448 | Backlog (**needs decision**: compute source) | DOLB§D, VIEWS(ALT-330), UXA(MC9) |
| Per-project three-layer status model (call-disposition / contact / account) — **HAVE** | — | — | ALT-086..088, ADR-17 | **Done** | DECISIONS(ADR-17) |
| Admin-editable dropdown option lists — **HAVE** | — | — | ALT-061/086, ADR-18 | **Done** | DECISIONS(ADR-18) |

### H. Ownership / Collaboration / Associations

| Finding | Sev | Eff | Ticket | Status | Sources |
|---|---|---|---|---|---|
| **Write-path / ownership blocker** — RLS keyed on `created_by` (= bulk-importer id) but real assignee = `lead_report.user_id`; agents blocked from editing their own migrated leads. **THE central launch blocker.** | Critical | M | ALT-152 / ALT-349 / ALT-433 / ALT-346/347 | Backlog (**DEC-03**; plan drafted `docs/LAUNCH-BLOCKER-RLS-PLAN.md`) | **collapses** PD(PD-030), SCHEMA, DOLB#5, HIGH-IMPACT, UXR, ACM, QA, Review-Hub(RSK-01/DEC-03) |
| Two writers fight over lead ownership (reassign writes `lead_report.user_id`; Edit-Lead form rewrites `created_by`; reassignment silently reverted) | Critical | M | ALT-433 | Backlog (DEC-03) | DOLB#5, SCHEMA |
| Reassign / change owner across lead/company/contact/meeting (single + bulk) | High | M/L | ALT-288/289/290 | **Done** (lead+meeting+company+contact reassign) | HIGH-IMPACT, PERS |
| Record COLLABORATORS / secondary owners (co-edit like owner) + free view-only seats + @mention | High | M | ALT-343 / ALT-441 | Backlog (design spec done; **needs decision** on write posture) | UXR(ALT-343), DOLB, VIEWS |
| Generic record ASSOCIATIONS across modules (typed + labeled; Primary flag) | High | M | ALT-341 / ALT-442 / ALT-388 | Backlog (design spec done) | UXR(ALT-341), PARITY, DOLB, VIEWS |
| Show owner/salesperson on lists (Companies/Contacts Owner column "Unassigned"; Leads shows Agent not salesperson) | High | S | ALT-296 | **Done (2026-06-22)** | PERS |
| Cross-project master-data (company/contact) leakage — leads project-scoped but master rows globally visible | High | M | PD-027 / ALT-216 | Backlog | PD(PD-027), SEC |
| Sales portal downline scoping (SP=own, SH=downline) | High | M | ALT-167 | Backlog | HIGH-IMPACT, PERS, DECISIONS(ADR-23) |
| Cascade-impact / orphan preview before parent delete or reassign | Med | M | DO-123 (no ALT) | Backlog (DEC-03) | DOA(DO-123) |

### I. Validation / Data Quality

| Finding | Sev | Eff | Ticket | Status | Sources |
|---|---|---|---|---|---|
| Statuses are free text & already corrupted (report_status 11 variants; meeting_status NULL/""; `active_status`="0" string) — breaks every report/funnel | High | M | ALT-350 | Backlog (**DEC-05**) | SCHEMA, Review-Hub(DEC-05/Data-Health), QA |
| `area_of_interest` worst-corrupted (24+ spellings of ~4 concepts; blank-space values) — breaks segmentation + HungerBox fit-scoring | High | M | ALT-351 | Backlog (DEC-05) | SCHEMA, Review-Hub(Data-Health) |
| Magic-FK corruption at source (`createLead` writes `address_id ?? 1`; `createClient` borrows another client's address) — pollutes city reporting | High | S | ALT-434 | Backlog | DOLB#8, QA(new-company FK bug) |
| Form validation (email/phone/URL/required + on-blur) — phone accepts any text | Med | M | ALT-199 | **In Progress** (validators built; wiring pending) | UXA(Top#22), DOA(DO-106) |
| Data-quality command center (dup counts, fill-rate, formatting health, unused-property cleanup) | Med | M | ALT-408 | Backlog (read-only buildable now) | CENSUS(§3), DOLB, DOA(DO-118) |
| Don't render load failures as "no data" (`catch→return []` across contacts/companies/globalSearch/leadsApi) — distinguish empty vs error + Retry | High | S | ALT-435 | Backlog | DOLB§B, UXA(QW11/QW12) |
| List display: numeric/date sort bugs (Contacts string-sorts numbers; grid dates sort lexically) | Med | S | ALT-437 | Backlog | DOLB§B(L11/L12) |
| Contact-to-company enrichment auto-fill (domain/industry/size) | Med | M | DO-121 (no ALT) | Backlog | DOA(DO-121) |

### J. Permissions / RLS / Security / Audit

| Finding | Sev | Eff | Ticket | Status | Sources |
|---|---|---|---|---|---|
| No FORCE RLS + broad anon grants on hot PII tables (owner bypasses RLS on a public Supabase URL) | Critical | M | ALT-353 | Backlog (**DEC-04/DEC-09**; validate on throwaway logins) | SEC(#1), SCHEMA, Review-Hub(RSK-02/RSK-07) |
| Unauthenticated `POST /api/users/create` + `/reset-password` (returned plaintext admin pw, zero-cred takeover) | Critical | S | ALT-127 | **Done (2026-06-17)** | SEC(#3/#4), QA |
| Open email relay `/notify` (no auth/rate-limit/recipient validation) | High | S | ALT-128 | **Done** | SEC(#6) |
| Privilege escalation — self-assign `user_role='ADMIN'` / rewrite `rbac_master` | Critical | S | ALT-131 | **Done** | SEC(#2), QA |
| All authz client-side only (approve/enable/role-change are plain API writes; no server backstop) | Critical | M | ALT-353 + ALT-431 | Backlog | SEC(#5), Review-Hub(RSK-12), QA |
| Trusted write layer — server-derived actor + validation (client supplies `created_by/updated_by`; forgeable) | High | M | ALT-431 | Backlog (**needs decision**: write API/RPC layer) | DOLB#6, DOA(DO-124), FBP(Block 7) |
| Optimistic-concurrency / lost-update guard (every update last-writer-wins; two users clobber each other) | High | S | ALT-430 | Backlog | DOLB#7, QA(approval double-execute) |
| Contact-detail masking = partial mask + click-to-reveal, DB-enforced (screen-only mask is not protection) | High | M | ALT-173 / ALT-345 (+ DB) | Backlog (**DEC-06**; ADR-22 settled the UX) | UXA(Top#17), UXR, ACM, SCHEMA, Review-Hub(DEC-06), DECISIONS(ADR-22) |
| Hide/disable login site while RLS off (live PII exposure right now) | Critical | S | (no ALT — DEC-09) | **Decision-needed** | Review-Hub(DEC-09/RSK-07) |
| Read/access audit log (not just write attribution) + AI-access audit | High | M | PD-026 / PD-082 (no ALT) | Backlog | PD(PD-026/082) |
| Honest writes — `humanizeWriteError` on every write surface (no silent RLS failures) | High | M | ALT-370 | **In Progress (built)** | DOLB, Review-Hub(advisor), UXA(QW9) |
| PII export gating (mask/restrict sensitive cols by role + export audit log) | High | S | ALT-383 / ALT-403 | Backlog (**DEC-13**) | BOA#8, DOA(DO-108/110), DOLB |
| Standardize/FK audit columns (varchar numeric ids, no FK; missing `updated_by`) + record source/lineage flags | Med | M | ALT-354 / ALT-411 | Backlog | SCHEMA, DOA(DO-124/125/126) |
| Plaintext password column exposed; xlsx CVE; public self-signup | High | S | ALT-016/019/130 | **Done** | SEC, QA, DECISIONS(ADR-16) |
| GDPR/DPDP right-to-erasure (DSAR) + consent recording/retention | High | M | ALT-410 (+ PD-067/122) | Backlog | DOA(DO-122), PD(PD-067), CENSUS |
| Bulk-provisioned logins with no `profiles` row silently denied ALL edits once assignee-RLS lands | High | S | ALT-371 | **In Progress (server fix built)** | Review-Hub(RSK-10) |
| Notification recipients wrong (lead-scheduled goes to `created_by` not assignee; 91% of rows had NULL user_id) | High | M | ALT-346 / QA-fix | Backlog (+ migrated-row backfill done) | SCHEMA, QA, UXR |

### K. Reporting / Dashboard

| Finding | Sev | Eff | Ticket | Status | Sources |
|---|---|---|---|---|---|
| Role-aware, actionable dashboard ("what do I do today"; today's totals are org-wide all-time for everyone) | High | L | ALT-112 / ALT-301 | Backlog | UXA(Top#15), PERS(ALT-301) |
| Funnel / operations dashboard per HungerBox deck (Dials→Connects→Pitches→Scheduled→Successful) — 3 roles (Agent/Sales/TL) | High | L | ALT-336 / ALT-344 | Backlog | VIEWS, UXR(ALT-344), DOA(DO-116) |
| No-code report / pivot builder (self-serve; today 5 hardcoded KPIs) | High | L | ALT-405 | Backlog (read-only buildable now) | DOA(DO-113), CENSUS(§3), PD(§12/PD-059), PARITY |
| Clickable dashboard drill-downs (cards/bars/activity rows static) | High | M | ALT-193 | **Done** | UXA(Top#16) |
| Customizable dashboard tiles + date-range (5 fixed tiles, all-time, same for all roles) | Med | M | ALT-446 / ALT-406 | Backlog (**needs decision**: per-user vs per-role) | DOLB§D, DOA(DO-115) |
| Funnel / conversion analytics (stage drop-off, time-in-stage) | Med | M | ALT-406 | Backlog | DOA(DO-116), VIEWS(ALT-330) |
| Manager/team rollup ("My Team" panel; per-rep counts, workload, leaderboard) | High | M | ALT-301 | Backlog | PERS, UXR |
| Shared metrics/semantic layer (reporting + AI agree) | Med | L | PD-060 (no ALT) | Backlog | PD(PD-060) |

### L. Sales-Engagement / Calling / Tasks

| Finding | Sev | Eff | Ticket | Status | Sources |
|---|---|---|---|---|---|
| Calling loop — single-screen queue→dial→log→auto-advance + click-to-call + call logging | High | L | ALT-208 / ALT-269 / ALT-307 | **In Progress (Call module EPIC)** | UXA(MC1/MC2), PERS(ALT-307), PD(§8) |
| Two divergent call loggers + two disposition vocabularies (LogCallModal vs DispositionForm) — pick ONE canonical | High | M | ALT-303 | Backlog (DEC-ref C1) | PERS(ALT-303), SCHEMA(call_log) |
| Task manager — follow-up reminders, callback scheduling, snooze/defer | High | L | ALT-160 / ALT-250..266 | **Done (core My Tasks shipped)** | UXA(MC3/MC5), DECISIONS, PD(§10) |
| Today / unified work-queue (tasks due + meetings today + stale leads; split across 3 screens) | High | L | ALT-306 / PD-020 | Backlog | UXA(MC4), PERS(ALT-306), PD(PD-020) |
| Disposition implies follow-up → inline "schedule callback" in log modal | Med | M | ALT-308 | Backlog | PERS(ALT-308), UXR |
| Call-log section + log-a-call FROM the preview panel | High | M | ALT-335 / ALT-337 | **Done / In Progress** | VIEWS, UXR |
| "My records" default + Assigned-to facet (lists return everything; agent facet keys off `created_by`) | High | M | ALT-305 | Backlog | PERS(ALT-305) |
| Inline stage/disposition quick-edit on Leads rows (Contacts has it, Leads doesn't) | Med | S | ALT-309 / ALT-157 | Backlog | PERS, HIGH-IMPACT, UXA(Top#28) |
| Do-Not-Call / suppression list (first-class; exclude from calls/exports + unsubscribe) | High | S | ALT-409 / ALT-425 | Backlog | CENSUS(§3), DOLB, DOA(DO-119), UXA(MC12), PD |
| Sequences & cadences (multi-step, multi-channel) — core motion has no engine | Critical | L | PD-048/049 (no ALT) | Backlog | PD(§6) |
| Timezone-aware scheduling (caller vs prospect TZ) | Med | M | UXA-MC13 (no ALT) | Backlog | UXA(MC13) |

### M. Automation

| Finding | Sev | Eff | Ticket | Status | Sources |
|---|---|---|---|---|---|
| Workflow / automation engine (triggers: assign/email/task/stage-change) — all manual today | High | L | ALT-390 (+ PD-045, FBP Block 6) | Backlog | PARITY, PD(§5), CENSUS, FBP |
| Approval / Blueprint engine (guided stage transitions, mandatory fields) — generalise Approvals page | Med | M | ALT-426 (+ PD-046) | Backlog | CENSUS(§3), PD(PD-046) |
| Background bulk-job queue + "email me when done" | Med | M | ALT-427 (+ PD-011 outbox) | Backlog | CENSUS(§3), PD, DOA(DO-132) |
| Lead-routing / round-robin / assignment-rules | Med | M | PD-047 (no ALT) | Backlog | PD(PD-047) |
| Transactional outbox (durable retryable action queue) — replaces ad-hoc cron | Critical | M | PD-010/011/012 (no ALT; FBP Block 1) | Backlog | PD, FBP |

### N. API / Integrations

| Finding | Sev | Eff | Ticket | Status | Sources |
|---|---|---|---|---|---|
| Public read API v1 (`/api/v1/*`, versioned, API-key) — no public surface today | Critical | M | ALT-172 (+ PD-023/024, FBP Block 7) | Backlog | PD(§14), FBP |
| Outbound webhooks (HMAC + retries + delivery log) + inbound webhook/form capture | Critical | M | PD-025/065/066 (no ALT) | Backlog | PD(§15) |
| Integration OAuth/secrets/token-refresh framework | High | M | PD-063 (no ALT) | Backlog | PD |
| MCP server (wrapper over /api/v1 + event stream) + agent write-safety (dry-run/approval) | High | M | ALT-172-adj (+ PD-083/084) | Backlog | PD(§17) |
| Calendar two-way sync + Fathom transcripts + WhatsApp/SMS capture into the spine | High | L | PD-054/055/056 (no ALT) | Backlog | PD(§9, Part C) |
| Email engine (native send + templates + inbound thread capture + deliverability) | Critical | L | PD-050/051/052/053 (no ALT) | Backlog | PD(§7) |
| Chrome extension — LinkedIn contact details + inline CRM edit | Med | L | ALT-162 / ALT-279..287 | **In Progress (Phase 1)** | (extension rebuild docs), PD(PD-064) |

### O. AI / Intelligence

| Finding | Sev | Eff | Ticket | Status | Sources |
|---|---|---|---|---|---|
| Enable pgvector + embeddings (embed-on-write captures from NOW; backfill is lossy) | Critical | M | ALT-359 / ALT-116 | Backlog (gated on security ALT-353 + clean log ALT-352) | PD(§16/PD-071), EMBEDDING-PLAN, AI-PGVECTOR-PLAN |
| Embedding backfill + retrieval (semantic search, similar-accounts, dedup, reach-out suggestions) + vector RLS | High | L | ALT-360 / ALT-117 | Backlog | PD(PD-072), EMBEDDING-PLAN |
| Unify scattered activity into ONE queryable event spine (`body_text` = capture↔intelligence contract) | Critical | M | ALT-352 (+ PD-004/005/006, FBP Block 2) | Backlog | SCHEMA, PD, FBP, DOA(DO-127) |
| First-party intent scoring + fit/engagement/intent scores + conversation intelligence | Critical | L | PD-075/076/077 (no ALT) | Backlog | PD(Part C) |
| Next-best-action / deal-risk / buying-committee mapping / explainability-citation | Med-High | L | PD-073/078/079/080/081 (no ALT) | Backlog | PD |
| AI assist (summarize history, draft follow-up, suggest-next-action) | Med | M | ALT-164 (+ DEC-10) | Backlog (**DEC-10**: API key + cost) | Review-Hub(DEC-10), VISION |

### P. UX / Accessibility / Microinteractions

| Finding | Sev | Eff | Ticket | Status | Sources |
|---|---|---|---|---|---|
| One global toast + confirmation system; confirm every destructive action | High | M | ALT-179 / ALT-180 | **Done** | UXA(Top#2/Top#3) |
| Keyboard focus ring (CSS stripped it app-wide, WCAG fail) | High | S | ALT-181 | **Done** | UXA(Top#4) |
| Table rows + sortable headers keyboard-operable; ARIA dialog/focus-trap on modals | High | M | ALT-182 / ALT-203 | **Done** | UXA(Top#5/Top#26) |
| Keyboard-first list nav (j/k/Enter/x/Esc) + Cmd-K quick-nav + "?" help overlay | Med | M | ALT-391 / ALT-393 / ALT-374 | **In Progress (built)** | UXA, UXR |
| Top-level ErrorBoundary (uncaught render white-screens SPA) | High | M | ALT-196 | **Done** | UXA(Top#19), QA |
| Forgot-password + show/hide toggle + reauth on change | High | M | ALT-197 | **Done** | UXA(Top#20) |
| Skeleton loaders instead of single spinner; empty vs no-match states + Retry | Med | M | ALT-200 / ALT-374 / ALT-435 | **Done / In Progress** | UXA(Top#23, QW11/QW12) |
| Sticky table headers (+ frozen identity column) | Med | S | ALT-318 / ALT-414 | **Done (commit a80a103)** | UXA(Top#18), PERS(ALT-318) |
| Density / compact mode toggle | Med | M | ALT-375 | **In Progress (all 5 lists)** | UXA(MC18), VIEWS |
| Truncation tooltips + clickable mailto/tel + copy; raw ISO dates | High | S | ALT-215(QW1/QW7) / ALT-364 | **Done / In Progress** | UXA(QW1/QW7) |
| Dirty-state navigation guard + draft cache on forms/modals | High | M | ALT-190 / ALT-219 | **Done** | UXA(Top#13) |
| Hide "create" from outreach roles (outreach-only posture) | High | S | ALT-215(QW4) / ALT-174 | **Done / Backlog** | UXA(QW4/Theme8), DECISIONS(ADR-21) |
| Design-token sweep (190 raw hex in 46 files) + one Button/DataTable/Modal/EmptyState primitive | High | M | ALT-314..323 | **Partly Done** (sticky/contrast/owner-col shipped) | PERS, UXA(Top#12/Top#30) |
| Muted-text contrast gray-400→gray-500 (WCAG AA) | Med | S | ALT-319 | Backlog | PERS, UXA |
| Desktop-only / non-responsive (fixed 240px sidebar, no breakpoints) | Med | L | UXA-Theme12 (no ALT) | Backlog | UXA(Theme12) |
| EditableGrid saves give no success toast; Wishlist lacks preview+bulk-reassign parity | Med | S | ALT-449 | Backlog | DOLB§E, UXA |
| First-run onboarding for ~110 first-login users; per-user notification prefs; dark mode | Med-Low | M | UXA-MC21/MC22/MC23 (no ALT) | Backlog | UXA(MC21/MC22/MC23) |

### Q. Performance / Scaling

| Finding | Sev | Eff | Ticket | Status | Sources |
|---|---|---|---|---|---|
| Silent truncation everywhere (Meetings 2000-cap, Contacts 50000-cap, `.limit(5000)` facets, Cmd-K index) — rows vanish from list/search/export/counter with no warning | High | S | ALT-428 | Backlog | DOLB#3, QA(dashboard 1000-cap) |
| Companies per-project Status & Owner load current-page-only → sort/filter/export blank for unvisited pages (export ships blank status) | High | M | ALT-429 | Backlog | DOLB#4, UXA(Top#25) |
| Move filter/sort/paginate server-side (every list downloads full dataset; Contacts was 1000-capped) | High | L | ALT-185(Top#14) / ALT-215(QW13) | **Partly Done** (Contacts cap fixed) | UXA(Top#14/QW13/Theme10) |
| Single ~1.6 MB JS bundle (slow first load) | Low | M | ALT-372 | **In Progress** (split 1672→282 KB) | QA, Review-Hub(RSK-06) |
| Large-data: indexes + server pagination ceiling on list/export | Med | M | DO-134 (no ALT) | Backlog | DOA(DO-134) |
| Audit-table growth control / retention (~85k audit rows vs 610 live) | Low | M | DO-129 (no ALT) | Backlog | DOA(DO-129), Review-Hub(Data-Health) |
| Observability: structured logs + error tracking + uptime + analytics | High | M | PD-013 / UXA-MC27 (no ALT) | Backlog | PD(PD-013), UXA(MC27) |

---

## 3. Duplicate / overlap map (the biggest collapses)

The same gap surfaced across many audits. Each was collapsed to ONE register row above; here is the audit trail of what merged:

1. **Saved filters / segments** → ONE row (§F). Appeared in: UX-AUDIT Top#8, PLATFORM-DISCOVERY §11 (PD-058), DATA-OPS-AUDIT DO-112, DATA-OPS-LAUNCH-BLOCKERS §D, CRM-PARITY, HIGH-IMPACT-UX-GAPS. Tickets **ALT-404** (+ ALT-389 dynamic lists). Open decision **DEC-07**.
2. **Ownership / write-path blocker** → ONE row (§H). Appeared in: PLATFORM-DISCOVERY PD-030, SCHEMA-AUDIT, DATA-OPS-LAUNCH-BLOCKERS #5, HIGH-IMPACT-UX-GAPS, HUBSPOT-ZOHO-UX-RESEARCH, ACCESS-CONTROL-MODEL, QA-AUDIT, Review-Hub RSK-01. Tickets **ALT-152 = ALT-349 = ALT-433** (+ ALT-346/347). The single **DEC-03** launch blocker. (Three ALT ids describe the same blocker from three audits — treat as one.)
3. **Atomic merge** → ONE row (§B). Appeared in: CENSUS §2, DATA-OPS-LAUNCH-BLOCKERS #2, BULK-OPS-AUDIT #4, DATA-OPS-AUDIT DO-097/098, HUBSPOT-ZOHO-UX-RESEARCH ALT-340, HIGH-IMPACT (ALT-293). Tickets **ALT-416** (atomic RPC) = ALT-379 (wire-up) = ALT-340 (full feature) over the ALT-293 base.
4. **Bulk import engine** → ONE row (§A). Appeared in: CENSUS, DATA-OPS-LAUNCH-BLOCKERS #1, DATA-OPS-AUDIT DO-086, BULK-OPS-AUDIT #1, CRM-PARITY, BULK-IMPORT-EXPORT, PLATFORM-DISCOVERY PD-061. Tickets **ALT-376 = ALT-397** (same service-role engine). Gated **DEC-14/DEC-03**.
5. **Progress + cancel on bulk ops** → ONE row (§C). Appeared in: CENSUS, DATA-OPS-LAUNCH-BLOCKERS, BULK-OPS-AUDIT #6, DATA-OPS-AUDIT DO-103. Tickets **ALT-401 = ALT-381**. **Shipped.**
6. **Recycle bin / restore** → ONE row (§D). Appeared in: CENSUS §3, DATA-OPS-LAUNCH-BLOCKERS, DATA-OPS-AUDIT DO-094, PLATFORM-DISCOVERY PD-031, BULK-OPS-AUDIT #3. Ticket **ALT-400**.
7. **Field-level change history** → ONE row (§D). Appeared in: CENSUS §3, DATA-OPS-LAUNCH-BLOCKERS, DATA-OPS-AUDIT DO-117, PLATFORM-DISCOVERY PD-037, QA-AUDIT. Ticket **ALT-407**.
8. **Masking (partial + click-to-reveal, DB-enforced)** → ONE row (§J). Appeared in: UX-AUDIT Top#17, HUBSPOT-ZOHO-UX-RESEARCH, ACCESS-CONTROL-MODEL D8, SCHEMA-AUDIT, Review-Hub DEC-06, DECISIONS ADR-22. Tickets **ALT-173 / ALT-345**. The UX is settled (ADR-22); the DB enforcement is **DEC-06**.
9. **Do-Not-Call / suppression** → ONE row (§L). Appeared in: CENSUS §3, DATA-OPS-LAUNCH-BLOCKERS, DATA-OPS-AUDIT DO-119, UX-AUDIT MC12, PLATFORM-DISCOVERY. Tickets **ALT-409 / ALT-425**.
10. **No-code custom fields / metadata registry** → ONE row (§G). Appeared in: CRM-PARITY, PLATFORM-DISCOVERY §2 (PD-033..037), CENSUS, FOUNDATION-BUILD-PLAN Block 4, DATA-OPS-AUDIT. Ticket **ALT-387**. Open decision **DEC-12**.
11. **Report/pivot builder** → ONE row (§K). Appeared in: DATA-OPS-AUDIT DO-113, CENSUS §3, PLATFORM-DISCOVERY §12 (PD-059), CRM-PARITY. Ticket **ALT-405**.
12. **No FORCE RLS / client-side-only authz** → ONE row (§J). Appeared in: SECURITY-AUDIT #1/#5, SCHEMA-AUDIT, Review-Hub RSK-02/RSK-12, QA-AUDIT. Ticket **ALT-353** (+ ALT-431). **DEC-04/DEC-09**.
13. **Today / unified work-queue** → ONE row (§L). Appeared in: UX-AUDIT MC4, PERSONA-AUDIT ALT-306, PLATFORM-DISCOVERY PD-020. Ticket **ALT-306**.
14. **Sticky headers** → ONE row (§P). Appeared in: UX-AUDIT Top#18, PERSONA-AUDIT ALT-318. Tickets **ALT-318/ALT-414**. **Shipped.**

### ⚠ Conflicts found (and their resolution)

1. **Merge: "MISSING" vs "EXISTS" vs "dead code."**
   - PLATFORM-DISCOVERY (06-27) says record-merge is **MISSING**.
   - BULK-OPS-AUDIT / DATA-OPS-AUDIT (06-27) say merge code **exists but is dead/unreachable** (`MergeDuplicatesModal` never mounted).
   - CRM-CAPABILITY-CENSUS (06-28) corrects: merge **EXISTS and is wired** via **ALT-293** but is **non-atomic** (the real risk).
   - **Resolution:** the CENSUS (newest, code-grounded) wins — merge exists and is reachable; the true problem is **non-atomicity**, fixed by **ALT-416** (SECURITY DEFINER RPC). The "dead code" wording predates the ALT-293 wire-up. **One row, §B.**

2. **Import rating: "MEDIUM-HIGH / Phase 3" vs "CRITICAL / near-term."**
   - PLATFORM-DISCOVERY rated import MEDIUM-HIGH and parked it in Phase 3.
   - CENSUS re-rates **CRITICAL / near-term** (a 100%-bulk-migrated CRM needs re-import daily) and pulls the FE wizard (ALT-399) forward.
   - **Resolution:** CENSUS wins. Registered as **Critical** in §A.

3. **Bulk progress: "spinner only, no progress/cancel" vs "shipped."**
   - PLATFORM-DISCOVERY §3 and BULK-OPS-AUDIT #6 say bulk ops have only a spinner.
   - CENSUS + the backlog tracker confirm **ALT-401 shipped** progress+cancel (commit 3d266c7, 06-28).
   - **Resolution:** **shipped** (§C). The audits predate the commit.

4. **Global search description.**
   - PLATFORM-DISCOVERY §16 calls it "in-memory keyword global search."
   - CENSUS adds nuance: correct, but **two surfaces** (Cmd-K + top-bar) with title-weighted ranking.
   - **Resolution:** not a contradiction — both true; the semantic-search gap (ALT-359/PD-072) stands. §E.

5. **"Inline create writes placeholders" (advisor claim).**
   - An advisor claim said inline company create writes placeholder values.
   - Review-Hub **RSK-08** marks it **CHECKED / did NOT hold** — `createCompany` writes nulls, validates the required name. **But** QA-AUDIT separately found a *real* magic-FK bug in `createLead` (`address_id ?? 1`) → **ALT-434**.
   - **Resolution:** the *company* placeholder claim is closed (no corruption); the *lead* address-FK corruption is real and ticketed (§I).

---

## 4. Decision queue (everything waiting on the owner)

The open **DEC-##** decisions (source: `gen-review-tracker.cjs`) plus ALT tickets explicitly flagged "needs decision." These are the calls blocking work. (ADRs in `DECISIONS.md` are already *settled* and are NOT repeated here.)

| DEC | Decision | Priority | Blocks / ALT | Source |
|---|---|---|---|---|
| **DEC-03** | Ownership / assignee schema fix — **THE launch blocker** (created_by ≠ assignee). Approve migration + throwaway-login validation. | P0 | ALT-152/349/433; gates ALT-376/396/431, metadata-registry & event-spine non-admin writes | Review-Hub, SCHEMA, DOLB#5 |
| **DEC-04** | Lock security before AI — FORCE RLS + close anon grants. | P0 | ALT-353; gates embeddings ALT-359 | Review-Hub, SEC |
| **DEC-09** | Gate the LIVE site until security lands — `crm.altleads.com` reachable with RLS off (active PII exposure). | P0 | (deploy posture) | Review-Hub, RSK-07 |
| **DEC-05** | Status cleanup — controlled dropdowns + CHECK/FK on corrupted free-text statuses. | P1 | ALT-350/351 | Review-Hub, SCHEMA |
| **DEC-06** | DB-enforced masking of email/phone + who-can-reveal rules (UX settled by ADR-22). | P1 | ALT-173/345 | Review-Hub, ACM |
| **DEC-11** | Adopt a Deals / Pipeline object (anchors the Sales Portal; independent of DEC-03). | P1 | ALT-386 | Review-Hub, PARITY |
| **DEC-14** | Build import + undo/redo engine NOW as an admin-only tool (service-role decouples it from DEC-03). | P1 | ALT-396/397 | Review-Hub, DOA |
| **DEC-01** | ONE unified feedback model (clients + sales). | P1 | ALT-311 (blocked) | Review-Hub |
| **DEC-02** | Remove / fold the Meeting module into Leads + a "due today" queue. | P1 | ALT-306 (design) | Review-Hub |
| **DEC-08** | When to push the built-but-unpushed work (ALT-361..364/368/369 + QC batch sit local). | P1 | (deploy window) | Review-Hub |
| **DEC-12** | No-code custom fields model (admin adds fields without code). | P2 | ALT-387 | Review-Hub, PARITY |
| **DEC-13** | Gate PII (email/mobile) on export? | P2 | ALT-383/403 | Review-Hub, BOA#8 |
| **DEC-10** | Turn on AI assist features (needs an LLM key + per-use cost). | P2 | ALT-164/359 | Review-Hub, VISION |
| **DEC-07** | Save View — quick personal/local now, or wait for the server-backed access model? | P2 | ALT-404 | Review-Hub |

**Plus ALT tickets self-flagged "needs decision" (not yet a DEC-##):** ALT-431 (write API/RPC architecture), ALT-433 (pick owner-of-record — part of DEC-03), ALT-438 (rollback retention window), ALT-441 (collaborator write/visibility posture), ALT-445 (how many named column views), ALT-446 (dashboard tiles per-user vs per-role), ALT-448 (freshness compute source + next-step field shape), ALT-303 (canonical call logger — AMBIGUOUS-DECISIONS C1), ALT-442 (who-may-associate).

**Decision-queue size: 14 DEC-## (3 × P0, 5 × P1, 6 × P2) + ~9 ALT-level decisions = 23 pending owner calls.**

---

## 5. Launch-blocker rollup (must-fix before internal launch)

Reconciled across `DATA-OPS-LAUNCH-BLOCKERS.md §A`, `UX-AUDIT §8`, `SCHEMA-AUDIT`, `SECURITY-AUDIT`, and the Review-Hub risks. This is the shortlist that, unfixed, makes ~110 users on 100%-migrated data distrust or abandon the tool on day one.

**Decision-gated (need an owner call first):**
1. **Ownership / write-path fix** — agents must edit ASSIGNED not CREATED records. `ALT-152/349/433` · **DEC-03**. *The* blocker. Plan drafted in `docs/LAUNCH-BLOCKER-RLS-PLAN.md` (verdict: sound; apply after throwaway-login validation). Risk: bulk-provisioned logins without a `profiles` row get silently denied (`ALT-371`, RSK-10).
2. **FORCE RLS + close anon grants** on PII tables. `ALT-353` · **DEC-04 / DEC-09**.
3. **Gate the live site** while RLS is off. **DEC-09**.
4. **Status cleanup** (corrupted free-text breaks every report/funnel). `ALT-350/351` · **DEC-05**.
5. **DB-enforced masking** of email/phone. `ALT-173/345` · **DEC-06**.

**Decision-free trust fixes (buildable now; surface what's hidden, stop lying):**
6. **Surface silent truncation** (Meetings 2000-cap etc. — records vanish from list/search/export/counter). `ALT-428`.
7. **Stop rendering load failures as "no data"** + explain hidden bulk buttons. `ALT-435`.
8. **Atomic merge** (fix the non-atomic data-integrity risk) + remove the false "recoverable by admin" promise. `ALT-416 / ALT-432`.
9. **Recycle bin** read+restore (so the false-restore promise becomes true). `ALT-400`.
10. **Companies full per-project status/owner load** (export ships blank status today). `ALT-429`.
11. **Lost-update / concurrency guard** on record writes. `ALT-430`.
12. **Magic-FK address corruption** fix. `ALT-434`.
13. **Bulk-selection safety** (clear on filter change; select-all respects true set). `ALT-436`.
14. **Honest writes** — `humanizeWriteError` on every write surface (no silent RLS failures). `ALT-370` (built).

**From UX-AUDIT §8 "ship with launch" (4 safety items, all addressed above or done):** surface swallowed inline errors (ALT-370/435), confirm destructive actions (ALT-180 ✓), hide create from outreach roles (ALT-215 QW4 ✓ / ALT-174), fix Contacts row cap (ALT-215 QW13 ✓ / ALT-428).

**Launch sequence (from DATA-OPS-LAUNCH-BLOCKERS §G):** trust fixes (428/435/436/437) → atomic merge (416 + 432) → recycle bin (400) → default-sort/pinned-cols (440) → then the DEC-gated items.

---

## 6. Already shipped (don't re-investigate)

From tracker `Status: Done` + recent commits. These are solved — do not re-audit them.

**Foundation & data:** stack locked + clean repo (ALT-001..004), Supabase project + 65-table schema + ~108k-row migration with row-count parity (ALT-005..009), identity sequences reset (ALT-009).

**Auth & security (hardening pass 06-17):** Supabase Auth + auto-onboard trigger + route protection (ALT-011..013); RLS baseline 70/70 tables (ALT-015); hide plaintext-pw column (ALT-016); xlsx CVE fixed → SheetJS (ALT-019); auth-gate admin endpoints (ALT-127), `/notify` relay closed (ALT-128), helmet + body limit (ALT-129), disable public signup (ALT-130), lock permission-table writes (ALT-131), Access RLS v1/v1b/v2 + masking view + project dials (ALT-132..134).

**Core modules (real data):** Leads list/detail/workspace + approval flow (ALT-023..036); Meetings (ALT-037..045); Wishlist + convert-to-lead (ALT-046..050); Companies + Contacts + per-project status model + email-domain link (ALT-064..091); Dashboard stat cards (ALT-111); Admin panel + add-user/reset-pw endpoints (ALT-058..063); Notifications + email service (Gmail SMTP) (ALT-051..057); Settings (ALT-124/125).

**Deploy:** combined Node app live at `crm.altleads.com`, git auto-deploy, email verified (ALT-092..094, ALT-141); `/health` build-stamp (ALT-392).

**QA & UX-audit waves:** QA wave 1+2 fix swarm (ALT-113/114); toast+confirm (179/180), focus ring (181), keyboard rows/headers (182), multi-select facet filters (183), Cmd-K + top-bar search + quick-nav actions (188/272/393), drill-down dashboard (193), ErrorBoundary (196), forgot-password (197), skeletons (200), Approvals SLA/search/in-modal (204), dirty-guard + draft cache (190/219), search-index logout clear (220), modal focus-fix (264), one-click task from record (266), all-projects activity view (268).

**Views & reassign (Wave 2/3):** richer company About (217), inline contact editor (218), reassign lead+meeting+company+contact single+bulk (288/289/290), Grid + Kanban views on all 5 lists (324/325/326), editable Excel grid (331), multi-select in grid/kanban (332), shared ListToolbar (333), preview "open in new tab" (334), call-log in preview (335), owner column on lists (296), ClientsTab/Add-User fixes (297/298).

**Tasks:** My Tasks (Overdue/Today/Upcoming) + per-row done/skip/snooze + create-task modal + IST presets + reminder helper (ALT-250..266).

**Most-recent commits (06-28):** ALT-401 bulk progress+cancel (3d266c7), ALT-414 sticky headers (a80a103), ALT-415 live progress bar + cancel for bulk reassign/add-to-project/set-status, ALT-395 export formula-injection hardening, ALT-394 read-only dup detector (built, not pushed).

---

*End of index. Regenerate the backlog with `node new-code/web/scripts/gen-backlog-tracker.cjs` and the Review Hub with `node new-code/web/scripts/gen-review-tracker.cjs`. If you add a new audit doc, add a row to §1 and fold its distinct findings into §2 (collapsing duplicates) so this stays the one place to look.*
