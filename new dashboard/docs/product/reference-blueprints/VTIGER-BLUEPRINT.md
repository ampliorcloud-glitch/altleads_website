# Vtiger CRM — Architecture Teardown & Blueprint

> Source read: `E:\reference code for crm\vtigercrm` (PHP MVC, vtiger CRM Open Source).
> Written for an AltLeads team member who has never opened Vtiger source code.
> Purpose: extract patterns, data models, and access-control designs worth reverse-engineering into our TS/React/Supabase stack.
> Do NOT copy code — translate patterns only (different stack, vtiger CRM Public License).

---

## 1. Stack & Code Organization

### Tech Stack
- **Backend**: PHP (no modern framework — a home-grown MVC called "vtlib"). Entry point is `index.php`; dispatch happens via `?module=Leads&view=ListView&action=Save` URL conventions.
- **Database**: MySQL; all tables are prefixed `vtiger_`. Raw SQL everywhere via `PearDatabase` (a thin PDO wrapper).
- **Frontend**: Server-rendered HTML + jQuery + inline JS. Layouts live in `layouts/`. No SPA.
- **Auth**: Session-based PHP sessions. `vtiger_users` table; passwords hashed.
- **Cron**: `vtigercron.php` / `WorkFlowScheduler.php` for scheduled workflows.

### Module Layout
Every feature is a self-contained directory under `modules/<ModuleName>/`:
```
modules/Leads/
  Leads.php            — Legacy CRMEntity bean (table mapping, list/search field defs)
  models/
    Module.php         — Vtiger_Module_Model subclass (module-level operations)
    Record.php         — Vtiger_Record_Model subclass (single record CRUD + business logic)
    ListView.php       — List query + column config
    DetailView.php     — Detail page data
  views/               — PHP templates (ListView, DetailView, EditView, etc.)
  actions/             — Form submit handlers (Save, Delete, MassEdit, etc.)
  handlers/            — Event handlers (e.g. post-save hooks)
```
`modules/Settings/<Feature>/` follows the same pattern for admin settings (Roles, Profiles, SharingAccess, LayoutEditor, etc.).

### Where Fields / Blocks / Picklists Live

**`vtiger_field`** (central field registry):
- `tabid` — which module this field belongs to (FK → `vtiger_tab.tabid`)
- `fieldid` — PK (auto-increment)
- `columnname` — actual DB column name
- `tablename` — which vtiger_* table stores this column
- `fieldname` — logical name used in code
- `fieldlabel` — display label
- `uitype` — UI widget type (text=1, picklist=15, relate=10, date=5, etc.)
- `block` — FK → `vtiger_blocks.blockid` (groups fields into named sections)
- `presence` / `displaytype` — controls visibility
- `quickcreate` / `masseditable` — behavioral flags
- `typeofdata` — validation string (e.g. `"V~O"` = Varchar Optional)

**`vtiger_blocks`**: Named collapsible sections on a detail/edit view. Each field belongs to one block. Blocks belong to one module (via `tabid`). Block ordering is stored in `sequence`.

**`vtiger_picklist`** + **`vtiger_picklistvalues`**: Picklist options are stored globally. `vtiger_role2picklist` maps which picklist values a role is allowed to see/use — picklists are role-scoped, not just globally shared.

**`vtiger_tab`**: The module registry. One row per module; `tabid` is the universal module identifier used across nearly every permission/sharing/field table.

### vtiger_* Schema Convention
- Every CRM record has a row in **`vtiger_crmentity`** (the "entity table"): `crmid` (PK), `setype` (module name), `smownerid` (assigned user), `smcreatorid`, `createdtime`, `modifiedtime`, `deleted`.
- Module-specific data lives in **additional tables** all sharing the same PK as `crmid`. Example for Leads:
  - `vtiger_leaddetails` (core fields) — PK `leadid` = `crmid`
  - `vtiger_leadsubdetails` (website, referral, etc.)
  - `vtiger_leadaddress` (address block)
  - `vtiger_leadscf` (custom fields — auto-generated extension table)
- Custom fields always go into the `*scf` (custom field) table for that module.
- Every module's legacy bean (`Leads.php`, `Accounts.php`) declares `$tab_name` and `$tab_name_index` arrays mapping table names to their join keys — this is how multi-table reads/writes are coordinated.

---

## 2. Core CRM Data Model

### Lead (`vtiger_leaddetails` + `vtiger_leadsubdetails` + `vtiger_leadaddress` + `vtiger_leadscf`)
Key fields: `firstname`, `lastname`, `company`, `email`, `phone`, `leadsource`, `leadstatus`, `industry`, `designation`, `annualrevenue`, `website`, `rating`, `secondaryemail`.
- `converted` (int 0/1) — set to 1 when the Lead is converted; the original record is preserved (not deleted) but treated as read-only.
- `vtiger_convertleadmapping` — stores field-to-field mapping for how lead fields copy to Contact/Account/Potential on conversion.
- Leads are assigned to a user via `vtiger_crmentity.smownerid`.

### Contact (`vtiger_contactdetails` + `vtiger_contactsubdetails` + `vtiger_contactaddress` + `vtiger_contactscf`)
Key fields: `firstname`, `lastname`, `email`, `phone`, `mobile`, `department`, `title`, `accountid` (FK → `vtiger_account`), `reportsto` (self-referential contact hierarchy for org charts).
- Portal access: `vtiger_portalinfo` and `vtiger_customerdetails` extend contacts for a customer self-service portal.
- Many-to-many with Potentials via `vtiger_contpotentialrel`.

### Account (`vtiger_account` + `vtiger_accountbillads` + `vtiger_accountshipads` + `vtiger_accountscf`)
Key fields: `accountname`, `phone`, `website`, `industry`, `annualrevenue`, `employees`, `accounttype`, `rating`, `parentid` (self-referential — account hierarchies / parent companies).
- Separate billing and shipping address tables.
- Contacts, Potentials, Activities, Emails, Documents, and Cases (HelpDesk tickets) all relate back to an Account.

### Potential / Opportunity (`vtiger_potential` + `vtiger_potentialscf`)
Key fields: `potentialname`, `amount`, `closingdate`, `sales_stage` (picklist), `probability` (auto-calculated from stage picklist value), `forecastcategory`, `related_to` (Account name), `contact_id`.
- `vtiger_potstagehistory` records every stage change with timestamp and amount — a built-in stage audit trail.
- Many-to-many with Contacts via `vtiger_contpotentialrel`.
- Can link to Quotes / SalesOrders (inventory modules).
- `vtiger_potentialscf` is the custom-fields extension table.

### Calendar / Activity (`vtiger_activity`)
Vtiger uses a single `vtiger_activity` table for both Events (meetings/calls) and Tasks (to-dos), distinguished by `activitytype`:
- `activitytype` values: `'Call'`, `'Meeting'`, `'Task'`, `'Emails'` (email is also stored as an activity type).
- Key fields: `subject`, `activitytype`, `date_start`, `time_start`, `due_date`, `time_end`, `status`, `priority`, `visibility` (Public/Private), `description`, `duration_hours`, `duration_minutes`.
- `vtiger_recurringevents` handles recurring appointments.
- `vtiger_seactivityrel` — many-to-many between `vtiger_activity.activityid` and any CRM entity (`crmid`). This is how a meeting appears on both a Contact and an Account simultaneously.
- `vtiger_cntactivityrel` — direct Contact-to-Activity relationship.
- `vtiger_salesmanactivityrel` — User-to-Activity (invited attendees).
- `vtiger_activitytype` — configurable activity type picklist.

### Lead Conversion Flow
1. User opens `?module=Leads&view=ConvertLead&record=<leadid>`.
2. System prefills Contact, Account, and Potential create forms using `vtiger_convertleadmapping`.
3. Admin can configure which lead field maps to which Contact/Account/Potential field.
4. On save, three records are created (Contact, Account, Potential); `vtiger_leaddetails.converted` is set to 1.
5. The original lead record is preserved but marked converted — it is not deleted.

---

## 3. Multi-Tenancy / Access Control

Vtiger's access control is its most sophisticated engineering. It has **three independent but composing layers**: Role Hierarchy, Profiles, and Sharing Rules. Understanding all three together is essential.

### Single-Tenant Architecture
Vtiger is single-tenant: one database, one organization. There is no `org_id` column anywhere. All data isolation is within one company's users. This is fundamentally different from AltLeads where `project` acts as a tenant boundary.

### Layer 1 — Role Hierarchy

**Tables**: `vtiger_role`, `vtiger_user2role`

```
vtiger_role:
  roleid       VARCHAR(255) PK  — e.g. "H1", "H2", "H5"
  rolename     VARCHAR(200)
  parentrole   VARCHAR(255)     — CRITICAL: stores full ancestry path as "H1::H2::H5"
  depth        INT              — 0 = root (CEO/Admin), 1 = next level down, etc.
```

The `parentrole` column is a **materialized path** (not an adjacency list). Every role stores its full ancestor chain separated by `::`. Example: a Sales Rep role at depth=2 might have `parentrole = "H1::H3::H7"`, meaning ancestry is root H1 → H3 → current role H7.

This design means:
- Finding all descendants of role H3 = `WHERE parentrole LIKE 'H1::H3::%'` — a single SQL LIKE query, no recursion needed.
- Finding a role's parent = split `parentrole` on `::` and take the second-to-last element (implemented in `Settings_Roles_Record_Model::getParent()`).
- Moving a role subtree = string-replace the old path prefix with the new prefix across all affected rows (implemented in `moveTo()`).

`vtiger_user2role`: one row per user mapping `userid → roleid`. A user has exactly one role.

**What role hierarchy controls**: By default, a manager (higher in the tree) can see and edit records owned by all users in their subtree. This is "see your subordinates' records" behavior. The `allowassignedrecordsto` field on the role controls whether the role-holder can also see peers' records.

**Groups** (`vtiger_groups`): A named collection of users and/or roles. Records can be assigned to a group instead of an individual user. Group membership tables:
- `vtiger_groups2users` — direct user members
- `vtiger_group2role` — include all users in a role
- `vtiger_group2rs` — include all users in a role and its subordinates ("rs" = role and subordinates)
- `vtiger_group2grouprel` — nested groups (groups can contain groups)

### Layer 2 — Profiles (Permission Templates)

**Tables**: `vtiger_profile`, `vtiger_role2profile`, `vtiger_profile2tab`, `vtiger_profile2standardpermissions`, `vtiger_profile2field`, `vtiger_profile2globalpermissions`, `vtiger_profile2utility`

A **Profile** is a named permission template that defines:
1. **Module Access** (`vtiger_profile2tab`): which modules the profile holder can access at all.
2. **Standard Action Permissions** (`vtiger_profile2standardpermissions`): per module, per operation (Create, Edit, Delete, View, Import, Export) — each is a 0/1 flag.
3. **Field-Level Permissions** (`vtiger_profile2field`): per field, `visible` (0/1) and `readonly` (0/1). A field can be hidden entirely or shown as read-only.
4. **Global Permissions** (`vtiger_profile2globalpermissions`): "View All" and "Edit All" — if enabled, the user bypasses sharing rules and sees every record in the organization.
5. **Utility Permissions** (`vtiger_profile2utility`): access to utilities like Import, Export, Reports, Dashboards.

`vtiger_role2profile`: A role can have **multiple profiles** (M:N). A user's effective permissions are the union of all profiles attached to their role. One profile per role can be flagged `directly_related_to_role = 1` (the primary profile for that role).

**Key insight**: Profiles answer "what CAN you do" (which modules, which fields, which operations). Role hierarchy answers "whose records can you SEE." Sharing rules (below) expand visibility beyond what hierarchy grants.

### Layer 3 — Sharing Rules (Record-Level Visibility)

**Tables**: `vtiger_def_org_share`, `vtiger_datashare_module_rel`, and nine cross-product tables:
`vtiger_datashare_grp2grp`, `vtiger_datashare_grp2role`, `vtiger_datashare_grp2rs`,
`vtiger_datashare_role2group`, `vtiger_datashare_role2role`, `vtiger_datashare_role2rs`,
`vtiger_datashare_rs2grp`, `vtiger_datashare_rs2role`, `vtiger_datashare_rs2rs`.

**Default Org Sharing** (`vtiger_def_org_share`): For each module (`tabid`), an administrator sets the default sharing level:
- `0 = Read Only` — users can see all records but not edit others'
- `1 = Read Create` — can read all and create; cannot edit others'
- `2 = Public` — full read/write access to all records (most open)
- `3 = Private` — can only see records assigned to themselves or their subordinates (most restrictive)

When a module is set to **Private**, the system evaluates **Custom Sharing Rules** to expand visibility case-by-case.

**Custom Sharing Rules** (`vtiger_datashare_module_rel` + cross tables): An admin can create explicit rules like "Group A can read records owned by Role B" or "Role X and its subordinates can read+write records owned by Group Y."

A rule has:
- `shareid` — rule PK
- `tabid` — which module this rule applies to
- `relationtype` — e.g. `"GRP::ROLE"` (source type :: target type), where types are `GRP` (Group), `ROLE` (Role), `RS` (Role and Subordinates)
- `permission` — `0 = Read Only`, `1 = Read Write`

The actual source/target IDs live in the matching cross-product table (e.g. `vtiger_datashare_grp2role` if source is a Group and target is a Role).

After any sharing rule change, `Settings_SharingAccess_Module_Model::recalculateSharingRules()` recomputes denormalized cache tables (`vtiger_tmp_read_group_sharing_per`, `vtiger_tmp_write_group_sharing_per`, etc.) that are joined at query time for performance.

**Role picklist restriction** (`vtiger_role2picklist`): Each role can be restricted to a subset of picklist values. A Sales Manager might see all deal stages; a junior agent might only see early-stage options.

### Access Check Flow (Effective Permission)
At runtime, vtiger evaluates access as:
1. Does the user's profile allow this module? (`vtiger_profile2tab`)
2. Does the user's profile allow this operation? (`vtiger_profile2standardpermissions`)
3. Is the specific record visible to this user?
   - If module is Public → yes.
   - If module is Private: is the user the owner, OR is the owner in the user's role subtree, OR does a custom sharing rule grant access?
4. Does the user's profile allow this specific field? (`vtiger_profile2field` — visible + readonly)
5. Does the user's profile have "View All" global permission? (bypasses step 3 entirely)

Permission calculations are cached in `user_privileges/<userid>.php` flat files (regenerated on role/profile/sharing changes) to avoid database hits on every page load.

### Comparison to AltLeads (project-RLS model)

| Dimension | Vtiger | AltLeads |
|---|---|---|
| Multi-tenancy | Single-tenant (one org per install) | Multi-tenant via `project` (one project = one client) |
| Role hierarchy | Arbitrary tree, materialized-path, unlimited depth | Fixed flat roles: ADMIN/TL/AGENT/SALES_HEAD/SP/QC |
| Data visibility rule | Private/Public + custom sharing rules between groups/roles | Postgres RLS policies keyed on `project_id` + `user_id` + `role` |
| Field-level permissions | Profile → field → visible/readonly per field | Not yet implemented |
| Picklist scoping | Per-role picklist value subsets | Global picklists (no per-role scoping) |
| Group assignment | Records assignable to a named group (team) | Records assigned to individual users only |
| "See subordinates" | Automatic from role tree depth | Not implemented (TL-sees-agent logic would need custom RLS) |
| Permission cache | Flat PHP files regenerated on change | RLS evaluated at query time by Postgres |

---

## 4. Activity / Communication Model

### Calendar (Events + Tasks)
Module: `modules/Calendar`. Both Events (meetings/calls) and Tasks (to-dos) are stored in `vtiger_activity`; distinction is `activitytype`.

- **Events** (`activitytype IN ('Call','Meeting')`): have `date_start`, `time_start`, `due_date`, `time_end`, `duration_hours/minutes`. Support recurring events via `vtiger_recurringevents` (stores repeat pattern: daily/weekly/monthly/yearly + end date).
- **Tasks** (`activitytype = 'Task'`): have `date_start`, `due_date`, `status` (Not Started / In Progress / Completed / Waiting for Input / Deferred), `priority` (High/Medium/Low).
- `vtiger_seactivityrel`: links any activity to any CRM entity (`crmid`). One activity can appear under multiple records simultaneously (e.g. a call logged on both a Contact and an Account).
- Reminders: `vtiger_activity_reminder` + email reminders via cron.
- iCal import/export: `modules/Calendar/iCalExport.php`, `iCalImport.php`.
- Activity type list is user-configurable via `vtiger_calendar_user_activitytypes`.

### ModComments (Internal Notes / Comments)
General "add a comment" functionality on records is handled via the `ModComments` vtlib module (registered in `vtiger_tab`). Its data lands in a `vtiger_modcomments` table. Used on Potentials, Contacts, and Accounts for threaded internal notes — similar to a Chatter/comments timeline.

HelpDesk tickets have their own comment table: `vtiger_ticketcomments`.

### Emails
Module: `modules/Emails`. Emails are stored as activities (`activitytype = 'Emails'`) in `vtiger_activity`, with extended data in `vtiger_emaildetails`:
- `from_email`, `to_email` (and cc/bcc as delimited strings), `subject` stored in `vtiger_activity`.
- Linked to CRM entities via `vtiger_seactivityrel`.
- Attachments: `vtiger_attachments` + `vtiger_seattachmentsrel`.
- **MailManager**: an inbox integration that reads IMAP/POP3 and lets users associate incoming emails with CRM records.
- Email templates: `vtiger_emailtemplates` — stored with merge-field syntax `$leads_firstname$`.
- Outbound sending via PHPMailer (`class.phpmailer.php`).
- `vtiger_email_track` — open/click tracking.

### Activity History (Tracker)
`vtiger_tracker`: records recently visited records per user — used for the "Recently Viewed" sidebar widget. Not a field-change audit log.

Field-change history is handled by **ModTracker** (a separate vtlib module that hooks into record saves and logs before/after values for tracked fields in its own tables).

---

## 5. Automation / Workflow

Module: `modules/com_vtiger_workflow/`. This is Vtiger's rule engine.

### Workflow Definition (`com_vtiger_workflows` table)
Key columns:
- `module_name` — which module this workflow applies to (e.g. `'Leads'`)
- `execution_condition` — when to fire:
  - `1 = ON_FIRST_SAVE` — only on record creation
  - `2 = ONCE` — first time conditions are met (not on every save)
  - `3 = ON_EVERY_SAVE` — every create or update
  - `4 = ON_MODIFY` — only on update (not creation)
  - `6 = ON_SCHEDULE` — cron-based, runs on records matching conditions at a scheduled time
  - `7 = MANUAL` — triggered by a user action
- `test` — JSON-encoded condition set (evaluated by `VTJsonCondition`)
- `schtypeid` / `schtime` / `schdayofmonth` / `schdayofweek` / `schannualdates` — schedule definition for ON_SCHEDULE type
- `nexttrigger_time` — next scheduled execution timestamp
- `status` — 0=inactive, 1=active

### Conditions (`VTJsonCondition`)
Conditions are stored as a JSON array in `com_vtiger_workflows.test`. Each condition object has:
- `fieldname` — field to check (supports cross-module via syntax `referenceField : (Module) field`)
- `operation` — comparator (equals, not equal, less than, greater than, contains, starts with, is empty, changed, etc.)
- `value` — comparison value
- `groupid` — conditions in the same group are ANDed; groups are ORed

### Actions / Tasks (`com_vtiger_workflowtasks` table)
After conditions pass, tasks execute in sequence. Task types (from `modules/com_vtiger_workflow/tasks/`):
- **`VTEmailTask`** — send an email using an email template (supports merge fields)
- **`VTUpdateFieldsTask`** — update one or more fields on the triggering record (supports expression engine)
- **`VTCreateEntityTask`** — create a new record in any module
- **`VTCreateEventTask`** — create a Calendar Event linked to the record
- **`VTCreateTodoTask`** — create a Task (to-do) linked to the record
- **`VTSendNotificationTask`** — internal CRM notification
- **`VTSMSTask`** — send SMS
- **`VTEntityMethodTask`** — call a custom PHP method on the entity

Tasks are stored in `com_vtiger_workflowtasks` with `task` column as JSON-serialized config. Execution history in `com_vtiger_workflow_activatedonce` (tracks which records have triggered a ONCE-type workflow).

### Scheduled Workflows
`WorkFlowScheduler.php` / `vtigercron.php` runs periodically. For ON_SCHEDULE workflows, it queries all records of the target module matching the workflow conditions and executes the task list on each matched record.

### Expression Engine
`modules/com_vtiger_workflow/expression_engine/` — a simple formula language for computed values used in VTUpdateFieldsTask (e.g. `add(field1, field2)`, `if(condition, value1, value2)`, `subtract`, `multiply`, `concat`).

---

## 6. Customization

### LayoutEditor (Custom Fields + Block Re-ordering)
Module: `modules/Settings/LayoutEditor/`. Admin UI at Settings → Layout Editor.

**Custom Fields**: Added via `vtiger_field` (with `generatedtype = 2` to mark as admin-created custom). The actual column is added to the module's `*scf` table (e.g. `vtiger_leadscf`). Supported custom field types (via `uitype`): Text, Number, Date, DateTime, Picklist, Multi-select Picklist, Checkbox, URL, Email, Currency, Decimal, Percent, TextArea, Formula, Image.

**Blocks**: Admin can:
- Create new named blocks (sections) → inserts into `vtiger_blocks`
- Move fields between blocks → updates `vtiger_field.block`
- Reorder fields within a block → updates `vtiger_field.sequence`
- Show/hide blocks → updates `vtiger_blocks.show_title` / `isdisplaytype`

Custom fields and block layout changes take effect immediately (no deploy step) because the UI reads directly from `vtiger_field` and `vtiger_blocks` at render time.

**Relationships**: LayoutEditor also defines module-to-module relationships (1:1, 1:N, N:1, N:N), stored in `vtiger_fieldmodulerel`.

### CustomView (Saved List Views / Filters)
Module: `modules/CustomView/`. Saved list-view configurations shown as tabs on list views.

**Schema** (`vtiger_customview`):
- `cvid` — PK
- `viewname` — display name (e.g. "My Open Leads", "This Month's Deals")
- `entitytype` — module name (FK → `vtiger_tab.name`)
- `userid` — who created it
- `status` — `0=Default` (system-level), `1=Private`, `2=Pending approval`, `3=Public`
- `featured` — pin to top of the tab strip

**Columns** (`vtiger_cvcolumnlist`): ordered list of fields shown in this view's list columns.

**Standard Filters** (`vtiger_cvstdfilter`): date-range filters (e.g. "this week", "last month") on a specific date field.

**Advanced Filters** (`vtiger_cvadvfilter`): field-level filter conditions. Each row: `cvid`, `columnindex`, `columnname`, `comparator`, `value`, `column_condition` (AND/OR).

**Sharing**: A CustomView marked `status=3` (Public) is visible to all users. Private views (`status=1`) are visible only to the creator. Users can set a per-module default view (`vtiger_user_module_preferences.default_cvid`).

### Picklist Management
Module: `modules/Settings/Picklist/` and `modules/PickList/`. Picklist values are stored in `vtiger_picklistvalues`. Role-based picklist restriction via `vtiger_role2picklist` (which picklist values a given role is allowed to select). `vtiger_picklistdependency` supports dependent picklists (changing one picklist filters another).

---

## 7. Full Feature Inventory

### Core CRM
- Leads with lead conversion wizard (Lead → Contact + Account + Potential in one flow)
- Contacts with portal access and customer self-service portal
- Accounts with parent-child hierarchy (account tree / parent companies)
- Potentials (Opportunities/Deals) with stage history audit trail, probability tracking, forecast categories
- Activities (Calls, Meetings, Tasks) with recurring events, reminders, iCal import/export
- Email send/receive (MailManager IMAP integration), email templates with merge fields, email open/click tracking
- Documents (file attachments) with folder organization
- Reports module with custom report builder (tabular, summary, matrix), scheduled email delivery of reports
- Dashboards with configurable widgets (charts, top lists, pipelines, calendars)
- Global search across all modules
- Duplicate detection and merge for Contacts and Accounts
- Mass actions (mass edit, mass delete, mass assign, mass email)
- Import (CSV) with field mapping and de-dup rules
- Export (CSV) from any list view or report
- Tags (freeform tagging on any record)
- Recently Viewed tracking

### Sales / Pipeline
- Potentials Kanban view (pipeline board by sales stage)
- Forecast module
- Price Books, Products, Services catalog
- Quotes with line items, discounts, taxes, PDF generation
- Sales Orders from Quotes
- Purchase Orders
- Invoices with PDF generation

### Support
- HelpDesk (Cases/Tickets) with ticket comments, status tracking, escalation
- FAQ module
- Customer self-service portal (Contact-based external login)

### Marketing
- Campaigns with Lead/Contact targeting, campaign ROI tracking
- Email campaign tracking (send, open, click)
- Lead source tracking

### Admin / Settings
- Role hierarchy editor (unlimited depth tree, drag-and-drop)
- Profiles (permission templates) with module, action, and field-level control
- Sharing Access (org-default + custom sharing rules between roles/groups)
- Groups management (user groups with nested role membership)
- LayoutEditor (custom fields, block reordering, module relationships)
- CustomView management (shared saved filters)
- Picklist editor with role-based value restriction and dependent picklists
- Workflow editor (event-based + scheduled conditions + multi-step actions)
- Email account configuration (SMTP + IMAP)
- Currency management (multi-currency with exchange rates)
- Tax configuration
- Business Hours + Holidays (for SLA on HelpDesk)
- Module Manager (enable/disable modules)
- Menu Editor

---

## 8. UI/UX Patterns

### List View
- Top area: **CustomView tabs** (saved filters rendered as clickable tabs). Switching tab changes the active filter + column set.
- Search bar: basic search (searches primary name field) + Advanced Search (per-field filter form, collapsible).
- Column headers: clickable for sort (ASC/DESC toggle).
- Bulk actions toolbar (appears when rows are checked): Mass Edit, Mass Delete, Mass Assign, Export, Send Email.
- Pagination at bottom.
- "Quick Create" button (opens a reduced form in a modal/panel with only mandatory + quickcreate-flagged fields — field-level `quickcreate` flag in `vtiger_field`).

### Detail / Edit View
- Fields grouped into **collapsible Blocks** (named sections). Block collapse state is remembered per user.
- Related Lists at the bottom of detail view: each is a mini-list of related records (e.g. Contacts on an Account, Activities on a Lead). Related lists are module-defined.
- Inline edit: clicking a field value opens an in-place edit widget (no full page reload).
- History panel / Activity History tab: all past calls, emails, meetings linked to this record.
- Comments / Notes panel for internal threaded notes.
- Tag support (freeform tags on any record).

### Inventory / Quote UI
- Line-item editor on Quotes, SalesOrders, Invoices: a dynamic table with product lookup, qty, unit price, discount, tax. Subtotals and totals recalculate live in the browser.
- PDF generation of Quotes/Invoices.

### Reporting
- Report builder wizard: choose module, choose columns, add grouping, add conditions, add charts.
- Scheduled reports emailed on a cron schedule.
- Report folders for organization.

---

## 9. What AltLeads Appears to Be Missing

Based on the Vtiger teardown, features present in Vtiger but not yet in AltLeads:

### Data Model / Relationships
- Account parent-child hierarchy (`parentid` self-reference on company_master)
- Contact → Account relationship (contacts belonging to a company; our contacts are currently independent)
- Deal / Potentials module with amount, close date, stage, probability, forecast category
- Stage history audit trail (every stage change timestamped with who changed it and the amount at the time)
- Many-to-many Contact ↔ Deal associations
- Lead Conversion wizard (Lead → Contact + Company + Deal in one atomic flow, with admin-configurable field mapping)

### Access Control
- Field-level permissions (hide or make read-only per field per role/profile)
- Role hierarchy with "manager sees subordinates' records" as a first-class feature
- Sharing rules (explicit "this group can see that role's records" beyond the default public/private setting)
- Group assignment (assign records to a team/group, not just an individual user)
- Per-role picklist value restriction (e.g. a junior agent cannot select "Won" as a deal stage)

### Activity / Communication
- Recurring events / appointments
- iCal sync (export calendar to Google Calendar / Outlook)
- MailManager (IMAP inbox integration — link incoming emails to CRM records)
- Email open/click tracking
- Email templates with merge fields (our notify-service sends one-off transactional emails; no user-authoring template system)
- Reminders (time-based alerts before events)
- ModComments (threaded internal notes per record with @mentions)

### Automation
- Workflow engine (event-based + scheduled: send email, update fields, create records, create tasks automatically on conditions met)
- Formula/expression engine for computed field values
- Escalation rules (time-based, e.g. ticket unresolved after N hours triggers reassignment)

### Customization
- Custom field creation by admin (no-code, for any module)
- Block/section reordering in admin UI
- Dependent picklists (one picklist filters another)
- Admin-configurable N:N module relationships

### Analytics / Reporting
- Report builder with grouping, aggregation, charts
- Scheduled report email delivery
- Forecast module / pipeline revenue projections
- Configurable dashboard widgets (charts, top lists, pipeline funnel)

### Other
- Document/file management with folder structure
- Campaigns / email marketing module
- Customer self-service portal (Contact-based external login for end customers)
- Multi-currency support
- Invoice / Quote / SalesOrder with line items and PDF generation
- HelpDesk / support ticket system

---

## 10. Reverse-Engineering Feasibility

### What Maps Well to React / Supabase + RLS

**CustomView saved filters with public/private sharing** → High feasibility, high ROI.
The schema is clean: `vtiger_customview` (metadata) + `vtiger_cvcolumnlist` (displayed columns as an ordered list) + `vtiger_cvadvfilter` (filter conditions: field, comparator, value, AND/OR). This translates directly to a `saved_views` table in Postgres with a `columns JSONB` array and a `filters JSONB` array of `{field, operator, value, conjunction}` objects. A `status` field (private/public/default) enables team-shared views. Our existing saved views concept is on the right track — the key additions are the public/private sharing flag and a proper column-ordering model.

**Stage History Audit Trail** → High feasibility, high ROI.
`vtiger_potstagehistory` is trivial to replicate: a `deal_stage_history` table with `(deal_id, stage, changed_at, changed_by, amount)`. Adding this from day one on our Deals module costs almost nothing and unlocks time-in-stage analytics later. One app-layer hook on deal update is sufficient.

**Lead Conversion wizard** → Medium feasibility.
The concept (Lead → Contact + Company + Deal in one transaction) is straightforward SQL wrapped in a Postgres transaction. The complexity is the admin-configurable field mapping table. We can hard-code the mapping first and add a config UI later.

**Workflow Engine** → Medium feasibility, high long-term ROI.
The core pattern (trigger type + JSON conditions + ordered task list) is fully stack-agnostic. We would store workflows in Postgres (`workflows` table: `module`, `trigger_type`, `conditions JSONB`, `tasks JSONB[]`). Execution would be a Node.js event hook (on record save in the API) or a cron job (for scheduled). The condition evaluator is pure logic — VTJsonCondition translates cleanly to TypeScript. The hardest part is the no-code builder UI. A minimal first version (hardcoded "send email on lead status change") has immediate value.

**Dependent Picklists** → High feasibility, low effort.
A `picklist_dependencies` table: `(parent_field, parent_value, child_field, allowed_values[])`. The React `<Select>` component filters options based on the parent field's current value.

### What is Vtiger-Specific / Hard to Translate Directly

**Role hierarchy + sharing rules combined** → Conceptually right, but architectural mismatch.
Vtiger's materialized-path hierarchy is elegant for a single-tenant app. In AltLeads, our `project` acts as the primary tenant boundary (RLS on `project_id`). Within a project, "TL sees agents" is achievable via a `role_hierarchy` table checked by RLS policies, but the full 9-table custom sharing matrix is overkill for our current 6-role flat structure. The pattern to borrow: store role ancestry as a materialized path string so "find all subordinates" is a single LIKE query rather than recursive CTE — this matters at scale. The "sharing rules" concept becomes relevant when we launch client-configurable roles for enterprise customers.

**Profile → field-level visibility** → Medium complexity, API-layer problem.
In React, field visibility is trivial (conditional render). The complexity is persistence: a `profile_field_permissions` table with `(profile_id, module, field_name, visible, readonly)`. Supabase RLS is row-level, not column-level — field masking must happen in the API layer (the Express / PostgREST layer must strip disallowed columns before returning JSON). This is doable but requires deliberate column-stripping middleware.

**Multi-table entity model** (vtiger_crmentity + 3-4 per-module tables) → Not worth copying.
This was necessary for MySQL circa 2005 (ALTER TABLE was expensive; custom fields needed a separate table). In Postgres, `JSONB` columns handle custom fields elegantly. The lesson worth keeping: never add custom fields as real columns on the main entity table. Use a `custom_fields JSONB` column on each entity (e.g. `lead_master.custom_fields`) — this is the equivalent of Vtiger's `*scf` pattern without the multi-table complexity.

**Per-user privilege file cache** (`user_privileges/<userid>.php`) → Not applicable.
Vtiger regenerates flat PHP files to avoid DB hits on every page load. In Supabase, RLS policies run as compiled Postgres functions — they are set-based and fast. No equivalent file cache is needed at our scale.

### Verdict + Highest-ROI Items for AltLeads

**Overall verdict**: Vtiger's code is not portable (PHP, raw SQL, no types, no modern patterns). Its **data model and access-control architecture** are the real intellectual value. The three highest-ROI translations:

1. **CustomView / Saved Filters (public + private)** — Directly needed now. Schema is simple: one `saved_views` table with JSONB for columns + filters + an `is_public` flag. Solves a real team collaboration need and is a one-sprint feature.

2. **Deal module + stage history table** — We need a Deals entity anyway (in the roadmap). Adding `deal_stage_history` from day one is near-zero extra effort and enables time-in-stage reporting and pipeline forecasting from the start.

3. **Workflow engine skeleton** — Even a minimal version (trigger: on-record-save; condition: field equals value; action: send email OR update a field) immediately differentiates AltLeads for outreach teams. Vtiger's `VTJsonCondition` JSON condition structure (`[{fieldname, operation, value, groupid}]`) is the right model — it maps cleanly to a TypeScript evaluator. Build the data model now; ship the UI in phases.

After those three: the **role-hierarchy materialized-path pattern** is the right long-term investment for the Sales Portal (Sales Head seeing Sales Persons' records, TEAM_LEAD seeing Agents'). The flat 6-role RLS model is sufficient now but will hit limits when enterprise clients want custom role trees. The `parentrole` materialized-path design (`H1::H3::H7`) is the pattern to adopt when we add configurable hierarchies — it makes subordinate queries a single `LIKE` and avoids recursive CTEs at runtime.
