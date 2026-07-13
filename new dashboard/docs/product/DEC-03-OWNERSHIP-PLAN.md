# DEC-03 — Lead Ownership Model: implementation plan (2026-06-28)

**Decision (Ankit, locked):** owner-of-record = the **assignee** `lead_report.user_id`. At CREATE it defaults to the **creator**. It changes ONLY when a TL/Admin reassigns. `created_by` = immutable provenance. This is the **#1 launch blocker**.

## Key finding (why it's a migration, not a one-line patch)
A code audit found the current state is inconsistent (census bug O1):
- `createLead` (LeadFormPage path) creates **only a `lead_master` row — NO `lead_report` row**. So form-created leads have **no assignee** under the new model.
- The app currently resolves a lead's owner from **`created_by`** in places (list/detail), and the **Edit-Lead form's Agent dropdown reassigns by rewriting `created_by`** (`leadsApi.updateLead`).
- Meanwhile the dedicated **ReassignModal** (`assignment.ts reassignLead`) writes **`lead_report.user_id`** — the column the bulk-migrated data actually uses.
- The only place that seeds a `lead_report.user_id` at creation today is `wishlist.convertWishlistToLead` (`user_id = agentId ?? actor`).
→ Two competing owner columns + a create path that seeds neither = the bug. A partial patch (e.g. just stopping the `created_by` rewrite) would REGRESS edit-form reassign and leave the read path inconsistent. Must be done as one coherent expand-contract change.

## Coherent build steps (expand-contract; ship behind a flag, validate RLS on a throwaway login)
1. ✅ **Seed assignee on create** — `createLead` inserts a `lead_report` row with `user_id = creator` (+ the row's other required cols — mirror `convertWishlistToLead`'s insert shape). Form-created leads now have an assignee. *(Done: leadsApi.ts, step 1 commit.)*
2. ✅ **Single owner resolution** — `realLeads.ts` already had both `agent` (created_by provenance) and `salesperson` (lead_report.user_id). Fixed: for leads with no active report row (legacy leads not yet backfilled), `salesperson` now falls back to the `created_by`-resolved name so the column never renders blank before the backfill runs. The fallback is a display-only bridge; `agent` remains the immutable provenance label. *(Files: `new-code/web/src/data/realLeads.ts`)*
3. ✅ **Edit-Lead form: immutable `created_by`** — `updateLead` in `leadsApi.ts` no longer writes `created_by` at all (removed the `if (form.agent_id != null) { payload.created_by = ... }` block). The agent notification fire-and-forget was also removed (it was attached to the rewrite). In `LeadFormPage.tsx`, the "Agent (Owner)" dropdown is disabled (read-only) in edit mode with a note directing users to the "Change salesperson" button on the Lead Detail page. The ReassignModal (`assignment.ts reassignLead` → `lead_report.user_id`) is the sole ownership-change path; it is untouched and continues to work. `// TODO(gatekeeper ALT-431): route reassign through ownership.reassign` comment left in `leadsApi.ts` at the payload build site. *(Files: `new-code/web/src/lib/leadsApi.ts`, `new-code/web/src/pages/LeadFormPage.tsx`)*
4. ✅ **Backfill migration (STAGED — NOT executed)** — `new-code/migration/apply-dec03-backfill.cjs`. For every `lead_master` row with no active `lead_report` row, inserts one with: `user_id = CAST(created_by AS bigint)`, `stage_id = 1`, `report_status = 'Warm'`, `created_by = lead_master.created_by`, `created_date = NOW()`. Idempotent (NOT EXISTS guard). Non-numeric `created_by` values get `user_id = 0` with a warning. Dry-run by default (`--apply` to execute). `node -c` verified clean. **Do NOT run without owner sign-off + throwaway-login RLS validation (step 5).** DB discovery: 10 leads had no report row as of 2026-06-28 (out of ~620 active).
5. **RLS (ALT-152)** — agents may UPDATE leads where `assigned_to('lead', id) = current_user_id()` (resolves `lead_report.user_id`). **PENDING: validate on a throwaway non-admin login before prod** (the orchestrator's gate). Migration: `apply-assignment-rls.cjs` (already staged).

## Order / safety
Steps 1–3 are app-code (reviewable, build-gated). Step 4 is a staged migration (not auto-run). Step 5 is the RLS flip — validated on a throwaway login, then applied. No feature flag used: the fallback-to-`created_by` in step 2 keeps the display consistent for legacy leads without a report row until the backfill (step 4) runs. Build: `npm run build` passes clean (2026-06-28, after steps 2/3/4).

## Tickets
ALT-433 (this) · ALT-152 (assignment RLS) · ALT-411 (audit-cols FK) related.
