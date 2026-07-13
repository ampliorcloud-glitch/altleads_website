# Views & Preview Panel — plan (2026-06-22)

> Ankit's two future requirements: (1) **multiple views** (Kanban + Grid + Table/Excel + more) on every module, and (2) clicking a record opens a **right-hand preview panel** (a compact mobile/tablet-style "mini full record"), not the full page. This doc captures the live-HubSpot research, the design, and the rollout. Epics: **ALT-324** (views), **ALT-327/328** (preview panel), **ALT-329** (more views), **ALT-330** (enrichment).

## What HubSpot actually surfaces (live pull, 2026-06-22)

Pulled 1 company + 1 contact + 1 deal with their properties + associations. The high-signal fields HubSpot leads with — what we should mirror in our preview + detail views:

| Theme | HubSpot fields | We have? |
|---|---|---|
| **Owner** | `hubspot_owner_id` (front-and-center) | ✅ just built (Assign owner) |
| **Pipeline position** | `lifecyclestage` (lead→opportunity→customer) + `hs_lead_status` (NEW/IN_PROGRESS…) | ~ we have stage / contact_status / account_status |
| **Recency / engagement** | `notes_last_contacted`, `notes_last_updated`, `num_notes`, `num_contacted_notes`, `hs_latest_meeting_activity` | ❌ we have a timeline but no "last contacted" chip or engagement counts |
| **Associations (with counts)** | `num_associated_contacts`, `num_associated_deals`; contacts↔companies↔deals | ~ we show Leads(n)/Colleagues(n); no unified counts |
| **Next action** | `hs_next_step` (deal), tasks/meetings | ~ we have tasks/meetings, no inline "next step" |
| **Deal value/forecast** | `amount`, `hs_deal_stage_probability`, `hs_forecast_amount`, `pipeline`, `dealstage` | ~ we have opportunity value on meetings |
| **Identity/contactability** | name, jobtitle, company, email, phone, mobilephone, `hs_linkedin_url`, city/state, industry | ✅ |

**Takeaway:** our records already carry most identity/contact fields. The gaps worth adding (ALT-330) are the **recency + engagement signals** ("last contacted", # touches), **association counts**, and a lightweight **"next step"** — these are what make HubSpot's preview feel informative at a glance.

## (A) Multiple views — ALT-324

A per-list **view switcher** (persisted per user, like column prefs), exposing:
- **Table** (current TanStack grid / "excel" feel) — already built; just expose it in the switcher.
- **Grid** (cards) — ALT-325, shared `<CardGrid>`: avatar + name + key fields + owner/status chip + quick actions.
- **Kanban** (board) — ALT-326, extend the ALT-292 kanban components to group Companies by `account_status`, Contacts by `contact_status`, Meetings by `meeting_status` (Leads board already exists by stage).
- **More (research, ALT-329):** Calendar (Meetings + My Tasks), Map (Companies by city/site — ties directly to site-feasibility ALT-277/278: feasible/non-feasible per site + employee size per city group), Split (list + persistent preview).

Rollout: build the switcher + Grid first (works on all four lists), then Kanban per module, then research the specialized views.

## (B) Right-hand preview panel — ALT-327 / ALT-328

Clicking a row opens a **right slide-over** (~420px, mobile/tablet width, all key info, dense) instead of navigating. An **"Open full record →"** button still goes to the existing detail page (detail pages stay as the deep view). 

- **`RecordPreviewPanel`** — generic reusable shell (right drawer, backdrop, ESC/close, "Open full record" action). One component, all modules.
- **Per-module content** (ALT-328): a compact body mirroring each detail page but denser — HubSpot-style header (owner + status chips), quick contact actions (call/email/linkedin), key fields, association counts, recent activity (~5).
- **Pilot:** Contacts (building now). Then Companies, Leads, Meetings, Wishlist.
- **Why a panel:** keep the list context, scan records fast (HubSpot/Salesforce "preview drawer"), drop full-page loads for quick checks. The full page remains for deep edits.

## Sequencing
1. **Preview panel pilot — Contacts** (in progress) → validate the pattern with Ankit.
2. Roll the panel out to Companies / Leads / Meetings / Wishlist (ALT-328).
3. **View switcher + Grid** across the four lists (ALT-324/325).
4. **Kanban per module** (ALT-326).
5. **Enrichment** — last-contacted / engagement counts / association counts / next-step / quick-actions row (ALT-330), on both preview + detail.
6. **Research views** — Calendar / Map / Split (ALT-329); Map dovetails with site-feasibility.

_Grounded in a live HubSpot data pull (companies/contacts/deals) on 2026-06-22._
