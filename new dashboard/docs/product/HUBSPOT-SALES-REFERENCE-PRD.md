# HubSpot Sales CRM — Reference PRD for Amplior CRM

> **Purpose:** A two-part reference document for the Amplior CRM build.
> Part A is a faithful description of how HubSpot's Sales CRM actually works — written for a
> non-technical product owner. Part B adapts it to Amplior's rules (per-project ownership, dedup,
> masked visibility). Read in sequence; Part B only makes sense after Part A.
>
> *Researched from HubSpot Knowledge Base (knowledge.hubspot.com) and HubSpot Developer Docs
> (developers.hubspot.com). Last updated: 2026-06-15.*

---

# PART A — How HubSpot's Sales CRM Works

## A1. The Three Core Objects

HubSpot's Sales CRM is built on three main objects (think of an "object" as a type of record):

| Object | What it represents | Plain-language analogy |
|---|---|---|
| **Company** | A business or organisation | An account card in a Rolodex |
| **Contact** | A person at (or connected to) a company | A business card |
| **Deal** | A sales opportunity / transaction in progress | A sales proposal or ticket |

Every piece of sales data lives inside one of these three. They are linked to each other and to
activities (calls, tasks, notes, emails, meetings).

Sources:
- [Understand HubSpot CRM objects](https://knowledge.hubspot.com/records/understand-objects)
- [Manage your CRM database](https://knowledge.hubspot.com/get-started/manage-your-crm-database)

---

## A2. Company — Data Model (Key Properties)

When you open any company record, HubSpot stores and shows these default fields (you can add more):

### Identity & Basic Info
| Property | What it stores |
|---|---|
| Company name | The legal or trading name |
| Company domain name | The website domain (e.g. `tatamotors.com`) — used for dedup |
| Website URL | Full URL |
| Phone number | Main switchboard |
| Industry | ~150 pre-set options (e.g. Manufacturing, Retail, SaaS) |
| Industry group | Secondary classification |
| Description | A free-text summary of the company |

### Firmographics (size / financials)
| Property | What it stores |
|---|---|
| Number of employees | Headcount |
| Employee range | A range bucket (e.g. 51–200) |
| Annual revenue | Self-reported or enriched revenue |
| Total revenue | Sum of all closed deals in HubSpot |
| Recent deal amount | Value of the most recently closed deal |
| Recent deal close date | Date of the most recent closed deal |

### Location
| Property | What it stores |
|---|---|
| Street address, City, State/Region, Postal code, Country/Region | Physical address |

### Ownership & Lifecycle
| Property | What it stores |
|---|---|
| **Owner** | The HubSpot user responsible for this company (one global owner) |
| Lifecycle stage | Where the company is in the marketing/sales process |
| Create date | Auto-set when record was created |
| Last activity date | Auto-updated whenever an activity is logged |
| Last modified date | Auto-updated whenever any field changes |
| Last contacted | Most recent logged call or email |

### Social
| Property | What it stores |
|---|---|
| LinkedIn company page | URL |
| Twitter / Facebook | Handles and follower counts |

### Relationship counts (auto-calculated by HubSpot)
| Property | What it stores |
|---|---|
| Number of associated contacts | Count of linked contacts |
| Number of associated deals | Count of all linked deals |
| Number of open deals | Count of in-progress deals only |

Source: [HubSpot's default company properties](https://knowledge.hubspot.com/properties/hubspot-crm-default-company-properties)

---

## A3. Contact — Data Model (Key Properties)

### Identity
| Property | What it stores |
|---|---|
| First name / Last name | Full name |
| Email address | Primary email (used for dedup) |
| Phone number | Direct line |
| Mobile phone number | Mobile |
| Job title | Role at their company |
| Company name | Text field (separate from the Company object link) |
| LinkedIn URL | Profile URL |

### Professional context
| Property | What it stores |
|---|---|
| Industry | Industry of the contact's employer |
| Annual revenue | Revenue of their employer |
| Number of employees | Employer size |
| Employment role / Seniority / Sub-role | Enriched role classification |

### Sales & Marketing status
| Property | What it stores |
|---|---|
| **Lifecycle stage** | Where the contact sits (Subscriber → Lead → Marketing Qualified Lead → Sales Qualified Lead → Opportunity → Customer → Evangelist) |
| **Lead status** | Finer-grained sales status (New, Open, In Progress, Open Deal, Unqualified, Attempted to Contact, Connected, Bad Timing) |
| **Contact owner** | The HubSpot user responsible (one global owner) |
| HubSpot team | Auto-set to the owner's main team |
| Lead response time | How long it took to first respond |

### Activity tracking (auto-calculated)
| Property | What it stores |
|---|---|
| Last activity date | Most recent logged engagement |
| Last contacted | Most recent call or email |
| Recent sales email open date | Last time a sales email was opened |
| Number of sales activities | Count of all logged activities |

### Location
| Property | What it stores |
|---|---|
| City, State/Region, Postal code, Country/Region, Time zone | Address and timezone |

Source: [HubSpot's default contact properties](https://knowledge.hubspot.com/properties/hubspots-default-contact-properties)

---

## A4. Deal — Data Model (Key Properties)

### Core
| Property | What it stores |
|---|---|
| **Deal name** | The title of the opportunity |
| Deal description | Brief free-text summary |
| **Deal owner** | The user responsible (one global owner) |
| Deal collaborator | Additional users involved |
| Deal type | New Business or Existing Business |

### Financial
| Property | What it stores |
|---|---|
| **Amount** | Total deal value |
| Currency | Currency (if multi-currency enabled) |
| Weighted amount | Amount × stage probability |
| Forecast amount | Amount × custom forecast probability |
| ARR / MRR / TCV | Recurring revenue fields (Sales Hub Pro+) |

### Pipeline & Stage
| Property | What it stores |
|---|---|
| **Pipeline** | Which pipeline the deal is in |
| **Deal stage** | Current stage within that pipeline |
| **Close date** | Expected or actual close date |
| Date entered current stage | Auto-set when stage changed |
| Deal probability | % likelihood of closing (set per stage) |

### Activity tracking (auto-calculated)
| Property | What it stores |
|---|---|
| Last activity date | Most recent engagement |
| Last contacted | Most recent call or email |
| Next activity date | Next scheduled activity |
| Number of sales activities | Count of logged activities |
| Number of times contacted | Total interactions |
| Number of associated contacts | Contacts linked to this deal |

Source: [HubSpot's default deal properties](https://knowledge.hubspot.com/properties/hubspots-default-deal-properties)

---

## A5. Associations — How Companies, Contacts, and Deals Link

Associations are the "wires" that connect records. They are always **two-way** — if you link
Contact A to Company B, Company B's record also shows Contact A.

### The association map

```
COMPANY ──< CONTACTS (many contacts per company; one contact can be at multiple companies)
   │
   └──< DEALS (many deals per company)
            │
            └──< CONTACTS (contacts on that deal — e.g. the buyer, the influencer)
```

A Deal can be linked to:
- One or more Companies
- One or more Contacts

A Contact can be linked to:
- Multiple Companies (with one marked "Primary")
- Multiple Deals

### Primary Company
When a contact is first linked to a company, that company becomes the **primary company**. Activities
logged against the contact (calls, emails) are automatically also associated with the primary company.
Only one primary company is allowed per contact at a time.

### Association Labels (Pro/Enterprise)
Labels add a descriptive role to a link. Examples:
- A Contact linked to a Deal might be labeled "Decision Maker" or "Influencer"
- A Contact linked to another Contact might be labeled "Manager" or "Colleague"

Labels are optional and cosmetic — they don't change permissions, just add context.

Source: [Associate records](https://knowledge.hubspot.com/records/associate-records)

---

## A6. Record Page Layout

Every record (Company, Contact, or Deal) opens as a three-column page. The layout is the same
pattern for all three; the content adapts to the object type.

```
┌─────────────────────────────────────────────────────────────────────┐
│  RECORD HEADER: Name / Logo / Quick actions (Call, Email, Task)     │
├──────────────┬──────────────────────────────┬───────────────────────┤
│ LEFT SIDEBAR │ MIDDLE COLUMN (main area)    │ RIGHT SIDEBAR         │
│              │                              │                       │
│ [Actions]    │ [Overview tab]               │ [Associated records]  │
│ Follow/      │  ↳ recent activity card      │   ↳ Companies card    │
│  Unfollow    │  ↳ key properties summary    │   ↳ Deals card        │
│              │  ↳ associations snapshot     │   ↳ Contacts card     │
│ [Properties  │                              │   ↳ Tickets card      │
│  card #1]    │ [Activity tab]               │                       │
│  name/domain │  ↳ timeline (newest first):  │ [Attachments]         │
│  industry    │     - Emails                 │                       │
│  city etc.   │     - Calls                  │ [Line Items] (deals)  │
│              │     - Notes                  │                       │
│ [Properties  │     - Meetings               │ [Quotes] (deals)      │
│  card #2]    │     - Tasks                  │                       │
│  owner/      │     - Form submissions       │ [Playbooks] (Pro+)    │
│  lifecycle   │  ↳ filter by type/date       │                       │
│              │                              │ [Salesforce sync]     │
│ [More cards  │ [Custom tabs] (optional)     │  (if integrated)      │
│  as needed]  │                              │                       │
└──────────────┴──────────────────────────────┴───────────────────────┘
```

- **Left sidebar**: Property cards. Editable inline. You can collapse, reorder, and customize which
  properties show in each card.
- **Middle / Overview tab**: A summary card — recent/upcoming activities, a property snapshot,
  and an associations snapshot. Good for a 5-second read.
- **Middle / Activities tab**: The full chronological timeline of everything logged against this
  record. Can be filtered by activity type (only calls, only notes, etc.) or date range.
- **Right sidebar**: Cards for associated records (click any to open a mini-preview). Also shows
  attachments, line items for deals, and optional tool integrations.

Sources:
- [Understand and use the record page layout](https://knowledge.hubspot.com/records/work-with-records)
- [Use the updated record default layout](https://knowledge.hubspot.com/records/understand-the-default-record-layout)

---

## A7. Deal Pipelines & Stages

### How pipelines work
A **pipeline** defines a sequence of stages a deal moves through. You can think of it as a
Kanban board column-set for one type of sale.

HubSpot ships one default pipeline called **Sales Pipeline** with 7 stages:

| Stage | Default probability |
|---|---|
| Appointment Scheduled | 20% |
| Qualified to Buy | 40% |
| Presentation Scheduled | 60% |
| Decision Maker Bought-In | 80% |
| Contract Sent | 90% |
| Closed Won | 100% |
| Closed Lost | 0% |

The **probability** is used for weighted forecasting (weighted amount = deal amount × probability).
When you move a deal to "Closed Won," its close date is auto-set to today if not already set.

### Multiple pipelines
You can create additional pipelines when the stages meaningfully differ. Examples:
- A "Direct Sales" pipeline and a "Channel Partner" pipeline
- A "New Business" pipeline and a "Renewal" pipeline

Each pipeline has its own stage list and probabilities. A deal belongs to exactly one pipeline at
a time. Moving a deal between pipelines is allowed.

### Stage properties
Every stage change is timestamped. HubSpot auto-creates calculated properties:
- `Date entered [stage]` — when the deal entered this stage
- `Date exited [stage]` — when the deal left this stage
- `Time in [stage]` — total cumulative time spent

These are useful for pipeline velocity analysis.

### Conditional stage logic
When moving a deal to a specific stage, you can require or suggest certain fields be filled in
(e.g. "Amount must be filled before moving to Contract Sent"). This is called conditional stage logic.

Source: [Set up and manage object pipelines](https://knowledge.hubspot.com/deals/set-up-and-customize-your-deal-pipelines-and-deal-stages)

---

## A8. Activities / Engagements

Activities are logged interactions. They appear in the **activity timeline** on any record
(Company, Contact, or Deal). Every activity is associated with a record; it can also be
associated with multiple records at once (e.g. a call logged on a contact is also visible on
that contact's primary company).

### Activity types

| Type | What it is | Key fields |
|---|---|---|
| **Call** | A phone call, logged or made via HubSpot Calling | Direction (Inbound/Outbound), Duration, Outcome, Notes |
| **Email** | An email sent or logged | Subject, Body, From/To, Tracked opens/clicks |
| **Meeting** | A scheduled or completed meeting | Title, Date/time, Attendees, Outcome, Internal notes |
| **Note** | A free-text internal note | Body (rich text) |
| **Task** | A to-do or follow-up item | Title, Due date/time, Type (Call/Email/To-do), Status, Priority |
| **SMS / LinkedIn / WhatsApp** | Messages via those channels (via integrations) | Channel, Direction, Body |
| **Postal mail** | Log of a physical mail sent | Body/description |

### Call outcome options (default)
When logging a call, the agent selects an outcome:
- Busy
- Connected
- Left live message
- Left voicemail
- No answer
- Wrong number

Admins can customise these options (add, rename, remove).

### The activity timeline
- Activities are shown **newest first** (reverse chronological), with upcoming tasks pinned at top.
- You can filter by activity type or date range.
- Clicking any activity expands it to show full detail.
- You can comment on, edit, or delete activities.
- Every activity shows who logged it and when.

Sources:
- [Create or log activities on a record](https://knowledge.hubspot.com/records/manually-log-activities-on-records)
- [HubSpot's default activity properties](https://knowledge.hubspot.com/properties/hubspots-default-activity-properties)
- [Filter activity index pages and record timelines](https://knowledge.hubspot.com/records/filter-activities-on-a-record-timeline)

---

## A9. Ownership & Teams

### The "Owner" concept
Every Company, Contact, and Deal has a single **Owner** field — one HubSpot user who is
responsible for that record. The owner is:
- **Global** — the same user owns the record across the entire account (there is no per-project
  or per-division owner in standard HubSpot).
- Set manually when creating/editing a record, or via workflow automation.
- The owner automatically gets the record's main team set to their main team.

### Teams
Teams are groups of users. A user has one **main team** and can be on extra (secondary) teams.

**How teams affect visibility:**
When an admin sets record permissions to "Their team's [object]," users can access:
- Records they own themselves, AND
- Records owned by any member of their main team

A user on multiple teams can see records owned by any user on any of their teams.

**Permission levels (per object, per user):**
- **All** — see and manage every record of that type
- **Their team's** — see/manage records owned by their team
- **Their own** — see/manage only their personally owned records
- **Unassigned** — see/manage records with no owner assigned

### Sharing beyond ownership
A record can be "shared" with specific users or teams, giving them access without making them
the owner. This is useful for collaboration (e.g. a deal is owned by Alice but shared with Bob
for input).

### Key limitation
HubSpot's owner concept is **global** — one user per record, organisation-wide. There is no native
mechanism where the same Company is owned by User A in the context of Deal Set 1 and by User B in
the context of Deal Set 2. You can work around this with custom properties, but it is not built in.

Sources:
- [HubSpot user permissions guide](https://knowledge.hubspot.com/user-management/hubspot-user-permissions-guide)
- [Create and manage teams](https://knowledge.hubspot.com/user-management/create-and-manage-teams)
- [Assign access to records](https://knowledge.hubspot.com/records/assign-access-to-records)
- [Share records with users and teams](https://knowledge.hubspot.com/records/share-records)

---

## A10. Lists / Views / Segmentation

HubSpot provides two tools for working a list of records:

### Saved Views (on the index/list page)
A **view** is a saved filter + column configuration on any object's list page (e.g. the Contacts
list, the Companies list, the Deals board/list).

- Filter by any property (owner, lifecycle stage, city, date range, etc.)
- Save the filter as a named view and return to it any time
- Share views with teammates
- Every HubSpot user can create personal views; admins can create shared team views
- Quick filters (pinned dropdowns) can be customised per object

**Practical use:** An agent working a call list would create a view filtered to:
"Contacts → Owner = me → Lead status = New → City = Mumbai" and save it as "My Mumbai Calls."

### Segments (formerly Lists)
A **segment** is more powerful than a view and works on Contacts, Companies, and a few other objects.

Two types:
- **Active segment** — updates automatically as records meet or stop meeting the criteria.
  (E.g. "all contacts who opened an email in the last 7 days")
- **Static segment** — a snapshot; does not update automatically.
  (E.g. "the 50 contacts we decided to call this week")

Segments can filter by cross-object criteria (e.g. "contacts whose associated company is in
the SaaS industry and who have an open deal worth > ₹5L").

Sources:
- [View and filter records](https://knowledge.hubspot.com/records/view-and-filter-records)
- [Understand ways to group records in HubSpot](https://knowledge.hubspot.com/segments/what-is-the-difference-between-saved-filters-smart-lists-and-static-lists)
- [Create segments](https://knowledge.hubspot.com/segments/create-active-or-static-lists)

---

---

# PART B — Amplior Modified Version

> This section adapts the HubSpot model to Amplior's specific rules. Read alongside
> `COMPANIES-CONTACTS-BLUEPRINT.md` (the data-model spec). Where Amplior diverges from
> HubSpot, the divergence is called out explicitly so the product owner understands what
> we are building vs. what HubSpot does natively.

---

## B1. The Core Difference from HubSpot (Read This First)

**HubSpot's owner is global.** One user owns a Company record across the entire organisation.
If Tata Motors is owned by Adarsh, everyone sees Adarsh as the owner. There is no mechanism
for Ankit to simultaneously own the same Tata Motors record in a different context.

**Amplior's owner is per-project.** The same Company can be pursued by two different agents in
two different projects, each having full ownership within their project. HubSpot has no
equivalent concept — this is the most fundamental divergence, and it shapes every other design
decision below.

```
HubSpot model:
  COMPANY: Tata Motors  →  Owner: Adarsh  (global, one owner)

Amplior model:
  COMPANY: Tata Motors  →  Owner in Hungerbox project: Adarsh
                         →  Owner in AP Securitas project: Ankit
                         →  (no owner in projects they're not pursued in)
```

---

## B2. Object Map: HubSpot → Amplior

| HubSpot concept | Amplior equivalent | Key difference |
|---|---|---|
| Company object | `company_master` table | Amplior already has this; dedup by domain/CIN |
| Contact object | `contact_master` table (new) | New table; dedup by LinkedIn/email |
| Deal object | `lead_master` table | Amplior calls these "leads" not "deals"; can duplicate |
| Owner (global) | `company_project_owner` table (new) | Per-project, not global |
| Pipeline | Project context | Each project is effectively a "pipeline context" |
| Deal stage | Lead status in `lead_master` | Existing field; adapt to pipeline stages |
| Activity timeline | Activities / Meetings linked to lead/company | Extend to company + contact level |
| Team | User hierarchy (`manager_id` on `user_master`) | Amplior uses a reporting tree, not flat teams |
| Saved view | Filtered list page with saved filters | Same concept; build into each module list page |
| Segment (list) | Call list / filtered contact list | Contacts module serves this need |
| Association: Contact ↔ Company | `contact_master.company_id` FK | One primary company per contact (can expand later) |
| Association: Deal ↔ Company | `lead_master.company_id` FK | Exists already |
| Association: Deal ↔ Contact | `lead_master.contact_id` FK (new) | Add this FK — gaps in current model |
| Association labels | Not needed in v1 | Defer |

---

## B3. Company — Amplior Data Model

### What stays from HubSpot
The fields HubSpot uses that we directly reuse (from `company_master`):

| Field | HubSpot equivalent | Status |
|---|---|---|
| company_name | Company name | Exists |
| company_web_url / domain_clean | Company domain name | Exists; add `domain_clean` derived field |
| cin_number | (custom — India-specific) | Exists |
| linkedin_url | LinkedIn company page | Exists |
| email | Company email | Exists |
| industry | Industry | Exists |
| city_id → city name | City | Exists (FK) |

### What Amplior ADDS vs. HubSpot
| Addition | Why |
|---|---|
| `domain_clean` (derived field) | Dedup key: strip https/www/path/lowercase from `company_web_url` |
| `company_project_owner` table | **The main addition**: stores (company_id, project_id, owner_user_id). This is what HubSpot cannot do natively |

### What Amplior does NOT implement (v1)
- Annual revenue, employee count, LinkedIn follower counts (nice to have; not needed for v1)
- Lifecycle stage (not how Amplior's business works — project ownership replaces this)
- Social handles other than LinkedIn

### Deduplication rule
A Company is considered a duplicate if any of these match (cleaned):
1. `domain_clean` matches (strip `https://`, `www.`, path; lowercase; e.g. `tatamotors.com`)
2. `cin_number` matches

If a match is found at create-time, the system blocks duplicate creation and says:
"This company already exists. Open it and claim ownership for your project instead."

---

## B4. Contact — Amplior Data Model

### What Amplior builds (new `contact_master` table)

| Field | HubSpot equivalent | Notes |
|---|---|---|
| full_name | First name + Last name | Combined single field (split later if needed) |
| designation | Job title | |
| email | Email address | Dedup key #2 |
| mobile | Phone / Mobile | Masked from non-owners |
| linkedin_url | LinkedIn URL | Dedup key #1 |
| linkedin_clean | (derived) | Cleaned profile slug (e.g. `/in/john-doe`) |
| company_id | Primary company association | FK to `company_master` |
| city_id | City | FK |
| audit columns | Create date, last modified | Standard |

### What Amplior does differently from HubSpot

| HubSpot | Amplior |
|---|---|
| Contact owner = one global user | Contact owner = inherited from `company_project_owner` for the current project (i.e. whoever owns the company in that project also "owns" the contact in that project) |
| Lifecycle stage on the contact | Not used; deal/lead status captures this |
| Lead status on the contact | Captured at the deal/lead level, not the contact |
| Contact can have multiple companies (many-to-many) | v1: one primary company per contact; expand later |

### Deduplication rule
A Contact is considered a duplicate if any of these match (cleaned):
1. `linkedin_clean` matches (cleaned LinkedIn profile slug)
2. `email` matches

### Visibility rules (what differs from HubSpot)
HubSpot by default shows all contact fields to all users with access. Amplior masks:

| Viewer | Name + Title + City | Phone / Email / LinkedIn | Edit |
|---|---|---|---|
| Anyone in the org | Visible | HIDDEN ("contact owned by…") | No |
| Owner of the company in the relevant project | Visible | Visible | Yes |
| Owner's manager / Admin (their downline) | Visible | Visible | Yes |

This masking is enforced at the database layer (Row Level Security) so a UI bug cannot expose data.

---

## B5. Deal (Lead) — Amplior Data Model

### The key Amplior rule: Deals are scoped per project
In HubSpot a Deal exists independently — it is associated with a company and contacts, but it
is not "inside" a project. In Amplior, every Deal (lead) belongs to exactly one Project. You
cannot have a deal outside a project.

| Field | HubSpot equivalent | Status |
|---|---|---|
| lead_name / title | Deal name | Exists in `lead_master` |
| project_id | (no HubSpot equivalent — this is the Amplior addition) | Exists |
| company_id | Associated company | Exists |
| contact_id | Associated contact (primary) | ADD this FK |
| lead_status / stage | Deal stage | Adapt to pipeline stages (see B6) |
| amount / deal_value | Amount | Add if not present |
| close_date | Close date | Add if not present |
| owner_user_id | Deal owner | Inherit from company_project_owner for this project |

### What Amplior does differently from HubSpot

| HubSpot | Amplior |
|---|---|
| Deals can duplicate (same company, multiple deals = normal) | Same — leads/deals may duplicate in Amplior |
| Deal owner is set independently on the deal | Deal owner = owner of the company for this project (inherited); can be overridden on the deal if needed |
| Deal is not inside a project | Deal MUST belong to a project |
| Multiple pipelines are optional | Each project is effectively its own pipeline context |

---

## B6. Pipelines & Stages — Amplior Equivalent

HubSpot's pipeline = a defined sequence of stages a deal moves through.

In Amplior, the "pipeline" concept maps to:
- **The project** (the context that defines which deals you're working)
- **Lead status / stages** within that project

### Proposed Amplior deal stages (adapt HubSpot's default)

| # | Amplior stage | HubSpot equivalent | Notes |
|---|---|---|---|
| 1 | Cold / New | Appointment Scheduled | Deal just created; no contact made yet |
| 2 | Contacted | (between stages) | First call made; reached the prospect |
| 3 | Interested | Qualified to Buy | Prospect has shown interest |
| 4 | Demo / Pitch Scheduled | Presentation Scheduled | Formal meeting booked |
| 5 | Proposal Sent | Contract Sent | Offer/quote sent |
| 6 | Negotiation | Decision Maker Bought-In | In active negotiation |
| 7 | Closed Won | Closed Won | |
| 8 | Closed Lost | Closed Lost | |
| 9 | Not Interested | (no direct equivalent) | Amplior-specific — prospect disqualified |
| 10 | Call Back Later | (no direct equivalent) | Amplior-specific — timing mismatch |

> **Open question #8 (new):** Confirm or revise this stage list with the sales team. The disposition
> outcomes in B7 feed into stage progression (e.g. "Interested" call outcome → move to stage 3).

---

## B7. Activities / Engagements — Amplior Equivalent

Amplior already has Meetings. The goal is to extend activity logging to Companies and Contacts
too (not just Leads/Deals).

### Activity types to implement

| Type | HubSpot equivalent | Amplior status / notes |
|---|---|---|
| Call log (with disposition) | Call engagement | KEY — this is the telecalling flow. Log outcome, notes. |
| Meeting | Meeting engagement | Already exists in Amplior; extend to link company + contact |
| Note | Note engagement | Add to company/contact/deal records |
| Task | Task engagement | Useful for follow-ups; schedule for v2 |
| Email log | Email engagement | Manual log only (v1); no send-from-CRM needed |

### Call disposition options (Amplior)
These adapt HubSpot's call outcomes to Amplior's telecalling process:

| Amplior outcome | HubSpot equivalent | Next action |
|---|---|---|
| Connected — Interested | Connected | Move deal to "Interested" stage; create deal if none exists |
| Connected — Not Interested | Connected | Mark deal Closed Lost / Not Interested |
| Connected — Call Back | Connected | Schedule follow-up task |
| Left Voicemail | Left voicemail | Schedule follow-up |
| No Answer | No answer | Schedule retry |
| Busy | Busy | Schedule retry |
| Wrong Number | Wrong number | Flag contact for correction |
| Gatekeeper (did not reach contact) | (Amplior-specific) | Note; schedule retry |

> **Open question #7 (from blueprint):** Confirm final disposition options with the sales team.

### The Amplior activity timeline
Same concept as HubSpot — a reverse-chronological feed on the record page showing all logged
activities. In Amplior this should appear on:
- The Company record page (all activities across all contacts and deals for that company, in the
  project context)
- The Contact record page (activities logged on that contact)
- The Deal/Lead record page (activities on that specific deal)

---

## B8. Ownership & Teams — Amplior Model

### The fundamental re-design vs. HubSpot

HubSpot: one global owner per record.
Amplior: owner is a (company × project) pair, stored in `company_project_owner`.

```
company_project_owner table:
  company_id  |  project_id  |  owner_user_id
  ---------------------+----------+------------------
  Tata Motors |  Hungerbox   |  Adarsh
  Tata Motors |  AP Securitas|  Ankit
  Wipro       |  Hungerbox   |  Rahul
```

A company has no "owner" if it is not in any project. There is no global owner field on the
company record.

### Visibility hierarchy (replaces HubSpot teams)

Instead of HubSpot's flat teams, Amplior uses a **reporting tree** (parent-child manager structure):

```
Admin / MD
  └── Regional Manager (e.g. North India)
        ├── Team Lead
        │     ├── Agent A  ← owns company in project P1
        │     └── Agent B  ← owns company in project P2
        └── Agent C
```

Implemented via `manager_id` on `user_master` (each user points to their manager).

**Access rules:**
- A user sees full details (including masked contact fields) for all records they own in their projects.
- A manager sees full details for records owned by anyone in their downline (recursive: they see their
  direct reports' records, and their direct reports' reports, etc.).
- Admin sees everything.
- Everyone else sees company/contact name + city only (no phone/email/LinkedIn).

**Contrast with HubSpot:**
HubSpot teams are flat peer groups — if you're on a team, you see your teammates' records. Amplior
uses a hierarchy where visibility flows upward (managers see down, but peers don't see each other's
masked details unless they're in the same project with the same company).

> **Open question #1 (from blueprint):** Provide the org chart / reporting structure so `manager_id`
> can be populated.

---

## B9. Record Page Layout — Amplior Adaptation

Following the HubSpot three-column layout, here is how each Amplior record page should look:

### Company Record Page

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Tata Motors                    [Project selector ▾: Hungerbox]          │
│  tatamotors.com • Manufacturing • Mumbai                                 │
├─────────────────┬────────────────────────────────┬───────────────────────┤
│ LEFT SIDEBAR    │ MIDDLE COLUMN                  │ RIGHT SIDEBAR         │
│                 │                                │                       │
│ [Core Info]     │ [CONTACTS tab]                 │ [Deals in project]    │
│  domain         │  Listed by city/region         │  deal name, stage,    │
│  CIN            │  All: name + title (visible)   │  amount, close date   │
│  industry       │  Details: only if owner/mgr    │                       │
│  city           │  [+ Add Contact button]        │ [Activity summary]    │
│                 │                                │  last contacted,      │
│ [Ownership]     │ [ACTIVITY tab]                 │  next task            │
│  Owner for      │  Timeline of all calls/        │                       │
│  this project:  │  meetings/notes on this        │ [Other projects]      │
│  Adarsh         │  company (across contacts +    │  this company         │
│  [Claim/Change] │  deals, in this project)       │  appears in           │
│                 │                                │                       │
│ [Actions]       │ [DEALS tab]                    │                       │
│  Add contact    │  All deals for this company    │                       │
│  Create deal    │  in the selected project       │                       │
│  Log activity   │                                │                       │
└─────────────────┴────────────────────────────────┴───────────────────────┘
```

**Key Amplior-only element: the Project Selector**
A dropdown at the top of the Company record page switches the "project context." Changing the
project changes: which owner is shown, which deals are shown, and which activity timeline is shown.
Default = the user's active/assigned project.

### Contact Record Page

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Ravi Kumar — VP Procurement                                             │
│  Tata Motors • Mumbai                                                    │
├─────────────────┬────────────────────────────────┬───────────────────────┤
│ LEFT SIDEBAR    │ MIDDLE COLUMN                  │ RIGHT SIDEBAR         │
│                 │                                │                       │
│ [Contact info]  │ [CALL & DISPOSITION panel]     │ [Company]             │
│  name           │  [Log call] button → modal:    │  Tata Motors link     │
│  title          │    outcome dropdown            │                       │
│  company link   │    notes text box              │ [Associated Deals]    │
│  city           │    [Save]                      │  deals where this     │
│                 │                                │  contact appears      │
│ [Details]       │ [ACTIVITY tab]                 │                       │
│  phone ▓▓▓▓     │  Timeline:                     │ [Ownership]           │
│  email ▓▓▓▓     │   - Calls (with outcome)       │  Owner in [project]:  │
│  LinkedIn ▓▓▓▓  │   - Meetings                   │  Adarsh               │
│  (masked if     │   - Notes                      │                       │
│   not owner)    │                                │                       │
│                 │ [NOTES tab]                    │                       │
│ [Actions]       │  Quick note editor             │                       │
│  Log call       │                                │                       │
│  Schedule meeting│                               │                       │
└─────────────────┴────────────────────────────────┴───────────────────────┘
```

**Key Amplior element: the Call & Disposition panel**
This is a first-class panel on the Contact record (not buried in a timeline). The agent selects
an outcome, writes call notes, and saves — all in one action. Busy/no-answer automatically suggests
a follow-up task.

### Deal (Lead) Record Page

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Deal: Tata Motors — Canteen Automation (Hungerbox)                      │
│  Stage: [Interested ▸▸▸▸▸▸▸▸▸] • Owner: Adarsh • ₹4.5L • Close: Sep 26 │
├─────────────────┬────────────────────────────────┬───────────────────────┤
│ LEFT SIDEBAR    │ MIDDLE COLUMN                  │ RIGHT SIDEBAR         │
│                 │                                │                       │
│ [Deal info]     │ [ACTIVITY tab]                 │ [Company]             │
│  name           │  Timeline: calls, meetings,    │  Tata Motors          │
│  project        │  emails, notes on this deal    │                       │
│  stage          │                                │ [Contacts on deal]    │
│  amount         │ [NOTES tab]                    │  Ravi Kumar (primary) │
│  close date     │  Quick note editor             │  [+ Add contact]      │
│  owner          │                                │                       │
│                 │ [STAGE HISTORY]                │ [Related Meetings]    │
│ [Actions]       │  when each stage was           │                       │
│  Move stage     │  entered/exited                │                       │
│  Log call       │                                │                       │
│  Schedule meeting│                               │                       │
│  Add contact    │                                │                       │
└─────────────────┴────────────────────────────────┴───────────────────────┘
```

---

## B10. Lists / Views — Amplior Equivalent

### Saved views per module
Every list page in Amplior (Companies, Contacts, Deals) should support:

| Feature | HubSpot equivalent | Amplior notes |
|---|---|---|
| Filter by project | (no equivalent — project doesn't exist in HubSpot) | Project filter is always available; defaults to user's project |
| Filter by owner | Filter by owner | Only shows users the current user can see (their downline + self) |
| Filter by city/region | Filter by city | |
| Filter by industry | Filter by industry | |
| Filter by call disposition / last contacted | Filter by activity date / lead status | |
| Save a filter as a named view | Save view | Personal views and shared (admin-shared) views |
| Column selector | Column selector | |

### The Contacts call list (Amplior-specific)
The Contacts module list page is the primary **call list** for telecalling agents. A typical agent
workflow:

1. Open Contacts module
2. Project = Hungerbox (auto-set from their assignment)
3. Filter: "No call in last 7 days" + "Disposition ≠ Not Interested" + "City = Delhi"
4. Save as "Delhi call list - this week"
5. Work down the list: click a contact → log call disposition → next

This replicates HubSpot's saved view concept but is purpose-built for the telecalling workflow.

---

## B11. Deduplication — Amplior Rules (Summary)

| Object | Dedup keys | HubSpot equivalent |
|---|---|---|
| Company | `domain_clean` OR `cin_number` | HubSpot uses domain for auto-dedup |
| Contact | `linkedin_clean` OR `email` | HubSpot uses email for dedup |
| Deal / Lead | No dedup — duplicates allowed | Same in HubSpot |

**Dedup enforcement:**
1. At create time: system checks and blocks; shows "record already exists" with a link to open it.
2. At DB level: unique indexes on each key (where not null) as a hard safety net.

HubSpot also does automatic domain-based dedup for companies. Amplior should do the same, plus
CIN as a secondary India-specific key that HubSpot doesn't have.

---

## B12. What Amplior ADDS That HubSpot Doesn't Have

| Amplior feature | Description | Why HubSpot doesn't have it |
|---|---|---|
| `company_project_owner` table | Per-project ownership of a company | HubSpot only supports one global owner |
| Project selector on records | Switch project context on a Company record to see different owner + deals | No project concept in HubSpot |
| CIN-based dedup | Indian company registration number as a dedup key | India-specific; HubSpot doesn't have this |
| Per-project contact masking | Contact phone/email hidden from non-owners, visible to owner + downline | HubSpot's visibility is team-based, not per-project |
| Manager downline visibility | Managers see their reports' data recursively | HubSpot uses flat teams; no hierarchy |
| Call disposition as primary UI | Disposition panel is front and centre on the Contact page | HubSpot logs calls in the timeline; no dedicated disposition panel |
| Contacts module as call list | Contacts list is designed as a working call queue | HubSpot's contacts list is a CRM browser, not a call queue |

---

## B13. What Amplior Does NOT Build (v1 Scope)

These HubSpot features are out of scope for v1 and should be revisited later:

| HubSpot feature | Decision for Amplior v1 |
|---|---|
| Email send from CRM | Out — agents use WhatsApp/phone; no email-CRM integration needed yet |
| Deal probability / weighted forecasting | Out — too early; no revenue reporting yet |
| Sequence / drip campaigns | Out — not how Amplior's team works |
| Lifecycle stage on contacts | Out — deal stage captures this |
| Custom association labels | Out — defer to v2 |
| Lead scoring | Out |
| Salesforce / external sync | Out |
| Active segments (auto-updating lists) | Out — manual saved views are enough for v1 |
| Multiple pipelines | Out — one implicit pipeline per project is enough for v1 |

---

## B14. Open Questions (Carry-Forward + New)

From the `COMPANIES-CONTACTS-BLUEPRINT.md` (questions 1–7 unchanged):

1. **Org chart / downline:** Provide reporting structure (who reports to whom) for `manager_id` to work.
2. **Contact ownership:** Inherit from company's per-project owner, or can a contact have its own owner?
3. **Editing shared company core info:** Who can edit company name / domain / CIN when the company is owned by multiple users in different projects? (Recommended: any owner or Admin can edit core info.)
4. **Domain cleaning rules:** Confirm stripping logic. What about subdomains (e.g. `ir.tatamotors.com`)? Aggressive or conservative?
5. **Masked fields:** Confirm exact list of masked contact fields — phone, email, LinkedIn? (Name + title + city stay visible.)
6. **Migration aggressiveness:** 525 companies + 605 leads — how aggressive should auto-merge be vs. flag-for-review?
7. **Disposition outcomes:** Confirm final call-disposition options with the sales team.

New questions (from this PRD exercise):

8. **Deal stages:** Confirm/revise the 10-stage list in B6 with the sales team. Are "Gatekeeper" and "Call Back Later" real stages or just dispositions?
9. **Project selector default:** Should the company/contact record default to the user's primary project, or should the user be prompted to select a project on first open?
10. **Deal–Contact link:** Some deals may have multiple contacts (a buyer and an influencer). Is one primary contact per deal enough for v1, or do we need a many-to-many deal↔contact table from the start?
11. **Activity visibility:** Should the activity timeline on a Company record show all activities across all projects (full history), or only activities within the selected project? (Recommend: filter by selected project, with an "all projects" toggle.)
12. **Claim ownership:** When an agent wants to "claim" a company in their project (that already exists and is unowned in that project), should this be instant self-service, or require approval from a manager?

---

## B15. Build Order (Phased — From Blueprint, Updated)

| Phase | What to build | HubSpot analogy |
|---|---|---|
| **A. Data model + migration** | `contact_master`, `company_project_owner`, `manager_id`, dedup indexes; migrate existing companies + contacts | Setting up the CRM objects |
| **B. Companies module** | List page + Company record page (contacts tab, deals tab, activity tab, project selector) | HubSpot Companies module |
| **C. Contacts module** | List page (call list) + Contact record page (masked details, call/disposition panel, activity tab) | HubSpot Contacts module + Calling |
| **D. Visibility / RLS** | Masked contact details + downline access enforcement at DB layer | HubSpot team permissions |
| **E. Dedup enforcement** | Create-flow checks + DB unique indexes | HubSpot auto-dedup |
| **F. Deal enhancements** | Link deals to contacts; add deal stages; activity timeline on deal page | HubSpot Deals module |

---

*End of document.*

**Sources referenced in Part A:**
- [Understand HubSpot CRM objects](https://knowledge.hubspot.com/records/understand-objects)
- [HubSpot's default company properties](https://knowledge.hubspot.com/properties/hubspot-crm-default-company-properties)
- [HubSpot's default contact properties](https://knowledge.hubspot.com/properties/hubspots-default-contact-properties)
- [HubSpot's default deal properties](https://knowledge.hubspot.com/properties/hubspots-default-deal-properties)
- [Associate records](https://knowledge.hubspot.com/records/associate-records)
- [Understand and use the record page layout](https://knowledge.hubspot.com/records/work-with-records)
- [Set up and manage object pipelines](https://knowledge.hubspot.com/deals/set-up-and-customize-your-deal-pipelines-and-deal-stages)
- [Create or log activities on a record](https://knowledge.hubspot.com/records/manually-log-activities-on-records)
- [HubSpot's default activity properties](https://knowledge.hubspot.com/properties/hubspots-default-activity-properties)
- [HubSpot user permissions guide](https://knowledge.hubspot.com/user-management/hubspot-user-permissions-guide)
- [Create and manage teams](https://knowledge.hubspot.com/user-management/create-and-manage-teams)
- [View and filter records](https://knowledge.hubspot.com/records/view-and-filter-records)
- [Understand ways to group records in HubSpot](https://knowledge.hubspot.com/segments/what-is-the-difference-between-saved-filters-smart-lists-and-static-lists)
- [A Developer's Guide: Company Object](https://developers.hubspot.com/blog/a-developers-guide-to-hubspot-crm-objects-company-object)
- [A Developer's Guide: Standard Objects](https://developers.hubspot.com/blog/a-developers-guide-to-hubspot-crm-objects-standard-objects)
- [CRM API: Deals](https://developers.hubspot.com/docs/api-reference/crm-deals-v3/guide)
- [CRM API: Properties](https://developers.hubspot.com/docs/api/crm/properties)
