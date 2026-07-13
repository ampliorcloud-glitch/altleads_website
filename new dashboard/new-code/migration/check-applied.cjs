/**
 * check-applied.cjs — READ-ONLY survey of what's applied in the DB.
 * No writes. Lists presence of staged objects so we know what a code push depends on.
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.PG_CONNECTION_STRING });

async function main() {
  const tables = ['call_log', 'task_job_run'];
  const fns = ['find_contact_for_panel', 'find_contact_dup', 'assigned_to'];
  const policies = ['lead_report_update', 'meeting_master_update'];

  for (const t of tables) {
    const r = await pool.query(
      `select 1 from information_schema.tables where table_schema='public' and table_name=$1`,
      [t],
    );
    console.log(`TABLE public.${t}: ${r.rowCount ? 'EXISTS' : 'MISSING'}`);
  }
  for (const f of fns) {
    const r = await pool.query(`select 1 from pg_proc where proname=$1`, [f]);
    console.log(`FUNCTION ${f}: ${r.rowCount ? 'EXISTS' : 'MISSING'}`);
  }
  for (const p of policies) {
    const r = await pool.query(`select 1 from pg_policies where policyname=$1`, [p]);
    console.log(`POLICY ${p}: ${r.rowCount ? 'EXISTS' : 'MISSING'}`);
  }
  await pool.end();
}
main().catch((e) => { console.error('CHECK FAILED:', e.message); process.exit(1); });
