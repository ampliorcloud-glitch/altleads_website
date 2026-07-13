'use strict';
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const pg = new Pool({ connectionString: process.env.PG_CONNECTION_STRING });
  const sql = fs.readFileSync(path.join(__dirname, 'schema-drift.sql'), 'utf8');

  // Remove single-line comments, then split on semicolons
  const stripped = sql
    .split('\n')
    .map(line => line.replace(/^\s*--.*$/, ''))   // strip comment-only lines
    .join('\n');

  const stmts = stripped
    .split(/;\s*(?:\r?\n|$)/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  let ok = 0, fail = 0;
  for (const stmt of stmts) {
    try {
      await pg.query(stmt);
      ok++;
      console.log('OK:', stmt.substring(0, 80));
    } catch (e) {
      fail++;
      console.error('FAIL:', e.message.split('\n')[0], '| stmt:', stmt.substring(0, 80));
    }
  }
  console.log(`\nApplied: ${ok} ok, ${fail} failed`);
  await pg.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
