# Amplior / Altleads CRM — Product Requirements Document (PRD)

> **Purpose:** Define what the rebuilt Amplior CRM must do, for whom, and why — so the owner and any builder share one clear picture of the product before and during the rebuild.

*Last updated: 2026-06-17*

> **How to read this doc:** It is written in plain language for a business owner, with small technical notes in *italics* where they help. Anything not yet confirmed is marked **TBD — confirm with owner**. For the build sequence and dates, see the Roadmap; this PRD describes the *what* and *why*, not the *how/when*.

---

## 1. Product Vision

Amplior CRM is a B2B field-sales CRM that helps a sales team capture leads, run client meetings, and track every deal from first contact to close — on web and on mobile. The rebuilt product gives the business owner full, self-service control of his own system: he can see and edit any data, add users and change roles, and request product changes through a simple conversation instead of paying an outside vendor for every small request. It keeps everything the old system did well (leads, meetings, wishlist, role-based access for six job types) while being faster, cleaner, cheaper to run, and far easier to change.

---

## 2. Problem & Background

The current Amplior/Altleads CRM was built by an outsourced vendor and has become slow, expensive, and frustrating to work with. Three problems forced the decision to rebuild:

1. **Costly, slow change requests.** Even small, routine features are billed at a premium. The clearest example: the vendor quoted **₹96,000 (≈196 working hours)** just to add **7 filters on the Leads screen, 7 filters on Meetings, two Excel exports, and a few editable fields** — work that takes a clean codebase a fraction of that time. Every change means a vendor ticket, a wait, and an invoice.

2. **No self-service control.** The owner cannot see or edit his own data without going through the vendor. The old database had no usable admin interface, and the web app could not even be rebuilt locally because the vendor withheld key configuration files. The owner is effectively locked out of his own product.

3. **A messy, risky legacy system.** *Technical note:* the old stack is a Java Spring Boot backend (Java 8, now end-of-life) with **zero automated tests**, running on a self-managed DigitalOcean server, plus a MySQL database the owner can't easily touch. It also had serious security flaws — **user passwords were stored as plain text** and an encryption key was hard-coded in the source. Maintaining it is slow and fragile.

**The fix:** a clean rebuild on managed, modern services (Supabase for the database, logins, and file storage; a fresh React web app on Netlify; the existing mobile app repaired and re-pointed to the new backend). This puts the owner in control, removes the security flaws, and cuts running costs dramatically. The vendor's prior rebuild attempt is abandoned reference only.

---

## 3. Goals & Non-Goals

### Goals

- **Give the owner self-service control.** He can view/edit data, manage users and roles, and get product changes without a vendor in the loop.
- **Match (then beat) the old system's features** — leads, meetings, wishlist, notifications, role-based access for all six roles — with no loss of capability.
- **Ship the "₹96k" features as standard**: rich filters on Leads and Meetings, plus Excel exports.
- **Migrate the real business data** (~108,000 rows: 605 leads, 610 meetings, 54 wishlist items, 18 active salespeople) with **zero data loss**, not start from a blank system.
- **Slash running cost and operational burden** — no servers to patch or restart, predictable low monthly cost.
- **Fix the security problems** — proper, modern logins; no plain-text passwords; access rules enforced at the database level (RLS on all tables, legacy password column hidden from the API).
- **Keep the old system running in parallel** until the team has tested the new one, then cut over safely.
- **Provide a self-service Companies + Contacts module** so the team can maintain a clean target-company directory and call-disposition log alongside leads.

### Non-Goals (for this rebuild)

- **Not** re-creating the old Java backend or staying on self-managed MySQL/DigitalOcean — those are being retired.
- **Not** migrating the old plain-text passwords. *Each user sets a fresh password at go-live via a one-time email.*
- **Not** a ground-up redesign of business workflows — we rebuild the proven flows, then refine. Net-new features beyond parity are future scope.
- **Not** adding new integrations (new SMS/email providers, third-party CRMs, analytics suites) in this phase unless explicitly requested. Email notifications run via Gmail SMTP on the same server.
- **Not** a public/customer-facing portal — this is an internal sales-team tool.
- **CR Layer 2 (multi-tenant org chart, meetings-centric pivot, Kafka, calendar integrations)** — explicitly deferred to a later phase.

---

## 4. Target Users & Personas

The system serves one sales organization with **six roles**. Access is enforced by role *(technical note: via Row Level Security — rules attached to the database itself, so even a bug in the app cannot leak another person's data)*.

**Two-app split (decided):** The **web app** is for Amplior's internal team (Admin, Team Lead, Agent). The **mobile app** serves the client-side sales team (Sales Head, Sales Person). Sales Person may be given web access later but is gated off in the first release — the web UI is designed with this in mind.

| Role | Who they are | What they mainly need from the CRM |
|---|---|---|
| **ADMIN** | The owner / system administrator (e.g., Mohit) | See **everything**; add/edit/remove users; assign roles; manage projects, clients, and reference lists; edit any data directly. The most powerful role. |
| **SALES_HEAD** | Senior sales leader overseeing the whole sales function | Broad visibility across teams and pipeline; oversight of leads, meetings, and performance; reporting and exports. |
| **TEAM_LEAD** | Manages a team of salespeople | Visibility of their team's leads and meetings; assign/reassign work; monitor progress and stages. |
| **SALES_PERSON** | Field salesperson (a.k.a. "agent" in this data) | See and work **their own** leads; log activity; record meetings and lead reports; update stages. *Note: in this data set "agent" and "salesperson" are effectively the same person; there is no separate "sales person" field.* |
| **AGENT** | Field agent who captures and progresses leads | Same day-to-day needs as a salesperson: own leads, log activity, fill in meeting and report details. |
| **QC** | Quality Control reviewer | Review lead and meeting data for quality/accuracy; visibility across records to verify and flag. |

**Access model (planned):**
- **ADMIN** sees all data.
- **Managers (TEAM_LEAD, SALES_HEAD, QC)** see broadly for now, to be refined to team-scoped views later.
- **AGENT / SALES_PERSON** see only their **own** leads.

*Technical note on ownership:* in the real data, a lead's owner is identified by the **`created_by`** field (18 distinct real salespeople), and the company is identified via **`client_assoc_id`** — not the older `agent_id`/`company_id` columns, which are mostly empty. Access rules use **`created_by`** for ownership.

---

## 5. Scope

### In-Scope modules (this rebuild)

| Module | Summary | Status |
|---|---|---|
| **Login / Authentication** | Secure sign-in for all six roles; one-time password setup at go-live; sessions; route protection. | DONE |
| **Dashboard** | At-a-glance numbers (leads, meetings this week, successful deals) and quick navigation. | DONE |
| **Leads** | The core module. Searchable, filterable, paginated list with multi-select + Excel export; full lead detail with a HubSpot-style workspace (header + info panel + **Activity / Lead Report / Meeting** tabs); add/edit leads; live stage changes. Pick an existing contact when creating a lead. | DONE |
| **Meetings** | List + detail of client meetings (610 records), filters, multi-select + Excel export; linked to their leads; reschedule/cancel with email + in-app notifications. | DONE |
| **Wishlist** | Wishlist / prospect list (54 records). Assign + convert to lead. | DONE |
| **Approvals** | Queue for Team Lead / Admin to approve or reject lead-report requests; email + in-app notification on request / approval / rejection. | DONE |
| **Notifications** | In-app notification feed with live unread-count bell badge (60 s poll). Email + in-app on: meeting scheduled / rescheduled / cancelled, lead assigned / reassigned, approval requested / approved / rejected. Recipient = salesperson for now; owner tunes per-action later. | DONE |
| **Companies** | Directory of 525 target companies; search, filters, export; HubSpot-style detail with contacts-by-city and per-project account status. Dedup on create (clean domain or CIN). | DONE |
| **Contacts** | 607 contacts (migrated from leads); call-disposition log; detail with disposition / status / description / comments. Dedup on create (email → LinkedIn → phone). Link existing contact into a company; change a contact's company. | DONE |
| **Admin Panel** | Manage Users (add + reset-password via secure service-role endpoint), Projects, Clients, reference/lookup lists, and **editable dropdown option lists**; assign roles; ADMIN-only. | DONE |
| **Settings** | Editable profile and password change for the logged-in user. | DONE |

### Per-Project Status Model (key design — all modules)

Three layers of status exist, all **scoped per project**:

1. **Call Disposition** — logged per call/interaction; kept in full activity history. Shown on contact detail and company-contact rows.
2. **Contact Status** — one current status per contact per project. Shown in contact list rows.
3. **Account Status** — one current status per company per project.

The same company or contact can have a different status on Project A vs Project B. Visible and editable by owner + admin only. Full history retained.

**Additional per-project fields on a company/account:** Feasibility (per project), Decision-making power (Centralised / Regional-site-wise / Hybrid), Description, Comments.

**Additional per-project fields on a contact:** Description, Comments.

All dropdown option lists — contact status, account status, call disposition, decision power, feasibility, and others — are **admin-editable** from the Admin panel. Starter values are seeded in the database (`dropdown_option` table).

### Lists everywhere — common behaviours

Every module list supports:
- **Multi-select** (select all / select none) + **bulk export** to Excel.
- **Show/hide and reorder columns** per user.
- **Per-user saved views** — reset to default at any time; old view is kept (not deleted). Default Contacts columns: Name, Company, City, Email, LinkedIn, Phone (mobile + landline stacked), Contact Status, Description, Comments.

Status: PLANNED for per-user saved views across all modules; export and column-toggle partially built.

### Pre-Sales Questions

45 questions exist in the database, grouped by service domain. Currently hidden from the UI. Planned: surface them in the lead workspace, selectable per domain/industry. Status: PLANNED.

### Out-of-Scope / Future (not in this rebuild unless requested)

- **Mobile app polish beyond repair-and-reconnect** — the existing React Native app is repaired and pointed at the new backend; deeper redesign is later.
- **New outbound channels** — email notifications run via Gmail SMTP on the combined Node server. SMS (Twilio) to be confirmed by owner.
- **Advanced reporting/analytics dashboards** beyond the core dashboard numbers and Excel exports.
- **Team-scoped fine-grained permissions** for managers — start broad, refine to team-scope after launch.
- **Full multi-step stage-change workflow** (approval + auto meeting creation) — current stage change is the simple case; full workflow deferred.
- **CR Layer 2**: multi-tenant org chart, calendar integration, Kafka, email campaigns, removing the Leads web screen, multiple TL/SH per project. All deferred to a later phase.
- **AI / semantic search (pgvector)** — planned for a future phase but not started.
- **Third-party CRM / external integrations.**

---

## 6. Key Features by Module

### Login / Authentication (DONE)
- Email + password sign-in for all six roles *(via Supabase Auth — bank-grade, no plain-text passwords).*
- One-time "set your password" email for each user at go-live.
- Each login is auto-linked to the right person and role; protected routes keep signed-out users out.

### Dashboard (DONE)
- Headline metrics from real data (total leads, meetings this week, successful deals).
- Fast entry points into all modules.

### Leads (DONE)
- **List view** with search, **multiple filters** (the "₹96k" filters delivered as standard), **pagination**, and **Excel export**.
- **Multi-select** rows for bulk export.
- **Lead detail** in a HubSpot-style layout: header + right-hand info panel + three workspace tabs:
  - **Activity** — timeline of what's happened on the lead (agents log calls/notes here).
  - **Lead Report** — the structured report agents fill in, including stage history and approval flow.
  - **Meeting** — meetings scoped to this lead (not the user's whole calendar).
- **Add / Edit lead** with proper audit fields and auto-generated lead numbers (`ALT####`). When adding a lead the agent can **pick an existing contact** from a searchable dropdown (saves to `lead_master.contact_id`).
- **Stage changes** — simple case (updates `lead_report.stage_id`); full approval + auto-meeting workflow deferred.
- Approval flow: agent requests approval → TL/Admin sees queue at /approvals → approve (advances stage) or reject (requires reason); email + in-app at each step.

### Meetings (DONE)
- Filterable, paginated list of 610 meetings with **Excel export** and **multi-select**.
- Meeting detail, linked back to its lead.
- **Reschedule / Cancel** — fire email + in-app notification to the salesperson.

### Wishlist (DONE)
- List of 54 wishlist / prospect items. Assign to an agent + convert to a lead.

### Approvals (DONE)
- `/approvals` page, gated to ADMIN / TEAM_LEAD. Shows pending approval requests with approve / reject actions.
- Sidebar badge shows the live pending count.

### Notifications (DONE)
- In-app notification feed; bell icon with live unread count (polls every 60 seconds).
- **Email + in-app fired on:**
  - Meeting scheduled, rescheduled, cancelled.
  - Lead assigned or reassigned.
  - Approval requested, approved, rejected.
- Recipient = the salesperson for each action. Owner can change recipients per action (code has a single clearly-commented TODO spot per action).
- Email is sent via Gmail SMTP from the combined Node server (no third-party email service needed).

### Companies (DONE)
- Directory of 525 target companies with search, industry + city filters, Excel export, pagination.
- HubSpot-style company detail: contacts grouped by city/region; each contact row shows inline Call Disposition, Description, Comments, and LinkedIn link.
- **New company with dedup** — blocks creation if a company with the same cleaned website domain or CIN already exists; surfaces the existing record instead.
- Per-project account fields: Account Status, Feasibility, Decision-making power, Description, Comments (all stored in `company_project_status`).
- Link an existing contact into the company from the company detail page.
- **Associations (HubSpot-style):** a Contacts tab and a **Leads** tab (the latter was previously mislabelled "Deals" — leads *are* our deals). Each tab shows the count; the Leads tab has a **+ New lead** action that opens the lead form pre-filled with this company.

### Contacts (DONE)
- Directory of 607 contacts (migrated from `lead_master`; 417/608 now have a linked company via email-domain sync).
- List with search, status, and company filters; default columns: Name, Company, City, Email, LinkedIn, Phone, Contact Status, Description, Comments.
- Contact detail: full edit of all fields; call & disposition panel that writes to the `interaction` activity log.
- **New contact with dedup** — blocks creation if a contact with the same professional email (or LinkedIn, or phone) already exists. Demo mode skips dedup.
- Change or clear a contact's company from their detail page.
- Per-project contact fields: Contact Status, Description, Comments (stored in `contact_project_status`).
- **Associations (HubSpot-style):** the contact's parent **Company**, its associated **Leads** (linked by `lead_master.contact_id`, plus the originating lead via `source_lead_id`), and **Colleagues** (other contacts at the same company). A **+ New Lead** action opens the lead form pre-filled with this contact and their company.

### Admin Panel (ADMIN only — DONE)
- **Users** — Add User (creates Supabase Auth account + `user_master` row via service-role endpoint). **Set / Reset password**: resolves the user's Auth account by email; if the user has no login yet (true for users migrated from the old system), it **creates the login** with the new password and links the profile so their role-based access works immediately. Shows "Login created" vs "Password reset".
- **Dropdown option lists** — admin can edit the pick-list values for ALL dropdowns: contact status, account status, call disposition, decision power, feasibility, and others. Changes take effect immediately across the app.
- **Pre-Sales Questions** — per-domain question editor (add / edit / enable-disable / delete). Reads & writes `pre_sales_question` (now includes an `is_active` column); writes are admin-only.
- **Reference data** — Designation, Domain, Source are now fully **add + edit**; writes to Domain are admin-only. Industry is read-only.
- **Projects** and **Clients** — create and edit supporting data.

### Settings (DONE)
- Edit own profile; change own password.

---

## 7. Success Metrics

The rebuild is successful when:

1. **Owner self-service works.** The owner can make data and UI/feature changes **without a vendor** — directly (via the database table editor / Admin panel) or by requesting a change that is built and deployed the same day.
2. **Running cost drops sharply.** From the old droplet + managed MySQL + vendor invoices to roughly **$0–$25/month** on managed free/low tiers.
3. **Cutover with zero data loss.** All real data migrated and verified — target met in migration (**65/65 tables matched on row counts, ~108,000 rows**); go-live preserves it.
4. **Feature parity (then better).** Everything the old system did — leads, meetings, wishlist, notifications, six-role access — plus the filters and Excel exports the vendor wanted to charge ₹96k for, all working.
5. **Security fixed.** No plain-text passwords; access enforced at the database level so the app cannot leak data across users/roles.
6. **Confident cutover.** The team runs new + old in parallel, confirms the new system, then retires the old DigitalOcean stack.
7. **Change turnaround.** Routine changes (a new filter, a new export, an editable field) go from *weeks-and-an-invoice* to *hours-or-less, at near-zero cost.*

---

## 8. Assumptions & Dependencies

**Assumptions**
- The team is willing to run the new and old systems in parallel for a short testing period before cutover.
- Each user will set a new password via the one-time email at go-live (old passwords are intentionally not migrated).
- "Agent" and "salesperson" refer to the same field worker; there is no separate "sales person" field in the real data.
- The proven old-system workflows are the spec; we rebuild them faithfully, then refine.
- Existing duplicate contacts/companies are allowed to remain; only **new** duplicates are blocked.

**Hosting & deployment (decided)**
- The app is **ONE combined Node.js server** — the React web app (served as static files) and the email/notify service live in the same Node process. Deployed on **Hostinger**, git auto-deploy from the **AltLeads-CRM** GitHub repo (a new clean repo with fresh history; old vendor code, large design files, and secrets are excluded). Live at **crm.altleads.com**. Email is sent via **Gmail SMTP** (no third-party email provider needed). The same Node server can host additional small backend functions in future.
- **Netlify** was considered but dropped in favour of keeping everything on Hostinger (one host, one bill, no Netlify Functions complexity).
- Production environment variables required on Hostinger: `GMAIL_USER`, `GMAIL_PASS`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

**Security (current state)**
- RLS is **on** for all 70 public tables. Authenticated users have broad access (no per-role fine-grained rules yet). Anonymous access is denied everywhere. Self-promotion (a user raising their own role) is blocked at the policy level.
- Legacy plaintext `password` column on `user_master` is **hidden from the API** (column-level grant REVOKED for anon + authenticated; data kept intact but not readable).
- Fine-grained per-role RLS (agent sees only own leads) and a full IDOR/RLS security audit are **PLANNED** before go-live.

**Dependencies / open items**
- **Accounts & access:** Supabase (`amplior-crm`, Mumbai region), Hostinger, and GitHub (AltLeads-CRM repo) are all set up and live. Migration done (65 tables, ~108k rows).
- **Hostinger env vars:** `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` must be set before the Add User and Reset Password endpoints work in production (currently return 503 without them).
- **Mobile (later phase):** the existing app needs missing files recreated and re-pointing to the new backend; an **iOS build needs a Mac** (owner is on Windows, can borrow one) and Apple/Google Play access.
- **Vendor risk:** the vendor may withhold the Android signing key / app-store access; recovery via Google/Apple support is the fallback.
- **Known data-quality items:** 159 contacts have work-email domains whose company is not in the 525-company directory — candidates to auto-create companies later. 4 orphan-row data bugs from the vendor are logged in `fk-skipped.txt` (nothing deleted).

---

## 9. High-Level Timeline

The build is front-loaded: data migration and core web modules first, then the admin panel, the first deploy, mobile repair, and finally a parallel-run-and-cutover period before retiring the old DigitalOcean system.

➡ **For the detailed phase plan, dates, and current status, see the Roadmap** (and `REBUILD_LOG.md` for the full running history). This PRD intentionally does not duplicate those dates so there is a single source of truth for timing.

---

*Document owner: Amplior (Mohit). Built and maintained with Claude as orchestrator. Plain-language by design — flag anything unclear and it will be revised.*
