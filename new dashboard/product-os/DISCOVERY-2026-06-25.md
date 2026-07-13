# Discovery synthesis — 2026-06-25 (PM cycle 1)

Output of the `pm-discovery` workflow (researcher + advisor + OS-critique + non-dependent gap audit). Durable so it survives compaction. Drives the redirected build queue.

## Market / real-need verdict — **MIXED (with a clear winner)**
As a *pure CRM* this loses to GoHighLevel/HubSpot/Close (a solved problem). It only justifies itself as a **multi-portal outbound-accountability ecosystem** whose unique, under-served value is the **client-facing lead-quality / ROI feedback loop** — *"what we delivered vs what the client's rep logged after the meeting."* That is the moat and the renewal driver. The existing HubSpot "Amplior gave vs Sales filled" report proves the demand.

**Top recommendations:** (1) Position as outbound-accountability ecosystem, make the feedback/ROI report the hero. (2) Clear the assignment/RLS launch blocker first — nothing else matters until update-path access is correct + bulk logins exist. (3) Ship the client portal with the metrics 2026 buyers demand — meetings **held** (not just booked), show rate, SQL conversion, pipeline value, cost-per-qualified-meeting — fed live from call dispositions. (4) Don't rebuild commodity data/enrichment/deliverability — integrate Apollo + a proven email path; spend build budget on the portal + feedback layer. (5) Validate white-label-to-other-agencies with 1–2 friendly agencies before investing (biggest TAM, longest effort, head-on vs GHL SaaS mode).

**Revenue angles (ranked by leverage/effort):** client portal as retention/upsell wedge (M) · feedback/ROI report as paid add-on (S) · pay-per-held-meeting auto-billing from call data (M) · white-label SaaS for other agencies (L) · Chrome-extension + enrichment data tier (L).

## Advisor reality-check — the brutal truths (acted on)
1. **It's a beautiful read-only viewer on corrupted data with no security.** RLS is OFF, the anon key can read all PII, and the assigned-agent **write path (apply-assignment-rls.cjs) was never applied** — the team can look but can't safely update records (the whole point).
2. **The ownership model is the product's spine and it's snapped** (`created_by` ≠ assignee; statuses drifted; 477 leads null-company). Every dashboard/filter/Mine-view/AI-embedding is computed on this.
3. **The safe no-DB/no-deploy UX lane is avoidance** — activity masquerading as progress on a tool nobody can transact in yet.
4. **Weeks of "NOTHING PUSHED" = inventory, not validated software** — integration risk compounding on clean-main.
5. **Building for a phantom user** — create/merge/grid surfaces contradict the stated outreach-only, update-only model.
6. **The non-technical owner is the single-threaded bottleneck** for every load-bearing decision while the team can only touch cosmetics.

**Business risks:** a leaked anon key exposes every client's contact data (ends trust/contracts); a real user hitting silent save-failures kills internal adoption on first save; UX polish widens the surface to re-validate after the migration.
**User risks:** silent RLS save-failure on first edit = trust lost; dashboards/Mine lie because computed on drifted data; 110/111 can't even log in; cosmetic masking gives false safety.

## Non-dependent work, re-ranked (this is the new build queue)
The advisor's highest-leverage **non-owner, non-DB-prod** items become the queue, in order:
1. **Make the tool honest** — `humanizeWriteError` everywhere; no silent/false success on writes. *(pure FE — BUILD NOW)*
2. **Make gated decisions easy** — a **read-only Data-Health report** in plain numbers (null-company count, status-spelling variants, created_by≠assignee count, dup-emails, unprovisioned logins) so the owner can decide DEC-03/05 in 2 minutes. *(read-only — BUILD NOW)*
3. **Make launch one-button** — build + validate the assignment-RLS write path against **throwaway roles only** (never prod) + a **bulk-login dry-run report** of who can't log in. *(prep only; prod apply stays owner-gated)*
4. **Stop manufacturing corruption** — hide/disable create surfaces that contradict outreach-only (esp. inline company-create writing placeholders into NOT-NULL columns). *(FE/config — BUILD NOW)*
5. Genuine UX correctness — confirm-before-destructive-bulk, loading-before-empty-state, real empty states. *(modest — fold in)*

**Kill / park list (advisor):** more view modes (ALT-339), inline create-company (corruption vector), non-atomic merge-duplicates, HubSpot/Zoho parity backlog, the Meeting-module redesign debate — all parked until the core is launchable.

**Owner-gated (loud in Review Hub, NOT touched by me):** gate/auth-wall the live URL until RLS lands; apply assignment-RLS; FORCE RLS + lock anon grants; status/ownership migrations; deploy cadence for the local pile-up.

## OS-critique result
The critique agent returned junk (empty context → placeholder output; the `args` passthrough was `undefined`). Lesson captured in OPERATING-MODEL §0 (inline context into prompts; eyeball structured results). A real external OS critique is still owed — re-run later with context inlined.
