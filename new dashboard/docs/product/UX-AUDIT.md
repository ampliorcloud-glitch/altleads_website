# UX / UI / Feature-Gap Audit — AltLeads CRM web app
*Generated 2026-06-21 by a 26-agent audit swarm (15 per-screen auditors + 9 cross-cutting dimension auditors + synthesis + a completeness critic). **718 raw findings → 170 deduped.** This is the answer to "what features, UI, UX can be improved — there are thousands of these issues, find them all."*

> **✅/🟡 status tags added 2026-06-28 — items marked ✅ IMPLEMENTED are DONE (don't re-build); 🟡 PARTIAL = partly done; untagged = still open. Verify against code before acting.**

> How to read this: **Section 1** is the owner TL;DR. **Section 2** = the 13 recurring patterns (the "why so many"). **Section 3** = 14 quick wins (small effort, ship this week). **Section 4** = the ranked Top 30. **Section 5** = missing capabilities that block the "superpower" north-star. **Section 6** = where the problems cluster. **Section 7** = what we did *not* audit. **Section 8** = the launch lens (what blocks internal launch vs. after).
> Effort key: **S** ≈ hours, **M** ≈ 1–3 days, **L** ≈ multi-day/needs new backend. Nothing here is built yet — this is the backlog for your sign-off.

---

## 1. Owner TL;DR — the five that matter most
The app is feature-rich but has **systemic gaps that repeat on every screen** — fixing them once (shared components) fixes them everywhere. In priority order:

1. **Multiselect exists everywhere but does nothing except Export.** Every list already has the checkboxes — but you can't bulk-change status, bulk-reassign, or bulk-approve. For an *"update records in bulk, don't create"* CRM this is the single biggest missing payoff. **(Top priority #1.)** — ✅ IMPLEMENTED (bulk-action bars, bulk reassign/status/project, progress/cancel — ALT-401/ALT-415)
2. **No app-wide "did it save?" + "are you sure?" system.** No toasts, and the only confirmation in the entire app is one popup. Saves are silent, errors get swallowed (including "you don't own this record"), and irreversible actions (close a lead, cancel a meeting, approve) fire on a single click. **(#2, #3.)** — ✅ IMPLEMENTED (Toast.tsx + ConfirmDialog.tsx)
3. **Filtering is primitive.** Every filter is a single-value dropdown — no multi-select, no search-in-filter, no saved views, no advanced/per-column filters, and refreshing the page wipes your worklist. You specifically called this out. **(#6–#9, #24.)** — 🟡 PARTIAL (multi-select + active-filter chips done; saved filter segments still open ALT-404)
4. **Accessibility + keyboard use is broken app-wide.** The focus ring is stripped globally, table rows can't be opened by keyboard, modals don't close on Escape. **(#4, #5, #26.)** — 🟡 PARTIAL (focus ring ✅ index.css; keyboard rows ✅ useListKeyboardNav.ts; Esc-to-close ✅ Modal.tsx; full ARIA dialog semantics still open Top #26)
5. **The dashboard is a passive poster, not a worklist.** Same for everyone, all-time totals, nothing clickable, no "what do I do today." The critic flagged a whole missing layer: **call queue, click-to-call, follow-up reminders, "not contacted in N days"** — the things that make a caller fast. **(#15, #16 + Section 5.)**

**Bottom line for launch:** none of these *block* a careful internal launch, **except** the ones that hide failure — silently-swallowed RLS/ownership errors (#2 quick-win + the assigned-ownership write-path fix already on the list) and missing destructive-action confirms. Those should land with the launch. Everything else is the post-launch quality runway.

---

## 2. The 13 themes (why there are "thousands")
Most of the 170 findings roll up into these patterns. Fix the pattern, not the instance.

| # | Theme | What it means | ~Findings |
|---|-------|---------------|:---:|
| 1 | **Multiselect wired, bulk actions missing** | All 5 lists + Approvals/Admin have selection; it only feeds Export. No batch endpoints exist. | 24 | — ✅ IMPLEMENTED (bulkActions.ts, BulkProgressBar.tsx, ALT-401/ALT-415)
| 2 | **No advanced / saved / multi-value / persisted filtering** | Single-select native dropdowns; no saved views, chips, presets, or URL persistence — refresh resets your worklist. | 46 | — 🟡 PARTIAL (multi-select filters + chips done; saved filter segments + URL persistence still open)
| 3 | **No toast/confirm system; destructive actions unguarded** | Silent or never-dismissing feedback; swallowed errors; one-click irreversible actions. | 52 | — ✅ IMPLEMENTED (Toast.tsx + ConfirmDialog.tsx)
| 4 | **2–3 inconsistent table engines + drifting primitives** | Contacts & Approvals hand-rolled vs TanStack elsewhere; 3 button systems, 5 badge styles, 5 avatar copies. | 40 |
| 5 | **Accessibility gaps throughout** | Focus ring stripped; rows/headers not keyboard-operable; modals lack roles/trap/Esc; no aria-live. | 60 | — 🟡 PARTIAL (focus ring ✅ index.css; keyboard nav ✅ useListKeyboardNav.ts; Esc ✅ Modal.tsx; full ARIA trap + aria-live still open)
| 6 | **Weak empty / loading / error states** | Single spinner collapses the table; can't tell "no data" from "no match"; errors are tiny red text, no Retry; no ErrorBoundary. | 45 | — 🟡 PARTIAL (ErrorBoundary ✅ RouteErrorBoundary/AppShell; no-data-vs-no-match ✅ hasActiveFilters branches; Retry + skeleton states still open)
| 7 | **Truncation without tooltips + raw data** | Names/emails/cities clip with no hover-to-read; dates show raw ISO; owner hardcoded "Unassigned". | 38 |
| 8 | **Outreach-only posture violated** | "New Lead/Company/Contact" shown to every role; inline-update affordances (the thing they *should* do) largely missing. | 22 |
| 9 | **No dirty-guard / keyboard / validation on forms** | Any navigation or backdrop click discards edits; weak phone/email/URL validation; native selects over huge lists. | 55 |
| 10 | **Client-side-everything scaling risk** | Every list downloads the full dataset (Contacts capped at 1000) and filters in the browser; no cache. | 15 |
| 11 | **Dashboard non-actionable / non-personalized** | Identical for all roles, all-time org totals, nothing clickable, no "today." | 24 |
| 12 | **Desktop-only / non-responsive** | Fixed 240px sidebar, zero breakpoints, toolbars don't wrap, tables overflow — unusable on tablet/phone. | 16 |
| 13 | **Detail-page navigation & deep-linking gaps** | Tabs/projects not deep-linkable; no prev/next-lead queue; the TopBar bell is a dead button. | 18 |

---

## 3. Quick wins — 14 small fixes, high payoff (do these first)
All **effort S** (hours each). These are the "small things missing" you mentioned — most are 1-file changes.

| # | Fix | Where | Impact |
|---|-----|-------|:---:|
| 1 | Add hover tooltips (`title`) to all truncated cells so clipped names/emails are readable | All lists + detail panels | High |
| 2 | Remove the dev-era "live Supabase data — read-only preview" banners | Leads, Wishlist, Dashboard | Med | — ✅ IMPLEMENTED (grep confirms none remain in codebase)
| 3 | Wire the notification bell to `/notifications` + add an unread badge (it's a dead button today) | TopBar | High | — ✅ IMPLEMENTED (TopBar.tsx: navigates to /notifications + fetchUnreadNotifCount badge)
| 4 | Role-gate / hide "New Lead / New Company / New Contact" for outreach roles | All lists + detail | High | — ✅ IMPLEMENTED (gated by `canCreateData = isAdmin`, AuthContext, on all 5 list pages) |
| 5 | Restore a global keyboard focus ring (CSS currently strips it from every control) | `index.css` | High | — ✅ IMPLEMENTED (index.css :focus-visible ring, UX-AUDIT #4)
| 6 | Add a clear (×) button inside every search box | All list search inputs | Med | — ✅ IMPLEMENTED (× clear button present on all 5 list pages: Leads, Companies, Contacts, Meetings, Wishlist)
| 7 | Make email/phone clickable (`mailto:`/`tel:`) + one-click copy | Detail panels + list cells | Med | — ✅ IMPLEMENTED (CopyButton.tsx in detail/preview panels)
| 8 | Add `aria-label`s to checkboxes and the bell | Lists, TopBar | Med | — ✅ IMPLEMENTED (row/select-all checkboxes + bell all have aria-labels) |
| 9 | **Stop swallowing inline status / stage-change / toggle errors** (show the failure) | Contacts inline status, lead stage, admin toggles | High |
| 10 | Persist banner-dismissal + active tab/project in URL/localStorage | Leads, Wishlist, detail tabs | Med | — 🟡 PARTIAL (project ✅ ProjectContext; Lead/Company detail active tab ✅ localStorage; URL deep-linking still open) |
| 11 | Distinguish "no data" vs "no filter match" + inline Clear-filters | Leads, Companies, Contacts | Med | — ✅ IMPLEMENTED (hasActiveFilters branches in listFilters.ts + ActiveFilters.tsx)
| 12 | Add a Retry button to load-error states | All lists/detail/modals | Med | — 🟡 PARTIAL (all 5 list pages have error-state + Retry; some detail/modals still open) |
| 13 | Fix the Contacts 1000-row cap (fetch single row by id; warn on truncation) | Contacts data layer | High | — 🟡 PARTIAL (cap raised to 50000 + truncation banner ALT-428; true server-side paging still open)
| 14 | Add Escape-to-close + "discard changes?" backdrop guard to modals | All modals | Med | — ✅ IMPLEMENTED (Modal.tsx: Esc closes; useUnsavedChanges.ts: dirty-state guard)

---

## 4. Top 30 ranked priorities
The deduped, prioritized backlog. (Detailed implementation notes for each are in the raw findings; ask me to expand any row.)

| Rank | Title | Area | Category | Sev | Effort |
|:---:|-------|------|----------|:---:|:---:|
| 1 | **Bulk-action bars on all lists** (multiselect only exports today) | Leads/Companies/Contacts/Meetings/Wishlist/Approvals/Users | bulk actions | High | L | — ✅ IMPLEMENTED (bulkActions.ts + BulkProgressBar.tsx + ALT-401/ALT-415: bulk reassign/status/project + progress/cancel)
| 2 | **One global toast + confirmation system** | App root, all write paths | microinteraction | High | M | — ✅ IMPLEMENTED (Toast.tsx + ConfirmDialog.tsx)
| 3 | **Confirm every destructive/irreversible action** | Clinch, meeting cancel, approve, disable, convert | microinteraction | High | M | — ✅ IMPLEMENTED (ConfirmDialog.tsx wired to destructive actions)
| 4 | Restore a visible keyboard focus indicator app-wide | `index.css` | accessibility | High | S | — ✅ IMPLEMENTED (index.css :focus-visible ring)
| 5 | Make table rows + sortable headers keyboard-operable | All tables | accessibility | High | M | — ✅ IMPLEMENTED (useListKeyboardNav.ts: j/k/Enter row navigation)
| 6 | **Searchable multi-select filters** (replace single-select dropdowns) | All filter panels | filtering | High | M | — ✅ IMPLEMENTED (MultiSelectFilter.tsx + useListFilters/listFilters.ts + ActiveFilters.tsx)
| 7 | **Advanced / per-column filtering + missing core facets** | All lists | filtering | High | L |
| 8 | **Saved views** that capture filters+sort+density (multiple, named) | All lists | filtering | High | M | — 🟡 PARTIAL (column-layout + density views persisted via user_view_pref; saved filter SEGMENTS still open ALT-404)
| 9 | Persist list/detail state (filters, sort, page, tab) in the URL | All lists + detail | filtering | High | M |
| 10 | "Select all N matching" across pages (not just current page) | All paginated lists | bulk actions | Med | M | — ✅ IMPLEMENTED (SelectAllMatchingBar.tsx)
| 11 | **Global search / Cmd-K command palette** | TopBar / shell | search | High | L | — ✅ IMPLEMENTED (CommandPalette.tsx + GlobalSearchBar.tsx)
| 12 | Converge on one DataTable engine (migrate Contacts + Approvals) | Contacts, Approvals | consistency | High | L |
| 13 | Dirty-state navigation guard on all forms/modals | All forms | navigation | High | M | — ✅ IMPLEMENTED (useUnsavedChanges.ts)
| 14 | Move filter/sort/paginate server-side (stop loading whole datasets) | All list data layers | performance | High | L |
| 15 | **Make the dashboard role-aware + actionable** ("what do I do today") | Dashboard | missing feature | High | L |
| 16 | Make dashboard cards/bars/activity rows clickable drill-downs | Dashboard | navigation | High | M |
| 17 | Masked email/phone → distinct masked + click-to-reveal treatment | Contacts, Company detail | data display | High | M |
| 18 | Sticky table headers + frozen identity column | All tables | table UX | Med | S | — ✅ IMPLEMENTED (EditableGrid.tsx + ALT-414)
| 19 | Top-level React ErrorBoundary (+ per-route fallback) | App root | error states | High | M | — ✅ IMPLEMENTED (ErrorBoundary.tsx + RouteErrorBoundary in AppShell)
| 20 | Forgot-password + show/hide toggle; reauth on password change | Login, SalesLogin, Settings | forms | High | M |
| 21 | Constrain header stage-select + meeting workflow transitions | Lead detail, Meeting tab | forms | High | M |
| 22 | Form validation (email/phone/URL/required/dirty) + on-blur feedback | All forms | forms | Med | M | — 🟡 PARTIAL (submit-time validation + required asterisks present; on-blur feedback still open)
| 23 | Skeleton rows/cards instead of a single centered spinner | All lists/detail/dashboard | error states | Med | M | ✅ IMPLEMENTED (ALT-200, Skeleton.tsx; all 5 lists) |
| 24 | Collapsible filter panels + active-filter chips + per-filter clear | All filter panels | filtering | Med | M | — ✅ IMPLEMENTED (ActiveFilters.tsx: active-filter chips + per-filter clear)
| 25 | Fix Companies Account-Status column (load full set, sort/filter/export) | Companies | data display | High | M |
| 26 | Proper ARIA dialog semantics + focus trap on modals | All modals | accessibility | High | M |
| 27 | Approvals: age/SLA, sort, search, filters, pagination, in-modal approve | Approvals | table UX | Med | M | 🟡 PARTIAL — search, age/SLA badge, sort (date/name/company/agent), status filter, in-modal approve all ✅; pagination still open |
| 28 | Inline-edit + quick row/hover actions across lists & panels | Leads/Companies/Contacts | missing feature | Med | M | — ✅ IMPLEMENTED (EditableGrid.tsx inline-edit cells)
| 29 | Make the Sales Portal a first-class shell (not the internal grid reskinned) | Sales portal | missing feature | Med | M |
| 30 | Standardize shared primitives (Button/Badge/Avatar/Input/Modal/Pagination/EmptyState) | App-wide | consistency | Med | M |

---

## 5. Missing capabilities — the "fast caller" + superpower gaps
The completeness critic surfaced **27 capabilities that don't exist yet** and that the per-screen audit couldn't see (you can't flag a screen that was never built). These are what turn the CRM from "a database with forms" into the *outreach machine* + AI superpower in the north-star. Grouped:

**The high-volume calling loop (biggest cluster):**
- **No single-screen call workflow** — queue → dial → log disposition → auto-advance to next lead. Every call needs manual navigation.
- **No real click-to-call / dialer** — only a couple of `tel:` links; no in-app dialer, call logging from rows, or duration/outcome capture.
- **No follow-up reminders / callback scheduling / task system** — can't set "call back tomorrow 3pm" and be surfaced it when due. *(This is your "task manager" ask.)*
- **No "my work queue today"** — overdue follow-ups, untouched leads, fresh assignments, prioritized. The dashboard is passive.
- **No snooze/defer** to push a lead out of today and have it reappear later.
- **No disposition outcome enforcement** — a call can end with no scheduled next step, so leads go dark.
- **No call-script / talking-points panel** during a call; **no autosave** of in-progress notes (dropped session = lost notes).

**Trust & data quality (matters a lot with bulk-migrated data):**
- **No duplicate detection / merge** for leads/contacts/companies — a known risk after bulk import. — 🟡 PARTIAL (detection ✅ findDuplicates.ts + DuplicatesButton.tsx ALT-394; merge exists ALT-293 but non-atomic — live risk ALT-416; atomic merge staged ALT-416)
- **No data-freshness signals** — "last contacted," "days since touch," "not called in N days."
- **No per-record audit/history** surfaced consistently ("who changed what, when").
- **No concurrent-edit lock/conflict handling** — two agents can silently overwrite each other.
- **No "Do Not Call" / opt-out / suppression flag** + warning (compliance).
- **No timezone-aware scheduling** (caller vs prospect TZ) for meetings/callbacks.

**Speed & ergonomics for people who live in lists all day:**
- **No global/command-palette quick search** by name/phone/email. — ✅ IMPLEMENTED (CommandPalette.tsx + GlobalSearchBar.tsx)
- **No inline quick-edit** in rows (change status/owner without opening the record). — ✅ IMPLEMENTED (EditableGrid.tsx inline-edit cells)
- **No "recently viewed" / pinned / favorite** records.
- **No undo / undo-toast** for status, disposition, or bulk edits.
- **No row-density / compact mode**, larger hit targets, fewer clicks per record. — ✅ IMPLEMENTED (useDensity.ts + DensityToggle.tsx)
- **No bulk reassignment / ownership transfer** (important given the assigned-not-created model). — ✅ IMPLEMENTED (bulkActions.ts + ReassignModal + ALT-401/ALT-415)
- **No SLA / aging / escalation cues** for team leads to manage the floor.

**Personalization & resilience:**
- **No onboarding / first-run guidance** for the ~110 users getting first logins — no "here's your queue" start.
- **No per-user notification preferences** (despite a notifications page existing).
- **No dark mode / display preferences.**
- **No guided re-import / update-by-upload** round-trip for outreach users.
- **No offline / poor-connectivity resilience** or autosave.
- **No mobile-specific call flow** (agents may call from phones).

> These map directly to the ecosystem north-star: the **task manager**, the **AI "pick a contact → here's what to do"** (needs the audit/history + freshness data above to feed RAG), and the **Chrome-extension/mobile capture** all sit on top of this missing layer.

---

## 6. Where the problems cluster (category heatmap)
Counts are raw findings before dedupe — they show where to aim, not exact totals.

| Category | Raw findings | | Category | Raw findings |
|----------|:---:|---|----------|:---:|
| Forms (validation/dirty/keyboard) | 92 | | Table UX | 68 |
| Empty / loading / error | 78 | | Data display / truncation | 63 |
| Consistency / primitives | 74 | | Filtering | 58 |
| Accessibility | 71 | | Navigation / deep-linking | 48 |
| Microinteractions / feedback | 42 | | Bulk actions | 36 |
| Missing features | 34 | | Performance | 24 |
| Responsiveness | 24 | | Search | 18 |

**Read:** the largest piles are **forms, empty/error states, consistency, and accessibility** — all of which are *fix-once-via-shared-components* wins. That's the leverage.

---

## 7. What this audit did NOT cover (coverage gaps)
So we know the edges of this report:
- **Email / notify-service UX and the actual email / .ics deliverables** (web-UI only) — that's the separate EMAIL-TEMPLATES v2 track.
- **Security/privacy of the masking implementation** (whether masked values leak via export / network payloads / timeline) — only the *UI affordance* was flagged here.
- **Chrome extension and mobile** surfaces (where wishlist data originates).
- **Measured performance** (bundle size, render counts, behavior on the full ~100k-lead dataset) — all perf findings are inferred from code, not profiled.
- **Concurrency / lost-update correctness** when two agents edit the same record.
- **Internationalization / timezone (IST)** handling across the app — only spot-checked.
- **Print/PDF/export visual quality**, and the planned-but-unbuilt **executive/sales dashboards**.
- **Onboarding / first-run / empty-tenant** and **admin bulk-import** flows (the stated launch task) — only partially covered.
- **Test coverage, analytics/observability, error logging.**
- **Color-contrast vs WCAG ratios** for the full token palette (flagged generically, not measured).

---

## 8. Launch lens — what to do with this
This is a **post-launch quality runway**, not a launch blocker — with three exceptions that should ride *with* the launch because they hide failure or data loss:

**Ship with internal launch (small, safety-critical):**
- Quick-win **#9** — stop swallowing inline status/stage/toggle errors (an agent must *see* an RLS/ownership rejection). Pairs with the assigned-ownership write-path fix already on the build list.
- **Top #3** — confirm destructive/irreversible actions (close lead, cancel meeting, approve).
- Quick-win **#4** — hide create buttons from outreach roles (matches the locked create-is-admin-only decision).
- Quick-win **#13** — the Contacts 1000-row cap (silent data truncation).

**First post-launch sprint (the high-leverage shared systems):**
- **#2** global toast/confirm, **#6** searchable multi-select filters, **#1** bulk-action bars, **#4/#5** accessibility baseline, **#19** ErrorBoundary. These unlock dozens of downstream findings at once.

**The runway after that:** saved views + URL persistence (#8/#9), server-side data (#14), the actionable dashboard + worklist (#15/#16), the calling loop (Section 5), and the shared-component convergence (#12/#30).

> Recommended next move: I add the **14 quick wins + Top 30** to the backlog tracker as ALT-### tickets (grouped under a "UX-AUDIT" epic), and you tell me which of the four launch-with items you want me to start building. I will **not** start implementing until you pick — this report is for your review first.
