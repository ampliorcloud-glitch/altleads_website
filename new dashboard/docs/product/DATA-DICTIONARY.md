# Data Dictionary — Amplior / Altleads CRM Database

*Purpose: a plain-language guide to the Amplior CRM database (Supabase / Postgres) — what each table holds, what its important columns mean, and how the tables connect. Written so a non-technical owner can read it, with small technical notes where they help.*

*Last updated 2026-06-17*

---

## How to read this

- The database has **75+ tables** holding about **108,000 rows** of real, migrated production data. New tables added during the rebuild are documented at the end of each relevant section.
- Tables are grouped by **domain** (Leads, Meetings, Wishlist, etc.) so related things sit together.
- For each important table you get: a **one-line purpose**, its **key columns** in plain words, and **how it links** to other tables.
- A **"table" is like a spreadsheet tab**; a **"column" is a spreadsheet column**; a **"row" is one record** (one lead, one meeting, one person).
- **"Links to"** means one table points at another — e.g. a lead points at the salesperson who created it. In tech terms these are *foreign keys*.
- Most tables share the same housekeeping columns (`created_by`, `created_date`, `updated_by`, `updated_date`, `deleted_by`, `deleted_date`). These record **who made/changed/removed the row and when**. "Deleted" rows are usually *soft-deleted* (a date is stamped, the row stays) rather than physically removed. To avoid repetition, these are described once below and not repeated for every table.
- **READ THE "GOTCHAS" SECTION AT THE END.** A few columns do *not* mean what their name suggests, and getting them wrong produces blank or wrong data on screen. These quirks are the single most important thing in this document.

### The shared housekeeping columns (apply to almost every table)

| Column | Plain meaning |
|---|---|
| `created_by` | The user ID (a number, as text) of who created the row. Technical note: this is the real owner/author in this database — see Gotchas. |
| `created_date` | When the row was created. |
| `updated_by` / `updated_date` | Who last changed it and when. |
| `deleted_by` / `deleted_date` | Who "deleted" it and when. A non-empty `deleted_date` means the row is logically deleted but still physically present (soft delete). |

### A note on the `*_audit` tables

Roughly 20 of the 71 tables end in `_audit` (e.g. `lead_master_audit`, `meeting_master_audit`). These are **history/change-log copies** of their main table — every time a row in the main table changed, the old or new version was snapshotted here. The vendor added these post-launch. They are mostly for traceability, not day-to-day app screens, so they are summarised together in the **Audit & Logs** section rather than column-by-column. The biggest by far is `meeting_master_audit` (~85,000 rows — over three-quarters of the whole database).

---

## 1. Core — Leads

The heart of the CRM. A **lead** is a person at a prospective client who Amplior's sales team is pursuing.

### `lead_master` — the master record for each lead (≈605 rows)
*Purpose:* one row per lead = the contact person, their company, and basic details.

| Key column | Plain meaning |
|---|---|
| `lead_id` | Unique number for the lead (the internal ID). |
| `lead_number` | The human-friendly lead code shown in the app, e.g. `ALT1608`. |
| `lead_name` | The contact person's name. |
| `email`, `mobile_no`, `alt_mobile_no` | Contact details. |
| `designation`, `title`, `role_and_resp` | The contact's job title / role at their company. |
| `linkedin_url` | Their LinkedIn profile. |
| `area_of_interest`, `description`, `value` | Notes on what the lead is interested in and the potential deal value. |
| `stage` | **MISLEADING — usually empty.** The real current stage lives in `lead_report`, not here. See Gotchas. |
| `is_closed` | Whether the lead is closed/finished. |
| `created_by` | **The salesperson who owns this lead** (their user ID as text). This is the true owner field — see Gotchas. |
| `client_assoc_id` | **The client/account this lead belongs to** (e.g. AP Securitas, HungerBox). Links to `client_association`. This is how "company" actually works here — see Gotchas. |
| `agent_id` | *Almost always empty* — not a reliable owner field. See Gotchas. |
| `company_id` | *Almost always empty* — links to `company_master` but rarely populated. See Gotchas. |
| `project_id` | The project/campaign the lead was sourced under. Links to `project`. |
| `source_id` | Where the lead came from (Email, LinkedIn, Reference, Wishlist…). Links to `source_master`. |
| `address_id` | The lead's location/address. Links to `address_master`. |
| `contact_id` | **(New — added during rebuild)** Links to `contact_master` — the contact record for this lead. Set when the agent picks an existing contact from the search dropdown on the Lead form. |
| `lead_designation_id`, `location_id` | Links to a designation lookup and a map location. |

*Links to:* `client_association` (the client/account), `project`, `source_master`, `address_master`, `lead_designation`, `location`, `contact_master` (new), and (in name only) `company_master`.

### `lead_report` — the working "report card" for each lead (≈594 rows)
*Purpose:* the live sales status of a lead — its **real current stage**, approval state, and the salesperson handling it. There is roughly one report per lead.

| Key column | Plain meaning |
|---|---|
| `report_id` | Unique number for the report. |
| `lead_id` | Which lead this report is for. Links to `lead_master`. |
| `stage_id` | **The lead's real current stage** (Warm, Hot Prospect, Meeting Scheduled, Meeting Successful…). Links to `stage_master`. **This is the stage the app should show, not `lead_master.stage`.** |
| `user_id` | The salesperson currently responsible for the report. Links to `user_master`. |
| `report_status`, `report_approval`, `active_status` | Whether the report is active / awaiting approval, etc. |
| `lead_request` | Whether this is a pending request. |
| `sales_intelligence` | Free-text sales notes/intel. |

*Links to:* `lead_master`, `stage_master`, `user_master`. Many other tables hang off `report_id` (meetings, pre-sales answers, new-sales questions).

### `lead_activity` — the activity/comment timeline (≈2,670 rows)
*Purpose:* the running log of notes and actions on a lead — what powers the "Activity" timeline in the app.

| Key column | Plain meaning |
|---|---|
| `activity_id` | Unique number for the activity entry. |
| `lead_id` | Which lead it belongs to. Links to `lead_master`. |
| `lead_comments` | The note/comment text. |
| `is_generated` | Whether the entry was auto-created by the system (true) or typed by a person (false). |

*Links to:* `lead_master`.

### `lead_status_history` — detailed milestone tracker per lead (≈477 rows)
*Purpose:* a very wide table (53 columns) recording **each meeting milestone as its own yes/no flag plus a date and who set it** — e.g. "meeting scheduled", "meeting confirmed", "meeting successful", "meeting cancelled by lead", "hot prospect", "warm", "closed". One row per lead, accumulating its full meeting journey.

| Key column pattern | Plain meaning |
|---|---|
| `lead_id` | Which lead. Links to `lead_master`. |
| `meeting_scheduled` / `meeting_scheduled_date` / `meeting_scheduled_updated_by` | A flag + when + who, repeated for every milestone (confirmed, successful, follow-up, cancelled by lead / by sales team / by Altleads, postponed, dropped, warm, hot_prospect, closed). |

*Links to:* `lead_master`. *Note:* this overlaps with `stage_master` stages; it's the granular booking history behind the single "current stage" shown by `lead_report`.

### `lead_designation` — designation labels used on leads (≈305 rows)
*Purpose:* a list of job-designation names that can be attached to a lead. *Links to:* referenced by `lead_master.lead_designation_id`.

---

## 2. Meetings

Meetings are the main outcome of working a lead. Amplior books meetings between a lead and a client's sales team.

### `meeting_master` — the master record for each meeting (≈610 rows)
*Purpose:* one row per meeting — when, where, how, its status, and the outcome/feedback.

| Key column | Plain meaning |
|---|---|
| `meeting_id` | Unique number for the meeting. |
| `meeting_name` | Title/label of the meeting. |
| `meeting_date`, `meeting_time`, `duration` | When it is and how long. |
| `meeting_mode` | In-person / online / call. |
| `meeting_url`, `call_recording`, `share_point_url` | Video link, recording, and document links. |
| `meeting_status`, `status`, `meeting_confirm` | The booking's state (scheduled / confirmed / done / cancelled). |
| `follow_up_date` | When to follow up next. |
| `agent_feedback`, `reason`, `rejected_reason` | Notes on how it went / why it was rejected. |
| `is_requested`, `user_assign`, `meeting_alert` | Whether it was requested, assigned to a user, and whether an alert/reminder is on. |

*Links to:* connected to a lead **indirectly** via `meeting_schedule` → `lead_report` → `lead_master` (there is no direct lead_id on the meeting — see Gotchas).

### `meeting_schedule` — joins a meeting to a lead's report (≈593 rows)
*Purpose:* the bridge that ties a meeting to the lead it's for, plus tentative dates.

| Key column | Plain meaning |
|---|---|
| `meeting_sched_id` | Unique number. |
| `meeting_id` | Which meeting. Links to `meeting_master`. |
| `report_id` | Which lead report (and therefore which lead). Links to `lead_report`. |
| `tentative` | A proposed/tentative date. |
| `reason` | Note about the scheduling. |

*Links to:* `meeting_master`, `lead_report`. **This is the path from a meeting to its lead.**

### `meeting_participant` — who attended a meeting (≈945 rows)
*Purpose:* the list of participants for each meeting. `participant` holds the person; `meeting_id` links to the meeting.

### `meeting_reschedule` — reschedule history (≈81 rows)
*Purpose:* records each time a meeting was moved — new date/time, old and new reasons (`resone`, `new_resone`). Links to `meeting_master`.

### `meeting_question` — per-meeting Q&A / pricing items (≈0 rows currently)
*Purpose:* questions captured during a meeting, with optional in/out price figures. Links to `meeting_master`. Empty in current data.

---

## 3. Wishlist

A **wishlist** entry is a prospect a field agent has spotted (often via the mobile app, with a map location) that is not yet a formal lead — a "company I'd like to pursue".

### `wishlist` — wishlist prospects (≈54 rows)
*Purpose:* one row per wished-for prospect: the company, contact, address, map pin, and who it's assigned to.

| Key column | Plain meaning |
|---|---|
| `wishlist_id` | Unique number. |
| `company_name`, `lead_name`, `designation` | The target company and contact. |
| `address_line1/2`, `pincode`, `map_address`, `latitude`/`longitude` | Where it is, including GPS for the map. |
| `status` | Where it stands (e.g. pending / converted). |
| `lead_number` | If it became a lead, the lead code. |
| `assign_agent`, `assign_tl` | The agent and team lead it's assigned to. Both link to `user_master`. |
| `company_id`, `city_id`, `address_id` | Links to company, city, and address records. |

*Links to:* `user_master` (agent + team lead), `company_master`, `city_master`, `address_master`.

### `wishlist_assign` — wishlist assignment records (≈0 rows)
*Purpose:* a record of assigning a wishlist address to an agent/team lead. Links to `user_master` (agent + TL) and `address_master`. Empty in current data.

---

## 4. Companies, Clients & Contacts

This area is **the most confusing part of the database** — please read the Gotchas. In short: the "client/account" a lead belongs to lives in **`client_association`** (only 7 rows, the companies Amplior runs sales for), while **`company_master`** is a separate, largely-unused company directory.

### `client_association` — the clients/accounts Amplior sells for (7 rows)
*Purpose:* the short list of **client companies whose sales Amplior runs** (currently: AP Securitas, HungerBox, MediCare Plus, DTSS, Firmity, Urest, Demo). **Every lead belongs to one of these.** This is what "company/account" effectively means in the app.

| Key column | Plain meaning |
|---|---|
| `client_assoc_id` | Unique number for the client/account. |
| `client_name` | The client company's display name (e.g. "AP Securitas"). |
| `full_name`, `email`, `mobile_number` | The main contact at the client. |
| `cin_number`, `website`, `location` | Company registration number, website, location. |
| `enabled` | Whether the client is active. |
| `industry_id`, `domain_id`, `country_code_id`, `address_id` | Links to industry, domain, country code, and address. |

*Links to:* `industry_master`, `domain_master`, `countrycode_master`, `address_master`. *Referenced by:* `lead_master.client_assoc_id`, `project.client_assoc_id`, `client_assoc_user`.

### `client_assoc_user` — which users belong to which client (≈109 rows)
*Purpose:* maps users to clients (e.g. which salespeople work on AP Securitas). Links `user_master` ↔ `client_association`.

### `company_master` — a broad company directory (≈525 rows)
*Purpose:* a directory of companies with size, industry, sector, turnover, logo, etc. **Largely NOT used as the lead's company** — most leads don't fill `company_id`. Treat this as reference data and the Companies module directory. The **new Companies module** uses this table directly. *Links to:* `city_master`, `industry_master`, `sub_industry_master`, `company_sector`, `turnover_master`.

**Columns added during rebuild:**
- `domain_clean` — the normalised website domain used for company dedup (e.g. `"tata.com"` from `"https://www.tata.com/careers"`). Set for all 525 companies.
- `is_demo` — whether this is a test/demo record (excluded from dedup checks).

### `company_sector` — sector labels for companies (5 rows)
*Purpose:* a small lookup of business sectors. Referenced by `company_master.sector_id`.

### `address_master` — addresses for leads, companies, wishlist (≈570 rows)
*Purpose:* shared address book — street lines, pincode, city, and GPS coordinates. Used by leads, clients, companies, and wishlist entries. The `is_lead` / `is_wishlist` flags note what kind of thing the address is for. *Links to:* `city_master`, `company_master`.

---

## 4b. New Tables — Companies, Contacts & Per-Project Status (added during rebuild)

These tables were added as part of the CR Layer 2 / Companies + Contacts feature build. DDL in `new-code/migration/companies-contacts.sql` and `new-code/migration/feature-status-schema.sql`.

### `contact_master` — unified contact directory (≈607 rows)
*Purpose:* one row per contact person, migrated from the old `lead_master` records and de-duplicated. Powers the Contacts module.

| Key column | Plain meaning |
|---|---|
| `contact_id` | Unique number for the contact. |
| `full_name` | Their name. |
| `email`, `mobile`, `phone` | Contact details (email is the primary dedup key). |
| `linkedin_url`, `linkedin_clean` | Their LinkedIn profile. `linkedin_clean` is the normalised URL used for dedup. |
| `designation`, `title` | Their job title. |
| `company_id` | Which company they work at. Links to `company_master`. 417/607 are now set (via email-domain sync). |
| `city_id`, `state_id` | Where they are based. |
| `is_demo` | Whether this is a test/demo record (excluded from dedup checks and real reports). |

*Links to:* `company_master`, `city_master`, `state_master`. *Referenced by:* `lead_master.contact_id`, `contact_project_status`.

### `interaction` — call/contact activity log (new)
*Purpose:* the activity log for the Contacts module — every call, note, or disposition logged against a contact. Powers the call-disposition panel in Contact detail and the per-contact activity timeline.

| Key column | Plain meaning |
|---|---|
| `interaction_id` | Unique number. |
| `contact_id` | Which contact. Links to `contact_master`. |
| `project_id` | Which project context this interaction belongs to. Links to `project`. |
| `disposition` | The call outcome (e.g. "Connected", "No Answer", "Call Back") — chosen from `dropdown_option`. |
| `notes` | Free-text notes about the call or contact. |
| `created_by`, `created_date` | Who logged it and when. |

*Links to:* `contact_master`, `project`. RLS enabled.

### `contact_project_status` — per-project contact status (new)
*Purpose:* one row per (contact × project) combination, recording the contact's current status, description, and comments for that specific project. Enforces the rule that a contact can have a different status on each project they are involved in.

| Key column | Plain meaning |
|---|---|
| `contact_id` | Which contact. Links to `contact_master`. |
| `project_id` | Which project. Links to `project`. |
| `status` | Current contact status for this project (value from `dropdown_option` where `type = 'contact_status'`). |
| `description` | Per-project description/notes for this contact. |
| `comments` | Per-project comments. |
| `updated_by`, `updated_date` | Last changed by whom and when. |

*Unique constraint:* one row per (contact_id, project_id). RLS enabled.

### `company_project_status` — per-project account/company status (new)
*Purpose:* one row per (company × project) combination, recording account-level information specific to that project.

| Key column | Plain meaning |
|---|---|
| `company_id` | Which company. Links to `company_master`. |
| `project_id` | Which project. Links to `project`. |
| `account_status` | Current account status (value from `dropdown_option` where `type = 'account_status'`). |
| `is_feasible` | Feasibility for this project (value from `dropdown_option` where `type = 'feasibility'`). |
| `decision_power` | Who makes decisions at this account for this project — Centralised / Regional-site-wise / Hybrid (value from `dropdown_option` where `type = 'decision_power'`). |
| `description` | Per-project description. |
| `comments` | Per-project comments. |
| `updated_by`, `updated_date` | Last changed. |

*Unique constraint:* one row per (company_id, project_id). RLS enabled.

### `dropdown_option` — admin-editable pick-lists (new)
*Purpose:* stores all the options for every dropdown in the app. Admins can add, edit, or reorder options from the Admin panel without a code change.

| Key column | Plain meaning |
|---|---|
| `option_id` | Unique number. |
| `type` | Which dropdown this option belongs to. Values: `contact_status`, `call_disposition`, `account_status`, `decision_power`, `feasibility` (and any others added later). |
| `label` | The display text shown in the dropdown. |
| `sort_order` | Display order. |
| `is_active` | Whether this option is currently available to users. |

**Seeded starter values:**
- `contact_status`: Active, Interested, Not Interested, Follow Up, Do Not Call, Converted
- `call_disposition`: Connected, Not Connected, No Answer, Busy, Wrong Number, Call Back, Voicemail, Disconnected
- `account_status`: Active, Warm, Hot, Cold, Not Interested, Closed Won, Closed Lost
- `decision_power`: Centralised, Regional-site-wise, Hybrid
- `feasibility`: High, Medium, Low

### `user_view_pref` — per-user column layout preferences (new)
*Purpose:* stores each user's saved column layout (which columns to show, in what order) for each list view in the app. Allows users to customise their view and save it without affecting other users.

| Key column | Plain meaning |
|---|---|
| `pref_id` | Unique number. |
| `user_id` | Which user. Links to `user_master`. |
| `view_name` | Which list view (e.g. `contacts`, `leads`, `meetings`). |
| `columns` | JSON array of column keys in the user's preferred order. |
| `updated_date` | When last saved. |

*Note:* Resetting to default keeps the old saved row intact — the UI simply stops applying it. Users can restore their custom view at any time.

---

## 5. People & Access (Users, Roles, Permissions)

### `user_master` — everyone who uses the system (≈111 rows)
*Purpose:* one row per person — staff (salespeople, team leads, admins, QC) and possibly client-side users.

| Key column | Plain meaning |
|---|---|
| `user_id` | Unique number for the person. This is the ID referenced by `created_by` across the database. |
| `full_name`, `f_name`, `l_name` | Their name. |
| `email`, `mobile_number` | Contact details. |
| `employee_id` | Internal staff ID. |
| `enabled` | Whether the account is active. |
| `amplior_associate` | Whether they are Amplior staff (vs an external/client user). |
| `password` | **Legacy plaintext password column — NOT used for the new login.** New logins go through Supabase Auth (see `profiles`). This column should be ignored/retired. |
| `designation_id`, `city_id`, `state_id`, `country_code_id` | Links to job designation and location lookups. |

*Links to:* `designation_master`, `city_master`, `state_master`, `countrycode_master`. *Referenced widely* by lead/meeting/report ownership fields.

### `profiles` — the bridge between login accounts and `user_master` (1 row so far)
*Purpose:* connects a **Supabase Auth login** (`auth.users`) to the matching person in `user_master`, and stores their role. This is the new authentication layer.

| Key column | Plain meaning |
|---|---|
| `id` | The Supabase Auth login ID (technical: UUID). Links to `auth.users`. |
| `user_id` | The matching person in `user_master`. |
| `email`, `full_name`, `role` | Convenience copies for quick display; `role` is one of ADMIN / TEAM_LEAD / SALES_HEAD / SALES_PERSON / AGENT / QC. |

*Links to:* `auth.users` (Supabase login), `user_master`. *Note:* only 1 row today because only the test admin has logged in; one row is added per user as they sign in.

### `role_master` — the list of roles (6 rows)
*Purpose:* the six roles, with a priority order. Values: **ADMIN, TEAM_LEAD, AGENT, SALES_HEAD, SALES_PERSON, QC**. `is_web` flags whether the role is for the web app. *Referenced by:* `user_role`, `rbac_master`.

### `user_role` — which roles each user has (≈146 rows)
*Purpose:* maps people to roles (a user can have more than one). Links `user_master` ↔ `role_master`.

### `rbac_master` — what each role is allowed to do (≈93 rows)
*Purpose:* the permission grid — for each role + feature ("use case"), whether they can read / write / edit / delete, and whether it applies on web. *Links to:* `role_master`, and `use_cases` (via `use_case_id`).

### `use_cases` — the list of features/permissions (≈22 rows)
*Purpose:* the named features that permissions are granted on (e.g. "Leads", "Meetings"). `is_web` flags web features. *Referenced by:* `rbac_master`.

### `user_ghost` — "ghost" user flags (≈67 rows)
*Purpose:* marks users as ghost/hidden (a `ghost` true/false flag per user). Links to `user_master`.

---

## 6. Projects

### `project` — sales projects/campaigns (≈12 rows)
*Purpose:* a project (campaign) run for a client — leads are sourced under a project. `project_name`, `enabled`, and `client_assoc_id` (which client it's for). *Links to:* `client_association`. *Referenced by:* `lead_master.project_id`.

### `project_user` — who works on which project (≈148 rows)
*Purpose:* maps users to projects with a role on that project (`role_name`). Links `project` ↔ `user_master`.

---

## 7. Reference / Lookups

Small "pick-list" tables that fill dropdowns and standardise values. Most just have an ID + a name.

| Table | Rows | What it lists | Notable links |
|---|---|---|---|
| `stage_master` | 15 | Lead **stages**: Warm, Hot Prospect, New Meeting, Meeting Scheduled/Confirmed/Successful/Follow-Up/Cancelled, etc. | Used by `lead_report.stage_id` |
| `source_master` | 8 | Lead **sources**: Internal-Email, Internal-WhatsApp, Internal-LinkedIn, Wishlist, Self, Reference, On-Site team, Datalist | Used by `lead_master.source_id` |
| `status_master` | 0 | Generic status list (currently empty) | — |
| `industry_master` | 20 | Industry names (+ short names) | Used by clients & companies |
| `sub_industry_master` | 128 | Sub-industries under each industry | Links to `industry_master` |
| `company_sector` | 5 | Business sectors | Used by `company_master` |
| `turnover_master` | 8 | Turnover bands: Less than 1, 1-100, 100-500, 500-1000, 1000-5000, 5000+, Not Known, NA | Used by `company_master` |
| `domain_master` | 8 | Service domains: Security Management, F&B & Events, Integrated Facility Mgmt, HR Services, Travel & Hospitality, IT services, BFSI, FM SaaS | Used by clients & pre-sales questions |
| `designation_master` | 19 | Job designations | Used by `user_master` |
| `city_master` | 651 | Cities | Links to `state_master` |
| `state_master` | 36 | States | Links to `countrycode_master` |
| `countrycode_master` | 1 | Country dialing/currency info (only India currently) | Used by users, states, clients |
| `location` | 0 | GPS check-in locations per user (mobile) | Links to `user_master`; empty |

---

## 8. Feedback & Sales Questions

These capture structured Q&A used during pre-sales research and meetings, attached to a lead's report.

| Table | Rows | Purpose | Key links |
|---|---|---|---|
| `pre_sales_question` | 45 | The bank of pre-sales research questions, grouped by service domain | Links to `domain_master` |
| `pre_sales_answer` | ≈2,704 | Answers to those questions, captured per lead report | Links to `pre_sales_question`, `lead_report` (via `report_id`) |
| `new_sales_question` | 3 | Newer sales questions (with optional in/out price) tied to a report | Links to `lead_report` |
| `feedback_question_master` | 7 | The bank of post-meeting feedback questions | — |
| `feedback_answer` | ≈1,435 | Feedback answers captured per meeting | Links to `feedback_question_master`, `meeting_master` |

---

## 9. Notifications & Messaging

### `in_app_notification` — bell-icon notifications (≈1,359 rows)
*Purpose:* the in-app alerts shown to users (e.g. "a meeting was assigned to you").

| Key column | Plain meaning |
|---|---|
| `notification_id` | Unique number. |
| `user_id` | Who the notification is for. Links to `user_master`. |
| `notif_descr` | The message text. |
| `is_seen` | Whether the user has seen it. |
| `route` | Where tapping it takes you in the app. |
| `lead_id`, `report_id`, `meeting_id`, `lead_number`, `status` | What the notification is about. |

*Links to:* `user_master`, `lead_master`, `lead_report`, `meeting_master`.

### `message_master` & `message_audit` — SMS/OTP messaging (8 / ≈173 rows)
*Purpose:* `message_master` holds message templates/types; `message_audit` logs each message actually sent — phone number, OTP, whether it was delivered/verified/expired. This is the SMS/OTP machinery (legacy; the new system uses Supabase Auth). *Links to:* `message_audit` → `message_master`.

---

## 10. Audit & Logs

History and diagnostic tables. **For day-to-day app screens you can ignore these**; they exist for traceability and debugging.

- **`*_audit` tables (≈20 of them):** change-history snapshots of their main table. Each has the main table's columns plus extra audit stamps. Examples: `lead_master_audit`, `lead_report_audit` (≈2,305), `meeting_master_audit` (**≈85,478 — the single largest table**), `meeting_schedule_audit`, `user_master_audit`, `client_association_audit`, `company_master_audit`, `address_master_audit`, `rbac_master_audit`, `user_role_audit`, `project_user_audit`, and the various `*_question_audit` / `*_answer_audit` tables. Most are small or empty; `meeting_master_audit` is the heavyweight.
- **`exception_logs` (≈99 rows):** application error log — date, short message, long message. For debugging only.
- **`user_searches` (0 rows):** would track how often a user runs a search; currently empty.

---

## Gotchas (READ THIS — the database does not always mean what it says)

These are confirmed against the live data. Getting any of these wrong leads to blank or wrong information on screen.

1. **Lead OWNER = `lead_master.created_by`, NOT `agent_id`.**
   The salesperson who owns a lead is in `created_by` (stored as text but it's a `user_master.user_id`). There are **18 distinct real salespeople** in `created_by`. The `agent_id` column is empty for **476 of 605 leads** and has only **2 distinct values** — using it makes it look like there are only 2 salespeople. *Permissions/RLS should match on `created_by`.*

2. **Lead's COMPANY/ACCOUNT = `lead_master.client_assoc_id` → `client_association`, NOT `company_id` → `company_master`.**
   `company_id` is empty for **477 of 605 leads** (so the company shows blank if you use it). The real account is `client_assoc_id`, which is filled for **all 605 leads** and points to one of just **7 client companies** (AP Securitas = 252 leads, HungerBox = 198, MediCare Plus = 53, DTSS = 52, Firmity = 23, Urest = 14, Demo = 13). Think of `client_association` as "the clients Amplior runs sales for," and `company_master` as a mostly-unused separate directory.

3. **A lead's REAL STAGE = `lead_report.stage_id` → `stage_master`, NOT `lead_master.stage`.**
   `lead_master.stage` is empty for **474 of 605 leads**. The live stage lives on the lead's report (`lead_report`), where **594 reports have a stage set**. Always read the stage via `lead_report`.

4. **A meeting links to its lead INDIRECTLY.**
   `meeting_master` has no `lead_id`. The path is: `meeting_master` → `meeting_schedule` (`meeting_id`) → `lead_report` (`report_id`) → `lead_master` (`lead_id`). Don't expect a direct meeting-to-lead column.

5. **`created_by` / `updated_by` are user IDs stored as TEXT, not names.**
   To show a person's name, look the number up in `user_master.user_id`. (They're text columns for legacy reasons, but the value is the numeric user ID.)

6. **`user_master.password` is dead AND hidden.** It held plaintext passwords in the old system. The new system uses Supabase Auth (`profiles` → `auth.users`). The column has been **hidden from the API** via a Postgres column-level grant (REVOKE SELECT/INSERT/UPDATE from `anon` and `authenticated`). The data exists in the DB but cannot be read via any API call. Never use this column for login or display.

7. **`meeting_master_audit` is huge (~85k rows, >75% of the database).** It's just change history. Never load it into a normal screen; query it only for audit/history needs.

8. **Some count columns are "almost empty" lookups.** `status_master`, `location`, `user_searches`, `meeting_question`, `wishlist_assign`, and several `*_audit` tables are empty (0 rows) in the migrated data — expected, not a migration error.

9. **The "Sales Person" filter has no dedicated field.** In this schema the agent *is* the salesperson; there is no separate salesperson column. Filter by the lead owner (`created_by`) instead.

10. **Soft deletes.** A row with a non-empty `deleted_date` is logically deleted but still present. App queries should normally exclude rows where `deleted_date is not null`.
