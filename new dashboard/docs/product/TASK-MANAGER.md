# Task Manager Module — Internal CRM (ALT-160 / ALT-209)

*Plan-only. Owner: Mohit (non-technical). Last updated: 2026-06-21 (rev 2 — reviewer fixes applied).*
*Scope: the internal CRM (Amplior agents, Team Leads, Admin, QC). NOT the client/sales portal — see §10 for the later client-portal note.*

---

## 1. In plain language (read this first)

Right now, when one of our team members finishes a call and needs to "call this person back tomorrow at 11," there is **nowhere in the CRM that will remind them.** They keep it in their head, a sticky note, or their phone. Things get forgotten. Follow-ups are the whole job of an outreach team — a missed callback is a lost lead.

This module fixes that. It gives every CRM user a **personal to-do list built into the CRM**, exactly like the big-name CRMs (HubSpot, Zoho) have. The idea is simple:

- **From any lead, company, or contact, one click creates a reminder** — a "Call back," a "Meeting," or a plain "To-do." The reminder is automatically tied to that record, so when it pops up later the person knows exactly who to call and can jump straight to the record.
- **They pick when** — and we give one-tap shortcuts ("today 5pm," "tomorrow morning," "in 3 days") so it takes a second, not a form. All times are **India time (IST)** — see §6.5.
- **The CRM reminds them — two ways.** (1) An **email** lands in their inbox when it's due. (2) A **pop-up/notification inside the CRM** (the bell at the top we already built lights up, plus a small banner). This is the core value: "remind me" actually has to remind them.
- **A simple "My Tasks" screen** shows what's **Overdue** (red), due **Today**, and **Upcoming**. They tick things off as **Done**, **Skip** the ones that no longer matter, or **Snooze** ("remind me again in 2 hours / tomorrow").
- **Team Leads can hand a task to a teammate** (reassign), and we keep a record of who reassigned it — useful for managers.

**What we reuse vs. what is genuinely new (honest accounting — corrected after review):**

- **Reused as-is:** the create/edit Modal, the Toast pop-up, confirm dialogs, loading/error states, filter/picker components, the soft-delete + migration-applier pattern, the AltLeads-branded email template builder, and the email SMTP pipe. These are real, drop-in building blocks.
- **New work we must build (do not under-sell these):**
  1. **One new database table** (`task`) + its security rules. The security rules need **one new small helper function** (a "does this Team Lead manage this user?" check) because the helper we have today is *project*-scoped, not *person*-scoped — see §3.3.
  2. **One new "My Tasks" screen.**
  3. **A new background job (a "scanner")** inside our always-on notify-service that, every minute, looks for tasks that are now due and sends the reminders. Important correction: this job **cannot** call our existing `/notify` email endpoint, because that endpoint demands a logged-in user's token and the background job has no user logged in. Instead the job builds and sends the email **directly, in-process** (it already has the email-builder and the mail sender in the same file) and writes the in-CRM notification **directly** into the notifications table using the server's service key — see §6.1/§6.2.
  4. **A new ~60-second timer in the web app** for the *live* in-tab pop-up. Correction to the earlier draft: **the notification bell does NOT currently poll on a timer** — today it only re-checks the unread count when you change pages. So the "badge bumps on its own / a toast pops while you're working" behaviour is **new front-end work**, not free. It is small (one timer), but it is real and is listed as its own ticket (ALT-258).

**What we are deliberately leaving for later (not v1):** "Web Push" (reminders that buzz even when the CRM tab is closed) and HubSpot-style "queues" (work through a big batch of calls one after another) and recurring/repeating tasks. v1 reminders fire via email (works even if the CRM is closed) + in-CRM pop-up (while the tab is open). That covers an outreach team that lives in the CRM all day. We note the upgrade path so we can add it the day the team asks.

**Bottom line for you:** this is a self-contained, additive module. It does not touch the data or the security model of the existing records — it sits beside them. Estimated as a handful of focused build sessions, shippable in slices (database → screen → email reminder → in-CRM reminder → 1-click buttons). The three corrected items above (in-process email send, the new RLS helper, and the new web-app timer) are the only places this is more than "wire existing parts together."

---

## 2. How the big CRMs model this (our reference, then our simplification)

We pulled HubSpot's **live** task object (Amplior's own portal) and cross-checked Zoho. The durable, proven pattern is:

> A task = { **subject**, **notes**, **type** (Call / Meeting / To-do), **priority** (None / Low / Medium / High), **due date+time**, **status** (open → done), **owner** (who must do it), **reminders** (default + absolute + relative), **associations** to a contact / company / deal } — plus power-features (queues, recurring, sub-tasks) layered on top.

**Where we follow HubSpot:** single `task` table with a `type` enum (simpler than Zoho's 3 separate Call/Event/Task objects and one pipeline), the 4-level priority exactly (`NONE/LOW/MEDIUM/HIGH`), the single `due_at` datetime with an all-day flag, denormalizing contact/company name onto the row so list views are cheap, and reusing the "who reassigned this" audit field.

**Where we borrow Zoho:** the clean dual-association — a **"Related to"** parent record (lead/company) **plus** a **"Contact"** person — and Zoho's explicit **email + in-app + push** reminder delivery model.

**Where we are leaner than both (v1):** status is just `OPEN / DONE / SKIPPED` (not HubSpot's 5-stage pipeline) — our spec needs done/skip/snooze, not a full pipeline. `IN_PROGRESS` and queues/recurring are noted as backlog, not built.

---

## 3. Data model

### 3.1 New table: `task`
One table, HubSpot single-object style. Columns:

| Column | Type | Notes |
|---|---|---|
| `task_id` | bigint, PK, identity | matches our `*_id` convention |
| `subject` | varchar, NOT NULL | one-line headline ("Call back re: pricing") |
| `body` | text, null | notes / rich text |
| `task_type` | varchar/enum, NOT NULL | `CALL` \| `MEETING` \| `TODO` (start with 3; mirrors HubSpot) |
| `priority` | varchar/enum, default `NONE` | `NONE` \| `LOW` \| `MEDIUM` \| `HIGH` |
| `status` | varchar/enum, default `OPEN` | `OPEN` \| `DONE` \| `SKIPPED` |
| `due_at` | timestamptz, NOT NULL | the single due date+time (HubSpot `hs_timestamp`). Stored UTC; presented/bucketed in IST — see §6.5 |
| `is_all_day` | bool, default false | all-day vs specific time |
| `owner_user_id` | bigint, NOT NULL, FK→`user_master` | the assigned CRM user (who must do it) |
| `created_by_user_id` | bigint, FK→`user_master` | who created it |
| `assigned_by_user_id` | bigint, null, FK→`user_master` | who last reassigned owner (TL audit; like `hs_task_assigned_by_user_id`) |
| `lead_id` | bigint, null, FK→`lead_master` | association (the "Related to" parent) |
| `company_id` | bigint, null, FK→`company_master` | association |
| `contact_id` | bigint, null, FK→`contact_master` | association (the "Contact" person) |
| `meeting_id` | bigint, null, FK→`meeting_master` | optional link to a scheduled meeting |
| `contact_name` | varchar, null | **denormalized** for cheap list rendering |
| `company_name` | varchar, null | **denormalized** |
| `phone` | varchar, null | **denormalized** (so "call back" rows show the number) |
| `reminder_offset` | int (minutes), null | relative-to-due, e.g. `0` / `10` / `60` / `1440` minutes before. NULL = use the owner-decided default (Open Decision #1) |
| `reminder_at` | timestamptz, null | **computed by a DB trigger** (= `due_at` − `reminder_offset`); the field the scanner queries. See §6.4 for where/when it is (re)computed |
| `reminder_email` | bool, default true | send email reminder |
| `reminder_browser` | bool, default true | raise in-CRM reminder |
| `reminder_sent_at` | timestamptz, null | **idempotency guard** — set once sent, so we never double-fire. Cleared by the trigger on snooze/reschedule — see §6.4 |
| `completed_at` | timestamptz, null | stamped on Done |
| `skipped_at` | timestamptz, null | stamped on Skip |
| `created_date` / `updated_date` / `deleted_date` | timestamptz | match existing soft-delete convention (`deleted_date IS NULL` filter) |

**Indexes:** `(owner_user_id, status, due_at)` for the My-Tasks views; a **partial** index on `(reminder_at)` `WHERE reminder_at IS NOT NULL AND reminder_sent_at IS NULL AND status='OPEN' AND deleted_date IS NULL` for the scanner's "what's due?" query; FK indexes on `lead_id/company_id/contact_id`.

### 3.2 Migration approach (follows our existing pattern)
Same shape as `apply-access-rls.js`: a raw `*.sql` (gitignored) applied **inside a single transaction** by a **tracked `.js` applier** that prints the AFTER state to verify.

- `new-code/migration/create-task-table.sql` — `CREATE TABLE task (...)`, enums (or CHECK constraints), indexes, the `updated_date` trigger, **and the `reminder_at`/`reminder_sent_at` maintenance trigger from §6.4**.
- `new-code/migration/apply-task-table.js` — tracked applier: `BEGIN` → run SQL → `COMMIT`; then `SELECT` to confirm table + columns + indexes + trigger exist, print results. No git commit; no destructive ops.

### 3.3 Row-level security (RLS) — **needs one new helper; the old plan was not implementable**
RLS lives in a sibling file `task-rls.sql` + `apply-task-rls.js`. We reuse `is_admin()` and `current_user_id()` from `access-rls-v1.sql` as-is.

**Correction (reviewer):** the earlier draft claimed we could reuse `manages_project(pid)` for "Team Lead sees / reassigns their team's tasks." That is **not expressible** — `manages_project` is keyed by a **project id**, and the `task` table has no project. There is also **no** "manager-of-this-user" helper today. We must add a primitive. We choose **option (b): a new `SECURITY DEFINER` helper `manages_user(target_user_id)`** rather than bolting a `project_id` onto a personal to-do (a task isn't inherently project-scoped, and a TL should see a teammate's task regardless of which project it touches).

New helper (added in `task-rls.sql`, modelled exactly on the existing `manages_project` which already joins `project_user` + `role_master`):

```sql
-- manages_user(target): true when the caller is a MANAGER (TEAM_LEAD=2 or
-- SALES_HEAD=4) of a project that `target` is also a member of. Mirrors the
-- existing manages_project() join, but resolves "do we share a project where
-- I am a manager?" instead of taking a project id. SECURITY DEFINER + pinned
-- search_path, identical to the other helpers.
CREATE OR REPLACE FUNCTION public.manages_user(target_user_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM project_user mgr
    JOIN role_master rm ON rm.name = mgr.role_name
    JOIN project_user member
      ON member.project_id = mgr.project_id
    WHERE mgr.user_id = public.current_user_id()
      AND rm.role_id IN (2, 4)            -- TEAM_LEAD or SALES_HEAD
      AND mgr.deleted_date IS NULL
      AND member.user_id = target_user_id
      AND member.deleted_date IS NULL
  )
$$;
```

Policies on `task`:
- **SELECT / UPDATE:** `owner_user_id = current_user_id()` (agent sees/edits own) **OR** `is_admin()` **OR** `manages_user(owner_user_id)` (TL/Sales-Head sees & reassigns their team's tasks).
- **INSERT:** `created_by_user_id = current_user_id()` (or `is_admin()`). Setting `owner_user_id` to someone else on insert is additionally allowed only when `is_admin()` OR `manages_user(owner_user_id)` (so an agent can't assign work to others).
- **DELETE (soft):** owner or `is_admin()` or `manages_user(owner_user_id)`.

**Validate with throwaway role logins before prod** (per CLAUDE.md): log in as a plain agent (must see only own tasks), as a TL (must see their team's, must be able to reassign within the team, must NOT see another team's), and as admin (all). This is the one careful spot — the new `manages_user` helper is the load-bearing change and must be tested with real role logins before it touches prod.

---

## 4. Creating a task

### 4.1 One-click from a record (the headline feature)
On the **Lead detail**, **Company detail**, and **Contact detail** pages, add a small action row:
- **"Call back"** (type=CALL) · **"Schedule meeting"** (type=MEETING) · **"Add task"** (type=TODO).
Clicking pre-fills the association (`lead_id`/`company_id`/`contact_id` + denormalized `contact_name`/`company_name`/`phone`) and opens the create modal **already populated**, owner defaulting to the current user. On a lead, "Call back" pre-fills subject "Call back — {company}".

### 4.2 Full create form (modal)
Reuse the existing **Modal** (`src/components/admin/Modal.tsx`) + **Toast** on save. Fields: Subject, Type, the record it's attached to (SearchSelect over leads/companies/contacts — defaulted when launched from a record), Due date+time (+ all-day toggle), Priority, Reminder (offset dropdown + email/browser toggles), Notes, Owner (defaults to self; only TL/Admin can change at create, enforced by the INSERT policy in §3.3).

### 4.3 Quick-schedule presets (IST)
One-tap due-date chips so it's a second, not a form: **Today 5pm · Tomorrow 9am · In 3 days · Next Monday · Custom…**. All chips are computed in **IST (Asia/Kolkata)** — "Tomorrow 9am" means 9am India time — then stored as the equivalent `timestamptz`. Each chip sets `due_at`; the DB trigger (§6.4) derives `reminder_at`. This is the difference between people using it and not.

### 4.4 Global "+ Task"
A global create entry (top bar "+" or a Tasks-nav button) for tasks not started from a record (association optional).

---

## 5. Views — "My Tasks"

A new left-nav item **Tasks** → a list page with tabs/segments. **All day bucketing is done in IST** (see §6.5), so "Today" and "Overdue" are correct near midnight:
- **Overdue** (red): `status=OPEN AND due_at < now()` — surfaced first, most important.
- **Today**: `status=OPEN AND (due_at AT TIME ZONE 'Asia/Kolkata')::date = (now() AT TIME ZONE 'Asia/Kolkata')::date`.
- **Upcoming**: `status=OPEN AND due_at` within the next 7 IST days.
- **Completed**: `status IN (DONE, SKIPPED)`.

(Mirrors HubSpot's `is_overdue` / `is_open` booleans as computed filters.)

**Per-row quick actions:** **Mark done**, **Skip**, **Snooze** (re-pick due: +1h / +1d / custom — the DB trigger then recomputes `reminder_at` and clears `reminder_sent_at` so it can fire again — §6.4), and **Reassign** (TL/Admin only). Row shows type icon, subject, the linked company/contact (click → record), due time with relative label ("in 2h" / "3h overdue"), priority chip.

**Filters:** by type, priority, owner (TL/Admin), date range — reuse `MultiSelectFilter` / `SearchSelect`. Loading via `SkeletonTable`; errors via `ErrorBoundary`; empty-state copy ("No tasks due — nice and clear!").

**Scoping:** agents see their own; TL sees their team; Admin sees all — enforced by the RLS in §3.3 (`manages_user`), consistent with the rest of the CRM.

---

## 6. Reminders (the core value — be explicit and correct about delivery)

**One server-side scanner drives all durable delivery**, keyed off `reminder_sent_at` for idempotency. The browser timer (§6.3) is **only** for the live in-tab pop-up and never owns delivery.

### 6.1 Email reminder — ship first, lowest risk. **Sent in-process, NOT via POST /notify.**
**Correction (reviewer):** the scanner is a background job with **no logged-in user**, so it has **no Supabase user JWT**. Our `POST /notify` endpoint is gated by `requireAuth` (it calls `admin.auth.getUser(bearerToken)`), so the scanner **cannot** call it. Instead the scanner sends mail **directly, in the same process**, which is clean because `server.js` already imports `buildEmail` and already has `getTransporter()`:

1. Add a new event `task_reminder` in `email-templates.js` (event list + a `taskReminder(data)` builder) — reuses the existing AltLeads-branded header/footer/CTA. Times in the email body are rendered in **IST**.
2. A **scanner job inside notify-service**: a `setInterval` (~60s) — or `node-cron` — using the **service-role** Supabase client (`getSupabaseAdmin()`), that runs:
   `SELECT … FROM task WHERE reminder_email AND reminder_at <= now() AND reminder_sent_at IS NULL AND status='OPEN' AND deleted_date IS NULL`.
   For each row: resolve owner email (`resolveUserEmailAndName`), then **call `buildEmail('task_reminder', data)` and `getTransporter().sendMail(...)` directly** (the exact two calls `POST /notify`'s handler already makes internally), then `UPDATE task SET reminder_sent_at = now()`.
   - Alternative if we'd rather not reach into the table from the worker: add a dedicated **internal route** (e.g. `POST /internal/task-reminder`) protected by a **shared-secret header** or a service-role check (NOT `requireAuth`). Default recommendation is the in-process call — least new surface area. Either way, **do not route the scanner through `POST /notify`.**
3. **Host feasibility (confirmed):** notify-service is a long-running Node process in the combined Hostinger app — an in-process `setInterval`/`node-cron` worker needs **no OS cron, no Supabase scheduled function, no new infra.** Gmail SMTP (`smtp.gmail.com` STARTTLS via app password) is the only mail path; see §6.6 for the volume/throttling decision that must be made before this slice ships. (Per-test convention, test reminders go to `ankit.s@amplior.com`.)
4. **Reliability / monitoring (reviewer):** the scanner is in-process, so if the Node process restarts/crashes the timer stops silently. Catch-up is automatic on restart — the query is `reminder_at <= now()`, so anything that came due during downtime still fires — but a *stopped* scanner is invisible. Add a heartbeat: the scanner writes a `last_scan_at` timestamp (log line + a row/health field), and `/health` reports the age of the last scan so we can alert if it goes stale.

### 6.2 In-CRM "browser" reminder — the bell, **inserted server-side**
**Correction (reviewer):** `notifyInApp` is a **client-side** helper bound to the logged-in user's Supabase client — the scanner can't call it. So in the **same** scanner pass, after sending (or instead of, if `reminder_browser` but not `reminder_email`), the scanner **INSERTs directly into `in_app_notification`** using the service-role client, writing the columns the app expects (per `notify.ts`): `user_id` = owner, `notif_descr` = the reminder text, `route` = deep link to the task/record, `is_seen = false`, `status`, `created_by`, `created_date`. This makes the **bell badge** reflect the new notification the next time the badge count is fetched.

### 6.3 Live in-tab pop-up — **new web-app timer (the bell does NOT poll today)**
**Correction (reviewer):** verified in `new-code/web/src/components/layout/TopBar.tsx` — the bell's unread count is fetched in a `useEffect` keyed on `[profile.user_id, pathname]`, i.e. **only on login and on route change. There is no `setInterval`.** So today the badge does **not** bump on its own and no toast appears while the user sits on one page. To get the "live" feel we add **new front-end work** (ALT-258):
- A small `setInterval` (~60s) in a top-level component (TopBar or an app-shell hook) that re-runs `fetchUnreadNotifCount` so the **badge bumps without a route change**, and
- a companion check that detects newly-due/just-notified tasks for the current user and raises an in-app **Toast** ("Reminder: Call back — Acme, due now") with an "Open" action (reuses the existing `Toast`).
- Friction: none (no browser permission). **Limitation: in-tab only** — acceptable for a team that lives in the CRM; **email** (§6.1) covers the closed-tab case.

This is explicitly **not** "zero new front-end plumbing" — it is one new timer plus a small toast trigger. Small, but real, and ticketed separately.

**Cheap upgrade (optional, same iteration):** **Web Notifications API** — one-time `Notification.requestPermission()`, then `new Notification(...)` from the same timer, so an OS-level toast shows even when the tab is backgrounded (tab still must be open). Trivial code on top of the toast.

### 6.4 Where `reminder_at` is computed (and re-computed) — **a DB trigger**
**Reviewer gap closed.** `reminder_at` is **not** computed in the app. A `BEFORE INSERT OR UPDATE` trigger on `task` maintains it so edits/snoozes always re-fire correctly:
- On INSERT, and on any UPDATE that changes `due_at` or `reminder_offset`: set `reminder_at = due_at - (COALESCE(reminder_offset, <default>) * interval '1 minute')`, and **set `reminder_sent_at = NULL`** (so a rescheduled/snoozed/edited task becomes eligible to fire again).
- Snooze (§5) is just an UPDATE of `due_at`, so it flows through the same trigger — no special-casing in the app, no risk of a stale `reminder_at`.
- The default offset used when `reminder_offset IS NULL` is the owner decision in §11 #1 (default proposed: at due time, i.e. offset 0).

### 6.5 Timezone — **IST (Asia/Kolkata), pinned**
**Reviewer gap closed.** The team is in India. `due_at` is `timestamptz` (stored UTC), but every *human* concept is IST:
- **Quick presets** ("Tomorrow 9am") are computed in IST in the client, then stored as the matching instant.
- **"Today" / "Overdue" bucketing** is done in **SQL** with `AT TIME ZONE 'Asia/Kolkata'` (see §5) — not in JS — so the buckets don't drift with the viewer's browser timezone and are correct around midnight.
- **Email + toast copy** render the due time in IST.
- The scanner's `reminder_at <= now()` comparison is timezone-agnostic (both are absolute instants), so the scanner needs no tz logic — only the *display* and *bucketing* layers do.

### 6.6 Email volume: per-task vs digest — **decide before the email slice ships**
**Reviewer gap closed (links Open Decision #4).** Gmail SMTP has daily send limits and throttling. On a heavy outreach day, one email per due task could mean dozens of emails per user and risks Gmail throttling / spam folder. This choice **changes the scanner design**, so it must be settled before ALT-256 is built:
- **Option A (per-task):** simplest; one email per due task. Fine for light days, risky for heavy ones.
- **Option B (digest):** the scanner groups a user's due tasks within a window and sends "You have 6 tasks due" once. Friendlier + safer for Gmail limits; slightly more scanner logic.
- **Recommendation:** ship Option A behind a small per-user/per-window cap (e.g. coalesce if >N due in the same scan), or go straight to a short-interval digest. Owner to confirm (§11 #4).

### 6.7 Deferred (later iteration): true Web Push
Fires even when the CRM tab is **closed**. Needs: a Service Worker, a VAPID keypair, a `push_subscriptions` table, subscription management, and the **same scanner** sending Web Push payloads (e.g. `web-push` npm). More moving parts (SW lifecycle, browser quirks) — promote only when the team asks for closed-tab buzzing. Because the scanner is the single dispatch point, adding Web Push later is "the scanner gains a second channel," not a rewrite.

**Delivery summary (v1):** email (in-process send, works closed) + in-CRM bell badge (server-side `in_app_notification` insert) + live toast/badge-bump (new ~60s web timer, tab open) + optional OS toast via Notifications API. Web Push = later.

---

## 7. Reuse map (what we are NOT rebuilding — and the asterisks where work IS new)

| Need | Existing primitive (grounding) | New work? |
|---|---|---|
| Create/edit dialog | `src/components/admin/Modal.tsx` | reuse as-is |
| Save feedback / reminder pop-up | `useToast()` / `Toast.tsx` | reuse as-is |
| Destructive confirms (delete/skip) | `useConfirm()` / `ConfirmDialog.tsx` | reuse as-is |
| Loading / error states | `Skeleton*` / `ErrorBoundary` | reuse as-is |
| Filters / pickers | `MultiSelectFilter`, `SearchSelect`, `ColumnCustomizer` | reuse as-is |
| Email builder + sender | notify-service `email-templates.js` `buildEmail` + `getTransporter()` | reuse — **scanner calls them in-process** (NOT via `POST /notify`, which needs a user JWT — §6.1) |
| In-app notification row | `in_app_notification` table | **NEW:** scanner INSERTs directly with the **service-role** client (`notifyInApp` is client-only — §6.2) |
| Bell badge **live bump** | TopBar bell fetches unread count | **NEW:** the bell **does NOT poll today** (only on route change) — add a ~60s timer (§6.3, ALT-258) |
| Migration | tracked `.js` applier + transactional `.sql` (pattern: `apply-access-rls.js`) | reuse pattern |
| RLS helpers | `is_admin()`, `current_user_id()` | reuse — **but `manages_project` is project-keyed and does NOT work for tasks; add new `manages_user()` helper (§3.3)** |
| Unsaved-changes guard | `useUnsavedChanges()` | reuse as-is |

---

## 8. Integration points

- **Top bar task badge:** show a count of **open + overdue** tasks for the current user (sibling to the bell, or fold into the bell). Click → Tasks page (Overdue tab). Shares the new ~60s timer from §6.3.
- **Lead / Company / Contact detail:** the 1-click action row (§4.1) **plus** an "Open tasks" mini-list / count on the record (its related open tasks), mirroring HubSpot/Zoho "Open Activities."
- **Activity timeline:** when a task is completed, optionally drop a line into the existing `ActivityTimeline` on the record ("Task completed: Call back").
- **Notifications page:** task reminders written as `in_app_notification` rows already appear in the existing notifications list with a route back to the task/record.

---

## 9. Build order (slices — each independently shippable)

1. **DB + migration** (`task` table + `reminder_at` trigger + RLS incl. the new `manages_user()` helper, validated with role logins).
2. **My Tasks views** (list + IST-correct tabs + mark done/skip/snooze) reading the table.
3. **Create:** full modal + IST quick-schedule presets + global "+ Task".
4. **Email reminder:** notify-service scanner (in-process `buildEmail`+`sendMail`, service-role client) + `task_reminder` template + heartbeat/health (ship + test to ankit). **Volume decision (§6.6) settled first.**
5. **In-CRM reminder:** server-side `in_app_notification` insert (badge source) + the **new** ~60s web timer for live badge-bump + toast (+ optional Notifications API).
6. **1-click from records** + record-page open-tasks mini-list + top-bar badge.
7. **TL reassign** + `assigned_by_user_id` audit (uses `manages_user` from slice 1).
8. *(Backlog, not v1)* recurring tasks · HubSpot-style queues · Web Push (closed-tab).

---

## 10. Later: client/sales portal task surface (out of scope here)

The sales portal (2nd login `/sales`, `SalesShellProvider`) could later get a **light** task surface — e.g. sales reps see their own follow-ups on leads they're assigned. **This plan is internal-CRM scoped.** When we do the portal version, the **same `task` table + same scanner** serve it; the only additions are RLS for sales roles (`SALES_HEAD`/`SALES_PERSON` — note `manages_user` already covers `SALES_HEAD=4`) and a SalesSidebar "Tasks" entry. No new data model. Noted so we don't fork the design.

---

## 11. Open decisions for the owner

1. **Reminder default offset** — when no offset is chosen, fire at due time, or 10 min before? (HubSpot default = at due.) Drives the constant in the §6.4 trigger.
2. **Can agents reassign**, or **TL/Admin only**? (Plan assumes TL/Admin only via `manages_user`, matching our access posture.)
3. **Are MEETING tasks here distinct from the existing Meetings module** (`meeting_master`)? Plan keeps MEETING as a lightweight task type and optionally links `meeting_id`; confirm we don't want full meeting scheduling here.
4. **Email reminder volume — per-task vs digest (§6.6).** Must be decided **before** the email slice (ALT-256) ships, because it changes the scanner design and affects Gmail throttling/deliverability.
5. **Web Push priority** — confirm closed-tab reminders are a later iteration, not v1.

---
## Decisions LOCKED — 2026-06-21 (owner go to build)
- **Reminder email volume (ALT-262): RESOLVED.** **Per-task email WITH a safety cap** (per-user, per-window — protects Gmail deliverability) **+ an optional daily-summary digest that is OPT-IN, default OFF.** → Scanner sends one capped email per due task; a separate daily-digest job is gated by a per-user pref defaulting to `false`.
- **Build go:** owner said "lets start building." The task table + RLS migration is authored as an applier but **applied to the live DB only after owner sign-off + throwaway-login validation (ALT-251)**.

---
## BUILD STATUS — Increment 1 (2026-06-21)
**Built & build-verified (code only; table NOT yet applied to prod):**
- `new-code/migration/apply-create-task-table.cjs` — public.task + public.task_user_pref, reminder-timing trigger, scanner index, explicit grants. Adversarially reviewed; idempotent; STAGED.
- `new-code/migration/apply-task-rls.cjs` — `manages_user()` helper (FAILS CLOSED: owner + admin only) + RLS. Review caught & fixed a shared-project leak. STAGED.
- Frontend: `src/data/tasks.ts`, `src/components/tasks/{CreateTaskModal,taskScheduling}.tsx`, `src/pages/MyTasksPage.tsx`; wired as `/tasks` route + Sidebar "My Tasks". Inert until the table is applied.

**CANONICAL CONTRACT RECONCILIATION:** the code/migration follow the canonical column contract (table `public.task`; `task_type` CALL/MEETING/TODO; `status` OPEN/DONE/SKIPPED; `priority` LOW/NORMAL/HIGH; `owner_user_id`, `remind_offset_minutes`, `reminder_at`/`reminder_sent_at`, `assoc_label`/`assoc_phone`, soft-delete `deleted_date`). Where §3.1 above lists older names (is_all_day, reminder_offset, contact_name/company_name/phone, completed_at/skipped_at, NONE/MEDIUM priorities), **the canonical contract here wins** — §3.1 is superseded for the build.

**Not yet built (next slices, need the table live):** email reminder scanner (ALT-256, per-task capped + opt-in digest), server-side bell insert (ALT-257), the ~60s web timer (ALT-258), one-click-from-record (ALT-260), TL owner/reassign (ALT-261), digest opt-in toggle in Settings.
