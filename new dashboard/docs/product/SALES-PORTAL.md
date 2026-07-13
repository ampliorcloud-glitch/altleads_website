# AltLeads — Sales / Client Portal Spec
*2026-06-18 · grounded in the old vendor mobile app (`old-code/amplior-mobile-app-main`) + current `new-code` + live DB*

## What we're building
A **client-facing Sales Portal** inside the same web app, with a **separate login**. Client sales teams log in here and see **only their project(s)' leads**; they record outreach outcomes — **starting with Feedback**. Amplior internal users can also enter the sales portal (read leads), but sales users can **never** reach the internal CRM screens.

This is the web rebuild of the vendor's **mobile** sales app (which was meeting + feedback centric — a good fit for our outreach-only model).

## Roles & access (confirmed model)
| Role | id | Sees | Can do |
|------|----|------|--------|
| **Sales Person** | 5 | Only **their own** leads (`lead_report.user_id = self`) | Record feedback, update meeting status/schedule on their leads |
| **Sales Head** | 4 | All leads of **their downline** (their sales persons) across their project(s) | Everything a SP does + **assign/reassign** leads + **add Sales Persons** + executive dashboard |
| (Amplior internal) | 1–3,6 | May open the sales portal (read leads) | Their real work stays in the internal CRM |

- **Multiple Sales Heads per project** are allowed → we need a real **downline link** (the old app let a head see *all* project leads; with multiple heads we must distinguish "my team").
- Client/sales users are **provisioned by Admin from Settings** (assigned to project[s]); a Sales Head can then add their own Sales Persons.

## Two login interfaces, one app
- `/login` (existing) = **Lead Gen login** → internal CRM (ADMIN/TEAM_LEAD/AGENT/QC). Harden so **pure sales users are bounced to `/sales`**.
- `/sales/login` (new) = **Sales login** → `/sales/*` subtree behind a new `SalesProtectedRoute` (session + sales-role *or* internal user).
- Same Supabase auth + same backend; the difference is the post-login shell, nav, and route guard.
- `AuthContext` must expose the **full role set** (today it only exposes the single most-privileged `profile.role`) so "internal may enter sales" and "sales blocked from internal" are decidable.

## The downline hierarchy (the one foundational addition)
No manager/parent column exists anywhere today. Add an explicit, project-scoped link:
- **Preferred:** add `sales_head_user_id bigint NULL` to **`project_user`** (a Sales Person's row points at their Sales Head, per project). Supports multiple heads per project; keeps scoping project-aware. (Also add a partial UNIQUE on active `(project_id, user_id)` — today only JS-guarded.)
- New RLS helpers: `is_sales_person()`, `is_sales_head()` (role 5/4), `sales_downline_ids()` (user_ids reporting to me).

**Owner decision (2026-06-18): default = own team, but the Head can SHARE wider.** By default a Sales Head sees only *their* team (their `sales_head_user_id` reports). But a Head can grant another Head/person a broader **"senior viewer"** scope (e.g. see across teams / the whole project) — the Head decides, via an option in the portal. Model this with an explicit **grant table** (`sales_view_grant`: grantee_user_id, project_id, scope `team|project`, optional granted-by) layered into `sales_downline_ids()`/the lead SELECT term, so visibility = (my team) ∪ (anything granted to me). Keeps the default tight while letting Heads open it up case-by-case.

## Data scoping (RLS — additive, keeps internal rules intact)
The authoritative "lead belongs to sales person" link is **`lead_report.user_id`** (NOT `created_by`, which is the internal owner). Add an **additive** SELECT term to `lead_master` (and the reads it drives) — never remove the existing internal floor:
```
... OR EXISTS (
  SELECT 1 FROM lead_report lr
  WHERE lr.lead_id = lead_master.lead_id AND lr.deleted_date IS NULL
    AND lr.user_id IN ( current_user_id()  ∪  sales_downline_ids() )
)
```
- Sales Person → matches `lr.user_id = self`. Sales Head → matches `lr.user_id ∈ downline`. Unassigned leads (no `lead_report`) correctly stay invisible to sales.
- Mirror the term for `lead_report`, `meeting_master`, `feedback_answer` reads, and add a **write** policy on `feedback_answer` (+ `meeting_master.agent_feedback`/status) allowing the assigned SP (or their head) to write.
- ⚠️ These RLS edits touch `lead_master` — **validate with throwaway SP/SH logins before applying to prod**, especially during internal-launch week.

## First CRUD — Feedback (matches "start with feedback")
Recreate the vendor's feedback flow on the web. **Feedback questions apply when the meeting actually happened** (a successful/completed meeting), but the screen must also let the user **reschedule** or **cancel/drop** instead.
1. Questions are server-driven from **`feedback_question_master`** (`feed_que_id, feed_que`). Render Yes/No toggles; the free-text question (vendor hardcoded `feed_que_id == 7`) is a textarea — **don't hardcode the id; treat any non-boolean/feedback question as text, or flag it in data**. Capture the real question set from the live DB.
2. Plus a **Next Meeting / follow-up date** picker.
3. **Outcome at the Submit button (owner, 2026-06-18) — the user picks the meeting outcome:**
   - **Successful** (meeting happened) → save feedback answers + set `meeting_master.meeting_status='Completed'` + `follow_up_date`. *(default once feedback is filled.)*
   - **Reschedule** → date/time + reason → status `Rescheduled` (reuse the existing internal reschedule flow / `updateMeetingStatus`).
   - **Cancel / Drop** ("meeting drop" = cancelled) → reason → status `Cancelled`. *(owner is adding "Drop" as an explicit option now.)*
4. **Submit (Successful)** → INSERT rows into **`feedback_answer`** (one per question, keyed by `meeting_id`), set the meeting Completed + follow-up. Lock after submit. *(This write path does not exist in new-code yet — it's read-only today; build it + its RLS. Reschedule/Cancel reuse existing meeting actions.)*

## Sales-editable fields (from the vendor app) — confirm scope with owner
Sales users were **read/outreach-only** except: **feedback** (above), **meeting reschedule/cancel/complete**, **assign/reassign salesperson** (head only), **wishlist add** (prospect capture), profile photo. Lead/company fields themselves were **not** editable. → **Start with Feedback**; owner to confirm which others (meeting actions next most likely).

## Sales Head "add Sales Person"
New endpoint `POST /api/sales/users/create` + `requireSalesHead` middleware (verify JWT + caller is role 4). It **forces role_id=5**, creates the user (reuse `genTempPassword`/`findAuthUserByEmail`/`ensureProfileLink`), assigns them to the caller's project(s) via `project_user`, and records the **downline link** (caller as their `sales_head_user_id`). Admin still provisions the first Sales Head per project from internal Admin/Settings.

## Executive dashboard (Sales Head) — phase 2 of the portal
Recreate the vendor head dashboard: meeting-status stat strip (Scheduled/Completed/Rescheduled/Dropped/Missed), Revenue Potential, Hot Prospects, Meetings-by-city, Face-to-face vs Virtual %, Industry spread, pipeline funnel. Sales Person gets the simple "today's meetings" view. Date-range filter.

## Build order
1. **Portal shell** (safe, additive): `/sales/login`, `SalesProtectedRoute`, sales `AppShell`/`Sidebar` (Leads + Meetings + Feedback), reuse existing `LeadsPage`/`LeadDetailPage`; harden internal routes to block sales users; expose full roles in `AuthContext`. *(No DB risk.)*
2. **Hierarchy + RLS migration** (`project_user.sales_head_user_id` + helpers + additive lead/feedback policies) — write, then **validate with real SP/SH logins** before prod.
3. **Feedback CRUD** (write `feedback_answer` + complete meeting).
4. **Admin/SH user provisioning** (`/api/sales/users/create`).
5. **Executive dashboard** + assign/reassign.

## Owner decisions for this portal
1. **Downline model** — confirm `project_user.sales_head_user_id` (a SP reports to one SH per project). OK? Multiple SHs per project = yes.
2. **Editable fields beyond feedback** — start with Feedback; confirm meeting reschedule/cancel/complete + assign/reassign next.
3. **Provisioning** — Admin creates the first Sales Head per project (from Settings); SH self-serves Sales Persons. OK?
4. Does the client portal also need the **wishlist "add prospect"** flow at v1, or feedback-only first?

## Future — integrations (added to scope)
Our own **workflow engine + public APIs + MCP server** so AltLeads integrates with other CRMs/tools (two-way sync, webhooks, automation). Tracked separately; design after internal launch + portal v1.

---

## OWNER DECISIONS — 2026-06-21 (portal scope locked + mobile-ditto record view + wishlist)

These supersede/clarify earlier sections. Source of truth for the look = the legacy mobile app `old-code/amplior-mobile-app-main` (React Native). The sales-portal record screen must be an **exact ditto copy of the mobile record screen** — for sales + client-portal users ONLY (internal CRM screens stay as-is).

### 1. Client Portal = meetings of that client, simple (ALT-274)
- The client portal's job is simply to **show that client's meetings** (the meeting list + the record view below). No CRM tabs, no internal machinery. "As simple as that."
- Portal user sees only their client's meetings (scoped by `client_assoc_id` via the portal snapshot/RLS already designed — but keep the surface minimal).

### 2. Sales / Portal RECORD VIEW = single consolidated mobile-ditto screen (ALT-275)
- **Do NOT** show the internal CRM record screens (activity feed, lead-report view, meeting tabs, disposition history, etc.) to sales/portal users.
- Show **ONE single scrollable record view**, a ditto copy of mobile `src/screens/meetings/MeetingDetails.jsx`, in this section order (verified against the mobile code):
  1. **Meeting summary card** — status badge (Confirmed→"Scheduled", Cancelled→"Dropped", Completed/Missed/Rescheduled), company name, meeting name, participant avatars (initials), Sales Person ("SP- name"), date (`ddd, DD MMM, YYYY`), time range + duration, meeting mode (Online/Offline/Telephonic), "Feedback Is Pending"/dropped-reason messages.
  2. **Pre-Sales Questions** — `preSalesAnswersDtos` excluding the "Discussion" question; numbered question (`shortQuestion`) + answer. (Our DB: `pre_sales_answer` joined to `pre_sales_question` via `report_id` — already in `meetings.ts fetchMeetingDetail.preSales`.)
  3. **Company details** (accordion) — Name, Turnover (Rs..Cr), Headquarters (city), Industry, Employee (companySize), Sector, Website, LinkedIn (copy), Address, "Meeting scheduled by <name>".
  4. **Lead Details / Contact** (accordion) — Lead Name, Mobile (copy), Alt Mobile (copy), Designation, LinkedIn (copy), Email, Roles & Responsibilities, Area of Interest + action buttons (Email / Call / Join-or-Location-or-Telephonic by mode).
  5. **Agenda & Notes** (accordion) — meeting description/agenda + "Discussion" answer; Call Recording / View Image buttons (SALES_HEAD only).
  6. **Opportunity Details** (accordion) — Title, Value (Rs.), Description.
  7. **Sales Intelligence** (accordion) — `leadRepostDto.salesIntelligence` free text (newline → bullets).
- Owner's quick description ("presales → company → contact → sales intelligence → meeting") maps to the above; **mobile order is authoritative**.
- **Data-mapping caveat:** our web reads Supabase directly (not the vendor Java DTOs). `meetings.ts fetchMeetingDetail` already resolves most fields (company, client, industry, city, lead, salesperson, stage, feedback, preSales). GAPS to source or mark N/A: company turnover/sector/employee-size/website/linkedin/address, lead altMobile/roleAndResp/areaOfInterest, opportunity title/value/description, salesIntelligence. Audit these columns before/while building; show "N/A" where absent (mobile does too).

### 3. Sales / Portal WISHLIST add (ALT-276) — prospect capture, mobile-style
- Sales/portal users can **add a wishlist** entry by selecting **Company name + Prospect (lead) with Location**. Mirrors mobile `src/screens/wishlist/Wishlist.jsx`.
- Form fields (mobile parity): **Company name** (searchable autocomplete from company master, ≥2 chars; free-text allowed), **Lead/Prospect name** (+ auto-fill designation from the company's leads), **Mobile** (10-digit), **Designation**, **Branch address** (picker from company addresses → auto-fills address/city/state/pincode), **Address line 1 + 2** (required), **State→City cascading dropdowns** (required), **PIN** (required), **Country** (default India), **Description**, optional **geo-tagged image + GPS** (mobile-only; web = optional/skip for v1).
- Submit payload (mobile `addToWishlist`): companyName, company{companyId}|null, leadName, leadNumber(mobile), designation, addressLine1/2, pincode, city{cityId}, wishlistAddress{addressId}|null, latitude/longitude, imageUrl, description, status:'WishList', assignTl/assignAgent = current user.
- Maps to our existing `wishlist` table (already in web `data/wishlist.ts`). Web build = a create form on the Sales/Portal Wishlist screen using our Supabase company/city/state lookups; reuse the internal wishlist data layer where possible.

### Sequencing note
Portal/sales record view + wishlist are net-new builds grounded in the above specs. The project-selector adversarial-review fixes (blocker fixed; ~20 mediums/lows open) are a separate, in-flight cleanup track.
