# Amplior / AltLeads CRM — User Stories, Flows & Blueprint

**Audience:** the product owner (non-technical) and the rebuild team.
**Purpose:** one authoritative, reviewable description of *what the system does* — every role, every module, the step-by-step flows, the rules, and the open decisions you (the owner) still need to make.

---

## How to review this (please read first)

You don't need to read code or understand databases to review this document. Here is all you need to do:

1. **Read each module section like a story.** Each one says "as a *role* I can do X", then walks through the steps, then lists the rules.
2. **Look for the colored tags** at the end of statements. They tell you how confident we are:
   - ✅ **CONFIRMED** — this comes straight from the official requirements document (the FRS). You can treat it as agreed.
   - 🔶 **INFERRED** — this is *not* written in the FRS; we worked it out by reading the old vendor's software and database. It is probably how it works today, but nobody has formally signed off on it.
   - ❓ **GAP** — something is missing, contradictory, or undecided. **This needs a decision from you.**
3. **Your homework is the last section: "❓ OPEN QUESTIONS FOR OWNER."** Every ❓ in the document is collected there as a numbered, plain-language question. If you answer those, the team can build with confidence.
4. **Small grey notes** like *(DB: lead_master)* name the underlying database table. You can ignore these — they're for the engineers.
5. Where the FRS and the old software **disagree**, we follow the FRS and flag the disagreement.

A note on the bigger picture: the company also has a **Change Request (CR)** that asks for things *beyond* the original requirements (new Companies and Contacts modules, a shift from a "leads" system to a "meetings" system, etc.). That future direction is summarized at the very end under **"CHANGE REQUEST DELTA"** so you can see what's coming and decide what to build now vs. later.

---

## Legend

| Tag | Meaning |
|---|---|
| ✅ CONFIRMED | Stated in the FRS (official requirements). Treat as agreed. |
| 🔶 INFERRED | Derived from the old vendor's code/database only. Likely true, not formally confirmed. |
| ❓ GAP | Missing, contradictory, or needs an owner decision. Collected at the end. |

---

# Roles

The system splits hard into two apps: a **Web app for Amplior's own internal staff**, and a **Mobile app for the client's sales team**. ✅ CONFIRMED (FRS Constraint C-1)

| Role | App | Who they are | What they broadly do |
|---|---|---|---|
| **Admin** (a.k.a. Super Admin) | Web | Amplior internal | Runs the whole system: creates users, clients, projects, roles, designations, domains, and sets who can access what. Also sees everything in Leads/Meetings/Wishlist/Dashboard. ✅ |
| **Team Lead (TL)** | Web | Amplior internal | Owns a project's quality gate: imports/assigns leads, **approves or rejects** the Lead Report, manages meetings, assigns Wishlist items to agents. ✅ |
| **Agent** | Web | Amplior internal | The day-to-day lead worker: creates leads, fills the Lead Report, logs activity, adds meeting links, requests approval from the TL, converts Wishlist items to leads. ✅ |
| **Sales Head (SH)** | Mobile | Client's side | Oversees the client sales team: sees team-wide meetings and analytics (pipeline, industry spread, revenue potential), can reassign salespeople, gives feedback, uploads wishlist companies. ✅ |
| **Sales Person (SP)** | Mobile | Client's side | Attends the meetings: sees own meetings (today/upcoming), submits the post-meeting feedback form, requests reschedule/drop, uploads wishlist companies. ✅ |
| **QC (Quality Control)** | Web (per old DB) | Amplior internal | ❓ **Not defined in the FRS at all** — no stories, screens, or permissions. The old database has a QC role (role_id 6) but with **no access granted to any module**. *(DB: role_master role_id=6)* 🔶 / ❓ |

Important clarifications:
- **"Admin" and "Super Admin" mean the same thing.** The FRS uses both words interchangeably; there is no separate, more-powerful "Super Admin" permission set defined. In the old database, "Super Admin" is simply the **Admin** role (role_id 1) which happens to have full access to everything. ✅ / 🔶
- **Role vs. Designation.** "Role" controls *access* (what you can click). "Designation" is just a label for reporting (Team Lead, Agent, Admin on the Amplior side; Sales Head, Salesperson on the client side). ✅
- The old vendor's access is **data-driven**: every role's permissions are stored as rows (read/write/edit/delete per module) and are editable in the Access screen — so in principle an Admin could even grant admin powers to another role. 🔶 *(DB: rbac_master)*

---

# Module: Dashboard

The first screen Amplior web users (Admin / TL / Agent) see after login. A simple performance snapshot. ✅ (FRS BR14)

### User stories
- *As an Admin/TL/Agent* I can see headline numbers (Hot Prospects, Leads, Meetings Completed, Meetings Scheduled) so I know where things stand. ✅
- *As an Admin/TL/Agent* I can see a **weekly bar chart** of meetings scheduled vs. completed (Monday→Sunday) so I can track the week's progress. ✅
- *As an Admin/TL/Agent* I can click "Meetings Scheduled" / "Meetings Completed" to see the weekly breakdown. ✅

### What's on the screen
- A "Welcome, *name*" header, **4 stat cards**, and **1 weekly bar chart** titled "Weekly Leads" with the current Mon–Sun date range. 🔶 *(old code renders exactly this; FRS BR14 matches)*
- The bar chart plots two series — Meetings Scheduled and Meetings Completed — across the seven weekdays. 🔶
- *(Minor old-code quirk: the chart's Y-axis is mislabeled "Leads" though it actually counts meetings; a cosmetic leftover.)* 🔶

### Key business rules
- **A "week" is Monday → Sunday** of the current week. ✅
- The numbers shown depend on **who is logged in**: 🔶
  - **Admin** sees **organization-wide totals** (all leads, all meetings). 🔶
  - **Everyone else (Agent, and in practice Team Lead too)** sees **only the leads/meetings they personally created**. 🔶
- ❓ **The Team Lead does NOT see their team's combined numbers** — in the old code the "team" calculation was disabled, so a TL sees only their own figures. This is almost certainly a bug, not the intent. The FRS implies a TL should see team performance. **Owner decision needed: should a TL's dashboard show their whole team's numbers?** ❓
- "Meetings Completed" is counted from leads whose stage reached **"Meeting Successful."** 🔶
- "Hot Prospects" counts leads currently at the **Hot Prospect** stage. 🔶

### A known contradiction
- ❓ The FRS *Solution Scope* section lists "Visual dashboards and performance analytics" as **Out of Scope**, yet other FRS sections (BR14 web dashboard, BR7 mobile sales analytics) **specify rich dashboards in detail.** These contradict each other. The later, detailed sections appear to override the out-of-scope line — but this should be confirmed. ❓

### DB tables involved
*Dashboard numbers are computed live, not stored. Counts come from `lead_master` (leads, hot prospects) and `lead_report` (meeting scheduled/successful, grouped by weekday). Role IDs: 1=Admin, 2=Team Lead, 3=Agent, 4=Sales Head, 5=Sales Person, 6=QC.*

> Note: The old system also had a **much richer "Sales dashboard"** (pipeline funnel, industry spread, revenue, city-wise activity) built in the backend but only used by the **mobile app** for Sales Head / Sales Person — see *Module: Meetings (Mobile side)* below. 🔶

---

# Module: Leads

The heart of the Amplior web app. An Agent (or TL/Admin) creates a lead, researches it, fills a structured pre-sales report, and — once the TL approves — a meeting is scheduled. ✅ (FRS BR2)

> This section uses the detailed, well-reverse-engineered **LEADS spec** as its basis and reconciles it with the FRS. Where they differ, it's flagged.

## A. Lead list & creation

### User stories
- *As an Agent/TL/Admin* I can **create a lead** — search for an existing company or create a new one, add the lead person and an opportunity — so all lead data lives in one place. ✅
- *As a TL/Admin* I can **bulk-import leads from an Excel file** (assigning agents inside the sheet) so I don't have to enter them one by one. ✅
- *As an Admin/TL* I can **assign or reassign a lead to a different Agent.** ✅
- *As an Agent/TL/Admin* I can **filter and search** the lead list (by status, last-updated date, input date). ✅
- *As an Agent/TL/Admin* I can **delete a lead** *only if its report was rejected.* ✅

### Lead creation — step by step
1. Open **Leads → Add Lead**. ✅
2. Pick **Client Association, Project, and Source** (all mandatory). ✅
3. **Search for the company.** If it exists, attach to it (or add a new branch address); if not, open the **New Company** popup. ✅
4. Fill in Company details, Address, Lead Information, Contact info, and Opportunity. ✅
5. Save → the system validates mandatory fields and assigns a **Lead ID** in the form `ALT123456`. ✅
6. The lead's stage is automatically set to **"In Progress."** ✅

### Required fields (creation)
Client Association, Project, Source, Company Name, Domain, Sector, Turnover, Industry, Sub-industry, Headquarters, Employee size (number), Company Website (URL), Address Line 1/2, City, State, Pin (6 digits), Lead name, Designation, Roles & responsibilities, Area of Interest, Phone (10 digits), Email. ✅
*Optional:* CIN, Alternate phone, LinkedIn, company logo, Opportunity title / value / description. ✅

### Key business rules
- Only **Agents, TLs, and Admins** create or edit leads; every lead must have a valid Client + Project. ✅
- **Email and Phone are unique per lead** (no duplicates). ✅
- A **company is uniquely identified by Company Name + Website + Address.** ✅
- **Industry → Sub-industry** is a dependent dropdown (sub-industry options filter by chosen industry). ✅
- A lead can be **deleted only when its report is in the Rejected state.** ✅

### Bulk import (Excel)
- **Only Team Lead & Admin** may import (Agents cannot). ✅
- File must be `.xlsx`, **max 5 MB**, with the **unaltered template headers**. ✅
- Mandatory columns include Assigned Agent Email, Client, Project, Company, Industry, Sub-Industry, HQ, Employee Size, Sector, Lead Name, Designation, Roles & Responsibilities, Area of Interest, Phone, Email. ✅
- **Invalid rows are skipped** with a reason (e.g., "Row 6: Skipped due to incorrect Agent email ID"). A blank agent column leaves the lead **unassigned**. ✅

### Assign / Reassign
- **Only Admin & TL.** Select a lead → Assign/Reassign → pick an agent → confirmation. **One agent per lead at a time.** Client/Project/Source/Company are read-only during reassign. ✅

### DB tables involved
*Lead ownership = `lead_master.created_by` (a user ID). Company link = `lead_master.client_assoc_id` → `client_association`. Stage = the latest `lead_report.stage_id` → `stage_master`.*

---

## B. The Lead Detail screen

Opening a lead shows one screen with three parts: a **header**, a **right-hand info panel**, and **three tabs (Activity, Lead Report, Meeting).** 🔶 *(structure from old code; consistent with FRS "Lead Overview")*

### Header
- Client name + location, project, lead number. 🔶
- A **Stage selector** (the lead's current stage, chosen from the master list of stages). 🔶 *(DB: stage_master)*
- A **progress bar**: Pre-Sales → Meeting → Closed. 🔶
- A **"Clinch / Close" button** that becomes available when the stage is **"Meeting Successful."** 🔶
  - ✅ The FRS confirms a **Clinch** button enabled only after a successful meeting / completed feedback. Pressing Clinch is what records a **Closed Deal** (which then shows on the Sales Head's mobile dashboard). ✅

### Right-hand panel (3 collapsible sections)
1. **Lead Information** — name, role/designation, source, mobile, alternate mobile, area of interest, LinkedIn, created date. Has a **pencil icon to edit.** 🔶
2. **Company Information** — client/company name, address, industry, sub-industry, size, turnover, sector, LinkedIn. **Read-only.** 🔶 *(DB: client_association)*
3. **Opportunity** — title, description, value. 🔶

---

## C. Tab 1 — Activity

### User stories
- *As an Agent/TL* I can **read the full activity history** of a lead (who did what, when) so there's a traceable record. ✅
- *As an Agent/TL* I can **add a comment** to the lead. ✅

### How it works
- A **chronological list**: each entry shows the author's initials, the comment text, and a timestamp. **System-generated entries are styled differently** from human comments. 🔶
- The Agent types a comment (**required, max 500 characters**) and it's saved as a new activity entry. 🔶
- **Auto-logged events** (the system writes these itself): lead created, report shared for approval, report edited by Agent/TL, report approved/rejected, status change, feedback received. ✅
- **System logs and user comments are non-editable and non-deletable.** ✅
- ❓ **Comment length is contradictory in the FRS:** one place says **1000 characters**, another says **500**. The old code / LEADS spec uses **500**. **Owner decision: 500 or 1000?** ❓

### DB tables involved
*(DB: `lead_activity` — fields lead_id, lead_comments, created_by, created_date.)*

---

## D. Tab 2 — Lead Report (the pre-sales form)

This is the structured research form. It **locks after the Agent clicks "Request Approval."** 🔶

### User stories
- *As an Agent/TL* I can **fill a domain-based pre-sales report** (questions + meeting details + assigned salesperson) so consistent data is collected. ✅
- *As an Agent* I can **request approval** from my TL so the meeting can be scheduled. ✅

### What's on the form (in order)
- **(A) Assign Salesperson / Sales Head** — a dropdown of users tagged SP/SH on this project. **Mandatory before requesting approval.** 🔶 / ✅
- **(B) Pre-Sales Questions** — loaded by **business domain** (predefined, the user answers but cannot change the questions). Each is a radio-button question (if it has preset options) or a text answer; **all required.** 🔶 / ✅
  - Predefined domains: **HR Services; Food/Beverages/Events; Security Management; Integrated Facility Management; Travel & Hospitality (B2B); Travel & Hospitality (B2C).** ✅
- **(C) New (ad-hoc) Questions** — the user can add custom Q&A pairs. **Up to 5 custom questions**; they're saved against this lead only (not system-wide); **no duplicate custom questions.** ✅ *(DB: new_sales_question)*
- **(D) Discussion** — a required free-text box (it is itself one of the pre-sales questions, named "Discussion"). ✅
- **(E) Sales Intelligence** — a free-text box for extra context. 🔶 *(DB: lead_report.sales_intelligence)*
- **(F) "Agreed for the meeting?"** — radio: **Yes / No / Tentative.** 🔶
  - **If YES** → capture the meeting: Mode (Telephonic / Online / Offline), Meeting Name, Date (today or later), Time, Duration (default 30 min), Participants (auto-filled: lead's email + the salesperson), Call Recording URL, SharePoint Image URL, and **Agenda (required).** 🔶 / ✅
  - **If NO** → capture a **Reason.** 🔶
  - **If TENTATIVE** → capture a **Follow-up Date.** 🔶

### Actions on this form
- **Save** — saves the report and all its child records. 🔶
- **Request Approval** — transitions the report to "pending approval," notifies the TL, and **locks the form.** ✅
- **View** — a read-only preview of the whole report. 🔶

### Required fields (FRS view)
Assign Salesperson; all pre-sales answers; Discussion; "Agreed for the Meeting?"; Meeting Mode; Meeting Name (3–100 chars); Date (no past dates); Time (12-hr); Participants (at least 1; lead + chosen SP shown automatically); Agenda (10–500 chars). ✅

### Key business rules / reconciliation with FRS
- Pre-sales answers are **editable by Agent & TL until the meeting date.** ✅
- **A salesperson cannot have two meetings at the same time** (validation). ✅
- ❓ **Meeting Mode wording differs:** the LEADS spec (old code) offers **Telephonic / Online / Offline**, but the FRS says **Online / Face-to-Face.** "Face-to-Face" = "Offline," and the old code adds a third "Telephonic" option the FRS doesn't list. **Owner decision: which set of meeting modes is correct — two (Online/Offline) or three (add Telephonic)?** ❓
- ❓ **Number of custom questions:** FRS says "up to 5." The old code didn't appear to hard-cap it. Confirm the cap is 5. ❓

### Status / approval transitions (driven from this tab)
- Saving with "Request Approval" → report status becomes **pending**, lead stage becomes **"New Meeting."** ✅
- *(Full approval lifecycle is in section F below.)*

### DB tables involved
*(DB: `lead_report` (+ `sales_intelligence`); `pre_sales_question` → answers in `pre_sales_answer`; custom questions in `new_sales_question`; when a meeting is agreed: `meeting_master` + `meeting_schedule` + `meeting_participant`. "No"/"Tentative" outcomes write `meeting_schedule.reason` / `meeting_schedule.tentative`.)*

---

## E. Tab 3 — Meeting

Mostly a **read-only view** of the meeting captured in the report, plus the ability to add the **live meeting link** once the stage is "Meeting Scheduled," and to manage/reschedule/cancel meetings. 🔶

### User stories
- *As an Agent/TL* I can **add the actual meeting link** (URL / phone / address) once a report is approved. ✅
- *As an Agent/TL* I can **see my upcoming meetings and my past meeting reports.** 🔶
- *As an Agent/TL* I can **reschedule or cancel** a meeting, with a reason. ✅
- *As an Agent/TL* I can mark **"Meeting confirmed by prospect."** ✅
- *As an Agent/TL* I can **read the salesperson's feedback** and add my own **agent feedback** after a meeting. ✅

### How it works
- An input for the meeting **URL / phone / address** (required; the placeholder changes by mode). This becomes editable only when stage = **"Meeting Scheduled."** 🔶 *(DB: meeting_master.meeting_url)*
  - **Rule:** Meeting URL is mandatory if Mode = Online; an Address URL is mandatory if Mode = Face-to-Face/Offline. ✅
- The rest of the meeting fields (name, date, time, duration, participants, agenda) are **read-only** here (set in the report). 🔶
- **Upcoming Meetings list** and **Past Meeting Reports list** for the current user. 🔶
- **Per-meeting "Update" modal** lets you either:
  - **Reschedule** — choose "postponed by" (Lead or Salesperson), new date/time/duration, and a reason. 🔶 *(old code: "postponed by" options are Lead / Salesperson, IDs 1/2)*
  - **Cancel** — choose "cancelled by" (Altleads/Amplior, Sales Team, or Lead) and a reason. 🔶 *(old code: cancelled-by options IDs 11/12/13)*
- **"Meeting confirmed by prospect" checkbox** — ticking it is **one-way** (can't untick in old code), and it moves the lead to "Meeting Confirmed." ✅ / 🔶
  - ❓ **Contradiction:** the FRS says **unticking reverts** the stage; the old code makes the checkbox permanent once ticked. **Owner decision: is the confirm checkbox reversible?** ❓
- **Past meetings** show two feedback views:
  - **Salesperson Feedback** — the **7-question form** the salesperson fills on mobile (web only *reads* it). 🔶 *(DB: feedback_question_master + feedback_answer)*
  - **Agent Feedback** — a single free-text box the agent fills once (locks after first save). 🔶 *(DB: meeting_master.agent_feedback)*

### The 7 salesperson feedback questions (read-only on web)
1. Did you meet with a relevant decision maker in the company?
2. Is this the right company which has or may have a requirement for the services?
3. Did the client have a business requirement as of now or in the next 3 months? *(a "Yes" here drives "Opportunities" on the Sales Head dashboard)* ✅
4. Did the Lead mention anything adverse towards the outreach done by the Leadgen Team?
5. Is the client ok for the sales team to pursue and follow up as next steps?
6. Do we have clear next steps defined after the meeting?
7. Is there any other specific feedback you would like to mention to the Leadgen team?
🔶 *(exact wording from old DB feedback_question_master)*

### Important rules / notes
- A meeting can only be added once the **lead report is approved.** ✅
- **Creating the actual meeting happens outside the app** (Zoom/Teams/etc.); the user just **pastes the link.** This is explicitly **out of scope** to build in-app. ✅
- 🔶 The old system also has a **"Missed"** meeting status that no screen sets manually — it's almost certainly applied automatically by a background job when a meeting's time passes without completion. ❓ **Owner: confirm we want auto-"Missed" behavior.** ❓

### DB tables involved
*(DB: `meeting_master`, `meeting_schedule` [the lead↔meeting bridge], `meeting_participant`, `meeting_reschedule` [history of reschedules/cancels], `feedback_question_master`, `feedback_answer`.)*

---

## F. Lead Report Approval — the approval lifecycle ✅ (FRS FR2.5)

### User stories
- *As an Agent* I can **request approval** of my lead report from my TL. ✅
- *As a TL* I can **preview, edit, and then approve or reject** a report so only qualified leads proceed. ✅

### Step by step
1. Agent finishes the report (salesperson **must** be assigned) → clicks **Request Approval** → TL is notified; status = **Pending Approval**. ✅
2. TL previews; may edit pre-sales/meeting details before deciding. ✅
3. **Approve** → lead stage automatically → **"Meeting Scheduled"**; **both the Agent and the Salesperson are notified**; the Agent can now add the actual meeting link. ✅
4. **Reject** → TL **must enter a rejection reason** → Agent is notified, can edit and resubmit. ✅

### Rules
- **Only TLs approve/reject** (Admin can too, per old code). ✅ / 🔶
- Salesperson must be assigned **before** approval. ✅
- Meeting date cannot be in the past. ✅
- Rejection reason is **mandatory.** ✅
- The meeting link can be added **only after approval.** ✅

### DB tables involved
*(DB: `lead_report` (status/stage), `in_app_notification` (Agent + SP notified). Approval/reject also writes activity to `lead_activity`.)*

---

## G. The 13-stage lead lifecycle (state machine) ✅ (FRS FR3.2 — authoritative)

These are the only allowed lead stages (chosen from a dropdown, one at a time, no free text). ✅

| # | Stage | When it happens | Who's notified |
|---|---|---|---|
| 1 | **To Be Assigned** | Default for Wishlist data shared by the client, until it becomes a lead | TL |
| 2 | **In Progress** | Automatically when "Add New Lead" is completed | Agent, TL (SH sees as Pipeline) |
| 3 | **Hot Case / Hot Prospect** | Agent manually marks it hot | Agent, TL |
| 4 | **New Meeting** | Automatically when the report is created & **Request Approval** clicked | Agent, TL |
| 5 | **Meeting Scheduled** | Automatically when **TL approves** the report (also on reschedule once lead confirms) | TL, Agent, SH, SP |
| 6 | **Meeting Dropped by Amplior** | When TL **rejects** with reason, or a cancel is marked "by Amplior" | Agent, SH, SP, TL |
| 7 | **Meeting Confirmed** | When the Agent ticks "Confirmed by prospect" (unticking reverts — see contradiction) | SH, SP, TL |
| 8 | **Meeting Canceled** | When a cancel is marked "by Lead" | SH, SP, TL |
| 9 | **Meeting Dropped by Sales Team** | When the sales team cancels from mobile, or cancel marked "by Sales team" | Agent, TL, SH, SP |
| 10 | **Meeting Postponed by Lead** | When a reschedule is marked "by Lead" | TL, Agent |
| 11 | **Meeting Postponed by Sales Team** | When a reschedule is marked "by Sales team" (or SP requests one) | TL, Agent |
| 12 | **Meeting Successful** | When SP/SH marks the meeting **Completed** | Agent, TL |
| 13 | **Meeting Follow-Up** | When SP sets a **Follow-up date** | Agent, TL |

- ❓ **Edge case:** from "Meeting Postponed by Lead," once the lead confirms a new time, the Agent can move it **back to "Meeting Scheduled" without re-approval.** This partly conflicts with the strict "TL must approve" gate elsewhere. **Owner: is bypassing re-approval after a lead-postponement acceptable?** ❓
- 🔶 The old *database* uses slightly different stage spellings/labels (e.g., "Meeting Droped By Amplior," "Warm," "Contacted") than the FRS list. The FRS list above is authoritative; the rebuild should standardize naming. ❓

### DB tables involved
*(DB: stage values live on `lead_report.stage_id` → `stage_master`; notifications in `in_app_notification`.)*

---

# Module: Meetings

A dedicated module to view and manage all meetings that came from **approved** lead reports. On the web it's largely a management/oversight view; the live action (feedback, reschedule requests) happens on mobile. ✅ (FRS BR3)

> Much of the meeting *creation/reschedule/cancel/feedback* mechanics are the same ones described in **Leads → Tab 3 (Meeting)** above; this module is the cross-lead, list-level view of them.

### User stories
- *As an Agent/TL* I can **see a list of all my meetings** (with client, company, project, lead, date, stage, salesperson, mode, status). ✅ / 🔶
- *As an Agent/TL* I can **search and filter** meetings (by lead stage and by meeting date). 🔶
- *As an Agent/TL* I can **open a meeting** to view its details, add the link, reschedule, cancel, or confirm. ✅
- *As an Agent/TL* I can **update lead & meeting status** via dropdown so everyone sees real-time progress. ✅
- *As an Agent/TL* I can **view the salesperson's feedback** to plan follow-ups. ✅

### Meetings list — what's shown
Sr. No, Client Name (+city/state), Company Name (+city/state), Project, Lead Name (clickable), Meeting Date, Subject, Lead ID, Lead Stage (color-coded), Prospect Confirmed (Yes/No), Salesperson (+ "(SH)"/"(SP)"), Meeting Mode, Agent Assigned, Contact Number, Status. 🔶
- Search is **debounced** and only fires after 2+ characters. 🔶
- Filters: by **Lead Stage** (dropdown) and by **Meeting Date** (date picker). 🔶
- The list itself is **read-only** (no edits happen here; clicking through opens the detail/lead). 🔶

### Managing a meeting — step by step
1. Meetings list shows meetings from **approved lead reports only.** ✅
2. Open a meeting → view Name, Salesperson, Mode, Date/Time/Duration, Participants, Agenda. ✅
3. The Agent creates the actual meeting **externally**, pastes the **Meeting URL**, optionally ticks "Meeting confirmed by prospect," then adds it. ✅
4. From the Upcoming list, the Agent can **Reschedule** (Postponed by Lead/Salesperson + new date/time/duration + reason) or **Cancel** (Cancelled by Amplior/Sales team/Lead + reason). ✅

### Key business rules
- A meeting can be added **only if the lead report is approved.** ✅
- **Meeting URL mandatory if Online; Address mandatory if Face-to-Face/Offline.** ✅
- The assigned salesperson must be **active.** ✅
- Each meeting is linked to a Lead ID. ✅
- **In-app meeting creation is out of scope** — only links are added; meetings are created in external tools. ✅
- **No two meetings for the same salesperson at the same time.** ✅

### Status transitions (meeting-level)
- A meeting is **created as "Confirmed."** 🔶
- **Reschedule** → status "Rescheduled" + a history row is written. 🔶
- **Cancel / Drop** → status "Cancelled" (shown to ops as "Dropped"). 🔶
- **Held** → "Completed" (set from mobile when the salesperson marks it done; unlocks feedback). 🔶
- **Time passed, not held** → "Missed" (set automatically by a background process). 🔶 / ❓

### Viewing feedback (web)
- Feedback is created by the SP on **mobile**; on web it's visible to **only the creating Agent + the project's TL.** ✅
- It's visible **only when the lead stage is "Meeting Successful" or "Meeting Follow-up"** and the SP feedback is filled. ✅
- The SP may suggest a **future follow-up date**, which is added to the Agent's Leads table. ✅

### Meetings on the Mobile side (Sales Head & Sales Person) ✅ (FRS BR7–BR9)
- **SP** lands on a **Home–Meetings** screen showing **only their own meetings**, split into **Today's** and **Upcoming.** ✅
- **SH** additionally sees analytics: **Hot Prospect + Revenue Potential, Meetings Overview (per-city graph), Industry Spread, and a Pipeline** (Hot Prospects → Meetings Scheduled → Meetings Completed → Opportunities → Closed Deals), plus a **"Request Detailed Report"** (emailed). ✅
- Meetings are categorized **Scheduled, Completed, Rescheduled, Dropped, Missed**, filterable by Today/Week/Month/Year + a calendar range. ✅
- **SH can reassign the salesperson** on a meeting (a mobile-only capability — the web has no reassign-salesperson screen). 🔶
- **SP/SH can request a reschedule or drop**, which goes to the Agent/TL for approval. ✅
- ❓ The FRS is inconsistent about how many tabs the mobile meetings screen has ("three tabs" vs. a list of five categories). Minor; confirm the tab layout. ❓

### Cross-module data rules (important and easy to miss)
- **Closed Deals** are populated when a **web user clicks "Clinch"** on the Lead Report. ✅
- **Opportunities** are populated when feedback answers **"Yes"** to *"Did the client have a business requirement as of now or in the next 3 months?"* ✅

### DB tables involved
*(DB: `meeting_master` [the meeting record — status, url, confirm flag, agent_feedback], `meeting_schedule` [links meeting↔lead_report], `meeting_participant`, `meeting_reschedule` [reschedule/cancel history], `feedback_question_master` + `feedback_answer` [the 7-Q salesperson form]. No direct salesperson FK on the meeting — the tie is via `meeting_schedule.report_id → lead_report`.)*

---

# Module: Wishlist

A "wishlist" is a company a field salesperson **flags on mobile** (with a geo-tagged photo and location) as worth pursuing. It flows up to a Team Lead, who assigns it to an Agent, who later **converts it into a Lead.** ✅ (FRS BR6/BR11)

### User stories
- *As a Sales Head/Salesperson* I can **capture a wishlist company on mobile** (one geo-tagged photo + company + address + description) so the Amplior team can pursue it. ✅
- *As a Team Lead/Admin* I can **view wishlist items** shared by the sales team and **assign one to an Agent.** ✅
- *As an Agent/TL* I can **convert a wishlist item into a Lead** (the lead form pre-fills from the wishlist). ✅
- *As a TL/Admin* I can **import wishlist items via Excel** and **export the wishlist** to Excel. ✅
- *As a Sales Head/Salesperson* I can **see my wishlist items** grouped as **All / Sent / Converted** with live counts. ✅

### Mobile capture — step by step (SH/SP)
1. Capture or upload **one geo-tagged image** (requires location services on — else "Geo-tag not found"). ✅
2. Enter company name, address (line 1/2), city, state, country, zip, and a description (≤300 chars). ✅
3. "Add to List" → it's **immediately available to the assigned TL.** ✅
4. The wishlist's TL is **auto-assigned**: the system picks the **Team Lead of the salesperson's project.** 🔶
   - ❓ If a project has **no Team Lead**, the old system silently drops the wishlist. **Owner: what should happen if there's no TL on the project?** ❓

### Web view & assign — step by step (TL/Admin)
1. View the wishlist list (company, "shared by," address, lat/long, description, date, status). 🔶
2. Open an item → see its details and the **geo-tagged image** (downloadable). 🔶
3. **Assign Agent** (a dropdown of agents) → confirm. The agent is **notified.** ✅ / 🔶
   - *(In the current version, assignment is stored directly on the wishlist record; the older `wishlist_assign` table is dead/unused.)* 🔶

### Convert to Lead — step by step (Agent/TL)
1. Select a wishlist item → **Convert to Lead** → the Add-Lead form opens **pre-filled** with the wishlist data. ✅
2. The lead **Source is forced to "Wishlist"** (no source picker shown). ✅ / 🔶
3. If the wishlist has no linked company yet, the **Add Company** popup opens first. 🔶
4. On save, the lead is created and the wishlist's **status becomes "Converted to Lead"** (terminal — the Convert button then disables). ✅

### Import / Export
- **Import:** Team Lead & Admin only; predefined `.xlsx` template; the assigned-agent email must be a registered Agent; invalid rows error out. ✅
- **Export:** Wishlist data can be exported to Excel. 🔶 / ✅

### Mobile view (SH/SP)
- Tabs **All / Sent / Converted** with live counts; cards show company, date added, status badge, address; searchable by company. ✅
- **Edit** is allowed only while **not yet converted.** 🔶

### Key business rules / status
- Wishlist statuses are just **"WishList" (sent)** and **"Converted to Lead"** (terminal). 🔶
- Role-scoped visibility: Admin sees all; TL sees items assigned to them; Agent sees items assigned to them; SH/SP see what they created. 🔶
- ❓ **The FRS labels FR6.1 as "Import via Excel" but its description is actually a View+Assign screen** — a documentation mislabel. Treat it as View+Assign. ❓
- ❓ **Big future change (CR):** the CR wants Wishlist to convert **directly to a *Meeting*** instead of to a Lead. Today it converts to a Lead. This is a major behavior change — see CR Delta. ❓

### DB tables involved
*(DB: `wishlist` [company, geo, status, assign_tl, assign_agent, created_by=the salesperson]; `company_master` and `address_master` get linked on convert. "Shared by" is `created_by` resolved to a user, not a foreign key.)*

---

# Module: Notifications

A simple, **view-only** notification feed. Web users see a bell with a red dot; mobile users get the same idea. ✅ (FRS BR5 web / BR10 mobile)

### User stories
- *As an Admin/TL/Agent (web)* I can **see a list of my notifications** (type, time, context) and click one to jump to the relevant meeting or lead. ✅
- *As a Sales Head/Salesperson (mobile)* I can **see my notifications** (meeting scheduled/rescheduled, reminders, cancellations). ✅

### How it works
- Notifications are **view-only**: you **cannot delete** them; they're marked read when viewed; a **red dot** shows when there's something new; empty state reads "You currently have no new notifications." ✅
- Clicking a notification routes you contextually — to the **meeting detail** (for reschedule/cancel/confirm/feedback events) or to the **lead preview** otherwise. 🔶
- The panel shows the first 10 with a "View More / View Less" toggle. 🔶

### What triggers a notification ✅ / 🔶
- Agent shares a report for approval; TL approves/rejects; meeting rescheduled/cancelled/updated; prospect requests reschedule or cancel; **prospect confirms meeting**; **feedback submitted**; **new wishlist assigned to an agent.** ✅ / 🔶

### Who sees which notifications (web) ✅
- **Admin:** everything. ✅ / 🔶
- **Team Lead:** notifications by or addressed to everyone under them (their agents, salespeople, sales heads on their projects) plus themselves. 🔶
- **Agent:** notifications from their TL's pool (agents/salespeople/sales heads under that TL) plus those addressed to the agent. 🔶
- The FRS also lists specific per-role notification types (e.g., Admin: requested to reschedule, meeting rescheduled, feedback received, requested for approval, request approved, assigned new wishlist, meeting confirmed; TL and Agent have similar, slightly trimmed lists). ✅

### Important caveats (from old code)
- ❓ **Read/unread is faked in the browser**, not stored on the server. The old system never actually records "this notification was read" — it just remembers the highest notification ID **per browser** using local storage. Consequence: clearing browser data or switching devices makes everything look unread again. **For the rebuild, owner should decide: do we want proper server-side read tracking (per user, across devices)?** ❓ 🔶
- ❓ On the **mobile** side specifically, the web notification endpoint returns **nothing for Sales Head / Sales Person** in the old code (no branch handles them) — mobile notifications likely come from a different path. Confirm mobile notifications work end-to-end in the rebuild. ❓ 🔶
- When a lead/report/meeting is deleted, its notifications are **deleted** server-side (not just hidden). 🔶

### DB tables involved
*(DB: `in_app_notification` — message, route, is_seen [present but unused], plus links to user/meeting/lead/report.)*

---

# Module: Admin (Super Admin)

The control room. Only the **Admin** role can use it. Here Admins manage **Users, Clients, Projects, Roles, Designations, Domains, and Access (permissions).** ✅ (FRS BR4)

### Umbrella user story
- *As an Admin* I can manage all the master data and permissions of the CRM so I control who exists, what projects run, and who can do what. ✅

### Access model (how permissions work) 🔶
- Every role has **four permission bits per module: Read (view), Write (add), Edit, Delete.** 🔶 *(DB: rbac_master)*
- Enforcement happens in three layers: the **sidebar hides** modules you can't read, the **routes** are blocked, and **individual buttons** are hidden. 🔶
- ❓ **"Delete" exists in the data but has no working button anywhere** — the old system never hard-deletes; it only **deactivates** (status toggle Active/Inactive) and keeps an audit trail. **Owner: confirm the rebuild should also avoid hard deletes (deactivate-only)?** ❓ 🔶
- In the old system, **only Admin** has access to the seven admin modules; **TL, Agent, and QC have none.** 🔶

---

### Admin sub-module: User Management ✅ (FR4.1)
- **Two tabs: Amplior users vs. Client users.** ✅
- *As an Admin* I can **add, edit, and activate/deactivate** users. ✅
- **Required fields:** First Name (letters), Last Name (letters), Work Email (unique), Contact (10 digits, unique), Role, Designation, **Client Association (mandatory only on the Client tab)**, Status (defaults Active). ✅
  - Old code adds: **Employee ID** (Amplior only, up to 6 digits), and for client users optional LinkedIn/State/City. 🔶
- **Amplior designations:** Team Lead / Agent / Admin. **Client designations:** Sales Head / Salesperson. ✅
- **Role on the Client tab is restricted** to Sales Person / Sales Head only. 🔶
- **Rules:** Email + Contact unique across the whole system; inactive users can't log in; **an Admin cannot deactivate their own account while logged in.** ✅
- *(DB: `user_master`, `user_role` [user↔role, many-to-many], `client_assoc_user` [user↔client].)*

### Admin sub-module: Client Management ✅ (FR4.2)
- *As an Admin* I can **add/edit/activate/deactivate** clients. ✅
- **Required:** Client Name, Contact Person, Email (unique), Phone (10 digits, unique), CIN (unique), Industry, Location, Domain, Address L1/L2, City, State, Country, Pin. Website optional. ✅
- **Rules:** CIN, Email, Phone unique per client; each client needs a unique CIN or Domain; an inactive client can't be linked to new users/leads. ✅
- ❓ The CR wants to **remove Domain from the Client form** (domain moves to the Project/company-location level). For now Client keeps Domain. ❓
- *(DB: `client_association` (+ `address_master`).)*

### Admin sub-module: Project Management ✅ (FR4.3)
- *As an Admin* I can **add/edit/activate/deactivate** projects. ✅
- **Required:** Project Name (unique per client), Client Association (active clients only), Assign TL, Assign Agents, Assign Salesperson (all from active users). ✅
- ❓ **Discrepancy:** the FRS lists **Assign Sales Head as required**; the old code makes **Sales Head optional.** **Owner: is a Sales Head mandatory on a project?** ❓
- **Today: one TL and one Sales Head per project.** The CR wants to allow **multiple** of each — see CR Delta. ✅ / ❓
- *(DB: `project`, `project_user` [team members with project-scoped role names: TEAM_LEAD/AGENT/SALES_HEAD/SALES_PERSON].)*

### Admin sub-module: Role Management ✅ (FR4.4)
- *As an Admin* I can **add/edit roles** (name unique). ✅
- Editing a role's **permissions** actually redirects to the **Access Management** screen — permissions are *only* configured there. ✅
- A role is tagged **Web or Mobile** (platform). 🔶
- *(DB: `role_master` — note: the displayed name is derived server-side; there's no separate display-name column.)*

### Admin sub-module: Designation Management ✅ (FR4.5)
- *As an Admin* I can **add/edit designations** (unique). ✅
- **A designation in use by users cannot be deleted**; editing it updates everywhere. ✅
- *(DB: `designation_master`.)*

### Admin sub-module: Domain Management ✅ (FR4.6)
- *As an Admin* I can **add/edit business domains** (unique), used in Lead Creation. ✅
- **A domain in use cannot be deleted**; edits propagate to leads. ✅
- *(DB: `domain_master`.)*

### Admin sub-module: Access Management (the permissions editor) ✅ (FR4.7)
- *As an Admin* I can **set, per role and per module, the Add / Edit / View permissions** via checkboxes. ✅
- **Separate Web and Mobile tabs.** Web roles = Admin, Team Lead, Agent (+ QC exists but unused). Mobile roles = Sales Head, Salesperson. ✅ / 🔶
- **Changes take effect immediately** (no re-login). ✅
- Certain checkboxes are **locked** to prevent nonsensical combinations (e.g., Dashboard view is always on; some modules are view-only). 🔶
- *(DB: `rbac_master`, `use_cases` [the module list].)*

---

# Module: Settings (Personal Info & Logout)

Both apps have a small personal-settings area. ✅ (FRS BR15 mobile / BR16 & BR17 web)

### User stories
- *As any web user (Admin/TL/Agent)* I can **view my profile** (name, contact, work email, employee ID, client association, role, designation), **change my password**, and **manage my profile picture.** ✅
- *As any mobile user (SH/SP)* I can **view my info** (contact, email, employee ID, role, client association), **change my profile picture and password**, and **log out securely.** ✅
- *As any web user* I can **log out** with a confirmation popup (Yes/No). ✅

### Step by step (web settings)
1. Open Settings → Personal Info. ✅
2. View read-only details; change password requires **Current + New password.** ✅
3. Profile picture: remove / crop / add / save. ✅
4. Logout → confirmation popup → session ends. ✅

### Key business rules
- ❓ **In the old system the web profile was largely read-only.** The CR explicitly asks to **make web user settings editable.** **Owner: which profile fields should be editable (vs. admin-managed)?** ❓
- Password must meet strength rules (min 8 chars, upper, lower, number, special). ✅

### DB tables involved
*(DB: `user_master` for profile + password; profile image stored externally.)*

---

# Authentication (cross-cutting — applies to all modules)

Not a "module" the owner clicks into, but it gates everything, so it's summarized here. ✅ (FRS BR1/BR13)

- **Sign-up is invite-only:** you can only register if an Admin has **pre-registered your email + phone.** No public self-signup. ✅
- **Sign-up flow:** enter pre-registered email + 10-digit phone → email OTP (6 digits) → set a strong password → done. ✅
- **Sign-in:** mobile number + password → web users land on Leads; mobile users land on Home. ✅
- **Forgot password:** email → OTP → new password. ✅
- **Inactive users cannot log in** ("contact admin"). ✅
- A web user with **zero web roles is shown "Access Denied"** at login. 🔶
- ❓ **OTP expiry is stated four different ways in the FRS** (10 seconds, 30 seconds, 10 minutes, 30 minutes). **Owner: what is the correct OTP validity window?** ❓

*(DB: `user_master`.)*

---

# Module: Companies (BUILT — IN PROGRESS)

A dedicated module to view and manage the 525 target companies. Built as part of CR Layer 2 at owner's request (2026-06-14).

### User stories
- *As an Agent/TL/Admin* I can **search and browse the company list** (by name, industry, city) and export to Excel. DONE
- *As an Agent/TL/Admin* I can **open a company detail** to see its contacts, related leads, and per-project account fields. DONE (partial — per-project ownership UI still planned)
- *As an Agent/TL/Admin* I can **create a new company** with dedup checking (cleaned domain OR CIN). DONE
- *As an Admin* I can flag a company as **demo** (is_demo=true) so it is excluded from dedup and real reporting. DONE

### Dedup rules
- Primary key for dedup: cleaned website domain (e.g. tata.com).
- Fallback: CIN number (one company can have multiple CINs — use carefully).
- On create: if a match is found, the form shows the existing record and its per-project owner (or "Unassigned") and blocks the duplicate.
- Demo entries (`is_demo=true`) skip dedup entirely.

### Per-project account fields (PLANNED / IN PROGRESS)
- *As an Agent/TL* I can set a company's **Account Status** for my project (e.g. Active, Churned) from the admin-editable dropdown list.
- *As an Agent/TL* I can record whether the company is **Feasible** for my project.
- *As an Agent/TL* I can record the company's **Decision Power** (Centralised / Regional / Hybrid).
- *As an Agent/TL* I can add a **Description** and **Comments** for the company — per project, visible to owner + Admin only, full edit history stored.
- All of the above are per-project (same company can have different values on AP Securitas vs. HungerBox).

### DB tables involved
*(DB: `company_master` + columns `domain_clean`, `is_demo`; per-project fields in `company_project_status`; contacts linked via `contact_master.company_id`.)*

---

# Module: Contacts (BUILT — IN PROGRESS)

A dedicated module for the 607 contacts extracted from lead data. Built as part of CR Layer 2 at owner's request (2026-06-14).

### User stories
- *As an Agent/TL/Admin* I can **browse, search, and filter** the contacts list and export to Excel. DONE
- *As an Agent/TL/Admin* I can **view a contact's detail** — their company link, call history, and per-project status. DONE
- *As an Agent* I can **log a call disposition** against a contact (e.g. "Called — No Answer", "Meeting Booked") which writes to the interaction history. DONE
- *As an Agent/TL/Admin* I can **create a new contact** with dedup checking. DONE
- *As an Agent/TL/Admin* I can **change a contact's company** from the contact detail page (pencil icon). DONE
- *As an Agent/TL/Admin* I can **link an existing contact** to a company from the company detail page. DONE
- *As an Agent* I can **pick an existing contact when creating a lead** (instead of re-entering their info). The lead saves a `contact_id` link. DONE

### Dedup rules
- Primary key: professional email (cleaned lowercase).
- Fallback 1: LinkedIn URL (cleaned).
- Fallback 2: mobile phone.
- On create: if a match is found, show the existing record and block the duplicate.
- Demo mode (default ON for new contacts): skips dedup, marks `is_demo=true`.

### Per-project status (PLANNED / IN PROGRESS)
- *As an Agent/TL* I can record a **Contact Status** per project (e.g. Active, Nurturing, Unresponsive) from the admin-editable dropdown.
- *As an Agent* I can log a **Call Disposition** per contact call (e.g. Called, Voicemail, Meeting Booked, Not Interested).
- Both are per-project and per-contact. Full history via `interaction` table. Owner + Admin only.

### Saved column views (PLANNED)
- *As any user* I can **choose which columns to show** on the contacts list and **save that view** under a name.
- The view persists across sessions (stored in `user_view_pref`).
- Resetting to default keeps the old named views.

### Multi-select + export (PLANNED)
- *As an Agent/TL/Admin* I can **select multiple contacts** (checkboxes + "Select All") and export the selection to Excel.

### DB tables involved
*(DB: `contact_master` [607 rows, dedup indexes on email/linkedin/mobile, `company_id`, `is_demo`]; `interaction` [call logs, status changes, per contact+project]; `contact_project_status` [current status per contact+project]; `user_view_pref` [saved column views].)*

---

# Module: Notifications — enhanced (DONE)

Updates since the original notifications spec above:

### New triggers (all DONE)
- **Meeting scheduled** — fires in-app + email to the assigned salesperson when a lead report is approved.
- **Meeting rescheduled** — fires in-app + email to the salesperson when reschedule is saved.
- **Meeting cancelled** — fires in-app + email to the salesperson when cancel is saved.
- **Lead assigned** — fires in-app + email to the agent when a lead is created with `agent_id` or created_by set.
- **Lead reassigned** — fires in-app + email to the new agent when a lead owner changes.
- **Wishlist assigned** — fires in-app + email to the agent when a wishlist item is assigned to them. DONE
- **Approval requested** — fires in-app + email to the TL / Admin when agent clicks "Request Approval." DONE
- **Approval approved** — fires in-app + email to agent + salesperson when TL approves. DONE
- **Approval rejected** — fires in-app + email to agent when TL rejects. DONE

### Live notification bell (DONE)
- *As any web user* I can see a **live unread count badge** on the bell icon in the sidebar.
- The badge polls every 60 seconds for new unread notifications (same pattern as the Approvals pending count).
- The badge disappears when all notifications are marked read.

### ❓ Open questions updated
- Q14 (server-side read tracking): **PARTIALLY ANSWERED** — `is_seen` column exists and is now set on mark-read. Cross-device sync works. The legacy `status` field misuse is fixed (see QA-AUDIT resolved items).

---

# Module: Admin — new capabilities (DONE)

### Add User (DONE)
- *As an Admin* I can **create a new user** from the Users tab in the Admin panel.
- Flow: fill First Name, Last Name, Work Email, Contact, Role, Designation → system inserts into `user_master` + `user_role`, calls Supabase Auth to create a login, trigger `handle_new_auth_user` builds the `profiles` row from `user_role → role_master`, and returns a temporary password.
- The temporary password is shown once in the modal — Admin copies it and sends it to the new user out-of-band.
- The new user can then log in and change their password from Settings.

### Reset Any User's Password (DONE)
- *As an Admin* I can **reset any user's password** from the row actions in the Users tab.
- This calls the service-role backend (`POST /api/users/reset-password`) which calls `auth.admin.updateUserById`.
- The new temporary password is shown once — Admin copies and sends it to the user.
- **Requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` on Hostinger env vars to work in production.**

### Admin-editable dropdown lists (PLANNED)
- *As an Admin* I can **edit the dropdown options** for: Contact Status, Call Disposition, Account Status, Decision Power, Feasibility.
- Changes apply system-wide immediately. Existing records using a removed option keep their value (soft-delete the option, not the data).

### Pre-sales questions per domain (PLANNED)
- *As an Admin* I can **configure the pre-sales questions** that appear in the Lead Report for each business domain (HR Services, Food/Bev, Security, IFM, Travel B2B, Travel B2C).
- Currently the questions are fixed in the database (`pre_sales_question` table). The admin UI to manage them is planned.

---

# Feature: Saved Column Views (PLANNED)

- *As any user* I can **customize which columns are visible** on any list screen (Leads, Contacts, Meetings, Wishlist, Companies).
- I can **save a view** with a name so it persists across sessions.
- I can **switch between saved views** (e.g. "Compact" vs "Full").
- Resetting to default does not delete my saved views — it just switches to the default.
- Stored in: `user_view_pref` (per user, per screen).

---

# Feature: Multi-select + Export (IN PROGRESS)

- *As an Agent/TL/Admin* on any list screen I can **tick checkboxes** to select specific rows (or "Select All" for the current page).
- I can then click **Export Selected** to download just those rows as Excel, without changing any filters.
- Currently built for Leads, Meetings, Wishlist (18-field export). Contacts multi-select is planned.

---

# ❓ OPEN QUESTIONS FOR OWNER (your homework list)

Please give a yes/no or short answer to each. These are the only things blocking a confident build.

**Roles & access**
1. **QC role** — The FRS never defines QC (no screens, no permissions), but the old database has a QC role with no access. Do you want a QC role at all? If yes, what should QC be able to see and do?
2. **"Delete" vs "Deactivate"** — The old system never truly deletes records; it only deactivates (with a full audit trail). Confirm the rebuild should keep **deactivate-only** (no hard delete) everywhere.
3. **Team Lead dashboard scope** — Should a Team Lead's dashboard show **their whole team's** numbers (the old code accidentally showed only the TL's own)? We assume "yes, team-wide."

**Leads**
4. **Comment character limit** — Activity comments: is the limit **500** or **1000** characters? (FRS says both.)
5. **Meeting modes** — Are meeting modes **Online / Offline (Face-to-Face)** only, or do we also keep **Telephonic** (three options, as in the old code)?
6. **Custom pre-sales questions** — Confirm the cap is **5 custom questions** per lead (and that duplicates are blocked).
7. **"Confirmed by prospect" checkbox** — Is it **reversible** (FRS says unticking reverts the stage) or **one-way/permanent** (old code)? 
8. **Re-approval bypass** — When a lead-postponed meeting is rescheduled and the lead reconfirms, is it OK for the Agent to move it straight back to "Meeting Scheduled" **without the TL re-approving**?
9. **Stage naming** — The FRS stage names and the old database's stage labels differ in spelling (e.g., "Meeting Dropped by Amplior" vs "Meeting Droped By Amplior," plus extra old labels "Warm"/"Contacted"). Approve standardizing on the FRS names?

**Meetings**
10. **Auto-"Missed"** — Confirm you want meetings to be **automatically marked "Missed"** by a background job when their time passes without completion.
11. **Mobile meetings tabs** — The FRS contradicts itself on whether the mobile meetings screen has three tabs or five status categories. What's the intended layout?

**Wishlist**
12. **Wishlist → Lead vs Wishlist → Meeting** — Today, converting a wishlist creates a **Lead**. The CR wants it to create a **Meeting** directly. Which behavior do you want in the rebuild?
13. **No-TL projects** — If a wishlist is captured on a project that has **no Team Lead**, what should happen (today it's silently dropped)? Suggest: block capture, or route to Admin.

**Notifications**
14. **Server-side read tracking** — Do you want notifications' read/unread state stored **per user on the server** (so it's consistent across devices), instead of the old browser-only behavior?

**Admin / Projects**
15. **Sales Head on a project** — Is assigning a **Sales Head mandatory** when creating a project (FRS says required; old code says optional)?
16. **Multiple TLs/SHs per project** — Do you want to allow **multiple Team Leads and multiple Sales Heads** on one project now (a CR ask), or keep one-each for the first release?

**Settings / Auth**
17. **Editable profile** — Which profile fields should users be able to **edit themselves** (the CR asks to make web settings editable)?
18. **OTP expiry** — What is the correct **OTP validity window**? (FRS lists 10s / 30s / 10m / 30m.)

**Admin / new capabilities**
21. **Admin dropdown management UI** — Which dropdown option lists should be admin-editable via the UI? (Currently seeded: Contact Status, Call Disposition, Account Status, Decision Power, Feasibility.) Should admins be able to add/remove options, or only reorder them?
22. **Pre-sales questions per domain** — Should admins be able to edit the pre-sales questions from within the CRM, or are they fixed in the database and changed only by the dev team?
23. **Service-role env vars on Hostinger** — Have `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` been added to the Hostinger env vars? Without them, Add User and Reset Password return 503. NEEDS OWNER ACTION.

**Scope-level**
19. **Dashboards in/out of scope** — The FRS lists "visual dashboards & analytics" as out-of-scope in one place but specifies them in detail elsewhere. Confirm dashboards (web BR14 + mobile BR7) **are in scope.**
20. **CR now or later** — How much of the Change Request (Companies module, Contacts module, multi-tenant org layer, meetings-centric pivot, calendar/email/Kafka integrations) do you want in the **first rebuild** vs. a later phase? (See CR Delta below.)
    > ✅ **ANSWERED (2026-06-12):** First rebuild = **FRS-parity + small Layer-1 CR** (filters, exports, editable settings/reports). **CR Layer 2 deferred** to a later phase. NOTE: Owner later decided to build Companies + Contacts modules NOW (2026-06-14 decision, started CR Layer 2 early).

> ✅ **ANSWERED (2026-06-12) — App structure (was a TBD in Roles doc):** Keep **two apps** — **Web** for the Amplior internal team (Admin, Team Lead, Agent); **Mobile** for the client sales team (Sales Head, Sales Person). **Sales Person gets web access in a LATER release**, not the first one. Build web with that future in mind but gate SP off web for now.

> ✅ **ANSWERED (2026-06-14) — Notification read tracking (Q14):** Server-side read tracking is now implemented (`is_seen` column on `in_app_notification`, updated on mark-read). Cross-device consistent.

> ✅ **ANSWERED (2026-06-16) — Password column (security):** Legacy plaintext `user_master.password` column is hidden via column-level REVOKE (not dropped — data kept). Users cannot read or write it via the API.

> ✅ **ANSWERED (2026-06-14) — Dedup keys for contacts and companies:** Contact = email (primary) → LinkedIn cleaned (secondary) → phone (tertiary). Company = cleaned domain (primary) → CIN (secondary, caveat: one company can have multiple CINs). Demo entries skip dedup.

---

# CHANGE REQUEST DELTA (what the CR wants *beyond* the FRS)

There are **two layers** of change request, and it's important not to confuse them:

### Layer 1 — the "Early"/minor CR (formal CR document, 7 items, ~24 person-days, INR 96,000, already in production)
Small, approved tweaks to the existing system:
1. **Editable web user settings** (profile becomes editable). *(Modification)*
2. **Editable lead report** — editable before approval, and per the CR doc also after it's sent/approved/rejected (edit added alongside the existing "delete after reject"). *(Modification)*
3. **Editable meeting details after a meeting concludes** — Admin (and the project TL, via access management) can update. *(Modification)*
4. **Filters in the Leads module** — by lead-generation date, agent, industry, city, meeting date, SP/SH, meeting stage. *(Addition)*
5. **Filters in the Meetings module** — the same 7 filters. *(Addition)*
6. **Export from Leads** — Excel export with 18 fields (including all pre-sales questions and feedback questions as columns). *(Addition)*
7. **Export from Meetings** — the same 18-field export. *(Addition)*

### Layer 2 — the expanded/architectural CR (in the effort workbook only, 18 items, ~421 hrs — the real future direction)
This is a significant re-shaping of the product. Highlights:

**New modules / capabilities (Additions):**
- **Multi-Organization (multi-tenant) layer** — a new "Organization" layer under Super Admin; each org's data is isolated, with an org-level admin.
- **Companies module** — a dedicated place to maintain company details (auto-captured from meetings, or added directly), with **version history** of company info; companies are client-specific.
- **Centralised Contacts module** — a contact repository linking contacts to companies, with **email integration** so web users can contact external participants directly, and **opportunity details added into the pre-sales questions** for a contact.
- **Calendar integration** — send Outlook/Google calendar invites (with the meeting link) to external participants.
- **API & Webhooks via Kafka** — on meeting creation, publish to a Kafka topic so downstream services (notifications, reports, analytics, syncing) can consume it.
- **New web screens** — a dedicated **Meeting View** screen and a **Feedback** screen.

**Major changes to existing behavior (Modifications):**
- **Meetings-centric pivot** — the product shifts from "leads-centric" to "meetings-centric." Notably, the CR's web-impact sheet says the **Leads screen is *removed* on web**, and both **web and mobile dashboards are rebuilt around meetings** instead of leads.
- **Wishlist converts directly to a *Meeting*** (instead of to a Lead) — a fundamental change to today's flow.
- **Domain is managed per company *location*** (not per company) — one company can have multiple locations, each with its own domain; correspondingly, **Domain is removed from the Client form and added to the Project form.**
- **Multiple Sales Heads & Team Leads per project** (today: one each).
- **Global search across all lead fields** (today: only client & company name).
- **Feedback surfaced on the Lead Overview page** (today only in notifications).
- **Expanded data export** for the Meetings module and for completed/successful-meeting feedback.
- **Expandable/collapsible pre-sales Q&A on mobile.**

> ⚠️ **Owner attention:** Layer 2 is not a minor tweak — it changes the core data model (Companies + Contacts as first-class modules, meetings decoupled from leads) and even proposes **removing the web Leads screen**. This is exactly what **Open Question #20** is asking you to decide: how much of this belongs in the first rebuild vs. a later phase. The FRS-based blueprint above describes the **current/target-from-FRS** behavior; the CR describes **where the product is heading next.**

---

*End of document. Last updated: 2026-06-17. Sources synthesized: FRS v2.0 (✅ authoritative); reverse-engineered Meetings, Wishlist, Dashboard/Notifications, and Admin extracts from the old vendor web/mobile/backend code + live Supabase DB (🔶); the inline LEADS spec; the Change Request scope (CR document + effort workbook); and REBUILD_LOG.md session entries through 2026-06-17.*
