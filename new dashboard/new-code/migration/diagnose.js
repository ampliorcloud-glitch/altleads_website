'use strict';
require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host:        process.env.MYSQL_HOST,
    port:        Number(process.env.MYSQL_PORT || 3306),
    user:        process.env.MYSQL_USER,
    password:    process.env.MYSQL_PASSWORD,
    database:    process.env.MYSQL_DB,
    ssl:         process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    dateStrings: true,
  });

  // 1. in_app_notification: null route
  const [notif] = await conn.query(`SELECT notification_id, route, lead_number, status FROM in_app_notification WHERE route IS NULL OR route = '' LIMIT 5`);
  console.log('in_app_notification NULL route:', JSON.stringify(notif));

  // 2. lead_master: value too long for varchar(50)
  const [leadArea] = await conn.query(`SELECT lead_id, LENGTH(area_of_interest) as len, area_of_interest FROM lead_master ORDER BY len DESC LIMIT 3`);
  console.log('lead_master area_of_interest max len:', JSON.stringify(leadArea));
  const [leadRole] = await conn.query(`SELECT lead_id, LENGTH(role_and_resp) as len, role_and_resp FROM lead_master ORDER BY len DESC LIMIT 3`);
  console.log('lead_master role_and_resp max len:', JSON.stringify(leadRole));
  const [leadDes] = await conn.query(`SELECT lead_id, LENGTH(designation) as len FROM lead_master ORDER BY len DESC LIMIT 3`);
  console.log('lead_master designation max len:', JSON.stringify(leadDes));

  // 3. meeting_master: varchar(255) too short
  const [mtgDesc] = await conn.query(`SELECT meeting_id, LENGTH(description) as len FROM meeting_master ORDER BY len DESC LIMIT 3`);
  console.log('meeting_master description max len:', JSON.stringify(mtgDesc));
  const [mtgMode] = await conn.query(`SELECT meeting_id, LENGTH(meeting_mode) as len FROM meeting_master ORDER BY len DESC LIMIT 3`);
  console.log('meeting_master meeting_mode max len:', JSON.stringify(mtgMode));

  // 4. meeting_reschedule: varchar(10) too short for meeting_status
  const [resch] = await conn.query(`SELECT mtg_resch_id, LENGTH(meeting_status) as len, meeting_status FROM meeting_reschedule ORDER BY len DESC LIMIT 5`);
  console.log('meeting_reschedule meeting_status max len:', JSON.stringify(resch));
  const [reschDur] = await conn.query(`SELECT mtg_resch_id, LENGTH(duration) as len, duration FROM meeting_reschedule ORDER BY len DESC LIMIT 3`);
  console.log('meeting_reschedule duration max len:', JSON.stringify(reschDur));

  // 5. message_audit: varchar(13) too short for to_number
  const [msgAudit] = await conn.query(`SELECT message_audit_id, LENGTH(to_number) as len, to_number FROM message_audit ORDER BY len DESC LIMIT 3`);
  console.log('message_audit to_number max len:', JSON.stringify(msgAudit));

  // 6. pre_sales_answer: varchar(255) too short
  const [psa] = await conn.query(`SELECT pre_sa_ans_id, LENGTH(answer) as len FROM pre_sales_answer ORDER BY len DESC LIMIT 3`);
  console.log('pre_sales_answer answer max len:', JSON.stringify(psa));

  // 7. role_master: null priority
  const [roles] = await conn.query(`SELECT role_id, name, priority FROM role_master`);
  console.log('role_master all rows:', JSON.stringify(roles));

  // 8. user_master: null amplior_associate
  const [users] = await conn.query(`SELECT user_id, amplior_associate, email FROM user_master WHERE amplior_associate IS NULL LIMIT 5`);
  console.log('user_master NULL amplior_associate:', JSON.stringify(users));

  // 9. wishlist: varchar(255) too short
  const [wish] = await conn.query(`SELECT wishlist_id, LENGTH(company_name) as cn_len, LENGTH(description) as d_len, LENGTH(lead_name) as ln_len FROM wishlist ORDER BY cn_len DESC LIMIT 3`);
  console.log('wishlist max lens:', JSON.stringify(wish));

  await conn.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
