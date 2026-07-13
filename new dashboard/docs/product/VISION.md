# AltLeads — Product Vision & North Star
*Owner: Mohit · captured 2026-06-18*

## The north star
An **ecosystem** that captures everything (organised) as the team works, and turns that recorded memory into an AI advantage no competitor has — because only we recorded it.

```
            ┌──────────────────────────────────────────────┐
            │   ONE BACKEND  (Supabase: data + auth + API)  │
            │   every interaction captured + embedded       │
            └──────────────────────────────────────────────┘
                 ▲                ▲                 ▲
        ┌────────┴───────┐ ┌──────┴───────┐ ┌───────┴────────┐
        │ CRM (web app)  │ │ Chrome ext.  │ │ Mobile app     │
        │ system of rec. │ │ LinkedIn +   │ │ field, on-the- │
        │ LIVE today     │ │ inline edit  │ │ go (lowest pri)│
        └────────────────┘ └──────────────┘ └────────────────┘
                 │
                 ▼  fast retrieval (RAG)
        ┌────────────────────────────────────────┐
        │  AI: "who to call, when, what to say" ; │
        │  "which 100 companies to target now"    │
        └────────────────────────────────────────┘
```

**The superpower (owner's words):** pick any contact → get suggestions, action items and content for reach-out, drawn from *our* history — e.g. "all call logs 11am–2pm are unanswered, after 3pm always picked." Later: "which companies to target this month?" → 100 sites whose contracts renew next month, with the pitch. Must be **fast as hell**.

## The components (in priority order)
1. **CRM web app** — *live.* Internal outreach team updates records as they call/email; everything captured on the go.
2. **Client portal** — clients see only what's scheduled / succeeded post-scheduling, plus a dashboard.
3. **Chrome extension** — on an open LinkedIn profile, show CRM contact details + allow small edits that write back to the CRM live (extension acts as the CRM).
4. **Market-mapping data per city** — enriches the base and feeds targeting.
5. **AI, gradually** — start small, grow into the full suggestion/targeting engine.

## Upcoming product features
- **Task Manager** (HubSpot/Zoho-style): schedule tasks; each becomes a **ticket/record** associated with its contact/company/lead — **plus the ability to attach more associated records from other modules**. When the reminder fires, the rep knows exactly *what* to do and *where*. (New module: `task` + `task_association` tables; reminders → notifications; appears on each record's "Tasks" tab and a global "My Tasks" list.)
- Inline grid editing, bulk export→import (companies), record-UX polish, click-to-call/email — see `UX-REDESIGN.md` / `BULK-IMPORT-EXPORT.md`.

## Foundations to lock in NOW (expensive to change later)
1. **Rich interaction capture from day one** — every call/email/note logged with **timestamp, outcome, disposition, context**. This is the irreplaceable fuel for the RAG/AI; it *cannot be back-filled*. Non-negotiable at launch.
2. **Ownership/assignment model** — who "owns"/can-edit a record. Drives security today and AI attribution later. (Currently the launch-stopper — see [[internal-launch-write-path-risk]] / `INTERNAL-LAUNCH-PLAN.md`.)
3. **One shared backend + clean API** serving web + extension + mobile (Supabase already does this — don't fork the data layer per surface).
4. **Consistent IDs & cross-module associations** (company ↔ contact ↔ lead ↔ meeting ↔ task) so records link cleanly and tasks/AI can traverse them.
5. **Embedding-ready data shape** — keep notes/activity as clean text tied to record IDs so pgvector/RAG can be layered on without reshaping data.

Everything else — UI polish, the AI itself, the extension, dashboards, mobile — layers on top of these without breaking them.

## Where we are now (summary)
CRM is **built and live** (crm.altleads.com): all data migrated, every module, per-row security + masking, admin panel, update flows with history. Internal go-live needs only: role posture, team logins, access validation, email sign-off — **plus clearing the ownership write-path risk**. Decks for leadership: `deck-product-launch.(html|pdf)` and `deck-product-guide.(html|pdf)`. Full plan: `INTERNAL-LAUNCH-PLAN.md`. Related: [[outreach-only-north-star]].
