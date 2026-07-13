# Collaborators & Associations — Competitor Research
**Purpose:** Reverse-engineer how HubSpot (and Salesforce where useful) implements record collaborators and associations, so AltLeads CRM can copy the good parts and avoid the pitfalls when building these two features.

**Researched:** 2026-06-28 | Author: Claude (research-only, no code changed)

---

## Part 1 — Record Collaborators

### 1.1 How HubSpot Does It

**Source:** [HubSpot Knowledge: Add collaborators to a deal](https://knowledge.hubspot.com/records/add-collaborators-to-a-deal) | [INSIDEA walkthrough](https://insidea.com/blog/hubspot/kb/how-to-add-collaborators-to-deals-in-hubspot)

#### Enabling the Feature
- Super Admin goes to **Settings > Data Management > Objects > [Deal] > check "Allow users to add collaborators"**.
- Once enabled, a **Collaborators card** is automatically added to the left sidebar of each deal record (if the layout has not been manually customised).
- The feature is object-scoped — toggled per object type (deals only in current HubSpot rollout; not natively on contacts or companies as of mid-2025).

#### Who Can Add / Remove
| Action | Permission required |
|--------|-------------------|
| Add a collaborator | **Edit deal** permission |
| Remove a collaborator | **Delete deal** permission |
| Toggle the feature on/off | **Super Admin** |

#### What Access a Collaborator Gets
- Collaborators automatically receive **view AND edit** access to any deal they are added to — there is no read-only tier.
- They can leave notes, log calls, and get alerts on that deal.
- Activity from collaborators shows in the deal activity feed and is searchable.
- Collaborators do **NOT** receive deal credit (monetary split). Deal splits are a separate, parallel mechanism.
- Collaborators do not inherit ownership; the "Deal Owner" field is unchanged.

#### "Records I Collaborate On" View
- A default filtered view **"Deals I'm collaborating on"** is available in the Deals index (CRM > Deals > tab).
- Users can also build custom views with the filter: *Collaborator is any of [Name]*.

#### Notifications
- HubSpot documentation is vague on notifications. The INSIDEA walkthrough notes collaborators "receive updates tied to that deal" but does not specify channels or triggers. No email digest or dedicated notification type is documented.

#### Automation / Bulk Management
- Workflows can auto-add collaborators via the **"Edit record"** action on the Deal collaborators property (Professional or Enterprise plan required).
- Bulk collaborator management is available only on Pro/Enterprise.

#### Mobile
- Collaborators **cannot be added or edited** in the HubSpot mobile app. Desktop only.

---

### 1.2 How Salesforce Does It (Opportunity Teams)

**Source:** [Scratchpad: Opportunity Teams in Salesforce 2024 Guide](https://www.scratchpad.com/blog/opportunity-teams-in-salesforce-2024-guide) | [Salesforce Help: Opportunity Teams](https://help.salesforce.com/s/articleView?id=sf.salesteam_def.htm&language=en_US&type=5)

Salesforce calls the equivalent feature **Opportunity Teams** (and **Account Teams** for account-level collaboration).

- Each team member gets a **Role** (Account Manager, Product Specialist, etc.) — roles are fully configurable by admin in Setup.
- Each team member gets a granular **Access Level**: **Read Only**, **Read/Write**, or **Full Access** (owner-equivalent).
- The opportunity owner can add/edit/remove team members on their own opportunities by default. Admins can extend this permission.
- Team members can be given a **Default Opportunity Team** that auto-populates on all their new opportunities.
- Weakness: each opportunity requires manual team setup — no automated inheritance. High-volume orgs find this tedious.

---

### 1.3 Notable Pros

**HubSpot:**
- Simple, one-click add from within the record.
- The "Deals I'm collaborating on" default view is immediately useful — zero config.
- Workflows can automate assignment (Pro+).
- Distinct from ownership — no ownership confusion.

**Salesforce:**
- Granular per-member access level (read-only vs read/write vs full). This is the critical thing HubSpot lacks.
- Role labels on team members (Account Manager, Pre-Sales, CS) give context at a glance.
- Default team templates save manual work on recurring deals.

---

### 1.4 Notable Cons / Limitations / Community Complaints

**HubSpot:**
- **No read-only collaborator tier.** All collaborators get full edit access. The HubSpot Ideas community has a persistent thread requesting view-only vs edit-level access ([Add Role and Permission to Deal Collaborators](https://community.hubspot.com/t5/HubSpot-Ideas/Add-Role-and-Permission-to-Deal-Collaborators/idi-p/758788)). One user calls the feature "obsolete" without view-only options. HubSpot product team has not responded.
- **Deals only** (natively); not available on contacts, companies, or tickets in the same first-class way.
- **No mobile support** for adding/editing collaborators.
- **No role context** on collaborators (just a name; no "Pre-Sales" or "CS" label).
- Team visibility side-effect: adding a collaborator who belongs to a team may expose the record to the entire team if that team has "team's records" view permission — an unintended blast radius.
- Bulk management requires Pro+ subscription.
- No deal credit for collaborators — separate "deal split" feature needed for compensation.

**Salesforce:**
- Manual setup per opportunity — no auto-inheritance from a previous stage or deal type.
- Complexity overhead for small teams.

---

### 1.5 Recommended Lean v1 for AltLeads CRM — Collaborators

**Defer:**
- Mobile editing (defer until mobile app phase)
- Role labels on collaborators (defer to v2 — adds complexity for small gain now)
- Automated workflow-based collaborator assignment (defer to automation phase)
- Deal credit / split mechanics (out of scope for AltLeads outreach model)

**Build in v1:**

| # | Feature | Notes |
|---|---------|-------|
| 1 | **Admin toggle per object** | Settings page: enable/disable collaborators on Leads (and later Contacts/Companies). Mirrors HubSpot's approach. |
| 2 | **Collaborators card on record** | Sidebar widget showing current collaborators. Inline add (search active users). Remove button. |
| 3 | **Access level is an ADMIN SETTING** | Unlike HubSpot (which hardcodes edit access), AltLeads should let the admin choose: "Collaborators can: View only / View + Edit". This is the single biggest improvement over HubSpot's model. Set at the object level (e.g. Lead collaborators = View only). |
| 4 | **"Records I collaborate on" filter** | Pre-built filter on the Lead list: show leads where current user is a collaborator. Zero-config, high day-1 value. |
| 5 | **Collaborators respect ownership** | Adding a collaborator does NOT change `user_id` (lead owner). The collaborator list is a separate junction table `lead_collaborators (lead_id, user_id, added_by, added_at)`. |
| 6 | **Who can add/remove** | Agent can add collaborators (if their edit permission is on). Team Lead can always add/remove on their team's leads. Admin can always. Sales roles cannot see/use collaborators (outreach-only model). |
| 7 | **Activity attribution** | Notes/calls logged by collaborators are attributed to the collaborator (not the owner). |

**Access level admin setting detail (AltLeads-specific):**
- Admin setting per object: `collaborator_access` = `view` | `edit`
- `view` mode: collaborator can see the record, see notes, but cannot edit fields or log activities.
- `edit` mode: collaborator can edit fields and log activities (same as HubSpot's current behaviour).
- Default should be `view` (more conservative; promotes our outreach-only north-star).

---

## Part 2 — Associations

### 2.1 How HubSpot Does It

**Sources:** [Associate records](https://knowledge.hubspot.com/records/associate-records) | [Create and use association labels](https://knowledge.hubspot.com/object-settings/create-and-use-association-labels) | [Aptitude8: Mastering Association Labels](https://aptitude8.com/blog/mastering-advanced-association-labels-in-hubspot) | [Insycle: HubSpot Multiple Associations](https://help.insycle.com/en/articles/5715433-hubspot-multiple-associations-and-labels)

#### The Model
HubSpot associations link any two records across (or within) object types. Core properties:
- **Always bidirectional**: if Contact A is associated with Deal B, Deal B shows Contact A automatically. No one-way links.
- **Many-to-many**: a contact can be on many deals; a deal can have many contacts. No enforced 1-to-1.
- **Object pairs**: Contact↔Company, Contact↔Deal, Contact↔Ticket, Company↔Deal, Deal↔Deal (same-object), Contact↔Contact, etc.

#### Association Types: Labeled vs Unlabeled

Every association has a type. Two built-in types always exist:
1. **Unlabeled** — a generic "these two records are connected" link with no relationship context. Default when you simply associate without choosing a label. Returned with `label = null` in the API.
2. **Primary** — a special HubSpot-defined label used for the primary company of a contact (or primary contact of a deal, etc.). The primary association is the one that drives lists, workflows, personalization tokens, and cross-object reports.

On top of these, Professional/Enterprise accounts can create **custom association labels**.

#### Custom Association Labels

**Where you create them:** Settings > Data Management > Data Model > Associations tab > select object pair > Create label.

**Two label types:**
- **Single label**: same word describes both sides (e.g. "Colleague", "Partner"). Shows on both records with the same name.
- **Paired label**: different words for each side (e.g. "Manager" / "Employee"). Setting one side auto-sets the other. Counts as 1 toward the 50-label limit.

**Common real-world label sets (B2B sales):**
- Contact → Deal: Decision Maker, Budget Holder, Technical Expert, Evaluator, Legal Reviewer, Finance Reviewer, Project Advocate, Influencer
- Contact → Company: Financial Contact, Decision Maker, Billing Contact
- Company → Company: Partner, Referral Partner, Subsidiary, Parent

**Limits:**
- Up to **50 custom labels per object pair**.
- Per-label association limits: configurable as "Many records" (unlimited within system cap) or a custom number up to 10,000.
- Overall system limit per object pair: varies by plan; was raised in 2024 (some pairs go up to 250k). In practice, limits matter only at large enterprise scale.

**Plan gate:** Association labels require **Professional or Enterprise**. Free/Starter get unlabeled associations only.

#### UX: Where Associations Live
- **Record page**: right sidebar — each object type has its own association card (e.g. "Associated Contacts", "Associated Companies"). Displays the linked record name, key properties, and label badges.
- **Adding**: click "+ Add [Object]" on the association card → search existing records or create new → optionally apply labels → save.
- **Editing labels**: hover a linked record → "More" menu → "Edit association labels".
- **Removing**: same "More" menu → "Remove association".
- **Index pages**: association columns can be added (e.g. show primary company name in the Contacts list).

#### Primary Company — Special Behaviour
- Every contact must have exactly one **primary company**.
- Activities (emails, calls, meetings) auto-associate with the primary company only.
- Lists, workflows, cross-object reports, and personalization tokens reference primary company by default.
- You can change primary company: on the Company card, hover → "Set as [Contact]'s primary company". The old primary stays associated but loses the Primary label.
- Contacts with only one company cannot remove the Primary label.

#### How Associations Drive Automation & Reporting
- In workflows: when taking an action on associated contacts/companies, you can filter by association label (e.g. "only email contacts labeled Decision Maker on this deal").
- In lists: filter by "Associated Company has label = Billing Contact".
- In custom reports: association label is available as a filter axis or breakdown field.
- In personalization tokens: `{{contact.associated_company}}` resolves to the primary company.

---

### 2.2 Notable Pros

- Very flexible — any object to any object, with contextual labels.
- Bidirectional by design; no consistency drift.
- Labels unlock rich stakeholder mapping on complex deals (ideal for enterprise B2B).
- Primary company concept is simple and drives downstream automation elegantly.
- Custom limits per label allow enforcing business rules (e.g. "a deal can have at most 1 Decision Maker").

---

### 2.3 Notable Cons / Limitations / Community Complaints

- **Association labels require Professional+ plan** — a meaningful paywall for label context.
- **No native workflow trigger on "association created/removed"** (major complaint; requires third-party tools like Insycle or Associ8 for true automation of label changes) — [community thread](https://community.hubspot.com/t5/HubSpot-Ideas/Automate-record-associations-in-workflows/idi-p/535753).
- **Filtering by association label in lists/workflows is limited** — not all label combinations are filterable natively; complex multi-label logic often requires workarounds — [community thread](https://community.hubspot.com/t5/Dashboards-Reporting/Ability-to-Filter-and-Trigger-Actions-by-Association-Labels-in/m-p/1175927).
- **Internal label names cannot be edited after creation** — a mistake is permanent until you delete and recreate.
- **Non-alphanumeric characters in label names cause import errors** (semicolons act as delimiters).
- **Line items do not support custom association labels**.
- At very large scale (e.g. 50k contacts per company), hitting association limits has caused sync issues — though HubSpot has been increasing limits.
- The right-sidebar UX gets cramped on records with many associated objects — no "expanded view" natively.

---

### 2.4 Recommended Lean v1 for AltLeads CRM — Associations

#### AltLeads Context
AltLeads is an outreach CRM (not a full account management platform). In v1, the core need is:
- A Lead belongs to one Company (already modelled as `company_name`/`company_id`).
- A Lead can be associated with multiple Contacts at that company (the people the agent calls).
- Optionally, a Lead can be linked to other Leads (e.g. re-bid on same company, referral chain).

HubSpot's full association model (50 label types, cross-object many-to-many, primary company logic) is significantly over-engineered for this scope. Build a focused subset.

**Defer:**
- Many-to-many same-object associations (Lead↔Lead) — defer to v2
- Full association label taxonomy (50 labels per pair) — defer; start with 3-5 built-ins
- Custom label creation UI for admins — defer to v2
- Association-driven workflow automation — defer to automation phase
- Cross-object report breakdowns by label — defer to reporting phase

**Build in v1:**

| # | Feature | Notes |
|---|---------|-------|
| 1 | **Lead ↔ Contact associations** | A lead record can have multiple associated contacts (the people at the company). Each contact has a **role label** chosen from a fixed admin-managed list. Start with 5 built-in labels: Decision Maker, Influencer, Technical Contact, Finance Contact, Other. Schema: `lead_contacts (lead_id, contact_id, label, is_primary, added_by, added_at)`. |
| 2 | **Primary contact** | One contact per lead is flagged `is_primary = true`. This is who the agent calls first. Activities (calls/emails) auto-associate to the primary contact. Changing primary is a one-click action. |
| 3 | **Associations card on Lead record** | Right sidebar card: "Contacts at this company" — shows name, role label, phone, email, is_primary badge. Add / Edit label / Remove. |
| 4 | **Company ↔ Lead link** | Already partially modelled; make it a formal FK with a "Primary Company" concept per lead. One lead = one primary company. (Multi-company on same lead is an edge case — defer.) |
| 5 | **Bidirectional display** | When viewing a Company record, show all associated leads. When viewing a Contact, show all associated leads. (Bidirectional read; write from Lead record only in v1.) |
| 6 | **Admin-managed label list** | Admin can rename/add/disable role labels from Settings (no code deploy needed). Cap at 20 labels in v1. Internal name (slug) locked on creation — surface this to admin clearly. |
| 7 | **Filter leads by contact label** | On the Lead list page: filter "Has a contact labeled Decision Maker". Simple SQL join; high value for targeting. |

#### Schema sketch (v1)

```sql
-- Lead contacts (associations with labels)
CREATE TABLE lead_contacts (
  id            bigserial PRIMARY KEY,
  lead_id       bigint REFERENCES leads(id) ON DELETE CASCADE,
  contact_id    bigint REFERENCES contacts(id) ON DELETE CASCADE,
  label         text,                -- e.g. 'decision_maker', 'influencer'
  is_primary    boolean DEFAULT false,
  added_by      bigint REFERENCES profiles(user_id),
  added_at      timestamptz DEFAULT now(),
  UNIQUE (lead_id, contact_id)       -- one row per lead-contact pair
);

-- Contact role labels (admin-managed)
CREATE TABLE contact_role_labels (
  id            serial PRIMARY KEY,
  slug          text UNIQUE NOT NULL, -- internal name, immutable
  display_name  text NOT NULL,
  sort_order    int DEFAULT 0,
  is_active     boolean DEFAULT true
);
```

---

## Part 3 — Summary Comparison Table

| Dimension | HubSpot Collaborators | Salesforce Opp Teams | AltLeads v1 recommendation |
|---|---|---|---|
| Who can add | Users with Edit permission | Opportunity owner (+ admin) | Agent (if edit-on), Team Lead, Admin |
| Access level choice | No — hardcoded edit access | Yes — Read Only / Read/Write / Full | **Yes — Admin sets View or Edit** |
| Role labels on members | No | Yes (custom roles) | Defer to v2 |
| "My collaborations" view | Yes (built-in tab) | Via reports | Yes — pre-built filter on Lead list |
| Automation | Pro+ only | Manual-only | Defer |
| Mobile | Not supported | Yes (limited) | Defer |
| Object scope | Deals only (natively) | Opportunities + Accounts | Leads first; expand later |

| Dimension | HubSpot Associations | AltLeads v1 recommendation |
|---|---|---|
| Object pairs | Any↔Any | Lead↔Contact, Lead↔Company |
| Labels | Up to 50 custom per pair (Pro+) | 5 built-in role labels; admin can add |
| Primary association | Yes (primary company) | Yes (primary contact per lead) |
| Bidirectional | Yes | Yes (read only from related record) |
| Automation on label change | No (major gap) | Defer |
| Filtering by label | Yes (lists + workflows) | Yes on lead list page |

---

## Part 4 — Key Design Decisions for AltLeads

1. **Collaborator access level = admin setting.** HubSpot's biggest gap is the forced edit access. AltLeads will fix this by making it a settings toggle (view vs edit), defaulting to view-only. This is a deliberate competitive advantage over HubSpot for orgs that want controlled visibility.

2. **Collaborators are a junction table, not a property.** Do not implement collaborators as a multi-select user property (which is HubSpot's workaround). A proper `lead_collaborators` table gives you audit trail, timestamps, and clean RLS.

3. **Associations start small and labeled.** Do not build a generic "associate any record to any record" engine in v1. Build Lead↔Contact with a role label and a `is_primary` flag. That covers 90% of the outreach use case (who do I call, what's their role).

4. **Primary contact mirrors HubSpot's primary company concept.** One primary contact per lead. Activities auto-attach to primary. This is the "default person" for the lead and should display prominently on the lead card.

5. **Admin-managed label list.** Ship with 5 sensible defaults (Decision Maker, Influencer, Technical Contact, Finance Contact, Other). Admin can add/rename. Internal slug is immutable (learn from HubSpot's "can't edit internal name" pain — surface this clearly in the UI).

6. **Do not conflate collaborators (internal users) with associations (external contacts/companies).** These are separate data models with separate UI cards. Keep them clearly distinct to avoid confusion.

---

## Sources

- [HubSpot: Add collaborators to a deal](https://knowledge.hubspot.com/records/add-collaborators-to-a-deal)
- [HubSpot Ideas: Add Role and Permission to Deal Collaborators](https://community.hubspot.com/t5/HubSpot-Ideas/Add-Role-and-Permission-to-Deal-Collaborators/idi-p/758788)
- [INSIDEA: How To Add Collaborators To Deals In HubSpot](https://insidea.com/blog/hubspot/kb/how-to-add-collaborators-to-deals-in-hubspot)
- [HubSpot: Associate records](https://knowledge.hubspot.com/records/associate-records)
- [HubSpot: Create and use association labels](https://knowledge.hubspot.com/object-settings/create-and-use-association-labels)
- [HubSpot: Set limits for record associations](https://knowledge.hubspot.com/object-settings/set-limits-for-record-associations)
- [Aptitude8: Mastering HubSpot Association Labels](https://aptitude8.com/blog/mastering-advanced-association-labels-in-hubspot)
- [Insycle: HubSpot Multiple Associations and Labels](https://help.insycle.com/en/articles/5715433-hubspot-multiple-associations-and-labels)
- [Scratchpad: Opportunity Teams in Salesforce 2024 Guide](https://www.scratchpad.com/blog/opportunity-teams-in-salesforce-2024-guide)
- [Salesforce Help: Opportunity Teams considerations](https://help.salesforce.com/s/articleView?id=sf.salesteam_def.htm&language=en_US&type=5)
- [HubSpot Community: Automate record associations in workflows](https://community.hubspot.com/t5/HubSpot-Ideas/Automate-record-associations-in-workflows/idi-p/535753)
- [HubSpot Community: Filter/trigger by association labels](https://community.hubspot.com/t5/Dashboards-Reporting/Ability-to-Filter-and-Trigger-Actions-by-Association-Labels-in/m-p/1175927)
- [HubSpot Changelog: Associations Limits Increase](https://community.hubspot.com/t5/Releases-and-Updates/Now-Live-Associations-Limits-Increase/ba-p/631739)

---

## Implementation note — v1 Wired (ALT-441/442) — 2026-06-29

### What is wired

**Feature flag:** `COLLAB_ASSOC` in `src/lib/collabAssoc.ts` (currently `false` — all code is dark in prod).

**Detail pages** — both cards mounted on all 4 pages, inside `{COLLAB_ASSOC && (...)}`:

| Page | recordType | userOptions source | targetOptions |
|------|-----------|-------------------|---------------|
| `LeadDetailPage` | `'lead'` | `fetchAssignableUsers()` → mapped to `SearchSelectOption[]` | contacts from `fetchAllContacts`, companies from `fetchCompanyOptions`; lead+meeting = `[]` |
| `ContactDetailPage` | `'contact'` | `fetchAssignableUsers()` | companies from `fetchCompanyOptions`; lead+contact+meeting = `[]` |
| `CompanyDetailPage` | `'company'` | `fetchAssignableUsers()` | companies from `fetchCompanyOptions`; lead+contact+meeting = `[]` |
| `MeetingDetailPage` | `'meeting'` | `fetchAssignableUsers()` | contacts from `fetchAllContacts`, companies from `fetchCompanyOptions`; lead+meeting = `[]` |

`actorId` = `profile.user_id` (string) on each page — reuses the existing `actor`/`actorId` variable already in scope.

**Admin tab:** `CollaboratorAccessTab` added to `AdminPage` as key `'collabaccess'` (label: "Collab Access"), shown only when `COLLAB_ASSOC` is on (mirrors HB Settings pattern). Stores view/edit setting per object type in `collaborator_access_setting` table.

**Migration (staged):** `new-code/migration/apply-collaborator-access-setting.cjs` — creates `collaborator_access_setting` table with RLS. `node -c` passes. NOT executed — requires DEC-03 sign-off + existing collab/assoc table migrations applied first.

### Deferred

- RLS enforcement of the `collabaccess` setting in Supabase — gatekeeper middleware (ALT-431) — after DEC-03 ownership model is validated and `COLLAB_ASSOC` is flipped live.
- Lead options for `targetOptions.lead` (requires a lightweight lead name/ID fetch; deferred to v2 to keep v1 bounded).
