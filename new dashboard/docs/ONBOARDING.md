# Developer Onboarding — AltLeads CRM

Welcome. This repo is the whole product: web app, email/notify service, migration
appliers, and the living docs. Read this once, top to bottom, before your first commit.

## 0. The one rule that can break production

**Pushing to `main` auto-deploys the LIVE CRM (crm.altleads.com).**
Never push to `main` directly. Work on a feature branch, open a Pull Request, and
the owner (Ankit) merges + pushes on the deploy schedule (evenings after 6pm / weekends).

```
git checkout -b feat/ALT-XXX-short-name   # always branch
# ... commit as usual ...
git push origin feat/ALT-XXX-short-name   # then open a PR
```

## 1. Get running

1. Clone the repo, install Node 20+.
2. `cd new-code/web && npm install` — the React app (Vite). `npm run dev` for local dev.
3. `cd new-code/notify-service && npm install` — the Express API + email service.
4. Secrets are NEVER in the repo. Ask the owner for the `.env` values you actually
   need (local dev works against the TEST instance — do not point local work at prod).
5. Typecheck before every commit: `cd new-code/web && npx tsc -p tsconfig.app.json --noEmit`.

## 2. Where everything lives

| Path | What |
|---|---|
| `CLAUDE.md` | Operating guide — standards, resume protocol, key facts. **Read it.** |
| `REBUILD_LOG.md` | Running state / source of truth. Newest entries at the bottom. Append what you did. |
| `new-code/web` | React/Vite web app |
| `new-code/notify-service` | Express service: email, admin endpoints, write gateway (`/api/write`) |
| `new-code/migration` | DB migration appliers (`.cjs`). Raw `.sql` is gitignored — appliers ARE the migrations. |
| `docs/product/` | PRD, VISION, DECISIONS (ADRs), decision-board.html (visual decisions), SALES-PORTAL, … |
| `docs/` | ARCHITECTURE, SECURITY-AUDIT, QA-AUDIT, USER-STORIES-AND-FLOWS, ONBOARDING (this file) |
| `docs/deploy-platform/` | Dokploy PaaS runbook — read before launching any new app |
| `old-code/` | Archived vendor system — READ-ONLY reference |

Trackers (`.xlsx`) are gitignored artifacts — regenerate, never hand-edit:
`node new-code/web/scripts/gen-backlog-tracker.cjs` (backlog) ·
`node new-code/web/scripts/gen-review-tracker.cjs` (review hub).

## 3. The working standards (non-negotiable)

- **Every requirement/decision gets captured immediately**: `REBUILD_LOG.md` + the right
  `docs/product/` doc + a ticket in the backlog generator (then re-run it). If it's only
  in chat/your head, it's lost.
- **Mark findings done at the source**: implement something an audit doc lists → tag it
  inline there (`— ✅ IMPLEMENTED (ALT-### / commit)`).
- **Tickets**: everything is an `ALT-###`. New work = new ticket in
  `gen-backlog-tracker.cjs` (append in the last `V(...)` block, keep the numbering).
- **Never commit secrets** — `.credentials/`, `.env*`, `*.xlsx`, `*.sql`,
  `docs/CONVERSATION-LOG.md` are gitignored on purpose. Don't force-add them.
- **DB changes**: additive migrations as `.cjs` appliers in `new-code/migration`
  (STAGED by default, `--apply` to run). RLS/destructive changes need owner sign-off
  and a throwaway-login validation first.
- **Multi-tenancy rule (ADR-36, P0 active)**: every NEW table is born with
  `tenant_id int NOT NULL DEFAULT 1 REFERENCES tenant(tenant_id)`. No exceptions —
  it keeps the future retrofit from growing.
- **Branches**: `main` = hosting/deploy only (auto-deploys prod!). All internal work
  happens on `internal-work` (branch off it, PR back into it). Only the owner merges
  `internal-work` → `main`, on the deploy schedule.
- **Data isolation is DATABASE-level (RLS)**, not UI-level. Never "hide it in the UI"
  and call it secure.
- **Match the codebase style**: inline styles (F1 ruling), one Button (F2),
  colors from `web/src/lib/statusColors.ts` (F3) — the F-rulings live in
  `docs/product/AMBIGUOUS-DECISIONS.md`.

## 4. Key architecture facts (fast context)

- Supabase (Postgres + Auth + RLS). Roles: 1=ADMIN, 2=TEAM_LEAD, 3=AGENT,
  4=SALES_HEAD, 5=SALES_PERSON, 6=QC.
- Lead ownership = `lead_report.user_id` (the assignee) — NOT `created_by`.
- Writes go through the write gateway (`POST /api/write`, allow-listed per role) when
  `VITE_USE_WRITE_GATEWAY=true` (ON at crm-test, OFF at prod until import day).
- Email sending: `notify-service/src/emailSending.js` — domain registry + per-project
  sending domains + routing ladder (connected mailbox → relay → system fallback).
- Prod: Hostinger (git auto-deploy from `main`). Test: `crm-test.altleads.com` on our
  Dokploy droplet. `/health` on either shows the exact live commit.
