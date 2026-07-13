# EspoCRM Architecture Teardown
**Source:** `E:\reference code for crm\espocrm` (PHP + metadata JSON)
**Purpose:** Durable reference for AltLeads CRM design decisions — esp. ACL model, layout system, collaborators.
**Date:** 2026-06-29

---

## 1. Stack & Code Organization

### Runtime
- **Backend:** PHP 8+ (no framework — EspoCRM's own DI container, ORM, and routing)
- **Frontend:** Backbone.js + Handlebars (custom MVC in the browser; not React)
- **DB:** MySQL/MariaDB (also PostgreSQL-compatible). ORM handles all queries; raw SQL is rare.
- **API:** REST (`/api/v1/<Entity>`) + WebSocket for real-time stream notifications

### The metadata layer — the core insight
Everything in EspoCRM is driven by JSON metadata files, not hardcoded PHP or JS. This is the dominant architectural pattern.

**Three metadata namespaces per entity:**

| Namespace | Path | What it controls |
|---|---|---|
| `entityDefs` | `Resources/metadata/entityDefs/<Entity>.json` | Fields (type, validation, audit, relations), links (hasMany/belongsTo/hasChildren), indexes, convertEntityList |
| `clientDefs` | `Resources/metadata/clientDefs/<Entity>.json` | Which controller, which view class, side panels, bottom panels, kanban mode, filter list, color, icon |
| `layouts/` | `Resources/layouts/<Entity>/<layout>.json` | Field order for list/detail/detailSmall/filters/massUpdate views |

Additionally:
- `scopes/<Entity>.json` — marks whether entity has ACL, stream, is importable, customizable, portal access, which field is the status field
- `aclDefs/<Entity>.json` — overrides default ACL checker class (e.g. Meeting uses a custom checker that looks at `users` M2M, not `assignedUserId`)
- `logicDefs/<Entity>.json` — dynamic UI logic: field visibility conditions, required conditions evaluated client-side

### ORM
- Custom PHP ORM: entity classes extend `Espo\ORM\Entity`; queries built via ORM Query Builder
- `entityDefs` links define all relationships; the ORM reads them to generate joins
- No migrations in the traditional sense — schema is rebuilt from metadata on upgrade
- Relation types: `belongsTo`, `hasMany`, `hasOne`, `hasChildren` (polymorphic parent), `belongsToParent`, `linkMultiple`

---

## 2. Core CRM Data Model

### Entity graph

```
Campaign --> Lead --[convert]--> Account + Contact + Opportunity
                                         |
                                    Meeting / Call / Task / Email / Document / Case
```

### Lead (`entityDefs/Lead.json`)
- **Fields:** personName (firstName+lastName composite), salutationName, title, status (enum: New/Assigned/In Process/Converted/Recycled/Dead), source (Call/Email/Campaign/Web Site/etc.), industry (references Account.industry options), opportunityAmount (currency), website, address (composite), emailAddress (multi-value type), phoneNumber (multi-value with typeList: Mobile/Office/Home/Fax/Other), doNotCall (bool, audited), description
- **ACL fields:** assignedUser (link), teams (linkMultiple)
- **Activity links:** meetings (hasMany via junction LeadMeeting), calls (hasMany via junction LeadCall), tasks (hasChildren polymorphic), emails (hasChildren polymorphic), cases (hasMany)
- **Campaign tracking:** campaign (belongsTo), targetLists (hasMany via junction), campaignLogRecords
- **Conversion:** `convertEntityList: [Account, Contact, Opportunity]`; `convertFields` maps Lead fields to target entity fields (e.g. `accountName` to Account.name, `opportunityAmount` to Opportunity.amount). After conversion: `createdAccount`, `createdContact`, `createdOpportunity` links point to the new records; status flips to Converted; `convertedAt` timestamp set.

### Contact (`entityDefs/Contact.json`)
- Belongs to a primary `account` (belongsTo) AND can belong to many `accounts` (hasMany through `AccountContact` junction with `role` and `isInactive` columns)
- `title` is a computed (notStorable) field pulling from AccountContact.role via a left join — sophisticated ORM-level computed attribute
- `opportunityRole` is a junction column attribute (Decision Maker / Evaluator / Influencer) from the ContactOpportunity junction table
- `originalLead` back-link to the Lead that was converted into this Contact
- `hasPortalUser` computed bool — checks if a linked portal user exists (via IS_NOT_NULL subselect)
- `acceptanceStatusMeetings` / `acceptanceStatusCalls` — virtual filter-only fields that query the junction table status column for calendar filtering

### Account (`entityDefs/Account.json`)
- `type` enum: Customer / Investor / Partner / Reseller
- `industry` enum: 50+ industries (Advertising, Aerospace, Agriculture ... Water)
- Billing + Shipping address composites
- Links: contacts (hasMany with role+isInactive junction), opportunities, cases, documents, meetings (two sets: `meetingsPrimary` via account FK and `meetings` as hasChildren/polymorphic parent), emails, calls, tasks, campaign, portalUsers
- `isLocked` (bool, readOnly, audited) — record-level lock (via Core Action Lock/Unlock)
- `optimisticConcurrencyControl: true` — backend uses ETag/version checking on writes

### Opportunity (`entityDefs/Opportunity.json`)
- **Fields:** name, amount (currency, audited), amountConverted (read-only currency-converted), amountWeightedConverted (computed: `amount * probability / 100`, expressed as ORM formula in `select.select`), stage (enum: Prospecting/Qualification/Proposal/Negotiation/Closed Won/Closed Lost with `probabilityMap`), lastStage, probability (int 0-100), leadSource, closeDate (required, audited), campaign
- `contacts` linkMultiple with `opportunityRole` junction column (same pattern as Contact.title)
- `contact` (primary contact, belongsTo) separate from `contacts` (all contacts)
- `originalLead` back-link to conversion source
- `optimisticConcurrencyControl: true`
- `kanbanStatusIgnoreList: ["Closed Lost"]` — won't appear in kanban columns

### Meeting (`entityDefs/Meeting.json`)
- **Fields:** name, status (Planned/Held/Not Held), dateStart (datetimeOptional), dateEnd, isAllDay, duration (computed TIMESTAMPDIFF_SECOND), reminders (jsonArray — popup/email reminders with offset), parent (linkParent — can belong to Account/Lead/Contact/Opportunity/Case), account (readOnly, derived from parent), uid (iCalendar UID), joinUrl (for video conferencing), externalService (Zoom/Google Meet/etc.)
- **Attendees (3-way):** users (linkMultiple, junction `MeetingUser` with `status` column = acceptanceStatus), contacts (junction `ContactMeeting`), leads (junction `LeadMeeting`) — each attendee has their own acceptance status: None/Accepted/Tentative/Declined
- ACL uses custom checker (`aclDefs/Meeting.json`): ownership determined by `readOwnerUserField: "users"` (not just assignedUser)
- `repositoryClassName: Espo\Core\Repositories\Event`

### Call (same pattern as Meeting)
- Same attendee model (users/contacts/leads with acceptanceStatus junction column)
- Same parent linkParent
- Status: Planned/Held/Not Held

### Task (`entityDefs/Task.json`)
- **Fields:** name, status (Not Started/Started/Completed/Canceled/Deferred), priority (Low/Normal/High/Urgent), dateStart, dateEnd (audited), dateCompleted (readOnly), isOverdue (virtual bool), reminders, description (with attachments), parent (Account/Contact/Lead/Opportunity/Case), account (readOnly derived), contact (readOnly derived), attachments (attachmentMultiple)
- **COLLABORATORS:** `collaborators` field (linkMultiple, view: `views/fields/collaborators`, maxCount: 30, relation: `entityCollaborator`). This is a first-class field on Task — collaborators get read+stream access to the task even if it is not assigned to them. See Section 3 for ACL mechanics.
- `optimisticConcurrencyControl: true`

### Case (Support)
- Fields: number (auto), name, status, priority, type, account (link), contact (primary), contacts (many), lead, description
- Has Knowledge Base Article links
- Portal-visible (aclPortalLevelList configured)

---

## 3. Multi-Tenancy / Access Control (Roles + Teams + own/team/all)

EspoCRM is a **single-tenant** application (one installation = one company). It has no cross-tenant isolation layer.

### The ACL table
Defined in `Core/Acl/Table.php`. Five scope-level permission levels, two field-level:

**Scope (entity-level) actions and levels:**

| Action | Available Levels |
|---|---|
| `read` | `all` / `team` / `own` / `no` |
| `stream` | `all` / `team` / `own` / `no` |
| `edit` | `all` / `team` / `own` / `no` |
| `delete` | `all` / `team` / `own` / `no` |
| `create` | `yes` / `no` (boolean only) |

**Field-level actions and levels:**

| Action | Levels |
|---|---|
| `read` | `yes` / `no` |
| `edit` | `yes` / `no` |

### How levels are evaluated — DefaultOwnershipChecker.php

The `DefaultOwnershipChecker` (`Core/Acl/DefaultOwnershipChecker.php`) implements three interfaces: `OwnershipOwnChecker`, `OwnershipTeamChecker`, `OwnershipSharedChecker`.

**`checkOwn` (determines "own" match):**
1. If entity has `assignedUsers` (linkMultiple) — check if current user's ID is in that list
2. Else if entity has `assignedUserId` attribute — check equality with current user
3. Else fall back to `createdById`

**`checkTeam` (determines "team" match):**
- Gets user's team IDs (from `user.teamsIds`)
- Gets entity's team IDs (from `entity.teamsIds`)
- Returns true if any overlap exists

**`checkShared` (determines collaborator access — read/stream only):**
- Only applies to `read` and `stream` actions
- Checks if entity has a `collaborators` linkMultiple relation
- If yes, checks if current user's ID is in `entity.collaboratorsIds`
- If matched: user gets read+stream access regardless of own/team/all level

### Role merging
A user can have multiple roles. `DefaultTable.php` merges them: **most permissive level wins**. Level order (most to least permissive): `all > team > own > no`.

### Teams
- A `Team` entity groups users
- Every CRM entity (Lead, Contact, Opportunity, etc.) has a `teams` linkMultiple field
- When a record is placed in a team, any user in that team with `team`-level permission can read/edit it
- A user belongs to teams; a record belongs to teams; overlap = access

### Assignment
- Every entity has `assignedUser` (single) and `teams` (multiple)
- The `assignedUser` determines "own" ownership
- Some entities (Meeting, Call) use `assignedUsers` (linkMultiple) — then own = "I am in the attendees list"

### Collaborators (Task entity — and the infrastructure)
Collaborators are a **third ownership tier**, distinct from assignedUser and teams:
- Defined as `linkMultiple` field named `collaborators`, relation `entityCollaborator` (junction table `entityCollaborator` with columns entity_type, entity_id, user_id)
- Access scope: **read and stream only** — collaborators cannot edit via this mechanism
- Checked in `checkShared()` — only fires for `ACTION_READ` and `ACTION_STREAM`
- Currently Task is the only CRM entity with a `collaborators` field; the infrastructure in DefaultOwnershipChecker supports it on any entity that declares the field

### Portal ACL
Separate system (`aclPortal`). Lead has `aclPortalLevelList: ["all", "own", "no"]`. Opportunity has `["all", "account", "contact", "own", "no"]` — contact/account levels are portal-specific.

### Vs. AltLeads project-RLS
AltLeads uses Supabase Postgres RLS with `project_id` as the tenant boundary. EspoCRM has no equivalent — it is single-tenant. The closest analogy to AltLeads' project scoping is Teams: put all records for a project into a team, restrict agents to that team. EspoCRM's own/team/all levels are role-configured per entity type; AltLeads' RLS is a hard row-level filter on project_id. EspoCRM's model is more flexible but AltLeads' model provides stronger isolation for a multi-project SaaS-style deployment.

---

## 4. Activity / Communication Model

### Activities vs History — the two-panel pattern
EspoCRM splits activity display into two logical panels on every record's sidebar:

- **Activities** (upcoming/planned) — shows Meetings and Calls with status = Planned
- **History** (past) — shows Meetings (Held/Not Held), Calls (Held), Emails sent/received, and archived Notes

The `clientDefs/<Entity>.json` `sidePanels` array references `"activities"` and `"history"` by name; the `crm:controllers/activities` controller handles both. Example from `clientDefs/Lead.json`:

```json
"sidePanels": {
  "detail": [
    {"name": "activities", "reference": "activities"},
    {"name": "history", "reference": "history"},
    {"name": "tasks", "reference": "tasks"}
  ]
}
```

### Stream (chatter / activity feed)
- Every entity with `"stream": true` in its scope has a Stream panel
- Stream contains Notes (user-typed text), field change logs (audited fields), and activity records (calls/meetings linked to the record)
- Users can follow/unfollow records — followers receive in-app and email notifications on stream events
- `Account.bottomPanelsDetail.json` shows `"stream"` as the first bottom panel tab
- WebSocket pushes real-time stream updates to all followers

### Email
- Email is a first-class entity (entityDefs/Email.json)
- Records can receive emails via Inbound Email (IMAP integration per group mailbox)
- Emails are linked to records via the `parent` polymorphic link (same hasChildren pattern as Task)
- Each Contact/Lead/Account can have multiple email addresses (the `email` field type supports multiple addresses with types: Work/Home/Other and opt-out flags per address)
- Mass Email / Campaign modules handle bulk outreach with tracking URLs and opt-out management

### Reminders
- Both Meeting and Task support `reminders` (jsonArray stored in a separate `Reminder` entity)
- Reminder types: popup (browser notification) and email
- Offset can be minutes/hours before the event

---

## 5. Automation / Workflow

### Formula (community — built-in)
- EspoCRM's own expression language — runs server-side on save events
- Configured per entity type in Admin > Formula
- Executes a script on `beforeSave` or `afterSave`
- Syntax: `ifThen(condition, action)`, `string\concatenate(...)`, `entity\setAttribute(...)`, loops (`while`)
- CRM module extends formula with: `ext\account\findByEmailAddress(EMAIL_ADDRESS)` and `ext\calendar\userIsBusy(USER_ID, FROM, TO)`
- The Formula processor (`Core/Formula/Processor.php`) runs on every record save
- Mass recalculate action exists: `Core/MassAction/Actions/MassRecalculateFormula.php`

### Workflows (community — basic)
- Simple trigger-action rules: When [entity] [event] — do [actions]
- Events: record created, record updated (specific field changed), scheduled (time-based)
- Actions: send email, create record, update record, relate record, run formula
- Community edition workflows are limited (no loops, no branching beyond conditions)

### BPM — Business Process Manager (enterprise only)
- BPMN 2.0 visual process designer
- Not present in the community codebase scanned here
- Enables: parallel gateways, exclusive gateways, catch/throw events, user tasks with assignments, timers
- Lives in the `Espo\Modules\Advanced` module (enterprise)

### Scheduled Jobs
- Cron-style jobs; used for: sending queued emails, processing BPM timers, cleanup, reminders

### Dynamic Logic (`logicDefs`)
- Client-side conditional UI rules (field visibility, required state, read-only state based on other field values)
- Evaluated in the browser; no server round-trip
- Example (`logicDefs/Lead.json`): `name` required only if accountName AND emailAddress AND phoneNumber are all empty; `convertedAt` visible only when status = Converted
- `logicDefs/Opportunity.json` shows stage-dependent probability auto-fill

---

## 6. Customization

### Custom fields via Entity Manager (no-code)
- Admin > Entity Manager > select entity > Fields > Add Field
- Field types: varchar, text, int, float, currency, date, datetime, email, phone, url, bool, enum, multiEnum, checklist, array, jsonArray, link (belongsTo), linkMultiple, address, image, file, attachmentMultiple, number (auto-increment), formula (calculated), barcode, map
- New fields are stored in `custom/Espo/Custom/Resources/metadata/entityDefs/<Entity>.json` (overrides/merges with module metadata)
- Database columns are created automatically on schema rebuild
- `customizationOptionsReferenceDisabled` and similar flags in base entityDefs control which attributes can be changed for built-in fields

### Layout Manager (no-code)
- Admin > Layout Manager > select entity > select layout type (list / detail / detailSmall / edit / filters / massUpdate / relationships)
- Changes saved to `custom/Espo/Custom/Resources/layouts/<Entity>/<layout>.json`
- The layout file format is simple JSON arrays (for list) or panel/row/cell arrays (for detail)
- Side panels (Activities, History, Tasks) are configurable here too
- Changes take effect immediately without code deploy

### Dynamic Logic (no-code)
- Admin > Entity Manager > select entity > Dynamic Logic
- Conditions and consequences stored in `logicDefs/<Entity>.json` per field
- Supports: visible/hidden, required/not-required, read-only conditions based on field values

### Formula (admin-level scripting)
- Admin > Formula > select entity > Before Save / After Save script editor
- No deployment needed; stored in DB

### Extension system
- Extensions are ZIP packages installed via Admin > Extensions
- Can override any metadata file; module code lives in `custom/Espo/Modules/<Name>/`

---

## 7. Full Feature Inventory

**Data model and records:**
- Lead with status lifecycle and 1-click conversion to Account + Contact + Opportunity
- Account (company) with billing + shipping addresses, type (Customer/Partner/etc.), industry (50+ options)
- Contact with multi-account relationships (with role per account), portal user linkage
- Opportunity with pipeline stages, probability, close date, weighted amount
- Case (support tickets) with Knowledge Base linkage
- Document management (attach/relate documents to any entity)
- Campaign management with Target Lists, mass email, tracking URLs, opt-out handling
- Portal (customer/partner self-service with scoped data visibility and separate ACL)

**Activity and communication:**
- Meeting and Call with multi-party attendees (users + contacts + leads), acceptance status per attendee
- Task with priority, reminders, attachments, collaborators
- Email as a first-class entity; inbound email processing via IMAP; email tracking
- Stream (chatter) on every major entity; followers; real-time via WebSocket
- Reminders (popup + email) for meetings and tasks
- Calendar view (personal + shared team calendars)

**ACL and users:**
- Role-based access with own / team / all / no levels per entity per action (read/edit/delete/stream)
- Field-level ACL (hide or make read-only per field per role)
- Teams for group-based access scoping
- Collaborators on tasks (shared read-only access for named users on specific records)
- Portal users (external contacts/accounts with portal login, separate ACL)
- 2FA, API keys, OAuth authentication

**Automation:**
- Formula (scripted field computation/updates on save)
- Workflows (trigger-action rules; community)
- BPM (BPMN visual designer; enterprise)
- Scheduled jobs (cron)
- Webhooks (outbound HTTP on events)
- Lead Capture (web form to Lead, with campaign attribution)

**UI:**
- List view (sortable, column-configurable, bulk actions)
- Kanban view (Opportunity stages, drag-drop)
- Detail view with side panels (Activities/History/Tasks) and bottom panels (Stream, related lists)
- Mass update, mass delete, merge duplicates
- Import (CSV) with field mapping and duplicate checking
- Export (CSV/XLSX) with field selection
- Saved filters / search views
- Dashboards with configurable dashlets (Sales Pipeline, Opportunities by Stage, Calendar, Activities, etc.)
- Global search

**Other:**
- Currency with conversion rates and weighted amount calculations
- Multi-language (i18n)
- Extension/plugin system
- REST API + Swagger docs
- Optimistic concurrency control on Account, Opportunity, Task

---

## 8. UI/UX Patterns

### Layout system — the JSON-driven UI
Every screen is driven by a layout JSON file. There are no hardcoded HTML templates for field position.

**Layout types per entity:**

| Layout file | What it renders |
|---|---|
| `list.json` | Column list for the main entity list view — array of `{name, width, link, align, hidden}` |
| `listSmall.json` | Compact list used in relationship panels (sub-lists on detail page) |
| `detail.json` | Array of panels, each with `{label, rows: [[cell, cell], ...]}` where cell = `{name}` or `false` (empty half) |
| `detailSmall.json` | Condensed detail for quick-view popups |
| `filters.json` | Which fields appear in the search/filter panel |
| `massUpdate.json` | Which fields can be mass-updated |
| `relationships.json` | Which relationship panels appear and their order on detail view |
| `bottomPanelsDetail.json` | Tab structure for bottom panels (Stream, Contacts, Opportunities, etc.) |
| `defaultSidePanel.json` | Default side panel fields (assignedUser, teams, etc.) |
| `sidePanelsDetailSmall.json` | Side panel for compact view |

**Detail layout example** (`layouts/Lead/detail.json`):
```json
[
  {"label": "Overview", "rows": [
    [{"name":"name"}, {"name":"accountName"}],
    [{"name":"emailAddress"}, {"name":"phoneNumber"}],
    [{"name":"title"}, {"name":"website"}],
    [{"name":"address"}, false]
  ]},
  {"label": "Details", "rows": [
    [{"name":"status"}, {"name":"source"}],
    [{"name":"opportunityAmount"}, {"name":"campaign"}],
    [{"name":"industry"}, false],
    [{"name":"description", "fullWidth": true}]
  ]}
]
```

**Bottom panel with tab breaks** (`layouts/Account/bottomPanelsDetail.json`):
```json
{
  "_tabBreak_0": {"tabBreak": true, "tabLabel": "$Stream"},
  "stream": {"index": 1},
  "_tabBreak_1": {"tabBreak": true, "tabLabel": "$Account"},
  "contacts": {"index": 3},
  "opportunities": {"index": 4}
}
```

### Side panels (Activities / History / Tasks)
Defined in `clientDefs/<Entity>.json` under `sidePanels.detail`:
- `"reference": "activities"` / `"reference": "history"` / `"reference": "tasks"` — resolved to global panel definitions
- Side panels appear on the right of the detail view
- Bottom panels appear below the main form (relationship sub-lists, stream)
- The Layout Manager allows admins to reorder/hide any panel without code

### Stream (chatter) panel
- First tab in bottom panels on Account, Contact, Opportunity, Lead, Case
- Shows a chronological feed: user notes, field change entries (for `"audited": true` fields), activity logs
- Users can @mention others, who receive notifications
- Followers button: any user can follow any record they have access to

### Kanban view
- `clientDefs/Opportunity.json` has `"kanbanViewMode": true` and `"recordViews": {"kanban": "crm:views/opportunity/record/kanban"}`
- Columns = stage enum values; `kanbanStatusIgnoreList: ["Closed Lost"]` hides that column
- Drag-drop card between columns updates the stage field
- The same kanban infrastructure is available for any entity with a status field

### Filter / saved search
- `filters.json` lists which fields appear in the search panel
- Users can save named filter sets
- `boolFilterList: ["onlyMy"]` adds quick boolean filter buttons (e.g. "My Leads")
- `filterList` in clientDefs adds named preset filters (e.g. `{name: "actual"}`, `{name: "converted", style: "success"}`)

### Entity colors and icons
Every entity in `clientDefs` has `"color"` (hex) and `"iconClass"` (Font Awesome). Lead = `#da90c8` + `fas fa-address-card`; Opportunity = `#71ca7f` + `fas fa-dollar-sign`.

---

## 9. What AltLeads Appears to Be Missing

Comparing EspoCRM's architecture against AltLeads (TS/React/Vite/Supabase) current state:

### ACL model gaps
- **own / team / all levels per action** — AltLeads uses RLS but the assignment model is binary (you own it or you don't). EspoCRM's 4-level system (own/team/all/no) per each of 5 actions (CRUD + stream) per entity type is far more granular. AltLeads has no equivalent of "team-level read" (see records in your team's pool even if not assigned to you).
- **Field-level ACL** — EspoCRM can hide or make read-only individual fields per role. AltLeads has no field-level access control.
- **Collaborators** — EspoCRM's `entityCollaborator` junction gives named users read+stream access to a specific task record without assigning it to them. AltLeads does not have collaborators yet (ALT-152 is the blocker mentioned in docs).
- **Portal roles** — Separate ACL table for external users (customers, partners). AltLeads' sales portal uses a separate login but not a distinct ACL system.

### Data model gaps
- **No native Opportunity / Deal entity** — AltLeads has lead_report as the per-project status carrier but no explicit deal pipeline with stage/probability/amount/closeDate. EspoCRM's Opportunity with `probabilityMap` per stage and weighted amount calculation is a strong pattern.
- **No Case / Support ticket entity** — AltLeads is outreach-focused, but for client-facing support this is absent.
- **No Document management** — No file-attach-to-any-entity capability.
- **No multi-account Contact** — AltLeads contacts are linked to one company. EspoCRM's Contact-to-Account many-to-many with `role` and `isInactive` columns on the junction allows a contact to have roles at multiple companies.
- **Opportunity contact roles** — No concept of Decision Maker / Evaluator / Influencer on a deal.
- **No campaign / target list model** — Mass outreach attribution not tracked at the CRM data model level.

### Activity model gaps
- **Activities vs History split panel** — AltLeads has an activity hub but not the structured two-panel split (upcoming vs past) per record.
- **Meeting/Call acceptance status per attendee** — AltLeads' meeting_master does not track per-attendee acceptance (None/Accepted/Tentative/Declined) via junction table columns.
- **Followers / auto-notification** — No subscribe-to-record mechanic. AltLeads users cannot "follow" a record to receive change notifications.
- **Stream / chatter** — AltLeads' interaction log captures call/meeting outcomes but is not a free-form chatter stream where team members can post notes and @mention.

### Automation gaps
- **No Formula / server-side scripting on save** — AltLeads has no equivalent of EspoCRM's formula language for auto-computing fields or triggering actions on record save.
- **No Workflow rules** — No trigger-action automation. Actions like "when lead status changes to Converted, create a task" require code changes.
- **No Dynamic Logic** — No UI visibility conditions based on field values (e.g. show field X only when status = Y).

### UI/UX gaps
- **Metadata-driven layout system** — AltLeads layouts are hardcoded in React components. EspoCRM's JSON layout files allow admins to rearrange fields, add/remove columns, reorder panels without touching code.
- **No Layout Manager** — No admin UI to configure field order per view per entity.
- **No Kanban on all entities** — AltLeads has kanban for companies but it is not a generic system applicable to any entity with a status field.
- **No dashlets / configurable dashboard** — Fixed dashboard; no per-user drag-drop dashlet configuration.
- **No in-app Entity Manager** — Admins cannot add custom fields through a UI.

### Infrastructure gaps
- **No custom fields (admin-managed)** — Adding a field requires a code change + migration.
- **No import with duplicate detection** — AltLeads has bulk import but EspoCRM's includes field mapping UI, duplicate checking on configurable fields, and merge/skip/update options.
- **No merge duplicates** — AltLeads has no duplicate merge UI.
- **No Reminders** — No popup or email reminders for tasks/meetings.

---

## 10. Reverse-Engineering Feasibility

### What translates directly to React/Supabase

**1. Entity and field metadata to Supabase schema + Zod types**

EspoCRM's `entityDefs` field type system maps cleanly:
- `varchar` to `text`
- `enum` to Postgres `enum` or `text CHECK`
- `currency` to `numeric(15,2)` + currency code column
- `linkMultiple` to junction table (already how AltLeads works)
- `linkParent` to `parent_type text, parent_id uuid` polymorphic columns
- `hasChildren` / `hasMany` to FK or junction table

**2. ACL own/team/all model to RLS policies**

This is the highest-ROI translation. The four levels map to composable RLS conditions:

- `own` level: `auth.uid() = assigned_user_id`
- `team` level: `auth.uid() IN (SELECT user_id FROM team_members WHERE team_id IN (SELECT team_id FROM record_teams WHERE record_id = id))`
- `all` level: no row-level restriction (role-check only at query time)
- `collaborators`: `auth.uid() IN (SELECT user_id FROM entity_collaborators WHERE entity_id = id)` — gives read access to named users on specific records

The four levels can be implemented as a `user_access_level` config per role per entity type, evaluated at query time via a helper function. AltLeads currently has only project-scoped RLS; adding own/team/all would be a significant but buildable enhancement that directly addresses the assignment/write-path risk documented in REBUILD_LOG.

**3. Collaborators junction to `entity_collaborator` table**

The pattern is simple:
```sql
CREATE TABLE entity_collaborator (
  entity_type text,
  entity_id uuid,
  user_id uuid,
  PRIMARY KEY (entity_type, entity_id, user_id)
);
```
RLS union on `collaborators` gives read access. This is what ALT-152 should implement.

**4. Activities / History panel split**

The split between upcoming (status=Planned) and past (status=Held/Not Held + emails) is a filter-and-display pattern, not an architectural one. AltLeads can implement this as a query filter on the activity hub per record.

**5. Kanban infrastructure**

Already partially in AltLeads; generalizing it to any entity with a `status` field is achievable. The EspoCRM pattern of `kanbanViewMode: true` + `kanbanStatusIgnoreList` in metadata is guidance for what config flags to expose.

### What does NOT port easily

**1. Metadata-driven layout system**

EspoCRM's JSON layout files + Layout Manager is the most powerful but most expensive feature to replicate in React. Every React component in AltLeads today has its fields hardcoded. Building a metadata-driven system requires:
- A layouts table in Supabase (`layouts` table with entity_type, layout_type, config jsonb)
- A generic React field renderer that looks up field type from metadata and renders the right input
- An admin Layout Manager UI
This is a multi-week project but is the highest-leverage customization enabler long-term.

**2. Formula / server-side scripting**

No Supabase equivalent out of the box. Options:
- Postgres triggers (PL/pgSQL for computed fields) — works for simple cases
- Supabase Edge Functions triggered via DB webhooks — closest equivalent to EspoCRM's afterSave formula
- Not feasible as a no-code admin feature; would remain developer-configured

**3. Dynamic Logic (client-side conditional UI)**

Achievable in React but requires storing condition rules as JSON and evaluating them in the form renderer. Medium complexity; very high UX value.

**4. Workflow rules**

Can be built as a Supabase Edge Function triggered by DB change events, but the admin UI to configure trigger-action rules is complex. Medium-term roadmap item.

### Verdict and highest-ROI items

**Priority order for adapting from EspoCRM:**

| # | Feature | Effort | Value |
|---|---|---|---|
| 1 | **Collaborators** (`entity_collaborator` table + RLS union) | Low | High — unblocks ALT-152, enables shared task access |
| 2 | **own/team/all ACL levels** (add `team_members` + `record_teams` + role config + RLS policies) | Medium | High — solves the assignment/access model cleanly for internal launch |
| 3 | **Activities vs History split** per record | Low | Medium — cleaner UX than flat activity log |
| 4 | **Attendee acceptance status** on meetings/calls (add `status` column to junction tables) | Low | Medium — important for scheduling coordination |
| 5 | **Opportunity / Deal entity** with stage + probability + closeDate | Medium | High — enables pipeline tracking and sales portal |
| 6 | **Dynamic Logic** (field visibility from JSON conditions) | Medium | High — enables conditional forms without code deploys |
| 7 | **Layout-as-config** (store list/detail layouts in DB, render from metadata) | High | Very High long-term — enables no-code customization |
| 8 | **Formula / Edge Function triggers** (auto-compute fields on save) | Medium | Medium — enables automation without code changes |

**Bottom line:** EspoCRM's ACL model (own/team/all levels per action, collaborators for record-specific sharing, teams for group access) is the single most architecturally valuable pattern to port to AltLeads. It maps cleanly to Postgres RLS policies and directly addresses the write-path/ownership blocker. The metadata-driven layout system is the most powerful but most expensive; start with the ACL model and collaborators, then work toward JSON-driven layouts as the platform matures.
