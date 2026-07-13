# Odoo CRM — Architecture Teardown
> Reference blueprint for AltLeads product team. Source: `E:\reference code for crm\odoo` (read-only study; LGPL).
> Written: 2026-06-29

---

## 1. Stack & Code Organization

**Language / framework:** Python 3 (ORM layer `odoo.models`), XML for views and security rules, CSV for access-control lists. Front-end is Owl.js (Odoo's own JS component framework). No TypeScript.

**Server:** Python WSGI server + PostgreSQL. Cron jobs run inside the server process. Email is handled via `fetchmail` (IMAP polling) and `ir.mail_server` (SMTP out).

**Addon (module) architecture:** Every feature lives in a self-contained addon directory under `addons/`. An addon declares its dependencies in `__manifest__.py` and ships:
- `models/` — Python ORM model classes
- `views/` — XML view definitions (form, list, kanban, search)
- `security/` — `ir.model.access.csv` (table-level CRUD) + `*_security.xml` (row-level `ir.rule`)
- `data/` — seed/demo XML
- `controllers/` — HTTP routes

**CRM-relevant addons:**

| Addon | Purpose |
|---|---|
| `addons/crm/` | Leads, opportunities, stages, teams, scoring |
| `addons/mail/` | Thread, followers, activities, chatter, push notifications |
| `addons/sales_team/` | `crm.team` base model, salesperson groups |
| `addons/base_automation/` | Automated actions / workflow engine |
| `addons/contacts/` | Thin UI layer over `res.partner` |
| `odoo/addons/base/` | `res.partner`, `res.users`, `res.company`, `ir.rule`, `res.groups` |

**Inheritance model:** Python multiple-inheritance mixins. `crm.lead` inherits from `mail.thread.cc`, `mail.thread.blacklist`, `mail.thread.phone`, `mail.activity.mixin`, `utm.mixin`, `format.address.mixin`, `mail.tracking.duration.mixin`. This is class-level mixin chaining — every mixin adds fields and methods to the same PostgreSQL table.

---

## 2. Core CRM Data Model

### `res.partner` — Unified Company + Contact
File: `odoo/addons/base/models/res_partner.py`

The single most architecturally distinctive choice in Odoo: **one table holds both companies and individual contacts**.

Key fields:
- `is_company: Boolean` — True = company record, False = person
- `parent_id: Many2one('res.partner')` — links a contact to its employer company
- `child_ids: One2many('res.partner', 'parent_id')` — reverse: company → contacts
- `type: Selection['contact','invoice','delivery','other']` — sub-address types
- `name`, `email`, `phone`, `website`, `street`, `city`, `country_id`
- `vat` (Tax ID), `company_registry` (legal registration number)
- `industry_id`, `category_id` (hierarchical tags via `parent_path`)
- `user_id` — Salesperson on the partner record itself
- `active` — soft-delete (default filter excludes `active=False`)

There is no separate "Company" table. A partner with `is_company=True` IS the company; contacts hang off it via `parent_id`. This collapses the company↔contact relationship into a self-referential tree. Address subtypes (invoice, delivery) are also rows in the same table with a different `type` value.

### `crm.lead` — Lead and Opportunity (same table)
File: `addons/crm/models/crm_lead.py`

One table serves both leads (pre-qualification) and opportunities (sales pipeline). The `type` field (`lead` | `opportunity`) is the discriminator. Conversion (`convert_opportunity()`) flips `type` and optionally creates or links a `res.partner`.

Key fields:
- `name` — opportunity name
- `type: Selection['lead','opportunity']` — lifecycle discriminator
- `stage_id: Many2one('crm.stage')` — current pipeline stage
- `user_id` — Salesperson (assigned agent)
- `team_id: Many2one('crm.team')` — Sales Team
- `partner_id: Many2one('res.partner')` — linked contact (optional on leads)
- `partner_name`, `contact_name`, `email_from`, `phone` — denormalized copies from partner (exist before partner is created)
- `priority: Selection['0','1','2','3']` — Low / Medium / High / Very High (star rating)
- `won_status: Selection['won','lost','pending']` — computed from stage + user action
- `lost_reason_id: Many2one('crm.lost.reason')`
- `probability`, `automated_probability` — ML-computed win probability (Predictive Lead Scoring)
- `expected_revenue`, `recurring_revenue`, `recurring_plan`
- `date_open` (assignment date), `date_deadline`, `date_closed`, `date_conversion`
- `day_open`, `day_close` — computed cycle-time metrics in days
- `date_last_stage_update` — stage-time tracking
- `tag_ids: Many2many('crm.tag')`
- `lead_properties: Properties` — JSON custom fields per team (`team_id.lead_properties_definition`)
- `campaign_id`, `medium_id`, `source_id` — UTM attribution
- `calendar_event_ids: One2many('calendar.event')` — linked meetings
- `duplicate_lead_ids` — computed potential duplicates

Performance indexes declared in model (notable):
```python
_user_id_team_id_type_index = models.Index("(user_id, team_id, type)")
_create_date_team_id_idx    = models.Index("(create_date, team_id)")
_default_order_idx          = models.Index('(priority DESC, id DESC) WHERE active IS TRUE')
```

### `crm.stage`
File: `addons/crm/models/crm_stage.py`

Fields: `name`, `sequence`, `is_won: Boolean`, `fold: Boolean`, `rotting_threshold_days`, `requirements` (tooltip text), `team_ids: Many2many('crm.team')` — stages can be global or scoped to specific teams.

Setting `is_won=True` triggers a bulk update of all leads in that stage to `probability=100`.

### `crm.team` (Sales Team)
File: `addons/crm/models/crm_team.py`

- `use_leads: Boolean`, `use_opportunities: Boolean` — feature flags per team
- `alias_id` — inbound email alias; emails to this address auto-create leads
- `assignment_domain` — filter domain for auto-lead-assignment
- `assignment_max` — monthly capacity across all members
- `lead_properties_definition: PropertiesDefinition` — custom field schema for leads in this team
- `crm_team_member_ids` → `crm.team.member` (with `assignment_max` per member, `lead_month_count`)

### Relationship map
```
res.partner (is_company=True)
  └─ child_ids → res.partner (is_company=False, parent_id=company)

crm.lead
  ├─ partner_id → res.partner (contact)
  ├─ stage_id → crm.stage
  ├─ team_id → crm.team
  ├─ user_id → res.users (salesperson)
  ├─ tag_ids → crm.tag []
  ├─ calendar_event_ids → calendar.event []
  ├─ [via mail.activity.mixin] → mail.activity []
  └─ [via mail.thread] → mail.message [], mail.followers []
```

### Lead → Opportunity lifecycle
1. Inbound email or manual creation → `type='lead'`
2. Qualification → `convert_opportunity()` → `type='opportunity'`, partner created or linked
3. Move through `crm.stage` (kanban drag or form save)
4. Won: `action_set_won()` → `won_status='won'`, `probability=100`, `date_closed`
5. Lost: `action_set_lost()` → `won_status='lost'`, requires `lost_reason_id`, `probability=0`
6. Merge: `merge_opportunity()` — moves messages, attachments, activities, calendar events, and recent followers to winning record; archives duplicates

---

## 3. Multi-tenancy / Access Control

Odoo uses a two-layer model: **table-level ACL** (`ir.model.access`) + **row-level record rules** (`ir.rule`).

### Groups (`res.groups`)
Defined in `addons/sales_team/` and `addons/crm/security/crm_security.xml`:
- `sales_team.group_sale_salesman` — basic salesperson; sees own leads only
- `sales_team.group_sale_salesman_all_leads` — sees all leads across teams
- `sales_team.group_sale_manager` — manages teams, activity plans, contacts menu

### Record Rules (`ir.rule`) — from `addons/crm/security/crm_security.xml`

```xml
<!-- Salesperson sees only own leads OR unassigned -->
crm_rule_personal_lead:
  domain: ['|', ('user_id','=',user.id), ('user_id','=',False)]
  groups: [group_sale_salesman]

<!-- Override: manager sees all -->
crm_rule_all_lead:
  domain: [(1,'=',1)]
  groups: [group_sale_salesman_all_leads]

<!-- Multi-company isolation (global — all users) -->
crm_lead_company_rule:
  domain: [('company_id', 'in', company_ids + [False])]
```

Rules within a group are OR'd; rules across groups are AND'd. The multi-company rule applies globally regardless of role.

### Multi-company
`crm.lead.company_id` links a lead to one `res.company`. Users can belong to multiple companies (`res.users.company_ids`). The company rule confines each user to records in their allowed companies. This is Odoo's native multi-tenant mechanism: a single database, company-scoped via `company_id` + a blanket `ir.rule`.

### vs AltLeads
AltLeads uses **Supabase RLS policies on `lead_report.project_id`** as the tenant boundary — functionally equivalent to Odoo's company scoping but enforced at the Postgres layer rather than the Python ORM layer. Odoo's group hierarchy (salesman → all-leads → manager) maps loosely to AltLeads roles (AGENT → TEAM_LEAD → ADMIN). Our approach is architecturally cleaner because RLS cannot be bypassed by application code errors.

---

## 4. Activity / Communication Model

This is one of Odoo's strongest architectural choices — everything communication-related is wired through `mail.thread`.

### `mail.thread` (abstract mixin)
File: `addons/mail/models/mail_thread.py`

Any model that inherits `mail.thread` gets:
- A **chatter** UI widget showing all messages, log notes, field-change history, and activity due dates in a unified timeline
- `message_ids: One2many('mail.message')` — full conversation history
- `message_follower_ids: One2many('mail.followers')` — subscription list
- Inbound email routing: emails to the record's alias auto-post as messages
- Field-change tracking: fields decorated with `tracking=True` emit `mail.tracking.value` rows on every write
- `_track_duration_field` — one field whose time-in-value is tracked (used on `crm.lead` for stage duration analytics)

Key class options:
- `_mail_flat_thread` — if True, all messages are attached to the first message (flat thread); if False, threaded replies are supported
- `_mail_post_access` — minimum access right required to post a message (default: `write`)

### `mail.followers` — Secondary Watchers (= Collaborators)
File: `addons/mail/models/mail_followers.py`

```python
class MailFollowers(models.Model):
    _name = 'mail.followers'
    res_model: Char          # model name e.g. 'crm.lead'
    res_id: Integer          # record ID
    partner_id: Many2one('res.partner')
    subtype_ids: Many2many('mail.message.subtype')  # which event types they watch
```

Any `res.partner` can follow any record of any model — fully polymorphic. Followers receive in-app and email notifications for only the message subtypes they subscribed to (e.g. only stage changes, not log notes). When leads are merged, followers active in the last 30 days are migrated to the winning record (`_merge_followers()`). Auto-follow rules: creating a record auto-subscribes the author; being assigned auto-subscribes the salesperson.

**vs AltLeads collaborators (planned):** The right design is a junction table `(model, record_id, user_id, notification_mask)`. Odoo's subtype granularity — subscribe to only specific event types — is worth replicating at design time even if the first version just notifies on everything.

### `mail.activity` — Scheduled Activities (= Task Hub)
File: `addons/mail/models/mail_activity.py`

```python
class MailActivity(models.Model):
    _name = 'mail.activity'
    res_model_id: Many2one('ir.model')   # polymorphic: which model
    res_id: Integer                       # which record
    activity_type_id: Many2one('mail.activity.type')
    summary: Char
    note: Html
    date_deadline: Date
    feedback: Text               # filled when marking done
    user_id: Many2one('res.users')    # assigned to
    state: computed['overdue','today','planned','done']
    attachment_ids: Many2many('ir.attachment')
    previous_activity_type_id    # what came before
    recommended_activity_type_id # next suggested action (chaining)
    automated: Boolean           # created by automation rule vs manually
```

Activities are **pre-completion tasks**: they appear on calendars, lists, and kanban cards. When marked done, the row is **deleted** and a `mail.message` (chatter post) is written with the feedback — preserving outcome history without leaving a stale "done task" pile. Activity types are configurable (`mail.activity.type`) and support chaining: completing type A prompts scheduling type B.

**vs AltLeads task hub:** AltLeads's `task` table is the same concept. Key differences:
- Odoo activities are polymorphic (any model, same table) — AltLeads tasks are lead-only
- Odoo posts a chatter message on completion with the feedback text — AltLeads should write an `interaction` record when a task is closed
- Odoo has chaining (done → suggest next) — AltLeads does not yet

### `mail.message` — Chatter
Stores every message, note, system log, and tracking event. Key fields: `body`, `message_type` (`email`|`comment`|`notification`|`auto_comment`), `subtype_id`, `author_id`, `partner_ids` (recipients), `attachment_ids`, `tracking_value_ids` (field-change records). All in one flat table keyed by `(model, res_id)`.

### Mail routing
Inbound email → `fetchmail` → `mail.thread.message_process()` → matches on `Message-ID` header or alias → creates/updates record → posts as message. Outbound: `mail.mail` → `ir.mail_server`. Each `crm.team` can have an email alias — emails to `sales@company.com` auto-create leads assigned to that team.

---

## 5. Automation / Workflow Engine

File: `addons/base_automation/models/base_automation.py`

`base.automation` ("Automated Actions") is Odoo's no-code workflow engine. Rules fire on triggers, check conditions, and execute one or more server actions.

### Triggers (from source)
```
on_create             — record created
on_write              — record updated (deprecated; prefer on_create_or_write)
on_create_or_write    — created or updated
on_stage_set          — specific stage selected
on_user_set           — salesperson assigned
on_tag_set            — tag added
on_state_set          — state field changes to specific value
on_priority_set       — priority star changed
on_archive            — record archived
on_unarchive          — record unarchived
on_unlink             — record deleted
on_change             — UI field change (client-side only, not saved)
on_time               — date field passes threshold (cron-checked)
on_time_created       — N time after creation date
on_time_updated       — N time after last update date
on_message_received   — inbound message arrives on thread
on_message_sent       — outbound message sent from thread
on_webhook            — HTTP POST to generated URL
```

### Rule structure
- `model_id` — which model this rule fires on
- `trigger` — one of the above
- `filter_domain` — condition that must be true at fire time
- `filter_pre_domain` — condition that must be true BEFORE the change (for write triggers; enables "if it was X and becomes Y" logic)
- `action_server_ids: One2many('ir.actions.server')` — one or more actions to execute
- `trg_date_id`, `trg_date_range`, `trg_date_range_mode`, `trg_date_range_type` — for time-based triggers (e.g. "3 days after `date_deadline`")
- `trg_date_calendar_id` — use working calendar for date math
- `trg_field_ref` — for `on_stage_set` / `on_state_set` (which stage/state value)
- `active: Boolean`, `last_run: Datetime`

### Server actions (`ir.actions.server`)
The actions that rules execute can: update field values on the record, create new records, send emails from a template, send SMS, add/remove followers, trigger another webhook, run arbitrary Python code (`code_type='code'`), or chain multiple actions.

### Practical CRM automations possible out-of-the-box
- Auto-assign leads to salesperson by round-robin or domain filter
- Send email to customer when stage changes to "Proposal Sent"
- Escalate rotting opportunities (time-based trigger N days after last update)
- Schedule a follow-up activity N days after lead creation
- Post a note when probability crosses a threshold

---

## 6. Customization (Custom Fields / Studio)

### `lead_properties` — dynamic custom fields per team
`crm.lead` has a `lead_properties: Properties` field whose schema is defined by `team_id.lead_properties_definition: PropertiesDefinition`. Each team defines its own set of extra fields (text, number, date, selection, boolean, many2one, tags) in the UI. Values are stored as JSON in a single column — **no schema migrations required per field addition**. The definition lives on the team record; values live on each lead.

This is the "light customization" path available in the community edition without Studio.

### Odoo Studio (`web_studio` addon — Enterprise)
Studio is a paid add-on not present in the community edition studied here. It provides a drag-and-drop form builder. Under the hood it creates `ir.model.fields` records (which do create real DB columns via `ALTER TABLE`) and `ir.ui.view` overrides (XML stored in the DB). Changes export as a module.

### `ir.model.fields` (all editions)
Technical users can add fields through Settings > Technical > Fields. These create real columns but skip the module/migration lifecycle — not recommended for production.

---

## 7. Full Feature Inventory

**Lead & Opportunity management**
- Single table for both; `type` field discriminates
- Lead → Opportunity conversion with partner creation/linking, team and stage assignment
- Won / Lost actions with configurable reason tracking
- Predictive Lead Scoring (ML probability; auto-updated on stage, team, and history changes)
- Merge duplicates: messages, attachments, activities, calendar events, followers all migrate to winner
- Recycle bin via `active=False` (soft-delete; restore via unarchive)
- Automatic duplicate detection via `email_domain_criterion`, `phone_sanitized`, `partner_id`
- Rotting detection: per-stage configurable threshold + visual highlighting
- Priority stars (4 levels: Low/Medium/High/Very High)
- Stage duration analytics (`_track_duration_field`)
- Cycle-time metrics: `day_open` (create → assign), `day_close` (create → won/lost)

**Pipeline & Stages**
- Customizable stages per sales team (stages can be global or team-scoped)
- Kanban + list + form views
- Stage-level fold (hides empty columns in kanban)
- Stage requirements tooltip (internal checklist)
- Stage changes update probability automatically
- Scheduled auto-assignment cron (round-robin by member capacity)

**Sales Teams**
- Multiple teams; each has its own stage set, email alias, member list
- Per-member monthly assignment capacity (`assignment_max`)
- Rule-based auto lead assignment
- Team-level custom field schema

**Partners (Companies + Contacts)**
- Unified company + contact model (`res.partner`, `is_company` + `parent_id`)
- Multiple address types per company (contacts, invoicing, delivery, other)
- Hierarchical tags (`res.partner.category` with `parent_path`)
- Industry classification (`res.partner.industry`)
- Phone / email quality validation (`phone_state`, `email_state`)
- Blacklist (`mail.blacklist`) — blocks all outgoing marketing emails to an address
- Geo coordinates (`partner_latitude`, `partner_longitude`)
- VAT / Tax ID with per-country format validation
- Language preference (per-contact email localization)
- Bank accounts (`res.partner.bank`)

**Communication / Chatter**
- Full email thread on every record (inbound + outbound)
- Internal log notes (not sent to customer)
- Field-change tracking in chatter ("Stage changed from X to Y at HH:MM")
- Email CC (`mail.thread.cc` mixin)
- Inbound email alias per team or per record
- Scheduled messages (`mail.scheduled_message`)
- Canned responses (`mail.canned_response`)
- Link previews in messages
- Message reactions (emoji)
- Real-time: WebSocket push + web push (PWA) notifications
- Blacklist management from thread

**Followers / Collaborators**
- Any partner can follow any record (polymorphic across all models)
- Per-subtype subscription (follow only specific event types)
- Auto-follow on create, on reply, on assignment
- Follower migration on merge
- Activity plan access managers (Enterprise)

**Activities (Scheduled Tasks)**
- Polymorphic: same `mail.activity` table works for leads, orders, invoices, etc.
- Configurable activity types with icons and default deadlines
- Activity chaining: completing one type suggests/creates the next
- "Done" action writes feedback to chatter and deletes the activity row
- Activity plan templates: multi-step sequences launched in one click (Enterprise)
- Calendar integration (`calendar.event` linked to opportunity)
- Overdue / Today / Planned color states on kanban cards and list rows
- "My Activities" global cross-model view for each user

**Automation**
- 14+ trigger types: lifecycle events, time delays, webhooks, messages
- Pre/post-condition filters (before-update and after-update domains)
- Multiple server actions per rule (chain actions)
- Working-calendar-aware date math for time triggers
- In-app configurable, no code required

**Reporting**
- Pipeline funnel by stage, team, salesperson
- Win/loss analysis with reason breakdown
- Activity report (`crm.activity.report` — denormalized read model)
- Expected revenue forecast by month
- Recurring revenue (MRR) tracking
- Conversion rate, days-to-close, days-to-assign computed metrics
- Cohort / pivot / graph / list views in the UI

**Customization**
- Dynamic custom fields per team (JSON Properties column, zero migrations)
- Studio (Enterprise): drag-and-drop form builder, real column creation
- All views overridable via `ir.ui.view` XML inheritance
- All row-level access via `ir.rule` domain expressions

**Integrations (built-in)**
- Email (IMAP fetch + SMTP send)
- Calendar (CalDAV)
- VoIP/telephony (Asterisk / SIP)
- IAP cloud enrichment / lead generation service
- UTM campaign tracking (campaign, source, medium on every lead)
- WhatsApp (Enterprise)
- Live Chat → lead conversion

---

## 8. UI/UX Patterns

**Views:** Rendered from XML definitions by the Owl.js framework. Four standard view types:
- **Kanban** — pipeline board grouped by `stage_id`; cards show partner name, email, expected revenue, priority stars, activity status dot; drag-to-move changes stage; quick-create inline form in each column
- **List** — tabular with sortable columns; inline editing; bulk actions (assign, tag, archive, delete); optional columns
- **Form** — full record edit; smart buttons at top (count of meetings, activities, duplicates); chatter/activity widget on right side; two-column layout for fields
- **Search** — filter panel with grouped filter facets ("My Leads", "Won", "Rotting"), group-by options, favorite saved searches

**Activity status indicator:** A colored dot (green=today, orange=overdue, grey=planned) on every record that has an open activity; clicking the dot opens an activity popover with mark-done, reschedule, and create-next actions.

**Stage conversion UX:** "Mark Won" calls `action_set_won_rainbowman()` — triggers a rainbow/confetti animation as a reward signal.

**Chatter widget:** Right-aligned panel in form view; scrollable thread of messages, log notes, field-change entries, and activity status; follower avatars at top with manage-followers popover; Send Message / Log Note / Schedule Activity tabs.

**Quick-create in kanban:** Click "+" in a stage column → inline mini-form (just name + a few fields) to create a new opportunity without opening the full form.

**Activity plan (Enterprise):** Multi-step launcher — pick a plan template and Odoo creates the full sequence of activities in one action.

**Mobile:** The Owl.js framework renders the same view XML responsively. No separate CRM mobile app; the responsive web UI is the mobile experience.

---

## 9. What AltLeads Appears to Be Missing

Concrete gaps identified from the Odoo source:

1. **Follower / subscriber model with notification scoping** — AltLeads has no collaborator/watcher system. Odoo's `mail.followers` with `subtype_ids` (subscribe to stage-change notifications but not log notes, for example) is the right pattern. The polymorphic design (same table works for any model) is worth copying.

2. **Activity chaining (done → suggest next)** — Completing an activity in Odoo prompts scheduling the next based on `chaining_type` on the activity type. AltLeads's task hub has no next-step suggestion after closing a task, meaning follow-through depends entirely on agent memory.

3. **Stage-time tracking and cycle-time metrics** — Odoo tracks `date_last_stage_update` and derives `day_open`, `day_close`, and time-in-stage. AltLeads has no cycle-time instrumentation. Without this, bottleneck reporting is impossible.

4. **Rotting / stagnation detection** — Per-stage configurable threshold (N days without update → highlight red in kanban/list). AltLeads has no inactivity alerting on individual lead records.

5. **Won / Lost disposition with reason codes** — AltLeads has no won/lost workflow. No `won_status`, no `lost_reason_id`, no `date_closed`. This means there is no way to distinguish an active pipeline lead from one that was informally dropped.

6. **Inbound email → record creation** — Odoo's team email alias (e.g. `sales@company.com` → auto-create lead) is a full inbound channel. AltLeads has no inbound email routing.

7. **Custom field schema per project / team** — Odoo's `lead_properties` (JSON Properties column, schema defined per team) allows extra fields with zero DB migrations. AltLeads has no per-project custom field support (e.g. HungerBox-specific DNC, metro, feasibility fields require workarounds).

8. **Merge with full history transfer** — Odoo migrates messages, attachments, activities, calendar events, and followers during merge. AltLeads has merge/dedup for contacts and companies but does not transfer interaction history.

9. **Activity plan templates** — Predefined multi-step activity sequences (e.g. "Outreach Sequence" = call day 1 + email day 3 + follow-up call day 7). AltLeads has no templated task sequences.

10. **Pipeline and funnel reporting** — Odoo has expected revenue forecasting, MRR, days-to-close, win rate, and stage funnel reports built-in. AltLeads reporting is limited to the activity/call log; there is no pipeline health view.

11. **UTM attribution** — `campaign_id`, `medium_id`, `source_id` on every lead. AltLeads has no lead source attribution tracking — no way to know which campaigns generate the best pipeline.

12. **Automated lead assignment** — Rule-based round-robin or domain-filtered auto-assignment to salespeople with per-member monthly capacity limits. AltLeads has manual assignment only (TEAM_LEAD manually reassigns).

---

## 10. Reverse-Engineering Feasibility

### What ports cleanly to TS / React / Supabase + RLS

| Odoo concept | AltLeads translation | Effort |
|---|---|---|
| `mail.followers` (polymorphic, subtype-scoped) | `lead_follower (lead_id, user_id, notification_mask)` + RLS policy | Low — 1 migration + UI chip |
| Activity chaining (`recommended_activity_type_id`) | Add `next_task_type_id FK` on `task_type` table; prompt after mark-done | Low |
| `date_last_stage_update`, `day_open`, `day_close` | `status_entered_at TIMESTAMPTZ` on `lead_report`; compute deltas in SQL | Low |
| Rotting threshold per stage | `status_rotting_days INT` on `project_status` table; nightly cron flags leads | Medium |
| Won/Lost disposition | `won_status ENUM`, `lost_reason_id FK`, `date_closed` on `lead_report` | Medium |
| `lost_reason` table | New table; admin-configurable | Low |
| Custom fields per project | `project_field_schema JSONB` on `project_master`; `lead_properties JSONB` on `lead_report` | Medium |
| Merge with history transfer | `UPDATE interaction SET lead_id = winner_id` on merge; merge infra already exists | Low |
| Activity plan templates | `task_plan` + `task_plan_step` tables; create N tasks from template | Medium |
| UTM attribution | `source`, `medium`, `campaign` columns on `lead_master` | Low |
| Stage funnel / cycle-time reports | SQL views or Supabase RPCs; potential materialized view | Medium |
| Auto-assignment with capacity | Supabase Edge Function or cron; `assignment_capacity INT` on `profiles` | High |

### What is Odoo-specific — do not attempt to port

- **Python ORM mixin chain (`_inherit = [...]`)** — Odoo's customization surface is the ORM class system. AltLeads extends via DB migrations and TypeScript types. The mixin pattern is irrelevant to our stack.
- **XML view override system (`ir.ui.view` inheritance)** — Odoo lets addons surgically modify any view via XML paths. We use React components; customization means editing components or toggling feature flags.
- **`ir.rule` domain expressions evaluated in Python** — Our Postgres RLS policies are the equivalent and are architecturally stronger (enforced at DB layer, cannot be bypassed by app code errors). No porting needed.
- **Odoo Studio drag-and-drop form builder** — A multi-month product in itself. The JSON Properties column pattern (for custom fields per project) gives 80% of the value with 5% of the effort.
- **IAP cloud enrichment** — Odoo's proprietary pay-per-use enrichment. Use Apollo.io MCP (already integrated) for lead enrichment.
- **Owl.js / XML view engine** — Their custom JS framework. Irrelevant; we use React.
- **Predictive Lead Scoring (IAP ML service)** — Requires training data volume we don't have yet. Punt until Phase 5 AI.

### Overall verdict

AltLeads's core architecture (Supabase RLS + PostgREST + React) is cleaner and more maintainable than Odoo's Python ORM + XML stack for our use case. We are not missing anything that is hard to build — we are missing features that are **straightforward to build** but haven't been prioritized yet.

The five highest-ROI items from Odoo to implement next, in order:

1. **Won/Lost + `date_closed` + `lost_reason`** — Without this, there is no pipeline visibility, no conversion rate, no reason analysis. One sprint. Foundational for any sales reporting.

2. **Follower / collaborator model** — Already on backlog. The `mail.followers` design (polymorphic, subtype-scoped) is the right target. Enables visibility sharing without full reassignment.

3. **Stage-time tracking + rotting alerts** — `status_entered_at` column + `rotting_days` per status + nightly flag. Agents self-manage without daily manager check-ins. Low DB cost, high behavioral impact.

4. **Activity chaining (done → prompt next)** — After marking a task/call done, prompt "schedule follow-up?" with pre-filled type and date. Dramatically increases follow-through. Small UI addition on top of existing task hub.

5. **JSON custom fields per project** — One `JSONB` column + a project-level schema definition table. Immediately unblocks HungerBox-specific data capture (DNC, feasibility, metro) without table migrations per client. Required before the CRM can scale to a second project with different data requirements.
