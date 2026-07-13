'use strict';
require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DB, ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    dateStrings: true,
  });

  // in_app_notification: meeting_id nulls
  const [[{ cnt: n1 }]] = await conn.query(`SELECT COUNT(*) AS cnt FROM in_app_notification WHERE meeting_id IS NULL`);
  console.log('in_app_notification NULL meeting_id:', n1);
  const [[{ cnt: n2 }]] = await conn.query(`SELECT COUNT(*) AS cnt FROM in_app_notification WHERE report_id IS NULL`);
  console.log('in_app_notification NULL report_id:', n2);
  const [[{ cnt: n3 }]] = await conn.query(`SELECT COUNT(*) AS cnt FROM in_app_notification WHERE user_id IS NULL`);
  console.log('in_app_notification NULL user_id:', n3);
  const [[{ cnt: n4 }]] = await conn.query(`SELECT COUNT(*) AS cnt FROM in_app_notification WHERE lead_id IS NULL`);
  console.log('in_app_notification NULL lead_id:', n4);

  // lead_master: description 500 too short?
  const [ldesc] = await conn.query(`SELECT lead_id, LENGTH(description) as len FROM lead_master ORDER BY len DESC LIMIT 3`);
  console.log('lead_master description max len:', JSON.stringify(ldesc));
  const [lnotes] = await conn.query(`SELECT COLUMN_NAME, CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='lead_master' AND DATA_TYPE='varchar' ORDER BY CHARACTER_MAXIMUM_LENGTH DESC LIMIT 10`, [process.env.MYSQL_DB]);
  console.log('lead_master varchar cols:', JSON.stringify(lnotes));

  // meeting_master: which varchar(255) is too long?
  const [mmcols] = await conn.query(`SELECT COLUMN_NAME, CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='meeting_master' AND DATA_TYPE='varchar'`, [process.env.MYSQL_DB]);
  console.log('meeting_master varchar cols:', JSON.stringify(mmcols));
  // Check each one
  for (const c of mmcols) {
    const [[{mx}]] = await conn.query(`SELECT MAX(LENGTH(\`${c.COLUMN_NAME}\`)) AS mx FROM meeting_master`);
    if (mx > (c.CHARACTER_MAXIMUM_LENGTH || 255)) console.log(`  OVERFLOW: meeting_master.${c.COLUMN_NAME} max=${mx} limit=${c.CHARACTER_MAXIMUM_LENGTH}`);
  }

  // meeting_reschedule: duration null
  const [[{ cnt: rd }]] = await conn.query(`SELECT COUNT(*) AS cnt FROM meeting_reschedule WHERE duration IS NULL`);
  console.log('meeting_reschedule NULL duration:', rd);
  const [[{ cnt: rt }]] = await conn.query(`SELECT COUNT(*) AS cnt FROM meeting_reschedule WHERE meeting_time IS NULL`);
  console.log('meeting_reschedule NULL meeting_time:', rt);
  const [[{ cnt: rm }]] = await conn.query(`SELECT COUNT(*) AS cnt FROM meeting_reschedule WHERE meeting_date IS NULL`);
  console.log('meeting_reschedule NULL meeting_date:', rm);

  // message_audit: country_code null
  const [[{ cnt: mc }]] = await conn.query(`SELECT COUNT(*) AS cnt FROM message_audit WHERE country_code IS NULL`);
  console.log('message_audit NULL country_code:', mc);
  const [[{ cnt: mm }]] = await conn.query(`SELECT COUNT(*) AS cnt FROM message_audit WHERE message_id IS NULL`);
  console.log('message_audit NULL message_id:', mm);

  // wishlist: address_id null
  const [[{ cnt: wa }]] = await conn.query(`SELECT COUNT(*) AS cnt FROM wishlist WHERE address_id IS NULL`);
  console.log('wishlist NULL address_id:', wa);
  const [[{ cnt: wc }]] = await conn.query(`SELECT COUNT(*) AS cnt FROM wishlist WHERE company_name IS NULL OR company_name = ''`);
  console.log('wishlist NULL/empty company_name:', wc);

  await conn.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
