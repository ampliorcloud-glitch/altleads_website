# Client Portal — Phase-1 Build Plan (Amplior-branded)

> **Status: PLAN — not built.** Epic: **ALT-221** (supersedes old placeholder ALT-161).
> Owner: Mohit (non-technical). Brand of this portal: **Amplior** (the internal CRM stays **AltLeads**).
> Source of truth for decisions: `docs/product/CLIENT-PORTAL.md` §12–§13 (owner interviews, 2026-06-21) + `REBUILD_LOG.md` cont.9/cont.10. Where §12–13 conflict with the older v1 (§1–11), §12–13 win.
> Vendor app being replaced: `old-code/amplior-mobile-app-main` (retired mobile sales app → moves to web).
>
> **Revision (2026-06-21, post-review):** this version closes 4 reviewer gaps — (1) a one-time **snapshot backfill** for all pre-existing meetings; (2) a single, explicit **architecture decision** (a NET-NEW Amplior app, NOT the `/sales` shell); (3) an explicit **ban on reusing live-data CRM pages** (LeadsPage/LeadDetailPage etc.); (4) a corrected **Add/Edit-User bug spec** matching `UsersTab.tsx`. It also adds the missing **notifications RLS policy**, a precise **safe company-name lookup** spec, and **full email-brand parameterization** (header + footer + per-event body copy + subjects).

---

## 0. Plain-language summary (read this first)

**What we are building.** Today, the people on our *clients'* sales teams (their sales heads and sales reps) use an old phone app — built by an outside vendor — to see the meetings we set up for them, give feedback after each meeting, and ask us to go after new companies. We are retiring that phone app and rebuilding the same thing as a **website**, with **Amplior's** brand on it (not the AltLeads name our internal team sees). This is the **Client Portal**.

**Who uses it.** Three kinds of client-side people: a **Company Admin** (the client's top person, who can see everything for their company and add their own users), a **Sales Head** (sees their project plus the people under them), and a **Sales Person** (sees only the meetings assigned to them). Our own Amplior staff (admins, team leads, callers) never log into this portal as clients — they run the CRM.

**The most important safety rule.** All our clients sit in **one shared database**, and many of them may be chasing the *same* company. A client must **never** see another client's meeting, even on a company they both touch. The way we guarantee this: at the moment our team creates a meeting for a client, we take a **photograph (snapshot)** of the company and contact details and attach it to that meeting. The portal only ever shows that snapshot, locked to that client's project. So it is **impossible by design** for one client to see through to another client's work — there is no live, shared company record exposed to clients. Because we have meetings that already exist from the old system, we will run a **one-time backfill** that takes a snapshot of every existing meeting before launch, so the portal is full of data on day one (not empty).

**A simple, separate website (not bolted onto our CRM).** To make the safety rule airtight, the Amplior portal is a **brand-new website with its own screens**, built fresh. It is **not** a re-skin of our internal AltLeads CRM screens. Those internal screens read live, shared company data and could accidentally leak one client's work to another, so the portal does **not** reuse them at all — every portal screen is new and reads only the locked snapshots.

**What clients can actually change.** Very little, on purpose. They can: (1) **ask us** to target a new company (a "Wishlist" request — they cannot create companies themselves), (2) **leave feedback** after a meeting has started, (3) the Company Admin and Sales Head can edit a few project documents (and every save quietly tells our team), and (4) the Company Admin can add/remove their own portal users. Everything else is read-only. **Amplior schedules all meetings** — clients can never create, move, or cancel a meeting from the portal.

**One product, two brands.** The Amplior portal and our internal AltLeads CRM share the **same backend** (already approved on the $25 Supabase Pro plan), so clients see real, live meeting data — but they are **two separate websites on two web addresses**, and neither ever reveals the other exists. The brand (logo, name, colours, even the wording in our automated emails) is switched by a "theme," so we maintain one set of shared building blocks rather than building everything twice.

**Phase-1 order (what we build first).** (1) the **sales screens** — view meetings, assign/reassign them, feedback, wishlist; then (2) **project documents** (ICP/criteria/decks — read, with limited editing); then (3) **governance** — simple email reminders for the review meetings between our team leads and the client's Company Admin. The dashboard/analytics design is deferred until the owner shares the spec.

Everything below this line is the technical detail for the engineers.

---

## 1. Scope and non-goals (Phase 1)

**In scope (this plan):**
1. Sales screens: auth, meeting list / status / detail, assign/reassign, feedback (opens once a meeting has STARTED), wishlist/request-company, notifications, profile, a small dashboard shell. **All are NET-NEW portal pages** (see §6) — no CRM page reuse.
2. ICP / criteria / project docs / decks: read for all; limited edits for Company Admin + Sales Head with a save-confirm + notify-Amplior popup.
3. Governance: review-meeting email reminders + calendar-style detail (Amplior TL/Manager ↔ client Company Admin).
4. Cross-cutting: the data-isolation **snapshot** mechanism **+ a one-time snapshot backfill of all pre-existing meetings**; per-project/per-client RLS (including portal notifications); the white-label (dual-brand) seam **across web AND email (header, footer, subjects, body copy)**; the Add/Edit-User sales-role CRM bug fix; the save-popup "update notification" flow.

**Explicit non-goals (follow-on, NOT ticketed here):**
- Full analytics dashboard spec (deferred — owner to provide; reference look = Amplior×HungerBox 3-Year Review PDF).
- Invoices visibility, "How the week went" weekly summary, AltLeads-light-vs-full decision, full brand/domain list, client-visible column-whitelist final sign-off, pilot-client selection (all OPEN per brief §"Still OPEN").
- Task Manager (ALT-160 / ALT-209) — a **separate internal CRM module**, not a Client Portal item. (Web-push/browser reminders, if any, live there — not here; Phase-1 governance uses email + `.ics` only, so there is no web-push dependency in this plan.)
- Hot Prospect detail/creation flows beyond a read-only list (mobile app had richer flows; trim to "low value, slow" per owner's Phase-1 trim instruction — keep as follow-on).
- Mobile-native features that do not port (camera capture, GPS geo-tag on wishlist) → replaced by optional file upload + free-text address in Phase 1.

---

## 2. Roles, scoping & the capability matrix

Client-side hierarchy: **Company Admin** › **Sales Head** › **Sales Person**, mapping to `role_master` SALES_HEAD / SALES_PERSON plus a portal-level "Company Admin" flag (see §5 data model). The `is_web=false` on sales roles was only because the old app was mobile — they are valid client roles. Amplior-internal roles (ADMIN, TEAM_LEAD, AGENT, QC) **never** log in as client users.

| Capability | Company Admin | Sales Head | Sales Person |
|---|---|---|---|
| See data | ALL their company's projects | Own project(s) + downline records (+ other projects only if explicitly added) | Only own assigned records |
| Manage portal users | Yes (their portal only) | — | — |
| Assign / reassign meetings | Yes | Yes (within their project) | — |
| Meeting feedback | Edit | Edit (in scope) | Provide (own) only |
| Create Wishlist request | Yes | Yes | Yes |
| Edit ICP/criteria/docs/notes/decks | Yes (notify-on-save) | Yes (notify-on-save) | View only |
| Create/reschedule/delete meetings | **No** (Amplior schedules) | **No** | **No** |
| Create company | **No** — Wishlist request only | same | same |

The **only** client-side write actions: (1) Wishlist request; (2) Meeting feedback; (3) Doc/governance edits (Company Admin + Sales Head, notify-on-save); (4) User management (Company Admin, own portal).

**"Sales Head added to other projects" — who grants it (closes review gap):** the matrix line "+ other projects only if explicitly added" is realised as an extra `project_user(project_id, user_id, role_name)` row. **Granting authority = Amplior ADMIN/TL only**, performed from the **CRM** side (the existing project-membership admin surface), **not** from the portal — clients cannot widen their own scope. Phase-1 has **no** portal screen for this; it is an Amplior back-office action. (If owner later wants the client Company Admin to grant cross-project access, that is a follow-on ticket with its own RLS review.)

**Scoping fields (from existing CRM schema, grounding §2):**
- `client_association.client_assoc_id` — the client/account.
- `project.project_id` (FK `client_assoc_id`) — which project owns a lead/meeting.
- `project_user(project_id, user_id, role_name)` — who works on each project (defines downline membership AND the "explicitly added to another project" grant above).
- `lead_report.user_id` — assigned salesperson (the assign/reassign target).
- Meetings via `meeting_schedule` (report_id ↔ meeting_id) → `meeting_master` / `meeting_schedule`.

---

## 3. Data isolation + SNAPSHOT mechanism (the load-bearing design)

**Rule (verbatim, §13.5):** clients do **not** own the company/contact — they own only the **meeting records** Amplior generated for them; they see the company/contact **as captured up to their meeting** (a snapshot), not a live record; they must **never** see another project's/client's meeting on the same shared company; the snapshot refreshes **only** when Amplior generates a new meeting for them.

**Concrete build (locked):** snapshot the company/contact fields onto the meeting at meeting-generation time. The portal reads the snapshot, scoped per project — cross-project/cross-client leakage is impossible by construction because the portal never queries the live shared `company_master`/`contact_master` at all. (This guarantee only holds if **no portal page reuses a live-data CRM page** — see §6's hard ban.)

### 3.1 New table: `portal.meeting_snapshot`
Written by Amplior's CRM at the moment a meeting is generated for a client (one row per generated meeting), **and** seeded once by the backfill (§3.4). Columns:
- `meeting_id` (PK, FK → `meeting_schedule`/`meeting_master`).
- `project_id` (FK → `project`) and `client_assoc_id` (FK → `client_association`) — **denormalized onto the row** so every isolation filter is on the snapshot itself, never a join back to shared tables.
- `lead_report_id` (FK → `lead_report`) and `assigned_user_id` (= `lead_report.user_id` at snapshot/assign time).
- Snapshot of company fields (copied, not referenced) — **exact column set is BLOCKED on the client-visible column-whitelist sign-off (still OPEN, §12).** Do **not** finalize the schema with a guessed "etc." Candidate fields pending sign-off: `company_name`, `industry`, `city`, `state`, `address`, `website`. **Build the table only after the whitelist is signed off**, or build it with the minimal launch set and ALTER once whitelist lands (whichever the owner prefers — flagged in §12).
- Snapshot of contact/lead fields: `contact_name`, `designation`, `phone`, `email`, plus the Amplior pre-sales Q&A captured for that lead (read-only context for the rep) — same whitelist gate applies.
- Meeting fields: `meeting_datetime_from/to`, `duration`, `mode` (F2F/Online/Telephonic), `status`, `address_if_f2f`, `started_at` (drives the feedback gate, §6).
- `snapshot_taken_at`, `snapshot_refreshed_at`, `snapshot_source` (`'backfill'` | `'live'`) so we can tell seeded rows from live-generated ones.

> **Data-dictionary note (closes review gap):** because the client-visible column whitelist is explicitly OPEN, the snapshot table's company/contact columns are **NOT final**. ALT-223 (snapshot table) is **gated on** the whitelist sign-off (ALT-243 / §12). Engineers must not silently include extra columns.

### 3.2 Snapshot writer (CRM side) — the live path
When Amplior's CRM generates a meeting (or re-generates from the same prospect), an **upsert** into `portal.meeting_snapshot` copies the current company/contact/lead fields. This is the **only** moment a live row's snapshot changes — matching "refreshes only if Amplior generates a new meeting." Implemented as a notify-service service-role endpoint (or DB trigger on meeting creation — **integration point still OPEN, §12; until chosen and wired, NO new meeting produces a snapshot**), so the browser never writes it.

> **Operational expectation (by design, must be surfaced):** if a meeting is scheduled and the company/contact is later corrected in the CRM, the portal keeps showing the *snapshot-time* values until Amplior regenerates the meeting. Clients will not see live company edits. This is intentional per the locked model (§11).

### 3.3 Portal-facing curated views (clients touch ONLY these)
Clients get **zero** grants on base tables — only on `SECURITY INVOKER` views that read `portal.meeting_snapshot`:
- `portal_meetings` — meeting list/detail rows from the snapshot.
- `portal_companies` — company-as-seen-through-the-snapshot (per-project lens; no live `company_master`).
- `portal_feedback` — feedback rows joined to a snapshot the caller is allowed to see.
- `portal_wishlist` — the caller's own/scoped wishlist requests.
- `portal_notifications` — the caller's own portal notifications (RLS-scoped, §4).
- `portal_dashboard_metrics` — pre-aggregated counts scoped per project (no row-level company leakage).

Because every portal view selects from the snapshot (which carries `project_id` + `client_assoc_id` + `assigned_user_id`), the RLS filter (§4) is uniform and a missing join can never expose a sibling client's row.

### 3.4 One-time SNAPSHOT BACKFILL (closes the critical review gap) — MUST run before go-live
**Why:** data for ~111 users and their meetings was already bulk-migrated. The live writer (§3.2) only fires on *new* meeting generation, so **without a backfill the portal would be empty on day one** for every pre-existing meeting.

**What:** a one-time **migration applier** (`new-code/migration/*.cjs`, service-role; raw SQL gitignored, applier tracked) that, for **every pre-existing meeting**, inserts a `portal.meeting_snapshot` row populated from the **current** values in `company_master` / `contact_master` (or contact source) / `lead_report` (for `assigned_user_id` and pre-sales Q&A) / `meeting_schedule`/`meeting_master` (for the meeting fields), with `snapshot_source='backfill'`, `snapshot_taken_at = now()`.

**Properties:**
- **Idempotent** — upsert on `meeting_id`; safe to re-run; never double-inserts.
- **Whitelist-bound** — copies only the signed-off column set (§3.1 / §12). Gated on the same sign-off.
- **Sequenced before go-live** and **after** the snapshot table + views + RLS exist and have passed throwaway-login validation (§4). Build order: table → views → RLS → **validate** → **backfill** → live writer wired → launch.
- **Validated** — after backfill, re-run the adversarial throwaway-login checks (no cross-client read) on real backfilled volume, not just synthetic rows.

This makes the portal non-empty at launch and keeps the live writer as the only ongoing refresh path.

---

## 4. RLS / access enforcement

**Auth & gating (grounding §1):** a **separate portal login** (its own Supabase Auth users; the Amplior portal app, §5). A new `portal.client_portal_user(auth_uid → client_assoc_id, portal_role, enabled)` ties one Supabase Auth user to exactly one client and one portal role (COMPANY_ADMIN / SALES_HEAD / SALES_PERSON). Route guard accepts only enabled portal users; everything else redirects to the portal login. (This is the portal's **own** guard in the new app — it is *not* the CRM's `SalesProtectedRoute`/`/sales` shell; see §5/§6.)

**RLS policies on `portal.meeting_snapshot` (and thus all snapshot-backed portal views):**
- **Company Admin:** `client_assoc_id = (caller's client_assoc_id from client_portal_user)` — sees all their company's projects.
- **Sales Head:** `project_id IN (caller's project_user rows)` **OR** `assigned_user_id IN (caller's downline user_ids)` — own project(s) + downline; "other projects only if explicitly added" = the extra `project_user` row granted by Amplior (§2).
- **Sales Person:** `assigned_user_id = caller's user_id` — own assigned records only.

Downline resolution: a helper `portal.downline_user_ids(auth_uid)` returns the set of user_ids reporting to a Sales Head (derived from `project_user` + the SALES_HEAD/SALES_PERSON role rows in scope). Used by the Sales-Head policy.

**Write policies:** wishlist insert (all three roles, own row), feedback insert/update (Sales Person own; Sales Head in-scope), doc edits (Company Admin + Sales Head), user management (Company Admin, rows where `client_assoc_id` = theirs). **No** insert/update/delete policy exists for meetings from the portal role — meeting create/reschedule/delete is structurally impossible for clients.

**Notifications RLS (closes review gap — §6 ships a feed, so it MUST be scoped here):** portal notifications live in a **portal-owned** table `portal.notification(id, recipient_auth_uid, client_assoc_id, project_id, kind, payload, read_at, created_at)` — **NOT** the CRM's `in_app_notification` table (that is staff-only and stays ungranted to clients). RLS:
- **SELECT/UPDATE(read_at):** `recipient_auth_uid = auth.uid()` **AND** `client_assoc_id = (caller's client_assoc_id)` — a portal user sees only their own notifications, never another client's. Defense-in-depth: both the recipient and the client scope must match.
- **INSERT:** service-role only (notify-service writes them); no client insert.
The `portal_notifications` view (§3.3) reads this table under the same predicate.

**Wishlist company-name lookup ("safe lookup") — exact spec (closes review gap):** Wishlist `SearchCompany` must NOT expose the shared company graph. Define a dedicated read path `portal.company_name_suggest(q text)` (SECURITY DEFINER, called via a scoped view/RPC) that:
- Returns **only** `{ company_name }` (display name) — **no** `company_id` exposed to the client, **no** industry/website/enrichment, **no** address, **no** owner/account, **no** "X clients targeting this," **no** count of any kind, **no** indication another client targets the company.
- Is **name-text only**: a typeahead that returns up to N distinct names matching `q`. It is purely a typo-saver so the client's request reconciles cleanly later; selecting a name does **not** confirm the company is in any client's pipeline.
- Reconciliation to a real `company_id` happens **server-side, Amplior-side**, when an agent/TL processes the request — never in the client's browser, never revealing existing records.
This guarantees the lookup cannot reveal that another client is targeting the same company.

**Non-negotiable process (HARD GATE):** every RLS change is **validated with throwaway role logins** (one per portal role, on a non-prod-leaking test client) **before** touching prod — adversarially test that a Sales Person cannot read a peer's meeting, that no client can read another client's snapshot, **and that no client can read another's notifications**. This is a **release gate**, not a nicety: same-Supabase-project isolation is one misconfigured grant or one reused live-data page away from a cross-client breach (§11). Re-run the full adversarial suite **after the backfill** on real volume. Mirrors the existing staff-RLS discipline and the owner's "don't do production-facing RLS changes without showing me" rule.

---

## 5. Architecture + White-label (dual-brand) seam — ONE explicit decision

**Requirement (verbatim, §12.6/§13.1):** one product, white-labeled per brand (logo/name/colours/domain); brand isolation absolute (an Amplior client never sees AltLeads and vice-versa; neither knows the other or the shared backend exists); 2 domains now, more later; **same Supabase project** (Pro $25, approved).

### 5.1 DECISION (resolves the "/sales shell vs separate app" contradiction): **a brand-new Vite app**
Phase-1 Client Portal is a **brand-new, separate Vite application** (its own build + its own Hostinger deploy + its own Amplior domain). It **shares ONLY** low-level, data-free **brand primitives and the data layer**:
- shared UI primitives (Modal, ConfirmDialog, Toast, Skeleton, ErrorBoundary, Badge/StatusBadge, SearchSelect, ActivityTimeline) — extracted/reused as presentational components;
- the `BrandContext` + CSS-var theming seam (§5.2);
- the Supabase client + `portal_*` data-access helpers.

It does **NOT** share, import, or reuse:
- the CRM's `/sales` route shell (`SalesProtectedRoute`, `SalesShellProvider`/`useIsSalesShell`, `SalesSidebar`, the CRM `AppShell`); **and**
- **any** CRM page that reads live data — explicitly `LeadsPage`, `LeadDetailPage`, and every other `company_master`/`lead_report`-querying page.

**Why the `/sales` shell is rejected here:** `SalesShellContext.tsx` is just a React context flag *inside the existing CRM bundle* whose entire purpose (per its own docstring) is to let **reused CRM pages — LeadsPage, LeadDetailPage —** render a sales-flavored nav while still querying live `company_master`/`lead_report`. Reusing that shell would (a) put portal code inside the AltLeads bundle (breaking brand isolation) and (b) reuse live-data pages (breaking data isolation). Both are disqualifying. The `/sales` shell remains an **internal CRM** convenience and is out of scope for the portal.

> The `/sales` shell may continue to exist for internal staff convenience; this decision only forbids the **portal** from building on it.

### 5.2 Brand seam (CSS vars + BrandContext) — shared, data-free
- `BrandContext` — `useBrand()` returns `{ name, colors, helpUrl, domain }`. Brand resolved at startup from `VITE_BRAND` (build-time per deploy) and/or `window.location.hostname`.
- `index.css` gains `:root[data-brand="amplior"]` / `[data-brand="altleads"]` token blocks; app sets `document.documentElement.dataset.brand` on boot. `Logo`, login pages, error fallbacks, help links all read `useBrand()` + CSS vars.
- **Brand isolation by construction:** the two deploys are separate origins/domains with separate brand env; no cross-brand link, asset, or copy appears in either build. A client only ever loads the Amplior bundle.

### 5.3 Email brand — FULL parameterization (closes review gap; `notify-service/email-templates.js`)
The email builder currently hard-codes the AltLeads brand in **three** places — all must be driven by a `brand` payload (and/or `BRAND_NAME` / `BRAND_COLOR` / `BRAND_APP_URL` env), defaulting to AltLeads so existing CRM emails are unchanged:
1. **Header wordmark — line 62:** `<div class="logo"><span>Alt</span>Leads &nbsp;|&nbsp; Amplior CRM</div>` → render from `brand.name` (Amplior portal emails show the Amplior wordmark, no "AltLeads").
2. **Footer line — line 68:** `You're receiving this because you're part of the team on AltLeads CRM.` → must read `brand.name` (e.g. "…part of the team on Amplior."). This was previously missed.
3. **Subjects — `subject()` lines 260–268 (and default 268):** every `[AltLeads]` prefix → `[${brand.name}]`.
4. **Per-event body copy — lines 99–243 / 286:** in-body brand mentions must be parameterized, specifically the recurring strings **"…a new lead in AltLeads"** (line 104), the CTA labels **"Open lead in AltLeads"** (lines 110, 126, 191), the wrap titles **"… — AltLeads"** on every template, and the default **"a new notification from AltLeads"** (line 286). All become `${brand.name}` so no AltLeads copy bleeds into an Amplior client email.
- Also parameterize accent colour (`#1A7EE8` header/CTA) via `brand.color` and the action `APP_URL` base (line 18) via `brand.appUrl` so deep links point at the Amplior portal domain, not `crm.altleads.com`.
- The notify-service is our own Express service, so this seam is fully buildable; the change is additive (brand defaults to AltLeads).

---

## 6. Phase-1 build (1) — SALES SCREENS

**Build posture (HARD RULE):** **every portal screen below is a NET-NEW page in the new Amplior app (§5.1) and reads ONLY the `portal_*` snapshot-backed views/tables.** It is **forbidden** to reuse `LeadsPage`, `LeadDetailPage`, or any CRM page that queries live `company_master` / `lead_report` / `contact_master` / `meeting_master`. Reusing a live-data page silently breaches the isolation guarantee — so we don't. Only **presentational** primitives (Modal, ConfirmDialog, Toast, Skeleton, ErrorBoundary, Badge/StatusBadge, SearchSelect, ActivityTimeline) and the brand seam are shared; they carry no data and no live queries. The portal also has its **own** auth guard + shell (not `SalesProtectedRoute`/`SalesSidebar`). We port the vendor mobile screens' *layout/flow* to responsive web as new components.

**Screens & role-scoped views (all reading `portal_*`):**
- **Auth:** Login / OTP / Forgot / Set-Password (separate portal login; OTP optional in Phase 1 if email-link reset is simpler — confirm). All roles.
- **Home + small dashboard shell:** greeting, meeting-overview status cards (Scheduled/Completed/Rescheduled/Dropped/Missed with the locked colour codes), date-range selector. Sales-Head extras (revenue/pipeline/industry/city graphs, hot-prospect count) gated by role; Sales-Person sees only "today's meetings." **Full chart spec deferred** — ship the shell + status cards now; reads `portal_dashboard_metrics`.
- **Meetings list / StatusWiseMeetings / MeetingDetails (NEW pages):** read `portal_meetings` (snapshot). Company Admin sees all company projects; Sales Head sees own project + downline + an "Unassigned (this project)" bucket; Sales Person sees own assigned only. Detail shows snapshot company/contact, pre-sales Q&A, status, mode, address-if-F2F, assigned rep. **No** reschedule/drop/cancel buttons (Amplior-only) — those vendor actions are removed.
- **Assign / reassign (SalesPersonModal, NEW):** Company Admin + Sales Head only; updates `lead_report.user_id` **for the Amplior-generated meeting only** (scoped to in-project candidates from `project_user`) via a service-role/RLS-checked write path — **not** by reusing the CRM lead page; fires `lead_reassigned` email via notify-service (brand=Amplior).
- **Lead / LeadDetails (NEW page):** read-only snapshot lead profile (company, industry, contact, Amplior pre-sales answers) from `portal_meetings`/`portal_companies`. **Not** the CRM `LeadDetailPage`.
- **Feedback (gated):** "Once a meeting has STARTED, Feedback becomes available" → enabled only when `meeting_snapshot.started_at <= now()`. Sales Person provides feedback (own); Sales Head can edit (in scope); MeetingReview = read-only view of submitted feedback. Recorded so Amplior agent/TL/managers + the rep's uplines see it. Writes `portal_feedback`; fires an in-app (`portal.notification`) + email notify to Amplior.
- **Wishlist / SearchCompany / WishListView / Details (NEW):** pick an existing company via the **safe name-only suggest** (§4 — returns `{company_name}` only, no ids/enrichment/counts/owner) OR type a new name as free text → request routes to an Amplior agent/TL who **reconciles to the nearest existing company server-side before it enters the DB** (protects shared company data). Camera/GPS from mobile replaced by optional file upload + free-text address. All roles can create; list shows own/scoped requests with Sent/Converted status.
- **Notifications:** timeline feed scoped to the user; tap-through to meeting detail. Reads `portal_notifications` (the **portal-owned** `portal.notification` table, RLS-scoped per recipient + client_assoc_id, §4) — **not** the CRM `in_app_notification` table. UI reuses the bell **pattern**, not the CRM data source.
- **Profile:** name/email/role, change password, help-desk contact, logout. All roles.

---

## 7. Phase-1 build (2) — ICP / CRITERIA / DOCS / DECKS

- **Screens:** a project "Documents & Criteria" area — ICP/criteria fields, uploaded docs/decks (PDF/PPT), review-notes/notes. New portal pages.
- **Views:** all client roles **read** (scoped to their project/company). **Edit** = Company Admin + Sales Head only; Sales Person view-only.
- **Storage:** per-client/per-project Supabase **Storage** buckets (or a `portal.document` metadata table + scoped bucket paths). RLS/path scoping by `client_assoc_id`/`project_id`; clients never see another client's bucket. Validated by the same throwaway-login gate (§4).
- **Save flow (the "update notification" rule, §7/§12.3):** on Save of an edit → a **confirmation popup**; on confirm, save **and notify Amplior ADMIN + TL + that project's users** that it was updated (notify-service `record_updated`-style event + a `portal.notification` row). Reuse ConfirmDialog + Toast + `useUnsavedChanges` (presentational only).

---

## 8. Phase-1 build (3) — GOVERNANCE

- **What it is (§13.2):** a **review meeting** between Amplior leaders (TL/Manager) and the client **Company Admin**. Build = **just a meeting reminder (email) + calendar-style detail** (Google/Outlook-like). "Not complex." **Email + `.ics` only — no web push** (web push lives in the separate Task Manager module, out of scope §1).
- **Screens:** a Governance list (upcoming/past review meetings) + a calendar-style detail (date, time, attendees, agenda/notes, join link). Read-only for clients (Amplior schedules).
- **Backend:** new notify-service event `governance_meeting_reminder` (+ template builder, brand-parameterized per §5.3). Reminder emails to the Company Admin + Amplior TL/Manager ahead of the meeting; detail page renders the schedule + an "add to calendar" (`.ics`) link.
- **Data:** small `portal.governance_meeting(project_id/client_assoc_id, datetime, attendees, agenda, notes, join_url)` table; RLS scoped like everything else.

---

## 9. Cross-cutting tickets

- **Add/Edit-User sales-role CRM bug fix (CORRECTED spec — see `UsersTab.tsx`):**
  - **What actually works today:** **Add User** already CAN assign Sales Head / Sales Person — its dropdown uses a hard-coded `ROLES` array (lines 28–35) that includes `{id:4,'Sales Head'}` and `{id:5,'Sales Person'}`. So "Add User can't pick sales roles" is **NOT** the bug.
  - **The real bug (Edit User):** the **Edit roles** modal builds its checkbox list as `roleOptions = [...webRoles, ...extras]` (lines 648–656), where `webRoles` = `lookups.roles.filter(r => r.is_web)` (line 74) and `extras` = only the non-web roles the user **already holds** (lines 651–655). Because SALES_HEAD / SALES_PERSON have `is_web=false`, they appear **only if the user already has them**. Result: **you cannot ADD a sales role to a user who lacks it** from Edit — the option simply isn't rendered.
  - **The fix:** make SALES_HEAD / SALES_PERSON **always-selectable options** in the Edit modal's role list — either extend `webRoles` to include them, or explicitly append the sales roles to `roleOptions` regardless of current holdings (keeping the `(non-web)` tag for clarity). This unblocks Amplior ADMIN editing existing client users to grant a sales role. Quick, isolated CRM change; can land early/independently.
- **Provisioning:** Amplior ADMIN onboards the client + creates the first **Company Admin** login (notify-service `/api/users/create` extended for portal users → also writes the `portal.client_portal_user` row); the Company Admin then adds their own sales heads/people. Amplior ADMIN can also create client/sales users directly.

---

## 10. Build order & dependencies (summary)

1. **Foundation:** Supabase Pro confirm + `portal` schema/role; `client_portal_user`; **column-whitelist sign-off (gates the snapshot schema)**; snapshot table; curated views (incl. `portal_notifications`); `portal.notification` table; RLS (snapshot + wishlist + feedback + docs + notifications + governance) + **throwaway-login validation (hard gate)**; brand seam (web + email parameterization) + **new Amplior frontend app skeleton** (§5.1, not the `/sales` shell).
2. **Snapshot writer (live path)** wired into the CRM meeting-generation path (endpoint vs trigger — decide §12).
3. **One-time snapshot BACKFILL applier** → run after RLS validation, before go-live; **re-validate isolation on backfilled volume** (§3.4).
4. **Sales screens** (all NET-NEW pages reading `portal_*`): auth → meetings/detail → assign/reassign → feedback → wishlist → notifications/profile → dashboard shell.
5. **Docs/ICP/decks** (+ save-popup notify flow).
6. **Governance reminders** (email + `.ics`).
7. **CRM Edit-User role bug fix** (can land independently, early).

Go-live gate: foundation validated → snapshot writer wired → **backfill run + re-validated** → portal screens shipped.

---

## 11. Risks

- **Multi-tenant leak** is existential (trust product). Mitigated by the snapshot-only design + clients-touch-only-views + **net-new portal pages (no live-data CRM page reuse)** + adversarial throwaway-login RLS testing before prod **and after backfill**.
- **High blast radius / same-project isolation:** on the approved Pro plan, isolation rests entirely on (a) clients getting ZERO grants on base tables and (b) all portal reads going through SECURITY INVOKER snapshot views with correct RLS. One misconfigured grant or one reused live-data page = cross-client breach. The §4 throwaway-login validation is therefore a **hard release gate**, not optional. Architect portal reads through the thin view layer so a later move to a fully separate Supabase project stays possible.
- **Empty-portal-on-day-one** (now mitigated): without the §3.4 backfill the portal would show nothing for pre-existing meetings. Backfill is sequenced before go-live.
- **Snapshot staleness is by design** (refresh only on new meeting) — must be clearly communicated so clients don't expect live company updates (§3.2 operational note).
- **Snapshot writer integration point unwired** (endpoint vs trigger, §12): until chosen and wired, no new meeting produces a snapshot — a hard dependency. The backfill covers existing meetings; the writer must cover all future ones before launch.
- **Email brand bleed:** until §5.3's header **and footer and subjects and body copy** are all parameterized, an Amplior client could receive an "AltLeads" email. Full parameterization required, not just the header.
- Scope creep from the deferred dashboard — keep the shell minimal until the owner shares the spec.

---

## 12. Open questions (owner decisions still needed)

Carried from brief "Still OPEN": AltLeads portal = full product or lighter sales-only; full brand list + domains; dashboard scope per role; invoices visibility; weekly-summary phasing; Phase-1 page-trim ("remove slow + low value"); **client-visible column whitelist sign-off — this BLOCKS the snapshot table schema (§3.1) and the backfill column set (§3.4)**; pilot client. Plus: OTP vs email-link for portal auth; exact downline definition source (`project_user` vs a reporting table); **who triggers the snapshot writer (notify-service endpoint vs DB trigger) — blocks the live snapshot path (§3.2)**; whether the client Company Admin (vs Amplior only) may later grant a Sales Head cross-project access (§2; Phase-1 = Amplior-only, CRM-side).

---

## 13. Ticket map (ALT-222 .. ALT-245)

Epic **ALT-221** (Client Portal — Amplior). Phase-1 tickets:

| ID | Title | Notes |
|---|---|---|
| ALT-222 | `portal` schema + role + `client_portal_user` | Foundation. |
| ALT-223 | `portal.meeting_snapshot` table | **Gated on column-whitelist sign-off (ALT-243).** |
| ALT-224 | Snapshot writer (live path) | Endpoint vs trigger OPEN (§12). |
| ALT-225 | **One-time snapshot BACKFILL applier** | Idempotent; run before go-live; re-validate after. |
| ALT-226 | Curated `portal_*` views (incl. `portal_notifications`) | SECURITY INVOKER. |
| ALT-227 | RLS policies (snapshot/wishlist/feedback/docs/governance) | Throwaway-login gate. |
| ALT-228 | **Portal notifications table + RLS** (`portal.notification`) | Per recipient + client_assoc_id. |
| ALT-229 | Adversarial throwaway-login RLS validation (HARD GATE) | Pre-prod + post-backfill. |
| ALT-230 | **New Amplior Vite app skeleton** (separate build/deploy/domain) | NOT the `/sales` shell. |
| ALT-231 | Brand seam — web (BrandContext + CSS vars) | Shared, data-free. |
| ALT-232 | Brand seam — email full parameterization | Header+footer+subjects+body copy+accent+appUrl. |
| ALT-233 | Portal auth (login/forgot/set-password) | Own guard. |
| ALT-234 | Meetings list / status / detail (NET-NEW pages) | `portal_meetings` only. |
| ALT-235 | Assign / reassign (SalesPersonModal) | RLS-checked write; `lead_reassigned` email. |
| ALT-236 | Lead / LeadDetails (NET-NEW read-only) | Snapshot only; not CRM `LeadDetailPage`. |
| ALT-237 | Feedback (started-gated) + MeetingReview | Writes `portal_feedback`; notifies Amplior. |
| ALT-238 | Wishlist + **safe name-only company suggest** | `{company_name}` only; server-side reconcile. |
| ALT-239 | Notifications feed | Reads `portal_notifications`. |
| ALT-240 | Home + dashboard shell + Profile | Charts deferred. |
| ALT-241 | Docs/ICP/criteria/decks + save-popup notify flow | Edit = Company Admin/Sales Head. |
| ALT-242 | Governance reminders (email + `.ics`) + detail page | `governance_meeting_reminder` event. |
| ALT-243 | **Client-visible column whitelist sign-off** (Spike/decision) | Blocks ALT-223 + ALT-225. |
| ALT-244 | **CRM Edit-User sales-role bug fix** (`UsersTab.tsx`) | Make SALES_HEAD/SALES_PERSON selectable in Edit. Independent/early. |
| ALT-245 | Provisioning: Company-Admin login creation | Extends `/api/users/create`; writes `client_portal_user`. |

---
## Decisions LOCKED — 2026-06-21 (owner go to build)
- **Column whitelist (ALT-243): RESOLVED.** Clients see **everything the vendor mobile-app user could see** — the full field set the old client app surfaced for meetings/leads/companies. Owner will refine later (eventual target: "all that any project CRM user can see"). → Build the `meeting_snapshot` columns from the **mobile-app field set** (see the mobile inventory referenced in the plan), not a guessed subset.
- **Snapshot writer (ALT-224): RESOLVED (owner delegated to Claude).** Mechanism = a **SECURITY DEFINER Postgres function fired by a DB trigger** (AFTER INSERT/UPDATE on the meeting source). Chosen over an app endpoint because the snapshot is isolation-critical and must be **atomic + unbypassable** (never forgotten at a call site). Browser never writes snapshots.
- **Build go:** owner said "lets start building." Migrations are authored as appliers but **applied to the live DB only after owner sign-off + the throwaway-login RLS validation (ALT-229)**.

---
## BUILD STATUS — foundation migrations (2026-06-21, STAGED — not applied)
Authored + adversarially reviewed + revised (code only; **do not apply until ALT-229 throwaway-login validation passes**):
- `apply-portal-foundation.cjs` — portal schema, client_portal_user, meeting_snapshot (denormalised project_id+client_assoc_id+assigned_user_id per row), SECURITY-INVOKER portal_* views, portal.notification; clients granted SELECT on views only, ZERO on base tables.
- `apply-portal-rls.cjs` — review caught two EXISTENTIAL gaps, both fixed: (1) policies target the real **authenticated** role gated by `portal.caller_client_assoc_id() IS NOT NULL` (the earlier unbridged `portal_client` role is removed); (2) **base-table leak closure** — an `AS RESTRICTIVE deny_portal_session` policy is added to every RLS-enabled public table so a portal session fails the CRM's permissive `USING(true)` base-table reads, while CRM staff (NULL) are unaffected. This is a CRM-wide RLS change → the ALT-229 break-in test is mandatory before apply.
- `apply-portal-snapshot-writer.cjs` — SECURITY DEFINER `portal.write_meeting_snapshot()` + AFTER INSERT/UPDATE trigger (Decision D); `REVOKE EXECUTE FROM PUBLIC`.
- `apply-portal-snapshot-backfill.cjs` — idempotent backfill of existing meetings.

**Remaining VERIFY items before apply (caught in review):** `started_at` cast on free-text `meeting_time` (guard dirty values), deterministic meeting→lead_report resolution (avoid wrong-tenant stamp on reschedules), backfill completeness gate must abort (not just print), and the `downline_user_ids()` definition (currently project co-membership) needs the owner's reporting-tree decision.
