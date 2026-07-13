# Write-Gateway Enablement Runbook (#5 / ALT-431 + DEC-14 import)

> Engineered 2026-06-29. The trusted server-side write layer is **fully built and mounted**; enabling it is a one-flag config + a validation pass. This doc is the runbook.

## What the gateway is
`POST /api/write` on notify-service (Express). Verifies the caller's Supabase JWT → resolves `profiles` (user_id + role) **server-side** → checks a per-role **allow-list** → performs the write with the **service-role** client. The browser can no longer forge `created_by`/actor. (`new-code/notify-service/src/writeGateway.js`; web wrapper `new-code/web/src/lib/writeGateway.ts`.)

## Current state — VERIFIED
- ✅ **Mounted:** `server.js:1216` `writeGateway.mount(app, getSupabaseAdmin)`.
- ✅ **Env present in prod:** needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — already used by notify-service for user provisioning/tasks/digest, so they exist in prod.
- ✅ **Action coverage complete:** every web `GatewayAction` (lead.reassign, record.markDnc, record.setFeasibility, company/contact/lead.import + .importUndo, lead.export, contact.markDnc, ownership.reassign) has a matching server allow-list entry + handler. No unknown-action 400s when enabled.
- ✅ **Import handlers real:** `company/contact/lead.import` + `.importUndo` execute real upserts via `importEngine.js`.
- 🟡 **Flag OFF:** `VITE_USE_WRITE_GATEWAY` defaults false → today the wrapped actions go direct PostgREST, and **the import wizard is preview-only** (real import requires the gateway).

## What enabling actually changes (contained blast radius)
Only the **wrapped GatewayAction subset** reroutes through `/api/write`; every other write in the app stays direct. The two consumers that matter:
1. **Import (DEC-14)** — becomes a **real write** instead of preview-only. This is the main reason to enable it (it's how we load the real data).
2. **lead.reassign** — routes through the trusted layer (was direct).
(markDnc / feasibility / feedback are HungerBox-flag actions; unaffected until that flag is on.)

## To ENABLE (do on the TEST instance first)
1. Set **`VITE_USE_WRITE_GATEWAY=true`** in the **web build environment** (it's a Vite build-time var, read via `import.meta.env` → must be set at build, then redeploy). Confirm `SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_URL` are set on that instance's notify-service.
2. **Redeploy** the web build with the flag.
3. **Validate** (below). Only after sign-off → set the same flag on prod + redeploy.

> Recommended: enable on **`crm-test.altleads.com`** (Dokploy) first — never flip prod blind. Tokens for Dokploy in `.credentials/`.

## Validation checklist (before prod)
- [ ] **Import end-to-end:** small CSV (company + contact + lead) → wizard preview (dedup QC) → run → rows actually upsert; `importUndo` reverses the batch.
- [ ] **Role enforcement:** as ADMIN → `lead.reassign` succeeds; as AGENT → `lead.reassign` returns **403** (not in allow-list). Proves JWT-derived role gating.
- [ ] **Actor integrity:** confirm written `created_by`/actor = the JWT user, not a client-supplied value (try sending a forged actor in the payload → ignored).
- [ ] **No regressions:** non-gateway writes (normal edits) still work unchanged with the flag on.
- [ ] **503 path:** if service-role env missing, gateway returns a clean 503 (not a silent failure).

## What I need from the owner (the only manual bit)
Setting `VITE_USE_WRITE_GATEWAY=true` is a **deploy/config action** (build-time env). Either:
- **(a)** Owner sets it in the test instance's build env + redeploys, **or**
- **(b)** Owner authorizes me to set it via the Dokploy API on `crm-test` (token in `.credentials/`).
Then I run the validation checklist and report; on sign-off we flip prod.

## Import → assignment (ALT-499, added 2026-07-02)
Leads import now creates the **lead_report row** (the per-project state that makes a lead visible/assignable — report_id has a DB default, stage seeded 1/Warm like wishlist conversion) with user_id resolved from a new **assigned_to** mapped column. Resolution order (bulk per chunk, 2 queries max): numeric → user_id · email → profiles.email · name → user_master.full_name (case-insensitive). Unresolvable/absent → lead imports **UNASSIGNED with a row-level warning** (stored in import_row.error_msg). Undo also soft-deletes the seeded report (undo_payload.report_id). **Prereq: apply-comms-capture.cjs must be applied first** — it creates import_batch/import_row (verified missing in prod 2026-07-02; without them imports are not undoable/audited). Validate on crm-test at gateway-enable time.

## Relationship to launch
Enabling the gateway is effectively **"turn on real imports"** + harden reassign. It's independent of the RLS read-isolation work (different mechanism). Sequence: validate gateway on test → flip prod → bulk-import the real data → (separately) sequence + validate the RLS isolation with the portal team.
