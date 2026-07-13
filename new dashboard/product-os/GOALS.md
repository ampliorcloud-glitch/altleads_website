# Goals — Amplior CRM (the single definition we steer by)

> Why this file: the goal was scattered across VISION/INTERNAL-LAUNCH-PLAN. This makes it explicit and measurable so every cycle can be judged "does it move a goal?". Owner of direction: **Ankit (PM)**; business owner: **Mohit (CEO)**.

## North-star (why we exist)
Be the **outbound-accountability ecosystem** for Amplior: capture every outreach touch, make the 100+ calling team fast and accountable, and **prove lead quality to clients** through a ROI/feedback portal. The portal is the moat and the revenue lever (research-confirmed: as a *pure* CRM we lose to HubSpot/GoHighLevel; the client ROI/feedback loop is the under-served thing only we can own). Later: productize for other agencies + an AI superpower over everything captured.

**How we judge any feature:** does it *win a meeting, retain a client, or save an operator real time*? If not, it waits.

## 🎯 Current milestone — the ONLY thing that matters now: **Internal Launch Readiness**
Get the ~111-person team safely onto the CRM doing their real job — **updating their assigned records** — without losing trust on the first save.

**Exit criteria (measurable — all must be true):**
1. **Assigned-edit works** — an agent can edit ONLY their assigned records; validated on throwaway logins, no silent denials. → DEC-03, `LAUNCH-BLOCKER-RLS-PLAN.md`
2. **Security locked** — FORCE RLS + anon grants closed; the live URL is gated until then. → DEC-04, DEC-09
3. **Everyone can get in, correctly** — all ~111 users provisioned with a login **and** a `profiles` row (so RLS resolves them); coverage asserted before the RLS swap. → ALT-371
4. **Writes are honest** — no silent/false-success saves. → ✅ ALT-370 (done)
5. **Statuses trustworthy enough** that dashboards/funnel don't lie. → DEC-05
6. **Shipped + signed off** — deployed in an agreed window. → DEC-08

**Definition of "launched":** the team uses `crm.altleads.com` for real daily updates and trusts it.

## Next milestones (after launch, in order)
1. **Client/Sales portal — the ROI/feedback moat** (revenue + retention). *(feedback model = DEC-01)*
2. Chrome extension (LinkedIn capture). 3. Market-mapping. 4. AI (semantic search / similar-accounts / who-to-target) — on the clean `interaction` log.

## Standing goal for the PM engine (Claude)
Keep shipping **safe, non-dependent foundation-readiness** work; keep the trackers + Review Hub current so the owner's gated calls stay **2-minute decisions**; never push/apply-to-prod without explicit go.

## The non-dependent backlog (what moves goals WITHOUT owner approval)
Lives in the backlog tracker; the live "I can do this now" view:
- **ALT-371 G-C** — bulk-provision flow + read-only login-coverage dry-run *(milestone exit #3)*
- **FE security/risk hardening** — fix FE-fixable PII/guard/fake-masking issues; flag DB ones *(milestone #2 support)*
- **Refine the RLS plan** to close the 7 security-QC gaps *(milestone #1 prep)*
- **Route code-splitting** (RSK-06) — load speed for 111 users
- **UX correctness** — search empty-states, confirm-before-destructive-bulk, loading-before-empty guards, a11y focus ring
- **Finish honest-writes loose ends**

Gated (NOT here — need Ankit): the 9 Decisions, any prod DB/RLS apply, deploy/push, the client portal (DEC-01 + active workstream), Save View (DEC-07), masking (DEC-06).
