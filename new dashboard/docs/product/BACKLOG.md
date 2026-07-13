# Product Backlog — Amplior / Altleads CRM Rebuild

*Purpose: the single prioritized to-do list for the CRM rebuild — what's done, what's in progress, and what's left — organized by module so the owner can see the whole picture at a glance.*

*Last updated 2026-06-17*

> **This is a living draft; reconcile flow details with USER-STORIES-AND-FLOWS.md after owner review.** Where this backlog and the user-stories doc disagree on how a screen should behave, the user-stories doc wins (it is the reviewed spec). This file tracks *work and priority*; that file tracks *exact behaviour*.

---

## How to read this

Each section below is an **Epic** — a big chunk of work, usually one product module plus a few cross-cutting epics (Foundation, Auth, Deploy, Design). Under each epic is a table of **work items** (user stories / tasks).

**Priority** — how important / how soon:

| Tag | Meaning |
|---|---|
| **P0** | Must-have to go live. Blocks launch. |
| **P1** | Important. Needed for a complete, trustworthy product (target before cutover). |
| **P2** | Should-have. Improves the product; can land shortly after launch. |
| **P3** | Nice-to-have / later. Won't block anything. |

**Status** — where it stands today:

| Tag | Meaning |
|---|---|
| **Done** | Built and verified (per REBUILD_LOG). |
| **In Progress** | Actively being worked right now. |
| **To Do** | Planned, scoped, not started. |
| **Backlog** | Known and wanted, not yet scheduled. |

**Plain-language note:** "RLS" = the database's own access rules (who can see which rows). "Module" = a section of the app (Leads, Meetings, etc.). "P0" items are the ones that genuinely stop us launching.

---

## Snapshot — where we are today (2026-06-17)

- **Data migration: DONE.** All 65 tables and ~108,000 rows copied into Supabase, row counts matched. Production was never touched (we worked off a fork).
- **Login & roles: DONE.** Supabase Auth works; the 6 roles are live; route protection is on.
- **App is LIVE at crm.altleads.com** — deployed on Hostinger as one combined Node app (React web + email service). Email delivery verified.
- **All core modules DONE on real data:** Leads (workspace with 3 tabs + approval flow), Meetings, Wishlist, Dashboard, Notifications (email + in-app), Approvals, Companies, Contacts, Admin (add user + reset password + dropdown editor), Settings.
- **RLS baseline ON** — 70 tables enabled, authenticated broad access, anon denied, self-promote blocked. Fine-grained per-role rules are the next security step.
- **Legacy password column HIDDEN** from the API (column-level grant revoked).
- **In progress now (Wave B onwards):** Admin dropdown management UI, per-project status model (contact_project_status / company_project_status tables created), Contact list with multi-select + saved views + status column, Contact detail full edit, Company detail account fields, security audit.
- **Biggest gates before go-live:** fine-grained RLS (per-role, per-lead ownership), IDOR/RLS audit, Hostinger env vars for add-user/reset-password endpoints.

---

## EPIC 1 — Foundation & Data Migration

*Standing up the new platform and moving real data into it.*

| ID | Item | Priority | Status | Notes |
|---|---|---|---|---|
| F-01 | Decide & lock the tech stack (Supabase + React/Vite/Tailwind + Netlify + repaired RN) | P0 | Done | Owner-approved 2026-06-11. No Java, no MySQL, no droplet. |
| F-02 | Create new Supabase project (`amplior-crm`, Mumbai region) | P0 | Done | IDs/keys stored in `.credentials/`. |
| F-03 | Recreate full schema in Supabase | P0 | Done | Turned out to be 65 tables (vendor added 21 audit tables post-Jan). Drift captured in `new-code/migration/schema-drift.sql`. |
| F-04 | Copy all production data into Supabase | P0 | Done | ~108,000 rows; 65/65 tables row-count match. Worked off a DO fork; production untouched. |
| F-05 | Apply foreign keys | P1 | Done | 60/64 applied; 4 skipped because of orphan rows = pre-existing vendor data bugs (nothing deleted, logged in `fk-skipped.txt`). |
| F-06 | Wire web app to real Supabase data | P0 | Done | `src/data/realLeads.ts` does the joins; app reads live data. |
| F-07 | Clean up dead/placeholder code | P2 | To Do | Remove unused `src/data/mockLeads.ts` and `src/pages/PlaceholderPage.tsx`. |
| F-08 | Decide on and delete the DO fork (or keep) | P2 | Done | Decision: keep fork running — owner has ~$19k DO credits to Nov, billing is a non-issue. |
| F-09 | Fix the 4 orphan-row data bugs at source | P3 | Backlog | Optional clean-up of legacy data quality; not blocking. |

---

## EPIC 2 — Auth & Security

*Logins, roles, and the database access rules that keep one salesperson's data private from another.*

| ID | Item | Priority | Status | Notes |
|---|---|---|---|---|
| A-01 | Supabase Auth login | P0 | Done | Verified: mohit@amplior.com → role ADMIN. |
| A-02 | Link auth users → user records + roles (`profiles` table + auto-onboard trigger) | P0 | Done | Trigger `on_auth_user_created` matches by email. |
| A-03 | Route protection (block pages when logged out / wrong role) | P0 | Done | Live. Admin nav gated to ADMIN. |
| A-04 | Decision: don't migrate old plaintext passwords | P0 | Done | At go-live each user gets a one-time "set your password" email. |
| A-05 | **RLS baseline — enable RLS on all tables, block anon, block self-promote** | **P0** | **Done** | 70/70 tables enabled; authenticated full access on 68; profiles SELECT-only; anon denied; self-promote blocked. Verified adversarially. SQL: `new-code/migration/rls-policies.sql`. |
| A-06 | **Fine-grained per-role RLS** (agent sees only own leads; AGENT/SP filter by `created_by`) | **P0** | **To Do** | HARD GATE before go-live. Must confirm ownership model across all modules. |
| A-07 | **Full IDOR/RLS security audit** — confirm no cross-user data leak in any module | P0 | Planned | Planned as a dedicated sub-agent security pass before cutover. |
| A-08 | Hide legacy plaintext `password` column from API | P0 | Done | Column-level REVOKE on `user_master` + `user_master_audit` for anon + authenticated. Script: `new-code/migration/hide-password-column.js`. Data intact. |
| A-09 | Refine manager access to true team-scope | P2 | Backlog | Start with managers-see-all; tighten to team-scope after launch. |
| A-10 | Send one-time password-set emails to all real users at go-live | P0 | To Do | Part of cutover. Email service is live; add a batch-send script. |
| A-11 | Rotate / prune leftover secrets & DB firewall IPs | P1 | To Do | Prune the ~14 individual firewall IPs (likely old vendor devs) at cutover, not before. |

---

## EPIC 3 — Leads

*The core module: the lead list, filters, exports, and the lead detail workspace where agents do their work.*

| ID | Item | Priority | Status | Notes |
|---|---|---|---|---|
| L-01 | Leads list page on real data | P0 | Done | 605 leads. |
| L-02 | The 7 Leads filters (the vendor's ₹96k CR scope) | P0 | Done | Built in as standard. "Sales Person" filter dropped — no such field in vendor schema (agent == salesperson). |
| L-03 | Excel export of Leads | P0 | Done | Part of the ₹96k CR scope. |
| L-04 | Pagination on Leads list | P0 | Done | Added after owner review flagged it missing. |
| L-05 | Add Lead (`/leads/new`) | P0 | Done | Generates next `ALT####` lead number; writes audit fields. |
| L-06 | Edit Lead (`/leads/:id/edit`) | P0 | Done | Was broken at first owner review; since fixed. |
| L-07 | Lead Detail page (header, all fields, clickable contacts, related meetings, stage history) | P0 | Done | `/leads/:id`. |
| L-08 | Fix data accuracy (companies/agents showing blank or "only 2 agents") | P0 | Done | Root cause found: joins used wrong columns. Correct: company = `client_association.client_name` via `client_assoc_id`; owner = `created_by`; project via `project_id`. Now 18 owners, 0 null companies. |
| L-09 | Simple stage change on a lead | P1 | Done | Updates `lead_report.stage_id`. Simple case only. |
| L-10 | **Lead workspace: HubSpot-style 3 tabs (Activity / Lead Report / Meeting) + right info panel** | **P0** | **Done** | `src/components/lead/` + `src/data/leadWorkspace.ts`. Meeting tab scoped to current lead (not user's whole calendar). |
| L-11 | **Approval flow** (request → TL queue → approve/reject with notifications) | **P0** | **Done** | `/approvals` page + sidebar badge + ReportTab inline actions + email+in-app at each step. Stage IDs verified vs `stage_master`. |
| L-12 | **Pick existing contact when creating a lead** | P1 | Done | `SearchSelect.tsx` combobox on Lead form; saves `lead_master.contact_id` (new column added). |
| L-13 | Full stage-change workflow (full approval + auto meeting creation) | P2 | Backlog | Current stage change is simple case only. Full workflow with auto-meeting creation is deferred. |
| L-14 | Fix inline "create new company" placeholder values | P1 | To Do | Creating a company inline writes placeholder values into required columns (address/country/domain/industry) — needs refinement. |
| L-15 | Multi-select + bulk export on Leads | P1 | Done | Already included in Leads list. |
| L-16 | Per-user saved views on Leads (show/hide + reorder columns) | P2 | Planned | `user_view_pref` table exists; UI not yet built. |

---

## EPIC 4 — Meetings

*Scheduling, viewing, and managing field-sales meetings.*

| ID | Item | Priority | Status | Notes |
|---|---|---|---|---|
| M-01 | Meetings list on real data | P0 | Done | 610 rows. |
| M-02 | Meeting detail page | P0 | Done | |
| M-03 | The 7 Meetings filters (CR scope) | P0 | Done | Built to FRS-parity. |
| M-04 | Excel export of Meetings | P0 | Done | Multi-select + export. |
| M-05 | Create / schedule a meeting | P1 | Done | Linked to lead. |
| M-06 | Reschedule / cancel a meeting | P1 | Done | `UpdateMeetingModal.tsx` fires email + in-app on reschedule/cancel. |
| M-07 | Email + in-app notification on meeting scheduled / rescheduled / cancelled | P0 | Done | Fires to the salesperson via Gmail SMTP. |
| M-08 | Meeting status workflow (QC review) | P1 | To Do | QC role interaction with meetings not yet specified. Reconcile with user-stories + QC role definition. |
| M-09 | Per-user saved views on Meetings | P2 | Planned | `user_view_pref` table exists; UI not yet built. |
| M-10 | Calendar / day view of meetings | P3 | Backlog | Nice-to-have. |

---

## EPIC 5 — Wishlist

*The list of prospect companies the team wants to pursue.*

| ID | Item | Priority | Status | Notes |
|---|---|---|---|---|
| W-01 | Wishlist list on real data | P1 | Done | 54 rows. Filters, export, pagination. |
| W-02 | Add to wishlist | P1 | Done | |
| W-03 | Edit / assign wishlist item | P1 | Done | Assign notification fires email + in-app. |
| W-04 | Convert wishlist item → lead | P1 | Done | `convertWishlistToLead` in `wishlist.ts`; shared `insertLeadWithUniqueNumber` helper. |
| W-05 | Per-user saved views on Wishlist | P2 | Planned | `user_view_pref` table exists; UI not yet built. |

---

## EPIC 6 — Dashboard

*The home screen — key numbers and a quick read on activity.*

| ID | Item | Priority | Status | Notes |
|---|---|---|---|---|
| D-01 | Dashboard on real data (lead/meeting counts) | P1 | Done | Real stats: 604 leads, meetings this week, 333 successful. |
| D-02 | Role-aware dashboard (admin vs agent see different numbers) | P1 | To Do | Numbers should respect RLS / role once A-05 lands. |
| D-03 | Charts / trends (pipeline by stage, conversions over time) | P2 | Backlog | Confirm against Figma "New UI" frames. |
| D-04 | Date-range / project filters on dashboard | P2 | Backlog | |
| D-05 | Team-performance / leaderboard view (for managers) | P3 | Backlog | |

---

## EPIC 7 — Notifications

*Telling agents and managers when something needs their attention.*

| ID | Item | Priority | Status | Notes |
|---|---|---|---|---|
| N-01 | In-app notifications list on real data | P1 | Done | Reads `in_app_notification`. |
| N-02 | Email + in-app on meeting scheduled / rescheduled / cancelled | P0 | Done | Via Gmail SMTP on Hostinger Node server. |
| N-03 | Email + in-app on lead assigned / reassigned | P0 | Done | `createLead`/`updateLead` + wishlist assign all wired. |
| N-04 | Email + in-app on approval requested / approved / rejected | P0 | Done | Fires at each step of the approval flow. |
| N-05 | Live unread-count bell badge in sidebar | P1 | Done | Polls `fetchUnreadNotifCount` every 60 s. |
| N-06 | Tune notification recipients per action | P2 | Planned | Currently recipient = salesperson. Each action has a single TODO-commented spot in code. Owner to specify who should receive each event. |
| N-07 | Mark-as-read / unread state | P2 | To Do | `is_seen` column exists; read-state reconciliation on NotificationsPage not yet built. |
| N-08 | Confirm whether SMS (Twilio) is actually used | P2 | Backlog | Owner to confirm. |
| N-09 | Notification preferences (per-user opt in/out) | P3 | Backlog | |

---

## EPIC 8 — Admin

*Where the owner manages users, roles, projects, clients, and reference data without a developer.*

| ID | Item | Priority | Status | Notes |
|---|---|---|---|---|
| AD-01 | Admin panel built, ADMIN-gated | P1 | Done | Tabs: Users / Projects / Clients / Reference. Real edits work. |
| AD-02 | **Add User** (secure service-role backend endpoint) | P0 | Done | `POST /api/users/create` in notify-service. Creates `user_master` row, `user_role`, and Supabase Auth account. Temp password returned to admin. Verified end-to-end locally. **Needs `SUPABASE_SERVICE_ROLE_KEY` env var on Hostinger to work in production.** |
| AD-03 | **Reset any user's password** (admin action) | P1 | Done | `POST /api/users/reset-password` → `auth.admin.updateUserById`. Same env-var dependency. |
| AD-04 | **Admin-editable dropdown option lists** | P1 | In Progress | `dropdown_option` table seeded with starter values (contact_status ×6, call_disposition ×8, account_status ×7, decision_power ×3, feasibility ×3). UI management screen: Planned (Wave B). |
| AD-05 | Manage roles / change a user's role | P1 | To Do | Confirm role change updates `profiles` + takes effect immediately. |
| AD-06 | Manage projects | P1 | Done | |
| AD-07 | Manage clients / companies | P1 | Done | |
| AD-08 | Manage reference / lookup data (designations, stages, etc.) | P2 | Done | "Reference" tab. |
| AD-09 | Match Admin panel to Figma "Admin Panal" page (35 frames) | P2 | Done | Admin design pass applied; Figma admin frames could not be exported (rate-limit) so styled from design system. |
| AD-10 | Access-management / permissions screen | P2 | Backlog | Reconcile with FRS + role model. |
| AD-11 | Audit log view (who changed what) | P3 | Backlog | Vendor added 21 audit tables — surface if useful. |

---

## EPIC 9 — Settings

*Each user's own profile and password.*

| ID | Item | Priority | Status | Notes |
|---|---|---|---|---|
| S-01 | Editable profile | P2 | Done | |
| S-02 | Change password | P1 | Done | Via Supabase Auth. |
| S-03 | Notification preferences | P3 | Backlog | Overlaps N-07. |
| S-04 | Theme / display preferences | P3 | Backlog | |

---

## EPIC 10 — Mobile (React Native)

*Repair the existing field app and point it at the new backend.*

| ID | Item | Priority | Status | Notes |
|---|---|---|---|---|
| MO-01 | Recreate the 2 missing config files (`environment_urls`, `httpMethod`) | P1 | To Do | Vendor withheld them; app can't build without them. |
| MO-02 | Rewire mobile app to Supabase (new backend) | P1 | To Do | App is API-driven (RN 0.78, ~57 files). |
| MO-03 | New Android signing keystore | P1 | To Do | Release keystore not in repo. Fine for a new listing; existing Play listing needs vendor key or Google reset. |
| MO-04 | iOS build via GitHub Actions macOS runner (owner on Windows) | P1 | To Do | Owner can also borrow a 2020 MacBook. |
| MO-05 | Apple Developer + Google Play access | P1 | To Do | Vendor may ghost (unpaid invoice) — plan an Apple/Google support recovery route. |
| MO-06 | Test mobile against new backend + RLS | P1 | Backlog | After web is stable. |
| MO-07 | Match mobile to Figma "Mobile UI" (23 frames) | P2 | Backlog | Phase 6 design pass. |

---

## EPIC 11 — Hosting, Deploy & Cutover

*Going live safely, then retiring the old system.*

| ID | Item | Priority | Status | Notes |
|---|---|---|---|---|
| C-01 | **Combined Node app** (web + email service in one process) | **P0** | **Done** | Root `package.json` + `server.js` → `new-code/notify-service/server.js`. Node 22.x on Hostinger. |
| C-02 | **Live deploy on Hostinger at crm.altleads.com** | **P0** | **Done** | Git auto-deploy from AltLeads-CRM GitHub repo. HTTP 200, /health OK, email delivery verified. |
| C-03 | Set Hostinger env vars for add-user / reset-password | P0 | To Do | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` must be added to Hostinger for admin endpoints to work in production. |
| C-04 | Fine-grained RLS (per-role, agent sees own data) | P0 | Planned | Hard gate before go-live. |
| C-05 | Full IDOR/RLS security audit | P0 | Planned | Sub-agent audit pass before cutover. |
| C-06 | Send go-live password-set emails to all users | P0 | To Do | Batch-send script needed. Email service is live. |
| C-07 | Parallel run — team uses new + old together | P0 | To Do | 1–2 weeks owner-led. |
| C-08 | Cutover — switch fully to new system | P0 | Backlog | After parallel run passes. |
| C-09 | Prune DB firewall IPs | P1 | To Do | At cutover (~14 IPs, likely old vendor devs). |
| C-10 | Retire DigitalOcean (droplet + MySQL) | P1 | Backlog | After cutover is confirmed stable. |

---

## EPIC 12 — Design Polish

*Making the app match the agreed Figma design, not just function correctly.*

| ID | Item | Priority | Status | Notes |
|---|---|---|---|---|
| DP-01 | Set base UI style (Attio/Linear-style: light, Inter font, white sidebar, compact tables) | P1 | Done | Done after "AI generated" feedback. |
| DP-02 | Export Figma frames as reference PNGs | P1 | Done | Web (29) + mobile (23) exported. Admin (35) hit Figma API rate limit (~73h quota); blocked ~3 days. |
| DP-03 | Apply brand design system (blue #1A7EE8 palette, tokens, primitives) | P1 | Done | `index.css` tokens, Sidebar/TopBar/AppShell/LoginPage/Badge restyle; indigo → blue swept across ~30 files. `docs/DESIGN-SYSTEM.md` written. |
| DP-04 | Design-match pass: web app vs Figma "New UI" (29 frames) | P1 | Done | Split login, lead-detail stepper, leads avatars, breadcrumbs, Meetings/Wishlist/Settings/Notifications unified. |
| DP-05 | Design-match pass: Admin panel | P2 | Done | Admin vertical sub-nav, Figma tables, role chips, toggles. Styled from design system (Figma admin frames unavailable due to rate limit). |
| DP-06 | Design-match pass: Mobile vs Figma "Mobile UI" (23 frames) | P2 | Backlog | Phase 6. |
| DP-07 | AltLeads bear-head logo SVG asset | P2 | To Do | Currently "AltLeads" wordmark only. Owner to provide the bear-head SVG or extract from Figma zip. |
| DP-08 | Empty states, loading states, error states polish | P2 | Backlog | |
| DP-09 | Accessibility & responsive check | P3 | Backlog | |

---

## EPIC 13 — Companies & Contacts

*The HubSpot-style target-company and contact directory with call-disposition logging.*

| ID | Item | Priority | Status | Notes |
|---|---|---|---|---|
| CC-01 | `contact_master` table + migrate all contacts from `lead_master` | P0 | Done | 607 contacts migrated; 130 initially company-linked. |
| CC-02 | `company_master.domain_clean` + `is_demo` columns | P0 | Done | 525 companies updated. |
| CC-03 | Email-domain sync: link contacts to companies by work-email domain | P1 | Done | 286 contacts linked (417/608 total now have `company_id`). Script: `new-code/migration/backfill-apply.js`. |
| CC-04 | `interaction` table for call-disposition / activity log | P1 | Done | RLS on. |
| CC-05 | Companies list page (search, industry + city filters, export, pagination) | P1 | Done | 525 companies. |
| CC-06 | Company detail page (contacts by city, project selector, deals tab) | P1 | Done | HubSpot layout. Contacts-by-city + per-project account fields. |
| CC-07 | New company with dedup (clean domain OR CIN) | P1 | Done | Surfaces existing record if match found; blocks duplicate. |
| CC-08 | Link existing contact into a company | P1 | Done | "Link existing contact" modal on company detail → sets `contact.company_id`. |
| CC-09 | Contacts list page (search, status + company filters, export, pagination) | P1 | Done | 607 contacts. Default columns per spec. |
| CC-10 | Contact detail full edit | P1 | Done | All fields editable; call & disposition panel writes to `interaction`. |
| CC-11 | Change / clear a contact's company | P1 | Done | Pencil icon on contact detail → `updateContactCompany` in `contacts.ts`. |
| CC-12 | New contact with dedup (email → LinkedIn → phone) | P1 | Done | Demo mode skips dedup. |
| CC-13 | Per-project contact status / description / comments on contact detail | P1 | In Progress | `contact_project_status` table created; UI display + edit planned (Wave C). |
| CC-14 | Per-project account status / feasibility / decision power / desc / comments on company detail | P1 | In Progress | `company_project_status` table created; UI planned (Wave E). |
| CC-15 | Per-project ownership (company_project_owner table + assign UI) | P2 | Planned | Companies currently show "Unassigned". |
| CC-16 | Masked visibility (names + city visible to all; contact details to owner + downline only) | P2 | Planned | Depends on per-project ownership + `user_master.manager_id` hierarchy column. |
| CC-17 | Per-user saved views on Contacts and Companies | P2 | Planned | `user_view_pref` table exists; UI not yet built. |
| CC-18 | Auto-create companies for the 159 contacts with unmatched work domains | P3 | Backlog | 159 contacts have work-email domains not in the 525-company list. |

---

## EPIC 14 — Per-Project Status Model

*Three-layer status (call disposition / contact status / account status) all scoped per project, with full history.*

| ID | Item | Priority | Status | Notes |
|---|---|---|---|---|
| PS-01 | `dropdown_option` table + seed starter values | P0 | Done | contact_status ×6, call_disposition ×8, account_status ×7, decision_power ×3, feasibility ×3. SQL: `new-code/migration/feature-status-schema.sql`. |
| PS-02 | `contact_project_status` table (unique contact + project) | P0 | Done | Stores contact status, description, comments per project. RLS on. |
| PS-03 | `company_project_status` table (account status, is_feasible, decision_power, desc, comments) | P0 | Done | Per project per company. RLS on. |
| PS-04 | `user_view_pref` table (per-user column layouts) | P1 | Done | Schema only; UI not built. |
| PS-05 | Admin UI to edit dropdown option lists | P1 | Planned | Wave B. Admins can add/edit/reorder options for all dropdowns from the Admin panel. |
| PS-06 | Surface pre-sales questions in lead workspace (per domain/industry) | P2 | Planned | 45 questions exist in `pre_sales_question`, grouped by `domain_master`. Currently hidden. Wave B/C. |
| PS-07 | Call Disposition UI in Contact detail + Company contact rows | P1 | Done | Writes to `interaction` table. |
| PS-08 | Contact Status column in Contacts list | P1 | Planned | Wave C. |
| PS-09 | Account Status + feasibility + decision power fields on Company detail | P1 | Planned | Wave E. |

---

## EPIC 15 — Security Hardening

*Tightening access controls before go-live.*

| ID | Item | Priority | Status | Notes |
|---|---|---|---|---|
| SH-01 | RLS baseline on all 70 tables | P0 | Done | See A-05. |
| SH-02 | Hide legacy password column from API | P0 | Done | See A-08. |
| SH-03 | Fine-grained per-role RLS (agent sees own leads via `created_by`) | P0 | Planned | Hard gate before go-live. |
| SH-04 | Full IDOR/RLS audit (sub-agent pass, all modules) | P0 | Planned | Confirm no cross-user data leak. |
| SH-05 | Privilege-escalation test: confirm user cannot raise own role | P0 | Done | Verified: `profiles.role` update returns 0 rows for self. |

---

## EPIC 16 — AI / Semantic Search (Future Phase)

*pgvector embeddings for search and intelligence over the activity log and records.*

| ID | Item | Priority | Status | Notes |
|---|---|---|---|---|
| AI-01 | Design AI/pgvector plan (sub-agent) | P3 | Backlog | Owner wants semantic search / RAG over activity log and records. Detailed design deferred to after web go-live. |
| AI-02 | Enable pgvector extension in Supabase | P3 | Backlog | Depends on AI-01 plan. |
| AI-03 | Embed and index interaction/activity logs | P3 | Backlog | Depends on AI-02. |

---

## EPIC 13 — Specification & Documentation

*Building from authoritative user stories instead of reverse-engineering messy old code.*

| ID | Item | Priority | Status | Notes |
|---|---|---|---|---|
| DOC-01 | Write USER-STORIES-AND-FLOWS.md from FRS + old code + CR doc | P0 | In Progress | Being written under workflow wf_7a4a706c-3ef (tags: confirmed / inferred / gap + owner open-questions list). |
| DOC-02 | Owner reviews user-stories doc & answers the "gap" questions | P0 | To Do | Don't make owner write from scratch — Claude drafts, owner reviews. |
| DOC-03 | Reconcile this backlog against the reviewed user-stories doc | P1 | To Do | Re-prioritize / add items once flows are confirmed. |
| DOC-04 | Keep REBUILD_LOG.md session log up to date | P1 | Done (ongoing) | Append every session. |
| DOC-05 | This Product Backlog (BACKLOG.md) | P1 | In Progress | This file. Living draft. |

---

## Top of the queue (the short list)

As of 2026-06-17, the app is live at crm.altleads.com. The next priorities in order:

1. **Set Hostinger env vars** (C-03) — `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — so Add User and Reset Password work in production.
2. **Admin dropdown management UI** (AD-04 / PS-05) — Wave B, so admins can edit all pick-lists from the Admin panel.
3. **Pre-sales questions** (PS-06) — surface in lead workspace per domain (Wave B/C).
4. **Contact list + saved views** (CC-09 / PS-08 / CC-17) — multi-select, status column, show/hide columns, per-user saved views (Wave C).
5. **Contact detail full per-project fields** (CC-13 / PS-08) — status, description, comments with history (Wave C/D).
6. **Company detail account fields** (CC-14 / PS-09) — account status, feasibility, decision power (Wave E).
7. **Fine-grained RLS** (SH-03) + **IDOR security audit** (SH-04) — hard gate before final go-live.
8. **Mobile repair** (Epic 10), then **parallel run** (C-07), then **cutover & retire DigitalOcean** (C-08/C-10).

---

*Anything marked "TBD" or "confirm" needs an owner decision or a check against USER-STORIES-AND-FLOWS.md / the FRS before it's locked. Nothing in this file should be treated as a final spec on its own.*
