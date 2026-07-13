'use strict';
/**
 * APPLY access-rls-v1.sql to Supabase via pg, inside a single transaction.
 * Then VERIFY: re-query pg_policies for the six target tables and confirm the
 * new helper functions exist. Prints AFTER state. Does NOT git commit.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const TABLES = [
  'lead_master', 'company_master', 'contact_master',
  'contact_project_status', 'company_project_status', 'interaction',
];

(async () => {
  const sql = fs.readFileSync(path.join(__dirname, 'access-rls-v1.sql'), 'utf8');
  const pg = new Pool({ connectionString: process.env.PG_CONNECTION_STRING });
  const client = await pg.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('APPLIED access-rls-v1.sql OK (committed).');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('APPLY FAILED, rolled back:', e.message);
    client.release();
    await pg.end();
    process.exit(1);
  }

  // VERIFY helpers
  const fns = await client.query(
    `SELECT p.proname, pg_get_function_identity_arguments(p.oid) args,
            p.provolatile, p.prosecdef
     FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public'
       AND p.proname IN ('is_admin','current_user_id','is_qc',
                         'manages_project','record_owner_id','record_project_id')
     ORDER BY p.proname`);
  console.log('\n=== HELPER FUNCTIONS (AFTER) ===');
  console.log(JSON.stringify(fns.rows, null, 2));

  // VERIFY policies
  const pol = await client.query(
    `SELECT tablename, policyname, cmd, roles, qual, with_check
     FROM pg_policies
     WHERE schemaname='public' AND tablename = ANY($1)
     ORDER BY tablename,
       CASE cmd WHEN 'SELECT' THEN 1 WHEN 'INSERT' THEN 2
                WHEN 'UPDATE' THEN 3 WHEN 'DELETE' THEN 4 ELSE 5 END,
       policyname`, [TABLES]);
  console.log('\n=== POLICIES (AFTER) ===');
  console.log(JSON.stringify(pol.rows, null, 2));

  client.release();
  await pg.end();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
