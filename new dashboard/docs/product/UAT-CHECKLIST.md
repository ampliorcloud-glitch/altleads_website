# UAT & Parallel-Run Checklist — Amplior CRM

*Purpose: the go-live gate. Your team uses this to prove the NEW system matches (or beats) the OLD one before we switch off DigitalOcean. Work through it module by module, comparing new vs old side-by-side, and record Pass/Fail for every row.*

*Last updated: 2026-06-13*

---

## How to use this document

1. **Run both systems side by side.** Keep the OLD app (DigitalOcean) open in one browser tab and the NEW app (Supabase/Netlify) in another. Most tests are "do the same thing in both, confirm the answer matches."
2. **Test as each role.** Several behaviours change by role (what an Admin sees vs. a Sales Person). Where a test says "per role", repeat it once for each of the 6 roles: **ADMIN, TEAM_LEAD, SALES_HEAD, SALES_PERSON, AGENT, QC.**
3. **Fill in every row.** Mark **Pass**, **Fail**, or **N/A**. If Fail, write exactly what was wrong and (if helpful) the lead/meeting/user it happened on, so it can be fixed quickly.
4. **A "Pass" means business-acceptable**, not pixel-perfect. The question is always: *can the team do their real daily job, and are the numbers/data correct?*
5. **Spot-check real data** using the dedicated section near the end — this is how we catch silent data problems.

> **Plain-language note on a few terms:**
> - **Stage** = where a lead is in the sales journey (e.g. "Meeting Scheduled", "Meeting Successful").
> - **Agent / Sales Person** = the salesperson who owns the lead. In this database the real owner is stored in the lead's *created-by* and *client-association* fields, so the new app reads those.
> - **RLS (Row Level Security)** = database rules that decide who can see which rows. Until these are switched on, *every signed-in user sees all data*. See the "Access & permissions" section — this is a hard go-live gate.

---

## Known scope notes before you start (read these first)

These are things we already know about the current build. Testing them is still useful, but don't log them as surprises:

| Item | Status | What it means for testing |
|---|---|---|
| Access rules (RLS) | **Not yet switched on** | Right now any logged-in user sees ALL leads/meetings, regardless of role. The "Access & permissions" tests below will currently FAIL by design — they are the pre-go-live gate and must be re-tested after RLS is applied. |
| Live data mode | **Read-only preview** in some screens | Leads list / Dashboard show a "read-only preview" banner. Create/Edit Lead, stage change, profile, password, admin role/enable, notifications mark-read DO write to the database. Meetings are currently view-only (see next row). |
| Meeting reschedule / cancel / feedback entry | **Not built in the new web app yet** | The new Meeting screen shows all details, notes and feedback that already exist, but you cannot yet reschedule, cancel, or type new feedback from the web. Test that the *data displays correctly*; log the editing actions as "Old only — pending in new". |
| Lead workspace tabs (Activity / Lead Report / Meeting) | **Built as sections on the Lead page**, not yet the 3-tab layout | All three areas (activity timeline, stage/lead-report history, related meetings) are present on the Lead Detail page. Confirm the information is right; the tabbed layout is a later polish step. |
| Full stage-change workflow (approvals, auto-creating a meeting) | **Simple version only** | Changing a stage updates the stage and history. The richer approval / auto-meeting-creation flow is deferred. |

---

## Module 1 — Login & roles

| # | Test item | Steps | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|---|
| 1.1 | Login page loads | Open the new app URL | Amplior CRM sign-in card appears (email + password) | | |
| 1.2 | Login as ADMIN | Enter the admin email + password, click Sign in | Lands on Dashboard; sidebar shows **Admin** item | | |
| 1.3 | Login per role | Repeat 1.2 for TEAM_LEAD, SALES_HEAD, SALES_PERSON, AGENT, QC test accounts | Each logs in and lands on Dashboard | | |
| 1.4 | Correct role shown | After login, open **Settings** | "Role" field shows the user's correct role | | |
| 1.5 | Wrong password rejected | Enter a valid email + wrong password | Friendly error "Incorrect email or password" — does NOT log in | | |
| 1.6 | Empty fields blocked | Click Sign in with blank email/password | Inline message asks for the missing field | | |
| 1.7 | Unknown email rejected | Enter an email not in the system | Login fails with the same friendly error | | |
| 1.8 | Session persists on refresh | After login, press browser refresh | Stays logged in (not bounced to login) | | |
| 1.9 | Protected pages blocked when logged out | Log out (or open a private window) and paste a deep link e.g. `/leads` | Redirected to the login page | | |
| 1.10 | Admin menu hidden for non-admins | Log in as AGENT or SALES_PERSON | **Admin** does NOT appear in the sidebar | | |
| 1.11 | Admin page blocked by URL for non-admins | As a non-admin, manually go to `/admin` | "Restricted area" message shown — no admin data | | |
| 1.12 | Logout works | Use the logout control | Returns to login; back button does not re-enter the app | | |

---

## Module 2 — Dashboard

*Compare each number against the same figure in the OLD system (or against a manual count).*

| # | Test item | Steps | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|---|
| 2.1 | Dashboard loads | Open Dashboard | 4 stat cards + "Leads by Stage" chart + "Recent Activity" table all render | | |
| 2.2 | Total Leads matches | Read "Total Leads" card; compare to old system's total | Numbers match (expected ≈ 604–605) | | |
| 2.3 | Meetings This Week matches | Read "Meetings This Week"; compare to old / manual count for Mon–Sun | Numbers match | | |
| 2.4 | Meetings Successful matches | Read "Meetings Successful"; compare to old count of leads at "Meeting Successful" stage | Numbers match | | |
| 2.5 | Meetings Scheduled matches | Read "Meetings Scheduled"; compare to old | Numbers match | | |
| 2.6 | Stage chart totals add up | Add the counts in the "Leads by Stage" chart | Roughly reconciles with total leads (some leads may have no stage) | | |
| 2.7 | Stage names are real | Read the stage labels in the chart | Labels are real stages (e.g. "Meeting Successful", "Warm", "Hot Prospect") — no blanks or codes | | |
| 2.8 | Recent Activity correct | Look at the Recent Activity rows | Company, contact, stage and last-updated shown; clicking through (if linked) opens the right lead | | |
| 2.9 | Numbers change by role | View Dashboard as a Sales Person vs Admin | *After RLS:* a sales person's totals reflect only their data. *Before RLS:* same totals for all — log as "pending RLS" | | |

---

## Module 3 — Leads: list, filters, search, export

| # | Test item | Steps | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|---|
| 3.1 | Leads list loads | Open **Leads** | Table of leads with Company, Contact, Project, City, Agent, Source, Stage, Meeting Date, Last Updated | | |
| 3.2 | Total count matches old | Read "X of Y leads" | Y matches old system's lead count | | |
| 3.3 | No blank companies | Scan the Company column across pages | Company names are populated (not a column of dashes) | | |
| 3.4 | Agents look complete | Open the Agent filter dropdown | Many real salespeople listed (~18), not just 1–2 | | |
| 3.5 | Free-text search | Type a company name in Search | List narrows to matching leads; clearing restores all | | |
| 3.6 | Search across fields | Search a contact name, phone, and a lead number (e.g. ALT####) | Each finds the expected lead(s) | | |
| 3.7 | Lead Generated date filter | Set a "Lead Generated" from/to range | Only leads created in that range remain; matches old | | |
| 3.8 | Meeting date filter | Set a "Meeting Date" range | Only leads with a meeting in range remain | | |
| 3.9 | Agent filter | Pick one agent | Only that agent's leads show; count matches old | | |
| 3.10 | Project filter | Pick a project | Only that project's leads show | | |
| 3.11 | City filter | Pick a city | Only that city's leads show | | |
| 3.12 | Source filter | Pick a source | Only that source's leads show | | |
| 3.13 | Industry filter | Pick an industry | Only that industry's leads show | | |
| 3.14 | Stage filter | Pick a stage | Only leads at that stage show; matches old | | |
| 3.15 | Combined filters | Apply agent + stage + a date range together | Results respect ALL filters at once | | |
| 3.16 | Clear filters | Click "Clear filters" | All filters reset, full list returns | | |
| 3.17 | Sorting | Click a column header (e.g. Company, Last Updated) | Rows sort ascending then descending | | |
| 3.18 | Pagination | Change "Rows per page" (25/50/100) and use Prev/Next | Page size changes; navigation works; "Showing X–Y of Z" is correct | | |
| 3.19 | Export to Excel | Apply some filters, click "Export to Excel" | Downloads an .xlsx containing **every matching row** (not just the visible page) | | |
| 3.20 | Export contents match | Open the .xlsx; spot-check a few rows vs the on-screen list and the old export | Columns and values match | | |
| 3.21 | Open a lead | Click a row | Opens that lead's detail page | | |

---

## Module 4 — Create & edit a lead

| # | Test item | Steps | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|---|
| 4.1 | Open New Lead | On Leads, click **New Lead** | Lead form opens with empty fields | | |
| 4.2 | Required fields enforced | Try to save with key fields blank | Form blocks save and shows which fields are needed | | |
| 4.3 | Create a test lead | Fill name, company, contact, project, source etc.; save | Lead saves, you land on its detail page, a new lead number (ALT####) is assigned | | |
| 4.4 | New lead appears in list | Go back to Leads; search the new company | The new lead is in the list | | |
| 4.5 | New lead visible in old? | (Parallel-run note) | New leads created in the NEW app live only in Supabase — confirm with owner whether they should also be entered in old during parallel run | | |
| 4.6 | Edit an existing lead | Open a lead → **Edit Lead**; change a field (e.g. designation, city); save | Change saves and shows correctly on the detail page after returning | | |
| 4.7 | Edit persists on refresh | Refresh the lead detail page | The edited value is still there (saved to database) | | |
| 4.8 | Edit doesn't lose other data | After editing one field, check the rest of the lead | No other fields were wiped or changed | | |
| 4.9 | Inline new company (caution) | Create a lead with a brand-new company name | Lead saves; **then verify** the company record looks sane in Admin → Clients/Reference (known caveat: placeholder values can be written) | | |
| 4.10 | Cancel without saving | Open Edit, change a field, navigate away without saving | No change is saved | | |

---

## Module 5 — Lead workspace (detail, activity, lead report, meetings)

*The new app shows these as sections on the Lead Detail page. Confirm the information is correct vs the old lead-overview screen.*

| # | Test item | Steps | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|---|
| 5.1 | Header correct | Open a known lead | Name, company, agent, lead number, and stage badge match old | | |
| 5.2 | Closed flag | Open a closed lead | A "Closed" indicator appears | | |
| 5.3 | Contact info | Check Contact Information section | Phone, alt phone, email, LinkedIn, designation match old; phone/email are clickable | | |
| 5.4 | Business details | Check Business Details section | Company, industry, city, source, project, client association, area of interest, value match old | | |
| 5.5 | Activity timeline | Check Activity Timeline | Past comments/activity show with date and who did it; order is newest-relevant; matches old | | |
| 5.6 | Related meetings | Check Related Meetings | Meetings linked to this lead are listed with date/time/mode/status; match old | | |
| 5.7 | Open a related meeting | Click through to a meeting (if linked) | Opens the correct meeting detail | | |
| 5.8 | Stage history | Check Stage History table | Shows the stages the lead passed through with created/updated dates; matches old | | |
| 5.9 | Change stage | Use the stage dropdown to move the lead to a new stage | Stage badge updates immediately; a new row appears in Stage History | | |
| 5.10 | Stage change persists | Refresh the page | New stage is still shown | | |
| 5.11 | Stage change in old reflects? | (Parallel-run note) | Stage changed in NEW app does not flow to OLD — note for owner whether to mirror manually during parallel run | | |
| 5.12 | Lead with no stage | Open a lead that never had a stage | Shows "No stage assigned yet" rather than an error | | |

---

## Module 6 — Meetings (list, detail, feedback)

| # | Test item | Steps | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|---|
| 6.1 | Meetings list loads | Open **Meetings** | Table with Lead/Company, Meeting Date, Time, Mode, Status, Agent | | |
| 6.2 | Total count matches old | Read "X of Y meetings" | Y matches old (≈ 610) | | |
| 6.3 | Search | Search a lead/company/agent | List narrows correctly | | |
| 6.4 | Meeting date filter | Set a date range | Only meetings in range show; matches old | | |
| 6.5 | Status filter | Filter by a status (e.g. Completed, Scheduled) | Only that status shows; matches old | | |
| 6.6 | Mode filter | Filter by mode (Online/Offline/Tele) | Only that mode shows | | |
| 6.7 | Agent filter | Filter by an agent | Only that agent's meetings show | | |
| 6.8 | Clear filters | Click "Clear filters" | Full list returns | | |
| 6.9 | Sorting & pagination | Sort a column; page through with Prev/Next | Works; "Showing X–Y of Z" correct | | |
| 6.10 | Export to Excel | Click "Export to Excel" | Downloads .xlsx of all matching meetings; spot-check vs screen/old | | |
| 6.11 | Open a meeting | Click a row | Meeting detail opens | | |
| 6.12 | Detail header | On detail, check header | Company/lead, status badge, date, time, duration, mode, follow-up, agent all correct vs old | | |
| 6.13 | Linked lead | Click "View lead" | Opens the correct lead | | |
| 6.14 | Participants | Check Participants card | All participants listed vs old | | |
| 6.15 | Discussion notes | Check Discussion Notes | Pre-sales notes shown vs old | | |
| 6.16 | Feedback shown | Check Feedback + Additional Notes | Existing Q&A feedback, agent feedback, description, reason display correctly vs old | | |
| 6.17 | Meeting links | If present, click meeting link / call recording / document | Open in a new tab | | |
| 6.18 | Reschedule a meeting | (Old only) Reschedule in old system | **New app:** action not yet available — log as "pending in new"; confirm old still works | | |
| 6.19 | Cancel a meeting | (Old only) Cancel in old system | **New app:** action not yet available — log as "pending in new"; confirm old still works | | |
| 6.20 | Add feedback after a meeting | (Old only) Enter feedback in old system | **New app:** entry not yet available — log as "pending in new"; confirm old still works | | |

> **Action for owner:** items 6.18–6.20 are real daily actions. Confirm whether reschedule / cancel / feedback-entry must be built into the new web app **before** cutover, or whether they will be done on mobile / kept in old during parallel run.

---

## Module 7 — Wishlist

| # | Test item | Steps | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|---|
| 7.1 | Wishlist loads | Open **Wishlist** | Table with Company, Contact, Industry, City, Assigned Agent, Status, Added | | |
| 7.2 | Count matches old | Read "X of Y companies" | Y matches old (≈ 54) | | |
| 7.3 | Search | Search company/contact/city | List narrows correctly | | |
| 7.4 | Status filter | Filter by status (Wishlist / Converted To Lead) | Only that status shows; matches old | | |
| 7.5 | Agent filter | Filter by assigned agent | Only that agent's companies show | | |
| 7.6 | City filter | Filter by city | Only that city shows | | |
| 7.7 | Sort & paginate | Sort a column; page through | Works | | |
| 7.8 | Open detail | Click a row | Slide-over panel opens with company, contact, assignment, notes | | |
| 7.9 | Detail data correct | Compare panel fields to old | Company, industry, city, pincode, contact, designation, phone, agent, team lead, notes match | | |
| 7.10 | Export to Excel | Click "Export to Excel" | Downloads .xlsx of all matching rows; spot-check vs old | | |
| 7.11 | Close panel | Click outside or the X | Panel closes | | |

---

## Module 8 — Notifications

| # | Test item | Steps | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|---|
| 8.1 | Notifications load | Open **Notifications** | List of notifications (or a friendly empty state) | | |
| 8.2 | Unread highlighted | Look for unread items | Unread rows show a dot/highlight; "Unread" tab shows a count | | |
| 8.3 | All vs Unread tabs | Switch between "All" and "Unread" | List filters accordingly | | |
| 8.4 | Mark one as read | Click "Mark read" on an unread item | Item becomes read; unread count drops by 1 | | |
| 8.5 | Mark all as read | Click "Mark all as read" | All become read; unread count → 0 | | |
| 8.6 | Persists on refresh | Refresh the page | Read/unread state is remembered (saved to database) | | |
| 8.7 | Relevant content | Read a few notifications | Text references real leads/meetings and reads sensibly vs old | | |
| 8.8 | New-event notification (if applicable) | (With owner) Trigger an event that should notify (e.g. meeting assignment) | A matching notification appears — confirm against old behaviour | | |

---

## Module 9 — Admin (users, roles, projects, clients, reference data)

*Admin only. Log in as ADMIN.*

| # | Test item | Steps | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|---|
| 9.1 | Admin loads | Open **Admin** | Tabs: Users, Projects, Clients, Reference Data | | |
| 9.2 | Users list | Open **Users** tab | Real users with name, email, designation, roles, status; count looks right vs old | | |
| 9.3 | Search users | Search a name/email | List narrows correctly | | |
| 9.4 | Change a user's role | Click "Edit role", pick a new role, Save | Role chip updates; persists after refresh | | |
| 9.5 | Role change takes effect | Log in as that user (or have them refresh) | Their access/menu reflects the new role | | |
| 9.6 | Disable a user | Click "Disable" on a test user | Status changes to disabled | | |
| 9.7 | Disabled user blocked | Try to log in as the disabled user | Login is refused (confirm expected behaviour with owner) | | |
| 9.8 | Re-enable a user | Click "Enable" | Status returns to enabled; user can log in again | | |
| 9.9 | Projects tab | Open **Projects** | Real projects listed; matches old | | |
| 9.10 | Add / edit a project | Create or edit a test project | Saves and appears in the list (and in the Leads "Project" filter) | | |
| 9.11 | Clients tab | Open **Clients** | Real client associations listed; matches old | | |
| 9.12 | Add / edit a client | Create or edit a test client | Saves and appears in the list | | |
| 9.13 | Reference Data tab | Open **Reference Data** | Lookup lists (e.g. sources, stages, industries) shown | | |
| 9.14 | Edit reference data | Add/edit a reference value | Saves; appears as an option where it's used (e.g. in a filter or the lead form) | | |
| 9.15 | Admin changes are safe | After admin edits, re-open Leads/Meetings | Existing data still displays correctly (no breakage) | | |

> **Action for owner:** confirm whether "create a brand-new user" must be doable from this Admin panel before go-live, or whether new users will be added via Supabase / invited by email. (Current build supports edit-role and enable/disable for users; full user creation flow should be confirmed.)

---

## Module 10 — Settings, profile & password

| # | Test item | Steps | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|---|
| 10.1 | Settings loads | Open **Settings** | Identity card (name, email, role) + Profile form + Change Password form | | |
| 10.2 | Profile data correct | Check the pre-filled fields | Full name, first/last name, mobile, LinkedIn, designation match the user's real record | | |
| 10.3 | Email & role read-only | Try to edit Email / Role / Designation | These are not editable (greyed out) | | |
| 10.4 | Edit profile | Change mobile number or LinkedIn; Save changes | "Saved" confirmation appears | | |
| 10.5 | Profile change persists | Refresh / re-open Settings | The new value is still there | | |
| 10.6 | Name required | Clear Full name and try to save | Blocked with "Full name is required" | | |
| 10.7 | Change password — too short | Enter a password under 8 characters | Blocked with a minimum-length message | | |
| 10.8 | Change password — mismatch | Enter two different passwords | Blocked with "Passwords do not match" | | |
| 10.9 | Change password — success | Enter a valid matching password; Update | "Password updated" confirmation | | |
| 10.10 | New password works | Log out, log back in with the new password | Login succeeds | | |
| 10.11 | Old password rejected | Try logging in with the previous password | Login fails | | |

---

## Module 11 — Access & permissions (HARD GO-LIVE GATE)

> **These tests are the most important security check.** They will currently FAIL because the database access rules (RLS) are not switched on yet — every logged-in user can see everything. **Do not go live until this whole section passes.** Re-run it after RLS is applied.

| # | Test item | Steps | Expected result (after RLS) | Pass/Fail | Notes |
|---|---|---|---|---|---|
| 11.1 | Sales Person sees only own leads | Log in as a SALES_PERSON/AGENT; open Leads | Only leads they own are visible; counts smaller than admin's | | |
| 11.2 | Sales Person cannot open others' leads | As that user, paste the URL of a lead they don't own (`/leads/<id>`) | Access denied / not found — cannot view it | | |
| 11.3 | Manager scope | Log in as TEAM_LEAD / SALES_HEAD / QC | Sees the agreed scope (currently planned: all-for-now; refine to team later — confirm with owner) | | |
| 11.4 | Admin sees all | Log in as ADMIN | Sees all leads/meetings | | |
| 11.5 | Meetings respect ownership | Repeat 11.1–11.2 on Meetings | Same ownership rules apply | | |
| 11.6 | Wishlist respects ownership | Check Wishlist as a sales person | Only the agreed rows visible | | |
| 11.7 | Notifications are personal | Two different users compare notifications | Each sees only their own | | |
| 11.8 | Export respects rules | A sales person exports Leads to Excel | Export contains only rows they're allowed to see (no leakage) | | |
| 11.9 | Direct API cannot leak | (Technical, with Claude) Confirm rules live on the database, not just the screen | A user cannot pull other users' rows even outside the app | | |

---

## Data accuracy spot-checks

*This is how we catch silent data-migration problems. Pick a sample, compare new vs old field-by-field, and record any mismatch. Suggested sample size: **15 leads, 10 meetings, 5 wishlist companies, 10 users** — increase if you find errors.*

### Spot-check A — Leads (pick 15, mix of old/new, different agents & stages)

For each lead, compare NEW vs OLD: company, contact name, phone, email, designation, city, industry, source, project, agent/owner, client association, stage, created date, meeting date, value.

| # | Lead (number / company) | All fields match? (Y/N) | If N: which field(s) wrong & correct value | Pass/Fail |
|---|---|---|---|---|
| A1 |  |  |  | |
| A2 |  |  |  | |
| A3 |  |  |  | |
| A4 |  |  |  | |
| A5 |  |  |  | |
| A6 |  |  |  | |
| A7 |  |  |  | |
| A8 |  |  |  | |
| A9 |  |  |  | |
| A10 |  |  |  | |
| A11 |  |  |  | |
| A12 |  |  |  | |
| A13 |  |  |  | |
| A14 |  |  |  | |
| A15 |  |  |  | |

### Spot-check B — Meetings (pick 10, mix of statuses)

Compare NEW vs OLD: linked lead/company, date, time, duration, mode, status, agent, participants, feedback/notes.

| # | Meeting (lead / date) | All fields match? (Y/N) | If N: which field(s) wrong & correct value | Pass/Fail |
|---|---|---|---|---|
| B1 |  |  |  | |
| B2 |  |  |  | |
| B3 |  |  |  | |
| B4 |  |  |  | |
| B5 |  |  |  | |
| B6 |  |  |  | |
| B7 |  |  |  | |
| B8 |  |  |  | |
| B9 |  |  |  | |
| B10 |  |  |  | |

### Spot-check C — Wishlist (pick 5)

Compare NEW vs OLD: company, contact, designation, city, pincode, phone, agent, team lead, status, notes.

| # | Company | All fields match? (Y/N) | If N: which field(s) wrong & correct value | Pass/Fail |
|---|---|---|---|---|
| C1 |  |  |  | |
| C2 |  |  |  | |
| C3 |  |  |  | |
| C4 |  |  |  | |
| C5 |  |  |  | |

### Spot-check D — Users (pick 10, across roles)

Compare NEW vs OLD: name, email, designation, role(s), enabled/disabled status.

| # | User (name / email) | All fields match? (Y/N) | If N: which field(s) wrong & correct value | Pass/Fail |
|---|---|---|---|---|
| D1 |  |  |  | |
| D2 |  |  |  | |
| D3 |  |  |  | |
| D4 |  |  |  | |
| D5 |  |  |  | |
| D6 |  |  |  | |
| D7 |  |  |  | |
| D8 |  |  |  | |
| D9 |  |  |  | |
| D10 |  |  |  | |

### Spot-check E — Totals reconciliation (the "big numbers" check)

| Count | OLD value | NEW value | Match? | Notes |
|---|---|---|---|---|
| Total leads |  |  |  | Expect ≈ 604–605 |
| Total meetings |  |  |  | Expect ≈ 610 |
| Total wishlist companies |  |  |  | Expect ≈ 54 |
| Active salespeople / agents |  |  |  | Expect ≈ 18 |
| Total users |  |  |  |  |
| Leads at "Meeting Successful" |  |  |  | Expect ≈ 333 |

---

## Cross-cutting checks

| # | Test item | Steps | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|---|
| X.1 | Works on the team's real browsers | Test on the browsers the team actually uses | Loads and works in each | | |
| X.2 | Reasonable performance | Open Leads/Meetings with full data | Lists load in a few seconds; filtering/paging feels responsive | | |
| X.3 | No console errors on key pages | (With Claude/dev) Open browser dev console on Dashboard, Leads, Meetings | No blocking red errors | | |
| X.4 | Empty states are friendly | Filter to a no-result set | Clear "no results" message, not a blank/broken screen | | |
| X.5 | Loading states | Watch a page load | Spinner / "Loading…" rather than a flash of empty content | | |
| X.6 | Date formats are clear | Check dates across the app | Human-readable and consistent (e.g. dd Mon yyyy) | | |
| X.7 | Deep links work | Bookmark a lead/meeting URL and open it fresh (while logged in) | Opens the right record | | |
| X.8 | Back button behaves | Navigate in and out of records | Browser back returns to the previous list/page sensibly | | |

---

## Cutover readiness gate

All of the following must be **Yes** before switching the team fully onto the new system and retiring DigitalOcean:

| # | Gate item | Yes / No | Owner |
|---|---|---|---|
| G.1 | All login & role tests pass | | |
| G.2 | Dashboard numbers match old | | |
| G.3 | Leads list, filters, search, export match old | | |
| G.4 | Create & edit lead work and persist | | |
| G.5 | Lead workspace data (activity, report, meetings) matches old | | |
| G.6 | Meetings list & detail match old (and decision made on reschedule/cancel/feedback) | | |
| G.7 | Wishlist matches old | | |
| G.8 | Notifications work | | |
| G.9 | Admin (users/roles/projects/clients/reference) works | | |
| G.10 | Settings, profile & password work | | |
| G.11 | **Access rules (RLS) applied and Module 11 fully passes** | | |
| G.12 | Data accuracy spot-checks pass (or all issues fixed) | | |
| G.13 | Totals reconciliation matches | | |
| G.14 | Team trained on the new app | | |
| G.15 | Parallel-run period completed with no blocking issues | | |
| G.16 | Backup / rollback plan confirmed (old system can be restored if needed) | | |

---

## Sign-off

By signing below, the team confirms the new Amplior CRM has been tested against the old system and is approved to go live.

| Role | Name | Date | Decision (Go / No-go / Go-with-conditions) | Signature |
|---|---|---|---|---|
| Product Owner |  |  |  |  |
| Sales / Operations lead |  |  |  |  |
| Tester(s) |  |  |  |  |

**Outstanding conditions / known issues accepted at go-live** (list any items being deferred and the agreed plan/date to fix):

1.
2.
3.

---

*End of UAT & Parallel-Run Checklist. Any item marked Fail should be logged with the specific lead/meeting/user and the exact wrong value so it can be fixed quickly. When in doubt, the rule is simple: can the team do their real daily job, and is the data correct?*
