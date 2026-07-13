# SuiteCRM Architecture Teardown
> Read-only reference for AltLeads CRM product decisions. Source: `E:\reference code for crm\suitecrm` (PHP/SugarCRM CE fork, AGPL). Do NOT copy code. Translate patterns into TS/React/Supabase.

---

## 1. Stack & Code Organization

### Technology
- **Language:** PHP 7.4+ (object-oriented, one class per module)
- **DB:** MySQL/MariaDB via SugarBean ORM; schema is auto-generated from `vardefs.php` — no separate migration files
- **Frontend:** Server-rendered PHP + Smarty `.tpl` templates; jQuery; minimal React
- **Entry point:** `index.php` routes `?module=X&action=Y` to `modules/X/` controller files

### Module structure
Every module lives at `modules/<ModuleName>/` and contains:
- `<ModuleName>.php` — the Bean class (business logic), extends `SugarBean` or a SugarObject template
- `vardefs.php` — **the schema**: field definitions, types, validations, relationships, indexes. This is the single source of truth; the DB table is generated from it.
- `metadata/` — view definitions: `detailviewdefs.php`, `editviewdefs.php`, `listviewdefs.php`, `searchdefs.php`, `subpaneldefs.php`, `quickcreatedefs.php`, `popupdefs.php`
- `language/` — i18n label arrays
- `views/` — controller classes for non-standard actions
- `Dashlets/` — module-specific dashboard widgets

### vardefs in depth
`$dictionary['Account']` is a PHP array declaring:
- `'table'` — DB table name
- `'audited' => true` — all changes logged to `accounts_audit`
- `'unified_search' => true` — globally searchable
- `'duplicate_merge' => true` — merge UI enabled
- Each field: `name`, `type` (varchar/enum/id/relate/link/currency/bool/text/date/datetimecombo/email/file/image/phone/parent/parent_type), `vname` (label key), `audited`, `massupdate`, `reportable`, `importable`
- Relationship fields typed `'link'` (non-DB, resolved at runtime) or `'relate'` (pulls display value via JOIN)
- Indexes declared inline: `array('name' => 'idx_...', 'type' => 'index', 'fields' => [...])`

### SugarObjects — base templates
`include/SugarObjects/templates/` provides inherited field sets:
- `basic/` — id, name, dates, assigned_user_id, team, deleted (soft-delete flag; present on ALL modules)
- `person/` — salutation, first_name, last_name, title, department, do_not_call, phone_home/mobile/work/other/fax, email, address_*, photo
- `company/` — name, phone_office, website, industry, annual_revenue, employees, billing/shipping address
- `sale/` — extends company; adds probability, amount, currency_id, date_closed, sales_stage
- `issue/` — status (dynamicenum), priority, resolution (used by Cases, Bugs)
- `file/` — filename, file_mime_type, file_url

Modules declare `'uses' => ['basic', 'person']` to inherit. Contacts and Leads use `person`; Accounts use `company`; Opportunities use `sale`.

### SugarBean ORM (`data/SugarBean.php`)
Base class for all module beans. Key methods:
- `save()` — insert/update, fires before/after logic hooks, saves relationship changes
- `retrieve($id)` — fetch by PK with `deleted = 0` filter
- `mark_deleted($id)` — sets `deleted = 1` (soft delete; no physical row removal)
- `delete_linked($id)` — cascades soft-deletes to relationship tables
- `retrieve_relationships()` — loads link fields via JOIN on relationship tables

---

## 2. Core CRM Data Model

### Accounts (table: `accounts`)
Represents an organization. Key fields:
- `name`, `account_type` (enum: Analyst/Competitor/Customer/Partner/Press/Prospect/Reseller), `industry`, `annual_revenue`, `employees`, `website`, `phone_office`
- `parent_id` / `parent_name` — hierarchical parent account (self-referential; supports subsidiary trees)
- `assigned_user_id` — record owner
- `billing_address_*`, `shipping_address_*`
- `rating`, `sic_code`, `ticker_symbol`
- Relationship links (subpanels): contacts, leads, opportunities, cases, calls, meetings, tasks, notes, emails, documents, bugs, campaigns, projects

### Contacts (table: `contacts`)
Represents an individual. Inherits `person` template.
- `account_id` → FK to accounts (M:1; one primary account, but linked to many via M2M)
- `reports_to_id` → self-referential reporting chain
- `lead_source` enum, `do_not_call`, `email_opt_out`
- `contact_role` stored on the M2M join with Opportunities (`opportunities_contacts` table, `contact_role` column)
- Subpanels: activities, history, opportunities, cases, bugs, leads, documents, projects, campaigns

### Leads (table: `leads`)
A pre-conversion prospect. Inherits `person` template.
- `lead_source` (enum: Web/Call/Email/Partner/etc.), `status` (New/Assigned/In Process/Converted/Recycled/Dead)
- `converted` (bool) — flipped on conversion; original lead record is preserved, never deleted
- Post-conversion FK fields: `contact_id`, `account_id`, `opportunity_id` — store what was created
- `account_name` stored as varchar (denormalized) until conversion creates an Account record
- Linked to: Campaigns, Calls, Meetings, Tasks, Notes, Emails

### Lead Conversion (wizard in `modules/Leads/`)
The conversion wizard lets the user:
1. Create a new Contact from lead fields (or match an existing one by name/email)
2. Create a new Account (or match an existing one)
3. Optionally create an Opportunity
Sets `leads.converted = 1` and writes contact_id / account_id / opportunity_id FKs back to the lead record. The lead is not deleted — it remains as historical record.

### Opportunities (table: `opportunities`)
Represents a sales deal.
- `account_id`, `name`, `amount` (currency), `amount_usdollar` (currency-normalized), `currency_id`
- `date_closed` (expected close date), `sales_stage` (enum: Prospecting/Qualification/Needs Analysis/Value Proposition/Id. Decision Makers/Perception Analysis/Proposal-Price Quote/Negotiation-Review/Closed Won/Closed Lost), `probability` (0–100 int, validated)
- `lead_source`, `next_step`, `opportunity_type`
- M2M to Contacts via `opportunities_contacts` (with `contact_role` attribute on the join)
- M2M to Accounts via `accounts_opportunities`
- Subpanels: contacts, calls, meetings, tasks, notes, emails, documents, contracts, quotes, leads

### Activities vs History
SuiteCRM distinguishes two virtual subpanel types on every record:
- **Activities** (`modules/Activities/`) — open/pending: Calls (status=Planned), Meetings (status=Planned), Tasks (status != Completed). No own table; unions live items.
- **History** (`modules/History/`) — completed/archived: Calls (Held), Meetings (Held), Tasks (Completed), Notes, Emails. No own table; unions closed items.

### Cases (table: `cases`)
Customer support tickets. Inherits `issue` template.
- `account_id`, `status` (dynamicenum — values are admin-configurable), `priority`, `resolution`
- `state` (Open/Closed) drives the `status` parentenum behavior
- `AOP_Case_Updates` — customer portal threaded updates per case
- `AOBH_BusinessHours` — SLA business-hours timer
- Inbound email auto-links to cases by parsing ticket number from subject

---

## 3. Multi-Tenancy / Access Control

SuiteCRM is fundamentally **single-tenant** (one org per installation). ACL controls what users within that org can see/do, not tenant isolation.

### Layer 1: ACLRoles (module-level permissions)
`modules/ACLRoles/` — role definitions in `acl_roles` table.
`modules/ACLActions/` — permitted actions per module per role: `list`, `view`, `edit`, `delete`, `import`, `export`, `massupdate`.
- Each action gets scope: `All` (any record), `Owner` (own records only where `assigned_user_id = current_user`), `None` (blocked)
- Users assigned one or more roles; most-permissive role wins (OR logic across roles)
- `ACLController::checkAccess($module, $action, $is_owner, $type, $in_group)` called on every page render
- Admin users (`is_admin=1`) bypass all ACL checks

### Layer 2: SecurityGroups (record-level isolation)
`modules/SecurityGroups/` — optional plugin adding row-level access.
- Every record gets one or more Security Groups attached via `securitygroups_records` join table
- User must be member of at least one of the record's groups to access it
- `noninheritable` flag: controls whether child records auto-inherit parent's group membership
- `primary_group` flag on join: the "owning" group
- Groups can have ACLRoles attached, further scoping permissions within the group
- Combined check: `$is_owner || $in_group` determines Owner-level actions

### vs AltLeads project RLS
| Dimension | SuiteCRM | AltLeads |
|---|---|---|
| Isolation unit | SecurityGroup (manually assigned per-record) | project (structural; company/contact pool shared across projects) |
| Enforcement layer | PHP application (`ACLController`) | Postgres RLS (`auth.uid()` in policies, enforced by PostgREST) |
| Role granularity | Per-module per-action, Owner vs All | Per-role enum (ADMIN/TEAM_LEAD/AGENT/SALES_HEAD/SALES_PERSON/QC) |
| Multi-tenancy | Not native — single org per install | Native — project = tenant boundary |
| Ownership field | `assigned_user_id` on every record | `lead_report.user_id` (NOT created_by) |

---

## 4. Activity / Communication Model

### Calls (table: `calls`)
- `name` (subject), `status` (Planned/Held/Not Held), `direction` (Inbound/Outbound)
- `duration_hours` + `duration_minutes`, `date_start`, `date_end`
- `parent_type` / `parent_id` — polymorphic parent (Account/Contact/Lead/Opportunity/Case/etc.) via `parent_type_display` enum
- `description` (text log)
- Invitees: M2M to Contacts, Leads, Users via `calls_contacts`, `calls_leads`, `calls_users`; each invitee has `accept_status` (None/Accepted/Declined/Tentative) stored on the join row
- Reminders: `reminder_time` (minutes before), `email_reminder_checked`, `email_reminder_time`
- `outlook_id` — Outlook calendar sync reference

### Meetings (table: `meetings`)
Same structure as Calls with additions:
- `location` (varchar)
- `repeat_type` / `repeat_interval` / `repeat_dow` / `repeat_until` — recurring meeting support
- `password` — optional access password
- Same invitee M2M pattern as Calls with accept_status
- iCal server integration (`ical_server.php`)

### Tasks (table: `tasks`)
- `name`, `status` (Not Started/In Review/Completed/Pending Input/Deferred), `priority` (High/Medium/Low)
- `date_due`, `date_start` (with validation: start must be before due)
- `date_due_flag`, `date_start_flag` — "no date" toggles
- `contact_id` (direct FK) + polymorphic `parent_type`/`parent_id` for any other related record
- `assigned_user_id`

### Notes (table: `notes`)
- `name` (subject), `description` (body text), `filename` / `file_mime_type` (file attachment)
- Polymorphic `parent_type`/`parent_id` + direct `contact_id`
- Used as attachment vehicle for emails and as standalone log entries
- Appear in History subpanel only (not Activities)

### Emails (table: `emails`)
- `name` (subject), `type` (enum: archived/campaign/draft/inbound/out), `status`
- `from_addr_name`, `to_addrs_names`, `cc_addrs_names`, `bcc_addrs_names`
- `description` (plain text body), `description_html` (HTML body stored as `emailbody` type)
- `date_sent_received`, `message_id` (IMAP UID for dedup), `mailbox_id` → InboundEmail
- `reply_to_status` (bool) — marks if user has replied to this email
- M2M to Accounts, Contacts, Leads, Opportunities, Cases, etc. via `emails_*_rel` tables
- Attachments are Notes records linked via `email_id`

### InboundEmail (`modules/InboundEmail/`)
- IMAP/POP3 mailbox polling via PHP `imap_*` extension wrapped in `ImapHandlerInterface`
- Fetches unseen messages, parses MIME (via `MailMimeParser`), creates Email records
- Auto-links inbound emails to Cases by parsing ticket-number patterns in subject line
- Supports personal (per-user) and shared (group/support) mailboxes
- `AOP_Case_Events` handles customer-facing portal email threading

### History aggregation
`modules/History/` is a virtual collection that unions: Calls (status=Held) + Meetings (status=Held) + Tasks (status=Completed) + Notes + Emails, all filtered by `parent_id`. This powers the History subpanel on every entity with a single source of truth.

---

## 5. Automation / Workflow (AOW — Advanced OpenWorkflow)

### Core tables
- `aow_workflow` — workflow definition (one row per workflow)
- `aow_conditions` — condition rules (1:M to workflow)
- `aow_actions` — action definitions (1:M to workflow)
- `aow_processed` — audit log of every workflow run per record

### AOW_WorkFlow fields (`modules/AOW_WorkFlow/vardefs.php`)
- `flow_module` (enum) — which module triggers this (Accounts, Contacts, Leads, Opportunities, etc.)
- `status` (Active/Inactive)
- `run_when` (Always/Only On Save/Always On Save/Once/Always On Manual)
- `flow_run_on` (0=All records/1=New records only/2=Modified records only)
- `multiple_runs` (bool) — can the same record trigger this workflow more than once
- `run_on_import` (bool) — fires during bulk CSV import

### AOW_Conditions (`modules/AOW_Conditions/`)
Each row is one condition evaluated against the triggering record:
- `field` (enum of module fields), `operator` (enum: equals/not equals/greater than/less than/contains/starts with/changes/changes to/changes from/greater than date/etc.)
- `value_type` (value/field/any change/date), `value` (comparison value or expression)
- `module_path` (longtext) — allows conditions on related module fields (e.g., Account.billing_country on a Lead trigger)
- All conditions AND'd together

### AOW_Actions (built-in types, `modules/AOW_Actions/actions/`)
- `actionSendEmail.php` — send email using an EmailTemplate; field tokens replaced at send time
- `actionCreateRecord.php` — create a new record in any module with field mappings
- `actionModifyRecord.php` — update fields on the triggering record or a related record
- `actionComputeField.php` — run a formula to calculate a field value (supports arithmetic + date math)
- `FormulaCalculator.php` — expression evaluator for computed fields
- Actions have an `order` field for execution sequencing

### Trigger mechanism
Workflows fire on `SugarBean::save()` via logic hooks (`modules/<Module>/logic_hooks.php` → `after_save`). The hook calls `AOW_WorkFlow::runWorkflows($bean)` which evaluates all Active workflows for the module.

### Schedulers (`modules/Schedulers/`)
Cron-backed job runner. `cron.php` is invoked by system cron. Used for: email queue flush, inbound email polling, workflow re-processing, scheduled report delivery (`AOR_Scheduled_Reports`).

---

## 6. Customization (Studio / DynamicFields / Module Builder)

### Studio (`modules/Studio/`)
Admin GUI for in-place customization without touching core code:
- Add, edit, reorder fields on list/detail/edit/search views
- Edit field labels and help text
- Manage module-to-module relationships
- Changes write to `custom/Extension/modules/<Module>/Ext/` — layered over core files without modifying them

### DynamicFields (`modules/DynamicFields/`)
The field-type library backing Studio:
- `FieldsMetaData` bean stores custom field definitions in `fields_meta_data` table (one row per custom field per module)
- `DynamicField.php` issues `ALTER TABLE <module> ADD COLUMN ...` when a custom field is saved
- Custom field values are stored in `<module>_cstm` tables (e.g., `accounts_cstm`) with a 1:1 join on `id`
- Available field types (`templates/Fields/`): varchar, int, decimal, float, bool, date, datetimecombo, text, enum, multienum, currency, url, phone, email, image, file, html, iframe, encrypt, radioenum, address

### Module Builder (`modules/ModuleBuilder/`)
Creates entirely new modules from scratch:
- Admin defines fields, relationships, layouts via GUI
- Generates a module package (ZIP) installable via Module Loader
- Deployed modules behave identically to core modules

### Extension framework (`custom/Extension/`)
All customizations layer on top via runtime merging:
- `custom/Extension/modules/<Module>/Ext/Vardefs/` — extra field definitions merged at startup
- `custom/Extension/modules/<Module>/Ext/Layoutdefs/` — view overrides
- `custom/Extension/modules/<Module>/Ext/Language/` — label overrides
- `custom/modules/<Module>/` — custom Bean class overrides
- **Repair & Rebuild** (`Administration > Repair`) merges all extension files into compiled PHP in `custom/`; must be run after any extension change

---

## 7. Full Feature Inventory

### Core CRM
- Accounts with parent-child hierarchy (subsidiary trees via `parent_id`)
- Contacts with reporting chain (reports_to self-referential)
- Leads with full conversion wizard → Contact + Account + Opportunity
- Opportunities with multi-currency, probability, stage pipeline, contact roles on M2M
- Cases (support tickets) with customer portal updates, SLA timers
- Bugs module (issue tracker linked to Cases and Contacts)

### Activity & Communication
- Calls: log/schedule, Inbound/Outbound direction, duration, multi-invitee with accept status, reminders
- Meetings: schedule, location, recurring, iCal export, multi-invitee with accept status
- Tasks: priority, due date, contact link, polymorphic parent
- Notes: rich text + file attachment, polymorphic parent
- Emails: compose/send, IMAP/POP3 inbound, HTML templates, email threading, reply tracking
- History timeline per record (Calls+Meetings+Tasks+Notes+Emails unified)
- Activities subpanel (open/pending items)

### Sales & Marketing
- Campaigns (Email/Non-email/Teaser): wizard setup, prospect lists, scheduled sends, campaign log, ROI metrics
- Web-to-Lead capture forms (generated HTML)
- Email Marketing with opt-out, invalid email tracking, campaign log
- Mass email via EmailMan queue + cron flush
- Campaign diagnostics

### Reporting (AOR — Advanced OpenReports)
- Ad-hoc report builder: select module, add fields, define conditions, group/sort
- Chart types: pie, bar, line (AOR_Charts)
- Scheduled reports: email PDF or CSV on cron schedule (AOR_Scheduled_Reports)

### Documents & Files
- Documents module with full revision history (DocumentRevisions)
- Documents linkable to any entity via subpanel
- PDF Templates (AOS_PDF_Templates): Smarty-based PDF generation for Quotes/Invoices/Contracts

### Quotes & Invoices (AOS — Advanced OpenSales)
- AOS_Products product catalog with AOS_Product_Categories
- AOS_Quotes: line items, tax, discount, shipping; linked to Account + Opportunity
- AOS_Invoices: generated from Quotes
- AOS_Contracts: contract lifecycle management
- PDF export of any Quote/Invoice/Contract

### Project Management
- Project (Gantt view) with ProjectTasks, dependencies, % complete
- Resource Calendar
- Linked to Accounts, Contacts, Opportunities

### Knowledge Base (AOK)
- AOK_KnowledgeBase articles with AOK_Knowledge_Base_Categories
- Full-text search via AOD_Index (Zend Lucene, reindexed by cron)

### Surveys & Events
- Surveys with multiple question types, response tracking (SurveyQuestions, SurveyResponses, SurveyQuestionOptions)
- FP_Events: event/venue management (FP_events, FP_Event_Locations)

### Maps
- jjwg_Maps: Google Maps integration; geocoded pins for Accounts/Contacts (jjwg_Markers, jjwg_Areas)

### Security & Auth
- Role-based access: ACLRoles + ACLActions
- SecurityGroups record-level isolation
- OAuth 1.0 and OAuth 2.0 REST API auth
- Two-factor auth (optional admin toggle)
- Per-module audit trail (`<module>_audit` tables)

### Admin
- Studio, Module Builder, Module Loader (install/uninstall packages)
- Repair & Rebuild
- Scheduler management
- Inbound/Outbound email account setup
- External OAuth connections (EAPM: Google, Dropbox, etc.)
- System settings: locale, timezone, currency, date format, theme

### Import / Export
- CSV import with field mapping, dedup preview, required-field validation
- CSV export from any list view
- vCard import/export for Contacts/Leads
- iCal server (`ical_server.php`) for calendar sync

### Search
- Per-module Saved Searches: `saved_search` table (user_id, search_module, name, contents [serialized filters])
- Global unified search: across all `unified_search=true` modules by name field
- Full-text search via AOD_Index (Zend Lucene, async)
- Advanced search: date ranges, multi-value enum, relationship traversal

### Dashboards & Dashlets
- Home page with configurable multi-column dashlet layout
- Per-module list dashlets, chart dashlets, report dashlets, saved-search dashlets, calendar dashlet
- Each user independently configures their dashboard

---

## 8. UI/UX Patterns

### View rendering model
All views are PHP-driven with Smarty templates. The URL pattern is `?module=X&action=Y`:

- **DetailView** — read-only record display; layout from `metadata/detailviewdefs.php`; standard action buttons: Edit, Duplicate, Delete, Find Duplicates
- **EditView** — same layout with editable fields; inline validation; `quickcreatedefs.php` drives modal quick-create popups from related subpanels
- **ListView** — tabular list; columns from `metadata/listviewdefs.php`; sortable headers; checkboxes for mass actions (delete, reassign, mass update, export)
- **SearchView** — filter panel above list; `metadata/searchdefs.php` defines which fields appear in basic vs advanced search; filters persist as `SavedSearch` records
- **Popup** — lightbox record selector for relate fields; `popupdefs.php` drives the popup list view
- **SubPanel** — accordion section below DetailView; each entity's `subpaneldefs.php` declares related modules, their column layout, and quick-create buttons

### Subpanel mechanics (example: Contact DetailView)
Subpanels in order on a Contact:
1. Activities — Calls (Planned) + Meetings (Planned) + Tasks (open)
2. History — Calls (Held) + Meetings (Held) + Tasks (Done) + Notes + Emails
3. Documents
4. Leads (source lead this contact was converted from)
5. Opportunities (M2M with contact_role on join)
6. Cases
7. Bugs
8. Direct Reports (self-referential contacts)
9. Projects
10. Campaign Log

Each subpanel is a paginated mini-list with sortable columns; top buttons allow creating a related record inline without leaving the parent record.

### Mass update
List views: "Select All" + "Mass Update" dispatches a batch field-update to all selected records. Fields flagged `'massupdate' => true` in vardefs appear in the mass update form.

### Themes
`themes/` directory; default is SuiteP (Bootstrap 3). Admin can switch globally. Themes override CSS and header/footer layout.

### Mobile
No native mobile app in core SuiteCRM. Responsive theme is limited. Mobile access is via browser only.

---

## 9. What AltLeads Appears to be Missing

### Data model gaps
- **Opportunity / Deal pipeline** — SuiteCRM's central sales object (amount, stage, probability, close date, currency). AltLeads has lead_master + lead_report for pre-qualification but no deal progression entity.
- **Contact → Account formal FK** — SuiteCRM's `contacts.account_id` is a first-class 1:M relationship used in all views and reporting. AltLeads has company_master + contact_master but the relationship may not be surfaced in UI or used in RLS scoping.
- **Hierarchical accounts** — `parent_id` self-reference for subsidiary company trees.
- **Contact reporting chain** — `reports_to_id` hierarchy within Contacts.

### Activity model gaps
- **Multi-invitee with accept status on Calls/Meetings** — SuiteCRM tracks per-invitee accept_status on M2M join tables. AltLeads has meeting_master but no invitee list.
- **Inbound email / email-to-case** — IMAP/POP3 mailbox polling, auto-link to cases. AltLeads has no inbound email.
- **Email compose & send from CRM** — AltLeads logs calls/interactions but cannot draft/send email from within the app.
- **Recurring meetings** — repeat_type/interval/until fields.

### Relationship/association gaps
- **M2M with attributes on join** — e.g., Contact↔Opportunity with contact_role on the join table. AltLeads has no arbitrary M2M with metadata.
- **Polymorphic parent** — `parent_type`/`parent_id` lets a Task or Note attach to any module. AltLeads tasks/interactions have fixed FK targets.

### Automation gaps
- **Workflow engine** — no equivalent of AOW (condition-based if/then automations). AltLeads has no trigger-based field updates, auto-email, or record creation.
- **Scheduled jobs / cron** — no background job runner for email queues, reminder dispatch, scheduled reports.
- **Activity reminders** — no in-app or email reminders on calls/meetings/tasks.

### Reporting gaps
- **Ad-hoc report builder** — AOR lets admins build cross-module reports with conditions, grouping, and charts. AltLeads has no report builder; views are fixed.
- **Scheduled report delivery** — email PDF/CSV on cron schedule.
- **Configurable dashboard with chart dashlets** — AltLeads has fixed dashboard sections, no user-configurable widget layout.

### Sales & Marketing gaps
- **Campaigns** — mass email, prospect lists, web-to-lead, opt-out management, ROI tracking.
- **Email template library** — no managed templates.
- **Quotes / Invoices / Contracts / Product catalog** — no AOS equivalent.

### Customization gaps
- **Custom fields via admin UI** — AltLeads has no Studio equivalent; adding a field requires a Postgres migration + code change.
- **View layout editor** — no admin UI to reorder fields on detail/list views.
- **Module Builder** — no way for non-developers to create new data modules.
- **Dynamic enums** — SuiteCRM admin can add/edit dropdown list values via Dropdown Editor; AltLeads enums are hardcoded.

### Support/Service gaps
- **Cases / ticketing** — no support module, no SLA timers, no customer-portal threading.
- **Knowledge Base** — no article library.

### Misc gaps
- **Duplicate detection on save** — SuiteCRM checks unified_search fields against existing records before save and prompts the user.
- **Per-field audit trail** — SuiteCRM logs every field change with old/new value to `<module>_audit` tables. AltLeads has no per-field audit log.
- **vCard import/export**, iCal integration.
- **Maps / geocoding** integration.

---

## 10. Reverse-Engineering Feasibility

### What ports cleanly to TS/React/Supabase

| SuiteCRM pattern | AltLeads translation |
|---|---|
| vardefs field types (varchar/enum/bool/date/currency/relate) | Postgres column types; enums as `text CHECK IN (...)` or native `enum` type |
| `'audited' => true` per module | Supabase trigger → `audit_log (table, record_id, field, old_val, new_val, user_id, ts)` |
| `'duplicate_merge'` | Already have merge; extend to Contacts/Companies |
| Saved searches (`saved_search` table: module + contents blob per user) | `saved_views (user_id, module, name, filter_json JSONB)` table; implement now |
| Subpanel pattern (related records below detail) | React `<RelatedList module="calls" parentId={id} />` pulling from PostgREST with FK filter |
| Activities/History split (open vs closed by status) | Filter queries on `status` column; two separate PostgREST calls or a UNION view |
| Polymorphic parent (`parent_type`/`parent_id`) | `parent_type text CHECK IN (...)` + `parent_id uuid` columns on tasks/notes/interactions; app-enforced referential integrity |
| ACLRoles (module × action × Owner/All) | `acl_permissions (role, module, action, scope enum('own','all'))` table checked in middleware |
| M2M with attributes on join (contact_role on opportunities_contacts) | Postgres join table with extra columns; PostgREST embedded resource exposes join attributes |
| AOW conditions (field/operator/value triples) | `workflows (trigger_module, run_on, conditions JSONB, actions JSONB)` + Edge Function evaluator on record save |
| Dynamic enums | `dropdown_lists` + `dropdown_options (list_name, key, label, sort_order)` tables; admin UI to manage |
| Lead conversion wizard | Multi-step modal: pre-fill Contact/Account/Opportunity from Lead fields; write `converted=true` + FKs back to lead |

### What is Sugar-specific / not worth porting
- **Smarty template view system** — irrelevant; React replaces entirely
- **Extension framework** (`custom/Extension/` PHP overlay) — Sugar's workaround for not modifying core; not needed in our TS codebase where customization is first-class in code
- **Module Builder** generating PHP packages — our equivalent would be schema-driven but low priority
- **`imap_open()` + Zend Lucene** — replace with `imapflow` (Node.js) for IMAP and Postgres `tsvector` for full-text search (Supabase supports this natively)
- **SugarBean ORM field-type resolution at runtime** — unnecessary; PostgREST handles types at DB level
- **Repair & Rebuild** (merges PHP extension files) — not applicable; we use versioned migrations
- **ACL checkAccess called on every page render** — replace with RLS enforced at DB level (already our model); no per-request PHP check needed

### Verdict

SuiteCRM's **data model** is the most valuable asset to study. The entity relationships, vardef field patterns, and Lead conversion flow translate 1:1 into Postgres schemas with minimal conceptual friction. The workflow engine (AOW) design — condition triples + action objects stored in DB, evaluated on record save — is directly portable as a JSONB-rule approach with a Node/Edge Function evaluator.

The PHP rendering infrastructure (Smarty, SugarBean, Extension framework) is irrelevant noise; ignore it.

### Highest-ROI items to build next (from this study)

1. **Opportunity / Deal entity** — `deals (account_id, amount, currency, stage, probability, close_date, lead_source)` with M2M to contacts. Closes the single biggest gap between AltLeads and a full CRM.
2. **Polymorphic parent on tasks + notes** — `parent_type` / `parent_id` columns instead of separate module-specific FKs; enables a universal activity log across all entities.
3. **Saved searches as DB records** — `saved_views (user_id, module, name, filter_json JSONB)` table; already conceptually designed, mirror SuiteCRM's `saved_search` table exactly.
4. **Per-field audit log** — Postgres trigger writing `(table, record_id, field, old_value, new_value, changed_by, ts)` on every UPDATE; SuiteCRM does this for all `'audited' => true` modules (all core ones).
5. **Dynamic enum management** — `dropdown_options (list_name, key, label, sort_order)` table + admin UI; unblocks no-code customization of status/stage/type fields without migrations.
6. **Workflow engine skeleton** — `workflows (trigger_module, run_on, conditions JSONB, actions JSONB)` + Node/Edge Function on save hook; even 4 action types (send email, update field, create task, notify user) covers 80% of CRM automation use cases.
