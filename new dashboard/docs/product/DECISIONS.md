# Decision Log — Amplior / Altleads CRM Rebuild

*Purpose: A running record of the important architecture and product decisions on the rebuild — what we chose, why, what we rejected, and whether the decision still stands. So nobody re-litigates a settled question, and a future developer understands the "why".*

*Last updated 2026-06-19*

---

## How to read this

Each decision is a short block in the same shape ("ADR" = Architecture Decision Record):

- **Context** — the situation that forced a choice.
- **Decision** — what we picked.
- **Why** — the reasoning, in plain terms.
- **Alternatives considered** — what we rejected, and why.
- **Status** — *Accepted* (in force), *Superseded* (replaced by a newer decision), or *Proposed* (not yet locked).

The numbering (ADR-01, ADR-02 …) is just an index; it is not a priority order.

---

## ADR-01 — Use Supabase instead of a self-managed MySQL-on-DigitalOcean database

- **Context:** The old system ran MySQL on a DigitalOcean droplet that someone had to SSH into, patch, restart, and firewall by hand. There was no usable interface for the owner to view or fix data; every change meant a vendor ticket and a bill.
- **Decision:** Move the database, authentication and file storage to **Supabase** (managed PostgreSQL).
- **Why:** **Manageability** — servers become "someone else's problem" (Supabase patches and runs them). The owner can **view and edit data himself** through Supabase's spreadsheet-like Table Editor, with no developer in the loop. Every table also gets a secure auto-generated API, removing most of the old hand-written backend.
- **Alternatives considered:** Keep self-managed MySQL on DigitalOcean (rejected — ongoing maintenance burden, no owner-facing tooling, vendor dependency). A different managed DB without the built-in Auth/Storage/API bundle (rejected — Supabase gives all three together).
- **Status:** Accepted.

---

## ADR-02 — Use Supabase Auth instead of the homemade JWT login

- **Context:** The old backend stored passwords in **plain text** (`NoOpPasswordEncoder`), hardcoded an AES key in source, and rolled its own JWT login. This is a serious security hole.
- **Decision:** Use **Supabase Auth** for all logins. Do **not** migrate the old plaintext passwords; at go-live each user receives a one-time email to set a new password.
- **Why:** Supabase Auth gives **bank-grade password hashing and session handling** out of the box and removes the plaintext-password problem entirely. Building auth ourselves would repeat the vendor's mistakes. A trigger links `auth.users` to the existing `user_master` records by email, so users keep their roles. Verified working: admin login resolves to role ADMIN.
- **Alternatives considered:** Re-implement custom JWT auth (rejected — reinventing a solved, security-sensitive problem). Migrate the old password hashes (impossible/unsafe — they were plaintext, not hashes).
- **Status:** Accepted.

---

## ADR-03 — Build the web app on React + Vite + TypeScript (+ Tailwind + shadcn-style UI)

- **Context:** The old web app was React 19 but unbuildable (a required `environment_urls` file was withheld by the vendor) and contained unmaintainable files (one component was 3,767 lines). We needed a clean, modern, owner-friendly front end.
- **Decision:** Rebuild the web app with **React + Vite + TypeScript**, styled with **Tailwind** and a **shadcn-style** UI kit. Hosted on Netlify.
- **Why:** This is a fast, modern, widely-supported stack. **TypeScript** catches errors early; **Vite** gives quick builds; **Tailwind + shadcn** give a consistent, professional look without a heavy design system. It keeps server logic minimal (Supabase direct + a few Netlify Functions).
- **Alternatives considered:** Salvage the old React 19 code (rejected — won't build, and the code quality is poor). A heavier framework / different bundler (rejected — unnecessary complexity for this app's size).
- **Status:** Accepted.

---

## ADR-04 — Use TanStack Table instead of paid AG Grid Enterprise

- **Context:** The data grids (Leads, Meetings) need sorting, filtering and the 7+7 filters from the vendor's ₹96k change request, plus Excel export. The old approach leaned toward AG Grid Enterprise, which is a **paid license**.
- **Decision:** Use **TanStack Table** for all data tables.
- **Why:** TanStack Table is **free and open-source**, fully capable of the required filtering/sorting, and avoids a recurring license cost. The "expensive" CR features (filters + Excel export) are trivial to build in a clean codebase.
- **Alternatives considered:** **AG Grid Enterprise** (rejected — license cost for features we can get free). AG Grid Community (rejected — TanStack chosen for flexibility and zero license risk; see Risk R-10).
- **Status:** Accepted.

---

## ADR-05 — Host on Hostinger (ONE combined Node app), not Netlify

- **Context:** We want simple, all-in-one hosting wired to the code repository. The app needs both a static web front-end and a small server (email/notify service, admin API endpoints). Initially Netlify was planned for the front-end.
- **Decision:** Deploy as **one combined Node.js process** on **Hostinger** — the React web app is served as static files and the email/notify API runs in the same process. Git auto-deploy from the **AltLeads-CRM** GitHub repo. Live at **crm.altleads.com**. Email via **Gmail SMTP** (no third-party email provider). The same server can host more small backend functions in future.
- **Why:** Netlify Functions add complexity and cost for what is essentially a simple server. Keeping everything on Hostinger means one host, one bill, no deployment split. Gmail SMTP is free and already available. The combined-server pattern also makes it easy to add future backend logic (password reset, batch jobs, webhooks) without changing hosts.
- **Alternatives considered:** Netlify (static front-end) + separate server for the email service (rejected — two deploys, two environments, more complexity). Netlify Functions (rejected — harder to debug, edge-function constraints). A traditional VPS (rejected — management burden).
- **Status:** Accepted. DONE — live at crm.altleads.com, /health OK, email delivery verified.

---

## ADR-06 — Migrate the real production data, via a database fork, without touching production

- **Context:** A fresh-start empty system would lose years of real data (~108k rows: 605 leads, 610 meetings, etc.). But pulling data directly from the **live** production DB risks disrupting the running business.
- **Decision:** **Migrate the real data**, but do it by **forking** the DigitalOcean cluster, locking the fork's firewall to one PC, copying fork → Supabase, verifying row counts, and leaving production **completely untouched**.
- **Why:** Real data is essential for a usable CRM and for honest testing. The **fork approach guarantees production is never touched** during migration. Result: 65/65 tables matched on row count; foreign keys 60/64 applied (4 skipped only because of pre-existing orphan rows = vendor data bugs, nothing deleted).
- **Alternatives considered:** Fresh start with empty tables (rejected — loses real history). Copy directly from the live DB (rejected — risk to the running business). The schema turned out to be **65 tables, not the documented 47** (vendor drift), captured in `schema-drift.sql`.
- **Status:** Accepted.

---

## ADR-07 — Keep the old DigitalOcean system running in parallel until cutover

- **Context:** Switching a live sales team to a brand-new system overnight is risky if anything is wrong or missing.
- **Decision:** **Keep the old system running in parallel** with the new one. The team uses both during a parallel-run period; only after the new system is tested and trusted do we **cut over** and then retire DigitalOcean.
- **Why:** Safety. The business keeps a working fallback while the new system is validated against real daily use. No data or workflow is lost if a gap is found late.
- **Alternatives considered:** Hard cutover with no overlap (rejected — too risky for a live business). The old DB firewall has ~14 individual IPs (likely vendor devs) — these are pruned **at cutover, not before** (one may be the owner's office).
- **Status:** Accepted.

---

## ADR-08 — Repair the existing React Native mobile app rather than rebuild it

- **Context:** A mobile app already exists (React Native 0.78, ~57 files, API-driven). It can't build because two files were withheld (`environment_urls`, `httpMethod`), and the release keystore isn't in the repo.
- **Decision:** **Repair** the existing React Native app — recreate the missing files and re-point it at the new Supabase backend — rather than rebuild the mobile app from scratch.
- **Why:** The app's structure is reusable; recreating two small missing files and rewiring the backend is far less work than a full mobile rebuild. iOS builds will run via a **GitHub Actions macOS runner** (the owner is on Windows). This is **Phase 6**, after the web app.
- **Alternatives considered:** Rebuild mobile from scratch (rejected — unnecessary effort given the existing app is largely intact). Note dependency: store publishing depends on resolving the keystore/store-access risk (Risk R-01).
- **Status:** Accepted.

---

## ADR-09 — Map lead ownership to `created_by` and company to `client_association` (not `agent_id` / `company_id`)

- **Context:** The first Leads build joined on the "obvious" columns `agent_id` and `company_id` — and showed blank companies and "only 2 agents", because those columns are mostly empty in the real data.
- **Decision:** Treat **lead owner/agent = `lead_master.created_by`** (18 real salespeople) and **company = `client_association.client_name` via `client_assoc_id`** (populated for all 605 leads). Project = `lead_master.project_id`. The RLS ownership rule will use **`created_by`**.
- **Why:** Verified by direct database queries: `agent_id` is null for 476 leads (only 2 distinct values), while `created_by` holds the real 18 owners; `company_id` is null for 477 leads, while `client_assoc_id` is populated for all. This mapping is what makes the data display correctly (e.g. lead 2211 = AP Securitas / Mansi Rajak). Lookups are paged with `.range()` to beat PostgREST's 1000-row cap.
- **Alternatives considered:** Use the named-but-empty `agent_id` / `company_id` columns (rejected — they are mostly null; this was the original bug). This is the standing data-mapping rule for **all** modules and for the RLS plan (see Risk R-04).
- **Status:** Accepted.

---

## ADR-10 — Work as an orchestrator with cheap sub-agents

- **Context:** The owner is **non-technical** and the build is large, with a model-cost/time constraint (Fable sunset 2026-06-22). Doing every task on the most expensive model would be slow and costly.
- **Decision:** Use an **orchestrator + sub-agent** model: the main session plans and decides; **sub-agents on cheaper models (Sonnet/Haiku)** do the heavy lifting — scanning, bulk coding, repetitive work. The owner is shown anything destructive before it happens, and everything is explained in plain language.
- **Why:** **Cost and speed.** Cheap sub-agents handle the bulk work in parallel (e.g. one workflow built 6 modules across 8 agents); the expensive model is reserved for planning and hard decisions. Keeps the owner in control without requiring technical skill. After the Fable sunset: Opus 4.8 for hard parts, Sonnet 4.6 as the daily driver.
- **Alternatives considered:** Do everything in the main, top-tier model (rejected — slower and far more expensive). Hand work to the original vendor (rejected — the whole point of the rebuild is to escape that dependency).
- **Status:** Accepted.

---

## ADR-11 — Web app is for Amplior internal team; mobile app is for client sales team (two-app split)

- **Context:** The old system blurred the line between Amplior's internal staff (who manage leads and meetings) and the client-side field sales team (who capture wishlist prospects and report back). Both groups needed access, but their roles and UIs are different.
- **Decision:** **Web app** = Amplior internal team (Admin, Team Lead, Agent). **Mobile app** = client sales team (Sales Head, Sales Person). Sales Person *may* be given web access later but is gated off in the first release. The web UI is designed with this future extension in mind.
- **Why:** Keeps each app clean for its primary audience. The web UI is more complex (approval flows, admin tools) and doesn't need to be optimised for field use. The mobile app is designed for speed in the field.
- **Alternatives considered:** One unified web + mobile experience (rejected — different UX needs; the FRS already designed two separate apps). Give Sales Person web access from day one (deferred — not needed for first release, reduces scope risk).
- **Status:** Accepted.

---

## ADR-12 — First-rebuild scope = FRS parity + CR Layer 1; CR Layer 2 is deferred

- **Context:** The vendor's change-request documents had two layers: Layer 1 (small additions: filters, exports, editable settings — already mostly built) and Layer 2 (major re-architecture: multi-tenant org chart, Companies + Contacts modules as a replacement for the Leads screen, multiple TL/SH per project, calendar integration, Kafka). Layer 2 would effectively replace the current product.
- **Decision:** **First rebuild = FRS parity + Layer 1 CR only.** CR Layer 2 is **explicitly deferred** to a later phase. Companies + Contacts modules *are* being built now (owner requested) but as an **additive** module alongside Leads, not as a replacement.
- **Why:** Layer 2 is a completely different product vision. Trying to build both at once would delay the go-live indefinitely and risk getting nothing done. It's better to ship a complete, reliable FRS-parity product first and layer on the bigger vision after.
- **Alternatives considered:** Build Layer 2 now (rejected — too big, delays go-live). Abandon Layer 2 entirely (rejected — owner wants it eventually, just not as the first delivery).
- **Status:** Accepted.

---

## ADR-13 — Dedup rules: existing duplicates allowed; only new duplicates blocked

- **Context:** The migration brought 607 contacts and 525 companies with some existing duplicates already in the data. Cleaning all existing duplicates retroactively is risky and time-consuming.
- **Decision:** **Allow existing duplicates to remain.** Only **new** duplicates are blocked. Dedup keys: Contact = professional email → else cleaned LinkedIn URL → else phone. Company = cleaned website domain → else CIN (caveat: one company can have multiple CINs). On a match: surface the existing record (with its per-project owner) and block the new create.
- **Why:** Retroactive dedup can destroy valid data. The more important goal is stopping new junk from entering. The business can clean up historical duplicates manually over time.
- **Alternatives considered:** Full retroactive dedup on migration (rejected — risky, time-consuming, owner didn't request it). No dedup at all (rejected — data quality would degrade quickly).
- **Status:** Accepted.

---

## ADR-14 — Email via Gmail SMTP, not a third-party provider

- **Context:** Meeting assignment, approval, and lead notifications need outbound email. Options explored included Resend, SendGrid, and the owner's own SMTP.
- **Decision:** Use **Gmail SMTP** (from `amplior.ankits@gmail.com`) running on the same Hostinger Node server as the app. No third-party email service.
- **Why:** Free, already available, no API keys to manage, no monthly email limit to worry about at current volumes. Verified working: real email delivered on the first smoke test.
- **Alternatives considered:** Resend (free 3k/mo, then paid; rejected — unnecessary cost and another API key to manage). SendGrid (rejected — same). Self-hosted SMTP (rejected — maintenance burden).
- **Status:** Accepted. DONE — verified working in production.

---

## ADR-15 — Admin user management via a service-role backend endpoint, not direct Supabase client calls

- **Context:** Creating a new Supabase Auth user, or resetting a user's password, requires the Supabase **service-role key** (which has full admin access). This key must never be exposed to the browser.
- **Decision:** Implement `POST /api/users/create` and `POST /api/users/reset-password` as **server-side endpoints** in the combined Node app, using the `@supabase/supabase-js` client with the service-role key. The browser sends the request to these endpoints (which check that the caller is ADMIN), and the server does the Supabase auth operation.
- **Why:** The service-role key cannot safely be exposed to the browser (it bypasses all RLS). The server is the right place to hold it and act on it. This is the same pattern Supabase recommends for admin operations.
- **Alternatives considered:** Use the Supabase Management API directly from the browser (rejected — exposes the service-role key). Build a separate admin microservice (rejected — unnecessary; the existing Node server is the right place).
- **Status:** Accepted. DONE — verified end-to-end locally; needs env vars set on Hostinger for production.

---

## ADR-16 — Hide legacy plaintext password column instead of dropping it

- **Context:** `user_master.password` holds plaintext passwords from the old system. The Supabase security advisor flagged it as a sensitive-column exposure risk. Options: DROP the column (destroys the data), or HIDE it from the API.
- **Decision:** **HIDE** the column via Postgres column-level grants: REVOKE SELECT/INSERT/UPDATE on `user_master.password` (and `user_master_audit.password`) from both `anon` and `authenticated` roles. The data is kept intact but not queryable from the app or the API.
- **Why:** Dropping a column in production is a one-way, potentially risky operation. Hiding it via grants is reversible if the data is ever needed for reference (e.g. validating a migration). The app never used the column for login anyway (Supabase Auth handles all logins).
- **Alternatives considered:** DROP the column (rejected — irreversible; data may be useful for forensics). Leave it as-is (rejected — security advisor correctly flags it as a risk).
- **Status:** Accepted. DONE. Script: `new-code/migration/hide-password-column.js`.

---

## ADR-17 — Per-project status model with three layers (call disposition / contact status / account status)

- **Context:** The old system had a single status per lead. The business actually needs to track status at three levels simultaneously, all varying by project.
- **Decision:** Three independent status layers, all **per-project**: (1) **Call Disposition** — logged per call, kept in full history in the `interaction` table; (2) **Contact Status** — one current status per contact per project (`contact_project_status`); (3) **Account Status** — one current status per company per project (`company_project_status`). Full history retained for all three. Visible and editable by owner + admin only.
- **Why:** A contact's status on Project A (e.g. "Not Interested") should not affect their status on Project B (e.g. "Warm Lead"). The same applies at the company level. Separating call logs from status keeps the audit trail clean.
- **Alternatives considered:** Single global status per contact/company (rejected — doesn't model how the business actually works across multiple projects). No history (rejected — owner needs to see how status changed over time).
- **Status:** Accepted. DB tables created. UI in progress.

---

## ADR-18 — Admin-editable dropdown option lists in the database

- **Context:** Every dropdown in the app (contact status, account status, call disposition, decision power, feasibility, etc.) would previously require a developer to change the options. The owner needs to manage these himself.
- **Decision:** All dropdown option lists are stored in a `dropdown_option` table and managed via the Admin panel. Admins can add, edit, or reorder options for any dropdown without a code change or deployment. Starter values are seeded at migration time.
- **Why:** Removes developer dependency for routine data-management tasks. Aligns with the core goal of giving the owner full self-service control.
- **Alternatives considered:** Hard-code the dropdown values in the app code (rejected — requires a developer and deployment for every change). Separate lookup tables per dropdown (rejected — harder to manage generically in the Admin panel).
- **Status:** Accepted. `dropdown_option` table seeded. Admin UI management screen planned (Wave B).

---

## ADR-19 — Contact-company linking via email-domain sync (not a manual migration)

- **Context:** When the Companies and Contacts modules were built, only 130 of 607 contacts had a `company_id` set. The rest had no company link even though the contact's email domain often matched a company in `company_master`.
- **Decision:** Run a **one-time email-domain sync** script: clean each contact's email domain, match it to `company_master.domain_clean`, and set `contact.company_id` where there is a match. **286 additional contacts linked** (417/608 now have a company). The sync was a dry-run first, then applied. Going forward, dedup rules handle new records.
- **Why:** Manual linking would take hundreds of hours. Email domain is a reliable proxy for company membership for professional contacts. The dry-run-then-apply pattern ensures no accidental changes.
- **Alternatives considered:** Leave contacts unlinked (rejected — 78% of contacts would have no company, making the module useless). Full manual review (rejected — 607 records, not scalable).
- **Status:** Accepted. DONE. Script: `new-code/migration/backfill-apply.js`. Note: 159 contacts have work-email domains not in the 525-company list — candidates to auto-create companies later.

---

## ADR-20 — New clean GitHub repo (AltLeads-CRM) with fresh history

- **Context:** The original repo had years of vendor history including large binary files (design files, old code), committed secrets, and mobile assets we don't need for the web app.
- **Decision:** Create a **new, clean GitHub repo** (`AltLeads-CRM`) with fresh git history. Old vendor code, Figma/design files, large binaries, and secrets are excluded from the new repo. The Hostinger git auto-deploy is wired to this new repo.
- **Why:** A clean repo is easier to reason about, faster to clone, and doesn't carry committed secrets. The old history is archived in `old-code/` locally if ever needed for reference.
- **Alternatives considered:** Push new code onto the old repo with git history intact (rejected — drags along secrets and large files that are hard to fully remove from git history).
- **Status:** Accepted. DONE.

---

## ADR-21 — Internal-launch role & access decisions (2026-06-19)

- **Context:** Outreach-only model + bulk-migrated data forced four go-live decisions: who can create, what agents may edit, manager visibility, and deploy posture.
- **Decision:**
  1. **Create rights are a configurable per-project SETTING, default = ADMIN only.** Admin can grant create (and the CRUD options) to **Team Leads** (or others) via the per-project access/CRUD settings (the existing "Project Access" dials). Not hardcoded. Outreach roles (Agent/Sales) are update-only.
  2. **Agents update records ASSIGNED to them** (assignment-based write), not records they "created" — because migrated data has no agent as creator. Implementation: drive edit permission from assignment (`lead_report.user_id` / a record owner field), re-point/derive ownership for migrated rows, and **validate with a real agent login before launch**. This clears the write-path blocker (see Risk / REBUILD_LOG 2026-06-18).
  3. **Manager visibility:** Team Leads / Sales Heads CAN see their team's contact details — but via the masking UX in **ADR-22**, not in the clear.
  4. **Deploys are MANUAL during launch week** (commit locally; push only on owner go).
- **Why:** Matches the outreach-only north-star, keeps creation tight by default but flexible per project, and unblocks the day-one update loop without exposing data or risking the live app mid-launch.
- **Status:** Accepted. Build pending (role posture ALT-150, ownership ALT-152, settings-driven CRUD).

---

## ADR-22 — Contact-detail masking = partial mask + click-to-reveal

- **Context:** Owner wants privacy *and* usability: "no one should see anyone's full contact details by default," but reps must still be able to use the number/email.
- **Decision:** For viewers who are **permitted** to see a record's details (owner + their team/manager + admin), phone and email render **partially masked by default** — phone shows the **first 3 and last 3 digits with the middle blurred**; email shows a similar partial mask. **Clicking the value reveals it fully, and it stays revealed until the page is refreshed.** For viewers **not permitted** (record isn't theirs/their team's — i.e. "public"), the detail stays **hidden always** (the DB `contact_master_masked` view returns null, so there's nothing to reveal).
- **Why:** Discourages casual/bulk exposure and eyeball-scraping (you must deliberately click each one, and a refresh re-hides), while still letting the rep do their job. The blur+reveal is a UI layer on top of values the user is already allowed to fetch.
- **Alternatives considered:** Binary "owner sees full / others see nothing" (rejected — managers need team visibility, and full plaintext on load is over-exposed). Fully hidden until reveal with nothing visible (rejected — owner wants the first/last digits visible for recognition).
- **Supersedes** the display half of the earlier masking model (the DB-level owner/manager gating via `contact_master_masked` stays; this changes how permitted values are *displayed*).
- **Status:** Accepted. Build pending.

---

## ADR-23 — Sales/client access is a WEB portal (two logins, one app) — amends ADR-11

- **Context:** ADR-11 put the client sales team on a mobile app only. The owner now wants a client-facing **web Sales Portal**, with mobile as the lowest priority.
- **Decision:** Build the sales side as a **web portal** in the same app: a separate **Sales login** and a `/sales` area. Sales users see only their project(s)' leads (**Sales Person = own**, **Sales Head = their downline**, with the head able to grant a wider "senior viewer" share). Internal Amplior users may enter the sales portal (leads only); **sales users cannot reach internal screens.** Multiple Sales Heads per project (executive views). Mobile app deferred (least priority; same backend later).
- **Why:** A web portal ships faster, reuses the same backend/components, and matches the "ecosystem on one backend" north-star. The vendor's sales app was meeting/feedback-centric, which fits outreach-only.
- **Status:** Accepted. **Amends ADR-11** (two-app split → two-portal-in-one-web-app now, mobile later). Shell shipped; data-scoping (RLS) + feedback CRUD in progress. See `SALES-PORTAL.md`.

---

## Quick index

| ADR | Decision | Status |
|-----|----------|--------|
| ADR-01 | Supabase over self-managed MySQL | Accepted |
| ADR-02 | Supabase Auth over homemade JWT | Accepted |
| ADR-03 | React + Vite + TypeScript web app | Accepted |
| ADR-04 | TanStack Table over paid AG Grid | Accepted |
| ADR-05 | Hostinger (combined Node app) over Netlify | Accepted / Done |
| ADR-06 | Migrate real data via DB fork; don't touch prod | Accepted |
| ADR-07 | Keep old system running in parallel until cutover | Accepted |
| ADR-08 | Repair the existing React Native app, not rebuild | Accepted |
| ADR-09 | Ownership = `created_by`, company = `client_association` | Accepted |
| ADR-10 | Orchestrator + cheap sub-agents working model | Accepted |
| ADR-11 | Two-app split: web = internal team, mobile = client sales | Accepted |
| ADR-12 | First rebuild scope = FRS parity + CR Layer 1; Layer 2 deferred | Accepted |
| ADR-13 | Existing dupes allowed; only new dupes blocked | Accepted |
| ADR-14 | Email via Gmail SMTP on same server | Accepted / Done |
| ADR-15 | Admin user management via service-role backend endpoint | Accepted / Done |
| ADR-16 | Hide legacy password column (not drop) | Accepted / Done |
| ADR-17 | Per-project three-layer status model | Accepted |
| ADR-18 | Admin-editable dropdown option lists in DB | Accepted |
| ADR-19 | Contact-company linking via email-domain sync | Accepted / Done |
| ADR-20 | New clean GitHub repo (AltLeads-CRM) | Accepted / Done |
| ADR-21 | Launch role/access: create=admin-only-by-default (settings-configurable), agents edit ASSIGNED records, manual deploy | Accepted |
| ADR-22 | Contact masking = partial mask + click-to-reveal (first/last 3 visible, reveal until refresh) | Accepted |
| ADR-23 | Sales = web portal (two logins, one app); amends ADR-11; mobile deferred | Accepted |
| ADR-24 | Internal-beta model (2026-06-30): agents see OWN leads only (ownership = lead_report.user_id, NOT created_by — they diverged at migration); agent edits = status/meetings/calls/pre-sales/feedback (not lead identity fields); fresh import BEFORE beta; one cohort first | Accepted |
| ADR-25 | Beta cohort = HungerBox: project 3 "Hungerbox" + project 16 "HungerBox India - Calling"; Ankit provides import file(s) WITH an Assigned To column | Accepted |
| ADR-26 | Rollout authorizations (2026-07-02): Claude may set VITE_USE_WRITE_GATEWAY=true on crm-test via Dokploy; RLS-fix sequence = throwaway agent login → smoke proof → prod apply ONLY on Ankit's explicit final go | Accepted |
| ADR-27 | Integrations get a FIRST-PARTY CRM API (crm.altleads.com/api/v1, domain objects, admin-issued API keys, writes via the write-gateway) — NEVER raw Supabase URLs/keys; MCP server wraps the CRM API (spec: CRM-API.md) | Accepted |
| ADR-28 | Capture-everything posture: email_log + reassignment_log + import_batch/row (staged apply-comms-capture.cjs) now; status-change journal (ALT-501) + field history (ALT-407) + export history 30-day re-download (ALT-497) + push notifications (ALT-495) = week-2 hardening | Accepted |
| ADR-29 | Client portal shows the FULL meeting lifecycle (incl. cancel/drop/postpone) but ONLY meeting data — no recordings, no internal fields (Ankit 2026-07-02, D4) | Accepted |
| ADR-30 | Export history confirmed: every export recorded + file stored 30 days + re-downloadable (ALT-497). Import must link to EXISTING records: contact/lead imports map Company Record ID (export→import round-trip) or company name; ID wins over name (Ankit 2026-07-02) | Accepted |
| ADR-31 | Project 16 (HungerBox India - Calling) = same HungerBox client but STARTS FRESH — do NOT link client_assoc yet; link on import day when Ankit says so (Ankit 2026-07-02) | Accepted |
| ADR-32 | Beta import = COMPANIES (not leads) — Ankit 2026-07-03. Companies imported → assigned to agents in-app → agents create leads/meetings from them (per A3 ruling). Lead-import machinery (ALT-499) stays for later | Accepted |
| ADR-33 | D2 DECIDED: ONE structured feedback model everywhere (CRM + client portal + sales portal) — admin-editable questions + one optional remark; outcomes Successful/Reschedule/"Cancel-drop" (Cancel & Drop MERGED — one label, one form, one DB model); read-only after submit, locked at meeting close. Portal agent bound to this (handoff §9) | Accepted |
| ADR-34 | Per-user email sending: benchmark model researched (HubSpot/Zoho/Odoo) = authenticate the DOMAIN once (SPF/DKIM/DMARC), platform sends From = each user's own address, zero per-user setup; connected-inbox sync = phase 2. Option pick pending on decision board | Superseded by ADR-35 |
| ADR-35 | Email sending DECIDED = Option E (Ankit 2026-07-03): Phase 1 NOW = domain-authenticated sending (SPF/DKIM/DMARC, users send as themselves, ALT-503); Phase 2 after beta = optional connected inboxes via OAuth for Sent-folder + 2-way reply sync (ALT-507). PLUS per-project sending domains (ALT-506): Settings holds a verified-domain registry (send blocked until DNS verified), each project picks ONE sending domain (fallback amplior.com), user From = auto-alias (local-part) on the project's domain with admin override (3a/3b pick pending). Benchmark: HubSpot unlimited authenticated domains / Odoo from_filter-per-domain | Accepted |
| ADR-36 | Multi-tenancy DECIDED = T2 true multi-tenant (Zoho/HubSpot model, Ankit 2026-07-06): one app + one DB, tenant_id + RLS isolation everywhere; blank-start orgs; our data invisible to tenants. Phased (ALT-522): P0 tenant registry + tenant-aware new tables NOW, P1 staged retrofit of existing ~65 tables w/ per-table isolation tests, P2 tenant provisioning/invite, P3 branding/billing. Sequenced after internal beta. T1 instance-per-customer remains the emergency fallback if a sale can't wait | Accepted |
