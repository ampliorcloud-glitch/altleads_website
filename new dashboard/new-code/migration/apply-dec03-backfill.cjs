'use strict';
/**
 * apply-dec03-backfill.cjs — DEC-03 Step 4: Backfill lead_report rows for
 * leads that have no active report row.
 *
 * ============================ DO NOT AUTO-RUN ============================
 * This is a STAGED migration. Launch posture = MANUAL deploys. Run only
 * after throwaway-login RLS validation (Step 5 / ALT-152) confirms the
 * assignment model is correct in production. Do NOT execute during a
 * session; show the owner the dry-run output first.
 * ========================================================================
 *
 * WHAT IT DOES:
 *   For every lead_master row with deleted_date IS NULL that has NO active
 *   (deleted_date IS NULL) lead_report row, inserts one with:
 *     • lead_id      = the lead's lead_id
 *     • user_id      = CAST(lead_master.created_by AS bigint)  ← owner-of-record
 *                      (provenance = creator; same value createLead seeds; see
 *                       DEC-03 and CLAUDE.md §3)
 *     • stage_id     = 1    (initial "Warm" stage — same as createLead in leadsApi.ts)
 *     • report_status= 'Warm'
 *     • created_by   = lead_master.created_by  (provenance, varchar NOT NULL)
 *     • created_date = NOW()
 *   All other columns (updated_by, deleted_by, etc.) are left NULL.
 *
 * IDEMPOTENT:
 *   Leads that already have at least one active report row are skipped.
 *   Re-running is safe; it will insert 0 rows for any already-backfilled lead.
 *
 * SKIPPED LEADS:
 *   Any lead whose created_by is not a valid integer (free-text legacy name)
 *   gets user_id = 0 (the safest fallback; still satisfies the NOT NULL
 *   constraint). A warning is printed for each such row.
 *
 * USAGE:
 *   node apply-dec03-backfill.cjs          # dry-run (prints the SQL + row count)
 *   node apply-dec03-backfill.cjs --apply  # executes in a transaction
 *
 * ROLLBACK:
 *   The inserted rows all have created_date = NOW() (above the last real row's
 *   created_date) and are distinguishable by having created_by = lead_master.created_by
 *   and report_status = 'Warm'. To roll back:
 *     DELETE FROM lead_report WHERE report_status = 'Warm'
 *       AND created_date >= '<timestamp-before-apply>';
 *   Or identify by report_id range printed in the apply output.
 */

require('dotenv').config();
const { Pool } = require('pg');

const DRY_RUN = !process.argv.includes('--apply');

// Identify leads that need a backfill row.
const FIND_SQL = `
  SELECT
    lm.lead_id,
    lm.created_by,
    -- Cast created_by to bigint for user_id. Falls back to 0 for non-numeric.
    CASE
      WHEN lm.created_by ~ '^[0-9]+$' THEN lm.created_by::bigint
      ELSE 0
    END AS owner_user_id,
    lm.created_by ~ '^[0-9]+$' AS is_numeric_owner
  FROM lead_master lm
  WHERE lm.deleted_date IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM lead_report lr
      WHERE lr.lead_id = lm.lead_id
        AND lr.deleted_date IS NULL
    )
  ORDER BY lm.lead_id
`;

// Insert one report row per lead (idempotent via the NOT EXISTS guard above).
// Executed per-row so we can track individual successes and skip anomalies.
const INSERT_SQL = `
  INSERT INTO lead_report (lead_id, user_id, stage_id, report_status, created_by, created_date)
  SELECT
    $1::bigint,   -- lead_id
    $2::bigint,   -- user_id (from created_by; 0 for non-numeric legacy rows)
    1,            -- stage_id = 1 ("Warm" — same initial stage as createLead in leadsApi.ts)
    'Warm',       -- report_status
    $3,           -- created_by (varchar, original provenance string)
    NOW()         -- created_date
  WHERE NOT EXISTS (
    SELECT 1 FROM lead_report
    WHERE lead_id = $1::bigint AND deleted_date IS NULL
  )
`;

(async () => {
  const pg = new Pool({ connectionString: process.env.PG_CONNECTION_STRING });
  const client = await pg.connect();

  try {
    // 1. Find leads that need backfilling.
    const { rows: targets } = await client.query(FIND_SQL);
    console.log(`\n=== DEC-03 backfill: ${DRY_RUN ? 'DRY RUN' : 'APPLY'} ===`);
    console.log(`Leads needing a lead_report row: ${targets.length}`);
    if (targets.length === 0) {
      console.log('Nothing to do — every active lead already has a report row.');
      return;
    }

    // Warn about non-numeric created_by values.
    const nonNumeric = targets.filter((r) => !r.is_numeric_owner);
    if (nonNumeric.length > 0) {
      console.warn(
        `\n⚠  ${nonNumeric.length} lead(s) have non-numeric created_by (legacy free-text name).` +
        ' Their report rows will be inserted with user_id = 0.'
      );
      nonNumeric.forEach((r) =>
        console.warn(`   lead_id=${r.lead_id}  created_by="${r.created_by}"`)
      );
    }

    console.log('\nLeads to backfill:');
    targets.forEach((r) =>
      console.log(`  lead_id=${r.lead_id}  created_by="${r.created_by}"  user_id=${r.owner_user_id}`)
    );

    if (DRY_RUN) {
      console.log('\nDRY RUN — no changes written. Re-run with --apply to execute.');
      return;
    }

    // 2. Apply in a single transaction — all or nothing.
    await client.query('BEGIN');
    let inserted = 0;
    let skipped = 0;
    for (const row of targets) {
      const res = await client.query(INSERT_SQL, [row.lead_id, row.owner_user_id, row.created_by]);
      if (res.rowCount > 0) {
        inserted += 1;
      } else {
        skipped += 1;
        console.log(`  SKIPPED lead_id=${row.lead_id} — report row appeared concurrently (idempotent).`);
      }
    }
    await client.query('COMMIT');
    console.log(`\nDEC-03 backfill COMMITTED: ${inserted} rows inserted, ${skipped} skipped (already had a row).`);

    // 3. Verify: confirm no leads remain without a report row.
    const { rows: remaining } = await client.query(`
      SELECT COUNT(*) AS still_missing
      FROM lead_master lm
      WHERE lm.deleted_date IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM lead_report lr
          WHERE lr.lead_id = lm.lead_id AND lr.deleted_date IS NULL
        )
    `);
    console.log(`Remaining leads without report row (should be 0): ${remaining[0].still_missing}`);

  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* ignore rollback failure */ }
    console.error('OPERATION FAILED, rolled back:', e.message);
    client.release();
    await pg.end();
    process.exit(1);
  }

  client.release();
  await pg.end();
})().catch((e) => { console.error('ERR:', e.message); process.exit(1); });
