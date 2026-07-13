# Persona Audit — 2026-06-22

> Output of 4 parallel research agents (read-only) auditing the live app from each user's point of view, benchmarked against HubSpot / Zoho / B2B best practice. New findings became tickets **ALT-296…ALT-323**; cross-cutting unknowns went to `AMBIGUOUS-DECISIONS.md`. This doc is the personas + journeys + findings index.

## Who uses the system (all personas)

| Role | Persona | Core goal | Surface |
|---|---|---|---|
| 1 ADMIN | Ops / data owner | Get the team live, keep data clean, control access | Internal CRM + `/admin` |
| 2 TEAM_LEAD | Pod manager | Distribute work, monitor pipeline, approve reports, QC | Internal CRM + Approvals |
| 3 AGENT | Caller / outreach | Work my assigned queue: call → log outcome → next step | Internal CRM (lists + detail + tasks) |
| 6 QC | Quality reviewer | Review report/call quality before it advances | **No workspace today (ALT-304)** |
| 4 SALES_HEAD | Client sales manager | See team pipeline, assign to reps, add reps, exec dashboard | Sales Portal `/sales` |
| 5 SALES_PERSON | Client field rep | See *my* meetings, prep, give feedback | Sales Portal `/sales` |
| — CLIENT | Client stakeholder | "Show me the meetings booked for us" | Client Portal `/portal` (inert pre-launch) |

## Key journeys (and where they break today)

- **Admin → go live:** provision ~110 logins (no bulk UI — ALT-151), import/maintain data (no CSV — ALT-159), stand up + staff a project (one-user-at-a-time — ALT-299), assign work (✅ reassign shipped), oversee (activity feed thin + admin-only — ALT-300).
- **Team Lead → run the pod:** distribute leads (✅ bulk reassign, but unscoped targets + no Salesperson column — ALT-296/A1), monitor team (no team dashboard — ALT-301), approve (✅ works, but org-wide not team-scoped — A5), QC (no surface — can't see activity).
- **Agent → daily loop:** see *my* records (no "Mine" view — ALT-305) → call (no click-to-call — ALT-307) → log outcome (two conflicting loggers — ALT-303) → set next step (disposition doesn't create follow-up — ALT-308) → see what's due (split across 3 screens — ALT-306). The core loop works but is slow and unscoped.
- **Sales Person → prep & report:** see my meetings (NOT scoped — sees everyone — ALT-167) → open record (✅ mobile-ditto works) → give feedback (stub — ALT-168) → wishlist (✅ works).
- **Sales Head → manage:** team view, assign to downline, add rep, exec dashboard — **all missing** (ALT-167/169/171).
- **Client → view:** meetings list/detail — built but **inert** until the portal schema is applied/exposed (ALT-227/229); record component has drifted from the sales one (ALT-311).

## Findings index (new tickets)

**🔴 Launch-blocking / P1**
- ALT-296 — Owner/Salesperson columns on lists (managers fly blind today; ties to the reassign work)
- ALT-301 — Manager/team dashboard rollup
- ALT-303 — Unify call logging + one canonical disposition vocabulary
- ALT-304 — QC workspace + mandate
- ALT-305 — "My records" default + Assigned-to facet
- ALT-306 — Unified "Today/Next" queue
- ALT-311 — Unify meeting-record component across sales+client portals
- ALT-314 — Design-token sweep (hardcoded hex → vars)
- ALT-315 — One canonical Button component
- (+ existing P1s reconfirmed: ALT-151 bulk logins, ALT-152 write-path RLS, ALT-167 sales scoping, ALT-168 sales feedback)

**P2**
- ALT-297 ClientsTab dead toggle · ALT-298 Add-User roles hardcoded · ALT-299 multi-add project staffing · ALT-300 activity filters+TL access · ALT-307 click-to-call · ALT-308 disposition→follow-up · ALT-309 inline stage edit on Leads · ALT-310 stale search index · ALT-316 shared DataTable · ALT-317 shared Modal · ALT-318 sticky headers (quick win) · ALT-319 muted-text contrast (quick win) · ALT-320 EmptyState · ALT-321 canonical status-color

**P3**
- ALT-302 disabled-with-tooltip bulk buttons · ALT-312 sales forgot-password · ALT-313 back-to-CRM switcher · ALT-322 CSS hover · ALT-323 breadcrumb record name

## Cross-cutting verdict (UI)
~75% of the way to a HubSpot/Zoho feel. Features and interaction polish are largely done (prior ALT-177..215 audit); what remains is **visual-system discipline + component reuse** — token adherence, one Button, one table shell, sticky headers, contrast, empty states. Quick, safe wins: ALT-318, ALT-319, ALT-315, ALT-320, ALT-317.

_See `AMBIGUOUS-DECISIONS.md` for the unknowns that must be resolved before several of these can be built correctly._
