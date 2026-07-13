'use strict';
/**
 * rls-smoke-test.cjs — throwaway-AGENT validation of the assignment-ownership RLS
 * (authorized by Ankit 2026-07-02; CLAUDE.md §2 "validate RLS with throwaway logins").
 *
 * WHAT IT DOES (idempotent — safe to re-run before AND after the fix):
 *   1. Service-role: ensure a throwaway auth login exists, linked via `profiles`
 *      to user_id 8 (the real agent with 128 assigned leads — read-only tests;
 *      the one INSERT probe is deleted immediately if it lands).
 *   2. Sign in as that agent (anon key) and, UNDER RLS:
 *      a. count own lead_report rows (open table — baseline sanity)
 *      b. SELECT lead_master for 5 ASSIGNED leads   → pre-fix: 0 (THE BUG) / post-fix: 5
 *      c. SELECT lead_master for a NON-assigned lead → must be 0 BOTH before & after
 *      d. INSERT an interaction on an assigned lead  → pre-fix: denied / post-fix: ok (then deleted)
 *   3. `--cleanup` deletes the throwaway auth user + profiles row.
 *
 * No secrets printed. Keys read from ../../.credentials/*.txt (gitignored).
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require(path.join(__dirname, '..', 'notify-service', 'node_modules', '@supabase/supabase-js'));

const CRED = (f) => fs.readFileSync(path.join(__dirname, '..', '..', '.credentials', f), 'utf8').trim();
const URL = 'https://puvozfhypqbwbmbhrhcr.supabase.co';
const EMAIL = 'rls-smoke-agent@altleads-test.local';
const PASS = 'Smoke-Test-9War!x' + 'Q2'; // throwaway; account is deleted after validation
const AGENT_USER_ID = 8;

async function main() {
  const admin = createClient(URL, CRED('supabase_service_role_key.txt'), { auth: { autoRefreshToken: false, persistSession: false } });

  if (process.argv.includes('--cleanup')) {
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const u = (data?.users ?? []).find((x) => x.email === EMAIL);
    if (u) {
      await admin.from('profiles').delete().eq('id', u.id);
      await admin.auth.admin.deleteUser(u.id);
      console.log('cleanup: throwaway login removed');
    } else console.log('cleanup: nothing to remove');
    return;
  }

  // 1. Ensure throwaway login exists + profiles link
  let uid = null;
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASS, email_confirm: true,
  });
  if (cErr && !/already/i.test(cErr.message)) throw new Error('createUser: ' + cErr.message);
  if (created?.user) uid = created.user.id;
  if (!uid) {
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    uid = (data?.users ?? []).find((x) => x.email === EMAIL)?.id ?? null;
    if (uid) await admin.auth.admin.updateUserById(uid, { password: PASS });
  }
  if (!uid) throw new Error('could not create/find throwaway user');
  const { error: pErr } = await admin.from('profiles').upsert(
    { id: uid, email: EMAIL, user_id: AGENT_USER_ID, full_name: 'RLS Smoke Agent (throwaway)', role: 'AGENT' },
    { onConflict: 'id' });
  if (pErr) throw new Error('profiles upsert: ' + pErr.message);
  console.log(`throwaway agent ready (linked to user_id ${AGENT_USER_ID})`);

  // Reference data via service role: assigned lead_ids + a non-assigned control
  const { data: reps } = await admin.from('lead_report')
    .select('lead_id').eq('user_id', AGENT_USER_ID).is('deleted_date', null).limit(5);
  const assignedIds = [...new Set((reps ?? []).map((r) => r.lead_id))];
  const { data: other } = await admin.from('lead_report')
    .select('lead_id').neq('user_id', AGENT_USER_ID).is('deleted_date', null).limit(1);
  const controlId = other?.[0]?.lead_id ?? null;
  const { data: lmRow } = await admin.from('lead_master')
    .select('lead_id, project_id').eq('lead_id', assignedIds[0]).maybeSingle();

  // 2. Sign in as the agent and test UNDER RLS
  const agent = createClient(URL, CRED('supabase_anon_key.txt'), { auth: { persistSession: false } });
  const { error: sErr } = await agent.auth.signInWithPassword({ email: EMAIL, password: PASS });
  if (sErr) throw new Error('signIn: ' + sErr.message);

  const { count: repCount } = await agent.from('lead_report')
    .select('report_id', { count: 'exact', head: true })
    .eq('user_id', AGENT_USER_ID).is('deleted_date', null);
  console.log(`a) own lead_report rows visible : ${repCount}`);

  const { data: lmVisible } = await agent.from('lead_master')
    .select('lead_id').in('lead_id', assignedIds);
  console.log(`b) ASSIGNED lead_master visible : ${lmVisible?.length ?? 0} of ${assignedIds.length}  ${(lmVisible?.length ?? 0) === 0 ? '← THE BUG (pre-fix)' : '← FIX WORKING'}`);

  if (controlId != null) {
    const { data: ctrl } = await agent.from('lead_master').select('lead_id').eq('lead_id', controlId);
    console.log(`c) NON-assigned lead visible    : ${ctrl?.length ?? 0}  ${(ctrl?.length ?? 0) === 0 ? '← isolation intact' : '←‼ LEAK'}`);
  }

  const { data: ins, error: iErr } = await agent.from('interaction').insert({
    record_type: 'lead', record_id: assignedIds[0], project_id: lmRow?.project_id ?? null,
    owner_user_id: AGENT_USER_ID, type: 'call', disposition: 'smoke-test',
    note_text: 'RLS smoke test — delete me', created_by: String(AGENT_USER_ID),
  }).select('interaction_id');
  if (iErr) {
    console.log(`d) log-a-call (interaction ins) : DENIED — "${iErr.message}" ← pre-fix expected`);
  } else {
    console.log('d) log-a-call (interaction ins) : ALLOWED ← post-fix expected (cleaning probe row)');
    const probeId = ins?.[0]?.interaction_id;
    if (probeId != null) await admin.from('interaction').delete().eq('interaction_id', probeId);
  }
  console.log('\nRerun this script after applying apply-assignment-ownership-rls-fix.cjs; then run --cleanup.');
}
main().catch((e) => { console.error('SMOKE ERR:', e.message); process.exit(1); });
