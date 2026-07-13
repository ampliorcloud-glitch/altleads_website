# AltLeads CRM — Architecture (Plain-Language Guide)

*For: Mohit (Product Manager). Last updated: 2026-06-17.*

---

## The big picture

The system is one combined Node.js application deployed on Hostinger, talking to a Supabase cloud database. There is no separate "backend server" to manage. No Java. No MySQL. No SSH.

---

## How it is deployed (as of 2026-06-17) — CURRENT

```
  Browser / Mobile
       │
       ▼
  ┌─────────────────────────────────────────┐
  │        crm.altleads.com                 │
  │        Hostinger Node 22.x              │
  │  ┌──────────────────────────────────┐   │
  │  │  ONE Node/Express app            │   │
  │  │  new-code/notify-service/server.js│   │
  │  │                                  │   │
  │  │  • serves the React/Vite build   │   │
  │  │    (compiled HTML/CSS/JS from    │   │
  │  │     new-code/web/dist/)          │   │
  │  │                                  │   │
  │  │  • email/notify API              │   │
  │  │    POST /notify → Gmail SMTP     │   │
  │  │    GET  /health                  │   │
  │  │                                  │   │
  │  │  • admin endpoints (service-role)│   │
  │  │    POST /api/users/create        │   │
  │  │    POST /api/users/reset-password│   │
  │  └──────────────────────────────────┘   │
  │                                         │
  │  Auto-deploy: Hostinger git pull from   │
  │  AltLeads-CRM repo (clean history,      │
  │  old-code/figma/secrets excluded)       │
  └─────────────┬───────────────────────────┘
                │  HTTPS
                ▼
  ┌─────────────────────────────────────────┐
  │            SUPABASE (cloud)             │
  │  project: amplior-crm  (ap-south-1)    │
  │                                         │
  │  ┌──────────┐  ┌────────────────────┐  │
  │  │  Auth    │  │  Postgres database  │  │
  │  │(logins,  │  │  65 tables + RLS   │  │
  │  │ sessions)│  │  auto REST API      │  │
  │  └──────────┘  └────────────────────┘  │
  │  ┌──────────┐                           │
  │  │ Storage  │  (file attachments,       │
  │  │          │   profile photos)         │
  │  └──────────┘                           │
  └─────────────────────────────────────────┘
```

### Entry points in the repo

| File | What it does |
|---|---|
| `package.json` (root) | Declares the combined app; Hostinger starts here |
| `server.js` (root) | Re-exports `new-code/notify-service/server.js` |
| `new-code/notify-service/server.js` | Express server: serves `new-code/web/dist/` + all API routes |
| `new-code/web/` | React + Vite source; `npm run build` produces `dist/` |

---

## What the old Java backend did vs. what does it now

| Job the Java server did | Who does it now |
|---|---|
| Check who's logged in (auth) | **Supabase Auth** (built-in, managed) |
| Decide what each role can see/write | **Row Level Security (RLS)** — rules live inside the database itself |
| Move data between app and database | **Supabase auto-generated REST API** — every table has a secure API automatically |
| Send email notifications | **Nodemailer + Gmail SMTP** on the same Node app (amplior.ankits@gmail.com) |
| Admin actions that need elevated DB access (add user, reset password) | **Service-role endpoints** on the Node app (`/api/users/*`). The service-role key is NEVER sent to the browser — it lives only in Hostinger env vars |

---

## Authentication flow

1. User opens crm.altleads.com → served as a React SPA from `new-code/web/dist/`.
2. Login page calls Supabase Auth with email + password → Supabase returns a session JWT.
3. The JWT is stored in the browser. Every Supabase API call attaches it automatically.
4. A **`profiles` table** links each Supabase Auth user (`auth.users.id`) to their row in `user_master` plus their role string (ADMIN / TEAM_LEAD / AGENT / QC).
5. A **database trigger `handle_new_auth_user`** fires when a new auth user is created. It looks up that email in `user_master`, finds their role in `user_role → role_master`, and writes the `profiles` row automatically. This is what makes the "Add User" flow work end-to-end without manual DB edits.
6. React reads `profiles.role` to decide what to show/hide in the sidebar and which pages are accessible.

**Important:** The service-role key (which can bypass RLS) is only held by the Node server. The browser uses the anon/JWT key, which is fully gated by RLS.

---

## Database (Supabase Postgres) — key tables

### Core tables (migrated from old MySQL, 65 tables total)

| Table | What it stores |
|---|---|
| `lead_master` | Every lead (ALT#### number, company link, contact, opportunity). Ownership = `created_by` (user_id). New column: `contact_id` (link to contact_master) |
| `lead_report` | Pre-sales form for each lead (stage, approval status, salesperson, meeting details) |
| `lead_activity` | Chronological comment/event log per lead |
| `meeting_master` | Each scheduled meeting (URL, status, agent feedback) |
| `meeting_schedule` | Links a meeting to a lead_report |
| `wishlist` | Companies flagged by the mobile sales team |
| `user_master` | All users (name, email, contact). Password column is hidden (REVOKE on anon + authenticated) |
| `user_role` | Which role(s) each user holds |
| `role_master` | Role definitions (1=ADMIN, 2=TEAM_LEAD, 3=AGENT, 4=SALES_HEAD, 5=SALES_PERSON, 6=QC) |
| `project` | Projects; team members in `project_user` |
| `client_association` | The client/project owners (e.g. AP Securitas, HungerBox). This is how leads are organized — lead_master.client_assoc_id → client_association.client_name |
| `company_master` | Target companies (525 records). New column: `domain_clean`, `is_demo` |
| `in_app_notification` | In-app notification feed |
| `stage_master` | The 13 allowed lead stages |

### New tables (added during rebuild)

| Table | What it stores |
|---|---|
| `contact_master` | Contacts extracted/migrated from leads (607 rows). Dedup keys: professional email → LinkedIn (cleaned) → phone. Has `company_id` link, `is_demo` flag |
| `interaction` | Per-contact activity log: call dispositions, notes, status changes (per project) |
| `dropdown_option` | Admin-editable dropdown lists: `contact_status` (6 options), `call_disposition` (8), `account_status` (7), `decision_power` (3), `feasibility` (3) |
| `contact_project_status` | Per-contact, per-project status record (contact_id + project_id = unique; stores current contact_status + call_disposition + notes). Owner + admin visibility only, full history via `interaction` |
| `company_project_status` | Per-company, per-project fields: account_status, is_feasible, decision_power, description, comments. Owner + admin only, full history |
| `user_view_pref` | Saved column-view preferences per user per list screen (Leads, Contacts, Meetings, etc.). Reset keeps old view |

---

## Security model (RLS)

- **RLS is ON for all 70 public tables.** Anon requests get empty reads and permission errors on writes.
- **Authenticated users** (valid Supabase JWT) get full access to operational tables — the "baseline" security pass was completed 2026-06-15.
- **`profiles` table** is SELECT-only for authenticated users (cannot self-promote role).
- **Fine-grained per-role RLS** (agent sees only own leads, etc.) is planned as a follow-up security pass before wider rollout.
- **`user_master.password` column** is hidden: REVOKE SELECT/INSERT/UPDATE from anon and authenticated, re-granted on all other columns only. Data is retained but not readable via the API. Script: `new-code/migration/hide-password-column.js`.

---

## Email / notification flow

```
  User action in browser
  (e.g. meeting scheduled, lead assigned, approval requested/approved/rejected)
       │
       │  fire-and-forget fetch (never blocks the user action)
       ▼
  POST /notify  on crm.altleads.com
       │
       ├── writes in_app_notification row to Supabase (via anon key, RLS-gated)
       │
       └── sends email via Nodemailer → Gmail SMTP (amplior.ankits@gmail.com)
               │
               ▼
           recipient's inbox
```

- Email is fire-and-forget: if it fails, the CRM action still succeeds.
- Recipient is resolved from `user_master.email` by the notify service.
- Test recipient for emails: ankit.s@amplior.com.
- Gmail credentials are in Hostinger env vars (not in code or git).

---

## Per-project status model (IN PROGRESS)

Contacts and companies are tracked differently depending on which project they're being pursued for. This means:

- One contact can have status "Interested" on the AP Securitas project but "No Decision" on HungerBox.
- A company can be marked "Feasible" for one project and "Not Feasible" for another.
- All these status changes are logged with full history (who changed what, when).
- Only the lead owner (or Admin) can see/change these statuses.

The tables that power this are `contact_project_status`, `company_project_status`, and `interaction`.

---

## Admin endpoints (service-role)

These run on the Node server with the Supabase service-role key. They bypass RLS intentionally, which is why they're server-side only and the key is never in the browser.

| Endpoint | What it does |
|---|---|
| `POST /api/users/create` | Inserts into `user_master` + `user_role`, then calls `auth.admin.createUser` → trigger builds `profiles` row. Returns a temporary password |
| `POST /api/users/reset-password` | Calls `auth.admin.updateUserById` to set a new password for any user (Admin only) |

**Prod requirement:** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must be set as env vars on Hostinger for these to work.

---

## What the Product Manager can now do alone

- **See / edit any data** in the Supabase Table Editor (supabase.com → your project → Table Editor).
- **Add a user or reset a password** from the Admin panel in the CRM itself (no SQL needed).
- **Deploy a new version** by pushing to the AltLeads-CRM repo (Hostinger auto-deploys on git push).
- **Request any change** by talking to Claude — code changes go to git, deploy runs automatically.

---

## Accounts map

| Service | What it holds | Project / detail |
|---|---|---|
| Supabase (org: AltLeads) | Database + Auth + file Storage | `amplior-crm` (ap-south-1 Mumbai) |
| Hostinger | Node hosting + auto-deploy | crm.altleads.com, Node 22.x, git deploy from AltLeads-CRM repo |
| GitHub | All code | AltLeads-CRM repo (clean history; old vendor code in `old-code/` in the AL private repo only) |
| DigitalOcean | OLD system (parallel run until cutover, then retire) | Forked MySQL cluster still live ($19k DO credits, non-issue) |

---

## What changed from the original architecture doc (2026-06-11)

The original plan was: React on Netlify + Supabase direct + Netlify Functions for heavy jobs. The actual deployed architecture is slightly different:

| Original plan | What actually shipped |
|---|---|
| React SPA on Netlify | React SPA served by the same Node app on Hostinger |
| Netlify Functions for email | Nodemailer on the Node/Express server |
| Separate notify service on Hostinger | Combined into one app (no separate service to manage) |
| GitHub auto-deploy → Netlify | Git push → Hostinger auto-deploys the Node app |

The result is simpler: one app, one deploy target, one set of env vars.
