# Client Portal — Build Handoff (for the Opus build agent)

> You're picking up the **Amplior Client Portal**. This page is the *current-state + coordination* layer on top of the two plan docs. Read those FIRST, then this.

## 0. Start here (in order)
1. **`docs/product/CLIENT-PORTAL-PHASE1.md`** — the authoritative Phase-1 build plan (scope, roles, snapshot isolation, RLS, brand seam, build order, ticket map ALT-222..245). The **"Decisions LOCKED"** + **"BUILD STATUS"** sections at the bottom are the most important — they tell you what's already decided and already staged.
2. **`docs/product/CLIENT-PORTAL.md`** §12–§13 — the owner-interview source of truth (where it conflicts with §1–11, §12–13 win).
3. **`CLAUDE.md`** (repo root) — house rules. **`docs/deploy-platform/`** — READ before deploying the new app (we self-host a Dokploy PaaS; the portal is a new app on it or Hostinger).

## 1. What's ALREADY in the repo — do NOT re-author, verify/extend
The **foundation migrations are already staged + adversarially reviewed** (authored, `node -c` clean, **NOT applied to prod**) in `new-code/migration/`:
- `apply-portal-foundation.cjs` — `portal` schema, `client_portal_user`, `meeting_snapshot` (denormalized `project_id`+`client_assoc_id`+`assigned_user_id` per row), SECURITY-INVOKER `portal_*` views, `portal.notification`; clients get SELECT on views only, ZERO on base tables. (ALT-222/223/226/228)
- `apply-portal-rls.cjs` — portal RLS; **adds an `AS RESTRICTIVE deny_portal_session` policy to every RLS-enabled public table** so a portal session fails the CRM's permissive `USING(true)` base reads while staff (NULL client) are unaffected. (ALT-227)
- `apply-portal-snapshot-writer.cjs` — SECURITY DEFINER `portal.write_meeting_snapshot()` + AFTER INSERT/UPDATE trigger (the LOCKED mechanism). (ALT-224)
- `apply-portal-snapshot-backfill.cjs` — idempotent backfill of existing meetings. (ALT-225)

**Remaining VERIFY items before these apply** (from PHASE1 §BUILD STATUS): `started_at` cast on free-text `meeting_time`; deterministic meeting→lead_report resolution (no wrong-tenant stamp on reschedules); backfill completeness gate must ABORT not just print; `downline_user_ids()` definition (currently project co-membership — needs owner's reporting-tree decision, §12).

## 2. ⚠️ CRITICAL COORDINATION — RLS apply ordering (read this)
There is a **second, parallel staged RLS migration** I (the CRM-side session) just shipped:
- `new-code/migration/apply-project-read-isolation-rls.cjs` + `docs/product/PROJECT-READ-ISOLATION.md` — membership-gated SELECT isolation for the **internal CRM** (so internal users only see projects they're in).

**These two RLS migrations interact.** `apply-project-read-isolation-rls.cjs`'s own header states it must be applied **AFTER `apply-portal-rls.cjs`** (so `deny_portal_session` already exists). Both rewrite public-table SELECT policies.
**→ Do NOT apply either in isolation.** Before any prod apply, we sequence them together and run **ONE joint throwaway-login validation pass** covering BOTH staff roles (admin/TL/agent/QC/sales) AND portal client roles (Company Admin / Sales Head / Sales Person) — proving: staff can't cross projects, and no client can see another client's snapshot/notifications. This is the **ALT-229 HARD GATE** and it's shared between us. Coordinate the combined order with the CRM session before touching prod.

## 3. Architecture guardrails (non-negotiable — from the plan)
- **NET-NEW separate Vite app** (ALT-230), its own build/deploy/domain. **NOT** the `/sales` shell, **NOT** inside the AltLeads CRM bundle.
- **NO reuse of live-data CRM pages** (`LeadsPage`/`LeadDetailPage`/anything querying `company_master`/`lead_report`/`contact_master`/`meeting_master`). Every portal screen is new and reads ONLY `portal_*` snapshot views.
- Shared ONLY: Supabase client + `portal_*` data helpers + brand seam (BrandContext/CSS vars) + data-free presentational primitives (Modal/ConfirmDialog/Toast/Badge/SearchSelect…).
- **Snapshot-only isolation is load-bearing** — clients never touch base tables; isolation is by construction.
- **LOCKED decisions:** column whitelist = the **mobile-app field set** (`old-code/amplior-mobile-app-main` screens) — not a guessed subset; snapshot writer = **SECURITY DEFINER DB trigger** (already staged).

## 4. House conventions (match these)
- **Build check:** `cd new-code/web && npm run build` (tsc -b, `noUnusedLocals` ON). New portal app: its own build, same posture.
- **Migrations:** staged `.cjs` appliers (raw `.sql` gitignored). Verify `node -c`. **Apply to prod ONLY after owner sign-off + ALT-229 throwaway-login validation.** Never apply RLS/destructive to prod without validating on throwaway logins + showing the owner.
- **Deploys are MANUAL:** commit locally; push to prod ONLY on owner's explicit "push" (`git push altleads clean-main:main`, local branch `clean-main` → remote `main`).
- **DB read access** for schema checks: `new-code/migration/.env` (`PG_CONNECTION_STRING`, `pg`+`dotenv` in that folder's node_modules). Write temp `.cjs` INTO `new-code/migration/`, run, delete.
- **Never commit secrets** (`.credentials/`). Supabase ref `puvozfhypqbwbmbhrhcr`.
- **Capture decisions** in the relevant `docs/product/` doc + `REBUILD_LOG.md` + the backlog tracker (`node new-code/web/scripts/gen-backlog-tracker.cjs`) as you go.

## 5. If you orchestrate subagents — two hard-won lessons (this session)
- **Forbid delegation in every subagent prompt.** General-purpose agents will recursively spawn more agents and return "running in the background" without doing the work — a runaway loop. Put a blunt header: *"Do ALL the work YOURSELF. FORBIDDEN to call the Agent/Task tool, delegate, or use run_in_background. Do not end until the build passes."*
- **The host process has been restarting mid-build.** Instruct agents to **save files early + commit checkpoints often** (only saved files survive a restart). Verify builds yourself after each agent.

## 6. Quick win that can land independently / early
**ALT-244 — CRM Edit-User sales-role bug** (`new-code/web/src/components/admin/UsersTab.tsx`): the **Edit** modal only shows SALES_HEAD/SALES_PERSON if the user already holds them (`webRoles` filters `is_web`). Fix: make those two **always selectable** in Edit (so Amplior ADMIN can grant a sales role to an existing user). Isolated, no portal dependency. **Coordinate with the CRM session** before editing UsersTab (we both touch the admin area).

## 7. File-ownership / collision map (so we don't clobber each other)
- **Portal agent owns:** the new portal app dir (you choose, e.g. `new-code/portal/`), `new-code/migration/apply-portal-*.cjs`, `new-code/notify-service/email-templates.js` (brand parameterization, ALT-232), and `UsersTab.tsx` (ALT-244, coordinate).
- **CRM session owns:** `new-code/web/src/**` CRM pages/features (collaborators, safe-view, notifications, import, bulk reassign, read-isolation RLS).
- **Shared/coordinate:** `notify-service` (email seam), `UsersTab.tsx`, and **all RLS apply ordering** (§2).

## 8. Still OPEN — surface to owner, don't guess (PHASE1 §12)
AltLeads portal = full vs lighter sales-only · brand list + domains · dashboard scope per role · invoices visibility · weekly-summary phasing · Phase-1 page trim · OTP vs email-link auth · downline source (`project_user` vs reporting tree) · client-Company-Admin cross-project grant (Phase-1 = Amplior-only). Foundation (column-whitelist + snapshot writer) is LOCKED, so you can start the foundation + sales screens now; flag the rest as you hit them.

## 9. Owner rulings 2026-07-02 (D4 + feedback)
- **D4 RULED:** clients see the FULL meeting lifecycle (incl. cancel/drop/postpone) — but ONLY meeting data: no recordings, no internal fields (agent feedback / approval state stay internal). ADR-29.
- **D2 DECIDED 2026-07-03 (ADR-33):** ONE structured feedback model everywhere; Cancel & Drop MERGED into one "Cancel/drop" outcome (one form, one DB model). Portal feedback form MUST use it. (Was pending-visual:) docs/product/deck-feedback-models.html proposes ONE structured model (feedback_question_master) across CRM + client portal + sales portal, read-only after submit, locked at meeting close. Do NOT build a divergent portal feedback form in the meantime.
