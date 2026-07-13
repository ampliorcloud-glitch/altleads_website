# ERPNext CRM — Architecture Blueprint

> **Purpose:** Read-only reference for the AltLeads CRM team. Synthesized from ERPNext source at `E:\reference code for crm\erpnext`. No code was modified.
> **Date:** 2026-06-29 | **Analyst:** Claude Code (Sonnet 4.6)

---

## 1. Stack & Code Organization

### Technology Stack
- **Language:** Python 3.x
- **Framework:** Frappe (MIT-licensed, separate repo — not cloned here). ERPNext is an application layer on top of Frappe.
- **Database:** MariaDB (InnoDB engine, as declared in every DocType JSON: `"engine": "InnoDB"`)
- **Frontend:** Frappe Desk — a JS/jQuery SPA (not React). The framework renders forms, lists, and reports from metadata, not from hand-written HTML templates.

### The DocType Model — How It Works

The central concept in Frappe/ERPNext is the **DocType**. Every entity (Lead, Opportunity, Customer, Contract, even "Role Permission Manager") is a DocType. Each DocType is defined by two files:

#### `<name>.json` — Metadata (schema + UI + permissions)
This file is the single source of truth. It drives:
- **Database schema:** `fields[]` array → each entry with a `fieldtype` (`Data`, `Currency`, `Link`, `Table`, `Select`, `Check`, `Date`, `Percent`, `Dynamic Link`, `Attach Image`, `HTML`, `Tab Break`, `Section Break`, `Column Break`) maps directly to a DB column (structural fields like Tab/Section/Column are UI-only, no DB column).
- **UI layout:** The order of entries in `field_order[]` controls form layout. Section Break + Column Break + Tab Break are inline layout instructions. `in_list_view: 1` makes a field appear as a column in list view. `in_standard_filter: 1` exposes it as a filter chip.
- **Permissions:** Declared inline in `permissions[]` — role-level CRUD matrix (see Section 3).
- **Behavior flags:** `allow_import`, `allow_rename`, `allow_events_in_timeline`, `email_append_to`, `track_changes`, `track_seen`, `track_views`, `is_submittable`, `editable_grid`.
- **Naming:** `autoname` field (`"naming_series:"` uses a sequence; `"field:company_name"` uses a field value; `"Expression"` uses a formula).
- **Search:** `search_fields`, `title_field`, `show_name_in_global_search`, `in_global_search` on individual fields.

#### `<name>.py` — Controller (lifecycle hooks)
A Python class inheriting `frappe.model.document.Document` (or a subclass like `SellingController`, `TransactionBase`). Override methods to add business logic:

| Method | When it fires |
|--------|--------------|
| `onload` | When the form is opened (read-only extra data, not saved) |
| `validate` | Before every save (new + update) |
| `before_insert` | Just before first DB insert |
| `after_insert` | Just after first DB insert |
| `on_update` | After every save |
| `on_trash` | Before delete |
| `before_submit` / `on_submit` | Submittable docs only |

**Key pattern:** `@frappe.whitelist()` decorator on a method exposes it as an HTTP endpoint callable from the client JS. Example: `Lead.create_prospect_and_contact()` in `lead.py`.

### Module Layout
```
erpnext/crm/
├── __init__.py
├── utils.py                  # Cross-doctype CRM helpers (CRMNote mixin, communication linking)
├── frappe_crm_api.py         # Integration endpoints for Frappe CRM (separate product)
├── doctype/                  # One folder per DocType
│   ├── lead/                 # lead.json + lead.py + lead.js + lead_dashboard.py + mapper.py
│   ├── opportunity/          # opportunity.json + opportunity.py + ...
│   ├── prospect/             # prospect.json + prospect.py
│   ├── contract/             # contract.json + contract.py
│   ├── campaign/             # campaign.json + campaign.py
│   ├── email_campaign/       # email_campaign.json + email_campaign.py
│   ├── crm_settings/         # Singleton settings DocType
│   ├── appointment/          # Booking system
│   └── ... (20+ DocTypes total)
├── report/                   # 9 pre-built reports (Python + JSON query definitions)
├── workspace/                # Desk workspace layout
└── dashboard_chart/          # Dashboard chart definitions
```

---

## 2. Core CRM Data Model

### Entity Map

```
UTM Source / Campaign
        |
        v
      Lead  ─────────────────────────────> Contact (Frappe shared entity)
        |                                      |
        |──> create_prospect() ──> Prospect <──|
        |                              |
        |──> [Opportunity] <───────────|
                  |
                  |──> Quotation (Selling module)
                            |
                            v
                        Sales Order → Customer
```

### Lead (`erpnext/crm/doctype/lead/lead.json`)

The entry point for all inbound potential deals.

**Key fields:**
| Field | Type | Notes |
|-------|------|-------|
| `naming_series` | Select | Auto-generates ID: `CRM-LEAD-.YYYY.-` |
| `lead_name` | Data | Read-only computed full name (`salutation + first + middle + last`) |
| `first_name`, `middle_name`, `last_name` | Data | One of name or `company_name` is mandatory |
| `company_name` | Data | Organization name; mandatory if no personal name |
| `email_id` | Data (Email) | Uniqueness enforced (configurable); `sender_field` for email threading |
| `mobile_no`, `phone`, `whatsapp_no`, `phone_ext` | Data (Phone) | |
| `lead_owner` | Link → User | Defaults to `__user` (the logged-in user) |
| `status` | Select | `Lead / Open / Replied / Opportunity / Quotation / Lost Quotation / Interested / Converted / Do Not Contact` |
| `qualification_status` | Select | `Unqualified / In Process / Qualified` |
| `qualified_by`, `qualified_on` | Link→User, Date | Qualification audit trail |
| `territory` | Link → Territory | Geographic sales territory |
| `industry` | Link → Industry Type | |
| `market_segment` | Link → Market Segment | |
| `no_of_employees` | Select | `1-10 / 11-50 / 51-200 / 201-500 / 501-1000 / 1000+` |
| `annual_revenue` | Currency | |
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` | Link/Data | Full UTM attribution |
| `type` | Select | `Client / Channel Partner / Consultant` |
| `request_type` | Select | `Product Enquiry / Request for Information / Suggestions / Other` |
| `customer` | Link → Customer | Populated if `utm_source == "Existing Customer"` |
| `notes` | Table → CRM Note | Child table of timestamped notes (hidden, rendered via HTML widget) |
| `disabled`, `unsubscribed`, `blog_subscriber` | Check | |

**Controller behavior (`lead.py`):**
- `validate()`: Computes `lead_name`, `title`, `status`. Checks email uniqueness (respects `CRM Settings.allow_lead_duplication_based_on_emails`).
- `before_insert()`: If `CRM Settings.auto_creation_of_contact = true`, auto-creates a linked Contact DocType.
- `on_update()`: Syncs changed fields back to the `Prospect Lead` child row if this lead is inside a Prospect.
- `on_trash()`: Removes links from Prospect; deletes Contact if auto-created.
- `create_prospect_and_contact()` — whitelisted method: allows the UI to manually trigger Prospect and Contact creation.
- `get_notification_email()` — returns `lead_owner`'s email for notification hooks.

### Opportunity (`erpnext/crm/doctype/opportunity/opportunity.json`)

A qualified sales deal with value and probability.

**Key fields:**
| Field | Type | Notes |
|-------|------|-------|
| `naming_series` | Select | `CRM-OPP-.YYYY.-` |
| `opportunity_from` | Link → DocType | Can be `"Lead"` or `"Prospect"` — polymorphic parent |
| `party_name` | Dynamic Link | Links to whatever `opportunity_from` points to |
| `status` | Select | `Open / Quotation / Converted / Lost / Replied / Closed` |
| `sales_stage` | Link → Sales Stage | Configurable pipeline stages (`Prospecting` default) |
| `probability` | Percent | Win probability (default 100%) |
| `opportunity_amount`, `currency`, `conversion_rate`, `base_opportunity_amount` | Currency/Float | Multi-currency deal value |
| `expected_closing` | Date | Close date |
| `opportunity_owner` | Link → User | Deal owner |
| `opportunity_type` | Link → Opportunity Type | Configurable category |
| `items` | Table → Opportunity Item | Line items with qty, rate, UOM; totals auto-calculate |
| `lost_reasons` | Table MultiSelect → Opportunity Lost Reason Detail | Required when status = Lost |
| `competitors` | Table MultiSelect → Competitor Detail | Track competing vendors |
| `first_response_time` | Duration | Auto-calculated; read-only |
| `contact_person`, `contact_email`, `contact_mobile` | Link/Data | Primary contact details |
| `utm_source/medium/campaign/content` | Link/Data | Attribution carry-forward from Lead |
| `notes` | Table → CRM Note | Same pattern as Lead |

**Controller behavior:**
- `after_insert()`: When created from Lead, migrates open ToDos, Events, Comments/Communications to the Opportunity (if `carry_forward_communication_and_comments` enabled).
- `on_update()`: Syncs to the `Prospect Opportunity` child row.
- `map_fields()`: Auto-copies any matching field names from the source Lead/Prospect onto the Opportunity.
- `auto_close_opportunity()` — scheduled daily: closes "Replied" opportunities older than `CRM Settings.close_opportunity_after_days`.

### Prospect (`erpnext/crm/doctype/prospect/prospect.json`)

An **account-level entity** — represents a target company, not a person. Can aggregate multiple Leads and Opportunities under one company name.

**Key fields:**
| Field | Type | Notes |
|-------|------|-------|
| `company_name` | Data | Unique; used as the document name |
| `prospect_owner` | Link → User | Account owner |
| `industry`, `market_segment`, `territory`, `customer_group` | Links | Segmentation |
| `no_of_employees`, `annual_revenue` | Select/Currency | Firmographic data |
| `leads` | Table → Prospect Lead | Child rows: one per linked Lead |
| `opportunities` | Table → Prospect Opportunity | Child rows: one per linked Opportunity |
| `notes` | Table → CRM Note | Notes at account level |

**Prospect Lead (child DocType)** carries: `lead`, `lead_name`, `email`, `mobile_no`, `lead_owner`, `status` — kept in sync with the parent Lead on every Lead save.

**Prospect Opportunity (child DocType)** carries: `opportunity`, `amount`, `stage`, `deal_owner`, `probability`, `expected_closing`, `currency`, `contact_person`.

### Customer (`erpnext/selling/doctype/customer/customer.json`)

Created when an Opportunity converts to a Sale. References back to the originating Lead (`lead_name`), Opportunity (`opportunity_name`), Prospect (`prospect_name`) in the `more_info_tab`.

**Key fields:** `customer_name` (required), `customer_type` (Company/Individual/Partnership), `customer_group`, `territory`, `default_currency`, `payment_terms`, `loyalty_program`, `credit_limits` (child table), `accounts` (child table — per-company receivable accounts), `sales_team` (child table), `portal_users` (child table — for web portal access), `tax_id`, `tax_category`.

The Customer is shared across CRM and Accounting modules; it's the central identity after conversion.

### Contact and Address (Framework-level)

These are Frappe framework DocTypes (not in erpnext/crm/). They use a **Dynamic Link pattern**: a `links` child table on Contact stores `{link_doctype: "Lead", link_name: "CRM-LEAD-2024-00001"}`. This means a single Contact can be associated with multiple Leads, Customers, or Suppliers simultaneously. The same pattern applies to Address.

The `load_address_and_contact(doc)` helper (called in `onload`) fetches and injects linked contacts and addresses into the form's `__onload` payload (client-side only, not persisted).

### Lead → Opportunity → Customer Flow

```
1. Lead created (manually, via web form, or by email-to-lead)
   ├── Auto Contact created (if CRM Settings.auto_creation_of_contact = true)
   └── Optionally grouped under a Prospect (company account)

2. Lead qualified → status = "Opportunity"
   └── Opportunity created (opportunity_from = "Lead", party_name = lead.name)
       ├── Open ToDos/Events migrate from Lead to Opportunity
       ├── Communications optionally carried forward
       └── Items/line items added; value and probability set

3. Opportunity won → Quotation → Sales Order → Customer created
   └── Customer.lead_name = Lead.name (traceability)

4. If lost: status = "Lost" → lost_reasons + competitors recorded
```

---

## 3. Multi-Tenancy / Access Control

### Three Layers of Permission (Frappe framework)

#### Layer 1: Role Permissions (DocType-level CRUD matrix)

Defined in the `permissions[]` array of each DocType JSON. Each entry specifies:
- `role`: A named role (e.g. `"Sales User"`, `"Sales Manager"`, `"System Manager"`)
- Boolean flags: `read`, `write`, `create`, `delete`, `submit`, `cancel`, `amend`, `export`, `import`, `print`, `email`, `report`, `share`
- `permlevel`: Optional integer (0 = default, 1+ = field-level restriction)

**Lead permissions (from lead.json):**
```json
[
  { "role": "Desk User",     "permlevel": 1, "read": 1, "report": 1 },
  { "role": "Sales User",    "create": 1, "write": 1, "read": 1, "email": 1, "print": 1, "report": 1, "share": 1 },
  { "role": "Sales Manager", "create": 1, "write": 1, "read": 1, "delete": 1, "export": 1, "import": 1, ... },
  { "role": "System Manager","create": 1, "write": 1, "read": 1, "email": 1, "print": 1, "report": 1, "share": 1 },
  { "role": "Sales Manager", "permlevel": 1, "read": 1, "report": 1 },
  { "role": "Sales User",    "permlevel": 1, "read": 1, "report": 1 }
]
```

**`permlevel` (field-level permission):** Fields in the JSON can have `"permlevel": 1` set. Only roles with a matching `permlevel: 1` entry in permissions can read those fields. This allows hiding sensitive fields (e.g., financial figures) from junior roles without hiding the whole record.

**Opportunity permissions:** `Sales User` has `create + delete`, which is more permissive than Lead (Sales User cannot delete Leads).

**Contract permissions:** Only `Sales Manager`, `Purchase Manager`, `HR Manager`, `System Manager` can create/submit/amend — no Sales User access at all.

#### Layer 2: User Permissions (Record-level isolation)

This is framework-level. An admin can create a "User Permission" record:
```
User: john@example.com
Allow: Territory = "North India"
```
This restricts John to only see records where `territory = "North India"`. The framework appends this as a WHERE clause automatically. The flag `apply_user_permissions: 1` in report JSON (seen in `lead_owner_efficiency.json`, `campaign_efficiency.json`, `prospects_engaged_but_not_converted.json`) enables this filtering for reports too.

The `ignore_user_permissions: 1` flag on a specific field (seen on `opportunity.amended_from`) exempts that field's link lookup from user permission filters.

#### Layer 3: Sharing

The `share: 1` permission flag enables the "Share" button. Users can explicitly share a record with another user (read/write/share access), bypassing role-level restrictions for that specific record.

### Comparison to AltLeads Project-Scoped RLS

| Dimension | ERPNext/Frappe | AltLeads |
|-----------|---------------|----------|
| **Record isolation mechanism** | User Permissions (app-level WHERE clause injection) | Supabase Row-Level Security (Postgres policy, enforced at DB level) |
| **Scope unit** | Arbitrary DocType field value (Territory, Company, etc.) | Project (all lead data scoped to a `project_id` + role) |
| **Enforcement layer** | Python ORM — can be bypassed by raw SQL or service-role | Postgres enforced — cannot be bypassed even by the app server (unless service role) |
| **Granularity** | Per-field (`permlevel`), per-role, per-user record | Per-row, per-role, per-assignment (`lead_report.user_id`) |
| **Role definition** | Roles are strings; roles are assigned to Users in the DB | Roles are integers in `role_master`; stored in `profiles.role` |
| **Multi-tenant** | Company-level (single Frappe instance = single tenant typically) | Project-level multi-tenant within one Supabase project |
| **Sales manager visibility** | Can see all records in their role scope by default | TEAM_LEAD can see their team; ADMIN sees all |
| **Sharing** | Explicit per-record sharing UI | Planned: collaborators/secondary-owners (ALT- ticket in backlog) |
| **Delete access** | Role-based (Sales Manager can delete Leads) | Admin-only; outreach team cannot delete |

**Key ERPNext insight for AltLeads:** ERPNext's `permlevel` pattern (field-level read restriction at the role layer) is directly applicable to AltLeads' masking requirement (e.g., phone numbers visible to ADMIN/TEAM_LEAD but click-to-reveal for AGENT). Supabase can implement this via column-level security or view-based column masking rather than RLS policies.

---

## 4. Activity / Communication Model

ERPNext uses several framework-level DocTypes to build a rich activity timeline on every CRM record. All of these are Frappe framework DocTypes:

### Communication
The core model. Stored in the `Communication` DocType with fields:
- `reference_doctype`, `reference_name` — links back to the Lead/Opportunity
- `sent_or_received` — `"Sent"` or `"Received"`
- `communication_type` — `"Communication"`, `"Comment"`, `"Automated Message"`
- `timeline_links` — child table of `Communication Link` rows, allowing one Communication to appear in multiple records' timelines (e.g., a Prospect's timeline AND the linked Lead's timeline)

**Auto-linking:** `hooks.py` registers `erpnext.crm.utils.link_communications_with_prospect` on `Communication.after_insert`. This means any email sent/received on a Lead automatically appears on the linked Prospect's timeline too.

**`email_append_to: 1`** in `lead.json` and `opportunity.json` instructs the email-processing daemon to scan incoming emails and append them as Communications to the matching Lead/Opportunity (matched by `sender_field: "email_id"`).

**Timestamp update:** `update_modified_timestamp` hook updates the parent document's `modified` field on any new inbound communication, keeping the list view "last activity" column accurate.

### ToDo (framework)
Used as the **Task** entity in CRM. Fields: `description`, `allocated_to` (Link → User), `date` (due date), `status` (Open/Closed/Cancelled), `reference_type`, `reference_name`.

`utils.py` provides `get_open_todos()` and `get_closed_todos()` helpers. When a Lead converts to an Opportunity, all open ToDos are re-linked (`link_open_tasks()`) to the new Opportunity.

### Event (framework)
Calendar events with `event_participants` child table (`reference_doctype`, `reference_docname`). ERPNext's `crm/utils.py` hooks `Event.after_insert` to also add the Prospect as a participant if the event is on a Lead/Opportunity inside a Prospect (`link_events_with_prospect()`).

The scheduled job `open_leads_opportunities_based_on_todays_event` runs daily and sets Lead/Opportunity status to "Open" if there's an open Event starting today — automating re-engagement reminders.

### Comment / CRM Note
Two separate patterns:
1. **Framework Comment DocType:** `comment_type = "Comment"` — these appear in the timeline, are copyable between documents (`copy_comments()` in `utils.py`).
2. **CRM Note (child table):** A `Table` field (`notes`) on Lead, Opportunity, and Prospect pointing to the `CRM Note` DocType. The `CRMNote` mixin class (`utils.py`) provides `add_note()`, `edit_note()`, `delete_note()` as whitelisted methods. Notes support `@mention` notifications via `notify_mentions()`.

### Notification (framework-level)
Framework sends notifications when:
- A record is shared with a user
- An `@mention` appears in a Comment/Note
- A custom Notification DocType rule matches (see Section 5)
- A ToDo is allocated to a user

`get_notification_email()` is overridden on Lead, Opportunity, and Prospect to return the owner's email for these hooks.

---

## 5. Automation / Workflow Engine

### Workflow DocType (framework-level)
Frappe provides a `Workflow` DocType where you define:
- `document_type`: Which DocType this workflow applies to
- `states[]`: Named states with a `doc_status` (0=Draft, 1=Submitted, 2=Cancelled) and `update_field`/`update_value` to set a field when entering that state
- `transitions[]`: State→state arrows with `action` (button label), `allowed` (role), `condition` (Python expression)

When a Workflow is enabled on a DocType, the form shows an action button bar instead of the standard Save/Submit buttons. The framework enforces that only the `allowed` role can trigger each transition. ERPNext's CRM module does not ship a pre-built Workflow for Lead/Opportunity — the `status` field is a plain Select that controllers update programmatically. Administrators can create Workflows via the Desk UI at any time.

### Notification DocType (framework-level)
`Notification` records let admins define event-driven email/SMS/system-notification rules:
- `document_type`: Which DocType to watch
- `event`: `"New"`, `"Save"`, `"Submit"`, `"Cancel"`, `"Days Before"`, `"Days After"` (date-field-based)
- `conditions[]`: Filter rows to narrow which records trigger
- `recipients[]`: Static emails, `lead_owner` field, or role-based
- `message`: Jinja2 template with access to `doc.*` fields

These are configured via UI, not code. They fire via the scheduler (for date-based) or document hooks (for event-based).

### Server Script (framework-level)
Admins can write Python scripts in the UI that run on DocType events or as API endpoints:
- `script_type`: `"DocType Event"`, `"Scheduler Event"`, `"API"`, `"Permission Query"`, `"Before Insert"`, etc.
- Executed in a sandboxed Python environment
- Replaces the need for code deployment for simple customizations

### hooks.py — Application-Level Hooks (ERPNext-specific)
ERPNext registers CRM-specific automation in `erpnext/hooks.py`:

```python
doc_events = {
    "Communication": {
        "after_insert": [
            "erpnext.crm.utils.link_communications_with_prospect",
            "erpnext.crm.utils.update_modified_timestamp",
        ]
    },
    "Event": {
        "after_insert": "erpnext.crm.utils.link_events_with_prospect"
    },
    "Contact": {
        "validate": ["erpnext.crm.utils.update_lead_phone_numbers"]
    },
    "Email Unsubscribe": {
        "after_insert": "erpnext.crm.doctype.email_campaign.email_campaign.unsubscribe_recipient"
    }
}
```

### Scheduled Jobs
Defined in `hooks.py` under `scheduler_events`:

| Frequency | Function | What it does |
|-----------|----------|-------------|
| `daily_maintenance` | `auto_close_opportunity` | Closes Replied opportunities after N days (configurable) |
| `daily_maintenance` | `update_status_for_contracts` | Marks contracts Active/Inactive/Lapsed based on dates |
| `daily_maintenance` | `send_email_to_leads_or_contacts` | Sends scheduled campaign emails |
| `daily_maintenance` | `set_email_campaign_status` | Updates email campaign status (Scheduled→In Progress→Completed) |
| `daily_maintenance` | `open_leads_opportunities_based_on_todays_event` | Auto-sets status to "Open" when a calendar event starts today |

### Email Campaign Engine
`EmailCampaign` DocType orchestrates drip sequences:
- `campaign_name` → links to a `Campaign` which has `campaign_schedules` (child table of `CampaignEmailSchedule` rows with `send_after_days` and an email template)
- `email_campaign_for`: `Lead`, `Contact`, or `Email Group`
- Status cycle: `Scheduled → In Progress → Completed / Unsubscribed`
- Daily scheduler sends the right email when `start_date + send_after_days == today`
- Unsubscribe: `Email Unsubscribe.after_insert` hook calls `unsubscribe_recipient()` which marks the campaign Unsubscribed and sets `lead.unsubscribed = 1`

---

## 6. Customization

ERPNext/Frappe's customization system is designed to allow deep modification without touching core code. Everything below is applied at runtime and stored in the database, not in source files — allowing upgrades without losing customizations.

### Custom Field
A `Custom Field` record adds a new field to any existing DocType:
- Fields: `dt` (DocType name), `label`, `fieldtype`, `fieldname`, `insert_after`, `options` (for Link/Select), `default`, `mandatory_depends_on`, `permlevel`, etc.
- Applied at startup: Frappe merges Custom Fields into the DocType's `meta` object before building the form or DB schema.
- DB impact: Adding a Custom Field of type `Data`/`Currency` etc. issues an `ALTER TABLE ADD COLUMN` automatically.
- Seen in use: `erpnext/patches/v16_0/migrate_address_contact_custom_fields.py` programmatically creates Custom Fields on `Address` (`tax_category`, `is_your_company_address`) and `Contact` (`is_billing_contact`) via `create_address_and_contact_custom_fields()` — demonstrating that ERPNext itself uses Custom Fields for its own cross-module fields.

### Property Setter
Overrides a property of an existing DocType field without touching the JSON:
- `doc_type`, `field_name`, `property` (e.g., `"reqd"`, `"hidden"`, `"default"`, `"options"`, `"label"`), `value`
- Example: Make a field mandatory that is optional in core, or hide a field for a specific installation.
- Applied at runtime by the meta-layer.

### Customize Form
The Desk UI (`Customize Form` page) is the user-friendly interface to create Custom Fields and Property Setters together. Admins pick a DocType, see all its fields visually, drag to reorder, add new rows, and save — which writes `Custom Field` and `Property Setter` records behind the scenes.

### Child Table DocTypes
When a field has `fieldtype: "Table"`, it references another DocType that acts as a child (rows in a grid). Examples from CRM:
- `CRM Note` — reusable child for notes on Lead, Opportunity, Prospect
- `Opportunity Item` — line items on Opportunity
- `Prospect Lead` — lead rows inside a Prospect
- `Prospect Opportunity` — opportunity rows inside a Prospect
- `Contract Fulfilment Checklist` — checklist items inside Contract
- `Campaign Email Schedule` — drip schedule rows inside Campaign

Child DocTypes can themselves have Custom Fields added, follow the same JSON+Python pattern, and appear as editable grids in the parent form.

### Table MultiSelect
A special field type (seen on Opportunity's `lost_reasons` and `competitors`) that behaves like a tag picker backed by a child table. Renders as a multi-select chip input in the UI but stores rows in a child table. More flexible than a plain `Select` when the options themselves are full DocType records.

### DocType Customization Depth
Because the entire schema is metadata-driven, admins can:
1. Add unlimited custom fields to any DocType via UI
2. Override field properties (labels, defaults, mandatory conditions) without code
3. Add new child table DocTypes and attach them to existing forms
4. Create entirely new DocTypes via UI (code-free entity creation)
5. Add Server Scripts for event logic without deployment

This is the most important pattern for AltLeads to study for its planned custom fields engine (DEC-12).

---

## 7. Full Feature Inventory

### Lead Management
- Lead capture from multiple sources: manual entry, web forms, email-to-lead (inbox parsing via `email_append_to`), API
- Full name decomposition (salutation + first + middle + last) with auto-computed `lead_name`
- Either personal name or company name required (conditional mandatory logic)
- Email uniqueness enforcement (configurable to allow duplicates)
- Qualification workflow: `qualification_status` (Unqualified → In Process → Qualified) with `qualified_by` and `qualified_on` audit
- Lead status lifecycle: Lead → Open → Replied → Opportunity → Quotation → Lost Quotation → Interested → Converted → Do Not Contact
- UTM attribution (source, medium, campaign, content) — full inbound marketing tracking
- Auto-create Contact on lead creation (configurable)
- Phone lookup by partial number (`get_lead_with_phone_number()`)
- Prospect grouping (one company, many contacts/leads)
- Bulk assignment via list view actions
- Import from CSV (`allow_import: 1`)
- Rename/merge (`allow_rename: 1`)

### Opportunity Management
- Polymorphic source: from Lead or from Prospect directly
- Sales stage tracking (configurable `Sales Stage` DocType)
- Win probability percentage
- Multi-currency deal values with automatic exchange rate conversion
- Line items with qty, rate, UOM, and auto-calculated totals
- Expected closing date
- Lost reasons (multi-select from `Opportunity Lost Reason`) + detailed reason text
- Competitor tracking (multi-select from `Competitor` DocType)
- First response time auto-calculation (read-only, auditable)
- Auto-close stale "Replied" opportunities (daily scheduler, configurable days)
- Field auto-mapping from source Lead/Prospect on creation

### Prospect (Account) Management
- Company-level account aggregating multiple Leads and Opportunities
- Territory, industry, market segment, customer group segmentation
- Annual revenue and employee count tracking
- Address and Contact panel (shared framework entities)
- Linked leads sub-grid (live-synced from Lead)
- Linked opportunities sub-grid
- Activity timeline spanning all associated communications/events
- `track_changes: 1` — full change history

### Customer
- Conversion from Opportunity/Lead with traceability (`lead_name`, `opportunity_name`, `prospect_name`)
- Customer group hierarchy
- Per-company receivable accounts (multi-company support)
- Credit limits per currency
- Loyalty program membership and tier tracking
- Sales team assignment with commission rates
- Web portal user management (`portal_users`)
- Tax withholding and category
- Internal customer flag (represents a company entity internally)

### Contract Management
- Party types: Customer, Supplier, Employee
- Digital signature capture (IP address, timestamp, signee name, company signature widget)
- Template-based contract terms (`Contract Template`)
- Fulfilment tracking (`fulfilment_terms` checklist, `fulfilment_status`: N/A / Unfulfilled / Partially Fulfilled / Fulfilled / Lapsed)
- Linked to source document (Quotation, Sales Order, Project, etc.) via Dynamic Link
- Submittable (Draft → Submit → Cancel → Amend) with full amendment history
- Daily scheduler updates status based on start/end dates

### Campaign Management
- Campaign entity with configurable drip schedules (`Campaign Email Schedule` child table)
- `EmailCampaign` for execution targeting Lead, Contact, or Email Group
- Status lifecycle: Scheduled → In Progress → Completed / Unsubscribed
- Daily email dispatch via scheduler
- One-click unsubscribe that marks Lead as unsubscribed
- Naming series support for campaign IDs

### Appointment / Booking
- `Appointment` DocType with `AppointmentBookingSettings` and `AppointmentBookingSlots`
- `AvailabilityOfSlots` query endpoint
- Connects to calendar (Event creation)

### Activity & Communication
- Unified activity timeline per record (Communications, Comments, ToDos, Events)
- Email threading via `email_append_to` (inbound mail auto-attaches to records)
- Open activities HTML widget + all activities HTML widget (separate panels)
- CRM Notes with `@mention` support
- Communication carry-forward when Lead converts to Opportunity (configurable)
- Event and ToDo re-linking on conversion
- Calendar events with multi-participant tracking
- Scheduled event-based status re-opening

### Reporting (9 pre-built reports)
1. `campaign_efficiency` — ROI per campaign
2. `first_response_time_for_opportunity` — SLA tracking
3. `lead_conversion_time` — funnel velocity
4. `lead_details` — detailed lead list
5. `lead_owner_efficiency` — per-rep performance
6. `lost_opportunity` — lost deal analysis
7. `opportunity_summary_by_sales_stage` — pipeline by stage
8. `prospects_engaged_but_not_converted` — unconverted prospect analysis
9. `sales_pipeline_analytics` — aggregate pipeline view

All reports support `apply_user_permissions: 1` for territory/role-filtered views.

### Settings (`CRM Settings`)
- `campaign_naming_by`: Campaign Name or Naming Series
- `allow_lead_duplication_based_on_emails`: toggle duplicate check
- `auto_creation_of_contact`: auto-create Contact on Lead insert
- `close_opportunity_after_days`: auto-close stale replied opps (default: 15)
- `enable_opportunity_creation_from_contact_us`: web form integration toggle
- `default_valid_till`: default Quotation validity in days
- `carry_forward_communication_and_comments`: migration behavior on Lead→Opp conversion
- `update_timestamp_on_new_communication`: keep list-view "last modified" current
- `enable_frappe_crm_data_synchronization`: sync to Frappe CRM (separate product)

---

## 8. UI/UX Patterns

### List View
- Columns controlled by `in_list_view: 1` on field definitions
- Standard filter chips from `in_standard_filter: 1` fields (e.g., Status, Territory, Company Name, Job Title on Lead)
- Search bar uses `search_fields` (e.g., `"lead_name,lead_owner,status"`)
- Global search uses `in_global_search: 1` fields and `show_name_in_global_search`
- Default sort: `creation DESC` (defined in JSON: `"sort_field": "creation", "sort_order": "DESC"`)
- Bulk actions: assign, tag, delete — available in list view select mode
- Saved filters: framework-level "filter presets" stored per user
- Kanban view: available for DocTypes with a `status` or stage field; configurable columns

### Form View
**Layout directives embedded in field_order:**
- `Tab Break` → top-level tab in the form
- `Section Break` → collapsible sections within a tab (with optional `collapsible: 1` and `collapsible_depends_on`)
- `Column Break` → splits the current section into columns

**Tab structure on Lead form:**
1. Main tab (default): naming + name + status + contact info sections + qualification + additional info
2. **Activities tab** (`activities_tab` Tab Break with `show_dashboard` omitted): Open Activities HTML + All Activities HTML
3. **Notes tab**: Notes HTML + Notes table
4. **Connections/Dashboard tab** (`show_dashboard: 1`): Framework renders linked-document counters automatically (e.g., "2 Opportunities", "1 Customer")

**Conditional visibility:** `depends_on: "eval:!doc.__islocal"` hides tabs until the record is saved. `depends_on: "eval:doc.status==='Lost'"` shows Lost Reasons section only when relevant.

**HTML fields:** `address_html`, `contact_html`, `open_activities_html`, `all_activities_html` are placeholder fields rendered by JS using framework APIs — the actual HTML is injected client-side, not stored.

**Dashboard (Connections tab):** Auto-generated by framework from `links` metadata and `timeline_field`. Shows related document counts with drilldown. For Lead: links to Opportunity, Customer, Quotation, etc.

### Form Dashboard (legacy `lead_dashboard.py`)
Python file returning `{"transactions": [...], "internal_links": {...}}` — describes which child/linked DocTypes to show as count badges in the form header bar.

### Report View
- Standard Query Reports: Python returns columns + data arrays; framework renders as grid
- `apply_user_permissions: 1` in report JSON restricts data to the user's permitted scope
- Chart integration available on most reports
- Export to Excel/CSV built-in

### Kanban View
- Framework-level, available on any DocType with a status/stage field
- Card content configurable
- Drag-and-drop changes the status field value and saves

### Filters & Saved Filters
- Filter builder: AND/OR, per-field operators (=, !=, LIKE, Between, Is Set, etc.)
- Quick filters (filter presets) saved per user per DocType
- Reports have `filters[]` defined in JSON for default filter form

---

## 9. What AltLeads Appears to Be MISSING

Comparing ERPNext CRM's feature set against AltLeads' documented capabilities (as of 2026-06-29):

### 1. Prospect / Account Layer
**ERPNext:** `Prospect` DocType aggregates multiple Leads and Opportunities under one company. An account manager can see all contacts and deals for "Acme Corp" in one place.
**AltLeads gap:** Has `company_master` but no account-level grouping that rolls up all leads, interactions, and tasks for a company into a unified view. This is important for B2B outreach where you have multiple contacts at the same target company.

### 2. Deal / Opportunity Pipeline with Value
**ERPNext:** `Opportunity` has `opportunity_amount`, `probability`, `expected_closing`, `sales_stage` — a proper deal pipeline with value-weighted forecasting.
**AltLeads:** In backlog (deals/pipeline noted as "Building next"). Currently no deal entity, no opportunity value, no close date, no win probability. This is the largest functional gap for a sales-facing CRM.

### 3. Competitor Tracking
**ERPNext:** `Competitor` DocType + `competitors` (Table MultiSelect) on Opportunity. Records which vendors were competing on each deal and what was lost to them.
**AltLeads gap:** No competitor tracking at all. Valuable for loss analysis and competitive intelligence.

### 4. Lost Reason Analysis
**ERPNext:** When an Opportunity is marked Lost, `lost_reasons` (multi-select) must be populated. Reports like `lost_opportunity` analyze patterns.
**AltLeads gap:** No structured lost-reason capture. Currently status changes happen without a required reason code — losing valuable signal.

### 5. Contract Management
**ERPNext:** `Contract` DocType with digital signature, fulfilment checklists, status lifecycle, and links to downstream documents (Quotation, Sales Order).
**AltLeads gap:** No contract entity. Relevant for when AltLeads graduates from outreach CRM to full-cycle sales CRM.

### 6. Email Campaign / Drip Sequences
**ERPNext:** `Campaign` + `EmailCampaign` + `CampaignEmailSchedule` child table = configurable drip email sequences targeting Leads, Contacts, or Email Groups, with unsubscribe handling.
**AltLeads gap:** Has outbound call logging but no email drip campaign engine. For outreach teams, this is a significant capability gap. Currently relies on external tools.

### 7. UTM / Attribution Tracking
**ERPNext:** `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` on both Lead and Opportunity. Tracks inbound lead source through to conversion.
**AltLeads gap:** No UTM fields on lead entities. Cannot measure which outreach campaign or channel produced leads.

### 8. Territory Hierarchy
**ERPNext:** `Territory` is a hierarchical DocType (tree). User Permissions can restrict a rep to a territory and all its sub-territories. Reports filter by territory.
**AltLeads gap:** No territory concept. Outreach team assignment is project-based, not geography-based. For field sales expansion, territory management will be needed.

### 9. Scheduled Activity Auto-Re-opening
**ERPNext:** Daily job auto-sets Lead/Opportunity status to "Open" when a calendar Event starts today. This ensures records don't stay in stale statuses when a follow-up meeting is scheduled.
**AltLeads gap:** No such automatic status re-trigger from scheduled activities. Tasks and meetings exist but don't drive status changes automatically.

### 10. First Response Time Tracking
**ERPNext:** `first_response_time` (Duration, read-only, auto-calculated) on Opportunity. Report `first_response_time_for_opportunity` provides SLA analysis.
**AltLeads gap:** No SLA / first response time measurement on lead or opportunity entities.

### 11. Multi-Currency
**ERPNext:** Deal values in local currency with exchange rate conversion to company base currency. Multi-company support in Customer accounting.
**AltLeads gap:** Single-currency assumption throughout. Will matter when dealing with international clients.

### 12. Print / PDF Document Generation
**ERPNext:** Every DocType has `print_hide` field-level flags and a print format system. Contracts, Quotations etc. generate formatted PDFs.
**AltLeads gap:** No structured document/print generation. For sending lead summaries or proposals, this would add value.

### 13. Appointment Booking
**ERPNext:** `Appointment` system with availability slots and booking settings — a lightweight scheduling tool integrated with CRM records.
**AltLeads gap:** Tasks/meetings are logged but there's no external-facing appointment booking widget.

### 14. Qualification Status as a Distinct Field
**ERPNext:** `qualification_status` (Unqualified/In Process/Qualified) is separate from the lead's overall `status` field, with `qualified_by` and `qualified_on` audit.
**AltLeads gap:** Qualification is implicitly tracked via status changes but not with a separate field + auditable who/when metadata. The HungerBox project has domain-specific qualification questions but no generic qualification framework.

### 15. Carry-Forward Communication on Conversion
**ERPNext:** `carry_forward_communication_and_comments` setting migrates all email threads and comments from Lead to Opportunity on conversion.
**AltLeads gap:** Interactions are logged per lead, but if a lead becomes an opportunity in a different context, no explicit carry-forward mechanism exists yet.

---

## 10. Reverse-Engineering Feasibility

### What the Metadata-Driven Approach Means

ERPNext's entire schema, UI layout, and permissions are defined in JSON files that are loaded into a `tabDocType` database table at startup. The framework:
1. Reads the JSON metadata
2. Migrates the DB schema (ALTER TABLE) if columns are missing
3. Generates form HTML from field order + types
4. Enforces permissions from the permissions array
5. Allows Custom Fields/Property Setters to extend any DocType at runtime without code changes

This is a **metadata-as-schema** pattern. The power: any admin can add a field via UI and it immediately appears in the form, DB, API, list view, and exports — no deployment needed.

### What Ports to Supabase (High ROI)

#### 1. Custom Fields Engine (metadata table pattern)
ERPNext's `Custom Field` DocType maps directly to an AltLeads implementation:
```sql
CREATE TABLE custom_field_definition (
  id uuid PRIMARY KEY,
  entity_type text,          -- 'company_master' | 'contact_master' | 'lead_master'
  field_name text,
  field_label text,
  field_type text,           -- 'text' | 'number' | 'date' | 'select' | 'boolean' | 'link'
  options jsonb,             -- for select: {choices: [...]}; for link: {target_table: '...'}
  insert_after text,         -- ordering anchor
  is_required boolean,
  default_value text,
  mandatory_depends_on text  -- client-side expression
);
```
This drives DEC-12 (custom fields). Supabase's `jsonb` column on each entity table can store custom field values without schema migrations:
```sql
ALTER TABLE lead_master ADD COLUMN custom_fields jsonb DEFAULT '{}';
```
The React form layer reads `custom_field_definition` and renders extra inputs dynamically, saving/reading from `custom_fields->>'field_name'`.

#### 2. Property Setter Pattern
AltLeads already has some per-project configuration (`crm_settings` equivalent could be a `project_settings` table). Storing field-level overrides (hidden/required/default per project) in a `field_property_override` table mirrors ERPNext's Property Setter and enables project-specific form customization without code.

#### 3. Activity Timeline Architecture
ERPNext's pattern of a single `Communication` DocType with `reference_doctype + reference_name + timeline_links[]` maps well to AltLeads' `interaction` table. The key lesson: a single activity/communication record can appear in multiple records' timelines via a junction table (`Communication Link`). AltLeads should consider an `interaction_link` junction table (already possible with current schema design).

#### 4. Qualification Status as Separate Field
ERPNext separates `status` from `qualification_status`. AltLeads should add a `qualification_status` enum to `lead_report` alongside the existing status field — with `qualified_by` (FK to profiles) and `qualified_on` (timestamp). This is a one-migration addition with high analytical value.

#### 5. Lost Reason Multi-Select
A `lost_reason` lookup table + `lead_lost_reason` junction table mirrors ERPNext's pattern. Forces structured data on lost leads instead of free-text notes. Simple to implement, high analytical ROI.

#### 6. Opportunity / Deal Entity
ERPNext's Opportunity maps to AltLeads' planned deals/pipeline feature. Key fields to port: `opportunity_amount`, `currency`, `probability`, `expected_closing`, `sales_stage` (FK to a configurable `sales_stage` lookup), `opportunity_owner`. The `sales_stage` DocType (a simple lookup with `stage_name` and optional color) enables a kanban pipeline view. RLS policy: `sales_stage` is not tenant-scoped; deals are scoped by project, same as `lead_report`.

#### 7. Competitor Tracking
Simple `competitor` master table + `lead_competitor` junction = ports directly. Low effort, useful for outreach teams tracking incumbent vendors.

#### 8. UTM Fields
Add `utm_source`, `utm_medium`, `utm_campaign` columns to `lead_master` or `lead_report`. Directly portable, zero framework dependency.

### What Is Framework-Specific (Does NOT Port Directly)

| ERPNext Feature | Why it doesn't directly port |
|-----------------|------------------------------|
| `permlevel` field-level permissions | Frappe framework feature. Supabase equivalent: column-level security (`GRANT SELECT (col1, col2) ON table TO role`) or masking views |
| Workflow DocType (state machine UI) | Frappe's workflow engine is a complete drag-drop UI builder. AltLeads' equivalent is custom automation event spine (planned) — simpler but purpose-built |
| Dynamic Link field type | Frappe pattern for polymorphic foreign keys. Supabase needs explicit nullable FK columns or a junction table approach instead |
| `autoname: "naming_series:"` | Frappe's sequence generator. Supabase uses `gen_random_uuid()` or sequences (`SERIAL`/`BIGSERIAL`) — functionally equivalent but different API |
| Customize Form UI | The Frappe admin UI for schema changes. AltLeads needs to build its own admin UI for custom field management (DEC-12) |
| Print Format engine | Frappe's Jinja2-based PDF generator. AltLeads equivalent: a report builder or export template system (not yet planned) |
| Scheduler via Python | Frappe's built-in cron. AltLeads equivalent: Supabase pg_cron + Postgres functions, or edge functions on schedule |
| Email threading via `email_append_to` | Frappe's email daemon parsing incoming mail. AltLeads would need a Postmark/SendGrid inbound webhook handler |

### Overall Verdict

**Feasibility: HIGH** for the core patterns; **MEDIUM** for the automation/workflow engine.

The metadata-driven schema (Custom Fields + Property Setters) is the most directly applicable pattern — it's database-agnostic and maps cleanly onto Supabase Postgres. ERPNext proves this pattern scales to 50+ entities in production. AltLeads' DEC-12 custom fields engine should follow this design.

The activity/communication timeline architecture (single entity, polymorphic links, carry-forward on conversion) is the second most valuable pattern — it makes the timeline feel integrated rather than fragmented across entity types.

### Highest-ROI Ideas to Implement from This Study

1. **`custom_field_definition` table + `custom_fields jsonb` column on entities** — DEC-12; unlocks per-client field customization without migrations. ERPNext proves this scales.
2. **`qualification_status` + `qualified_by` + `qualified_on` on lead_report** — One migration; enables qualification funnel analytics.
3. **`lost_reason` lookup + `lead_lost_reason` junction** — One migration; transforms lost-lead data from noise to signal.
4. **`sales_stage` lookup table + `opportunity` entity** — Foundation for the planned deals/pipeline feature. ERPNext's Opportunity JSON is the reference schema.
5. **`interaction_link` junction for cross-entity activity** — Allows one interaction to appear in both company and contact timelines (ERPNext's `Communication Link` pattern).
6. **`utm_source` / `utm_medium` / `utm_campaign` on lead_master** — One migration; enables attribution reporting with zero framework overhead.
7. **Competitor tracking (`competitor` table + `lead_competitor` junction)** — Low effort; high value for competitive intelligence in outreach.
