# UAT Checklist — test 1 by 1, fill in the Result column

> **For Ankit.** Test each item, then write your result in the **Result** column (and any **Notes**). I'll read this file and fix anything marked ❌ / ⚠️, then update the status back here. We keep iterating on THIS file.
>
> **Status legend:** ⬜ not tested yet · ✅ works · ❌ broken · ⚠️ works but needs change
>
> **Where to test:** the running web app (the latest local build). Nothing is pushed to production yet.
>
> **Important caveat — two kinds of "reassign" tests:**
> - **Works NOW:** pressing reassign and the new owner getting it (the *assignment* saves).
> - **Only after the "RLS apply" step:** an assigned agent actually being *allowed to edit* their record, and a plain agent being *blocked* from reassigning. Those rows are marked **[after RLS apply]** — they will fail today on purpose, and that's expected until we apply + validate the database rule.

---

## A. Reassignment — single record

| # | What to test | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| A1 | Reassign a **lead's** salesperson | Open any Lead → header/stepper action row → **Change salesperson** → pick a person → Reassign | Saves; toast confirms; the new person shows as owner; they get an email + a bell notification | ⬜ | |
| A2 | Reassign a **meeting** | Open any Meeting → actions bar → **Change owner** → pick a person → Reassign | Saves; the meeting's salesperson updates (it follows the underlying lead) | ⬜ | |
| A3 | Reassign a **company's** owner | Open any Company → right-side header (Owner area) → **Change owner** → pick a person → confirm | Saves; owner shows the new person | ⬜ | |
| A4 | **Company → contacts cascade** (your ask) | Do A3 on a company that has several contacts → then open 2–3 of those contacts | Every contact of that company (in that project) now shows the **same** new owner automatically | ⬜ | |
| A5 | Reassign a **contact's** owner | Open any Contact → header actions → **Change owner** → pick a person → confirm | Saves; owner shows the new person | ⬜ | |
| A6 | Only managers see the button | Log in as a **plain Agent** (role 3) and open a lead | The **Change salesperson / owner** button is **hidden** (only Admin / Team Lead / Sales Head see it) | ⬜ | |

## B. Reassignment — bulk (lists)

| # | What to test | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| B1 | Bulk reassign **Leads** | Leads list → tick several rows → **Reassign (N)** → pick a person → confirm | All selected leads move to that person; toast shows how many; partial failures (if any) are reported, not silent | ⬜ | |
| B2 | Bulk reassign **Meetings** | Meetings list → tick rows → **Reassign (N)** → confirm | Same as B1 for meetings | ⬜ | |
| B3 | Bulk reassign **Companies** (+cascade) | Companies list → tick rows → **Reassign (N)** → confirm | Companies move **and** their contacts cascade to the same owner | ⬜ | |
| B4 | Bulk reassign **Contacts** | Contacts list → tick rows → **Reassign (N)** → confirm | Same as B1 for contacts | ⬜ | |

## C. Kanban board (leads)

| # | What to test | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| C1 | Open the board | Leads list → **Board** button (top of the list) | A board with one column per stage; each column shows a count and the lead cards in that stage | ⬜ | |
| C2 | Cards show useful info | Look at any card | Company/lead name + city + salesperson/agent | ⬜ | |
| C3 | Card opens the lead | Click a card (or press Enter on it) | Opens that lead's detail page | ⬜ | |
| C4 | Project scope respected | Pick a project in the top bar, then open the Board | Only that project's leads appear; back to "All projects" shows all | ⬜ | |
| C5 | Back to list | On the board, the **List view** button | Returns to the Leads list | ⬜ | |
| — | *(Drag a card to another stage)* | *Not enabled yet — read-only board for now (by design)* | n/a | — | drag = a later step |

## D. Always-visible search (top bar)

| # | What to test | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| D1 | Type to search | Click the search box in the top bar → type 2+ letters of a company/person | A dropdown appears with results **grouped** (Leads / Companies / Contacts / Tasks / Meetings) with counts | ⬜ | |
| D2 | Open a result | Click a result (or arrow-down + Enter) | Navigates to that record; dropdown closes | ⬜ | |
| D3 | Keyboard + close | Arrow keys move the highlight; Esc clears; click outside closes | All behave as described | ⬜ | |
| D4 | Old Cmd-K still works | Press Ctrl/Cmd + K | The old search palette still opens (both can coexist) | ⬜ | |

## E. Project-scoping fix (the bug you hit)

| # | What to test | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| E1 | Record opens in the chosen project | Pick a project (e.g. DEMO) in the top bar → open a Company or Contact | The per-project panel shows **the project you picked** (not the first one alphabetically) | ⬜ | |

---

## H. Bulk "Add to project" (Companies + Contacts)

| # | What to test | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| H1 | Add companies to a project | Companies list → tick several rows → **Add to project (N)** → pick a project → Add to project | Toast confirms N added; opening one of those companies shows it now belongs to that project (its per-project panel exists for that project) | ⬜ | |
| H2 | Add contacts to a project | Contacts list → tick rows → **Add to project (N)** → pick a project → confirm | Same as H1 for contacts | ⬜ | |
| H3 | Only managers see it | Log in as a plain Agent | The **Add to project** button is hidden (Admin / Team Lead / Sales Head only) | ⬜ | |

## I. Inline edit (already live for Contacts)

| # | What to test | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| I1 | Change contact status in the list | Contacts list → pick a project up top → in a row's **Status** cell, change the dropdown | Saves immediately (no opening the record); the change sticks on reload | ⬜ | |

## J. Quick wins (just shipped)

| # | What to test | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| J1 | Sticky table headers | Open any list (Leads/Companies/Contacts/Meetings) with many rows → scroll down | The column header row stays pinned at the top while rows scroll under it | ⬜ | |
| J2 | Client enable/disable works | Admin → Clients tab → toggle a client's status | The toggle actually changes status (confirm on disable) + toast; previously it did nothing | ⬜ | |
| J3 | Add-User roles complete | Admin → Users → Add User → open the Role dropdown | Shows all roles from the database (not a hardcoded 6); a newly added role would appear | ⬜ | |

## K. Record preview panel — Contacts pilot (just shipped)

| # | What to test | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| K1 | Row opens a preview drawer | Contacts list → click a row | A right-hand slide-over opens with the contact's compact record (owner + status, email/phone/LinkedIn, key fields, Leads + Colleagues, recent activity) — list stays behind it | ⬜ | |
| K2 | Open full record | In the drawer → **Open full record →** | Navigates to the full Contact detail page | ⬜ | |
| K3 | Close | Press Esc / click the backdrop / click ✕ | Drawer closes, you're back on the list | ⬜ | |
| K4 | Is this the right shape? | Eyeball the drawer contents/size | Tell me what to add/remove — this is the pattern I'll copy to Companies/Leads/Meetings | ⬜ | |
| K5 | **Project selector in the drawer** | In the Contact drawer → change the project dropdown in the "Project Status" block | Owner + status reload for that project (like the full record) | ⬜ | |
| K6 | **Edit status in the drawer** | Set a Contact Status / Description / Comments → **Save status** | Saves + toast (as ADMIN it works now; a non-owner agent will see "you can only edit records you own" until RLS is applied — expected) | ⬜ | |
| K7 | **Assign owner from the drawer** | **Assign owner** → pick a person | Owner updates in the drawer | ⬜ | |

## L. Views — Table / Grid switcher (all 4 lists)

| # | What to test | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| L1 | Switch to Grid | Any list (Leads/Companies/Contacts/Meetings) → the Table/Grid toggle in the toolbar → **Grid** | Records render as cards (avatar + name + key fields + a status/owner chip) | ⬜ | |
| L2 | Card click | Click a card | Same as clicking a row — Contacts opens the preview drawer; others open the detail page | ⬜ | |
| L3 | Choice sticks | Pick Grid, reload the page | It remembers Grid for that list (saved per user) | ⬜ | |
| L4 | Table still works | Toggle back to **Table** | The normal table returns; filters/pagination/bulk select unaffected | ⬜ | |

## M. Universal pass A→F (preview drawer + owner columns + inline status)

| # | What to test | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| M1 | Preview drawer everywhere | Click a row in **Companies / Leads / Meetings / Wishlist** | A right-hand preview drawer opens (compact record) with "Open full record →" — same as Contacts | ⬜ | |
| M2 | Edit in Company drawer | Company drawer → project selector + change Account Status/Feasibility/Owner → Save | Saves (admin); project selector reloads owner/status | ⬜ | |
| M3 | Change owner from Lead/Meeting drawer | Lead drawer → Change salesperson; Meeting drawer → Change owner | Reassigns; drawer refreshes | ⬜ | |
| M4 | Salesperson column on Leads | Leads list → Salesperson column + filter | Shows the assigned salesperson (distinct from Agent); filter works | ⬜ | |
| M5 | Owner column on Companies + Contacts | Pick a project → Companies/Contacts lists | Owner column shows the real per-project owner (not always "Unassigned") | ⬜ | |
| M6 | Inline Account Status on Companies | Companies list (project selected) → click the Account Status cell | Inline dropdown saves immediately (like Contacts) | ⬜ | |
| M7 | **Kanban on every module** | Each list → switcher → Kanban icon | A board grouped by that module's status/stage; Companies/Contacts prompt "select a project"; cards open the preview drawer | ⬜ | |
| M8 | **Compact icon switcher** | Look at the toolbar | Table/Grid/Kanban are now small icons (not wide labels) | ⬜ | |
| M9 | **Wishlist parity** | Wish List → switcher | Wishlist now has Table/Grid/Kanban + sticky headers, like the others | ⬜ | |
| M10 | **Bulk set status** | Companies/Contacts (project selected) → tick rows → **Set status (N)** → pick a status | All selected get that status; toast; statuses refresh | ⬜ | |
| — | *(Still pending: F — unify call logging — needs your decision below)* | — | — | — | |

---

## F. Held back — DO NOT expect these yet (here so you know the plan)

| # | Item | State | What unlocks it |
|---|---|---|---|
| F1 | Assigned **agent can edit** their records; plain agent **blocked** from reassigning | Built, not enforced | The **RLS apply** step (validate on test logins → show you → apply) |
| F2 | **Merge duplicates** button | Code built, no live button | Rebuild as one all-or-nothing server action + validate, then add the button |
| F3 | **Sales-side** reassign (Sales Head over their downline) | Role-aware, not downline-scoped | A separate "who reports to whom" database change |

---

## G. Coming next (I'm building these now — will add test rows when ready)

- **Bulk status-change** (tick rows → set a status for all)
- **Inline edit** — extend the Contacts inline-status pattern to Companies (account status) and to status on the other lists
- **Advanced per-column filters** on Contacts / Companies / Tasks

_Last updated: 2026-06-22 by Claude (CRM)._
