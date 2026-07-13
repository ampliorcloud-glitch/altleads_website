# AltLeads CRM — Role Walkthroughs & Standing QC Checklist

**Scope:** Internal CRM + Sales Portal. Six roles: ADMIN (1), TEAM_LEAD (2), AGENT (3), SALES_HEAD (4), SALES_PERSON (5), QC (6).  
**Source of truth:** `AuthContext.tsx`, `App.tsx`, `Sidebar.tsx`, `SalesSidebar.tsx`, `LeadsPage.tsx`, `LeadDetailPage.tsx`, `AdminPage.tsx`, `ApprovalsPage.tsx`, `ImportPage.tsx`, `SalesMeetingDetailPage.tsx`, `UAT-ROLE-MATRIX.md`, `HUNGERBOX-LAUNCH.md`.  
**Last updated:** 2026-06-28. Refresh whenever a new ALT ticket changes a guard, nav item, or RLS policy.

---

## Pre-read: What is live vs. pending

The walkthroughs below describe behaviour as the code stands today. Several HungerBox-specific features are **not yet built** — they are flagged inline as "pending." Do not UAT those steps until the listed ticket is applied.

| Feature | Status | Ticket |
|---------|--------|--------|
| DNC reddish blur + non-contactable | **Pending** | ALT-452 |
| Feasibility model + reddish blur | **Pending** | ALT-453 |
| Metro priority flag + sort/filter | **Pending** | ALT-454 |
| Company-site / per-site prequalified questions + edit history | **Pending** | ALT-455 |
| Feasible/metro work-queue filters | **Pending** | ALT-456 |
| Write gatekeeper (server-side) | **Pending** | ALT-431 |
| Assignment-aware RLS (agents can edit assigned leads) | **Pending** | ALT-152 |
| Import Wizard server-side write path | **Pending** | ALT-399 |
| Sales portal RLS scoping to downline | **Pending** | (follow-on) |
| Bulk login provisioning | **Pre-launch blocker** | GAP-1 |

---

## Role 1: ADMIN (data person / super-admin)

### Who is this?
The person who imports data, provisions logins, manages project membership, edits reference data, and can do anything any other role can do. At HungerBox launch there are 5 ADMIN accounts; only 2 currently have auth logins.

### Sidebar (what they see)
Dashboard · Leads · Companies · Contacts · Meeting · My Tasks · Wish List · Notifications · Approvals · **Import** · **Recycle Bin** · **Super Admin** · Settings · Log Out.  
The bottom-left shows Import, Recycle Bin, and Super Admin — these are hidden from all other internal roles.

### Happy-path: First login
1. Navigate to `crm.altleads.com` → the Login page renders (email + password).
2. Enter admin credentials → on success, redirected to `/dashboard`.
3. Dashboard shows stat cards: total Leads, today's Meetings, pipeline summary, recent activity. The admin's name/role appear in the top bar.

### Happy-path: Load data (HungerBox import)
4. Click **Import** in the sidebar → `/import`.
5. The Import Wizard opens. Choose entity type (Companies / Contacts / Leads), upload a CSV or XLSX file.
6. Wizard parses and maps columns → shows a preview with validation errors per row.
7. **PENDING (ALT-399):** The final "Import" action button is currently disabled — the server-side write endpoint does not yet exist. Admin can validate the file but cannot execute the import in-app. Workaround: use Supabase dashboard or a migration script.

### Happy-path: Provision logins for agents/team-leads
8. Click **Super Admin** in the sidebar → `/admin` → "User" tab.
9. The users list shows all 112 users with their roles, enable/disable toggle, and an Edit icon.
10. To provision a login: click the **Add** button (top-right of the Users table) → fill Name, Email, Role, Mobile → Save. This creates a Supabase Auth user and a `profiles` row.  
    **Note:** Bulk provisioning (110 users at once) is done via the notify-service `/admin/provision-logins` endpoint — not the UI one-by-one flow. This is a pre-launch blocker (GAP-1).
11. To reset a password: find the user row → Edit icon → "Reset password" action.

### Happy-path: Assign project membership
12. Still in `/admin`, click **Project Access** tab.
13. Assign the desired users (agents, team leads) to the HungerBox project.  
    **Critical:** Any AGENT without a `project_user` entry for their project sees zero leads after login (GAP-3 — 4 of 18 agents currently have no project membership).

### Happy-path: Bulk-mark DNC / Feasibility (pending ALT-452 / ALT-453)
- **Pending.** DNC and Feasibility models are not yet built. Once ALT-452/453 land, the admin will be able to bulk-mark companies or company-sites as DNC / non-feasible via the import engine or an in-app admin action. The contacts at those sites will render with a reddish blur and call/email actions will be disabled.

### Happy-path: Day-to-day admin (leads, reassign, approvals)
14. Click **Leads** → `/leads`. Sees all leads across all projects (full visibility). Can filter by project, stage, city, agent, salesperson, date ranges.
15. Select leads (checkbox) → **Reassign (n)** bulk button appears → pick a new salesperson → confirm.
16. Open a lead → sees the full detail: progress stepper (Pre-Sales → Meeting → Closing), activity tab, lead report tab, meeting tab, right-side info panel. Can change stage via the dropdown, log a call, schedule a task, or click "Clinch / Close" when stage is "Meeting Successful."
17. Admin sees the **"Change salesperson"** button on every lead detail (because `canReassign = true` for ADMIN).
18. Click **Approvals** → `/approvals` → sees all pending lead reports. Can Approve (moves to Meeting Scheduled, notifies agent + salesperson) or Reject (requires a reason, moves to Meeting Dropped, notifies agent).

### Happy-path: Reference data management
19. Click **Super Admin** → **Reference Data** tab — manage industries, sources, stages, etc.
20. **Option Lists** tab — manage dropdown values.
21. **Pre-Sales Questions** tab — manage the per-site pre-qualified question definitions (used for HungerBox company-site prequalified answers once ALT-455 lands).

### Happy-path: Recycle bin
22. Click **Recycle Bin** → `/recycle-bin`. Lists soft-deleted companies and contacts. Admin can restore them.  
    **Note:** Validate restore against RLS before using in production (the UAT-ROLE-MATRIX note applies).

---

## Role 3: AGENT (outreach caller — highest-priority for HungerBox launch)

### Who is this?
A caller who is assigned a set of leads for a project. Their job: look at their assigned leads, call contacts, log outcomes, advance the lead stage, flag DNC or non-feasible when needed. They never create data.

### Sidebar (what they see)
Dashboard · Leads · Companies · Contacts · Meeting · My Tasks · Wish List · Notifications · Settings · Log Out.  
No "Approvals," "Import," "Recycle Bin," or "Super Admin" entries — those are hidden.

### Pre-conditions that must be true before an agent can work
- The agent's Supabase Auth login has been provisioned (GAP-1 — currently blocked for all 18 agents).
- The agent is a member of the HungerBox project in `project_user` (GAP-3 — 4 of 18 agents missing).
- ALT-152 (`apply-assignment-rls.cjs`) has been applied so the agent can UPDATE their assigned leads (GAP-2 — currently blocked for all agents).

### Happy-path: First login
1. Navigate to `crm.altleads.com` → Login page.
2. Enter credentials → redirected to `/dashboard`.
3. Dashboard shows their personal stats: leads count, meetings, recent activity. The project scope dropdown (top bar) defaults to "All projects" — agent selects "HungerBox" to scope their view.

### Happy-path: Work the daily call queue (metro-first)
4. Click **Leads** in the sidebar → `/leads`.
5. **Pending (ALT-454):** Once metro prioritisation lands, apply the "Metro" filter to show Tier-1 city contacts first. For now, agent sorts by City column or uses the City multi-select filter to find their priority geography.
6. The list shows their assigned leads (filtered by project scope). **No "New Lead" button is visible** — `canCreateData = false` for agents.
7. Agent can filter by Stage, City, Salesperson, Date ranges. They can also use the Kanban board view (leads/board) to see stage distribution.
8. Click a lead row to open `/leads/:id`.

### Happy-path: Open a contact, see prequalified site info, make a call
9. On the lead detail page: the header shows company name, location, project, and current stage (with a stage badge and a stage dropdown).
10. **Pending (ALT-455):** Per-site prequalified answers (total employees, commercial model) will appear in the right info panel once the company-site entity is built. For now, the info panel shows company details and contact info.
11. **Pending (ALT-452 / ALT-453):** If the company/site is marked DNC or non-feasible, contacts would render with a reddish blur and call/email actions would be disabled — not yet built.
12. The agent sees Quick Task Actions: **Call back**, **Schedule meeting**, **Add task**, **Log call** buttons.
13. After making a call, click **Log call** → a modal opens → fill call outcome, notes, disposition → Save. The call is recorded in the activity tab.

### Happy-path: Log outcome + advance stage
14. To advance the lead: use the **stage dropdown** (top-right of header card) — select the new stage → saved immediately. A toast confirms success or shows an error.
    - **BLOCKED (GAP-2/ALT-152 not applied):** The RLS UPDATE policy currently checks `created_by = current_user_id()`. Since bulk-migrated leads have the importer as `created_by`, every agent stage-change attempt is denied until ALT-152 is applied.
15. Agent can also schedule follow-up tasks: click **Call back** or **Add task** → fill details → Save → task appears in My Tasks.
16. Switch to the **Activity** tab to see all prior interactions, call logs, and task history on this lead.
17. Switch to the **Lead Report** tab to fill or update the lead report (pre-sales qualification data). The Report tab uses `profile.role` (GAP-6) — verify this renders correctly for the agent.
18. Switch to the **Meeting** tab to see scheduled meetings for this lead.

### Happy-path: Flag DNC or non-feasible (pending ALT-452 / ALT-453)
- **Pending.** The agent should be able to mark a company or site as DNC during outreach (per HUNGERBOX-LAUNCH.md §2). This is not yet built. Once ALT-452 lands, the agent will see a "Mark DNC" action on the contact/company, with a reason prompt; the change will be history-logged.

### Happy-path: My Tasks
19. Click **My Tasks** → `/tasks`. Shows tabs: Overdue / Today / Upcoming / Completed. Each row has quick actions: Mark done, Skip, Snooze. A "+ New task" button opens CreateTaskModal.
20. Agent works through Overdue items first, then Today.

### What the agent cannot do (enforced by code)
- Cannot see or click "New Lead," "New Company," "New Contact" — buttons are hidden (`canCreateData = false`).
- Cannot access Import, Recycle Bin, or Super Admin.
- Cannot access the Approvals queue (redirected to `/dashboard` by `ApproverRoute`).
- Cannot reassign leads — the "Reassign" bulk button and "Change salesperson" button require `canReassign = true` (not true for agents).

---

## Role 2: TEAM_LEAD

### Who is this?
Manages a group of agents. Reviews and approves lead reports. Can reassign leads across their project. Can see all data an agent sees plus the Approvals queue. Cannot create data (no "New Lead/Company/Contact" buttons).

### Sidebar (what they see)
Dashboard · Leads · Companies · Contacts · Meeting · My Tasks · Wish List · Notifications · **Approvals** (with red badge showing pending count) · Settings · Log Out.  
No Import, Recycle Bin, or Super Admin.

### Happy-path: First login
1. Login → `/dashboard`. Overview of pipeline stats, recent activity.
2. If there are pending lead reports, the Approvals nav item shows a red badge (count refreshes every 60 seconds).

### Happy-path: Manage the approvals queue
3. Click **Approvals** → `/approvals`.
4. Table lists all lead reports with `report_approval = 'Pending'`. Columns: Lead name, Agent, Salesperson, Stage, submitted date, SLA age (colour-escalates as it ages — green → amber → red).
5. Click the **eye icon** (View) on a row → modal opens with full report detail.
6. Click **Approve** (thumbs up) → lead moves to "Meeting Scheduled" stage; agent and salesperson are notified.
7. Click **Reject** (thumbs down) → a reason prompt appears (mandatory) → on confirm, lead moves to "Meeting Dropped By Amplior"; agent is notified with the reason.

### Happy-path: Reassign leads
8. Go to **Leads** → filter by project or agent → select leads via checkboxes → **Reassign (n)** button appears (because `canReassign = true` for TEAM_LEAD) → pick new salesperson → confirm.
9. On a lead detail, the **"Change salesperson"** button is also visible.

### Happy-path: Monitor agent work
10. Leads list → filter by `agentName` to see a specific agent's leads. Can open any lead, read all tabs (Activity, Report, Meeting).
11. The TEAM_LEAD can also update lead stage (their writes go through `manages_project` branch of the RLS — this path works even without ALT-152, unlike agents).

### What the team lead cannot do
- Cannot access Import, Recycle Bin, or Super Admin (AdminRoute redirects to `/dashboard`; the Sidebar hides the nav items).
- Cannot create leads/companies/contacts (`canCreateData = false`).
- Typing `/admin` directly shows the "Restricted area" component (page-level defence in depth).

---

## Role 6: QC (Quality Control)

### Who is this?
A passive reviewer. The only QC-specific UI is the Approvals queue — QC mirrors the Team Lead's approvals access (documented in `AuthContext.tsx` AMBIG B1/A5). QC can SELECT leads (RLS grants this via `is_qc()`) but has no write access to leads, companies, or contacts. There are currently 2 QC users; only 1 has a login.

### Sidebar (what they see)
Same as TEAM_LEAD: Dashboard · Leads · Companies · Contacts · Meeting · My Tasks · Wish List · Notifications · **Approvals** · Settings · Log Out.  
(Note: `isApprover = isAdmin || isTeamLead || roles.includes('QC')` — QC gets the Approvals nav item.)

### Happy-path: Daily work
1. Login → `/dashboard`.
2. Click **Approvals** → review pending lead reports. Can Approve or Reject (same UI as TEAM_LEAD).
3. Can browse **Leads**, **Companies**, **Contacts** in read-only mode. Can log calls and create tasks (task RLS is own-only + admin, so a QC user can manage their own tasks).
4. Cannot modify lead stages, company data, or contact data — no write path exists for QC on those tables.

### Gap to flag (GAP-5)
QC can see leads but has no annotate/edit capability. If QC is expected to add notes or flag quality issues, this is not yet designed or built. Owner sign-off needed: is read-only + approvals the intended QC posture at launch?

---

## Role 4: SALES_HEAD

### Who is this?
A senior sales person who manages a downline of Sales Persons. Accesses the **Sales Portal** at `/sales` — NOT the internal CRM. If a Sales Head tries to visit `/dashboard`, the `ProtectedRoute` detects `isSalesUser && !isInternalUser` and redirects to `/sales`.

### Sales Portal sidebar (what they see)
Leads · Meetings · Wishlist · Feedback · Log Out.  
Internal users also see a "Back to CRM" link at the bottom (Sales Heads do not, unless they also hold an internal role).

### Happy-path: First login
1. Navigate to `crm.altleads.com/sales/login` (or the main `/` login → auto-redirected).  
   Actually: the main login at `/` is the internal CRM login. Sales users should use `crm.altleads.com/sales/login`. If they log in via the main page, Supabase auth proceeds the same way but they are then redirected to `/sales` by `ProtectedRoute`.
2. Enter credentials → redirected to `/sales` (leads list in the sales shell).

### Happy-path: Work the leads list
3. `/sales` shows the leads list (same `LeadsPage` component, now wrapped in the Sales shell). The sidebar shows "Sales" badge in the top-left.
4. **IMPORTANT — PENDING DATA SCOPING:** The leads list currently shows ALL leads the session can read — not just the Sales Head's downline leads. Sales-portal RLS scoping is a follow-on ticket. Until that lands, do NOT give Sales Head logins to users who should not see all data.
5. Sales Head can filter, sort, and click through to lead detail (`/sales/leads/:id`).

### Happy-path: Lead detail (sales shell)
6. Lead detail renders with the same UI as the internal version. The "Back to Leads" breadcrumb links to `/sales` (not `/leads`).
7. Sales Head has `canReassign = true` — they see the **"Change salesperson"** button on every lead. They can reassign a lead in the portal (currently unscoped — see gap above).
8. Sales Head does NOT have `canCreateData` — no "New Lead" button.

### Happy-path: Meetings
9. Click **Meetings** → `/sales/meetings` → the MeetingsPage in the sales shell. Lists all meetings.
10. Click a meeting row → `/sales/meetings/:id` → `SalesMeetingDetailPage`. This is the "mobile-ditto" layout mirroring the legacy mobile app. Sales Head can see call recording / SharePoint image links (because `canSeeRecordings = isInternalUser || roles.includes('SALES_HEAD')`).

### Happy-path: Wishlist (prospect capture)
11. Click **Wishlist** → `/sales/wishlist` → `SalesWishlistPage`. Sales Head can add wishlist entries (Company + Prospect + Location) via the WishlistCreateModal. This is prospect capture — not CRM lead creation.

### Happy-path: Feedback
12. Click **Feedback** → `/sales/feedback` → "Coming soon" placeholder. Not yet built.

---

## Role 5: SALES_PERSON

### Who is this?
A front-line sales representative. Same portal as Sales Head, but without `canReassign` (cannot reassign leads) and without call recording visibility in the meeting detail.

### Sales Portal sidebar (what they see)
Identical to Sales Head: Leads · Meetings · Wishlist · Feedback · Log Out.

### Happy-path: First login
Same as Sales Head — lands on `/sales`.

### Happy-path: Work leads
1. `/sales` → leads list. Same filtering and navigation.
2. **No "Change salesperson" button** on lead detail (because `canReassign = false` for SALES_PERSON).
3. **No bulk reassign button** on the list.
4. **PENDING:** Leads are not yet scoped to just this salesperson's assignments. GAP-4.

### Happy-path: Meeting detail
5. `/sales/meetings/:id` → `SalesMeetingDetailPage`. Call recordings / SharePoint images are hidden (only Sales Head + internal users see those).

### Happy-path: Wishlist
Same as Sales Head — can add wishlist entries.

### What the sales person cannot do
- Cannot access internal CRM at all (redirected to `/sales`).
- Cannot see call recordings in meeting detail.
- Cannot reassign leads.
- Cannot create CRM records (companies/contacts/leads).

---

## Summary: Who sees what on first login

| Role | Login URL | Lands on | Sidebar |
|------|-----------|----------|---------|
| ADMIN | `/` or `/login` | `/dashboard` | Full (incl. Import, Recycle Bin, Super Admin) |
| TEAM_LEAD | `/` or `/login` | `/dashboard` | Standard internal (incl. Approvals) |
| AGENT | `/` or `/login` | `/dashboard` | Standard internal (no Approvals) |
| QC | `/` or `/login` | `/dashboard` | Standard internal (incl. Approvals) |
| SALES_HEAD | `/sales/login` | `/sales` | Sales portal (Leads/Meetings/Wishlist/Feedback) |
| SALES_PERSON | `/sales/login` | `/sales` | Sales portal (Leads/Meetings/Wishlist/Feedback) |

---

---

# Standing QC Checklist

This checklist is designed to be run after any code change (or by a throwaway-login test). Each assertion is testable with a real login. Tick-box each item; any failure is a bug and should get an ALT ticket.

---

## QC-A: Authentication & Routing

| # | Check | Role | Expected | ALT ref |
|---|-------|------|----------|---------|
| A1 | Log in with ADMIN credentials at `/` | ADMIN | Lands on `/dashboard` with full sidebar | — |
| A2 | Log in with AGENT credentials at `/` | AGENT | Lands on `/dashboard` without Import / Recycle Bin / Super Admin / Approvals in sidebar | — |
| A3 | Log in with SALES_PERSON credentials at `/` | SALES_PERSON | Redirected to `/sales` (NOT `/dashboard`) | App.tsx ProtectedRoute |
| A4 | Logged-in SALES_PERSON manually navigates to `/dashboard` | SALES_PERSON | Redirected back to `/sales` | App.tsx ProtectedRoute |
| A5 | Logged-in AGENT manually navigates to `/approvals` | AGENT | Redirected to `/dashboard` | ApproverRoute |
| A6 | Logged-in AGENT manually navigates to `/admin` | AGENT | Sees "Restricted area" component | AdminPage page-level guard |
| A7 | Logged-in AGENT manually navigates to `/import` | AGENT | Redirected to `/dashboard` | AdminRoute |
| A8 | Logged-in TEAM_LEAD manually navigates to `/import` | TEAM_LEAD | Redirected to `/dashboard` | AdminRoute |
| A9 | Logged-in TEAM_LEAD manually navigates to `/admin` | TEAM_LEAD | Sees "Restricted area" component | AdminPage page-level guard |
| A10 | Unauthenticated user visits `/dashboard` | (none) | Redirected to `/` (login page) | ProtectedRoute |
| A11 | Unauthenticated user visits `/sales` | (none) | Redirected to `/sales/login` | SalesProtectedRoute |
| A12 | SALES_HEAD logs out from sales portal | SALES_HEAD | Redirected to `/sales/login` (not `/`) | SalesSidebar signOut |

---

## QC-B: Navigation — Sidebar visibility

| # | Check | Role | Expected |
|---|-------|------|----------|
| B1 | Sidebar after ADMIN login | ADMIN | All 11 nav items visible including Import, Recycle Bin, Super Admin |
| B2 | Sidebar after TEAM_LEAD login | TEAM_LEAD | Import / Recycle Bin / Super Admin NOT visible; Approvals IS visible |
| B3 | Sidebar after AGENT login | AGENT | Import / Recycle Bin / Super Admin / Approvals NOT visible |
| B4 | Sidebar after QC login | QC | Approvals IS visible; Import / Recycle Bin / Super Admin NOT visible |
| B5 | Approvals badge shows count | ADMIN or TEAM_LEAD or QC | Red badge on Approvals nav item when pending count > 0 (refreshes every 60 s) |
| B6 | Notifications badge shows unread count | Any internal role | Red badge on Notifications nav item when unread > 0 |

---

## QC-C: Leads list — visibility and controls

| # | Check | Role | Expected | ALT ref |
|---|-------|------|----------|---------|
| C1 | "New Lead" button visible | ADMIN | Visible (blue "New Lead" button top-right of toolbar) | ADR-21 |
| C2 | "New Lead" button NOT visible | TEAM_LEAD | Not rendered | ADR-21, `canCreateData` |
| C3 | "New Lead" button NOT visible | AGENT | Not rendered | ADR-21, `canCreateData` |
| C4 | Bulk "Reassign" button appears after selection | ADMIN or TEAM_LEAD | Visible when 1+ rows selected | ALT-291 |
| C5 | Bulk "Reassign" button does NOT appear | AGENT | Not rendered when rows are selected | ALT-291, `canReassign` |
| C6 | Project scope switcher filters leads | Any internal | Changing project in top-bar drops the lead count to that project only | ALT-273 |
| C7 | AGENT with no project membership sees empty leads list | AGENT (no project) | 0 leads, empty-state shown | GAP-3 |
| C8 | After ALT-152 applied: AGENT can see leads assigned to them | AGENT | Assigned leads appear in list | ALT-152 |
| C9 | Export button present | Any internal | Verify: check whether export is gated by role or shown to all. Currently not gated by `canCreateData` — verify intended. | — |

---

## QC-D: Lead detail — actions per role

| # | Check | Role | Expected | ALT ref |
|---|-------|------|----------|---------|
| D1 | Stage dropdown is enabled | ADMIN | Dropdown active; can change stage | — |
| D2 | Stage dropdown saves change | ADMIN or TEAM_LEAD | Toast shows success; badge updates | — |
| D3 | Stage dropdown silently fails for AGENT (pre-ALT-152) | AGENT | RLS denies write; toast shows error | GAP-2, ALT-152 |
| D4 | Stage dropdown saves for AGENT (post-ALT-152) | AGENT | Toast shows success; badge updates | ALT-152 |
| D5 | "Change salesperson" button visible | ADMIN, TEAM_LEAD | Visible | ALT-288, `canReassign` |
| D6 | "Change salesperson" button NOT visible | AGENT | Not rendered | ALT-288, `canReassign` |
| D7 | "Clinch / Close" button visible and functional | ADMIN | Visible when stage = "Meeting Successful" and not yet closed | — |
| D8 | Quick Task Actions visible ("Call back", "Log call" etc.) | Any internal with actor | Buttons shown when `hasActor = true` (profile.user_id is not null) | — |
| D9 | No-actor warning shown | Any user without linked profile | Amber warning banner: "Your account isn't linked to a user profile" | — |
| D10 | Activity tab shows call history | Any internal | Call entries logged via Log Call Modal appear here | ALT-269 |
| D11 | Lead Report tab shows Approve button for approver | ADMIN or TEAM_LEAD | Verify: ReportTab derives `isApprover` from `profile.role` not `useAuth().isApprover` — KNOWN BUG (GAP-6). Test that a pure TEAM_LEAD sees the Approve button. | GAP-6, ALT- (gap) |
| D12 | Lead Report tab does NOT show Approve for AGENT | AGENT | Approve button not rendered | — |
| D13 | DNC blur on contact (pending ALT-452) | Any | Pending — not testable until ALT-452 ships | ALT-452 |

---

## QC-E: Companies / Contacts

| # | Check | Role | Expected |
|---|-------|------|----------|
| E1 | "New Company" button visible | ADMIN | Visible |
| E2 | "New Company" button NOT visible | AGENT or TEAM_LEAD | Not rendered |
| E3 | "New Contact" button visible | ADMIN | Visible |
| E4 | "New Contact" button NOT visible | AGENT or TEAM_LEAD | Not rendered |
| E5 | AGENT can view company detail | AGENT | Yes (SELECT is open to all authenticated: `company_master` RLS SELECT policy is `true`) |
| E6 | AGENT edit attempt on company (not managed_project, not created_by) | AGENT | RLS denies; toast shows error |
| E7 | SALES_HEAD/SALES_PERSON navigating to `/companies` | Sales role | Redirected to `/sales` (ProtectedRoute: pure sales user) |

---

## QC-F: Approvals queue

| # | Check | Role | Expected |
|---|-------|------|----------|
| F1 | Approvals page loads with pending list | ADMIN, TEAM_LEAD, QC | Table shows pending reports with SLA age badges |
| F2 | Approve action succeeds | ADMIN | Toast success; row disappears from queue |
| F3 | Reject action requires reason | ADMIN | Cannot reject without typing a reason |
| F4 | Non-approver AGENT cannot reach `/approvals` | AGENT | Redirected to `/dashboard` |

---

## QC-G: Admin panel

| # | Check | Role | Expected |
|---|-------|------|----------|
| G1 | Admin panel tabs load | ADMIN | Users, Client, Project, Project Access, Reference Data, Option Lists, Pre-Sales Questions, Activity — all tabs present |
| G2 | User tab shows all users with roles | ADMIN | 112+ users listed with roles, enable/disable toggle, edit icon |
| G3 | Non-admin sees Restricted screen at `/admin` | TEAM_LEAD / AGENT | "Restricted area" screen shown (page-level guard) |
| G4 | Recycle Bin lists soft-deleted records | ADMIN | Deleted companies and contacts appear |
| G5 | Non-admin cannot reach `/recycle-bin` | AGENT | Redirected to `/dashboard` by AdminRoute |

---

## QC-H: Import Wizard

| # | Check | Role | Expected |
|---|-------|------|----------|
| H1 | Import page renders for admin | ADMIN | Upload wizard UI shown |
| H2 | Import final action disabled | ADMIN | "Import" confirm button is disabled (no server-side endpoint yet) | ALT-399 |
| H3 | Non-admin sees "admins only" notice | TEAM_LEAD | Restricted notice rendered | ImportPage isAdmin check |

---

## QC-I: Sales Portal (roles 4 & 5)

| # | Check | Role | Expected | Note |
|---|-------|------|----------|------|
| I1 | `/sales` loads and shows leads | SALES_HEAD, SALES_PERSON | Leads list in sales shell (Sales badge in sidebar top-left) | Data not yet scoped to downline — GAP-4 |
| I2 | Leads not scoped to downline (pre-scoping ticket) | SALES_HEAD | All session-readable leads shown (verify this is acceptable before giving logins) | GAP-4 |
| I3 | "Change salesperson" visible on lead detail | SALES_HEAD | Visible (`canReassign = true` for SALES_HEAD) | — |
| I4 | "Change salesperson" NOT visible | SALES_PERSON | Not rendered | — |
| I5 | Meeting detail at `/sales/meetings/:id` | SALES_HEAD | MobileMeetingRecord layout; call recording/SharePoint links visible | ALT-275 |
| I6 | Meeting detail — recording links hidden | SALES_PERSON | Recording/image section not shown | SalesMeetingDetailPage `canSeeRecordings` |
| I7 | Feedback page | SALES_HEAD, SALES_PERSON | "Coming soon" placeholder rendered (not built yet) | — |
| I8 | Wishlist create | SALES_HEAD, SALES_PERSON | WishlistCreateModal opens; entry saved | ALT-276 |
| I9 | "Back to CRM" button in sales sidebar | Internal user visiting /sales | Visible (internal user flag) | SalesSidebar |
| I10 | "Back to CRM" button NOT shown | SALES_HEAD or SALES_PERSON (pure sales) | Not rendered | SalesSidebar `isInternalUser` |

---

## QC-J: Data integrity / RLS (run with throwaway logins)

| # | Check | How to test | Expected |
|---|-------|-------------|----------|
| J1 | AGENT cannot UPDATE a lead they are not assigned to | Log in as agent, try to change stage on a lead where `lead_report.user_id != this_agent` | RLS denies; toast shows error |
| J2 | AGENT can UPDATE a lead they ARE assigned to (post-ALT-152) | Same, with their assigned lead | Succeeds | ALT-152 |
| J3 | AGENT with no project membership sees 0 leads | Log in as an agent with no `project_user` row | Empty leads list | GAP-3 |
| J4 | ADMIN can UPDATE any lead | Admin login, change stage on any lead | Succeeds | — |
| J5 | Sales portal shows unscoped data (known issue) | Log in as SALES_PERSON, check lead count | All session-readable leads shown | GAP-4 |
| J6 | After sales RLS scoping: SALES_PERSON sees only their leads | Post-ticket | Only own leads visible | (follow-on ticket) |
| J7 | Task visibility: agent sees only their own tasks | Log in as agent, check `/tasks` | Only tasks owned by this user | apply-task-rls.cjs |
| J8 | call_log visibility: agent sees only their own call logs | Agent login, open lead activity tab | Only calls logged by this agent | apply-call-log-rls.cjs |

---

## QC-K: Known bugs to verify after fix

| # | Bug | Fixed when | Expected after fix |
|---|-----|------------|-------------------|
| K1 | GAP-6: `ReportTab.tsx` derives `isApprover` from `profile.role` not `useAuth().isApprover` | Fix deployed | TEAM_LEAD with dual role sees Approve button in Lead Report tab |
| K2 | GAP-8: Sidebar `isAdmin`/`isApprover` read from `profile?.role` not AuthContext | Fix deployed | User with dual role (e.g. AGENT + TEAM_LEAD secondary) sees correct nav items |
| K3 | GAP-2: AGENT stage changes silently fail (RLS `created_by` mismatch) | ALT-152 applied | Agent stage changes succeed |
| K4 | GAP-4: Sales portal unscoped | Sales RLS scoping ticket done | SALES_PERSON sees only own downline leads |

---

## Pending items: HungerBox-specific features (QC steps TBD)

These features do not yet exist in the codebase. QC checklist steps will be added here when each ticket lands:

- **ALT-452** DNC blur + non-contactable: after ship, add checks to QC-D and QC-C.
- **ALT-453** Feasibility model: after ship, add checks to QC-D and QC-C.
- **ALT-454** Metro priority flag: after ship, add check to QC-C (sort/filter by metro).
- **ALT-455** Company-site + per-site prequalified answers: after ship, add QC-E checks for site-level detail panel.
- **ALT-456** Feasible/metro work-queue filters: after ship, add filter-state checks to QC-C.
- **ALT-399** Import write path: after server endpoint lands, add QC-H checks for actual import execution.
- **ALT-431** Write gatekeeper (server-side): after ship, add checks that writes go through the gatekeeper.

---

*Maintainer note: update this file whenever a route guard, sidebar filter, or RLS policy changes. Each ALT ticket that ships should flip its "Pending" flag above and add concrete QC-[letter] assertions.*
