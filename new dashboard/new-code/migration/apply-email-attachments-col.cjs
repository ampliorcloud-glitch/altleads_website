'use strict';
/** apply-email-attachments-col.cjs — ALT-509 attachments (2026-07-03).
 *  email_log.attachments jsonb: [{filename, size, contentType}] — names/sizes
 *  only (audit trail); file bytes are sent, not stored (storage copy = later,
 *  with export-history ALT-497 infra). Additive. */
const SQL = `ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS attachments jsonb;`;
async function main() {
  require('dotenv').config();
  const { Client } = require('pg');
  const c = new Client({ connectionString: process.env.PG_CONNECTION_STRING });
  await c.connect();
  try { await c.query(SQL); console.log('✅ email_log.attachments added'); }
  catch (e) { console.error('❌', e.message); process.exitCode = 1; }
  finally { await c.end(); }
}
if (require.main === module && process.argv.includes('--apply')) main();
else console.log('STAGED — run with --apply.');
