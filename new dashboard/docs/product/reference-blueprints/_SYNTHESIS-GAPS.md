# OSS CRM Teardown — Synthesis & Gap Analysis vs AltLeads Backlog

> **Generated:** 2026-06-29 | **Analyst:** Claude Code (Sonnet 4.6)
> **Sources:** SuiteCRM, ERPNext, EspoCRM, Vtiger blueprints (Odoo blueprint is a placeholder — not yet written); AltLeads backlog ALT-001..468; MASTER-FINDINGS-INDEX; CRM-CAPABILITY-CENSUS; OSS-MULTICLIENT-ARCHITECTURE.
> **Purpose:** Single durable reference for "are we on the right track, and what are we missing?" — drives the next wave of backlog additions.

---

## 1. Executive Summary

**Verdict: Yes, AltLeads is on the right track.** The project-scoped multi-tenant model (Postgres RLS gated on `project_id` + `lead_report.user_id`) is strictly more robust than any of the four studied CRMs — all are single-tenant PHP monoliths that filter data in application code rather than at the database. The activity/task split, merge/dedup, import engine, advanced filters, and saved views match or exceed the community-edition feature level of all four systems. The kanban, preview panel, bulk-reassign, and concurrency guard are ahead of Vtiger and SuiteCRM outright.

The gap pattern is consistent across all four CRMs: every one of them has (a) a formal Deals/Opportunity pipeline entity, (b) a no-code custom fields engine, (c) a multi-step workflow/automation engine, and (d) a structured lead-conversion flow. AltLeads has none of these yet — but all four are already on the roadmap (ALT-386, ALT-387, ALT-390, and implied by ALT-386). The studied systems confirm the roadmap priority order is correct.

**Reverse-engineering verdict: Highly worthwhile and feasible.** The four CRMs are poor references for implementation (PHP 5/8 monoliths, MySQL-specific, Smarty templates — none of which map to TypeScript/React/Supabase), but they are excellent references for *what to build* and *the right data-model shapes*. The highest-ROI patterns to extract are: the AOW automation triple-table (SuiteCRM), the metadata-driven custom fields engine (ERPNext/EspoCRM), the Opportunity entity schema (ERPNext + EspoCRM), the lead conversion transaction (all four), the polymorphic entity-link pattern (SuiteCRM/EspoCRM), and the collaborators junction table (EspoCRM). These translate cleanly into Supabase Postgres + React with no framework dependency. Studying these sources has already saved weeks of design work and confirmed several architectural choices.

---

## 2. Cross-CRM Feature Matrix

Legend for AltLeads column: ✅ Have · 🟡 Partial · ❌ Missing. Ticket cited where one exists.

### Domain A — Data Model & Entities

| Capability | SuiteCRM | ERPNext | EspoCRM | Vtiger | **AltLeads** |
|---|---|---|---|---|---|
| Company/Account entity | ✅ | ✅ (Prospect) | ✅ | ✅ | ✅ `company_master` |
| Contact entity | ✅ | ✅ | ✅ | ✅ | ✅ `contact_master` |
| Lead entity (pre-conversion) | ✅ | ✅ | ✅ | ✅ | ✅ `lead_master + lead_report` |
| Lead state per project/client (multi-tenant lead state) | ❌ | ❌ | ❌ | ❌ | ✅ **unique advantage** — `lead_report` scopes status/owner per `project_id` |
| Deals / Opportunity entity (formal pipeline object) | ✅ `opportunities` | ✅ `opportunity` | ✅ `Opportunity` | ✅ `potentials` | ❌ ALT-386 (P0 Backlog) |
| Meeting / Event entity | ✅ | ✅ (Event) | ✅ | ✅ Calendar | ✅ `meeting_master` |
| Task entity | ✅ | ✅ (ToDo) | ✅ | ✅ | ✅ `task` |
| Interaction / Call log | ✅ Calls module | ✅ Communication | ✅ Call | ✅ | ✅ `interaction` |
| Self-referential account hierarchy (parent company) | ✅ `member_accounts` | ❌ | ❌ | ✅ `parentid` | ❌ (no ticket — candidate ALT-469) |
| Contact belongs to multiple companies | ❌ | ❌ (via Dynamic Link) | ✅ `AccountContact` junction | ❌ | ❌ ALT-342 (Planned) |
| Multiple phone/email per contact | ✅ | ✅ | ✅ | ✅ | ❌ ALT-342 (Planned) |
| Soft delete / recycle bin | ✅ `deleted=1` | ❌ | ❌ | ❌ | 🟡 ALT-400 (In Progress) |
| Global entity spine (universal crm entity table) | — | — | — | ✅ `vtiger_crmentity` | 🟡 partial via `lead_report` pattern; no universal spine |
| Audit trail / field-change history | ✅ `*_audit` tables | ✅ `track_changes` | ✅ Stream `Update` notes | ✅ `vtiger_audit` | ❌ ALT-407 (Backlog) |
| UTM / lead attribution fields | ❌ | ✅ utm_source/medium/campaign | ❌ | ❌ | ❌ (no ticket — candidate ALT-470) |
| Qualification status as a distinct field (Unqualified/In Process/Qualified) | ❌ | ✅ `qualification_status` | ❌ | ❌ | ❌ (no ticket — candidate ALT-471) |
| Lost reason multi-select (structured) | ❌ | ✅ `lost_reasons` | ❌ | ❌ | ❌ (no ticket — candidate ALT-472) |
| Competitor tracking | ❌ | ✅ `competitors` | ❌ | ❌ | ❌ (no ticket — candidate ALT-473) |

### Domain B — Lead → Deal Pipeline

| Capability | SuiteCRM | ERPNext | EspoCRM | Vtiger | **AltLeads** |
|---|---|---|---|---|---|
| Formal lead conversion wizard (Lead → Contact + Company + Deal, atomic) | ✅ `convertdefs.php` | ✅ `create_prospect_and_contact()` | ✅ `convertEntityList` | ✅ `ConvertLead_View` | ❌ (no ticket — candidate ALT-474) |
| Sales stage / pipeline stages (configurable) | ✅ | ✅ `Sales Stage` DocType | ✅ probabilityMap | ✅ picklist | ❌ ALT-386 (Backlog) |
| Deal probability (0–100%) | ✅ | ✅ | ✅ auto from stage | ✅ | ❌ ALT-386 |
| Deal close date | ✅ | ✅ | ✅ | ✅ | ❌ ALT-386 |
| Deal value / amount | ✅ multi-currency | ✅ multi-currency | ✅ weighted amount | ✅ | ❌ ALT-386 |
| Pipeline kanban by stage | ❌ (list only) | ✅ | ✅ `kanbanViewMode` | ❌ (funnel widget) | ❌ ALT-386 (depends on Deals entity) |
| Deal → Contact roles (Decision Maker / Influencer / Champion) | ✅ `opportunities_contacts` junction | ❌ | ✅ `AccountContact.role` | ❌ | ❌ (no ticket — candidate ALT-475) |
| Lost deal analysis (stage, reason, competitor) | ✅ | ✅ 9 pre-built reports | ❌ | ✅ | ❌ ALT-405 (Backlog, broader) |
| Auto-close stale opportunities (scheduled) | ❌ | ✅ `auto_close_opportunity` | ❌ | ❌ | ❌ ALT-390 (depends on automation engine) |

### Domain C — Activities / Communication

| Capability | SuiteCRM | ERPNext | EspoCRM | Vtiger | **AltLeads** |
|---|---|---|---|---|---|
| Activity / history split (future vs past by status) | ✅ subpanel defs | ✅ open/all widgets | ✅ `notActualOptions` | ✅ | 🟡 ALT-466 (In Progress) |
| In-record activity hub (interactions + tasks + notes in one panel) | ✅ | ✅ | ✅ | ✅ | 🟡 ALT-466 (In Progress) |
| Polymorphic activity linking (activity → any entity type) | ✅ `parent_type/parent_id` | ✅ `reference_doctype/name` | ✅ `linkParent` | ✅ `seactivityrel` | ❌ ALT-388 (Backlog) |
| Cross-entity timeline (activity on Lead also shows on Company timeline) | ✅ | ✅ `timeline_links` | ✅ `account` auto-derived | ✅ | ❌ ALT-388 (Backlog) |
| Stream / chatter (free-form post + @mention + follow) | ❌ | ✅ Comments | ✅ Stream | ✅ ModComments | ❌ (no ticket — candidate ALT-476) |
| Recurring activities (daily/weekly/monthly rules) | ✅ `repeat_type` etc. | ❌ | ❌ | ✅ `recurringtype` | ❌ (no ticket — candidate ALT-477) |
| Activity reminders (email/popup at N min before) | ✅ | ✅ | ✅ jsonArray reminders | ✅ `SendReminder` | ❌ (no ticket — candidate ALT-478) |
| Attendee acceptance status per meeting (RSVP) | ✅ `accept_status` | ✅ | ✅ per-junction status | ✅ | ❌ (no ticket — candidate ALT-479) |
| Inbound email parsing + auto-link to records | ✅ InboundEmail module | ✅ `email_append_to` | ✅ group mailboxes | ✅ IMAP | ❌ (no ticket — no near-term scope) |
| Full in-app email client (compose + inbox) | ✅ | ✅ | ✅ | ✅ | ❌ (no ticket — out of scope for outreach CRM) |
| Call direction (Inbound / Outbound) | ✅ | ❌ | ✅ | ✅ | 🟡 `interaction` type field covers this partially |
| Reschedule tracking / counter on calls | ✅ `Calls_Reschedule` | ❌ | ❌ | ❌ | ❌ (no ticket — candidate ALT-480) |
| Task auto-complete when action logged | ❌ | ✅ ToDo re-linking | ❌ | ❌ | 🟡 ALT-467 (In Progress) |

### Domain D — Access Control & Multi-Tenancy

| Capability | SuiteCRM | ERPNext | EspoCRM | Vtiger | **AltLeads** |
|---|---|---|---|---|---|
| Hard tenant isolation (DB-enforced, not app-layer) | ❌ | ❌ | ❌ | ❌ | ✅ **unique** — Supabase RLS per `project_id` |
| Role-based module permissions (create/read/edit/delete per module) | ✅ ACLRoles | ✅ DocType permissions | ✅ Roles | ✅ Profiles | ✅ role constants; 🟡 partially enforced |
| Record-level owner scoping (own / team / all) | ✅ `ACL_ALLOW_OWNER` | ✅ User Permissions | ✅ own/team/all/no | ✅ PRIVATE sharing | ✅ `lead_report.user_id` RLS |
| Team-based record grouping | ✅ SecurityGroups | ❌ | ✅ `entityTeam` | ✅ Groups | ❌ (no ticket — not planned) |
| Collaborators / secondary owners (read access without full ownership) | ❌ | ❌ | ✅ `entityCollaborator` | ❌ | 🟡 ALT-343/441 (In Progress) |
| Field-level ACL (hide/read-only individual fields per role) | ✅ Studio field flags | ✅ `permlevel` | ✅ field read/edit per role | ✅ `profile2field` | ❌ ALT-345 (Planned, partial masking) |
| Per-module action toggles (export=yes/no per role) | ✅ | ✅ `export` flag | ✅ | ✅ | 🟡 ALT-347 (Planned) |
| Role-scoped picklist values (different option sets per role) | ❌ | ❌ | ❌ | ✅ `role2picklist` | ❌ (no ticket — candidate ALT-481) |
| Customer-facing portal (external contact login) | ✅ Joomla | ✅ web portal | ✅ portal ACL levels | ✅ | ❌ (no ticket — not in near scope) |
| Optimistic concurrency control | ✅ `optimistic_locking` | ❌ | ✅ per-entity flag | ❌ | ✅ ALT-430 (Done, dark flag) |

### Domain E — Automation / Workflow

| Capability | SuiteCRM | ERPNext | EspoCRM | Vtiger | **AltLeads** |
|---|---|---|---|---|---|
| Event-triggered workflow engine (on save / on create / on modify) | ✅ AOW | ✅ Notification + hooks | ✅ Advanced Pack | ✅ com_vtiger_workflow | ❌ ALT-390 (Backlog) |
| Condition evaluation (field comparisons, AND/OR) | ✅ AOW_Conditions | ✅ Notification conditions | ✅ | ✅ `VTJsonCondition` | ❌ ALT-390 |
| Action types: send email | ✅ | ✅ | ✅ | ✅ | ❌ ALT-390 |
| Action types: create record | ✅ | ❌ | ✅ | ✅ | ❌ ALT-390 |
| Action types: update field | ✅ | ✅ | ✅ | ✅ | ❌ ALT-390 |
| Scheduled (cron-based) workflow trigger | ✅ | ✅ | ✅ | ✅ | ❌ ALT-390 |
| Manual workflow trigger from UI | ❌ | ❌ | ❌ | ✅ | ❌ ALT-390 |
| Workflow run log / audit | ✅ AOW_Processed | ❌ | ✅ | ✅ | ❌ ALT-390 |
| Formula / computed field expressions (admin-configurable) | ✅ `ComputeField` action | ✅ Server Script | ✅ Formula language | ❌ | ❌ (no ticket — candidate ALT-482) |
| Dynamic logic (client-side conditional field show/hide/required) | ❌ | ❌ | ✅ `dynamicLogic` | ❌ | ❌ (no ticket — candidate ALT-483) |
| Approval / blueprint engine (guided stage gate with required fields) | ❌ | ✅ Workflow DocType | ❌ | ❌ | ❌ ALT-426 (Backlog) |
| Stage-transition auto-fill (probability auto-set from stage) | ❌ | ❌ | ✅ probabilityMap | ❌ | ❌ (low effort, in ALT-386 scope) |

### Domain F — Customization / Custom Fields

| Capability | SuiteCRM | ERPNext | EspoCRM | Vtiger | **AltLeads** |
|---|---|---|---|---|---|
| No-code custom field creation (admin UI) | ✅ Studio / DynamicFields | ✅ Customize Form | ✅ Field Manager | ✅ Layout Editor | ❌ ALT-387 (Backlog) |
| Custom field types: text, number, date, select, boolean | ✅ 23 types | ✅ 25+ types | ✅ 20+ types | ✅ 12 types | ❌ ALT-387 |
| Custom field values stored as JSONB (vs schema ALTER) | ❌ (DB column alter) | ❌ (DB column alter) | ❌ (DB column alter) | ❌ (SCF tables) | ❌ (planned JSONB approach — AltLeads will be ahead here) |
| Admin-editable form layout (drag + reorder fields) | ✅ Studio | ✅ Customize Form | ✅ Layout Manager | ✅ Layout Editor | ❌ ALT-447 (Planned) |
| Record types (different layouts + picklists per segment) | ❌ | ❌ | ❌ | ❌ | ❌ ALT-423 (Backlog) |
| Dependent / cascading picklists | ❌ | ❌ | ❌ | 🟡 (role2picklist only) | ❌ ALT-422 (Backlog) |
| Per-project field overrides (hide/required/default per project) | ❌ | 🟡 Property Setter | ❌ | ❌ | ❌ (no ticket — candidate; ERPNext Property Setter pattern) |
| Validation rules (required-when / regex / cross-field) | 🟡 (in Studio) | ✅ `mandatory_depends_on` | 🟡 Formula | ❌ | ❌ ALT-421 (Backlog) |

### Domain G — Import / Dedup / Data Ops

| Capability | SuiteCRM | ERPNext | EspoCRM | Vtiger | **AltLeads** |
|---|---|---|---|---|---|
| CSV import with field mapping | ✅ | ✅ | ✅ | ✅ | 🟡 ALT-376/397/399 (Backlog) |
| Import dry-run / preview | ❌ | ❌ | ❌ | ❌ | ❌ ALT-399 (Backlog) — **ahead of all 4** |
| Import upsert (create-or-update by key) | ✅ | ✅ | ❌ | ✅ | ❌ ALT-397 (Backlog) |
| Import rollback / undo batch | ❌ | ❌ | ❌ | ❌ | ❌ ALT-396/417 (Backlog) — **ahead of all 4** |
| Duplicate detection on import (field-match preview) | ✅ | ✅ | ✅ | ✅ | 🟡 folded in ALT-397/399 |
| Record-ID keyed round-trip export/import | ❌ | ❌ | ❌ | ❌ | ✅ ALT-377 (Done) — **ahead of all 4** |
| Merge duplicates (in-app) | ✅ | ❌ | ❌ | 🟡 | 🟡 ALT-379/416 (In Progress, atomic RPC built) |
| Fuzzy duplicate detection (cross-table) | ❌ | ❌ | ❌ | ❌ | ❌ ALT-439 (Backlog) |
| Recycle bin / restore soft-deleted | ✅ `deleted=1` | ❌ | ❌ | ❌ | 🟡 ALT-378/400 (In Progress) |
| Audit trail on bulk operations | ❌ | ❌ | ❌ | ❌ | ❌ ALT-402 (Backlog) — planned ahead of all 4 |

### Domain H — Reporting / Dashboards

| Capability | SuiteCRM | ERPNext | EspoCRM | Vtiger | **AltLeads** |
|---|---|---|---|---|---|
| No-code report builder (tabular/summary/matrix) | ✅ AOR_Reports | ✅ 9 pre-built + query reports | ❌ (Adv Pack) | ✅ | ❌ ALT-405 (Backlog) |
| Chart types (line/bar/pie/funnel) | ✅ | ✅ | ✅ | ✅ funnel widget | ❌ ALT-406 (Backlog) |
| Scheduled report email delivery | ✅ | ❌ | ❌ | ❌ | ❌ (no ticket) |
| Export to PDF | ✅ | ✅ | ❌ | ✅ | ❌ (no ticket) |
| Per-user configurable dashboard tiles | ✅ Dashlets | ✅ | ✅ | ✅ | ❌ ALT-446 (Backlog) |
| Pipeline / funnel analytics | ✅ | ✅ 9 CRM reports | ✅ | ✅ | ❌ ALT-406 (Backlog) |
| Sales rep performance reports | ✅ | ✅ `lead_owner_efficiency` | ❌ | ✅ | ❌ ALT-405/406 (Backlog) |
| First-response-time SLA tracking | ❌ | ✅ `first_response_time` | ❌ | ❌ | ❌ (no ticket — candidate ALT-484) |
| Territory / segment reporting | ❌ | ✅ Territory + User Perms | ❌ | ✅ | ❌ (out of scope for now) |

### Domain I — UI / UX

| Capability | SuiteCRM | ERPNext | EspoCRM | Vtiger | **AltLeads** |
|---|---|---|---|---|---|
| Advanced filter with save | ✅ Saved Searches | ✅ filter presets | ✅ | ✅ CustomView | ✅ ALT-461 (In Progress) |
| Kanban view | ❌ | ✅ | ✅ | ❌ | ✅ ALT-326 (Done) |
| List / table / grid views | ✅ | ✅ | ✅ | ✅ | ✅ ALT-324/325/331 (Done/Progress) |
| Preview panel (slide-over) | ❌ | ❌ | ❌ | ❌ | ✅ ALT-327/328 (In Progress) — **ahead** |
| Bulk mass-update from list | ✅ | ✅ | ✅ | ✅ | 🟡 ALT-380 (Backlog) |
| Global search (cross-entity) | ✅ unified_search | ✅ `in_global_search` | ❌ | ✅ | ❌ ALT-393 Cmd-K (In Progress, single-entity) |
| Recently viewed records | ✅ `tracker` table | ❌ | ❌ | ❌ | ✅ ALT-451 (Done) — **ahead** |
| Keyboard navigation / shortcuts | ❌ | ❌ | ❌ | ❌ | ✅ ALT-391/374 (In Progress) — **ahead** |
| Command palette (Cmd-K) | ❌ | ❌ | ❌ | ❌ | 🟡 ALT-393 (In Progress) — **ahead** |
| Inline cell edit (editable grid) | ✅ | ✅ | ❌ | ✅ | ✅ ALT-331 (Done) — **ahead of EspoCRM** |
| Admin-configurable list columns | ✅ Studio | ✅ `in_list_view` | ✅ Layout Manager | ✅ | ❌ ALT-445 (Backlog) |
| Quick-create modal (minimal mandatory fields) | ✅ | ✅ | ✅ | ✅ | ❌ (no ticket — candidate ALT-485) |
| `notActualOptions` — hide terminal status from create/edit | ❌ | ❌ | ✅ | ❌ | ❌ (no ticket — easy win, ALT-486) |
| Dark mode | ❌ | ❌ | ❌ | ❌ | ❌ (no ticket) |

### Domain J — Email / Campaign / Outreach

| Capability | SuiteCRM | ERPNext | EspoCRM | Vtiger | **AltLeads** |
|---|---|---|---|---|---|
| Email drip campaign engine (sequence + schedule) | ✅ | ✅ `EmailCampaign` | ✅ MassEmail | ✅ | ❌ (no ticket — out of scope for outreach CRM v1) |
| Suppression / DNC lists (do-not-call/email) | ✅ ProspectLists | ✅ `unsubscribed` | ✅ opt-out | ✅ | 🟡 ALT-409/425/452 (In Progress) |
| Campaign attribution / lead source tracking | ✅ `campaign_id` | ✅ UTM + Campaign | ✅ `leadSource` | ✅ | ❌ ALT-470 (candidate) |
| Bulk outbound email (mass email) | ✅ | ✅ | ✅ | ✅ | ❌ (out of scope) |
| Email template management | ✅ | ✅ | ✅ | ✅ | ❌ (not planned) |

### Domain K — Other / Integrations

| Capability | SuiteCRM | ERPNext | EspoCRM | Vtiger | **AltLeads** |
|---|---|---|---|---|---|
| REST API (auto-generated / full CRUD) | ✅ JSON:API + OAuth2 | ✅ `@frappe.whitelist` | ✅ auto-generated | ✅ | ✅ PostgREST auto-generated — **by default** |
| Document / file attachment storage | ✅ Documents module | ❌ | ✅ attachments | ✅ | ❌ (no ticket — candidate ALT-487) |
| Knowledge base / articles | ❌ | ❌ | ✅ | ✅ FAQ | ❌ (not planned) |
| iCal / Google Calendar sync | ✅ | ❌ | ✅ | ✅ iCal RFC 2445 | ❌ (no ticket) |
| Multi-currency support | ✅ | ✅ | ✅ | ❌ | ❌ (no ticket — candidate ALT-488) |
| Contract management | ❌ | ✅ Contract DocType | ❌ | ✅ | ❌ (out of scope v1) |
| Quotes / Invoices / Products (ERP-lite) | ✅ AOS | ❌ (separate Selling module) | ❌ | ✅ | ❌ (out of scope) |
| Appointment booking (external-facing) | ❌ | ✅ Appointment DocType | ❌ | ❌ | ❌ (no ticket) |
| Webhooks (outbound event triggers) | ❌ | ❌ | ✅ | ❌ | ❌ (no ticket — could be part of ALT-390) |
| Multi-language / i18n | ✅ | ✅ | ✅ | ✅ | ❌ (not planned) |

---

## 3. Confirmed On-Track

The following AltLeads architectural and feature decisions are **validated by all four CRMs**:

1. **Project-scoped RLS as the tenant boundary.** Every studied CRM is single-tenant or uses app-layer WHERE injection. Postgres RLS enforced at the DB layer is strictly more secure. None of the four can do true multi-client CRM without custom middleware. AltLeads's `project_id` model is the right design. (All 4 confirm by gap.)

2. **`lead_report` separation of lead master from per-project state.** ERPNext's Opportunity having a polymorphic `opportunity_from` and separate status per context is the closest analog. AltLeads's approach is more elegant — shared company/contact master, per-project lead state. Proven by ERPNext's Prospect + Opportunity pattern.

3. **Kanban + table + grid as first-class view types.** EspoCRM uses `kanbanViewMode` in entityDefs; ERPNext provides kanban framework-wide. AltLeads having all three already (ALT-324/325/326) puts it at parity or ahead of SuiteCRM and Vtiger.

4. **Advanced filters + saved views.** All four CRMs have this (SuiteCRM Saved Searches, ERPNext filter presets, EspoCRM filterList, Vtiger CustomView). ALT-461 (In Progress) puts AltLeads on track. The Vtiger CustomView approval flow for non-admin views is worth noting for the Sales Portal.

5. **Merge/dedup + recycle bin.** SuiteCRM's `duplicate_merge=true` and `deleted=1` soft-delete are the benchmark. AltLeads has the atomic merge RPC (ALT-416 Done) and recycle bin (ALT-400 In Progress). This is table-stakes and we're building it correctly.

6. **Bulk import with Record-ID round-trip key.** None of the four CRMs have this. ALT-377 (Done) puts AltLeads ahead. The planned import dry-run (ALT-399) is also ahead of all four.

7. **Concurrency guard (optimistic locking).** SuiteCRM and EspoCRM both have `optimistic_locking = true`. ALT-430 implemented this (dark flag) — exactly the right pattern.

8. **Activity/task split from interaction log.** SuiteCRM's History vs. Activities subpanel split and EspoCRM's `notActualOptions` pattern both validate the future/past activity distinction. ALT-466 (in-record activity hub, In Progress) is the right implementation target.

9. **Write-path / agent can only edit assigned records.** ACL_ALLOW_OWNER (SuiteCRM), own-level access (EspoCRM), PRIVATE sharing (Vtiger) all match AltLeads's `lead_report.user_id = auth.uid()` RLS policy. The model is correct.

10. **JSONB custom fields (planned) vs schema ALTER.** All four CRMs do DDL on every admin field-add (either ADD COLUMN or SCF table). AltLeads's planned JSONB approach (`custom_fields jsonb` per entity + `custom_field_definition` metadata table) is cleaner and migration-free. When built, this will be ahead of all four.

---

## 4. GAPS → Proposed New Backlog Items

### Deduplication check

Before proposing new tickets, gaps with existing coverage:
- Deals/Pipeline → ALT-386 (P0 Backlog) ✓
- Custom fields engine → ALT-387 (P1 Backlog) ✓
- Automation workflow → ALT-390 (P2 Backlog) ✓
- Collaborators → ALT-343/441 (P1 In Progress) ✓
- Associations / polymorphic links → ALT-388/442 (P1 Backlog/In Progress) ✓
- Field-level masking → ALT-345 (P2 Planned) ✓
- Per-role access matrix → ALT-347 (P2 Planned) ✓
- Audit trail / change history → ALT-407 (P1 Backlog) ✓
- Report builder → ALT-405 (P1 Backlog) ✓
- Funnel analytics → ALT-406 (P2 Backlog) ✓
- Dashboard tiles → ALT-446 (P2 Backlog) ✓
- Saved views → ALT-461 (P1 In Progress) ✓
- Admin-configurable list columns → ALT-445 (P2 Backlog) ✓
- DNC / suppression → ALT-409/425/452 (in progress) ✓
- Multiple phone/email → ALT-342 (Planned) ✓
- Approval / blueprint engine → ALT-426 (P2 Backlog) ✓
- Dependent picklists → ALT-422 (P2 Backlog) ✓
- Validation rules → ALT-421 (P1 Backlog) ✓
- Record types → ALT-423 (P2 Backlog) ✓
- Tags → ALT-424 (P2 Backlog) ✓

**New gaps not yet ticketed (next free number: ALT-469):**

---

### P1 — Should build in the next wave (high value, feasible, no existing ticket)

**ALT-469 — Parent company / account hierarchy**
- **Scope:** Add `parent_company_id` (nullable FK, self-ref) to `company_master`. Render hierarchy breadcrumb on company detail + "Subsidiaries" panel. Enable filter-by-parent in list views.
- **Evidence:** SuiteCRM `member_accounts`, Vtiger `parentid` self-ref. Critical for enterprise accounts with subsidiary contacts across multiple departments.
- **Effort:** M (1 migration + UI panel)
- **Priority:** P1

**ALT-470 — UTM / lead attribution fields**
- **Scope:** Add `utm_source`, `utm_medium`, `utm_campaign` columns to `lead_master`. Populate on import (map column). Show in lead detail + filter. Enables "which outreach campaign produced this lead" analytics.
- **Evidence:** ERPNext carries UTM through Lead → Opportunity → Customer; full attribution funnel.
- **Effort:** S (1 migration + import mapping + detail display)
- **Priority:** P1

**ALT-471 — Qualification status as a distinct field**
- **Scope:** Add `qualification_status` enum (Unqualified / In Process / Qualified) + `qualified_by` (FK profiles) + `qualified_on` (timestamp) to `lead_report`. Surface in QC role view. Separate from the main `status` field.
- **Evidence:** ERPNext `qualification_status` + `qualified_by` + `qualified_on` on Lead — the audit trail of who qualified when is essential for QC accountability.
- **Effort:** S (1 migration + form fields)
- **Priority:** P1

**ALT-472 — Lost reason multi-select (structured)**
- **Scope:** `lost_reason` lookup table (id, label, is_active). `lead_lost_reason` junction (lead_report_id, lost_reason_id). When status → Lost/Dead/DNC, require at least one reason. Display in filters + analytics.
- **Evidence:** ERPNext mandatory `lost_reasons` on Opportunity status=Lost. Transforms vague "Lost" data into signal. P1 for HungerBox where loss patterns matter for calibration.
- **Effort:** M (2 tables + UI modal on status change)
- **Priority:** P1

**ALT-474 — Lead conversion flow (Lead → Company + Contact + Deal)**
- **Scope:** A "Convert Lead" action on a `lead_master` record. Single atomic Postgres function `convert_lead(lead_id, company_id_or_new, contact_id_or_new, create_deal bool)`. Optionally pre-creates Company and Contact from lead data (mapping declared in code). Sets lead status to Converted. Returns the new entity IDs. Depends on ALT-386 (Deals) being built first.
- **Evidence:** All four CRMs have this as a first-class UI action — the canonical "lead qualified, move to pipeline" moment. SuiteCRM `convertdefs.php`, ERPNext `create_prospect_and_contact()`, EspoCRM `convertEntityList`, Vtiger `ConvertLead_View`.
- **Effort:** M (server function + wizard UI — can start after ALT-386)
- **Priority:** P1 (depends on ALT-386)

**ALT-476 — Stream / chatter on records (free-form post + @mention)**
- **Scope:** A `stream_note` table (record_type, record_id, author_id, content, created_at, mention_ids[]). Stream panel on company/contact/lead detail views. @mention triggers in-app notification to the mentioned user. Users can "follow" a record (get notified of new stream posts).
- **Evidence:** EspoCRM Stream (all stream-enabled entities), ERPNext Comments + CRM Notes with `@mention`, Vtiger ModComments. All four treat this as core collaboration infrastructure. Currently AltLeads has no free-form discussion layer — agents post in interaction notes which are logged as calls.
- **Effort:** M (table + UI component + notification hook)
- **Priority:** P1

---

### P2 — Next quarter (valuable but not launch-blocking)

**ALT-473 — Competitor tracking**
- **Scope:** `competitor` lookup table (id, name, website). `lead_competitor` junction (lead_report_id, competitor_id, notes). Tag leads with incumbents. Filter by competitor in list views. Report: lost deals grouped by competitor.
- **Evidence:** ERPNext `Competitor` DocType + `competitors` Table MultiSelect on Opportunity. Useful for outreach teams to know which vendor they're displacing.
- **Effort:** S (2 tables + tag chip UI)
- **Priority:** P2

**ALT-475 — Deal–Contact roles (Decision Maker / Influencer / Champion)**
- **Scope:** When Deals is built (ALT-386), the `deal_contact` junction should carry a `role` column (enum: Decision Maker / Economic Buyer / Champion / Influencer / End User / Other). Render contact-role chips on deal detail view.
- **Evidence:** SuiteCRM `opportunities_contacts` junction with `contact_role`. EspoCRM `AccountContact.role`. Best practice for multi-stakeholder enterprise deals.
- **Effort:** S (depends on ALT-386 junction design)
- **Priority:** P2

**ALT-477 — Recurring activity rules**
- **Scope:** On meeting/task creation, allow setting a recurrence rule (RRULE: daily / weekly / N times / until date). Store as an `rrule` text column. A Postgres function or pg_cron job expands occurrences into the next N instances. Link instances to a `recurrence_series_id`.
- **Evidence:** SuiteCRM `repeat_type/interval/dow/until/count`, Vtiger `recurringtype`. Needed for weekly check-in meetings and recurring follow-up tasks.
- **Effort:** L (RRULE parsing + expansion job)
- **Priority:** P2

**ALT-478 — Activity reminders (email / in-app push at N min before)**
- **Scope:** `reminder` table (entity_type, entity_id, remind_at timestamp, type: email/in-app, user_id). pg_cron job scans `remind_at <= now()` and dispatches notifications via notify-service. UI: reminder time picker on meeting/task edit.
- **Evidence:** SuiteCRM `reminder_time/email_reminder_time`, EspoCRM `reminders` jsonArray, Vtiger `SendReminder.bat`. Core productivity feature; without reminders agents miss scheduled follow-ups.
- **Effort:** M (table + pg_cron + notify-service endpoint)
- **Priority:** P2

**ALT-479 — Attendee RSVP / acceptance status on meetings**
- **Scope:** `meeting_attendee` table (meeting_id, user_id OR contact_id, acceptance_status: None/Accepted/Tentative/Declined). Display acceptance badges on meeting detail. Optional: email-based accept/decline link.
- **Evidence:** SuiteCRM per-user `accept_status` on `calls_users/meetings_users`, EspoCRM `MeetingUser.status`, Vtiger `cntactivityrel`.
- **Effort:** M (table + UI badge)
- **Priority:** P2

**ALT-480 — Reschedule counter on calls/interactions**
- **Scope:** `interaction` table gets `reschedule_count int DEFAULT 0` + `rescheduled_from_id` (nullable FK self-ref). When logging a call that was rescheduled, agent increments counter. Filter/sort by reschedule count. Alert if count > N.
- **Evidence:** SuiteCRM `Calls_Reschedule` module with `reschedule_count` + history. Useful for identifying leads that keep postponing.
- **Effort:** S (2 columns + UI toggle)
- **Priority:** P2

**ALT-481 — Role-scoped picklist values**
- **Scope:** `picklist_role_value` table (picklist_key, value, allowed_roles[]). When rendering a select field, filter options by the current user's role. Agents might see a subset of call-outcome values vs TLs who see all.
- **Evidence:** Vtiger `vtiger_role2picklist` — the only one of the four to implement this; useful for keeping agent dropdowns clean.
- **Effort:** M (table + form rendering logic)
- **Priority:** P2

**ALT-484 — First response time / SLA tracking on leads**
- **Scope:** `lead_report` gets `first_contact_at` timestamp (auto-set on first interaction log). `sla_target_hours` per project (in project settings). Computed `sla_breach bool`. Filter by breached SLA. Report: average first-response time per agent.
- **Evidence:** ERPNext `first_response_time` (Duration, read-only) on Opportunity + `first_response_time_for_opportunity` report. Useful for QC role and TL oversight.
- **Effort:** S–M (trigger on first interaction insert + derived column + report)
- **Priority:** P2

---

### P3 — Future / later

**ALT-482 — Admin-configurable formula / computed fields**
- **Scope:** Admin UI to define a formula expression (e.g. `{amount} * {probability} / 100`) for a custom field. Evaluated server-side on save via a Postgres GENERATED ALWAYS AS column or Edge Function. Requires ALT-387 (custom fields) first.
- **Evidence:** SuiteCRM `ComputeField` AOW action, EspoCRM Formula language, ERPNext Server Script. Medium-ROI; most AltLeads calculations can be done in the React layer for now.
- **Effort:** L
- **Priority:** P3

**ALT-483 — Dynamic logic (conditional field show/hide/required)**
- **Scope:** Per entity, define rules in metadata: `if qualification_status == 'Qualified' then show lost_reason`. Evaluated client-side by the form renderer reading `dynamicLogic` config from the metadata table. Requires ALT-387 first.
- **Evidence:** EspoCRM `dynamicLogic` in entityDefs. Needed for complex conditional qualifying forms (e.g. HungerBox pre-qual questions).
- **Effort:** M (metadata schema + form renderer extension)
- **Priority:** P3

**ALT-485 — Quick-create modal (minimal required fields only)**
- **Scope:** A lightweight modal triggered from any list view header or Cmd-K. Shows only mandatory fields. Creates the record and stays on current page. SuiteCRM QuickCreate, ERPNext Quick Create, Vtiger QuickCreateAjax.
- **Evidence:** All four CRMs implement this. Common UX pattern that reduces context switching.
- **Effort:** S–M
- **Priority:** P3

**ALT-486 — `notActualOptions` for terminal status values**
- **Scope:** Mark status values like `Converted`, `Dead`, `DNC` as `notActualOptions` — they appear in existing record displays and filters but are NOT selectable in the create/edit status dropdown (unless set by automation). Prevents agents accidentally converting or killing leads manually without intent.
- **Evidence:** EspoCRM's `notActualOptions` in status enum metadata. Easy win for UX cleanliness.
- **Effort:** S (metadata flag + form render filter)
- **Priority:** P3

**ALT-487 — File / document attachment storage**
- **Scope:** Supabase Storage bucket for CRM file attachments. `attachment` table (entity_type, entity_id, storage_path, filename, mime_type, size, uploaded_by). Render file list in record detail. Download via signed URL.
- **Evidence:** SuiteCRM Documents module + Notes double as attachments, EspoCRM `attachmentMultiple` field type, Vtiger `senotesrel`. Basic file attachment is table-stakes for any CRM.
- **Effort:** M (Supabase Storage + table + UI component)
- **Priority:** P3

**ALT-488 — Multi-currency support (single base currency + FX rates)**
- **Scope:** `currency` lookup table (code, name, symbol, fx_rate_to_inr). Deal amounts stored in native + base currency. Simple daily FX rate update (manual or API). Relevant when deals/pipeline (ALT-386) involves international client billing.
- **Evidence:** SuiteCRM `amount + amount_usdollar + currency_id`, ERPNext `opportunity_amount + conversion_rate + base_opportunity_amount`. Required once Deals entity exists and international clients are onboarded.
- **Effort:** M (depends on ALT-386)
- **Priority:** P3

---

## 5. Recommended Build Order

Dependencies and logical sequencing:

```
PHASE 1 — Foundation for everything else (now / next sprint)
  ALT-386  Deals entity (P0) ← anchors Sales Portal + pipeline + conversion
  ALT-387  Custom fields engine (P1) ← unblocks ALT-482, 483, per-project field config
  ALT-471  Qualification status field (P1, S effort) ← 1 migration, immediate QC value
  ALT-472  Lost reason structured capture (P1, M effort) ← requires status change trigger
  ALT-470  UTM attribution fields (P1, S effort) ← 1 migration, import-time map

PHASE 2 — After Deals is live
  ALT-474  Lead conversion flow (P1, depends on ALT-386)
  ALT-475  Deal-contact roles (P2, depends on ALT-386)
  ALT-488  Multi-currency (P3, depends on ALT-386)

PHASE 3 — Collaboration + Communication layer
  ALT-476  Stream / chatter on records (P1)
  ALT-478  Activity reminders (P2)
  ALT-479  Meeting RSVP / acceptance status (P2)
  ALT-480  Reschedule counter on calls (P2)

PHASE 4 — Automation (after ALT-390 engine ships)
  ALT-390  Workflow / automation engine (P2, existing ticket)
  ALT-484  SLA / first-response tracking (P2, can use pg_cron from automation)
  ALT-482  Admin formula fields (P3, depends on ALT-387)
  ALT-483  Dynamic logic (P3, depends on ALT-387)

PHASE 5 — UX polish + Admin power
  ALT-469  Account hierarchy (P1)
  ALT-473  Competitor tracking (P2)
  ALT-481  Role-scoped picklist values (P2)
  ALT-485  Quick-create modal (P3)
  ALT-486  notActualOptions for terminal status (P3, easy win, can ship earlier)
  ALT-487  File attachments (P3)
  ALT-477  Recurring activities (P2, L effort — after phases 1-3 stable)
```

**Key dependency chain:** ALT-386 (Deals) → ALT-474 (Conversion) → ALT-475 (Deal Roles) → ALT-488 (Multi-currency). Custom fields (ALT-387) is the other critical path enabler — once shipped it unblocks per-client field customization, dynamic logic, and admin formula expressions.

---

## 6. Reverse-Engineering Playbook

The 6 highest-ROI patterns to translate from the studied CRMs into AltLeads's TS/React/Supabase stack:

### 1. Automation Triple-Table (SuiteCRM AOW → Supabase)
SuiteCRM's AOW pattern: `aow_workflow` (trigger definition) + `aow_conditions[]` + `aow_actions[]` + `aow_processed[]` (run log).

**AltLeads translation:**
```sql
-- trigger: which module, when, active?
automation_workflow (id, name, entity_type, trigger_event enum('on_insert','on_update','on_delete','on_schedule'), schedule_cron text, status, conditions jsonb, created_by)

-- action: what to do (ordered)
automation_action (id, workflow_id, action_type enum('set_field','send_email','create_task','notify_user','call_webhook'), params jsonb, sort_order)

-- run log: audit + dedup
automation_run (id, workflow_id, entity_id, triggered_at, status enum('ok','error'), error_msg)
```
Trigger mechanism: Supabase Database Webhook (or pg_trigger on `after insert or update`) calls an Edge Function that evaluates `conditions jsonb` against the record and dispatches `automation_action` rows. The Edge Function runs in the Supabase infra — no extra server needed.

### 2. Custom Fields Engine (ERPNext Custom Field → JSONB)
ERPNext issues `ALTER TABLE ADD COLUMN` for every admin-added field. AltLeads avoids DDL entirely:

```sql
-- metadata registry
custom_field_definition (id, entity_type, field_key, field_label, field_type, options jsonb, insert_after, is_required, default_value, visible_roles text[])

-- values (already-existing column on each entity table)
ALTER TABLE lead_master    ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}';
ALTER TABLE company_master ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}';
ALTER TABLE contact_master ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}';
```

React form reads `custom_field_definition WHERE entity_type = 'lead_master'` at page mount, renders extra inputs after the standard fields, saves/reads via `custom_fields->>'field_key'`. Searchable via `custom_fields @> '{"field_key": "value"}'` (GIN index). This is strictly cleaner than all four CRMs' approach.

### 3. Lead Conversion as a Postgres Transaction (all 4 CRMs → single RPC)
SuiteCRM uses a PHP transaction. ERPNext uses a Python function. The Supabase equivalent:

```sql
CREATE OR REPLACE FUNCTION convert_lead(
  p_lead_master_id uuid,
  p_company_id uuid,      -- NULL = create new from lead data
  p_contact_id uuid,      -- NULL = create new from lead data
  p_create_deal bool DEFAULT false,
  p_project_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
-- 1. Upsert company if p_company_id IS NULL
-- 2. Upsert contact if p_contact_id IS NULL  
-- 3. Update lead_report SET status = 'Converted', converted_at = now()
-- 4. If p_create_deal: INSERT INTO deal (company_id, contact_id, project_id, lead_source_id)
-- 5. Return { company_id, contact_id, deal_id }
$$;
```

Single network call from React. All-or-nothing atomicity via Postgres transaction. Zero risk of half-conversion on network failure.

### 4. Polymorphic Entity Link (SuiteCRM parent_type/parent_id → Supabase)
SuiteCRM links activities to any module via `parent_type varchar + parent_id uuid`. Supabase doesn't have polymorphic FK natively, but the pattern is clean:

```sql
-- Replace per-entity columns on interaction table with:
ALTER TABLE interaction ADD COLUMN entity_type text;   -- 'lead_report' | 'company_master' | 'contact_master' | 'deal'
ALTER TABLE interaction ADD COLUMN entity_id uuid;

-- RLS: entity must be accessible to the user (check via a function)
-- Index: (entity_type, entity_id) for fast timeline queries
CREATE INDEX ON interaction(entity_type, entity_id);
```

This single change makes interactions appear on Company, Contact, Deal, and Lead timelines simultaneously — the ERPNext `timeline_links` pattern.

### 5. EspoCRM ACL Levels → Supabase RLS Shapes
EspoCRM's `own/team/all` levels map to RLS policy shapes:

```sql
-- own: record is assigned to the current user
CREATE POLICY agent_own ON lead_report FOR ALL USING (user_id = auth.uid());

-- team: current user is in the same project (AltLeads project ≈ Espo team)
CREATE POLICY team_lead_team ON lead_report FOR SELECT USING (
  project_id IN (SELECT project_id FROM project_member WHERE user_id = auth.uid())
);

-- all: admin sees everything (already implemented)
CREATE POLICY admin_all ON lead_report FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 1
);
```

For field-level masking (EspoCRM `field read: no` per role), use a Postgres VIEW that masks columns for lower roles rather than RLS (column masking via CASE WHEN role < threshold THEN '***' ELSE col END), exposed via PostgREST view.

### 6. Vtiger Lead Conversion Field Mapping → Declarative Config
Vtiger's `getConvertLeadMappedField()` maps Lead fields to Account/Contact fields at conversion time. In AltLeads, declare this as a config object rather than hardcode:

```typescript
// In a shared config file (not DB — rarely changes)
const LEAD_CONVERSION_MAP = {
  company_master: {
    name:     (lead) => lead.company_name ?? lead.contact_name,
    industry: (lead) => lead.industry,
    website:  (lead) => lead.website,
  },
  contact_master: {
    first_name: (lead) => lead.first_name,
    last_name:  (lead) => lead.last_name,
    email:      (lead) => lead.email,
    mobile:     (lead) => lead.mobile,
  },
  deal: {
    name:     (lead) => `Deal — ${lead.company_name}`,
    stage:    () => 'Prospecting',
    owner_id: (lead) => lead.user_id,
  }
};
```

The conversion wizard pre-fills these fields from the lead, lets the agent confirm/edit, then calls `convert_lead()` RPC. Completely maintainable without code deployment (just edit the config object).

---

*End of synthesis. Next action: add ALT-469 through ALT-488 to `gen-backlog-tracker.cjs` and regenerate the tracker. Priority sequence: ALT-386 first (gating dependency), then ALT-471 and ALT-470 (S-effort quick wins), then ALT-472 (P1 M-effort).*
