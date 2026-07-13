'use strict';
/**
 * HIDE (do not drop) the legacy user_master.password column from the API.
 * Postgres can't revoke a single column while the privilege is held at table
 * level, so we: revoke table-level SELECT/INSERT/UPDATE from anon+authenticated,
 * then re-grant those on EVERY column EXCEPT password. Data is untouched.
 */
require('dotenv').config();
const { Pool } = require('pg');

async function hide(pg, table) {
  const cols = (await pg.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1 AND column_name <> 'password'
     ORDER BY ordinal_position`, [table]
  )).rows.map(r => '"' + r.column_name + '"');
  const list = cols.join(', ');
  for (const role of ['anon', 'authenticated']) {
    await pg.query(`REVOKE SELECT, INSERT, UPDATE ON public.${table} FROM ${role}`);
    await pg.query(`GRANT SELECT (${list}), INSERT (${list}), UPDATE (${list}) ON public.${table} TO ${role}`);
  }
}

(async () => {
  const pg = new Pool({ connectionString: process.env.PG_CONNECTION_STRING });
  await hide(pg, 'user_master');
  await hide(pg, 'user_master_audit');
  const chk = await pg.query(
    `SELECT grantee, privilege_type FROM information_schema.column_privileges
     WHERE table_name='user_master' AND column_name='password' AND grantee IN ('anon','authenticated')`);
  console.log('password-column grants to anon/authenticated:', chk.rows.length === 0 ? 'NONE — hidden from API ✅' : JSON.stringify(chk.rows));
  // sanity: a normal column still readable by authenticated?
  const ok = await pg.query(
    `SELECT count(*) FROM information_schema.column_privileges
     WHERE table_name='user_master' AND column_name='email' AND grantee='authenticated' AND privilege_type='SELECT'`);
  console.log('email column still readable by authenticated (should be 1):', ok.rows[0].count);
  await pg.end();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
