'use strict';
/**
 * gateway-import-validation.cjs — GATEWAY-ENABLEMENT.md checklist, executed
 * against crm-test.altleads.com (gateway ON there since 2026-07-02).
 *
 * Validates end-to-end with a tiny throwaway dataset, then UNDOES it:
 *   1. admin JWT → POST /api/write company.import (1 row) → row lands
 *   2. admin JWT → POST /api/write lead.import (1 row, project=Hungerbox,
 *      assigned_to=8) → lead lands + lead_report seeded (ALT-499)
 *   3. import_batch / import_row audit rows exist (record book)
 *   4. importUndo both batches → rows soft-deleted incl. seeded lead_report
 *   5. AGENT JWT (throwaway) → lead.reassign → expect 403 (role allow-list)
 *
 * No secrets printed. Test rows are namespaced 'ZZVAL ' and removed by undo.
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require(path.join(__dirname, '..', 'notify-service', 'node_modules', '@supabase/supabase-js'));

const CRED_DIR = path.join(__dirname, '..', '..', '.credentials');
const CRED = (f) => fs.readFileSync(path.join(CRED_DIR, f), 'utf8').replace(/^﻿/, '').trim();
const SB_URL = 'https://puvozfhypqbwbmbhrhcr.supabase.co';
const GW = 'https://crm-test.altleads.com/api/write';

function adminLogin() {
  const txt = CRED('test_admin_login.txt');
  const email = /email\s*[:=]\s*(\S+)/i.exec(txt)?.[1];
  const pass = /pass(?:word)?\s*[:=]\s*(\S+)/i.exec(txt)?.[1];
  if (!email || !pass) throw new Error('could not parse test_admin_login.txt');
  return { email, pass };
}

async function gwCall(token, action, entity, payload) {
  const r = await fetch(GW, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, entity, payload }),
  });
  let body = null;
  try { body = await r.json(); } catch { /* non-json */ }
  return { status: r.status, body };
}

async function main() {
  const svc = createClient(SB_URL, CRED('supabase_service_role_key.txt'), { auth: { autoRefreshToken: false, persistSession: false } });
  const anonA = createClient(SB_URL, CRED('supabase_anon_key.txt'), { auth: { persistSession: false } });

  // 0. Admin session
  const { email, pass } = adminLogin();
  const { data: sess, error: sErr } = await anonA.auth.signInWithPassword({ email, password: pass });
  if (sErr) throw new Error('admin signIn: ' + sErr.message);
  const adminTok = sess.session.access_token;
  console.log('0) admin session      : OK');

  // 1. Company import
  const c = await gwCall(adminTok, 'company.import', 'company', {
    entity: 'company',
    rows: [{ company_name: 'ZZVAL Import Test Co', company_web_url: 'https://zzval-import-test.example' }],
    filename: 'zzval-smoke.csv',
  });
  console.log(`1) company.import     : HTTP ${c.status} inserted=${c.body?.inserted ?? '?'} batch=${c.body?.batchId ?? 'NONE'}`);
  const companyBatch = c.body?.batchId ?? null;

  // 2. Lead import with project + assignment (ALT-499/500)
  const l = await gwCall(adminTok, 'lead.import', 'lead', {
    entity: 'lead',
    rows: [{ lead_name: 'ZZVAL Import Test Lead', project: 'Hungerbox', assigned_to: '8', email: 'zzval@import-test.example', designation: 'Tester' }],
    filename: 'zzval-smoke.csv',
  });
  console.log(`2) lead.import        : HTTP ${l.status} inserted=${l.body?.inserted ?? '?'} batch=${l.body?.batchId ?? 'NONE'}`);
  const leadBatch = l.body?.batchId ?? null;

  // 3. Verify landings via service role
  const { data: co } = await svc.from('company_master').select('company_id').eq('company_name', 'ZZVAL Import Test Co').is('deleted_date', null);
  const { data: ld } = await svc.from('lead_master').select('lead_id, project_id, lead_number').eq('lead_name', 'ZZVAL Import Test Lead').is('deleted_date', null);
  const leadId = ld?.[0]?.lead_id ?? null;
  let rep = null;
  if (leadId) {
    const { data } = await svc.from('lead_report').select('report_id, user_id, stage_id').eq('lead_id', leadId).is('deleted_date', null);
    rep = data?.[0] ?? null;
  }
  console.log(`3) landed             : company=${co?.length ?? 0} lead=${ld?.length ?? 0} (project_id=${ld?.[0]?.project_id ?? '-'}, ${ld?.[0]?.lead_number ?? '-'}) lead_report=${rep ? `user_id=${rep.user_id} stage=${rep.stage_id}` : 'MISSING'}`);
  const { count: rowsAudited } = await svc.from('import_row').select('id', { count: 'exact', head: true }).in('batch_id', [companyBatch, leadBatch].filter(Boolean));
  console.log(`   record book        : import_row entries=${rowsAudited ?? 0} (expect 2)`);

  // 4. Undo both batches
  for (const [name, batchId, entity] of [['company', companyBatch, 'company'], ['lead', leadBatch, 'lead']]) {
    if (batchId == null) { console.log(`4) undo ${name}         : SKIPPED (no batch id)`); continue; }
    const u = await gwCall(adminTok, `${entity}.importUndo`, entity, { batchId });
    console.log(`4) undo ${name.padEnd(7)}      : HTTP ${u.status} undone=${u.body?.undone ?? '?'}`);
  }
  const { data: coAfter } = await svc.from('company_master').select('company_id').eq('company_name', 'ZZVAL Import Test Co').is('deleted_date', null);
  const { data: ldAfter } = await svc.from('lead_master').select('lead_id').eq('lead_name', 'ZZVAL Import Test Lead').is('deleted_date', null);
  let repAfter = 0;
  if (leadId) {
    const { count } = await svc.from('lead_report').select('report_id', { count: 'exact', head: true }).eq('lead_id', leadId).is('deleted_date', null);
    repAfter = count ?? 0;
  }
  console.log(`   after undo         : live company=${coAfter?.length ?? 0} lead=${ldAfter?.length ?? 0} lead_report=${repAfter} (expect 0/0/0)`);

  // 5. Role enforcement: throwaway AGENT must get 403 on lead.reassign
  const EMAIL = 'rls-smoke-agent@altleads-test.local';
  const PASS = 'Smoke-Test-9War!xQ2';
  let uid = null;
  const { data: mk, error: mkErr } = await svc.auth.admin.createUser({ email: EMAIL, password: PASS, email_confirm: true });
  if (mk?.user) uid = mk.user.id;
  if (!uid && mkErr) {
    const { data } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
    uid = (data?.users ?? []).find((x) => x.email === EMAIL)?.id ?? null;
    if (uid) await svc.auth.admin.updateUserById(uid, { password: PASS });
  }
  await svc.from('profiles').upsert({ id: uid, email: EMAIL, user_id: 8, full_name: 'RLS Smoke Agent (throwaway)', role: 'AGENT' }, { onConflict: 'id' });
  const anonB = createClient(SB_URL, CRED('supabase_anon_key.txt'), { auth: { persistSession: false } });
  const { data: aSess, error: aErr } = await anonB.auth.signInWithPassword({ email: EMAIL, password: PASS });
  if (aErr) throw new Error('agent signIn: ' + aErr.message);
  const g = await gwCall(aSess.session.access_token, 'lead.reassign', 'lead', { leadId: 1, newUserId: 8 });
  console.log(`5) agent lead.reassign: HTTP ${g.status} ${g.status === 403 ? '← correctly FORBIDDEN' : '←‼ expected 403'}`);
  await svc.from('profiles').delete().eq('id', uid);
  await svc.auth.admin.deleteUser(uid);
  console.log('   throwaway cleaned  : OK');
}
main().catch((e) => { console.error('VALIDATION ERR:', e.message); process.exit(1); });
