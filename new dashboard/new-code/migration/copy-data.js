'use strict';

/**
 * copy-data.js — MySQL → Postgres data migration tool for Amplior CRM
 *
 * Usage:
 *   node copy-data.js                        # copy all tables
 *   node copy-data.js --tables=a,b,c         # copy only named tables
 *   node copy-data.js --verify-only          # compare counts only, no writes
 *   node copy-data.js --verify-only --tables=a,b
 *   node copy-data.js --help
 *
 * Features:
 *   - Never dies on a single-table error; continues and reports at end
 *   - Skips tables where MySQL count == PG count (already migrated)
 *   - Zero-date handling: '0000-00-00' → null
 *   - Boolean coercion for bit(1)/tinyint(1) columns
 *   - Batch insert: 1000 rows per batch with LIMIT/OFFSET
 *   - ON CONFLICT DO NOTHING for idempotent re-runs
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const { Pool } = require('pg');

// ── CLI ────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Amplior CRM — MySQL to Postgres data copy tool

Usage:
  node copy-data.js [options]

Options:
  --tables=a,b,c  Copy only the listed tables (comma-separated, no spaces).
  --verify-only   Compare row counts only; do not write any data to Postgres.
  --help, -h      Show this help message and exit.

Environment (via .env or shell):
  MYSQL_HOST            MySQL server hostname
  MYSQL_PORT            MySQL server port (default: 3306)
  MYSQL_USER            MySQL username
  MYSQL_PASSWORD        MySQL password
  MYSQL_DB              MySQL database name
  MYSQL_SSL             Set to "true" to enable TLS for MySQL
  PG_CONNECTION_STRING  Full Postgres connection string

Notes:
  - MySQL is used READ-ONLY; only SELECT statements are issued.
  - Rows are inserted in batches of 1000 using ON CONFLICT DO NOTHING.
  - Tables are skipped if MySQL count == PG count (> 0) — already migrated.
  - Apply foreign_keys.sql to Postgres AFTER this script reports full success.
`);
  process.exit(0);
}

const VERIFY_ONLY = args.includes('--verify-only');
const BATCH_SIZE  = 1000;

// Parse --tables flag: --tables=a,b,c  OR  --tables a,b,c
let filterTables = null;
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--tables=')) {
    filterTables = args[i].slice('--tables='.length).split(',').map(t => t.trim()).filter(Boolean);
    break;
  }
  if (args[i] === '--tables' && args[i + 1]) {
    filterTables = args[i + 1].split(',').map(t => t.trim()).filter(Boolean);
    break;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Convert MySQL zero-dates and invalid dates to ISO string or null */
function safeIso(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' && /^0000-00-00/.test(v)) return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return v.toISOString();
  }
  const s = String(v);
  if (/^0000-00-00/.test(s)) return null;
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch { return null; }
}

/** Return true if v looks like a MySQL boolean-true value */
function mysqlBoolToJs(v) {
  if (v === null || v === undefined) return null;
  if (Buffer.isBuffer(v)) return v[0] !== 0;
  if (typeof v === 'boolean') return v;
  return Boolean(Number(v));
}

/** Build a parameterised INSERT … ON CONFLICT DO NOTHING statement */
function buildInsert(table, columns, rowCount) {
  const cols = columns.map(c => `"${c}"`).join(', ');
  const placeholders = [];
  for (let r = 0; r < rowCount; r++) {
    const row = columns.map((_, ci) => `$${r * columns.length + ci + 1}`);
    placeholders.push(`(${row.join(', ')})`);
  }
  return `INSERT INTO "${table}" (${cols}) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`;
}

/** Pad a string to a given length (for the summary table) */
function pad(s, n) {
  s = String(s);
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  // ── Connect to MySQL ──────────────────────────────────────────────────────
  const mysqlConn = await mysql.createConnection({
    host:     process.env.MYSQL_HOST || 'localhost',
    port:     Number(process.env.MYSQL_PORT || 3306),
    user:     process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DB || 'amplior',
    ssl:      process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    multipleStatements: false,
    // Avoid zero-date driver errors — return raw strings
    dateStrings: true,
  });

  // Read-only session
  await mysqlConn.query('SET SESSION TRANSACTION READ ONLY');

  // ── Connect to Postgres ───────────────────────────────────────────────────
  if (!process.env.PG_CONNECTION_STRING) {
    throw new Error('PG_CONNECTION_STRING is not set.');
  }
  const pg = new Pool({ connectionString: process.env.PG_CONNECTION_STRING });

  // ── Discover tables in MySQL ──────────────────────────────────────────────
  const [mysqlTableRows] = await mysqlConn.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
     ORDER BY TABLE_NAME`,
    [process.env.MYSQL_DB || 'amplior']
  );
  let tableNames = mysqlTableRows.map(r => r.TABLE_NAME || r.table_name);

  // Apply --tables filter
  if (filterTables) {
    const filterSet = new Set(filterTables);
    tableNames = tableNames.filter(t => filterSet.has(t));
    console.log(`\nFiltered to ${tableNames.length} tables: ${tableNames.join(', ')}\n`);
  } else {
    console.log(`\nDiscovered ${tableNames.length} tables in MySQL.\n`);
  }

  // ── Introspect Postgres boolean columns ───────────────────────────────────
  const pgBoolRes = await pg.query(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND data_type = 'boolean'`
  );
  const pgBoolCols = new Map();
  for (const row of pgBoolRes.rows) {
    if (!pgBoolCols.has(row.table_name)) pgBoolCols.set(row.table_name, new Set());
    pgBoolCols.get(row.table_name).add(row.column_name);
  }

  // ── Introspect MySQL column types ─────────────────────────────────────────
  const [mysqlColRows] = await mysqlConn.query(
    `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_TYPE
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ?
     ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    [process.env.MYSQL_DB || 'amplior']
  );
  const mysqlColTypes = new Map();
  for (const r of mysqlColRows) {
    const tbl   = r.TABLE_NAME  || r.table_name;
    const col   = r.COLUMN_NAME || r.column_name;
    const dtype = (r.DATA_TYPE   || r.data_type   || '').toLowerCase();
    const ctype = (r.COLUMN_TYPE || r.column_type || '').toLowerCase();
    if (!mysqlColTypes.has(tbl)) mysqlColTypes.set(tbl, new Map());
    mysqlColTypes.get(tbl).set(col, { dtype, ctype });
  }

  // ── Introspect Postgres columns (to skip columns missing in PG) ───────────
  const pgColRes = await pg.query(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'`
  );
  const pgColSet = new Set();
  for (const r of pgColRes.rows) {
    pgColSet.add(`${r.table_name}.${r.column_name}`);
  }

  // ── Introspect Postgres tables ────────────────────────────────────────────
  const pgTableRes = await pg.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
  );
  const pgTableSet = new Set(pgTableRes.rows.map(r => r.table_name));

  // ── Per-table copy ────────────────────────────────────────────────────────
  const summary = []; // { table, mysqlCount, pgCount, status, note }
  const errors  = []; // { table, error }

  for (const table of tableNames) {
    // Skip tables that don't exist in PG yet (shouldn't happen after drift fix)
    if (!pgTableSet.has(table)) {
      console.log(`SKIP (no PG table): ${table}`);
      summary.push({ table, mysqlCount: '?', pgCount: '?', status: 'NO_PG_TABLE' });
      continue;
    }

    let mysqlCount;
    try {
      const [[{ cnt }]] = await mysqlConn.query(`SELECT COUNT(*) AS cnt FROM \`${table}\``);
      mysqlCount = Number(cnt);
    } catch (e) {
      console.error(`ERROR counting MySQL ${table}: ${e.message}`);
      errors.push({ table, error: `MySQL count: ${e.message}` });
      summary.push({ table, mysqlCount: '?', pgCount: '?', status: 'ERROR' });
      continue;
    }

    // Count in PG
    let pgCountBefore;
    try {
      const r = await pg.query(`SELECT COUNT(*) AS cnt FROM "${table}"`);
      pgCountBefore = Number(r.rows[0].cnt);
    } catch (e) {
      console.error(`ERROR counting PG ${table}: ${e.message}`);
      errors.push({ table, error: `PG count: ${e.message}` });
      summary.push({ table, mysqlCount, pgCount: '?', status: 'ERROR' });
      continue;
    }

    if (VERIFY_ONLY) {
      const match = mysqlCount === pgCountBefore;
      const status = match ? 'MATCH' : 'MISMATCH';
      console.log(`${table}: mysql=${mysqlCount} pg=${pgCountBefore} ${status}`);
      summary.push({ table, mysqlCount, pgCount: pgCountBefore, status });
      continue;
    }

    // Skip if already fully migrated
    if (mysqlCount > 0 && pgCountBefore >= mysqlCount) {
      console.log(`SKIP (counts match): ${table} — ${mysqlCount} rows`);
      summary.push({ table, mysqlCount, pgCount: pgCountBefore, status: 'SKIPPED' });
      continue;
    }

    if (mysqlCount === 0) {
      console.log(`EMPTY: ${table} — 0 rows in MySQL`);
      summary.push({ table, mysqlCount: 0, pgCount: pgCountBefore, status: pgCountBefore === 0 ? 'MATCH' : 'MISMATCH' });
      continue;
    }

    // Fetch column list — only columns present in both MySQL and PG
    let columns;
    try {
      const [colRows] = await mysqlConn.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
         ORDER BY ORDINAL_POSITION`,
        [process.env.MYSQL_DB || 'amplior', table]
      );
      // Only include columns that exist in PG
      columns = colRows
        .map(r => r.COLUMN_NAME || r.column_name)
        .filter(col => pgColSet.has(`${table}.${col}`));
    } catch (e) {
      console.error(`ERROR fetching columns for ${table}: ${e.message}`);
      errors.push({ table, error: `Column fetch: ${e.message}` });
      summary.push({ table, mysqlCount, pgCount: pgCountBefore, status: 'ERROR' });
      continue;
    }

    const boolsInPg  = pgBoolCols.get(table) || new Set();
    const mysqlTypes = mysqlColTypes.get(table) || new Map();

    let offset   = 0;
    let inserted = 0;
    let tableError = null;

    while (offset < mysqlCount) {
      let rows;
      try {
        [rows] = await mysqlConn.query(
          `SELECT * FROM \`${table}\` LIMIT ${BATCH_SIZE} OFFSET ${offset}`
        );
      } catch (e) {
        tableError = `Fetch batch offset=${offset}: ${e.message}`;
        break;
      }
      if (rows.length === 0) break;

      // Transform each row
      const flatParams = [];
      for (const row of rows) {
        for (const col of columns) {
          let val = row[col];
          const { dtype, ctype } = mysqlTypes.get(col) || { dtype: '', ctype: '' };

          if (val === null || val === undefined) {
            flatParams.push(null);
          } else if (boolsInPg.has(col)) {
            flatParams.push(mysqlBoolToJs(val));
          } else if (dtype === 'datetime' || dtype === 'timestamp') {
            flatParams.push(safeIso(val));
          } else if (dtype === 'date') {
            // Handle zero-date
            if (typeof val === 'string' && /^0000-00-00/.test(val)) {
              flatParams.push(null);
            } else {
              flatParams.push(val);
            }
          } else if (Buffer.isBuffer(val)) {
            flatParams.push(val.toString('hex'));
          } else if (val instanceof Date) {
            flatParams.push(safeIso(val));
          } else {
            flatParams.push(val);
          }
        }
      }

      try {
        const sql = buildInsert(table, columns, rows.length);
        await pg.query(sql, flatParams);
        inserted += rows.length;
      } catch (e) {
        tableError = `Insert batch offset=${offset}: ${e.message}`;
        break;
      }

      offset += rows.length;
      if (rows.length < BATCH_SIZE) break; // last batch
    }

    if (tableError) {
      console.error(`ERROR ${table}: ${tableError}`);
      errors.push({ table, error: tableError });
    }

    // Verify final count in PG
    let pgCountAfter;
    try {
      const r = await pg.query(`SELECT COUNT(*) AS cnt FROM "${table}"`);
      pgCountAfter = Number(r.rows[0].cnt);
    } catch (e) {
      pgCountAfter = '?';
    }

    const status = tableError
      ? 'ERROR'
      : pgCountAfter >= mysqlCount ? 'OK' : 'MISMATCH';

    console.log(`${status === 'OK' ? 'OK' : status}: ${table} — mysql=${mysqlCount} pg=${pgCountAfter}${tableError ? ' (' + tableError.substring(0, 60) + ')' : ''}`);
    summary.push({ table, mysqlCount, pgCount: pgCountAfter, status });
  }

  // ── Summary table ─────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(78));
  console.log(pad('TABLE', 38) + pad('MYSQL', 10) + pad('PG', 10) + 'STATUS');
  console.log('─'.repeat(78));
  for (const { table, mysqlCount, pgCount, status } of summary) {
    console.log(pad(table, 38) + pad(mysqlCount, 10) + pad(pgCount, 10) + status);
  }
  console.log('─'.repeat(78));

  if (errors.length > 0) {
    console.error(`\nErrors (${errors.length}):`);
    for (const { table, error } of errors) {
      console.error(`  [${table}] ${error}`);
    }
  }

  const mismatches = summary.filter(r => r.status === 'MISMATCH' || r.status === 'ERROR');
  if (mismatches.length === 0) {
    console.log(`\nAll ${summary.length} tables OK.`);
  } else {
    console.error(`\n${mismatches.length} table(s) with issues.`);
  }

  await mysqlConn.end();
  await pg.end();

  process.exit(mismatches.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
