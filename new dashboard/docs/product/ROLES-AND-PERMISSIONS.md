# Roles & Permissions

*Purpose: Plain-language description of the six user roles in the Amplior CRM and a single matrix showing exactly what each role is allowed to do. This is the **source of truth** for the database security rules (RLS) that must be built before go-live.*

*Last updated 2026-06-12*

---

## How to read this document

The CRM has **six roles**. A role decides two things:

1. **What a person can see** — for example, an agent sees only their own leads; an admin sees everything.
2. **What a person can do** — for example, only a Team Lead can approve a lead report; only an Admin can add new users.

These rules came from three sources, in order of trust:

1. The **FRS V2.0** (the official requirements document — the most authoritative).
2. The **old vendor system** (how it actually behaved in production).
3. The **real migrated data** (what's actually in the database today).

Where the three sources disagree, or where the rule was never written down, the cell is marked **"TBD — confirm with owner"**. Please treat those as open questions to answer before we lock the security rules.

> **One important split to know about (from the FRS):** the system was designed as **two apps**. The **web app** is for the **Amplior internal team** (Admin, Team Lead, Agent). The **mobile app** is for the **Client sales team** (Sales Head, Salesperson). This shapes the permissions below — for example, Salespersons do most of their work (marking meetings done, giving feedback) on the phone, not the web. In the rebuild we may merge some of this into one web app; that decision is noted as a TBD where it matters.

---

## The six roles, in plain language

### 1. ADMIN (Amplior internal — "Super Admin")
The owner/operator of the whole system. Sees **everything**, can do **everything**. Manages users, clients, projects, roles, and all the reference lists (designations, domains, access rules). This is Mohit's role and the role of senior Amplior operations staff. In the old system this was `role_id = 1`.
*Source: FRS "Super Admin Module"; live data confirms the role exists.*

### 2. TEAM_LEAD (Amplior internal — "TL")
The manager of a group of agents. The TL is the **gatekeeper of quality**: agents send their lead reports to the TL, and **only the TL can approve or reject them** before a meeting goes ahead. TLs can also import leads in bulk (Excel), reassign a lead from one agent to another, and override or cancel meetings their agents created.
*Source: FRS glossary ("TL = Team Lead"), FRS Lead Report Approval rules, FRS Import-Excel rules.*

### 3. SALES_HEAD (Client side — "SH")
A senior person on the **client's** sales side. Receives approved meetings and **assigns / delegates them to the right Salesperson**. Can also change a meeting's status (e.g. mark it Completed) and oversees the client team's follow-through. Works mainly on the **mobile app**.
*Source: FRS glossary ("SH = Sales Head"), FRS objective #7 "Sales Head to Salesperson Meeting Assignment", FRS lead-stage table.*

### 4. SALES_PERSON (Client side)
The client's sales rep who actually **attends the meeting** with the prospect. After the meeting they **mark it Completed and fill in the feedback form**, and can move the lead forward (e.g. to "Meeting Successful" or "Meeting Follow-Up"). Works mainly on the **mobile app**. In the old system this was `role_id = 5`.
*Source: FRS Meeting Feedback rules, FRS lead-stage table.*

### 5. AGENT (Amplior internal)
The Amplior tele-sales / pre-sales person who **owns the lead day-to-day**. Creates and edits their leads, logs activities and notes, fills in the pre-sales questionnaire (the "lead report"), schedules the meeting details, and **requests approval** from their Team Lead. An agent normally sees **only their own leads**, not the whole company's.
*Source: FRS Lead Management & Lead Report rules; REBUILD_LOG (lead ownership = `created_by`).*

### 6. QC (Quality Check)
A quality-control reviewer. **This role exists in the live database but is NOT described anywhere in the FRS V2.0.** Its exact powers are unknown — most likely a **read/review** role over leads, reports, and meeting feedback for quality auditing, possibly with no edit rights. **All QC permissions below are marked TBD until the owner confirms what QC people actually do.**
*Source: live migrated data only — no FRS definition found.*

---

## Quick "who owns what" summary

| Concept | Who | Notes |
|---|---|---|
| **Lead ownership** | the **Agent** who created it (`lead_master.created_by`) | RLS "own lead" = `created_by` matches the logged-in user. (Old `agent_id` column is mostly empty — do **not** use it.) |
| **Lead report approval** | **Team Lead** only | Agent requests → TL approves/rejects. |
| **Meeting assignment** | **Sales Head** → **Salesperson** | SH delegates the approved meeting to a rep. |
| **Meeting feedback** | **Salesperson** fills it; **Agent + TL** view it | Done on mobile after the meeting. |
| **All admin/reference data** | **Admin** only | Users, clients, projects, roles, designations, domains, access. |

---

## THE PERMISSIONS MATRIX

**Legend:**
`✓` = allowed · `✗` = not allowed · **own only** = allowed but limited to records the user owns or is assigned to · **TBD** = "TBD — confirm with owner"

| # | Action / Resource | ADMIN | TEAM_LEAD | SALES_HEAD | SALES_PERSON | AGENT | QC |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | **View all leads** (whole company) | ✓ | TBD (team only?) | ✗ | ✗ | ✗ | TBD |
| 2 | **View own / assigned leads** | ✓ | ✓ | own only | own only | own only | TBD |
| 3 | **Create lead** | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ |
| 4 | **Edit lead** (company & contact details, notes) | ✓ | ✓ | ✗ | ✗ | own only | TBD |
| 5 | **Import leads via Excel (bulk)** | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| 6 | **Assign / reassign lead to a different agent** | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| 7 | **Change lead stage** (early stages: New → Qualified, etc.) | ✓ | ✓ | ✗ | ✗ | own only | TBD |
| 8 | **Change lead stage at meeting outcome** (→ Meeting Successful / Follow-Up) | ✓ | ✓ | ✓ | ✓ | ✗ | TBD |
| 9 | **Fill pre-sales questionnaire / lead report** | ✓ | ✓ | ✗ | ✗ | own only | ✗ |
| 10 | **Request lead-report approval** | n/a | n/a | ✗ | ✗ | ✓ | ✗ |
| 11 | **Approve / reject lead report** | TBD (Admin override?) | ✓ | ✗ | ✗ | ✗ | TBD |
| 12 | **Add the meeting details & agenda to a lead** | ✓ | ✓ | ✗ | ✗ | own only | ✗ |
| 13 | **Assign a meeting to a Salesperson** | ✓ | TBD | ✓ | ✗ | ✗ | ✗ |
| 14 | **Schedule a meeting** (create, after report approved) | ✓ | ✓ | ✗ | ✗ | own only | ✗ |
| 15 | **Reschedule a meeting** | ✓ | ✓ | TBD | own only | own only | ✗ |
| 16 | **Cancel a meeting** | ✓ | ✓ (incl. agents' meetings) | TBD | own only | own only | ✗ |
| 17 | **Mark meeting Completed** | ✓ | TBD | ✓ | own only | ✗ | ✗ |
| 18 | **Give / submit meeting feedback** | ✗ | ✗ | TBD | ✓ (own meetings) | ✗ | ✗ |
| 19 | **View meeting feedback** | ✓ | ✓ | TBD | own only | own only (own meetings) | TBD |
| 20 | **View Wishlist** | ✓ | ✓ | TBD | TBD | ✓ | TBD |
| 21 | **Add to / manage Wishlist** | ✓ | ✓ | TBD | TBD | own only | TBD |
| 22 | **Assign Wishlist item** | ✓ | ✓ | TBD | ✗ | TBD | ✗ |
| 23 | **View Dashboard** | ✓ (all data) | ✓ (team data) | ✓ (own data) | ✓ (own data) | ✓ (own data) | TBD |
| 24 | **View notifications** | ✓ | ✓ | ✓ | ✓ | ✓ | TBD |
| 25 | **Manage users** (add/edit, activate/deactivate, set role) | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| 26 | **Manage projects** | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| 27 | **Manage clients** | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| 28 | **Manage reference data** (designations, domains, roles) | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| 29 | **Manage access rules / permissions** (RBAC settings) | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| 30 | **Export data to Excel** (Leads / Meetings) | ✓ | ✓ | TBD | TBD | own only | TBD |

---

## Notes on specific cells (why a rule is what it is, or why it's TBD)

- **Rows 1–2 (lead visibility):** The FRS says login is "role-based" and agents are redirected to "their" lead module, and the rebuild has confirmed lead ownership lives in `created_by`. So Agents/Salespersons = **own only** is solid. What's **TBD** is the *manager scope*: does a **Team Lead** see the whole company's leads, or only the leads of agents on *their* team? The FRS implies team-based grouping (projects assign a TL + agents) but never states the read boundary. The REBUILD_LOG's interim plan is "managers see all for now, tighten to team-scope later." **Confirm with owner: should TL/SALES_HEAD be limited to their own team/project?**
- **Row 5 (Excel import):** FRS is explicit — "Only Team Leads and Admins can access Import Excel; regular users (Agents) do not."
- **Row 6 (reassign lead):** FRS is explicit — "Only Admin or Team Lead are authorized to assign or reassign a lead."
- **Rows 8 & 17 (meeting-outcome stage / mark completed):** FRS lead-stage table names **Salesperson or Sales Head** as the ones who move a lead to "Meeting Successful"/"Follow-Up" and mark meetings completed (done on mobile). Admin retains override by virtue of being Admin.
- **Row 11 (approve lead report):** FRS is explicit — "**Only Team Leads can approve or reject lead reports.**" Whether an **Admin** can also approve (as a super-user override) is **TBD**. The old system *did* have an "Approve Lead Reports" permission that could in theory be granted to other roles, so this is configurable — confirm the intended default.
- **Row 13 (assign meeting to Salesperson):** FRS objective #7 gives this to **Sales Head**. Whether a **Team Lead** can also assign the salesperson during approval is implied by the lead-report flow but not stated as a hard rule — **TBD**.
- **Rows 18–19 (feedback):** FRS is explicit — Salesperson *submits* feedback; **"Only the Agent who created the meeting and the Team Lead can view the feedback."** Admin view assumed via super-user status.
- **Rows 20–22 (Wishlist):** The FRS describes Wishlist as a sales-team feature with geo-tagging (mobile), and the old system had separate "Wishlist" and "Assign Wishlist" permissions, but it does **not** cleanly state which of the six roles may do what. Agent create + Admin/TL manage is the safe baseline; **Sales Head / Salesperson involvement is TBD.**
- **Row 23 (dashboard scope):** Everyone gets a dashboard, but the *data* it shows should be filtered to what that role can see (same boundaries as lead visibility). The exact team-vs-own scope for managers is the same open question as rows 1–2.
- **Rows 25–29 (admin module):** FRS is explicit and consistent across User, Client, Project, Role, Designation, Domain, and Access management — **"Only Admin can…"** in every section.
- **Row 30 (Excel export):** Export is the vendor's paid change-request feature; the FRS doesn't pin it to specific roles. Default proposal: anyone who can *see* the data can export the rows they see (so Agents export own-only). **Confirm with owner** whether export should be restricted further (e.g. Admin/TL only) for data-leakage reasons.
- **QC column (entire):** No FRS definition exists. Until the owner confirms, assume QC is **read-only over leads / reports / feedback for auditing** and grant nothing that writes data. **Every QC cell is TBD by default.**

---

## Open questions for the owner (please confirm before we lock security rules)

1. **Manager scope:** Should TEAM_LEAD and SALES_HEAD see **all** company leads/meetings, or only those of **their own team / project**? (Affects rows 1, 2, 19, 23.)
2. **QC role:** What does a QC person actually do? Read-only auditor, or do they edit/flag anything?
3. **Admin override on approvals:** Can ADMIN approve/reject lead reports too, or is that strictly TEAM_LEAD?
4. **Who assigns the Salesperson** to a meeting — Sales Head only, or Team Lead as well (during approval)?
5. **Wishlist:** Which roles can view, add, and assign Wishlist items? (FRS is thin here.)
6. **Excel export:** Open to everyone for their own data, or restricted to Admin/Team Lead?
7. **Web vs mobile in the rebuild:** The original design split roles across two apps (Amplior team on web, client team on mobile). In the new web-first build, do Sales Head / Salesperson also get a **web** login, and if so with what subset of the above?

---

## Why this matters (the security note)

> **This matrix is the source of truth for the database security rules (Row Level Security / RLS) that will be implemented in Supabase before any deploy.** In the new architecture, these rules live **on the database itself**, not in the app code — which means even a buggy screen or a leaked API key cannot show one user another user's data, as long as these rules are correct.
>
> Today the rebuilt app runs with **RLS turned off** (local preview only, no internet exposure) so features can be built quickly. Per the REBUILD_LOG, **RLS is a HARD GATE: it must be applied across all 65 tables before the very first Netlify deploy.** Each `✓ / own only` in this table becomes a specific rule; each **TBD** must be resolved with the owner first, because we cannot write a correct rule for a permission we haven't confirmed.
>
> Recommended safe default while TBDs are open: **start strict** (deny by default; Agents/Salespersons = own-only; managers = team-or-all per the owner's answer) and loosen only on explicit confirmation. It is far safer to over-restrict and open up than to over-share and claw back.
