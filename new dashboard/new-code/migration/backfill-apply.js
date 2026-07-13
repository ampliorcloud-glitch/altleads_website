'use strict';
/**
 * APPLY — link contacts to companies by matching work-email domain to
 * company_master.domain_clean. Only touches contacts where company_id IS NULL.
 * For a domain that maps to several (duplicate) companies, picks the lowest
 * company_id deterministically. Skips generic/free email providers.
 * Idempotent: re-running only fills still-NULL contacts.
 */
require('dotenv').config();
const { Pool } = require('pg');

function emailDomain(e) {
  if (!e) return '';
  const m = String(e).toLowerCase().trim().match(/@([^@\s]+)$/);
  if (!m) return '';
  return m[1].replace(/^www\./, '');
}
const GENERIC = new Set([
  'gmail.com', 'yahoo.com', 'yahoo.co.in', 'hotmail.com', 'outlook.com',
  'rediffmail.com', 'icloud.com', 'live.com', 'ymail.com', 'googlemail.com',
  'protonmail.com', 'aol.com',
]);

(async () => {
  const pg = new Pool({ connectionString: process.env.PG_CONNECTION_STRING });
  const comps = (await pg.query(
    "SELECT company_id, domain_clean FROM company_master WHERE domain_clean IS NOT NULL AND domain_clean <> ''"
  )).rows;
  const byDomain = new Map(); // domain -> min company_id
  for (const c of comps) {
    const d = c.domain_clean.toLowerCase();
    const prev = byDomain.get(d);
    if (prev == null || c.company_id < prev) byDomain.set(d, c.company_id);
  }

  const contacts = (await pg.query('SELECT contact_id, email FROM contact_master WHERE company_id IS NULL')).rows;
  let updated = 0;
  for (const ct of contacts) {
    const d = emailDomain(ct.email);
    if (!d || GENERIC.has(d)) continue;
    const cid = byDomain.get(d);
    if (cid == null) continue;
    await pg.query('UPDATE contact_master SET company_id = $1, updated_date = now() WHERE contact_id = $2 AND company_id IS NULL', [cid, ct.contact_id]);
    updated++;
  }

  const totals = (await pg.query('SELECT count(*) total, count(company_id) linked FROM contact_master')).rows[0];
  console.log('Contacts linked this run:', updated);
  console.log('contact_master now:', `${totals.linked} / ${totals.total} have a company`);
  await pg.end();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
