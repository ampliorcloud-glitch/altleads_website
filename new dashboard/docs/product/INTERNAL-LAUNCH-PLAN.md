# AltLeads CRM — Internal Launch Plan & Timeline
*Prepared for leadership review · 2026-06-18 · owner: Mohit*

> **One-line status:** The CRM is **built and live** at `crm.altleads.com`. Going live *for the team* is now mostly **decisions + a short hardening run**, not new construction. Soonest realistic internal go-live: **~2–3 focused build sessions after the decisions below are made.**

---

## Slide 1 — The product in one picture

**AltLeads is an outreach CRM.** Our team's job is to **call and email** the companies/contacts we already have, and **update** each record as they connect. They do **not** create data — all companies and contacts are already loaded.

So the product is built around **updating**, not data entry:
- A clean call-list the team works through.
- Fast status / call-outcome / notes updates.
- Managers and admin see the rollup; admin maintains the data in bulk.

---

## Slide 2 — Where we are today (what's DONE)

✅ **Deployed and live** — `crm.altleads.com` (one app: web + email + admin), auto-deploys from GitHub.
✅ **All data migrated** — 525 companies, 600+ contacts, 600+ leads, 610 meetings, projects, clients.
✅ **Every module built** — Leads, Companies, Contacts, Meetings, Wishlist, Approvals, Notifications, Dashboard, full Admin panel.
✅ **Security** — per-row access control + contact-detail masking are *applied in the live database* (not just designed).
✅ **Update flows work** — status, call disposition, and notes already save (per project), with full activity history.
✅ **Email notifications** — 8 templates built; service live; production keys set.
✅ **Admin self-service** — add users, reset/create logins, manage option lists, projects, clients, reference data, per-project access.

**Translation for leadership:** the expensive, risky engineering (data migration, all screens, security, hosting) is **finished and running**.

---

## Slide 3 — What stands between us and "the team is using it"

Four small, well-scoped items — plus **one risk to clear**.

| # | Gap | Why it matters | Size |
|---|-----|----------------|------|
| 1 | **Role posture** — hide "＋ New" buttons & lock create/admin pages for the outreach team | Today every user can see create buttons; contradicts "outreach-only" | **½ session** |
| 2 | **Provision logins** for the launch team | ~110 migrated users, only 1 has a login today | **½ session** |
| 3 | **Validate access with real logins** | Only the admin account has been tested against live security | **1 session** |
| 4 | **Email sign-off** — approve wording + confirm sender | Notifications must read right & actually deliver | **½ session** |

### ⚠️ The one risk to clear before go-live (critical)
**Can each agent actually *update* the records they're assigned?**
Our security currently lets a person edit a record only if they **created** it. But our data was **bulk-imported** — so the "creator" field doesn't point at the agent who'll work it. If we don't fix this, an agent could open their call-list and get *"you can only edit records you own"* on every save.

**This is the single most important thing to settle**, and it ties directly to a decision only you can make (see *Decisions*, item 3). It's fixable two ways — re-point ownership to the assigned agents, or change the rule to "you can edit records **assigned** to you." Either is a focused task; the point is we **must validate it with a real agent login before launch**, not after.

---

## Slide 4 — The plan (phased)

**Phase 0 — Your decisions (the real critical path).** No engineering; just the answers in *Decisions* below. Everything waits on this.

**Go-live track (after Phase 0):**
- **Phase 1 — Role posture** (½ session): hide create buttons, lock create/admin routes for the team.
- **Phase 2 — Logins** (½ session): one-click bulk "create logins," export a temp-password sheet, force change on first login.
- **Phase 2.5 — Ownership/write-path fix + validation** (½–1 session): clear the ⚠️ risk above with a real agent login.
- **Phase 3 — Access validation** (1 session): log in as each role, confirm everyone sees the right records and can update.
- **Phase 4 — Email sign-off** (½ session, runs in parallel): your approved wording + delivery check.

### 🚀 GO-LIVE GATE = Phases 1 + 2 + 2.5 + 3 + 4 complete.

**Polish track (can trail go-live by a session):**
- **Phase 5 — Record & lead-form UX pass:** click-to-call/email, one-click "log call," simpler company/contact pages, lead form with Client/Source/Project on top + auto-fill from company.

**Post-launch (the two big feature asks):**
- **Phase 6 — Grid / inline editing** from the lists (edit status/notes/disposition without opening a record).
- **Phase 7 — Bulk Export → edit → Import (update)** for companies, then contacts (admin-only).

> **Why grid-edit & bulk-import are post-launch:** the team can already update inside each record, and all data already exists — so neither blocks day-one outreach. They're high-value *speed* upgrades we add right after.

---

## Slide 5 — Timeline view

```
NOW ──► Phase 0 (your decisions) ──► [ P1 role posture ] ─┐
                                     [ P2 logins        ] ─┤
                                     [ P2.5 ownership fix] ─┼─► GO-LIVE (internal)
                                     [ P3 validate access] ─┤      ~2–3 build sessions
                                     [ P4 email sign-off ] ─┘      after decisions land
                                                │
                                                ▼
                              Phase 5 UX polish (≈1 session, can trail)
                                                │
                                                ▼
                              Phase 6 grid editing  +  Phase 7 bulk import
                                       (≈2–4 sessions, post-launch)
```

**Honest caveat:** the timeline is gated by **your decisions**, not engineering hours. The moment Phase 0 is answered, the go-live track is short. The only variable that could stretch it is **how messy the migrated ownership data is** (the ⚠️ risk) — we'll know within the first validation pass.

---

## Slide 6 — What we need from you (leadership/owner)

See the **Decisions** section in the chat summary. In short:
1. **Launch user list** (15–20 names + emails + each person's role).
2. **Role posture** confirmation (who can create vs update-only).
3. **Assignment/ownership model** — do agents work records **assigned** to them? (clears the ⚠️ risk).
4. **Manager visibility** — should Team Leads see their team's masked phone/email at launch?
5. **Email** — approve the 8 templates' wording.
6. **Deploy posture** for launch week (manual deploys only).

---

## Appendix — Effort legend
S = ≈ half a session · M = ≈ a session or two · (an "AI-dev session" is a focused build+verify block, typically the same day, not a calendar week).
