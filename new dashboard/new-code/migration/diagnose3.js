'use strict';
require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DB, ssl: { rejectUnauthorized: false }, dateStrings: true,
  });

  // lead_master NOT NULL columns
  const lCols = ['area_of_interest','role_and_resp','designation','email','lead_name','lead_number','mobile_no','report_url','source_id','address_id','client_assoc_id','created_by','created_date'];
  for (const c of lCols) {
    const [[{cnt}]] = await conn.query('SELECT COUNT(*) AS cnt FROM `lead_master` WHERE `' + c + '` IS NULL');
    if (Number(cnt) > 0) console.log('lead_master NULL ' + c + ': ' + cnt);
  }

  // meeting_master NOT NULL columns
  const mCols = ['description','meeting_mode','meeting_status','meeting_time','duration','meeting_date','created_by','created_date'];
  for (const c of mCols) {
    const [[{cnt}]] = await conn.query('SELECT COUNT(*) AS cnt FROM `meeting_master` WHERE `' + c + '` IS NULL');
    if (Number(cnt) > 0) console.log('meeting_master NULL ' + c + ': ' + cnt);
  }

  await conn.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
