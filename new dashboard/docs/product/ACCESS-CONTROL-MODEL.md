# AltLeads CRM — Access-Control Model

> **Status:** DESIGN ONLY. No code written, no database policies changed, nothing committed.
> This document proposes a configurable, per-project record-access model for AltLeads,
> modelled on HubSpot's record-access system and adapted to the owner's requirements.
> **Date:** 2026-06-17

---

## PART 0 — PLAIN-ENGLISH SUMMARY (for the owner)

Today the app has a security "baseline": once you're logged in, you can see and edit
**everything**. That was fine for testing. To go live properly, we need rules about
**who can see and edit which records** — the same problem HubSpot solved years ago.

We studied how HubSpot does it and designed an AltLeads version that matches your wishes:

1. **Everything is per-project and configurable.** Each project (AP Securitas, HungerBox,
   etc.) gets its own access settings. The Team Lead / project leader / Admin picks, for
   that project, how wide visibility is — **Owner-only**, **Team**, or **Everyone in the
   project** — and separately how wide *editing* is. Think of these as dials, set per
   project, per object type (Companies / Contacts / Leads).

2. **Companies & Contacts are "public but masked" by default.** Everyone in the project
   can see the **company/contact name + city** and **all the working info** (disposition,
   remarks, comments, description, stage/status). This stops two agents from creating the
   same company twice. **BUT the private contact details — phone, email, LinkedIn — are
   hidden** from everyone except the record's **owner**, the **Admin**, and the owner's
   **managers up the chain**. Editing is normally limited to the owner (or whatever the
   project dial says).

3. **Leads are NOT public by default.** Unlike companies/contacts, leads are closed by
   default. The Team Lead / manager / Admin decides, per project, who can see and edit
   leads.

4. **Managers always see their team's work (downline).** A Team Lead / project leader
   sees the records of everyone who reports to them, all the way down. The **QC role sees
   everything** by default (their job is to check quality across the board). The **Admin
   sees and edits everything** and can change any of the access dials — exactly like a
   HubSpot "Super Admin".

5. **One thing we must add to make this work:** the database currently has **no idea who
   reports to whom**. To do "managers see their downline", we need to record the reporting
   line. The simplest reliable way is one new field on each user that says "my manager is
   ___". (Details and the alternative are in Part 3.)

**What we need from you** is a short list of yes/no decisions at the very bottom
(Part 4). Everything else we can build from defaults that match what you described.

---

## PART 1 — RESEARCH: How HubSpot controls record access

This section is factual, drawn from HubSpot's own knowledge base and developer docs.
Where HubSpot's behavior is subtle or version/tier-dependent, that is flagged.

### 1.1 Record ownership (the "owner" property) and what it grants

- Every CRM record (contact, company, deal, ticket, custom object) has an **Owner**
  property — a built-in HubSpot user field. Each record has **one** owner via the default
  property, but you can create **additional custom "HubSpot user" field-type properties**
  to attach more users to a record (e.g. a secondary owner / SDR field).
- A user set as a record's owner has **owner-level access** to that record. Permission
  scopes that say "their records" / "owned only" are evaluated **against the owner
  property** (and against those custom user-field properties).
- To be *assignable* as an owner of an object, a user must at minimum have **View**
  permission on that object.
- Ownership is the anchor of HubSpot's whole model: the broad permission tiers
  ("Everyone / Team / Owned only") are all defined **relative to who owns the record**.

### 1.2 HubSpot Teams: primary vs additional, hierarchy, and how access cascades

- A user has **exactly one Primary team** (their main reporting line) and can belong to
  any number of **Additional (extra) teams**. Extra teams broaden a user's record access
  and reporting reach **without** changing their primary ownership structure.
- **Caveat HubSpot itself documents:** additional-team members are excluded from team
  reports, routing rules, team notifications, and workflow rotation, and can't see custom
  team record views. Extra teams are an *access* tool, not a full membership.
- **Hierarchical (nested / parent–child) teams** are an **Enterprise-tier** feature. You
  build a tree (e.g. Company → Region → City team).
- **How access cascades — the important nuance:**
  - A user with a **"their team's [object]"** permission can see records owned by **any
    member of their assigned team(s)**, **and**, if nesting is used, **the members of that
    team's *sub*-teams**. So access flows **downward**: a parent-team manager sees the
    parent team's records *and* all descendant sub-teams' records.
  - The reverse is **not** automatic: child-team members do **not** see parent-team
    records just because of the nesting. Nesting cascades **down**, not up.
  - HubSpot warns admins that parent/child structures can widen access in ways they don't
    expect, and to **test manager visibility carefully**.
  - (There's one isolated exception unrelated to records: for **dashboard** permissions,
    selecting a child team auto-adds the parent. This is dashboards only, not CRM records.)
- **Net effect for "managers see their team":** in HubSpot you model the reporting
  hierarchy **as a team tree**, give managers a "team's records" permission, and the
  downward cascade gives each manager visibility into everyone beneath them. *This is the
  mechanism AltLeads must reproduce — see Part 3, where we recommend a reporting-line field
  instead of a full team tree for v1.*

### 1.3 The View / Edit / Delete / Communicate permission matrix and its scopes

HubSpot configures, **per object** (Contacts, Companies, Deals, Tickets, Tasks, custom
objects, etc.), separate dropdowns for **View, Edit, Delete** (and **Merge**), plus a
**Communicate** permission. The scope options:

| Permission | Scope options (exact HubSpot wording) |
|---|---|
| **View** | **All [objects]** · **Their team's [objects]** · **Their [objects]** (owned only) · *(no "None" — view of an object you have any access to is on/off at the object level)* |
| **Edit** | **All** · **Their team's** · **Their** · **None** |
| **Delete** | **All** · **Their team's** · **Their** · **None** |
| **Communicate** (log/associate emails, calls, meetings) | **All records** · **Records their team owns** · **Records they own** · **None** |

Additional behaviors:

- **"Unassigned" checkbox:** when a scope is set to *team* or *owned*, an **Unassigned**
  checkbox can be ticked so the user can also access records with **no owner**. (This is
  how HubSpot lets reps grab new/unowned records without opening up the whole database —
  directly relevant to AltLeads' "prevent duplicate creation" goal.)
- **"Their [objects]" view limitation:** users with *owned-only* view "will only see their
  assigned records on index pages, in the segments tool, and in reports" — i.e. the scope
  filters lists, search, and reporting, not just the record page.
- **Create** is a separate toggle and applies to *manually* created records (not records
  created by workflows, forms, inbox, email tracking, or Salesforce import).
- **View vs Communicate split:** a user with only View (no Communicate) can create notes
  and tasks, but needs **Communicate** to log/associate emails, calls, meetings, or edit
  activities. (AltLeads' "disposition / remark / comment" actions map to this distinction.)
- **"Team" = primary + additional teams, cascading down** to sub-teams (per 1.2).

### 1.4 How access is assigned at user creation; Super Admin override

- **Permission Sets / templates:** HubSpot lets admins build reusable **permission sets**
  (a saved bundle of every object scope + tool permission). When creating or editing a
  user you **assign a permission set** (and one or more teams) rather than ticking every
  box by hand. There are also **default/standard templates** (e.g. a basic "Sales" set).
  Changing a set updates everyone assigned to it.
- **Super Admin** is a special non-editable template that grants access to **all account
  tools and settings** (except certain paid Sales/Service features that need a specific
  paid seat). A Super Admin effectively **overrides all object/team/owner scoping** — they
  see and do everything. Super Admin is the model for AltLeads' **Admin**.

### 1.5 Field-level / property visibility (masking specific fields)

- HubSpot supports **property-level (field-level) permissions**, configured **per role**
  under *Settings → Properties* (and surfaced in Roles). For each property you can set:
  - **View access:** **All** · **Team only** · **Owned only** · **None** (None fully hides
    the field — it disappears from record pages, sidebars, and most tools for users not on
    the list).
  - **Edit access:** controls who can change the value, independent of view.
- Typical use: keep **sensitive fields** (revenue, contract value, PII) visible only to
  specific roles while everyone else still sees the rest of the record. This is exactly the
  pattern AltLeads needs for **masking phone / email / LinkedIn**.
- **Uncertainty / caveats:** the granularity, the "Owned only" property scope, and
  hierarchical-team features are **Professional/Enterprise-tier** capabilities; exact
  availability varies by HubSpot subscription. HubSpot's field-level *view* masking is
  fairly recent and historically users asked for it for years — so older write-ups may say
  it's not possible. AltLeads is not bound by any of these tier limits; we implement masking
  ourselves in Postgres.

**Sources (Part 1):**
- HubSpot — [User permissions guide](https://knowledge.hubspot.com/user-management/hubspot-user-permissions-guide)
- HubSpot — [View and manage user access to a record](https://knowledge.hubspot.com/records/view-record-access)
- HubSpot — [Create and manage teams](https://knowledge.hubspot.com/user-management/create-and-manage-teams)
- HubSpot — [Manage view and edit access for properties](https://knowledge.hubspot.com/properties/restrict-view-edit-access-for-properties)
- HubSpot — [Manage user permissions](https://knowledge.hubspot.com/user-management/manage-user-permissions)
- HubSpot docs — [Query CRM object user permissions (API)](https://developers.hubspot.com/docs/api-reference/settings-user-provisioning-v3/public-permissions)
- HubSpot legacy docs — [Owners API overview](https://legacydocs.hubspot.com/docs/methods/owners/owners_overview)
- Community write-up — [Nested teams visibility behavior](https://community.hubspot.com/t5/Account-Settings/Nested-Teams-Not-Inheriting-Visibility-from-Parent-Team-in/td-p/1113931)

---

## PART 2 — DESIGN: The AltLeads access model

The AltLeads model maps HubSpot's concepts onto AltLeads' reality (per-project work,
6 roles, an existing owner = `created_by` convention) and onto the owner's requirements.

### 2.1 Core concepts (the AltLeads equivalents of HubSpot's)

| HubSpot concept | AltLeads equivalent |
|---|---|
| Record owner property | **`created_by`** (existing convention; for company/contact per-project work, **`owner_user_id`** on the per-project status rows) |
| Primary/extra teams + nesting (downward cascade) | **Reporting line** (`user_master.manager_id`) → a **recursive downline**; managers see everyone beneath them |
| Permission set / template | **Role** (ADMIN / TEAM_LEAD / AGENT / SALES_HEAD / SALES_PERSON / QC) + **per-project role** in `project_user` |
| Per-object View/Edit/Delete/Communicate scope | **`project_visibility_setting`** (per project, per object: view_scope + edit_scope) |
| Super Admin | **ADMIN role** (`is_admin()`), overrides every scope and can edit the settings |
| Property/field-level view permission (masking) | **Masking of phone/email/LinkedIn** on contacts (and any private fields), enforced in the DB |
| "Unassigned" checkbox | Records with **no owner** are visible (names/working-info) to the project so they can be claimed/deduped, never duplicated |

### 2.2 The per-project, configurable scopes (the "dials")

For **each project**, and **each object type** (`company`, `contact`, `lead`), there are
two independent dials, settable by **Team Lead / project leader / Admin**:

- **`view_scope`** — who can *see* records of this object in this project:
  - `owner` — only the owner (+ managers up the chain + QC + Admin always)
  - `team` — owner's reporting team (downline of the owner's manager) + the above
  - `everyone` — everyone who is a member of the project + the above
- **`edit_scope`** — who can *edit* records of this object in this project:
  - `owner` — only the owner (+ Admin)
  - `team` — owner's downline managers + owner (+ Admin)
  - `everyone` — any project member (+ Admin)

These are exactly HubSpot's "Everyone / Team(s) (+sub-teams) / Owned only" tiers, made
**per project** instead of per global role — because AltLeads' work is organised by project.

**Always-on overrides** (independent of the dials, mirroring HubSpot Super Admin + manager
cascade):

- **Admin** sees and edits **everything**, ignores all scopes, and **edits the dials**.
- **Managers see their downline** for *view* regardless of the dial (a TL/SH must see their
  reports' work). Whether managers can *edit* downline records follows the `edit_scope`
  unless we decide managers always can — see Owner Decision D5.
- **QC** sees **all** records by default (read), regardless of dials.

### 2.3 Object-specific defaults (the heart of the owner's requirements)

#### Companies & Contacts — PUBLIC-WITHIN-PROJECT but MASKED

- **Default `view_scope` = `everyone`** (project members).
- **What "everyone" sees:** company/contact **name + city**, and **all working info** —
  disposition, remark, comment, description, and stage/status (the `*_project_status`
  rows + `interaction` rows). This is what prevents duplicate creation: anyone about to add
  "Acme Corp" can already see it exists and what's been done on it.
- **What is MASKED to non-owners:** the **private contact details — `phone` / `email` /
  `linkedin`** (and any field we tag private). These are visible **only** to:
  - the **owner** of the record (the per-project owner / `created_by`),
  - the owner's **managers up the chain** (downline rule, viewed from above),
  - **QC** (read-all),
  - **Admin**.
- **Default `edit_scope` = `owner`** (only the owner edits the company/contact record),
  overridable by the dial.

> This is HubSpot's **field-level view permission** applied to a public record: the record
> is visible to all, but specific properties are hidden. AltLeads enforces it in Postgres
> (Part 3.3) rather than relying on a SaaS feature flag.

#### Leads — NOT public by default

- **Default `view_scope` = `owner`** and **`edit_scope` = `owner`** (closed).
- Visibility/edit for leads is **decided per project by the Team Lead / manager / Admin**
  via the dials — it is **never** auto-opened to everyone.
- Managers still see their downline's leads (manager cascade is always on for view); QC
  sees all; Admin sees/edits all.
- (Owner = `created_by`, the verified lead-ownership column.)

### 2.4 Worked examples (so the behavior is unambiguous)

- **Agent A owns Contact "Priya" in project HungerBox.** Agent B (same project) opens the
  Contacts list: B sees **"Priya — Bengaluru"**, her **status = Hot**, the last **call
  disposition**, and any **comments** — but the phone/email/LinkedIn show as **blank /
  "hidden"**. B cannot accidentally re-create Priya. B cannot edit her (edit_scope=owner).
- **Agent A's Team Lead (TL)** opens the same contact: TL sees **everything including the
  phone/email/LinkedIn**, because A is in TL's downline.
- **QC** opens it: sees everything (read), across all projects.
- **Admin** opens it: sees and edits everything, and can change HungerBox's contact
  view_scope from `everyone` to `team` if the project wants tighter masking-plus.
- **A Lead owned by Agent A in HungerBox:** Agent B does **not** see it at all (leads
  default closed). TL and QC and Admin do. If the HungerBox TL flips the lead `view_scope`
  to `team`, then everyone in A's team can see A's leads.

---

## PART 3 — TECHNICAL DESIGN (Supabase Postgres + RLS)

Grounded in the current schema:
roles in `user_role → role_master` (1 ADMIN, 2 TEAM_LEAD, 3 AGENT, 4 SALES_HEAD,
5 SALES_PERSON, 6 QC); tables `profiles` (`id uuid = auth.uid`, `user_id`, `role`),
`user_master`, `project`, `project_user` (user + project + role), `lead_master`
(`created_by`, `project_id`, `client_assoc_id`), `company_master`, `contact_master`
(`company_id`), `contact_project_status`, `company_project_status`, `interaction`.
There is **no manager/hierarchy column yet**. Helper functions `current_user_id()` and
`is_admin()` are being added.

> **Ownership reality (verified in this codebase, do not regress):** lead/record ownership
> is **`created_by`** holding a `user_master.user_id`, and a company is reached via
> `client_assoc_id` for leads. For companies/contacts the per-project owner is
> `owner_user_id` on `company_project_status` / `contact_project_status`.

### 3.0 Helper functions (assumed/extended)

```sql
-- already being added:
-- current_user_id()  -> bigint   : the logged-in user's user_master.user_id (via profiles)
-- is_admin()         -> boolean  : true if profiles.role = 'ADMIN'

-- new helpers this design needs (all SECURITY DEFINER, search_path locked):
create or replace function current_role_name() returns text ...   -- profiles.role
create or replace function is_qc()       returns boolean ...       -- role = 'QC'
create or replace function downline_ids() returns setof bigint ...; -- see 3.1
create or replace function sees_downline(owner bigint) returns boolean ...; -- see 3.1
create or replace function is_project_member(p bigint) returns boolean ...; -- via project_user
```

All helpers must be `SECURITY DEFINER` with a fixed `search_path` so they can read
`user_master` / `project_user` even when the caller's RLS would otherwise restrict them
(avoids recursive RLS and "function can't see the row" problems). Mark them `STABLE`.

### 3.1 Reporting-hierarchy mechanism — RECOMMENDATION

Two options:

**Option A — Adjacency column: `user_master.manager_id bigint references user_master(user_id)`.**
Each user points at their manager. The downline is a recursive walk.

- **Pros:** one column; trivial to populate from an org chart / admin UI; exactly matches
  the owner's mental model ("who reports to whom"); the recursive-CTE downline predicate is
  standard; no extra join tables; works *across* projects automatically.
- **Cons:** a single global reporting line per user (a person has **one** manager
  everywhere). If a person reports to different leads **in different projects**, one global
  column can't express that.

**Option B — Teams table modelled on HubSpot (teams + team_member + parent_team_id).**
Recreate HubSpot's nested teams; "sees team's records" = membership in the same/ancestor team.

- **Pros:** matches HubSpot 1:1; supports multiple/extra teams and per-team structure;
  future-proof for complex orgs.
- **Cons:** materially more to build and reason about (team CRUD UI, membership UI, nesting,
  primary vs extra); RLS predicates get heavier; **overkill** for AltLeads' current size and
  the owner's plain "managers see their downline" requirement. HubSpot itself warns this is
  error-prone to configure.

> **RECOMMENDATION: Option A (`manager_id`) for v1**, because it directly satisfies the
> requirement with the least surface area. **Mitigate its one weakness** (per-project
> reporting lines) by allowing a **per-project manager override** later via the existing
> `project_user` table — add an optional `project_user.manager_user_id` so that, *within a
> project*, the downline can follow a different lead. v1 can ship with the global
> `manager_id` only; the per-project override is a clean additive upgrade if any project
> actually needs it (Owner Decision D2). This keeps us strictly simpler than Option B while
> leaving the door open.

**The `sees_downline` predicate (recursive CTE):**

```sql
-- All users at or below the current user in the reporting tree.
create or replace function downline_ids()
returns setof bigint
language sql stable security definer set search_path = public as $$
  with recursive tree as (
    select current_user_id() as user_id
    union all
    select um.user_id
    from user_master um
    join tree t on um.manager_id = t.user_id
  )
  select user_id from tree;
$$;

-- True if `owner` is the current user or anyone beneath them.
create or replace function sees_downline(owner bigint)
returns boolean
language sql stable security definer set search_path = public as $$
  select owner is not null
     and owner in (select user_id from downline_ids());
$$;
```

(If the per-project override is adopted, `downline_ids()` takes a `project_id` and the
recursive seed/joins also consider `project_user.manager_user_id` for that project.)

### 3.2 The `project_visibility_setting` table and how RLS reads it

```sql
create table if not exists project_visibility_setting (
  id           bigint generated by default as identity primary key,
  project_id   bigint not null references project(project_id),
  object_type  text   not null check (object_type in ('company','contact','lead')),
  view_scope   text   not null default 'owner'
               check (view_scope in ('owner','team','everyone')),
  edit_scope   text   not null default 'owner'
               check (edit_scope in ('owner','team','everyone')),
  updated_by   varchar,
  updated_date timestamptz default now(),
  unique (project_id, object_type)
);
```

**Defaults to seed** (per Part 2.3): for every project insert
`('company','everyone','owner')`, `('contact','everyone','owner')`,
`('lead','owner','owner')`. Missing row ⇒ treat as the object's documented default (so
new projects are safe-by-default even before a row exists).

**Reader helpers** make RLS policies short and consistent:

```sql
create or replace function can_view(object_type text, p_project bigint, owner bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select
    is_admin() or is_qc()                                   -- always-on overrides
    or owner = current_user_id()                            -- owner
    or sees_downline(owner)                                 -- manager cascade (view)
    or case coalesce(
              (select view_scope from project_visibility_setting
                where project_id = p_project and object_type = $1),
              case when $1 = 'lead' then 'owner' else 'everyone' end)  -- default
         when 'everyone' then is_project_member(p_project)
         when 'team'     then sees_downline(owner)          -- owner's team chain
         else false                                         -- 'owner' handled above
       end;
$$;

create or replace function can_edit(object_type text, p_project bigint, owner bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select
    is_admin()
    or owner = current_user_id()
    or case coalesce(
              (select edit_scope from project_visibility_setting
                where project_id = p_project and object_type = $1),
              'owner')
         when 'everyone' then is_project_member(p_project)
         when 'team'     then sees_downline(owner)
         else false
       end;
$$;
```

> Note `can_view` includes QC + the manager cascade; `can_edit` deliberately does **not**
> auto-include QC (QC is read-all) and only includes managers if `edit_scope ≥ team`
> (Owner Decision D5 if managers should always edit downline).

### 3.3 MASKING approach for contact details (phone / email / LinkedIn) — RECOMMENDATION

Three candidate approaches:

- **(a) Secured Postgres VIEW that null-masks columns for non-owners.** A view
  `contact_master_v` selects all columns, but wraps phone/email/linkedin in a
  `CASE WHEN <viewer is owner/manager/QC/admin> THEN col ELSE NULL END`. RLS on the base
  table still controls *row* visibility; the view adds *column* masking. Frontend queries
  the **view** for lists/detail; writes still go to the base table (owner only).
  - **Pros:** simplest to ship; single source of truth for masking logic; no data
    migration; easy to extend to more private fields; the public name+city+status stay
    visible so dedup still works. **Recommended.**
  - **Cons:** must remember to point all *read* paths at the view; a view isn't updatable
    by default (fine — we write to the base table). Need `security_invoker = true` (PG15+,
    Supabase is on 15+) so the view runs with the caller's RLS, not the definer's.
- **(b) Split private details into a side table (`contact_private`) with stricter RLS.**
  Move phone/email/linkedin into `contact_private(contact_id, ...)` whose RLS only admits
  owner/manager/QC/admin; join it in for those users.
  - **Pros:** "private by construction" — a non-owner literally cannot select the columns;
    cleanest security boundary; good if private fields grow into a sensitive cluster.
  - **Cons:** schema migration + data move now (607 contacts), every read/write touches two
    tables, more app churn. Heavier than needed for v1.
- **(c) Column privileges + a view.** `REVOKE SELECT (phone,email,linkedin)` from
  `authenticated`, expose them only through a definer view to permitted users.
  - **Pros:** belt-and-suspenders at the privilege layer (we already use column REVOKE for
    `user_master.password`, so the pattern is proven here).
  - **Cons:** column privileges are **role-wide, not per-row** — they can't say "owner yes,
    non-owner no" by themselves, so they still need the view/side-table to do the per-row
    decision. Useful as a hardening *add-on*, not a standalone solution.

> **RECOMMENDATION: (a) the secured `security_invoker` view for v1**, optionally hardened
> later with (c)'s column REVOKE as defense-in-depth. Reserve (b) for if/when the set of
> private fields grows. **The frontend should query the masking VIEW for all contact reads
> (lists + detail) and write to the base table.** Same pattern can wrap `company_master`
> if any company field ever needs masking (none required today).

Masking predicate (who may see the private columns):

```sql
-- inside the view:
case when is_admin() or is_qc()
       or cps.owner_user_id = current_user_id()       -- per-project contact owner
       or sees_downline(cps.owner_user_id)            -- owner's managers
     then cm.email else null end as email,
-- ...same for phone, linkedin_url/linkedin_clean
```

(Owner here is the **per-project** `contact_project_status.owner_user_id`; if a contact is
viewed outside any project context, fall back to `contact_master.created_by`.)

### 3.4 Concrete example RLS policies

Assumes `current_user_id()`, `is_admin()`, `is_qc()`, `sees_downline()`,
`is_project_member()`, `can_view()`, `can_edit()` exist (3.0–3.2). These **replace the
current blanket `FOR ALL ... USING(true)` baseline** on these six tables only; all other
tables keep the baseline until later phases.

**lead_master** (owner = `created_by::bigint`; closed by default):

```sql
alter table lead_master enable row level security;

create policy lead_select on lead_master for select to authenticated
using ( can_view('lead', project_id, created_by::bigint) );

create policy lead_insert on lead_master for insert to authenticated
with check ( is_admin()
          or (is_project_member(project_id) and created_by::bigint = current_user_id()) );

create policy lead_update on lead_master for update to authenticated
using      ( can_edit('lead', project_id, created_by::bigint) )
with check ( can_edit('lead', project_id, created_by::bigint) );

create policy lead_delete on lead_master for delete to authenticated
using ( is_admin() or created_by::bigint = current_user_id() );
```

**company_master** — note companies have no single `project_id`; project context comes
from `company_project_status`. Companies are global target records, so **row** visibility
is broad (name+city public); masking is at the column/view layer (3.3). Edit is gated by
per-project ownership where it exists:

```sql
alter table company_master enable row level security;

-- See the company row if you share ANY project with it, or it's unowned (dedup), or admin/QC.
create policy company_select on company_master for select to authenticated
using (
  is_admin() or is_qc()
  or exists (                                   -- visible via any project the user is in
       select 1 from company_project_status cps
       where cps.company_id = company_master.company_id
         and can_view('company', cps.project_id, cps.owner_user_id))
  or not exists (                               -- unowned/unscoped company => visible (dedup)
       select 1 from company_project_status cps2
       where cps2.company_id = company_master.company_id)
);

create policy company_insert on company_master for insert to authenticated
with check ( is_admin() or current_user_id() is not null );  -- any member can create (dedup-checked in app)

create policy company_update on company_master for update to authenticated
using (
  is_admin()
  or exists (select 1 from company_project_status cps
             where cps.company_id = company_master.company_id
               and can_edit('company', cps.project_id, cps.owner_user_id))
) with check ( true );

create policy company_delete on company_master for delete to authenticated
using ( is_admin() );
```

**contact_master** — same shape; project context from `contact_project_status`; **private
columns are masked by the view, not by row RLS** (the row is visible so dedup works):

```sql
alter table contact_master enable row level security;

create policy contact_select on contact_master for select to authenticated
using (
  is_admin() or is_qc()
  or exists (select 1 from contact_project_status cps
             where cps.contact_id = contact_master.contact_id
               and can_view('contact', cps.project_id, cps.owner_user_id))
  or not exists (select 1 from contact_project_status cps2
                 where cps2.contact_id = contact_master.contact_id)
);

create policy contact_insert on contact_master for insert to authenticated
with check ( is_admin() or current_user_id() is not null );

create policy contact_update on contact_master for update to authenticated
using (
  is_admin()
  or exists (select 1 from contact_project_status cps
             where cps.contact_id = contact_master.contact_id
               and can_edit('contact', cps.project_id, cps.owner_user_id))
) with check ( true );

create policy contact_delete on contact_master for delete to authenticated
using ( is_admin() );
```

**contact_project_status** (the per-project working record; owner = `owner_user_id`):

```sql
alter table contact_project_status enable row level security;

create policy cps_select on contact_project_status for select to authenticated
using ( can_view('contact', project_id, owner_user_id) );

create policy cps_insert on contact_project_status for insert to authenticated
with check ( is_admin() or is_project_member(project_id) );

create policy cps_update on contact_project_status for update to authenticated
using      ( can_edit('contact', project_id, owner_user_id) )
with check ( can_edit('contact', project_id, owner_user_id) );

create policy cps_delete on contact_project_status for delete to authenticated
using ( is_admin() or owner_user_id = current_user_id() );
```

**company_project_status** (mirror of the above; owner = `owner_user_id`):

```sql
alter table company_project_status enable row level security;

create policy cmps_select on company_project_status for select to authenticated
using ( can_view('company', project_id, owner_user_id) );

create policy cmps_insert on company_project_status for insert to authenticated
with check ( is_admin() or is_project_member(project_id) );

create policy cmps_update on company_project_status for update to authenticated
using      ( can_edit('company', project_id, owner_user_id) )
with check ( can_edit('company', project_id, owner_user_id) );

create policy cmps_delete on company_project_status for delete to authenticated
using ( is_admin() or owner_user_id = current_user_id() );
```

**interaction** (call dispositions / activity log). The owner's rule: dispositions/remarks
are part of the **public working info**, so SELECT follows the parent object's view scope;
write is allowed to any project member who can view the record (so colleagues can log
calls), with owner/manager/admin always able. `interaction` should carry `project_id` and
the related `contact_id`/`company_id`/`lead_id`:

```sql
alter table interaction enable row level security;

create policy interaction_select on interaction for select to authenticated
using (
  is_admin() or is_qc()
  or (contact_id is not null and exists (
        select 1 from contact_project_status cps
        where cps.contact_id = interaction.contact_id
          and can_view('contact', cps.project_id, cps.owner_user_id)))
  or (company_id is not null and exists (
        select 1 from company_project_status cps
        where cps.company_id = interaction.company_id
          and can_view('company', cps.project_id, cps.owner_user_id)))
  or (lead_id is not null and exists (
        select 1 from lead_master lm
        where lm.lead_id = interaction.lead_id
          and can_view('lead', lm.project_id, lm.created_by::bigint)))
);

create policy interaction_insert on interaction for insert to authenticated
with check ( is_admin() or created_by::bigint = current_user_id() );

create policy interaction_update on interaction for update to authenticated
using ( is_admin() or created_by::bigint = current_user_id() );   -- edit your own log entries

create policy interaction_delete on interaction for delete to authenticated
using ( is_admin() );
```

> **Performance note:** these policies fan out into `EXISTS` subqueries and a recursive CTE
> per row. Add indexes: `contact_project_status(contact_id)`, `(project_id, owner_user_id)`;
> `company_project_status(company_id)`, `(project_id, owner_user_id)`;
> `user_master(manager_id)`; `interaction(contact_id)`, `(company_id)`, `(lead_id)`,
> `(project_id)`; `lead_master(created_by)`, `(project_id)`; `project_user(user_id,
> project_id)`. Mark all helper functions `STABLE` so the planner caches them per statement.

### 3.5 Frontend changes implied

1. **Read contacts through the masking view.** `src/data/contacts.ts` (and any company read
   that masks) point list + detail reads at `contact_master_v` instead of `contact_master`;
   writes stay on the base table. The UI must gracefully render **blank / "Hidden — owned by
   {owner}"** for masked phone/email/LinkedIn rather than empty-looking fields, so users
   understand *why* it's blank (and could request access).
2. **Per-project access settings UI** (Admin + Team Lead / project leader). A small settings
   panel per project: three rows (Company / Contact / Lead), each with a **View** dropdown
   (Owner-only / Team / Everyone) and an **Edit** dropdown (same), writing to
   `project_visibility_setting`. Gated to ADMIN + the project's TEAM_LEAD/SALES_HEAD.
   Lives naturally in the Admin → Projects area and/or a project header action.
3. **Reporting-line UI.** In Admin → Users, a **"Manager"** picker per user (writes
   `user_master.manager_id`). Optional later: a per-project manager override in the
   project's user assignment screen.
4. **Owner display, not just IDs.** Lists already resolve `created_by`/`owner_user_id` to
   names — keep that; the masked view should also expose the owner's name so the UI can say
   "owned by Priya" on a masked record.
5. **No more "everyone edits everything."** Buttons (Edit / Delete / change-status) should be
   shown/enabled based on the same scope logic (call a lightweight `can_edit` check or just
   attempt and handle the RLS denial), so the UI matches what the DB will allow.
6. **QC views.** QC's read-all is automatic via RLS; no special frontend besides not hiding
   modules from the QC role.

---

## PART 4 — PHASED PLAN + OWNER DECISIONS

### 4.1 Phased implementation plan

**Phase V1 — "secure-enough" (smallest safe step, fixed scopes, no UI dials yet):**
1. Add `user_master.manager_id` + backfill the reporting line (admin one-time data entry).
2. Add helper functions: `current_user_id()`, `is_admin()`, `is_qc()`, `downline_ids()`,
   `sees_downline()`, `is_project_member()`.
3. Add the **masking view** `contact_master_v`; repoint the frontend contact reads to it.
4. Replace the blanket baseline on the six tables with policies that hard-code the
   **default** scopes (companies/contacts public+masked, leads owner-closed, manager
   cascade, QC read-all, admin all). **No settings table consulted yet** — defaults only.
5. Verify adversarially: owner sees own; colleague sees masked; manager sees downline +
   unmasked; QC sees all; admin all; anon still denied. Keep the auto-rollback discipline
   from the existing RLS pass.

> After V1 the product already satisfies every owner requirement *at the default settings*.
> It is safe to deploy. What's missing is only the **configurability** (the dials).

**Phase V2 — full configurable model:**
6. Add `project_visibility_setting` + `can_view()` / `can_edit()` readers; seed defaults.
7. Switch the six tables' policies from hard-coded defaults to the settings-driven helpers.
8. Build the **per-project access settings UI** (Admin + TL/SH) and the **Manager** picker.
9. Optional: per-project manager override (`project_user.manager_user_id`) if any project
   needs different reporting lines.
10. Optional hardening: column `REVOKE` on private contact columns as defense-in-depth.

**Phase V3 — extensions (only if needed):**
- Side-table split for private fields (approach 3.3b) if the private cluster grows.
- A full teams model (3.1 Option B) only if reporting lines become genuinely multi-team.
- Field-level masking config in the UI (let admins tag which fields are "private").

### 4.2 DECISIONS NEEDED FROM THE OWNER (plain language)

These are the choices only you can make. Each has a recommended default so we can proceed
if you just say "use the defaults."

- **D1 — Default contact/company width.** We propose **"Everyone in the project can see the
  name, city and all working notes; phone/email/LinkedIn hidden except owner + their
  managers + QC + Admin."** Confirm this is the right default. *(Recommended: yes.)*

- **D2 — One manager per person, or per-project managers?** Simplest is **one manager per
  person company-wide**. Do any people report to a *different* lead on *different* projects?
  If rarely, we ship the simple version now and add per-project overrides later.
  *(Recommended: one manager now; add overrides only if a project needs it.)*

- **D3 — Leads default.** Leads start **closed (owner-only)**, opened per project by the
  TL/Admin. Confirm leads should not be visible project-wide by default. *(Recommended: yes,
  keep closed.)*

- **D4 — Who can change the access dials?** We propose **Admin always, plus the project's
  Team Lead / Sales Head**. Or should it be **Admin only**? *(Recommended: Admin + project
  TL/SH.)*

- **D5 — Can a manager EDIT a downline's records, or only SEE them?** Managers always *see*
  their team's records. Should they also be able to *edit/correct* them by default, or only
  when the project's Edit dial is set to Team/Everyone? *(Recommended: see-always;
  edit-only-when-dial-allows, to avoid accidental manager edits.)*

- **D6 — QC scope.** QC sees **all records, read-only**, across all projects. Confirm QC
  should NOT be able to edit (just review). *(Recommended: read-only.)*

- **D7 — Can colleagues log a call (interaction) on a record they don't own?** The "public
  working info" requirement implies **yes — any project member who can see the record can
  add a disposition/remark**, but cannot see the masked phone/email. Confirm, or restrict
  logging to the owner + managers. *(Recommended: allow project members to log; keeps the
  shared working-notes behavior you described.)*

- **D8 — Masking technique.** We recommend the **masking view** (fastest, no data move).
  No action needed unless you want the stronger "separate private table" now. *(Recommended:
  view now.)*

---

## Appendix — Mapping to the existing codebase (for the next session)

- Ownership columns to use (verified, do not regress): leads `lead_master.created_by`
  (= `user_master.user_id`), company via `lead_master.client_assoc_id`; per-project owners
  on `contact_project_status.owner_user_id` / `company_project_status.owner_user_id`.
- The current RLS baseline lives in `new-code/migration/rls-policies.sql`
  (blanket `authenticated` full access; `profiles` SELECT-only). This design **replaces the
  baseline on six tables only**; everything else keeps the baseline until later phases.
- The per-project status tables already exist:
  `new-code/migration/feature-status-schema.sql` (`contact_project_status`,
  `company_project_status`, `dropdown_option`, `user_view_pref`).
- Prior product decisions this aligns with:
  `docs/product/COMPANIES-CONTACTS-BLUEPRINT.md` (per-project ownership, masked visibility:
  names+city to all, details to owner+downline) and
  `docs/product/HUBSPOT-SALES-REFERENCE-PRD.md`. Key divergence preserved: **HubSpot owner =
  global; AltLeads owner = per-project.**
- `interaction` table needs `project_id` + related-object FK columns
  (`contact_id`/`company_id`/`lead_id`) for the RLS in 3.4 to key on; verify these exist or
  add them.

---

## PART 9 — LOCKED ROLE CAPABILITIES (Ankit, 2026-06-28) — build to these exactly

These supersede ambiguity above. They are the rules to implement in RLS + UI gating for the **HungerBox** launch. Validate every UPDATE policy on a throwaway role login before prod.

### Edit = the ASSIGNED OWNER, never the creator (DEC-03)
- A record's editor-of-record is its **assignee** (`lead_report.user_id`), NOT `created_by`. The assigned owner **must be able to edit** their record. `created_by` is immutable provenance only. (Closes GAP-2 / ALT-152.)

### AGENT (role 3)
- Edits ONLY: **pre-sales questions** (the per-company/per-site prequalified answers — site employees, commercial model, etc.) AND lead fields **from "Meeting Scheduled" onward** (the outcome/report fields after that stage).
- Does **NOT** edit **company or contact master** records at all. (So agent UPDATE on `company_master`/`contact_master` is denied; agent edits flow to the prequalified-answers tables + `lead_report`/report fields only.)
- Pre-sales answers are seeded from the city/site questions (they only come from there). An Agent may also hold the **QC** role (acts as agent + can QC-approve leads for the project).

### QC (role 6) — "like a Team Lead, minus assignment"
- Can **edit any record** in their project (safe-edit, project-scoped) and **approve** — but **CANNOT assign/reassign** records.
- **Reads/views all.** (Implementation: QC gets TL-equivalent UPDATE + approve rights, but NO reassign capability; `isApprover` already includes QC.)

### TEAM_LEAD (role 2)
- **Is an approver** — must be able to **approve** (verify `useAuth().isApprover` → Approve button shows for TL; GAP-6). Can reassign within project.

### SALES roles (SALES_HEAD 4 / SALES_PERSON 5) — separate portal, NOT in scope now
- They are the **"sales owner"** of **leads only** (never companies/contacts/other modules) — a sales-owner is distinct from the CRM owner, so two owners on a lead is fine and expected.
- Sales users **cannot edit anything** in the CRM. They may only **request an edit** or **provide feedback**. (RLS: no UPDATE on master tables for sales roles; route to a request/feedback path.)
- Sales portal scoping (downline RLS) is **deferred** — Ankit is not working on the sales portal right now; do not provision sales logins until that lands.

### Prequalified-question granularity — admin, per-project toggle
- The per-site prequalified answers can be answered **company-wide OR site-wise**. A **toggle lives in admin settings, per project**, so each project picks its granularity (project power). Extends the HungerBox `company_site` model.

### Related new requirements (tickets added)
- **Advanced per-field filters with exclude/NOT** (HubSpot-style; e.g. "company NOT in DNC", "city is none of…") — spec in `docs/product/ADVANCED-FILTERS-SPEC.md`. → ALT-460.
- **Saved views — per project, per user** (serialized filter + sort + columns + name) — extends `data/views.ts`. → ALT-461.
- **Call logs broken** — fix. → ALT-462.

### Ticket map
ALT-152/ALT-433 (assignee edit + RLS) · ALT-458 (agent edit scope: pre-sales + post-meeting-scheduled only, no company/contact) · ALT-459 (QC = TL-minus-assign; agent-can-be-QC) · ALT-463 (sales = read+request-edit+feedback only, no master UPDATE) · ALT-464 (prequalified company-vs-site toggle, per-project admin setting) · ALT-460 (advanced filters) · ALT-461 (saved views) · ALT-462 (call logs fix).

---

## PART 9A — IMPLEMENTATION (2026-06-28) — what was built

### Helper functions reused (DB — all SECURITY DEFINER, already existed)
| Function | Used for |
|---|---|
| `is_admin()` | Admin bypass on all UPDATE/DELETE policies |
| `is_qc()` | QC = TL-equivalent UPDATE access |
| `current_user_id()` | Resolves `auth.uid()` → `profiles.user_id` (bigint) |
| `is_member(pid)` | Project membership check (used in existing lead_master SELECT) |
| `manages_project(pid)` | TL can edit any lead in their project |

Note: `manages_user()` is a DB stub (always returns false) — downline hierarchy not built. `assigned_to()` / `downline_ids()` do not exist; assignee-check uses `lead_report.user_id = current_user_id()` directly.

### Staged RLS migration — `new-code/migration/apply-access-control-rls.cjs`
**Status: STAGED — `node -c` syntax-checked only. NOT executed against any DB.**

| Table | Policy | Rule |
|---|---|---|
| `lead_report` | `lead_report_select_all_authenticated` | SELECT: all authenticated users |
| `lead_report` | `lead_report_update_role_scoped` | UPDATE: Admin (always) · QC (any row) · TL (any row) · Agent (own `user_id` + `stage_id >= 4` only) · Sales: DENIED |
| `lead_report` | `lead_report_insert_admin_tl` | INSERT: Admin + TL only |
| `lead_report` | `lead_report_delete_admin_only` | DELETE: Admin only |
| `lead_master` | `lead_master_deny_agent_update` | RESTRICTIVE: blocks pure-agent UPDATE on lead_master (agents write to lead_report, not lead_master) |
| `lead_master` | `lead_master_deny_sales_update` | RESTRICTIVE: blocks pure-sales UPDATE on lead_master (ALT-463) |
| `company_master` | `company_master_update_internal_managers` | UPDATE: Admin + QC + TL; agents/sales DENIED; removes legacy created_by owner-edit (DEC-03) |
| `company_master` | `company_master_delete_admin_only` | DELETE: Admin only |
| `contact_master` | `contact_master_update_internal_managers` | UPDATE: Admin + QC + TL; agents/sales DENIED |
| `contact_master` | `contact_master_delete_admin_only` | DELETE: Admin only |

Drops/replaces: `lead_report.authenticated_full_access` (was wide-open), `company_master_update_owner_or_admin`, `contact_master_update_owner_or_admin` (both now superseded by manager-scoped versions).

### New `useAuth()` flags — `new-code/web/src/contexts/AuthContext.tsx`
| Flag | Value | Notes |
|---|---|---|
| `isQC` | `roles.includes('QC')` | NEW — QC = TL-minus-assign |
| `isAgent` | `roles.includes('AGENT')` | NEW — agent edit scope gating |
| `isApprover` | `isAdmin \|\| isTeamLead \|\| isQC` | CONFIRMED includes QC (was already correct) |
| `canEditCompanyContact` | `isAdmin \|\| isTeamLead \|\| isQC` | NEW — Admin/TL/QC only; agents/sales denied |
| `canReassign` | `isAdmin \|\| isTeamLead \|\| isSalesHead` | UNCHANGED — QC excluded by design (Part 9) |

### Feature flag — `new-code/web/src/lib/roleGating.ts`
```
STRICT_ROLE_GATING = false   // flip to true after throwaway-login RLS validation
```
All new UI restrictions (`canEditCompanyContact` gate on Edit/Link buttons, `agentCanEditLeadReport()` gate on StageSelect) are wrapped in `gated(strictValue, legacyValue)`. When false, prod behaviour is identical to before.

### UI gating applied (all behind `STRICT_ROLE_GATING`)
| Location | What is gated | Strict rule |
|---|---|---|
| `ContactDetailPage.tsx` | "Edit" pencil button (contact_master) | `canEditCompanyContact` (Admin/TL/QC only) |
| `CompanyDetailPage.tsx` | "Link existing contact" button (writes `contact_master.company_id`) | `canEditCompanyContact` |
| `LeadDetailPage.tsx` | StageSelect `disabled` prop | Agent: `agentCanEditLeadReport()` — disabled if `stage_id < 4` |
| `CompanyDetailPage.tsx` | "Change owner / Assign owner" already gated on `canReassign` (excludes QC) | no change needed |
| `LeadDetailPage.tsx` | "Change salesperson" already gated on `canReassign` (excludes QC) | no change needed |
| `CompanyDetailPage.tsx` | "Add new contact", "New lead" already gated on `canCreateData` (admin only) | no change needed |

### VALIDATION PLAN (throwaway-login checks before flipping STRICT_ROLE_GATING=true and applying RLS)
See the full plan in `new-code/migration/apply-access-control-rls.cjs` (top of file).

Summary per role:

**AGENT** (role 3, assigned to TEST_LEAD):
- UPDATE lead_report where user_id=self AND stage_id>=4 → must succeed
- UPDATE lead_report where stage_id<4 → must fail (RLS blocks)
- UPDATE lead_report where lead not assigned to self → must fail
- UPDATE company_master / contact_master → must fail
- UI: Edit button hidden, Link-contact hidden, StageSelect disabled for pre-Meeting-Scheduled

**QC** (role 6):
- UPDATE lead_report any row → must succeed
- UPDATE company_master / contact_master → must succeed
- UI: Edit button visible, Approve button visible, Reassign button hidden (canReassign=false)

**TEAM_LEAD** (role 2):
- UPDATE lead_report / company_master / contact_master → must succeed
- UI: Edit visible, Approve visible, Reassign visible

**SALES** (role 4/5):
- UPDATE lead_master / lead_report / company_master / contact_master → all must fail
- SELECT lead_master → must succeed (read still open)

**ADMIN** (role 1):
- All UPDATE/DELETE/INSERT → must succeed (unchanged)
