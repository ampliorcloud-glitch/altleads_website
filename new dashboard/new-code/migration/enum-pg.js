'use strict';
require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const pg = new Pool({ connectionString: process.env.PG_CONNECTION_STRING });

  const tabRes = await pg.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`
  );
  console.log('PG_TABLES:' + JSON.stringify(tabRes.rows.map(r => r.table_name)));

  const colRes = await pg.query(
    `SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public'
     ORDER BY table_name, ordinal_position`
  );
  console.log('PG_COLUMNS:' + JSON.stringify(colRes.rows));

  await pg.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
