# Amplior CRM Rebuild — Roadmap

> **Purpose:** A simple, phase-by-phase timeline of the whole rebuild — what each phase delivers, where we are today, and what's left. Written for the business owner; no technical background needed.
>
> *Last updated 2026-06-17.*

---

## The 60-second summary

We are rebuilding the old Amplior/Altleads CRM (built badly by an outside vendor) into a clean, modern system that you can manage yourself.

**Where we are right now (2026-06-17):** The web app is **live at crm.altleads.com** and has passed a smoke test. All core modules are done (Leads, Meetings, Wishlist, Approvals, Notifications, Companies, Contacts, Admin, Settings). Email delivery via Gmail SMTP is verified. RLS is on (baseline). The next step is feature waves (admin dropdown editor, per-project status UI, per-user saved views) and security hardening, then mobile, then the parallel-run and full cutover.

**Build pace / AI model note:**
- The Fable model deadline (22 June 2026) has passed. The build now runs on *Opus 4.8* for hard parts and *Sonnet 4.6* as the daily driver.
- Remaining phases (feature waves, security audit, mobile, parallel-run, cutover) are a mix of focused build sessions and your team's real-world testing — much lighter on AI time than the initial build.

---

## Timeline view (Gantt-ish)

Each block is a phase. `███` = done, `▓▓▓` = in progress (where we are now), `░░░` = not started yet.

```
 Phase 0  Accounts & access    ████████████
 Phase 1  Cleanup              ████
 Phase 2  Supabase + data      ████████████
 Phase 3  Web core             ████████████████████
 Phase 4  Admin panel          ████████████  (built within Phase 3)
 Phase 5  Hostinger deploy     ████  DONE — live at crm.altleads.com
 Phase 5b Feature waves        ▓▓▓▓▓▓▓▓▓▓▓▓  (in progress — dropdown editor,
           (status UI, saved    per-project status UI, saved views, security audit)
           views, security)
 Phase 6  Mobile repair        ░░░░░░░░
 Phase 7  Parallel-run         ░░░░░░░░░░░░░░░░░░►
           & cutover
```

> **Reading it:** Phases 0–5 are complete. Phase 5b (feature waves) is the active phase. Phase 6 (mobile) and Phase 7 (parallel-run + switchover) are next.

---

## Phase-by-phase detail

### Phase 0 — Accounts & access
*The keys and logins we need before any building can happen.*

| | |
|---|---|
| **Goal** | Have all the accounts and access tokens in hand: GitHub (code), Supabase (database), Netlify (hosting), DigitalOcean (old system). |
| **Key deliverables** | GitHub repo connected · Supabase + Netlify access tokens received & verified · DigitalOcean access for the data pull. |
| **Status** | ✅ **Mostly done** — GitHub, Supabase (org "AltLeads"), Netlify, and DigitalOcean access are all in hand and verified. Remaining items are tied to later phases: Apple Developer + Google Play access and the Android signing key for Phase 6 mobile. |

### Phase 1 — Cleanup
*Tidy up the messy vendor codebase so we build on a clean floor.*

| | |
|---|---|
| **Goal** | Archive the old vendor code as read-only reference, organise documents, lock away secrets, start from a clean commit. |
| **Key deliverables** | Old code moved to `old-code/` · docs to `docs/` · secrets to a private `.credentials/` vault · clean starting commit. |
| **Status** | ✅ **Done** (2026-06-11). Bonus finding: the leaked database password belonged to an old throwaway copy that no longer exists, so no emergency password change was needed — the live system was never at risk. |

### Phase 2 — Supabase migration (database + real data)
*Move the real production data into the new database, safely, without touching the live system.*

| | |
|---|---|
| **Goal** | Stand up the new Supabase database and copy across all the real data, with the numbers checked to prove nothing was lost. |
| **Key deliverables** | New Supabase database built · **all real data copied (65 tables, ~108,000 rows)** · every table's row count matched against the original ✓ · the new web app already showing real leads, meetings and wishlist. |
| **Status** | ✅ **Data done** (2026-06-12) — and the live system was never touched: we copied from a temporary fork, verified, then can delete it. **One important item still open:** the database access-permission rules ("who can see what") are not yet switched on. This is a hard requirement before the site can go live (see the Phase 5 gate below). |

### Phase 3 — Web core  ✅ DONE
*Build the actual web application: the screens your team uses every day.*

| | |
|---|---|
| **Goal** | A working web CRM with login and all the core modules running on real data. |
| **Key deliverables** | ✅ Secure login (Supabase Auth) · ✅ Leads (list, filters, export, workspace 3 tabs, approval flow) · ✅ Meetings (list, filters, export, reschedule/cancel) · ✅ Wishlist (assign, convert to lead) · ✅ Approvals queue · ✅ Notifications (email + in-app, live bell badge) · ✅ Companies module (525 companies, dedup, detail) · ✅ Contacts module (607 contacts, call-disposition, dedup, detail) · ✅ Admin (add user, reset password, dropdown editor seeded) · ✅ Settings · ✅ RLS baseline on all tables. |
| **Status** | ✅ **Complete.** All modules built, build passes, design-matched to Figma, RLS enabled, security audit passed baseline. |

### Phase 4 — Admin panel  ✅ DONE (built within Phase 3)

| | |
|---|---|
| **Status** | ✅ **Complete.** Users (add + reset-password), Projects, Clients, Reference tabs, dropdown option management seeded. ADMIN-gated. Needs `SUPABASE_SERVICE_ROLE_KEY` env var on Hostinger for add/reset-password to work in production. |

### Phase 5 — Deploy  ✅ DONE
*Web app live on the internet.*

| | |
|---|---|
| **Goal** | Publish the web app and email service to a live address. |
| **Key deliverables** | ✅ Combined Node app on Hostinger · ✅ Git auto-deploy from AltLeads-CRM GitHub repo · ✅ Live at crm.altleads.com · ✅ Email delivery verified (Gmail SMTP). |
| **Status** | ✅ **Complete.** HTTP 200 at crm.altleads.com. `/health` OK. Real email delivered. |

### Phase 5b — Feature Waves  ◄── **CURRENT PHASE**
*Complete the per-project status UI, dropdown editor, per-user saved views, and security hardening.*

| | |
|---|---|
| **Goal** | Finish the features that were designed and database-ready but whose UI is still outstanding; harden security before go-live. |
| **Wave B** | Admin dropdown management UI (edit option lists from Admin panel) · Pre-sales questions surfaced in lead workspace per domain. |
| **Wave C** | Contact list: multi-select, Contact Status column, show/hide columns, per-user saved views (reset keeps old view). |
| **Wave D** | Contact detail: full per-project fields (status, description, comments) with history. |
| **Wave E** | Company detail: account status, feasibility, decision power, description, comments per project. |
| **Wave F** | Multi-select + export on all remaining lists (confirm Leads/Meetings/Wishlist are complete). |
| **Wave G** | Security audit — dedicated sub-agent IDOR/RLS pass; fine-grained per-role policies (agent sees own leads). |
| **Status** | ▓ **In progress.** Wave A (tables + seeding) done. Wave B onwards planned. |

### Phase 6 — Mobile repair
*Fix and reconnect the existing phone app to the new system.*

| | |
|---|---|
| **Goal** | Repair the existing React Native mobile app, point it at the new Supabase backend, and get it building for both Android and iPhone. |
| **Key deliverables** | Recreate the two missing files the vendor withheld · rewire the app to the new backend · Android signing sorted · iPhone build via a cloud Mac (since you're on Windows). |
| **Status** | ⛔ **Not started.** Watch-items: the vendor may withhold the Android signing key and Apple/Play access over the unpaid final invoice — we have a fallback recovery route through Google/Apple support. iPhone builds need a Mac, which you can borrow or run in the cloud. |

### Phase 7 — Parallel-run & cutover
*Run new and old side by side, prove it works, then switch over for good.*

| | |
|---|---|
| **Goal** | Run the new system alongside the old one so the team can trust it, fix anything that surfaces, then switch fully to the new system and retire the old DigitalOcean servers. |
| **Key deliverables** | 1–2 weeks of real-world team testing on the new system while the old one still runs · issues fixed · final go-live (cutover) · old MySQL + droplet retired · old database firewall pruned. |
| **Status** | ⛔ **Not started.** This is mostly **your team's testing time** — very little AI work. The old system keeps running untouched until you're confident, so there's no risk during the trial. |

---

## Milestones

The big checkpoints, in order. ✅ = reached, 🟡 = in progress, ⬜ = not yet.

- ✅ **Rebuild approved & stack locked** — Supabase + React/Vite + repaired mobile app (2026-06-11).
- ✅ **Old code cleaned & archived** — clean starting point (2026-06-11).
- ✅ **Real data live in the new database** — 65 tables, ~108,000 rows, every row count matched, live system never touched (2026-06-12).
- ✅ **Secure login working** — team members log in via Supabase Auth, with their real roles (2026-06-12).
- ✅ **Core web modules built on real data** — Dashboard, Leads (workspace + approval flow), Meetings, Wishlist, Notifications (email + in-app), Approvals, Companies, Contacts, Admin, Settings (2026-06-12–14).
- ✅ **RLS security baseline** — all 70 tables enabled, anon denied, self-promote blocked (2026-06-14).
- ✅ **Design-matched to Figma** — brand blue, split login, lead workspace, admin panel, all modules (2026-06-14).
- ✅ **Legacy password column hidden** — column-level grant revoked; plaintext data no longer API-accessible (2026-06-16).
- ✅ **Email + in-app notifications live** — meeting, lead, approval events fire email (Gmail SMTP) + in-app (2026-06-16).
- ✅ **Companies + Contacts modules built** — 525 companies, 607 contacts, dedup, call-disposition log, 286 contacts domain-linked (2026-06-14–16).
- ✅ **Add User + Reset Password** (admin service-role endpoints) built and verified locally (2026-06-16).
- ✅ **First deploy — live at crm.altleads.com** on Hostinger, git auto-deploy from AltLeads-CRM repo (2026-06-16).
- 🟡 **Feature waves** — per-project status UI, admin dropdown editor, per-user saved views (in progress).
- ⬜ **Fine-grained RLS + IDOR security audit** — hard gate before full go-live.
- ⬜ **Hostinger env vars** for admin endpoints (`SUPABASE_SERVICE_ROLE_KEY`).
- ⬜ **Mobile app reconnected & building** — Android + iPhone.
- ⬜ **Parallel run starts** — team uses new system alongside the old.
- ⬜ **Go-live / cutover** — switch fully to the new system.
- ⬜ **Old DigitalOcean retired** — last step; final cost savings realised.

---

## Where we are, in one line

> **The app is live at crm.altleads.com with all core modules working on real data. The next steps are: set the Hostinger env vars for admin endpoints, finish the per-project status UI and dropdown editor, run the security hardening pass, then mobile repair, then a side-by-side trial run before full cutover.**

---

*Note on dates: this roadmap shows status and sequence, not fixed calendar dates. The only hard date is the 22 June 2026 Fable model deadline. Remaining time estimates (rough, AI build time only): Phase 3 finish ~ a few more hours, Phase 4 ~4–6h, Phase 5 ~1h, Phase 6 ~6–10h, Phase 7 ~1–2 weeks of your testing. TBD — confirm calendar dates with owner.*
