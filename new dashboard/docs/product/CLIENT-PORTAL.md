# Client Portal — Plan (v1, Phase 1)

> **Status: PLAN / not built.** Owner: Ankit. Branding: **Amplior** (not AltLeads). Web-only. Source: CEO meeting transcript 2026-06-21 (captured in REBUILD_LOG cont. 9). This doc is the durable plan; it will evolve as the owner confirms the open decisions in §10.

## 1. What this is (and isn't)
A **premium, Amplior-branded, client-facing web portal** — "Amplior's identity in front of the client," like Microsoft's `admin.microsoft.com`. One place where a client's **leadership** can see everything Amplior is doing for them: onboarding artifacts, lead reports, meetings + a dashboard, governance notes, updates, and invoices — instead of that being scattered across email/WhatsApp/calls.

Goals (from the CEO):
- **Single source of truth** per client → replaces scattered comms; standardizes client communication ("always refer back to the portal").
- **Transparency = trust** → show the work openly to the client's decision-maker ("leadership connect"); cut out middle-men disputes ("this isn't coming / that isn't coming").
- **Tech-enabled identity** → makes Amplior look like a tech-enabled player; auto-generates the material that today goes into PPTs.
- **Reusable internal mirror** → the same content doubles as an internal knowledge/training base for agents and an internal performance view for leadership.

**It is NOT a CRM.** It can *link* to the AltLeads CRM, but it's a curated, mostly-read-only governance/knowledge surface. Phase 1 = **mostly static content uploaded by Amplior staff from a backend**, plus a few **live** reads from the CRM (lead reports, meetings, dashboard). Low automation; connectors come later.

## 2. Who it's for — access model
Two audiences, both **access-gated by seniority** (owner: "for sales leader & their senior — not sales people themselves unless given access as a sales head"):

**Client side (external):**
- Invited **client leadership / decision-makers** (the person spending the money) + a few named client contacts.
- Each client user sees **ONLY their own client's** data (strict multi-tenant isolation). Read-only.

**Amplior side (internal):**
- **ADMIN + leadership + SALES_HEAD**: manage client portals, upload content, view any/their clients, see the internal performance mirror.
- **SALES_PERSON / AGENT**: **no** portal-admin access by default — only if elevated to SALES_HEAD-level access. (Internal performance dashboard may be visible to TEAM_LEAD/leadership per the transcript.)

> This mirrors the CRM's role model (`role_master`: ADMIN/TEAM_LEAD/AGENT/SALES_HEAD/SALES_PERSON/QC) and adds a new **CLIENT** role for external users.

## 3. Relationship to the existing apps
| App | Audience | Brand | Status |
|---|---|---|---|
| **AltLeads CRM** (`crm.altleads.com`) | Internal staff (full CRM) | AltLeads | Live |
| **Internal Sales Portal** (`/sales`) | Internal sales **team** day-to-day | AltLeads | Shell shipped |
| **Mobile (Blitz) app** | Salesperson ↔ coordination | — | Legacy; transcript wants its web equivalent folded into the portal eventually |
| **Client Portal** (this doc) | **External client leadership** + internal mirror | **Amplior** | **Planned (new)** |

The Client Portal is a **distinct, new app** — not the internal Sales Portal reskinned.

## 4. Supabase: same project or new? — **RECOMMENDATION**
**Recommended: SAME Supabase project** (`puvozfhypqbwbmbhrhcr`), on **Supabase Pro ($25/mo — pay for it regardless**, to remove the free-tier auto-pause risk the owner is worried about), with a **dedicated portal schema + curated read-only views + a separate CLIENT role**.

**Why same project (for Phase 1):**
- The portal's core value is showing **live** CRM data per client (lead reports, meetings, dashboard) that "reads exactly like the app." Same project = live with **no sync pipeline**. A separate project would need ETL/replication → constant staleness + engineering tax.
- **One bill, one backup, one auth** — simplest for a small team; matches the owner's $25 Pro intent.
- Fastest path to Phase 1.

**The risk (be honest):** external client users authenticate against the project that holds **all** clients' data + internal-only fields. One RLS mistake could leak a competitor's leads or internal data — which would destroy the very trust this portal is meant to build. So same-project is **only acceptable with these non-negotiable guardrails:**
1. Clients **never** get access to base tables — only to **curated, client-scoped read-only VIEWS** (e.g. `portal_lead_reports`, `portal_meetings`) and per-client **Storage** buckets.
2. A dedicated **CLIENT** role with **zero** default grants; explicit grants only to the portal views/buckets.
3. Every client view filters by the caller's `client_assoc_id` via RLS; **adversarially tested with throwaway client logins** before any real client is onboarded (same discipline already used for staff RLS).
4. Client-safe **column whitelist** — decide exactly which fields a client may see (their leads' details: yes; internal cost/agent-performance/other-clients: never).

**When to switch to a SEPARATE project:** if/when the portal opens to many external client orgs, adds heavier automation, or the pre-launch security review judges direct exposure too risky → move the portal onto its **own** Supabase project fed by a **controlled, read-only sync** from the CRM, so the internal DB is never directly exposed to external users. Architect Phase 1 so this migration stays possible (portal reads go through a thin data layer, not scattered raw queries).

## 5. Architecture (same-project, Phase 1)
- **Frontend:** a **separate** Amplior-branded web app (e.g. `portal.amplior.com`), its own Vite/React build + deploy on Hostinger, **sharing the same Supabase backend**. Separate app = clean Amplior branding + a clean external surface + independent deploys. (Premium look & feel — design later, per transcript.)
- **Backend:** reuse/extend the existing `notify-service` (Express) for staff **uploads/admin** endpoints (service-role) and later **connectors** (Fathom). No client writes from the browser — all portal content is published by staff.
- **Data:**
  - **Live (read-only views):** lead reports, meetings, dashboard metrics — scoped by `client_assoc_id` / `project_id`.
  - **Portal-owned (new tables in a `portal` schema):** documents/links metadata, governance notes, updates/comms log, action log, escalations, weekly summaries, invoices, client-user mapping.
  - **Mapping:** `client_portal_user(auth_uid → client_assoc_id, role, enabled)` ties a Supabase Auth user to exactly one client. (CRM backbone today: `client_association` → `project(client_assoc_id)` → leads/meetings/reports.)
- **Storage:** Supabase Storage, **one bucket/prefix per client**, for uploaded files (proposals, implementation plans, ICP docs, governance notes, invoices, weekly decks, the Excel that gets parsed). RLS on storage scoped per client.
- **Excel → structured:** uploaded Excel parsed into structured, app-like tables (owner wants it "to read exactly like the app"), reusing the CRM's xlsx tooling.

## 6. Information architecture — Phase 1 pages (mapped to the transcript)
1. **Overview / Home** — premium landing: client logo, project status, quick links, "important updates."
2. **Onboarding & Implementation** — proposal, implementation plan, ICP (sectors/targeting), sample database, process/flow, sample messages. (Uploaded docs + structured.)
3. **Lead Reports** — **live** from the CRM, per client; no more digging through email.
4. **Meetings & Dashboard** — **live** meeting pool + the dashboard scoped to the client; **"How the week went"** weekly-summary selector (pick a week → a 3–4 "slide" summary, data through last week).
5. **Governance** — governance plan, templates, **meeting notes** (Fathom notes: manual copy-paste now; auto-connector later).
6. **Updates / Communication log** — standardized client comms in one place + **action log** + **escalation** doc per client.
7. **Invoices** — uploaded from the backend now; auto-invoice is a future phase.
8. **(Internal mirror)** — same content reused as an agent **knowledge/training** base + an internal **performance dashboard** for leadership.

## 7. Static/manual vs live (Phase 1)
- **Live from CRM:** lead reports, meetings, dashboard numbers.
- **Manual upload by staff:** everything else (docs, ICP, governance/Fathom notes, updates, action log, invoices, weekly summaries). A simple staff "publish" backend; ops can be tasked with pasting Fathom notes post-call.
- **Phase 2 automation:** Fathom connector, auto weekly summaries, auto-invoicing.

## 8. Security model & non-negotiable gates (external users!)
- Clients touch **only** curated per-client views + their Storage bucket — never base tables.
- Dedicated **CLIENT** role; least-privilege grants.
- **Multi-tenant isolation** proven adversarially (throwaway client logins) before onboarding a real client — Client A must never see Client B.
- **Column whitelist** signed off by the owner (what a client may/may not see).
- All portal **writes** are staff/backend only (service-role); the client app is read-only.
- Reuse the CRM's masking/PII decisions where relevant; lead PII shown to a client is *their own* leads.
- This is a **bigger external surface than the internal CRM** — it gets its own security review + RLS validation pass before go-live.

## 9. Phasing
- **Phase 1 (build first):** premium static portal + live lead reports + meetings/dashboard + per-client doc storage + invoices upload + per-client access + Amplior branding. Web-only.
- **Phase 2:** Fathom/connector automation, auto weekly summaries, auto-invoicing, the internal knowledge/training mirror + internal performance dashboard.
- **Phase 3 (future):** deeper automation, fold in the mobile-app coordination features as web, public polish.

## 10. Open decisions for the owner (confirm before build)
1. **Supabase:** approve **same project + pay for Pro ($25)** with the §4 guardrails? (Recommended.)
2. **Branding/domain:** `portal.amplior.com`? Amplior branding confirmed.
3. **Access interpretation (§2):** confirm "client leadership + ADMIN/SALES_HEAD/leadership; agents only if elevated."
4. **Phase-1 page scope:** which of the §6 sections are in Phase 1 vs deferred (owner said "remove anything slow + low value").
5. **Column whitelist:** what a client may see (esp. lead/meeting detail) vs internal-only.
6. **Pilot client:** start with whom? (Transcript hinted at testing with a friendly/transparent client, e.g. HungerBox-style, or "test waters" with a slightly-dissatisfied client.)

## 11. Backlog (epic + Phase-1 tickets)
Epic **ALT-221 Client Portal (Amplior-branded, external)**. Phase-1 children to be created on owner sign-off: Supabase Pro upgrade + portal schema/role; per-client access + `client_portal_user`; curated read-only CRM views (lead reports/meetings/dashboard); Storage + doc upload backend; Overview/Onboarding/Lead-Reports/Meetings-Dashboard/Governance/Updates/Invoices pages; weekly-summary selector; security + multi-tenant RLS validation. (Supersedes the old placeholder **ALT-161**.)

---
## 12. v2 — CORRECTED model (owner interview, 2026-06-21) — supersedes conflicting v1 bits

### 12.1 Roles (final)
- **Amplior internal (AltLeads CRM):** ADMIN, TEAM_LEAD, AGENT (caller), QC. These NEVER touched the vendor mobile app.
- **Client-side (the Portal):** **Company Admin** (the client's top admin / "client head") › **Sales Head** › **Sales Person**.
- role_master SALES_HEAD/SALES_PERSON = these CLIENT roles (they were is_web=false because mobile-only; the mobile app was always client-facing).

### 12.2 Client structure (real examples)
- 1 client (company) → many **projects**; each project → 1+ **sales heads** + their **sales people**.
- **AP Securitas** → "AP Securitas North & West", "AP Securitas South". **HungerBox** → "HungerBox India", "Market Mapping".
- **Companies are SHARED** across all clients/brands in the CRM (callers reuse the same company across clients); each client only ever sees their own projects' records.

### 12.3 Access & permission matrix (Portal)
| Capability | Company Admin | Sales Head | Sales Person |
|---|---|---|---|
| See data | ALL their company's projects | Their project(s) + downline's records (+ other projects only if explicitly added) | Only their own assigned records |
| Manage portal users | Yes (their portal only) | — | — |
| Assign / reassign leads (for meetings) | Yes | Yes (within their project) | — |
| Meeting **feedback** | Edit | Edit (in scope) | Provide (own) — feedback only |
| Create **Wishlist** request | Yes | Yes | Yes |
| Edit ICP/criteria/docs/notes/review-notes/decks | Yes* | Yes* | View only |
| Create/reschedule/delete meetings | No (Amplior schedules) | No | No |
| Create company | No — only a Wishlist *request* | same | same |

\* On Save → a confirmation popup; saving **notifies Amplior ADMIN + TL + that project's users** it was updated. (Doc-edit limited to Company Admin + Sales Head.)

### 12.4 Client-side WRITE actions (the only ones)
1. **Wishlist request** — pick an **existing company** to request targeting; OR type a new company name as free text → **Amplior agent/TL reconciles it to the nearest existing company** before it enters the DB (protects shared company data). Request routes to Amplior's agent/TL to generate a meeting.
2. **Meeting feedback** — sales person provides; sales head can edit. (No meeting create/reschedule/delete.)
3. **Docs/governance edits** — company admin + sales head only, with the notify-on-save popup.
4. **User management** — company admin (their portal); **Amplior ADMIN can also create client/sales users**.

### 12.5 Provisioning + the add/edit-user bug
Amplior ADMIN onboards the client + creates the first **Company Admin** login; the company admin then adds their own sales heads/people. Amplior ADMIN can ALSO create sales users directly. → **FIX:** the CRM **Edit User** must show the sales roles like **Add User** does (keep the sales roles — they're valid, just assigned to client users).

### 12.6 Apps & WHITE-LABEL (key architecture requirement)
- **Mobile app retired**; its client-sales-team function moves to this **web portal**.
- The existing **/sales shell IS the seed** of this portal (client sales-team screens) — **do NOT delete**; it grows into the branded portal.
- **One portal codebase, white-labeled per brand** (logo/name/colours/domain). Brands today: **Amplior** + **AltLeads**. **Brand isolation is absolute** — an Amplior-brand client never sees AltLeads and vice-versa; neither knows the other (or the shared backend) exists. So Amplior can sell under either brand without revealing the other.
- **Separate frontend app from the internal CRM** (external users + white-label + far more sensitive security surface) — but **SHARES the same Supabase backend** (must read the same shared companies/leads/meetings, scoped per client). This re-confirms **same-Supabase-project**; a separate project would break the shared-company live data.

### 12.7 Open for round 2
Is the AltLeads-branded portal the SAME full product or a LIGHTER sales-only version? · brand list + domains · dashboard scope per role · invoices visibility · "How the week went" weekly summary phase · confirm portal data = scoped live view of CRM.

---
## 13. v3 — Round-2 confirmations + data-isolation rule (owner interview, 2026-06-21)

### 13.1 Decisions locked
- **Supabase: SAME project + Pro ($25) — APPROVED by owner** (with the §4/§12.6 guardrails).
- **ONE product, TWO brands** (Amplior + AltLeads), white-labeled; **2 domains for now**, more later. The mobile-app "sales screen" is the CORE of this product, offered under both brands.

### 13.2 Phase-1 BUILD ORDER (owner-specified)
1. **Sales screens** — view + **assign/reassign all meetings**, recreating the vendor mobile app (old-code/amplior-mobile-app-main) as web.
2. **ICP, docs & decks** (upload/view; edit by Company Admin + Sales Head, with notify-on-save).
3. **Governance scheduling** — governance = a **review meeting** between Amplior leaders (TL/Manager) and the **Company Admin**; so just a **meeting reminder (email) + calendar-style details** (Google/Outlook-like). Not complex.
- Dashboard spec: owner to share later. The attached **Amplior×HungerBox Three-Year Partnership Review PDF** = the reference for premium look + the kind of governance/review/metrics content (meetings delivered, funnel dials→connects→pitches→scheduled→successful, coverage by vertical, enterprise wins, etc.).

### 13.3 Vendor mobile app → web (Phase-1 sales screens to recreate)
The old RN app was the CLIENT sales-team app. Screens (old-code/amplior-mobile-app-main/src/screens):
- Auth: Login / OTP / Forgot / Set-Password.
- Home + small dashboard: Home, MeetingOverview, IndustrySpread, City/Industry graphs.
- Meetings: Meetings (list), StatusWiseMeetings, MeetingDetails.
- Meeting submodules: Lead / LeadDetails, **Feedback**, MeetingReview.
- **Assign/reassign:** SalesPersonModal.
- **Wishlist:** Wishlist, WishListCompanies (+ SearchCompany = pick existing company), WishListView/Details.
- HotProspect / HotProspectPreview; Notifications; Profile.

### 13.4 Feedback flow (confirmed)
- Meetings Amplior generates are handed to the client sales team to attend. **Once a meeting has STARTED, the Feedback option becomes available.**
- **Sales Rep (Sales Person / Sales Head) provides feedback**; Sales Head can edit.
- **Recorded in the CRM** → Amplior agent/TL/managers see the outcome, plus the sales rep and their uplines.
- **Assign/reassign** applies **only to the meetings Amplior generated** for that lead/project.

### 13.5 DATA ISOLATION (critical design rule)
- The client team does **NOT own** the company/contact — they **own only the MEETING records** Amplior generated for them.
- They can **see the company/contact info as captured UP TO their meeting** (a **snapshot** at meeting-generation time) — NOT a live, ever-updating company record.
- They must **NEVER see another project's / another client's meeting on the same shared company** — that would breach others' data. (Companies are shared in the CRM, but each client sees a company only **through the lens of their own meeting**.)
- The snapshot refreshes only if Amplior **generates a new meeting** from that company/prospect for them.
- **Build implication:** snapshot the company/contact fields onto the meeting (or a linked record) at meeting-generation time; portal company views read that snapshot, scoped per project; cross-project visibility is impossible by construction.

### 13.6 "Same live companies/leads/meetings as the CRM" — explained
There is **ONE database**. The portal keeps **no separate copy** — it reads the same records the CRM uses, but each client sees **only their own meeting-scoped slice** (+ the company snapshot above). One source of truth, many isolated views. This is why same-Supabase-project is the right call.

### 13.7 Task Manager (separate CRM module — re-confirmed; ALT-160 / ALT-209)
A **Task Manager** per CRM user (internal: agent/TL/etc.) — schedule or **1-click** create **Call / Meeting / general** tasks, associated to records, with **email + browser reminders** (so a "call this customer" ask isn't forgotten). HubSpot/Zoho-style. To be planned as its own module next.

---
## 14. v4 — BUILD-PATH correction (Ankit, 2026-06-29) — supersedes the snapshot/standalone build

A prior session began a **standalone `new-code/portal` app + a `portal.*` snapshot schema** (denormalised meeting_snapshot + trigger). **Ankit corrected this — it is the wrong build path and is RETIRED.** The reasons + the locked corrected design:

### 14.1 No snapshot, no separate tables — reuse the REAL CRM tables
- The portal reads/writes the **same `public.*` CRM tables**. There is **no copy, no `portal.meeting_snapshot`, no trigger**.
- **The lead is already the snapshot**: contact/company info is captured onto the lead at lead-creation time; later edits to company/contact do **not** retro-change the lead. So §13.5's isolation goal is already met by the existing data model — nothing extra to snapshot.
- **Feedback & remarks** write to the **same CRM tables** (`feedback_answer`, `meeting_master.agent_feedback`) under RLS → they **reflect in the CRM automatically** (Amplior agents/TL/uplines see them). No separate feedback table.
- Client write actions stay minimal: **feedback/remarks** + **request reschedule/cancel** (Amplior still schedules). No company/contact edits.

### 14.2 Same codebase, separate domain (grow the /sales seed)
- The existing in-CRM **`/sales` portal IS the seed** (`new-code/web`). We grow it into the **full** client portal (dashboard, lead reports, meetings, governance/review, ICP/docs, updates, invoices, wishlist, feedback) — **not** a sales-only slice.
- Delivery: **one codebase, white-labeled per brand**, the **same web app served at a separate portal domain in a "portal-only" mode** (login → portal; internal CRM hidden). Not a second codebase to maintain. (Retire the standalone `new-code/portal` app + `portal.*` schema; foundation migration was applied but is unused — drop later with sign-off.)

### 14.3 Scoping = assigned SALES user + downline, behind a per-client SETTING
- Scope on **`lead_report.user_id`** (the **assigned sales user**) — explicitly **NOT** `created_by`/`agent_id` (the internal CRM owner).
- **Sales Person** → own assigned only. **Sales Head** → own + **downline** (via new **`project_user.sales_head_user_id`**). **Company Admin** → all their company's projects.
- **Per-client visibility SETTING (Ankit):** a toggle, **mirrored in CRM project settings AND portal client settings**, decides whether strict own+downline scoping is enforced (sensitive clients) or open within their projects (non-sensitive). Amplior chooses per client.
- Enforcement: **RLS** on the CRM tables (helpers `current_user_id()`, `is_sales_head()`, `sales_downline_ids()` per SALES-PORTAL.md), **validated with throwaway SP/SH logins before prod** (ALT-229 discipline). Query-level scoping in the data layer is the first increment; RLS hardens it.
