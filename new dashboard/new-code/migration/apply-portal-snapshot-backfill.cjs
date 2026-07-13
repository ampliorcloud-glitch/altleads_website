'use strict';
/**
 * ALT-225 — One-time SNAPSHOT BACKFILL (seeds the portal so day-one is not empty).
 *
 * Why: ~111 users and their meetings were already bulk-migrated. The live trigger writer
 * (apply-portal-snapshot-writer.cjs) only fires on NEW meeting create/edit, so without a
 * backfill the portal would be empty for every pre-existing meeting.
 *
 * What: for EVERY existing meeting_master.meeting_id, call
 *   portal.write_meeting_snapshot(meeting_id, 'backfill')
 * which upserts (ON CONFLICT update) one snapshot row stamped snapshot_source='backfill'.
 *
 * Properties:
 *   - Idempotent  — upsert keyed on meeting_id; safe to re-run; never double-inserts.
 *   - Sequenced   — run AFTER foundation + RLS + writer exist AND after throwaway-login
 *                   validation; re-validate isolation on real backfilled volume afterwards.
 *   - Batched     — processes in chunks so a large meeting set does not run one giant statement.
 *   - GATED       — the isolation-completeness check runs INSIDE the transaction BEFORE
 *                   COMMIT (reviewer MUST-FIX). If ANY snapshot row has a NULL client_assoc_id
 *                   (a row that is silently NON-isolated), the whole backfill ROLLS BACK and
 *                   exits non-zero. client_assoc_id is NOT NULL on the table, so such a row
 *                   should be impossible — the check is a belt-and-braces abort, not a print.
 *                   (missing_assigned / missing_project are reported as warnings only: an
 *                   assigned_user_id NULL hides a row from SALES_PERSON and project_id NULL
 *                   hides it from SALES_HEAD project-scope — acceptable, not an isolation leak.)
 *
 * The whole backfill runs inside ONE transaction (BEGIN/COMMIT, ROLLBACK on error or on a
 * failed gate) so a mid-run failure leaves no partial seed. RUN ONLY via
 * `node apply-portal-snapshot-backfill.cjs`.
 */
require('dotenv').config();
const { Pool } = require('pg');

const BATCH = 500;

(async () => {
  const pg = new Pool({ connectionString: process.env.PG_CONNECTION_STRING });
  const client = await pg.connect();

  // BEFORE count
  let before = 0;
  try {
    const r = await client.query('SELECT count(*)::int AS n FROM portal.meeting_snapshot');
    before = r.rows[0].n;
  } catch (e) {
    console.error('Could not read portal.meeting_snapshot — run apply-portal-foundation.cjs first:', e.message);
    client.release();
    await pg.end();
    process.exit(1);
  }

  let processed = 0;
  let gateRows = null;     // isolation-completeness counts, captured inside the txn
  try {
    await client.query('BEGIN');

    // All non-deleted meeting ids, oldest first.
    const ids = await client.query(
      `SELECT meeting_id
       FROM public.meeting_master
       WHERE deleted_date IS NULL
       ORDER BY meeting_id`);
    const allIds = ids.rows.map(r => r.meeting_id);
    console.log(`Backfilling ${allIds.length} meetings (snapshot_source='backfill') ...`);

    for (let i = 0; i < allIds.length; i += BATCH) {
      const chunk = allIds.slice(i, i + BATCH);
      // Call the SECURITY DEFINER writer once per meeting id, source='backfill'.
      await client.query(
        `SELECT portal.write_meeting_snapshot(m, 'backfill')
         FROM unnest($1::bigint[]) AS m`,
        [chunk]);
      processed += chunk.length;
      console.log(`  ... ${processed}/${allIds.length}`);
    }

    // ---- ISOLATION-COMPLETENESS GATE (runs BEFORE COMMIT) ----
    // missing_client > 0 => a non-isolated row slipped in => ABORT (roll back the whole seed).
    const gate = await client.query(
      `SELECT
          count(*) FILTER (WHERE client_assoc_id IS NULL)::int  AS missing_client,
          count(*) FILTER (WHERE assigned_user_id IS NULL)::int AS missing_assigned,
          count(*) FILTER (WHERE project_id IS NULL)::int       AS missing_project,
          count(*)::int                                         AS total_rows
       FROM portal.meeting_snapshot`);
    gateRows = gate.rows[0];

    if (gateRows.missing_client > 0) {
      throw new Error(
        `ISOLATION GATE FAILED: ${gateRows.missing_client} snapshot row(s) have NULL client_assoc_id ` +
        `(non-isolated). Rolling back the entire backfill — fix the writer/source data before re-running.`);
    }

    await client.query('COMMIT');
    console.log(`APPLIED apply-portal-snapshot-backfill OK (committed). Processed ${processed} meetings.`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('BACKFILL FAILED, rolled back:', e.message);
    client.release();
    await pg.end();
    process.exit(1);
  }

  // VERIFY: counts by source (post-commit, informational)
  const after = await client.query(
    `SELECT snapshot_source, count(*)::int AS n
     FROM portal.meeting_snapshot
     GROUP BY snapshot_source
     ORDER BY snapshot_source`);
  console.log('\n=== meeting_snapshot ROWS by source (AFTER) ===');
  console.log(`(before total = ${before})`);
  console.log(JSON.stringify(after.rows, null, 2));

  // Report the gate counts that were checked INSIDE the transaction.
  console.log('\n=== ISOLATION-COLUMN COMPLETENESS (checked pre-commit; missing_client gated to 0) ===');
  console.log(JSON.stringify(gateRows, null, 2));
  if (gateRows.missing_assigned > 0 || gateRows.missing_project > 0) {
    console.log(
      `WARNING: ${gateRows.missing_assigned} row(s) have NULL assigned_user_id (invisible to SALES_PERSON) and ` +
      `${gateRows.missing_project} row(s) have NULL project_id (invisible to SALES_HEAD project-scope). ` +
      `Not an isolation leak, but those meetings will not surface for the affected roles until backfilled with values.`);
  }

  client.release();
  await pg.end();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
