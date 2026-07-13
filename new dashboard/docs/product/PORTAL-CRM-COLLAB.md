# Portal ↔ CRM collaboration spec — CRM-side authoring of portal content

> **Status:** SPEC / handoff (not built). **Touches the CRM → needs Ankit's sign-off before any migration or CRM-app change.** This is the "prepare to collaborate on the CRM agent" deliverable: it tells the next session working in `new-code/web` (the CRM) exactly what to build so the four governance-style modules in the Client Portal stop being read-only empty states and become real, CRM-authored content.
>
> Owner of the portal side (this app, `new-code/portal`): done/ready to consume. Owner of the CRM side: to be built per §3–§5 below.

## 1. The gap

The Client Portal already renders four "governance / partnership" modules, but in **real-data mode they show empty states** because **there is no source table and no CRM-side way to create entries**:

| Portal module | Portal route | Today (real mode) | Needs |
|---|---|---|---|
| **Review Meetings** (`Governance`) | `/governance` | Empty state | A CRM screen for TL/QC/Manager/Admin to **schedule + edit** partnership review meetings (MBR/QBR) per client. |
| **Documents** | `/documents` | Empty state | A CRM screen to **upload + categorise** client-facing docs (ICP, decks, reports). |
| **Updates** | `/updates` | Empty state | A CRM screen to **post + edit** partnership updates / announcements. |
| **Invoices** | `/invoices` | Empty state | A CRM screen to **add + edit** invoice records (number, period, amount, status, PDF). |

All four are **authored by Amplior staff** (not the client) and **read** by the client in the portal — the same pattern as Meetings (which already works because `meeting_master` is CRM-authored).

## 2. Scope & access (who authors)

- **Roles allowed to author/edit:** `ADMIN` (1), `TEAM_LEAD` (2), `QC` (6). "Manager" in the ask has **no distinct row** in `role_master` today (1 ADMIN · 2 TEAM_LEAD · 3 AGENT · 4 SALES_HEAD · 5 SALES_PERSON · 6 QC) — treat TEAM_LEAD as "manager" for now, or add a `MANAGER` role in a follow-up if the business wants it separate.
- **Every row is scoped to a client** (`client_assoc_id`, NOT NULL) and **optionally to a project** (`project_id`, nullable = "all of the client's projects"). This matches the portal's scoping model (client + global project selector).
- **Per-client visibility:** reuse the per-client portal-visibility setting (the toggle mirrored in CRM project settings ↔ portal client settings) to show/hide each module per client.

## 3. Proposed data model (4 new tables)

Greenfield tables, all in `public`, all with the standard audit + soft-delete columns this codebase uses (`created_by`, `created_date`, `updated_by`, `updated_date`, `deleted_date`). Column names follow portal card shapes in `new-code/portal/src/demo/demoData.ts` so the portal read layer maps 1:1.

### 3.1 `portal_review_meeting` (→ Review Meetings)
```
review_meeting_id  bigint  PK
client_assoc_id    bigint  NOT NULL   -- FK client_association
project_id         bigint  NULL       -- FK project (null = all projects)
title              text    NOT NULL   -- "Monthly Business Review — June"
meeting_date       date    NOT NULL
meeting_time       text                -- "16:00"
attendees          text                -- free text roster
agenda             text
status             text    NOT NULL    -- 'Upcoming' | 'Completed' (or derive from date)
join_url           text
+ created_by, created_date, updated_by, updated_date, deleted_date
```

### 3.2 `portal_document` (→ Documents)
```
document_id   bigint PK
client_assoc_id bigint NOT NULL
project_id    bigint NULL
name          text NOT NULL
category      text NOT NULL  -- 'ICP & Criteria' | 'Proposals & Decks' | 'Process' | 'Reports'
file_type     text          -- 'PDF' | 'PPT' | 'DOC' | 'XLS' (derive from extension)
file_url      text NOT NULL  -- Supabase Storage object URL (bucket: portal-docs)
size_bytes    bigint        -- (portal shows a human label)
+ audit + deleted_date
```
*Needs a Supabase Storage bucket `portal-docs` (private) + signed-URL download.*

### 3.3 `portal_update` (→ Updates)
```
update_id     bigint PK
client_assoc_id bigint NOT NULL
project_id    bigint NULL
title         text NOT NULL
body          text NOT NULL
author        text          -- display name, or author_user_id bigint → user_master
published_date timestamptz  -- defaults to created_date
+ audit + deleted_date
```

### 3.4 `portal_invoice` (→ Invoices)
```
invoice_id    bigint PK
client_assoc_id bigint NOT NULL
project_id    bigint NULL
number        text NOT NULL  -- 'AMP-2026-006'
period        text           -- 'Jun 2026'
amount_value  numeric        -- 350000
currency      text DEFAULT 'INR'
status        text NOT NULL  -- 'Paid' | 'Due' | 'Overdue'
invoice_date  date
due_date      date
file_url      text           -- optional PDF in Storage
+ audit + deleted_date
```

**RLS:** ship the tables with RLS aligned to the upcoming portal RLS pass (ALT-229 family) — author writes gated to ADMIN/TL/QC; client reads gated to the client's own `client_assoc_id`. Until that pass lands (RLS OFF in prod), the portal read layer scopes client-side, exactly as Meetings do today.

## 4. CRM-side UI (build in `new-code/web`)

Add a top-level **"Client Portal"** area (nav item, ADMIN/TL/QC only) with four sub-tabs mirroring the modules. Each tab is a standard CRM list page — **reuse the existing infra**: `AppShell`, `ListToolbar`, `MultiSelectFilter`, `ColumnCustomizer`, `ViewSwitcher`, the global `ProjectSwitcher` (scope by project), plus a **client picker** (scope by client_association). Each row has Create / Edit / Delete via a modal:

- **Review Meetings:** form = title · date · time · attendees · agenda · join URL · status. (Schedule + reschedule.)
- **Documents:** form = name · category · file upload (→ `portal-docs` bucket) · project/client. Auto-derive `file_type`/`size_bytes`.
- **Updates:** form = title · body (rich/plain) · author · publish toggle.
- **Invoices:** form = number · period · amount · currency · status · dates · optional PDF.

Each create/edit should fire an optional **portal notification** (reuse `notifyInApp` / `notify` from `new-code/web/src/lib/notify.ts`) so the client sees "New review meeting scheduled" etc.

## 5. Portal-side read layer (this app — ready to wire on the CRM agent's signal)

When the four tables exist, add fetchers to `new-code/portal/src/data/` (one module, e.g. `governanceContent.ts`) that read each table scoped by the portal user's `client_assoc_id` + the global project selection, and replace the empty states in:
`pages/Governance.tsx`, `pages/Documents.tsx`, `pages/Updates.tsx`, `pages/Invoices.tsx`.
Mapping is 1:1 with the demo shapes already in those pages (`DemoGovernance`, `DemoDoc`, `DemoUpdate`, `DemoInvoice`). Documents/Invoices downloads use signed URLs from the `portal-docs` bucket.

## 6. Backlog tickets (add to tracker, then re-run `gen-backlog-tracker.cjs`)

| Ticket | Title | Side |
|---|---|---|
| **ALT-495** | `portal_review_meeting` table + CRM CRUD (schedule/edit) + portal read | CRM + portal |
| **ALT-496** | `portal_document` table + `portal-docs` Storage bucket + CRM upload/categorise + portal download | CRM + portal |
| **ALT-497** | `portal_update` table + CRM author/edit + portal read | CRM + portal |
| **ALT-498** | `portal_invoice` table + CRM add/edit + portal download | CRM + portal |
| **ALT-499** | CRM "Client Portal" nav section + access control (ADMIN/TL/QC) + per-client visibility toggles + portal notifications on author | CRM |

## 7. Sequencing

1. Ankit signs off the data model (§3) — this is the only CRM-touching decision that blocks everything.
2. CRM agent: migrations (appliers as tracked `.cjs`, raw `.sql` gitignored) → tables → "Client Portal" CRM UI (§4) → notifications.
3. Portal: wire the read layer (§5) — fast once tables exist; replaces four empty states.
4. Fold these tables into the portal RLS pass (client-safe isolation) alongside Meetings.

---
*Cross-refs: [[client-portal-architecture-pivot]] · `docs/product/CLIENT-PORTAL.md` · `docs/product/SALES-PORTAL.md`. The wishlist write path (portal → live `wishlist` table) is a separate, already-shipped CRM capability (ALT-276) the portal now reuses — see `new-code/portal/src/data/wishlist.ts`.*
