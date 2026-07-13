# Amplior CRM Rebuild — Project Summary & Handoff

> **Purpose:** A clean snapshot for continuing work (web in the current chat, mobile in a NEW chat).
> The append-only detail log is `REBUILD_LOG.md` (read it for the full history). This file is the
> readable current-state overview. Owner: **Mohit** (mohit@amplior.com), non-technical — explain in
> plain language, do heavy work via cheap sub-agents (orchestrator pattern).

---

## 1. What this project is
Rebuilding the Amplior / Altleads CRM (a B2B field-sales CRM) that an outsourced vendor built badly.
Goal: a clean, self-manageable system the owner controls, going live for **web first, then mobile**.
The old system (Java Spring Boot + MySQL on DigitalOcean) stays running until cutover.

## 2. Tech stack (LOCKED)
TypeScript everywhere · **Supabase** (Postgres DB + Auth + Storage) · **React + Vite + Tailwind**
(web) · **Netlify** hosting w/ GitHub auto-deploy · **Node/Express notification service**
(Gmail email; deployable to the owner's **Hostinger** Node hosting) · **React Native** mobile
(repair existing app). No Java, no self-managed MySQL.

## 3. Decisions made (don't relitigate)
- **Two apps:** WEB = internal team (Admin, Team Lead, Agent). MOBILE = client sales team
  (Sales Head, Sales Person). Sales Person gets web access in a LATER release.
- **Scope:** FRS-parity + the small "Layer 1" CR (filters, exports, editable settings/reports).
  CR Layer 2 (multi-tenant, Companies/Contacts modules, meetings-centric pivot) = DEFERRED.
- Migrate REAL data (done). Keep old system parallel until cutover. Supabase over MySQL.
- Dashboard redesign NOT wanted yet (keep stat cards).

## 4. Current status

**DONE (web):**
- Supabase project `amplior-crm` (ref `puvozfhypqbwbmbhrhcr`, region ap-south-1). Real data migrated:
  65→ now ~70 tables, ~108k rows (605 leads, 610 meetings, 54 wishlist, 18 active salespeople).
  Migrated via a DB FORK (prod never touched). Identity sequences reset post-migration.
- Auth (Supabase Auth) + profiles table linking auth→user_master + role. Test admin: mohit@amplior.com.
- Web app FRS-parity across ALL modules: Login, Dashboard, Leads (list+7 filters+Excel export+
  pagination+detail+add/edit), Lead workspace (Activity/Lead-Report/Meeting tabs + right panel),
  Approvals (queue + approve/reject + notifications), Meetings, Wishlist (+convert-to-lead),
  Notifications, Settings, Admin (Users/Projects/Clients/Reference-Data).
- QA audited (41 issues) → all confirmed critical/high/medium FIXED. xlsx CVE patched (SheetJS 0.20.3).
- **Security: RLS baseline applied + verified** — anon blocked, self-promote blocked, authenticated
  access works. (Fine-grained per-role "agent sees only own" = follow-up.)
- **Design: fully matched to the owner's Figma export** (login split-screen, leads avatars,
  breadcrumbs, lead-detail stepper, admin panel, and all screens unified). Brand = blue #1A7EE8,
  Inter font, AltLeads wordmark logo.
- Build PASSES. Runs at **http://localhost:5173** (`npm run dev` in new-code/web).
- 3 git commits this session (d3db3f1, 57b6965, 3dc2703) — LOCAL ONLY, not pushed yet.

**IN PROGRESS:**
- **Email + in-app notification service** (`new-code/notify-service/`, Node/Express + nodemailer +
  Gmail SMTP). Sends from amplior.ankits@gmail.com (personal Gmail, app password in
  `.credentials/gmail_app_password.txt`). Events: lead assign/reassign, meeting scheduled,
  approval request/approved/rejected. Runs locally for testing; deployable to Hostinger Node.

**PENDING (needs owner):**
- **GitHub push** of the 3 local commits (owner must authorize — say "push").
- **First Netlify deploy** (owner says "go"; `new-code/web/netlify.toml` ready; set env
  VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY + VITE_NOTIFY_URL; base dir new-code/web; turn
  auto-deploy OFF after first).
- Finish + test email service (Gmail smoke test in progress).
- 18 detail questions in `docs/USER-STORIES-AND-FLOWS.md` (have sensible defaults; answer when free).
- **Mobile app (Phase 6)** — see section 8.

## 5. Access & credentials (locations only — gitignored `.credentials/`)
- `supabase_token.txt` (management), `supabase_anon_key.txt`, `supabase_service_role_key.txt`,
  `supabase_db_password.txt`, `supabase_project_id.txt`
- `netlify_token.txt`, `do_token.txt`, `figma_token.txt`, `gmail_app_password.txt`
- `test_admin_login.txt` (mohit@amplior.com web login)
- `fork_cluster_id.txt` (the DB fork used for migration — can be deleted when done)
- GitHub repo: github.com/ampliorcloud-glitch/AL

## 6. CRITICAL technical facts (hard-won — don't rediscover)
- **Lead ownership = `lead_master.created_by`** (varchar = user_master.user_id). NOT agent_id
  (mostly null). RLS/ownership keys on created_by.
- **Company for a lead = `client_association.client_name`** via lead_master.client_assoc_id
  (populated for all leads). NOT company_master via company_id (null for ~78%).
- **Lead stage = latest `lead_report.stage_id` → stage_master.** NOT lead_master.stage (mostly null).
  stage_master ids: 3=New Meeting, 4=Meeting Scheduled, 6=Meeting Droped By Amplior, 8=Meeting Successful.
- **Meeting status = `meeting_master.meeting_status`** (the plain `status` col is null). Meeting↔lead
  chain: lead_report.report_id → meeting_schedule.report_id → meeting_master.meeting_id.
- **Wishlist:** company_name + lead_name + assign_agent/assign_tl are DIRECT columns
  (wishlist_assign table is empty/dead).
- **Audit fields:** always write created_by/updated_by = current user's user_id (string), never name.
- After any data migration that inserts explicit PKs into identity columns, **reset the sequences**.
- For new leads: `insertLeadWithUniqueNumber()` (scans global max ALT#### + retries on collision).
- RLS is ON: app uses anon key + the logged-in session (role `authenticated`); SMTP works from
  Node (Netlify/Hostinger), NOT from Supabase Edge (Deno blocks raw SMTP).

## 7. Key docs
- `REBUILD_LOG.md` — full append-only history (read first).
- `docs/USER-STORIES-AND-FLOWS.md` — authoritative flows/blueprint + 18 open questions.
- `docs/QA-AUDIT.md` — the 41-issue audit.
- `docs/ARCHITECTURE.md` — plain-language architecture.
- `docs/DESIGN-SYSTEM.md` — palette/type/components.
- `docs/product/` — PRD, BACKLOG, ROADMAP, ROLES-AND-PERMISSIONS, DATA-DICTIONARY, UAT-CHECKLIST,
  RISK-REGISTER, DECISIONS, GLOSSARY, INDEX.
- `docs/archive/figma-exports/figma-zip/` (SVGs) + `docs/archive/figma-exports/figma-png/` (rasterized screens, gitignored) — design reference (archived 2026-06-23 during docs hygiene; see `docs/INDEX.md`).
- `new-code/migration/` — schema + data-copy + rls-policies.sql.

## 8. STARTING THE MOBILE CHAT (Phase 6) — read this first in the new chat
- **App location:** `old-code/amplior-mobile-app-main/` — React Native 0.78 / React 19, ~57 .jsx
  files. Android applicationId `com.amplior`. Field-sales app for the CLIENT team (Sales Head,
  Sales Person): login/OTP, home dashboard, meetings (list/detail/feedback/reassign), wishlist
  (with geo-tagged photo capture via camera + Ola Maps reverse-geocode), hot prospects, notifications.
- **Two files are MISSING** and the app won't build without recreating them:
  `src/environments/environment_urls.jsx` (API base URL + endpoint paths) and
  `src/constants/httpMethod.jsx` (the fetchApi wrapper). Old backend pattern seen in code:
  `http://<ip>:8080/amplior-int/api/v1/...` (Java). Mobile is fully API-driven (no direct DB).
- **The plan:** recreate the 2 missing files pointing at the NEW backend (Supabase auto-API +
  the notify-service), rewire auth to Supabase Auth, map screens to the real Supabase tables using
  the SAME schema facts in section 6, fix dead/commented code (Home.jsx etc.), then build + sign.
- **Deploy hurdles (flag to owner):** iOS build needs a Mac (owner can borrow a senior's 2020
  MacBook; or use a cloud Mac/GitHub Actions macOS runner). Android needs a NEW signing keystore
  (vendor withheld theirs — fine for a new listing; updating the EXISTING Play listing needs the
  vendor's key or Google's key-reset). Apple Developer + Google Play account access needed (vendor
  may ghost due to unpaid final invoice — plan for Google/Apple support recovery).
- **Figma mobile designs:** `docs/archive/figma-exports/figma-zip/` Mobile UI page (23 frames) — rasterize from the SVGs.
- Mobile reuses Supabase (one backend for web + mobile) — no separate DB.

## 9. How to resume WEB (this/continuing chat)
Read `REBUILD_LOG.md`, run `npm run dev` in `new-code/web` (localhost:5173), log in as
mohit@amplior.com (password in `.credentials/test_admin_login.txt`). Next concrete steps:
finish/test email → owner authorizes GitHub push → first Netlify deploy → parallel-run testing.

*Last updated: 2026-06-14.*
