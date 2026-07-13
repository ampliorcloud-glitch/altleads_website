/**
 * gen-review-tracker.cjs
 * ======================
 * Generates docs/Amplior-Review-Hub.xlsx — the ONE place for everything that
 * needs the owner: decisions to make, built work to review, and risks to know.
 *
 * Why a tracker (not an MD file): the owner asked for review items in a single
 * filterable place he can scan and act on, that Claude can also keep updating.
 * The .xlsx is gitignored (like the backlog) and regenerated from this tracked
 * script — so THIS file is the durable source of truth.
 *
 * Usage:  cd new-code/web && node scripts/gen-review-tracker.cjs
 *
 * To update: edit the DECISIONS / REVIEW / RISKS arrays below and re-run.
 */

'use strict';

const XLSX = require('xlsx');
const path = require('path');

const OUT_PATH = path.resolve(__dirname, '../../../docs/Amplior-Review-Hub.xlsx');
const UPDATED = '2026-06-25';

/* ─── 1. DECISIONS NEEDED (waiting on Ankit, the PM; business-level escalates to Mohit, CEO) ─
   [id, item, plainQuestion, options, whyItMatters, status, priority]          */
const DECISIONS = [
  ['DEC-09', 'Gate the LIVE site until security lands — URGENT',
    'crm.altleads.com is publicly reachable while the database security (RLS) is OFF and the anonymous key can read personal data. The advisor flags this as an active exposure right now. I cannot change the live deployment without your go.',
    'A) Put the live site behind a hard login wall / take it offline until RLS lands (I prepare it, you approve the push) · B) Accept the risk and leave it open',
    'A leaked/inspected key could expose every client\'s contact data (incl. HungerBox). For an outreach vendor whose product IS client data, one incident ends trust. Highest-urgency item on this list.',
    'Awaiting you', 'P0'],
  ['DEC-10', 'Turn on AI assist features? (needs a key + a small cost OK)',
    'Research says the genuinely useful AI features for your team are: summarize a lead\'s history into a 3-line brief, draft a follow-up email/WhatsApp from the record (rep edits, never auto-sends), and a "suggest next action" chip. These need an LLM API key + a modest per-use cost, and work best once the clean activity log/embeddings land.',
    'A) Yes — I wire a Claude API key (you provide/approve) + build summarize/draft/next-action behind a flag · B) Wait until after launch + the embeddings work · C) Not now',
    'These are the "wow"/convenience features that make the tool feel modern — but unlike the rest of the UX backlog they cost money per use, so they need your go.',
    'Awaiting you', 'P2'],
  ['DEC-11', 'Adopt a Deals / Pipeline object? (anchors the Sales Portal) — ALT-386',
    'HubSpot/Zoho model the sales process as a "Deal" that moves through pipeline stages and carries a money value + close date + forecast. We only have leads-with-a-status — no value, no pipeline board, no forecast. I verified this live against your own HubSpot (deal "Alembic Pharmaceuticals", pipeline + amount + close date). This is the single biggest thing standing between us and a real Sales Portal (priority #2), and it does NOT depend on the launch blocker.',
    'A) Yes — I design the Deals/Pipeline schema + a pipeline board (you review the design first) · B) After internal launch · C) Not now',
    'It is the foundation every sales feature needs (forecast, quota, win/loss, ₹-in-stage). Building the Sales Portal without it means rework later.',
    'Awaiting you', 'P1'],
  ['DEC-12', 'No-code custom fields? (let admins add fields without code) — ALT-387',
    'In HubSpot/Zoho an admin adds any field (dropdown/date/number) to any record type without an engineer. For us, every new field is a code change + DB migration. We could build a custom-field model so the business adds fields itself.',
    'A) Yes — invest in a custom-field model + admin UI · B) Keep fixed columns through launch, revisit later',
    'Flexibility vs. simplicity. Big convenience long-term, but real build cost; not a launch blocker, so it can wait if you prefer to stay lean.',
    'Awaiting you', 'P2'],
  ['DEC-13', 'Gate PII (email/mobile) on export? — ALT-383',
    'Exports currently include email/mobile in clear, so anyone who can see a list can download personal data. But exporting contact details IS your team\'s calling workflow, so I will NOT change it unilaterally.',
    'A) Gate full email/mobile export behind admin / reveal-permission (+ log it) · B) Leave open for outreach roles (it is the calling workflow)',
    'Balances PII safety against the team\'s real need to export numbers to call. Small build either way; just needs your call on the posture.',
    'Awaiting you', 'P2'],
  ['DEC-14', 'Build the import + undo/redo engine NOW as an admin-only tool? — ALT-396/397',
    'The 43-agent data-ops audit found a key unlock: because every bulk write can go through ONE service-role endpoint (which ignores RLS), the import engine + one-button undo/redo + recycle bin can be built NOW as an ADMIN tool — WITHOUT waiting for the ownership/RLS fix (DEC-03). The blocker only gates whether non-admin AGENTS can run these on records they do not own. So we can give you bulk import, import-rollback and reversible edits as an admin capability immediately.',
    'A) Yes — build the admin-only service-role engine now (import + undo/redo + recycle bin), agent-facing version waits on DEC-03 · B) Wait and do it all together after DEC-03',
    'This is the single biggest data-admin capability and the user-flagged reversible import/export. Decoupling the admin path means months of value lands before the ownership fix, with no blocker exposure.',
    'Awaiting you', 'P1'],
  ['DEC-01', 'ONE feedback model (D2)',
    'We have feedback in a few places. Do you want ONE unified way clients + sales give/See feedback? I owe you a plain-language explainer first.',
    'A) I write the 6th-grade explainer + recover your earlier client-portal feedback tweaks, then you decide · B) Keep as-is for now',
    'Feedback is how clients judge lead quality and how you prove ROI for retainers. Fragmented = confusing + weak proof.',
    'Awaiting you', 'P1'],
  ['DEC-02', 'Remove the Meeting module? (D1/E2)',
    'You floated folding "Meetings" into Leads + a linked task + one "due today" queue, instead of a separate module.',
    'A) Fold into Leads (simpler, one place) · B) Keep Meetings separate · C) I spec both side-by-side first',
    'Changes core navigation + every meeting flow. Cheaper to decide before more is built on the current shape.',
    'Awaiting you', 'P1'],
  ['DEC-03', 'Ownership / assignee schema fix (ALT-349) — LAUNCH BLOCKER',
    'Records were bulk-imported, so the "owner" column points at the importer, not the real assignee. Agents can edit the wrong rows / not their own. Needs a DB fix + a safe test on throwaway logins before prod.',
    'A) Give the go — I prepare the migration + validate on test logins + show you before applying · B) Hold',
    'This is THE thing blocking a trustworthy internal launch. Until fixed, who-can-edit-what is wrong.',
    'Awaiting you', 'P0'],
  ['DEC-04', 'Lock security before AI (ALT-353)',
    'Some tables are not fully locked down (no FORCE RLS; broad anonymous access on data with personal info).',
    'A) Approve the lockdown migration (validated on test logins first) · B) Hold',
    'PII exposure risk + it gates the embeddings/AI work. Should be done before any AI capture.',
    'Awaiting you', 'P0'],
  ['DEC-05', 'Status cleanup (ALT-350/351)',
    'Status fields are free text and already messy (one field has 24+ spellings of ~4 things). Fix = controlled dropdowns + cleanup.',
    'A) Approve the cleanup + dropdown enforcement · B) Hold',
    'Messy statuses break every report, filter, and the dashboard funnel. Compounds daily.',
    'Awaiting you', 'P1'],
  ['DEC-06', 'Masking of email/phone (ALT-345)',
    'Sensitive contact details should be masked + revealed per permission, enforced at the database (your Q4 ruling). Not built yet — and it must be DB-enforced, not faked in the screen.',
    'A) Approve the DB-enforced masking design + who-can-reveal rules · B) Hold',
    'Client/PII trust + your explicit ruling. A screen-only mask is not real protection.',
    'Awaiting you', 'P1'],
  ['DEC-07', 'Save View — local now or wait for the full access model?',
    'Saved filter "views" — you bundled this with the per-project access modes (A4). I can ship a quick personal version now, but it will likely need to become shareable/server-backed later.',
    'A) Ship the quick personal (local) version now · B) Wait and build it once, server-backed, with the access model',
    'Nice productivity win; small rework risk if built twice.',
    'Awaiting you', 'P2'],
  ['DEC-08', 'When do we push the built-but-unpushed work?',
    'Several finished, build-green commits are sitting locally (not deployed): the QC fix batch + the ALT-361..364 + ALT-368/369 UX work.',
    'A) Pick an evening/weekend to push (your Q6 posture) · B) Keep holding',
    'The longer good work sits unpushed, the bigger the eventual deploy + merge risk.',
    'Awaiting you', 'P1'],
];

/* ─── 2. AWAITING REVIEW (built + green, NOT pushed — needs your eyes) ───────
   [id, whatWasBuilt, whereCommitFiles, whatToCheck, pushed, notes]            */
const REVIEW = [
  ['ALT-368', '"Select all N matching" on every list', 'commit eea34d5',
    'Tick a whole page → blue bar offers selecting all filtered rows for bulk reassign/status/export.', 'No', 'Safe, no DB.'],
  ['ALT-369', 'Filters + search survive a refresh', 'commit eea34d5',
    'Filter a list, refresh — your filters come back. "Clear filters" still resets.', 'No', 'Per-browser, no DB.'],
  ['ALT-361', 'Inline status: no more "select a project first"', 'commit e4e4a67',
    'Editing a company/contact status uses the chosen project / auto-resolves single-project records.', 'No', ''],
  ['ALT-362', 'QC can approve + must give a reject reason', 'commit e4e4a67',
    'QC role reaches the Approvals queue; rejecting a report requires a comment.', 'No', ''],
  ['ALT-363', 'Reassign reason + "Assign to me"', 'commit e4e4a67',
    'Optional reason when a lead is reassigned; new records default to you as owner.', 'No', ''],
  ['ALT-364', 'UX polish batch', 'commit e4e4a67',
    'Grid tooltips + frozen name column; tap-to-call/email + copy in previews; search clear-×; password show/hide; contrast.', 'No', ''],
  ['QC-FIX', 'Autonomous QC fix pass', 'commit 23509a3',
    'Safe fixes across grid/data/pages/dashboard from the harsh-QC review.', 'No', 'Detail in REBUILD_LOG.'],
  ['DOC-1', 'SCHEMA-AUDIT.md', 'docs/SCHEMA-AUDIT.md',
    'Read the headline: ownership split = launch blocker; statuses corrupted; no FORCE RLS.', 'n/a', 'Drives DEC-03..06.'],
  ['DOC-2', 'EMBEDDING-PLAN.md', 'docs/product/EMBEDDING-PLAN.md',
    'The why/what/how/when of AI embeddings — capture from now (cheap) vs backfill (lossy).', 'n/a', ''],
  ['OS-1', 'product-os/ operating system', 'product-os/',
    'The new "start here" + how Claude works as PM. Tell me if the way-of-working matches what you want.', 'n/a', 'You asked for this.'],
  ['DISC-1', 'Discovery synthesis (market + advisor reality-check)', 'product-os/DISCOVERY-2026-06-25.md',
    'The honest outside view: as a pure CRM we lose; the moat is the client ROI/feedback portal. Plus the advisor\'s brutal truths that redirected the build queue to foundation-readiness.', 'n/a', 'Read the "brutal truths" + "real-need verdict".'],
  ['RLS-1', 'Launch-blocker fix — drafted + security-QC reviewed (DEC-03)', 'docs/LAUNCH-BLOCKER-RLS-PLAN.md',
    'The canonical-assignee + RLS fix, DRAFTED (not applied) and adversarially reviewed (verdict: SOUND, would fix the blocker). Read the "Security-QC" section — 6 owner questions, esp. #1: do ALL provisioned logins have a profiles row? If not, the model silently denies them everything.', 'n/a', 'Ready for your review; apply ONLY after you answer + throwaway-login validation.'],
  ['ONRAMP-1', 'Bulk-login on-ramp + RSK-10 fix (ALT-371)', 'docs/BULK-LOGIN-ONRAMP-PLAN.md + notify-service/server.js',
    'How logins get provisioned, a read-only coverage dry-run, and the one-button bulk flow. Already fixed (deploy-gated): provisioning now writes user_id strictly + reports profile-link coverage instead of a false 200. Remaining: the bulk endpoint + a coverage assertion before the RLS swap.', 'No', 'Review the plan; the strict-link server fix is ready, not pushed.'],
];

/* ─── 3. RISKS (advisor / security flags to keep visible) ───────────────────
   [id, risk, severity, area, ownerGated, nextStep]                            */
const RISKS = [
  ['RSK-01', 'Ownership split (created_by ≠ real assignee) — edit permissions are wrong', 'Critical', 'Data / Security', 'Yes', 'DEC-03 / ALT-349'],
  ['RSK-02', 'No FORCE RLS + broad anonymous grants on tables with personal info', 'Critical', 'Security', 'Yes', 'DEC-04 / ALT-353'],
  ['RSK-03', 'Statuses are free text and already corrupted — breaks reports + funnel', 'High', 'Data', 'Yes', 'DEC-05 / ALT-350/351'],
  ['RSK-04', 'No real masking of email/phone yet (must be DB-enforced)', 'High', 'Security / Privacy', 'Yes', 'DEC-06 / ALT-345'],
  ['RSK-05', 'Finished work sitting unpushed — deploy/merge risk grows over time', 'Medium', 'Delivery', 'No', 'DEC-08 (pick a push window)'],
  ['RSK-07', 'LIVE site reachable while RLS is off — active PII exposure right now', 'Critical', 'Security', 'Yes', 'DEC-09 (gate the live URL)'],
  ['RSK-08', 'CHECKED — advisor\'s "inline create writes placeholders" claim did NOT hold: createCompany writes nulls (not placeholders), validates the required name, and is the only company-insert path (admin-gated full form, no inline quick-create). No corruption vector here.', 'Info', 'Data', 'No', 'Closed — verified clean 2026-06-25'],
  ['RSK-09', 'Assignment write-path (apply-assignment-rls.cjs) never applied — agents cannot safely edit their own records', 'Critical', 'Data / Product', 'Yes', 'Plan drafted (LAUNCH-BLOCKER-RLS-PLAN.md); apply on owner go after throwaway-login validation'],
  ['RSK-10', 'Bulk-provisioned logins with NO profiles row would be SILENTLY denied ALL edits once assignee-RLS lands (current_user_id() resolves via the sparse profiles table -> NULL -> every write predicate false)', 'High', 'Security / Launch', 'Partly', 'PARTLY CLOSED (ALT-371): provisioning now writes user_id strictly + reports coverage instead of a false 200, so failures are no longer SILENT. Still need: bulk-provision flow + assert full coverage BEFORE the RLS swap.'],
  ['RSK-11', 'Staged apply-assignment-rls.cjs, if run as-is, OVER-GRANTS edit rights to the bulk-import actors (keeps the created_by term) — do not run it; use the canonical-assignee plan instead', 'High', 'Security', 'Yes', 'LAUNCH-BLOCKER-RLS-PLAN.md §2 (canonical assignee_user_id)'],
  ['RSK-06', 'Single 1.6MB JS bundle — slow first load', 'Low', 'Performance', 'No', 'CLOSED (ALT-372): code-split, main bundle 1672->282KB'],
  ['RSK-12', 'Admin + Approvals write endpoints rely on a CLIENT-side role check; without server-side RLS a crafted request could call them directly', 'High', 'Security', 'Yes', 'Same class as RSK-02 (FORCE RLS); covered by the RLS plan / DEC-04'],
];

/* ─── 4. DATA HEALTH (plain-number scorecard for the owner; source: docs/SCHEMA-AUDIT.md live introspection) ─
   [area, liveNumber, plainMeaning, severity, unblocks]                        */
const DATA_HEALTH = [
  ['Who owns a lead', '600+ migrated leads', 'The "owner" field points at whoever IMPORTED the data ("7"×130, "60"×99, "59"×86…), not the assigned caller — so an agent is blocked from editing their own leads. 597 of 598 leads have exactly one report, so the fix is a near 1-to-1 backfill (low risk).', 'Critical', 'DEC-03 (launch blocker)'],
  ['Database security', '11 hot tables, RLS not forced', 'The DB lets the table-owner and broad anonymous access bypass row security — on data holding phone numbers + emails for 111 users and 600+ leads.', 'Critical', 'DEC-04 + DEC-09'],
  ['"Area of interest" tidiness', '24+ spellings of ~4 things', '"Security ", "Security", "security", "Security services"… + 34 rows that are just a blank space. Segmentation and the HungerBox fit-scoring can\'t trust this column.', 'High', 'DEC-05'],
  ['Meeting status gaps', '10 blank + 8 empty', 'Some meetings carry no status at all, split between "NULL" and "" — so the funnel under-counts. (Live: Missed 331, Completed 204, Scheduled 39, Confirmed 22.)', 'High', 'DEC-05'],
  ['Yes/No stored as text', '"0" on 128 rows', 'active_status is a true/false flag smuggled into a text column as the string "0".', 'Medium', 'DEC-05'],
  ['One timeline per lead', 'clean table has 18 rows', '"What happened with this lead" is scattered across 4 different tables; the clean one (interaction) is nearly empty. No single history — blocks clean reporting AND the AI plan.', 'High', 'ALT-352 (AI prereq)'],
  ['Duplicate contacts', '20 duplicate-email groups', 'The same person exists twice = split call history, double-dialling, and the Chrome extension\'s look-up-by-email/LinkedIn breaks. No unique constraint stops new dupes.', 'High', 'merge + unique index (S3)'],
  ['Lead↔contact link', 'contact_id 0 of 607 filled', 'Leads aren\'t linked to their contact record even though the data exists — joins silently fail. A backfill fixes it.', 'Medium', 'backfill (F4)'],
  ['Audit-table growth', '~85k rows vs 610 live', 'Shadow audit tables grow unbounded with no retention policy — doubling write cost over time.', 'Low', 'retention (S4)'],
];

/* ─── SHEET BUILDER ─────────────────────────────────────────────────────────*/
function buildSheet(headers, widths, rows) {
  const ws = {};
  headers.forEach((h, c) => {
    ws[XLSX.utils.encode_cell({ r: 0, c })] = {
      v: h, t: 's',
      s: { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1A7EE8' } } },
    };
  });
  rows.forEach((row, ri) => {
    row.forEach((cell, ci) => {
      ws[XLSX.utils.encode_cell({ r: ri + 1, c: ci })] = { v: cell == null ? '' : String(cell), t: 's' };
    });
  });
  const lastR = rows.length, lastC = headers.length - 1;
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastR, c: lastC } });
  ws['!cols'] = widths.map((w) => ({ wch: w }));
  ws['!sheetViews'] = [{ state: 'frozen', ySplit: 1, xSplit: 0, topLeftCell: 'A2', activeCell: 'A2', sqref: 'A2' }];
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastR, c: lastC } }) };
  return ws;
}

const wb = XLSX.utils.book_new();

XLSX.utils.book_append_sheet(wb, buildSheet(
  ['ID', 'Item', 'Plain-language question', 'Options', 'Why it matters', 'Status', 'Priority'],
  [9, 34, 60, 60, 50, 14, 9], DECISIONS), 'Decisions Needed');

XLSX.utils.book_append_sheet(wb, buildSheet(
  ['ID', 'What was built', 'Where', 'What to check', 'Pushed?', 'Notes'],
  [9, 38, 26, 64, 9, 26], REVIEW), 'Awaiting Review');

XLSX.utils.book_append_sheet(wb, buildSheet(
  ['ID', 'Risk', 'Severity', 'Area', 'Owner-gated?', 'Next step'],
  [9, 64, 11, 20, 13, 26], RISKS), 'Risks');

XLSX.utils.book_append_sheet(wb, buildSheet(
  ['Area', 'Live number', 'What it means (plain words)', 'Severity', 'Unblocks'],
  [22, 22, 78, 11, 22], DATA_HEALTH), 'Data Health');

XLSX.utils.book_append_sheet(wb, buildSheet(
  ['How to use this Review Hub'],
  [100],
  [
    [`Updated ${UPDATED}. Regenerate: cd new-code/web && node scripts/gen-review-tracker.cjs`],
    ['Tabs: (1) Decisions Needed = your calls; (2) Awaiting Review = built + green, not pushed; (3) Risks = what to know; (4) Data Health = the live data problems in plain numbers (source: docs/SCHEMA-AUDIT.md) — these are what DEC-03/04/05 decide.'],
    ['Claude keeps this current and NEVER pushes / never touches the production database without your explicit go-ahead.'],
    ['Backlog of all tickets lives in AltLeads-Backlog-Tracker.xlsx. The way-of-working lives in product-os/.'],
  ]), 'Legend');

XLSX.writeFile(wb, OUT_PATH);
console.log('✓ Wrote ' + OUT_PATH);
console.log(`  Decisions: ${DECISIONS.length} · Awaiting review: ${REVIEW.length} · Risks: ${RISKS.length}`);
