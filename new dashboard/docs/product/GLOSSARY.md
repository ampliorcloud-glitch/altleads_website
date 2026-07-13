# Glossary — Amplior / Altleads CRM

*Purpose: a plain-language dictionary of the business and technical words used across this project, so anyone (technical or not) can follow the docs and conversations.*

*Last updated 2026-06-12*

---

## How to read this

- Terms are listed **alphabetically**.
- Each entry is 1–2 lines in everyday language, with a small technical note only where it helps.
- **Domain term** = a word about the sales/CRM business. **Tech term** = a word about the software or tools.
- Where something is not yet confirmed, it is marked **TBD — confirm with owner**.

---

## A

**Activity (Lead Activity)** — *Domain.* The running diary of everything that has happened on a lead: calls, notes, status changes, follow-ups. Shown as a timeline on the lead's page so anyone can see the full history at a glance. One of the three workspace tabs on a lead (Activity / Lead Report / Meeting).

**Admin (ADMIN)** — *Domain (role).* The top-level user who can see and edit everything: all leads, all users, roles, projects, clients and settings. Mohit is an ADMIN. In the new app the Admin panel is only visible to this role.

**Agent (AGENT)** — *Domain (role).* The salesperson who works leads day-to-day. In this database, "agent" and "salesperson" mean effectively the same person. An agent normally sees only their own leads. *Note: in the real data, lead ownership is actually stored in the `created_by` field, not `agent_id` — a quirk we discovered during migration.*

**AOI (Area of Interest)** — *Domain.* The topic, product, or service area a lead or client is interested in. Used to match leads to the right project or offering.

**Anon key (anonymous key)** — *Tech.* A public Supabase access key the web app uses to talk to the database. It is safe to ship in the app **only when** Row Level Security is switched on; until then it has full access and must stay on local previews only.

**Auth (Authentication)** — *Tech.* The "who are you?" check — logging in and proving identity. We use **Supabase Auth**, which replaces the old homemade login that stored passwords in plain text.

---

## B

**Backlog** — *Tech/Process.* The to-do list of features, fixes and ideas for the product, usually kept in priority order. Items move from the backlog into active work.

**Badge** — *Tech/UI.* A small coloured label in the interface (for example a status pill like "Successful" or "Rescheduled"). Cosmetic, used to make status easy to scan.

---

## C

**Client Association** — *Domain.* The link between a lead and the client/company it belongs to. In our real data this is the reliable way to find a lead's company name (via the lead's `client_assoc_id` → `client_association.client_name`), because the older `company_id` field is often blank.

**Clinch** — *Domain.* Closing or winning a lead — turning a prospect into a confirmed deal/result. A "clinched" lead is one that has been successfully converted. **TBD — confirm with owner** on the exact stage/label used in your process.

**Cutover** — *Process.* The moment the team stops using the old system and switches fully to the new one. Happens after a successful parallel run, and is followed by retiring the old DigitalOcean servers.

---

## D

**Dashboard** — *Domain.* The home screen showing key numbers and summaries at a glance — total leads, meetings this week, successful results, and quick links into the modules.

**DigitalOcean (DO)** — *Tech.* The cloud provider that hosts the **old** system (the Java server and MySQL database). We keep it running during the parallel run, then retire it after cutover.

---

## E

**Environment variable** — *Tech.* A setting (like a database address or secret key) kept **outside** the code, so the same app can point at different databases (local vs live) without changing the code. Stored in files like `.env`.

**Excel export** — *Domain/Feature.* The ability to download a filtered list (of leads or meetings) as a spreadsheet (.xlsx). This was part of the vendor's ₹96k change request and is built in as standard in the new app.

---

## F

**Fable / Fable 5** — *Tech.* An AI model that was used for the heavy early build work. It is available only until 2026-06-22, which is why the hard work is front-loaded; after that the project uses Opus 4.8 and Sonnet.

**Figma** — *Tech.* The design tool where the app's screen designs live (file "Amplior CRM 0.1"). The designs are used as the visual reference when polishing the look of the new app.

**Fork (database fork)** — *Tech.* An exact, separate copy of a live database made so we can work on it safely **without ever touching production**. We forked the live MySQL cluster to copy data into Supabase, then planned to delete the fork once done.

**FRS (Functional Requirements Specification)** — *Tech/Process.* The authoritative document describing what the system must do, feature by feature. The file `Amplior_Altleads_CRM_ FRS_V2.0 (1).pdf` is our primary source of truth for required behaviour.

**Function (serverless / Edge Function)** — *Tech.* A small piece of code that runs only when called (for example, to build an Excel file or send a notification email) and scales by itself. We use **Netlify Functions**. "Serverless" means we don't run or maintain the server — the provider does.

---

## G

**GitHub** — *Tech.* The online home for all the project's code. It stores every version and feeds code automatically to Netlify for deployment.

**Glossary** — *This document.* A dictionary of project terms.

---

## K

**Keystore** — *Tech.* A digital signing file required to publish an Android app to the Play Store. The original vendor has not handed theirs over (final invoice unpaid), so we may need a new signing key or a Google reset for the existing listing.

---

## L

**Lead** — *Domain.* A potential customer or sales opportunity being tracked — the core record in the CRM. Everything (activities, reports, meetings) hangs off a lead.

**Lead Activity** — see **Activity**.

**Lead Number / ALT####** — *Domain.* The human-friendly ID given to each lead, in the form `ALT` followed by a number (for example `ALT1608`). New leads get the next number automatically.

**Lead Report** — *Domain.* The structured outcome record for a lead — its current stage and the history of stage changes. Importantly, a lead's **true stage lives in the Lead Report** (via `lead_report` → `stage_master`), not in the lead's own `stage` field, which is almost always blank. One of the three workspace tabs on a lead.

**Lead workspace (tabs)** — *Domain.* The detailed view of a single lead, laid out HubSpot-style: a header and info panel plus three tabs — **Activity**, **Lead Report**, and **Meeting** — where agents fill in information.

---

## M

**MCP (Model Context Protocol)** — *Tech.* A standard that lets the AI assistant securely connect to outside tools and services (for example a database or a design tool) to do real work on your behalf.

**Meeting** — *Domain.* A scheduled interaction with a lead. Tracked as its own module and also linked to the relevant lead.

**Meeting mode — Telephonic** — *Domain.* A meeting held over a phone call.

**Meeting mode — Online** — *Domain.* A meeting held over video/internet (e.g. a video call).

**Meeting mode — Offline** — *Domain.* A meeting held in person / face-to-face.

**Migration** — *Tech.* The one-time job of moving the real data from the old MySQL database into the new Supabase database — done here for 65 tables and roughly 108,000 rows, with row counts checked to confirm nothing was lost.

**Module** — *Domain.* A major section of the app: Dashboard, Leads, Meetings, Wishlist, Notifications, Admin, Settings.

---

## N

**Netlify** — *Tech.* The service that hosts the web app and runs the small server-side Functions. It can auto-deploy new code from GitHub (this is turned off after the first deploy, per owner's rule, so later deploys are manual).

**Notifications** — *Domain.* In-app and email alerts to users — for example when a meeting is assigned or reassigned to an agent.

---

## P

**Parallel run** — *Process.* A period where the team uses the **new and old systems side by side** to confirm the new one is correct and complete, before fully switching over (cutover).

**Postgres (PostgreSQL)** — *Tech.* The database engine inside Supabase that stores all the data. It replaces the old MySQL database.

**PRD (Product Requirements Document)** — *Tech/Process.* A plan describing what a product or feature should do and why, written for the team to build against. (Companion to the FRS, written in product language.)

**Pre-Sales** — *Domain.* The early stage of the sales process — qualifying and warming up a lead before it becomes an active deal or a meeting is set. **TBD — confirm with owner** on exactly which stages count as Pre-Sales in your workflow.

**Project** — *Domain.* A specific offering, campaign, or engagement that leads are tied to (a lead carries a `project_id`). Used to group and report leads by what they relate to.

---

## Q

**QC (Quality Control / QC role)** — *Domain (role).* A reviewer who checks the quality and correctness of lead data and outcomes. One of the six user roles in the system.

---

## R

**Reschedule** — *Domain.* Moving a meeting to a new date/time. Rescheduled meetings get their own status (shown with an orange "Rescheduled" badge in the old app).

**RLS / Row Level Security** — *Tech.* Access rules attached **to the database itself**, deciding which rows each user is allowed to see or change (e.g. "agents see only their own leads; admins see all"). Because the rule lives on the database, even a buggy app cannot leak another user's data. **Must be switched on before the app goes live.**

**RN / React Native** — *Tech.* The technology the mobile app is built with. The plan is to repair the existing React Native app and point it at the new Supabase backend.

**Role** — *Domain.* A user's permission level. The six roles are **ADMIN, TEAM_LEAD, SALES_HEAD, SALES_PERSON, AGENT, QC** (see each entry).

---

## S

**SALES_HEAD (SH / Sales Head)** — *Domain (role).* A senior sales manager overseeing sales heads of teams and their results; broader visibility than a single salesperson.

**SALES_PERSON (SP / Sales Person)** — *Domain (role).* A salesperson who owns and works leads. In this system effectively the same person as an "agent."

**Serverless** — see **Function**. Short version: the servers still exist, they're just **someone else's problem** to run and secure.

**shadcn / shadcn-style UI** — *Tech.* A popular set of ready-made, good-looking interface building blocks (buttons, tables, dialogs) used to build the new web app's screens quickly and consistently.

**Source** — *Domain.* Where a lead came from (for example a campaign, referral, website, or event). Used to understand which channels produce the best leads.

**Stage** — *Domain.* Where a lead is in the sales journey (for example new → in progress → meeting → won/lost). In this system the live stage is read from the **Lead Report**, not the lead's own (mostly blank) stage field.

**Supabase** — *Tech.* The all-in-one backend platform we moved to. It bundles the **database (Postgres)**, **login (Auth)**, and **file Storage** into one managed service, and auto-generates a secure API for every table. Replaces the old Java server + MySQL + DO Spaces.

**Settings** — *Domain.* The module where a user edits their own profile and changes their password.

---

## T

**TanStack Table** — *Tech.* The free, powerful tool used to build the data tables (lists of leads, meetings, etc.) with sorting, filtering and paging. Chosen instead of the paid AG Grid Enterprise to avoid licence costs.

**TEAM_LEAD (TL / Team Lead)** — *Domain (role).* The manager of a small sales team; sees their team's leads and activity. One of the six roles.

**Token (access token / personal access token)** — *Tech.* A secret key that grants the holder permission to use a service's account (Supabase, Netlify, GitHub, etc.) on your behalf. Treated like a password — kept in the private `.credentials/` folder, never shared in chat.

---

## U

**UAT (User Acceptance Testing)** — *Process.* The stage where real users try the system on real tasks and confirm it does what they need before it goes fully live. The parallel run is effectively UAT for this project.

**UI (User Interface)** — *Tech.* What you see and click on screen — the look and layout of the app.

---

## W

**Wishlist** — *Domain.* A saved list of leads/opportunities a user wants to keep an eye on or revisit later — a "watch list" within the CRM. Tracked as its own module.
