'use strict';

require('dotenv').config();

const path      = require('path');
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const { buildEmail } = require('./email-templates');

/* ── Config ──────────────────────────────────────────────────────── */

const PORT           = parseInt(process.env.PORT || '8787', 10);
// When serving from the same origin, ALLOWED_ORIGIN is not needed for same-origin requests.
// For local dev (web on 5173, server on 8787) set ALLOWED_ORIGIN=http://localhost:5173.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';
const WEB_DIST       = path.join(__dirname, '..', 'web', 'dist');
const GMAIL_USER     = process.env.GMAIL_USER;
const GMAIL_PASS     = process.env.GMAIL_APP_PASSWORD;

/* ── Build stamp ─────────────────────────────────────────────────── */
// Written by gen-build-info.cjs as the first step of the root `build` script,
// so /health can report exactly which commit + build time is LIVE (the
// permanent answer to "is prod loaded with my push?"). Absent in dev → 'dev'.
const BUILD_INFO = (() => {
  try {
    return require('./build-info.json');
  } catch {
    return { commit: 'dev', commitFull: null, branch: null, builtAt: null, node: process.version };
  }
})();

/* ── Supabase service-role admin client (lazy, created once) ─────── */
/**
 * Returns a singleton service-role admin client, or null if the env vars are
 * not set. Used both by the auth middleware (token verification + role lookup)
 * and by the user-management handlers below.
 */
let supabaseAdmin = null;

function getSupabaseAdmin() {
  if (supabaseAdmin) return supabaseAdmin;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return supabaseAdmin;
}

/* ── ALT-496: durable email log ──────────────────────────────────────
 * Records every outbound email (success + failure) in email_log.
 * TOLERANT by design: if the table is missing (migration apply-comms-capture.cjs
 * not applied yet) or the insert fails, warn and continue — never break a send. */
async function logEmail(entry) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return;
    const { error } = await admin.from('email_log').insert({
      sent_to:    entry.to ?? null,
      email_type: entry.type ?? null,
      subject:    entry.subject ?? null,
      status:     entry.status,                  // 'sent' | 'failed'
      error:      entry.error ?? null,
      message_id: entry.messageId ?? null,
      lead_id:    entry.leadId ?? null,
      report_id:  entry.reportId ?? null,
      meeting_id: entry.meetingId ?? null,
      contact_id: entry.contactId ?? null,
      company_id: entry.companyId ?? null,
      attachments: entry.attachments ?? null,
      actor:      entry.actor ?? 'system',
    });
    if (error) console.warn('[email_log] skipped:', error.message);
  } catch (e) {
    console.warn('[email_log] skipped:', e.message);
  }
}

/* ── User-management helpers ─────────────────────────────────────── */

/** Generate a strong 12-char temp password (guaranteed mixed character classes). */
function genTempPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%&*';
  const all = upper + lower + digits + special;
  const pick = (s) => s[Math.floor(Math.random() * s.length)];
  let pw = pick(upper) + pick(lower) + pick(digits) + pick(special);
  for (let i = 4; i < 12; i++) pw += pick(all);
  return pw.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Find a Supabase Auth user by email. The admin API has no get-by-email, so we
 * page through listUsers (cap at 20 pages / 20k users — far above our scale).
 * Returns the auth user object or null.
 */
async function findAuthUserByEmail(admin, email) {
  const target = String(email).trim().toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) return null;
    const hit = (data.users || []).find((u) => (u.email || '').toLowerCase() === target);
    if (hit) return hit;
    if (!data.users || data.users.length < 1000) break; // last page
  }
  return null;
}

/**
 * Ensure the profiles row linking auth uid -> numeric user_id exists & is correct,
 * so RLS helpers (current_user_id / is_admin) and requireAdmin work for this user.
 * Resolves profiles.role from the user's most-privileged (lowest role_id) role.
 * Best-effort: logs and continues on failure (never blocks the password action).
 */
// Link an auth uid -> numeric user_id (+ role) in `profiles`. Returns a STATUS —
// it never silently swallows a failure. Why this matters (RSK-10): assignee-RLS
// resolves the caller via current_user_id() reading this profiles row; a provisioned
// login whose profiles row is missing/has a NULL user_id -> current_user_id() = NULL
// -> every write policy is false -> that user is SILENTLY denied ALL edits. So we
// (a) ALWAYS write user_id (it's required for the link to be usable), and (b) report
// ok/reason so callers can surface coverage instead of returning a false 200.
async function ensureProfileLink(admin, { authUid, userId, email, fullName }) {
  try {
    if (userId == null) {
      console.error('[users] ensureProfileLink: no user_id — profile would be unusable for RLS (RSK-10)');
      return { ok: false, roleLinked: false, reason: 'missing user_id — RLS would deny this login' };
    }
    let roleName = null;
    const { data: roleRows } = await admin
      .from('user_role').select('role_id').eq('user_id', userId).is('deleted_date', null);
    if (roleRows && roleRows.length) {
      const minRole = Math.min(...roleRows.map((r) => Number(r.role_id)));
      const { data: rm } = await admin
        .from('role_master').select('name').eq('role_id', minRole).single();
      roleName = rm && rm.name ? rm.name : null;
    }
    const row = { id: authUid, email: String(email).trim().toLowerCase(), user_id: userId };
    if (fullName) row.full_name = fullName;
    if (roleName) row.role = roleName;
    const { error } = await admin.from('profiles').upsert(row, { onConflict: 'id' });
    if (error) {
      console.error('[users] ensureProfileLink upsert failed:', error.message);
      return { ok: false, roleLinked: false, reason: error.message };
    }
    if (!roleName) {
      console.warn(`[users] ensureProfileLink: profile written but NO role resolved for user ${userId} (role-based policies will not apply)`);
      return { ok: true, roleLinked: false, reason: 'no role on user_role/role_master — role-based policies will not apply' };
    }
    return { ok: true, roleLinked: true };
  } catch (e) {
    console.error('[users] ensureProfileLink threw:', e.message);
    return { ok: false, roleLinked: false, reason: e.message };
  }
}

/* ── SMTP transporter (lazy — created once) ──────────────────────── */

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!GMAIL_USER || !GMAIL_PASS) {
    console.warn('[notify] GMAIL_USER / GMAIL_APP_PASSWORD not set — emails will not be sent.');
    return null;
  }
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // STARTTLS
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_PASS,
    },
  });
  return transporter;
}

/* ── Task reminder scanner (decision B: per-task email WITH a cap +
      opt-in daily digest, default OFF) ──────────────────────────────

   The scanner is a background job: it has NO logged-in user and therefore NO
   Supabase user JWT, so it cannot call PostgREST as a user (and must NOT route
   through POST /notify, which is gated by requireAuth). It uses the SERVICE-ROLE
   client (getSupabaseAdmin) to query/update the task table directly and sends
   mail in-process via buildEmail + getTransporter().sendMail — the same two calls
   the /notify handler makes internally.

   Resilience:
   - Every tick is wrapped in try/catch; a throw never crashes the process or
     stops future ticks.
   - A per-task failure logs + continues to the next task.
   - reminder_sent_at is set (so we never re-send) ONLY after the in-app
     notification insert succeeds. Policy rationale: the bell (in_app_notification)
     is our durable, must-not-lose channel; email is best-effort. If the bell
     insert fails we leave reminder_sent_at NULL so the next tick retries the whole
     task. If the bell succeeds but the email send fails we still mark it sent —
     the user has been notified in-app, and we deliberately do NOT retry just the
     email (retrying would re-fire the bell + risk Gmail throttling). An email send
     failure is logged for visibility.

   Heartbeat: lastScanAt is updated each tick and surfaced on /health so a stalled
   scanner is visible. */

const SCANNER_INTERVAL_MS = parseInt(process.env.TASK_SCAN_INTERVAL_MS || '60000', 10);
// Per-tick safety cap to protect Gmail from a burst of due tasks.
const TASK_SCAN_CAP = parseInt(process.env.TASK_SCAN_CAP || '40', 10);
const DIGEST_INTERVAL_MS = 5 * 60 * 1000; // check every 5 min whether it's digest time
// Digest send hour, in IST (24h). Default 08:00 IST.
const DIGEST_HOUR_IST = parseInt(process.env.TASK_DIGEST_HOUR_IST || '8', 10);

// Heartbeat state surfaced on /health.
const scannerState = {
  lastScanAt: null,         // ISO string of last completed per-task tick
  lastScanCount: 0,         // tasks processed in the last tick
  lastScanBacklog: 0,       // due-unsent reminders still waiting after this tick's cap
  lastScanError: null,      // last error message (or null)
  lastDigestRunAt: null,    // ISO string of last digest job run
  lastDigestDateIst: null,  // IST date (YYYY-MM-DD) the digest last sent for
};

// Re-entrancy guard: setInterval does NOT wait for the prior async tick, and a
// slow tick (many SMTP sends) can outrun the interval. Without this, two
// overlapping ticks both read the same still-unmarked tasks and double-fire the
// bell/email (review ALT-273B). Only one tick runs at a time; overlaps are skipped.
let scanInFlight = false;

/** Format an ISO/Date as a friendly IST string, e.g. "21 Jun 2026, 5:00 PM IST". */
function formatIst(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  try {
    const s = d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
    return `${s} IST`;
  } catch {
    return d.toISOString();
  }
}

/** Current IST calendar date as YYYY-MM-DD (en-CA gives ISO-style date). */
function istDateString(date) {
  const d = date || new Date();
  try {
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** Current hour (0-23) in IST. */
function istHour(date) {
  const d = date || new Date();
  try {
    const h = d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false });
    return parseInt(h, 10) % 24;
  } catch {
    return d.getUTCHours();
  }
}

/** Build the per-task deep link (CTA + in-app route point at /tasks). */
function taskRoute(_task) {
  return '/tasks';
}

/**
 * Resolve a user's email + display name from user_master by numeric user_id.
 * Mirrors resolveUserEmailAndName in the web app's lib/notify.ts.
 */
async function resolveOwnerEmailAndName(admin, userId) {
  if (!userId) return { email: '', name: '' };
  try {
    const { data } = await admin
      .from('user_master')
      .select('email, full_name, f_name')
      .eq('user_id', userId)
      .maybeSingle();
    if (!data) return { email: '', name: '' };
    return {
      email: data.email || '',
      name: data.full_name || data.f_name || '',
    };
  } catch (e) {
    console.error('[scanner] resolveOwnerEmailAndName failed:', e.message);
    return { email: '', name: '' };
  }
}

/**
 * Insert the bell (in_app_notification) row for a due task. Returns true on
 * success, false on failure. Uses the exact column shape the web app uses
 * (see web/src/lib/notify.ts notifyInApp): user_id, lead_id, meeting_id,
 * notif_descr, route, is_seen, status, created_by, created_date.
 */
async function insertTaskNotification(admin, task, ownerUserId) {
  try {
    const now = new Date().toISOString();
    const { error } = await admin.from('in_app_notification').insert({
      user_id: ownerUserId,
      lead_id: task.lead_id ?? null,
      meeting_id: task.meeting_id ?? null,
      notif_descr: `Task due: ${task.subject || 'A task'}`,
      route: taskRoute(task),
      is_seen: false,
      status: 'Task due',
      created_by: 'system',
      created_date: now,
    });
    if (error) {
      console.error(`[scanner] in_app_notification insert failed for task ${task.task_id}:`, error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[scanner] in_app_notification insert threw for task ${task.task_id}:`, e.message);
    return false;
  }
}

/** Send the per-task reminder email (best-effort). Returns true if sent. */
async function sendTaskReminderEmail(task, ownerEmail, ownerName) {
  const transport = getTransporter();
  if (!transport) return false; // SMTP not configured — bell still fires
  try {
    const data = {
      toName: (ownerName || '').split(' ')[0] || '',
      subject: task.subject || 'A task',
      taskType: task.task_type || 'TODO',
      dueLabel: formatIst(task.due_at),
      body: task.body || '',
      assocLabel: task.assoc_label || '',
      assocPhone: task.assoc_phone || '',
      priority: task.priority || '',
      ctaUrl: undefined, // template falls back to APP_URL + /tasks via default
    };
    const { subject, html } = buildEmail('task_reminder', data);
    const info = await transport.sendMail({
      from: `"AltLeads · Amplior CRM" <${GMAIL_USER}>`,
      to: ownerEmail,
      subject,
      html,
    });
    console.log(`[scanner] reminder email sent for task ${task.task_id} -> ${ownerEmail} (messageId ${info.messageId})`);
    logEmail({ to: ownerEmail, type: 'task_reminder', subject, status: 'sent', messageId: info.messageId });
    return true;
  } catch (e) {
    console.error(`[scanner] reminder email FAILED for task ${task.task_id} -> ${ownerEmail}:`, e.message);
    logEmail({ to: ownerEmail, type: 'task_reminder', status: 'failed', error: e.message });
    return false;
  }
}

/**
 * One per-task scan tick. Selects due, unsent, OPEN, non-deleted tasks (capped),
 * and for each: bell insert -> mark sent -> email. Wrapped by the caller in a
 * try/catch; also guards each task individually so one bad row never blocks the rest.
 */
async function runTaskScanTick() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    scannerState.lastScanError = 'Supabase env vars not set';
    return;
  }
  const nowIso = new Date().toISOString();
  const { data: tasks, error } = await admin
    .from('task')
    .select('task_id, task_type, subject, body, priority, owner_user_id, due_at, reminder_at, lead_id, company_id, contact_id, meeting_id, assoc_label, assoc_phone')
    .eq('status', 'OPEN')
    .is('deleted_date', null)
    .is('reminder_sent_at', null)
    .not('reminder_at', 'is', null)
    .lte('reminder_at', nowIso)
    .order('reminder_at', { ascending: true })
    .limit(TASK_SCAN_CAP);

  if (error) {
    scannerState.lastScanError = error.message;
    console.error('[scanner] task query failed:', error.message);
    return;
  }

  let processed = 0;
  for (const task of tasks || []) {
    try {
      if (!task.owner_user_id) {
        console.warn(`[scanner] task ${task.task_id} has no owner_user_id — skipping.`);
        continue;
      }
      const { email, name } = await resolveOwnerEmailAndName(admin, task.owner_user_id);

      // 1) Bell first — our durable channel. If this fails, leave reminder_sent_at
      //    NULL so the next tick retries the whole task.
      const bellOk = await insertTaskNotification(admin, task, task.owner_user_id);
      if (!bellOk) continue;

      // 2) Mark sent immediately after the bell succeeds, so a later email failure
      //    (or a crash mid-send) can never cause a duplicate bell on the next tick.
      const { error: markErr } = await admin
        .from('task')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('task_id', task.task_id)
        .is('reminder_sent_at', null); // idempotency guard against a concurrent tick
      if (markErr) {
        console.error(`[scanner] failed to set reminder_sent_at for task ${task.task_id}:`, markErr.message);
        // Bell already fired but we couldn't mark sent — do NOT also send email,
        // and let the next tick's bell-then-mark retry settle it. Continue.
        continue;
      }

      // 3) Email — best effort. A failure here is logged but does NOT un-mark the task.
      if (email) {
        await sendTaskReminderEmail(task, email, name);
      } else {
        console.warn(`[scanner] task ${task.task_id}: owner ${task.owner_user_id} has no email — bell sent, email skipped.`);
      }
      processed++;
    } catch (taskErr) {
      // Never let one task abort the tick.
      console.error(`[scanner] error processing task ${task.task_id}:`, taskErr.message);
    }
  }

  // Backlog visibility (review ALT-273B): the per-tick cap (TASK_SCAN_CAP) bounds how
  // many reminders one tick sends, so a burst above the cap is NOT dropped but fires
  // over several ticks. Surface the count of due-unsent reminders still waiting so an
  // operator can see (on /health) when arrivals are outrunning the drain rate.
  const { count: backlog, error: backlogErr } = await admin
    .from('task')
    .select('task_id', { count: 'exact', head: true })
    .eq('status', 'OPEN')
    .is('deleted_date', null)
    .is('reminder_sent_at', null)
    .not('reminder_at', 'is', null)
    .lte('reminder_at', new Date().toISOString());
  scannerState.lastScanBacklog = backlogErr ? -1 : (backlog ?? 0);
  if (!backlogErr && backlog > 0) {
    console.log(`[scanner] ${backlog} due reminder(s) still waiting (cap ${TASK_SCAN_CAP}/tick).`);
  }

  scannerState.lastScanAt = new Date().toISOString();
  scannerState.lastScanCount = processed;
  scannerState.lastScanError = null;
  if (processed > 0) console.log(`[scanner] tick complete — ${processed} task reminder(s) dispatched.`);
}

/** Wrapper that guarantees a throw can never stop the interval, and that two
 *  ticks never overlap (re-entrancy guard — review ALT-273B bell double-fire). */
async function safeRunTaskScanTick() {
  if (scanInFlight) {
    console.warn('[scanner] previous tick still running — skipping this interval.');
    return;
  }
  scanInFlight = true;
  try {
    await runTaskScanTick();
  } catch (e) {
    scannerState.lastScanError = e.message;
    console.error('[scanner] tick threw (suppressed — scanner continues):', e);
  } finally {
    scanInFlight = false;
  }
}

/** Read the persisted last-run IST date for a job (null if absent / on error). */
async function getJobLastDateIst(admin, jobName) {
  try {
    const { data, error } = await admin
      .from('task_job_run')
      .select('last_date_ist')
      .eq('job_name', jobName)
      .maybeSingle();
    if (error) { console.error(`[digest] task_job_run read failed (${jobName}):`, error.message); return null; }
    return data ? data.last_date_ist : null;
  } catch (e) {
    console.error(`[digest] task_job_run read threw (${jobName}):`, e.message);
    return null;
  }
}

/** Persist the last-run IST date for a job (best-effort; logged on failure). */
async function setJobLastDateIst(admin, jobName, dateIst) {
  try {
    const { error } = await admin
      .from('task_job_run')
      .upsert({ job_name: jobName, last_date_ist: dateIst, updated_at: new Date().toISOString() }, { onConflict: 'job_name' });
    if (error) console.error(`[digest] task_job_run write failed (${jobName}):`, error.message);
  } catch (e) {
    console.error(`[digest] task_job_run write threw (${jobName}):`, e.message);
  }
}

/**
 * Daily digest job (decision B: OPT-IN, default OFF). Runs once per IST calendar
 * day at ~DIGEST_HOUR_IST. For each user with task_user_pref.daily_digest_opt_in =
 * true, sends ONE email listing their OPEN tasks due today (IST) or overdue.
 * Dedup is BOTH in-memory (fast path) AND persisted in public.task_job_run so a
 * deploy/crash/restart after the digest hour can't re-blast the same day's digest
 * (review ALT-273B M6). If task_job_run doesn't exist yet (migration not applied),
 * the DB helpers degrade to null and the in-memory guard still applies.
 */
async function runDailyDigest() {
  const admin = getSupabaseAdmin();
  if (!admin) return;

  const todayIst = istDateString();
  // Only run once it's at/after the target hour, and only once per IST day.
  if (istHour() < DIGEST_HOUR_IST) return;
  if (scannerState.lastDigestDateIst === todayIst) return;

  // Durable guard: the in-memory flag resets on restart, so also check the persisted
  // last-run date. If today's digest already ran (e.g. before a redeploy), sync the
  // in-memory flag and skip — no second blast.
  const persistedDate = await getJobLastDateIst(admin, 'daily_digest');
  if (persistedDate === todayIst) {
    scannerState.lastDigestDateIst = todayIst;
    return;
  }

  // 1) Opted-in users (strict gate — default false => no digest).
  const { data: prefs, error: prefErr } = await admin
    .from('task_user_pref')
    .select('user_id')
    .eq('daily_digest_opt_in', true);
  if (prefErr) {
    console.error('[digest] task_user_pref query failed:', prefErr.message);
    return;
  }

  // Mark the day handled up front, in-memory AND durably, so neither a mid-run crash
  // nor a process restart re-sends today's digest.
  scannerState.lastDigestDateIst = todayIst;
  scannerState.lastDigestRunAt = new Date().toISOString();
  await setJobLastDateIst(admin, 'daily_digest', todayIst);

  if (!prefs || prefs.length === 0) {
    console.log('[digest] no opted-in users today.');
    return;
  }

  // End of today in IST, expressed as an absolute instant: anything due at/before
  // this is "due today or overdue". (IST = UTC+5:30, no DST.)
  const endOfTodayIstIso = new Date(`${todayIst}T23:59:59+05:30`).toISOString();
  const transport = getTransporter();

  for (const pref of prefs) {
    try {
      const { data: tasks, error: tErr } = await admin
        .from('task')
        .select('task_id, subject, due_at, assoc_label')
        .eq('owner_user_id', pref.user_id)
        .eq('status', 'OPEN')
        .is('deleted_date', null)
        .lte('due_at', endOfTodayIstIso)
        .order('due_at', { ascending: true });
      if (tErr) {
        console.error(`[digest] task query failed for user ${pref.user_id}:`, tErr.message);
        continue;
      }
      if (!tasks || tasks.length === 0) continue; // nothing to summarize

      const { email, name } = await resolveOwnerEmailAndName(admin, pref.user_id);
      if (!email) {
        console.warn(`[digest] user ${pref.user_id} opted in but has no email — skipping.`);
        continue;
      }
      if (!transport) continue;

      const nowMs = Date.now();
      const items = tasks.map((t) => ({
        subject: t.subject || 'Task',
        dueLabel: formatIst(t.due_at),
        assocLabel: t.assoc_label || '',
        overdue: t.due_at ? new Date(t.due_at).getTime() < nowMs : false,
      }));
      const { subject, html } = buildEmail('task_digest', {
        toName: (name || '').split(' ')[0] || '',
        tasks: items,
        dateLabel: formatIst(new Date()).split(',')[0], // just the date part
      });
      const info = await transport.sendMail({
        from: `"AltLeads · Amplior CRM" <${GMAIL_USER}>`,
        to: email,
        subject,
        html,
      });
      console.log(`[digest] sent to ${email} (${items.length} task(s), messageId ${info.messageId})`);
      logEmail({ to: email, type: 'daily_digest', subject, status: 'sent', messageId: info.messageId });
    } catch (uErr) {
      console.error(`[digest] error for user ${pref.user_id}:`, uErr.message);
      logEmail({ type: 'daily_digest', status: 'failed', error: uErr.message });
    }
  }
}

/** Wrapper so a digest throw can never stop the interval. */
async function safeRunDailyDigest() {
  try {
    await runDailyDigest();
  } catch (e) {
    console.error('[digest] run threw (suppressed — job continues):', e);
  }
}

/* ── Auth middleware ─────────────────────────────────────────────── */
/**
 * Verifies a Supabase JWT from the Authorization: Bearer <token> header.
 * On success attaches the verified auth uid to req.actorUserId and calls next().
 *
 * requireAuth  — accepts ANY valid Supabase JWT.
 * requireAdmin — additionally requires the caller's profiles.role === 'ADMIN'.
 */
async function requireAuth(req, res, next) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: 'Supabase env vars not set (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)' });
  }
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing token' });
  let user, error;
  try {
    ({ data: { user }, error } = await admin.auth.getUser(token));
  } catch (e) {
    return res.status(503).json({ error: 'auth check failed' });
  }
  if (error || !user) return res.status(401).json({ error: 'invalid token' });
  req.actorUserId = user.id;
  next();
}

async function requireAdmin(req, res, next) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: 'Supabase env vars not set (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)' });
  }
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing token' });
  try {
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'invalid token' });
    const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).single();
    if (!prof || prof.role !== 'ADMIN') return res.status(403).json({ error: 'admin only' });
    req.actorUserId = user.id;
    next();
  } catch (e) {
    return res.status(503).json({ error: 'auth check failed' });
  }
}

/* ── Rate limiter (30 req / min / IP) ────────────────────────────── */

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

/* ── Express app ─────────────────────────────────────────────────── */

const app = express();

/* Security headers. Helmet defaults plus an explicit, conservative CSP that
   still allows the SPA, Supabase (REST + Realtime websockets) and the
   same-origin API. */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Vite-built bundles are self-hosted; allow inline styles for the SPA.
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'data:'],
      // Same-origin API + Supabase REST/Realtime (https + wss).
      connectSrc: ["'self'", 'https:', 'wss:'],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
// Belt-and-braces explicit headers (in case CSP is relaxed by a proxy).
app.use((_req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.use(cors({
  origin: ALLOWED_ORIGIN,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

/* 32kb default body cap; /api/email/send alone allows 12mb for base64
   attachments (ALT-509 — ~7MB of files ≈ 9.5MB encoded). */
const smallJson = express.json({ limit: '32kb' });
const emailJson = express.json({ limit: '12mb' });
app.use((req, res, next) => (req.path === '/api/email/send' ? emailJson : smallJson)(req, res, next));

// Throttle the email + user-management endpoints.
app.use('/notify', apiLimiter);
app.use('/api/', apiLimiter);

/* ── GET /health ─────────────────────────────────────────────────── */

app.get('/health', (_req, res) => {
  const last = scannerState.lastScanAt;
  const ageSec = last ? Math.round((Date.now() - new Date(last).getTime()) / 1000) : null;
  // The scanner ticks every SCANNER_INTERVAL_MS; flag it stale if no successful
  // tick in ~3 intervals (e.g. process restarted but timer never resumed).
  const staleThresholdSec = Math.round((SCANNER_INTERVAL_MS * 3) / 1000);
  const scannerStale = last == null || (ageSec != null && ageSec > staleThresholdSec);
  res.json({
    ok: true,
    service: 'amplior-notify',
    ts: new Date().toISOString(),
    build: BUILD_INFO,
    scanner: {
      last_scan_at: last,
      last_scan_age_seconds: ageSec,
      last_scan_count: scannerState.lastScanCount,
      last_scan_backlog: scannerState.lastScanBacklog, // due-unsent reminders still waiting (-1 = count failed)
      cap_per_tick: TASK_SCAN_CAP,
      last_scan_error: scannerState.lastScanError,
      interval_ms: SCANNER_INTERVAL_MS,
      stale: scannerStale,
      last_digest_run_at: scannerState.lastDigestRunAt,
      last_digest_date_ist: scannerState.lastDigestDateIst,
    },
  });
});

/* ── POST /notify ────────────────────────────────────────────────── */
/**
 * Body: { event: string, to: string, data: object }
 * Response: { ok: true, id: string } | { ok: false, error: string }
 */
app.post('/notify', requireAuth, async (req, res) => {
  const { event, to, data = {} } = req.body || {};

  if (!event || !to) {
    return res.status(400).json({ ok: false, error: 'event and to are required' });
  }

  // "to" must be exactly ONE well-formed email address. Reject comma-lists,
  // arrays, or anything containing whitespace/multiple recipients.
  const recipient = String(to).trim();
  const singleEmailRegex = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
  if (!singleEmailRegex.test(recipient)) {
    return res.status(400).json({ ok: false, error: 'to must be a single valid email address' });
  }

  const transport = getTransporter();
  if (!transport) {
    console.error('[notify] No transporter — SMTP credentials missing.');
    return res.status(503).json({ ok: false, error: 'SMTP not configured' });
  }

  try {
    const { subject, html } = buildEmail(event, data);

    const info = await transport.sendMail({
      from: `"AltLeads · Amplior CRM" <${GMAIL_USER}>`,
      to: recipient,
      subject,
      html,
    });

    console.log(`[notify] Sent ${event} to ${recipient} — messageId: ${info.messageId}`);
    logEmail({ to: recipient, type: event, subject, status: 'sent', messageId: info.messageId,
               leadId: data?.lead_id ?? null, reportId: data?.report_id ?? null, meetingId: data?.meeting_id ?? null });
    return res.json({ ok: true, id: info.messageId });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[notify] Failed to send ${event} to ${recipient}:`, msg);
    logEmail({ to: recipient, type: event, status: 'failed', error: msg });
    // Don't expose internal SMTP errors to the caller in production
    return res.status(500).json({ ok: false, error: 'Email send failed' });
  }
});

/* ── POST /api/users/create ──────────────────────────────────────── */
/**
 * Auth: requireAdmin (valid Supabase JWT belonging to a profiles.role==='ADMIN').
 * Body: { full_name, email, role_id, mobile_number? }
 *   (created_by is IGNORED — derived from the verified caller.)
 * Response 200: { ok: true, user_id: number, tempPassword: string }
 * Response 400: { error: string }  (validation)
 * Response 409: { error: string }  (duplicate email)
 * Response 500: { error: string }  (DB / auth failure)
 * Response 503: { error: string }  (missing env vars)
 */
app.post('/api/users/create', requireAdmin, async (req, res) => {
  const { full_name, email, role_id, mobile_number } = req.body || {};

  /* 1. Validate */
  if (!full_name || !String(full_name).trim()) {
    return res.status(400).json({ error: 'full_name is required.' });
  }
  if (!email || !String(email).trim()) {
    return res.status(400).json({ error: 'email is required.' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(String(email).trim())) {
    return res.status(400).json({ error: 'email format is invalid.' });
  }
  if (role_id === undefined || role_id === null || role_id === '') {
    return res.status(400).json({ error: 'role_id is required.' });
  }
  if (typeof role_id !== 'number' && typeof role_id !== 'string') {
    return res.status(400).json({ error: 'role_id must be a number.' });
  }
  const roleIdInt = parseInt(role_id, 10);
  if (isNaN(roleIdInt) || roleIdInt < 1 || roleIdInt > 6) {
    return res.status(400).json({ error: 'role_id must be an integer between 1 and 6.' });
  }
  if (mobile_number != null && String(mobile_number).trim().length > 20) {
    return res.status(400).json({ error: 'mobile_number is too long.' });
  }

  /* 2. Shared service-role admin client (requireAdmin already verified env). */
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase env vars not set (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)' });
  }

  const trimmedEmail = String(email).trim().toLowerCase();
  const trimmedName = String(full_name).trim();

  try {
  /* 3. Derive created_by from the VERIFIED caller — look up the numeric
        user_id from profiles by the auth uid. Never trust req.body.created_by. */
  let actor = 'system';
  const { data: actorProfile } = await supabaseAdmin
    .from('profiles')
    .select('user_id')
    .eq('id', req.actorUserId)
    .single();
  if (actorProfile && actorProfile.user_id !== undefined && actorProfile.user_id !== null) {
    actor = String(actorProfile.user_id);
  }

  /* 4. Check for existing user */
  const { data: existing } = await supabaseAdmin
    .from('user_master')
    .select('user_id')
    .eq('email', trimmedEmail)
    .limit(1);
  if (existing && existing.length > 0) {
    return res.status(409).json({ error: 'A user with this email already exists.' });
  }

  /* 5. Split full_name into f_name / l_name */
  const spaceIdx = trimmedName.indexOf(' ');
  const fName = spaceIdx === -1 ? trimmedName : trimmedName.slice(0, spaceIdx);
  const lName = spaceIdx === -1 ? '' : trimmedName.slice(spaceIdx + 1).trim();

  /* 6. INSERT into user_master */
  const { data: insertedUsers, error: insertErr } = await supabaseAdmin
    .from('user_master')
    .insert({
      full_name: trimmedName,
      f_name: fName,
      l_name: lName || null,
      email: trimmedEmail,
      enabled: true,
      mobile_number: mobile_number ? String(mobile_number).trim() : null,
      created_by: actor,
      created_date: new Date().toISOString(),
    })
    .select('user_id');

  if (insertErr || !insertedUsers || insertedUsers.length === 0) {
    const msg = insertErr ? insertErr.message : 'user_master insert returned no row';
    console.error('[users/create] user_master insert failed:', msg);
    return res.status(500).json({ error: 'Failed to create user record.' });
  }
  const newUser = insertedUsers[0];

  /* 7. INSERT into user_role */
  const { error: roleErr } = await supabaseAdmin
    .from('user_role')
    .insert({
      user_id: newUser.user_id,
      role_id: roleIdInt,
      created_by: actor,
      created_date: new Date().toISOString(),
    });

  if (roleErr) {
    // Best-effort cleanup
    await supabaseAdmin.from('user_master').delete().eq('user_id', newUser.user_id);
    console.error('[users/create] user_role insert failed:', roleErr.message);
    return res.status(500).json({ error: 'Failed to assign role.' });
  }

  /* 8. Generate temp password */
  const tempPassword = genTempPassword();

  /* 9. Create Supabase Auth user */
  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email: trimmedEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: trimmedName },
  });

  /* 10. If auth creation fails: cleanup and return 500 */
  if (authErr || !authData?.user) {
    const msg = authErr ? authErr.message : 'Auth user creation returned no user';
    console.error('[users/create] auth.admin.createUser failed:', msg);
    // Best-effort cleanup
    await supabaseAdmin.from('user_role').delete().eq('user_id', newUser.user_id);
    await supabaseAdmin.from('user_master').delete().eq('user_id', newUser.user_id);
    return res.status(500).json({ error: 'Failed to create auth user.' });
  }

  /* 10b. Explicitly link auth uid -> numeric user_id in profiles. Don't rely on
     the email-matching onboarding trigger — guarantee the link so reset-password,
     RLS (current_user_id/is_admin) and the created_by audit all work immediately. */
  const link = await ensureProfileLink(supabaseAdmin, {
    authUid: authData.user.id,
    userId: newUser.user_id,
    email: trimmedEmail,
    fullName: trimmedName,
  });
  if (!link.ok) {
    console.error(`[users/create] profile link FAILED for user ${newUser.user_id}: ${link.reason} — this login would be denied edits under RLS (RSK-10)`);
  }

  console.log(`[users/create] Created user ${newUser.user_id} (${trimmedEmail}) with role ${roleIdInt}`);

  /* 11. Return success — report profile-link coverage honestly (RSK-10) so a bulk
     run can detect any login that would be silently denied edits under RLS. */
  return res.status(200).json({
    ok: true, user_id: newUser.user_id, tempPassword,
    profileLinked: link.ok,
    ...(link.reason ? { profileWarning: link.reason } : {}),
  });
  } catch (e) {
    console.error('[users/create]', e);
    return res.status(500).json({ error: 'Failed to create user' });
  }
});

/* ── POST /api/users/reset-password ─────────────────────────────── */
/**
 * Set or reset a user's login password (admin only).
 *
 * Auth: requireAdmin (valid Supabase JWT belonging to a profiles.role==='ADMIN').
 * Body: { user_id } (bigint/number) and/or { email }
 *
 * Behaviour: resolves the user's email from user_master, then finds their
 * Supabase Auth account by email.
 *   - If a login exists  -> reset its password.
 *   - If NO login exists -> CREATE one with the new password (most legacy users
 *     migrated from the old system have no login yet; this is how an admin grants
 *     access). Either way we (re)link profiles so RLS works immediately.
 *
 * Response 200: { ok: true, tempPassword: string, created: boolean }
 * Response 400/404: { error }   500: { error }   503: { error } (missing env)
 */
app.post('/api/users/reset-password', requireAdmin, async (req, res) => {
  const { user_id, email } = req.body || {};

  /* 1. Validate — need at least user_id or email */
  if ((user_id === undefined || user_id === null || user_id === '') && !email) {
    return res.status(400).json({ error: 'user_id is required.' });
  }

  /* 2. Shared service-role admin client (requireAdmin already verified env). */
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase env vars not set (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)' });
  }

  try {
  /* 3. Resolve the user's email + numeric id + name from user_master. The email
        (not a fragile profiles link) is the authoritative key to the auth account. */
  let targetUserId = (user_id !== undefined && user_id !== null && user_id !== '') ? user_id : null;
  let targetEmail = email ? String(email).trim().toLowerCase() : null;
  let fullName = null;
  if (targetUserId !== null) {
    const { data: um } = await supabaseAdmin
      .from('user_master').select('user_id, email, full_name').eq('user_id', targetUserId).single();
    if (um) {
      if (um.email) targetEmail = String(um.email).trim().toLowerCase();
      fullName = um.full_name || null;
    }
  } else if (targetEmail) {
    const { data: um } = await supabaseAdmin
      .from('user_master').select('user_id, full_name').eq('email', targetEmail).limit(1).maybeSingle();
    if (um) { targetUserId = um.user_id; fullName = um.full_name || null; }
  }
  if (!targetEmail) {
    return res.status(404).json({ error: 'This user has no email on file — add an email before setting a password.' });
  }

  /* 4. Strong temp password. */
  const tempPassword = genTempPassword();

  /* 5. Find an existing auth account by email; reset it, or create a fresh login. */
  const existingAuth = await findAuthUserByEmail(supabaseAdmin, targetEmail);
  let authUid;
  let created = false;
  if (existingAuth) {
    authUid = existingAuth.id;
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(authUid, {
      password: tempPassword,
      email_confirm: true,
    });
    if (updateErr) {
      console.error('[users/reset-password] updateUserById failed:', updateErr.message);
      return res.status(500).json({ error: 'Failed to set password.' });
    }
  } else {
    const { data: authData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: targetEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: fullName ? { full_name: fullName } : undefined,
    });
    if (createErr || !authData?.user) {
      const msg = createErr ? createErr.message : 'auth user creation returned no user';
      console.error('[users/reset-password] createUser failed:', msg);
      return res.status(500).json({ error: 'Failed to set password.' });
    }
    authUid = authData.user.id;
    created = true;
  }

  /* 6. (Re)link the auth account to the numeric user_id so RLS + future resets work. */
  const link = await ensureProfileLink(supabaseAdmin, { authUid, userId: targetUserId, email: targetEmail, fullName });
  if (!link.ok) {
    console.error(`[users/reset-password] profile link FAILED for user ${targetUserId}: ${link.reason} — this login would be denied edits under RLS (RSK-10)`);
  }

  console.log(`[users/reset-password] ${created ? 'Created login + set' : 'Reset'} password for ${targetEmail} (user_id=${targetUserId}, auth uid=${authUid})`);

  /* 7. Return success — report profile-link coverage honestly (RSK-10). */
  return res.status(200).json({
    ok: true, tempPassword, created,
    profileLinked: link.ok,
    ...(link.reason ? { profileWarning: link.reason } : {}),
  });
  } catch (err) {
    console.error('[users/reset-password] unexpected error:', err);
    return res.status(500).json({ error: 'Failed to set password.' });
  }
});

/* ── GET /api/admin/login-coverage ──────────────────────────────── */
/**
 * READ-ONLY coverage report to detect RSK-10 exposure: provisioned logins that
 * would resolve current_user_id() = NULL under assignee-RLS and therefore be
 * SILENTLY denied ALL edits. (See ensureProfileLink above for the mechanism:
 * RLS resolves the caller via the profiles row keyed by auth uid; a login whose
 * profiles row is MISSING or has a NULL user_id -> current_user_id() = NULL ->
 * every write policy is false.)
 *
 * This endpoint performs NO writes, sends NO email, and provisions NOTHING — it
 * only counts. Auth: requireAdmin (same guard as /api/users/* — a valid Supabase
 * JWT whose profiles.role === 'ADMIN').
 *
 * Returns:
 *   activeUsers          — user_master rows that are not soft-deleted and have an email
 *   profiles             — total profiles rows
 *   profilesNullUserId   — profiles with NULL user_id (RSK-10 exposed)
 *   profilesNullRole     — profiles with NULL/empty role (role-based policies won't apply)
 *   usersWithoutLogin    — auth users with NO matching profiles row (RSK-10 exposed)
 *   exposureCount        — size of the RSK-10 exposure set (logins resolving to NULL user_id)
 *   sampleExposedUserIds — up to 20 numeric user_ids only (NO emails / PII)
 *
 * Response 200: { ...counts }   503: { error } (missing env)   500: { error }
 */
app.get('/api/admin/login-coverage', requireAdmin, async (req, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase env vars not set (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)' });
  }

  try {
    /* 1. Active users in user_master: not soft-deleted (deleted_date IS NULL) and
          has a non-empty email. Count-only (head:true) — no rows pulled. */
    const { count: activeUsers, error: auErr } = await supabaseAdmin
      .from('user_master')
      .select('user_id', { count: 'exact', head: true })
      .is('deleted_date', null)
      .not('email', 'is', null)
      .neq('email', '');
    if (auErr) {
      console.error('[login-coverage] user_master count failed:', auErr.message);
      return res.status(500).json({ error: 'Failed to count users.' });
    }

    /* 2. profiles total + NULL user_id + NULL/empty role (count-only). */
    const { count: profiles, error: pErr } = await supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true });
    if (pErr) {
      console.error('[login-coverage] profiles count failed:', pErr.message);
      return res.status(500).json({ error: 'Failed to count profiles.' });
    }
    const { count: profilesNullUserId, error: pnuErr } = await supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .is('user_id', null);
    if (pnuErr) {
      console.error('[login-coverage] profiles NULL user_id count failed:', pnuErr.message);
      return res.status(500).json({ error: 'Failed to count profiles.' });
    }
    // role is text — NULL/empty both mean role-based policies won't apply.
    const { count: profilesNullRole, error: pnrErr } = await supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .or('role.is.null,role.eq.');
    if (pnrErr) {
      console.error('[login-coverage] profiles NULL role count failed:', pnrErr.message);
      return res.status(500).json({ error: 'Failed to count profiles.' });
    }

    /* 3. Build the set of auth uids that DO have a profiles row, plus the sample
          of exposed numeric user_ids (profiles with a user_id but NULL —> caught
          above; here we collect ids for the report sample without pulling PII).
          We page profiles fully (id + user_id only, no email) so we can compare
          against the auth-user list. */
    const profileAuthIds = new Set();
    const exposedSample = [];   // up to 20 numeric user_ids (profiles with NULL user_id have none to show)
    {
      const PAGE = 1000;
      for (let from = 0; from < 200000; from += PAGE) {
        const { data: rows, error: rErr } = await supabaseAdmin
          .from('profiles')
          .select('id, user_id')
          .range(from, from + PAGE - 1);
        if (rErr) {
          console.error('[login-coverage] profiles page read failed:', rErr.message);
          return res.status(500).json({ error: 'Failed to read profiles.' });
        }
        if (!rows || rows.length === 0) break;
        for (const r of rows) {
          if (r.id) profileAuthIds.add(r.id);
        }
        if (rows.length < PAGE) break;
      }
    }

    /* 4. Page through Supabase Auth users (same listUsers pattern as
          findAuthUserByEmail) and count those WITHOUT a matching profiles row.
          These are provisioned logins that resolve current_user_id() = NULL. */
    let usersWithoutLogin = 0; // auth users that have NO profiles row
    let authListAvailable = true;
    try {
      for (let page = 1; page <= 50; page++) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error || !data) { authListAvailable = false; break; }
        const users = data.users || [];
        for (const u of users) {
          if (!profileAuthIds.has(u.id)) usersWithoutLogin++;
        }
        if (users.length < 1000) break; // last page
      }
    } catch (e) {
      console.error('[login-coverage] auth.admin.listUsers failed:', e.message);
      authListAvailable = false;
    }

    /* 5. Sample exposed user_ids — provisioned user_master rows that are active but
          whose profiles link is unusable (no profiles row, or profiles.user_id NULL)
          would be denied edits. We surface a small sample of NUMERIC user_ids only
          (NO emails/PII): user_master active users that have a user_id but no
          profiles row carrying that user_id. We collect via a single capped read. */
    const linkedUserIds = new Set();
    {
      const PAGE = 1000;
      for (let from = 0; from < 200000; from += PAGE) {
        const { data: rows, error: rErr } = await supabaseAdmin
          .from('profiles')
          .select('user_id')
          .not('user_id', 'is', null)
          .range(from, from + PAGE - 1);
        if (rErr) break; // best-effort sample; counts above are authoritative
        if (!rows || rows.length === 0) break;
        for (const r of rows) if (r.user_id != null) linkedUserIds.add(Number(r.user_id));
        if (rows.length < PAGE) break;
      }
    }
    {
      const PAGE = 1000;
      for (let from = 0; from < 200000 && exposedSample.length < 20; from += PAGE) {
        const { data: rows, error: rErr } = await supabaseAdmin
          .from('user_master')
          .select('user_id')
          .is('deleted_date', null)
          .not('email', 'is', null)
          .neq('email', '')
          .range(from, from + PAGE - 1);
        if (rErr) break;
        if (!rows || rows.length === 0) break;
        for (const r of rows) {
          if (exposedSample.length >= 20) break;
          if (r.user_id != null && !linkedUserIds.has(Number(r.user_id))) {
            exposedSample.push(Number(r.user_id));
          }
        }
        if (rows.length < PAGE) break;
      }
    }

    /* 6. RSK-10 exposure set = provisioned logins that resolve current_user_id()
          = NULL. Two disjoint sources: (a) auth users with no profiles row, and
          (b) profiles rows with a NULL user_id. Both fail current_user_id(). */
    const exposureCount = (Number(usersWithoutLogin) || 0) + (Number(profilesNullUserId) || 0);

    return res.status(200).json({
      activeUsers: activeUsers ?? 0,
      profiles: profiles ?? 0,
      profilesNullUserId: profilesNullUserId ?? 0,
      profilesNullRole: profilesNullRole ?? 0,
      usersWithoutLogin,
      exposureCount,
      sampleExposedUserIds: exposedSample,
      // Limitation flag: if the Supabase Auth admin list wasn't available, the
      // usersWithoutLogin/exposureCount auth-side numbers are best-effort.
      ...(authListAvailable ? {} : { authListUnavailable: true }),
    });
  } catch (e) {
    console.error('[login-coverage]', e);
    return res.status(500).json({ error: 'Failed to compute login coverage.' });
  }
});

/* ── Email sending: domains + per-user send (ALT-503/506, ADR-35) ── */
const emailSending = require('./src/emailSending');
emailSending.mount(app, getSupabaseAdmin, { requireAuth, requireAdmin, getTransporter, GMAIL_USER, logEmail });

/* ── Write gateway (ALT-431) ─────────────────────────────────────── */
// Mounts POST /api/write — server-side write gatekeeper.  Must come AFTER the
// existing /api/* routes (rate limiter already covers /api/) but BEFORE static
// serving so the route is not shadowed by the SPA catch-all.
const writeGateway = require('./src/writeGateway');
writeGateway.mount(app, getSupabaseAdmin);

/* ── Serve React web app (static + SPA fallback) ─────────────────── */
// Serve built assets. Must come AFTER all API routes so /health and /notify
// are handled by the Express routes above, not treated as static file requests.

app.use(express.static(WEB_DIST));

// SPA catch-all: any GET that didn't match an API route or a real static file
// returns index.html so that client-side routes (React Router) work correctly.
app.get('*', (_req, res) => {
  res.sendFile(path.join(WEB_DIST, 'index.html'));
});

/* ── Start ───────────────────────────────────────────────────────── */

app.listen(PORT, () => {
  console.log(`[notify] Amplior notify-service listening on http://localhost:${PORT}`);
  console.log(`[notify] CORS allowed origin: ${ALLOWED_ORIGIN}`);
  if (!GMAIL_USER || !GMAIL_PASS) {
    console.warn('[notify] WARNING: GMAIL credentials not set — POST /notify will return 503');
  }

  /* ── Start the task reminder scanner + daily digest job ──────────
     Both are in-process timers (no OS cron / external infra needed). They use
     the service-role Supabase client. Each tick is individually wrapped so a
     throw can never crash the server or stop future ticks. Skipped entirely if
     Supabase env vars are missing (nothing to scan). */
  if (!getSupabaseAdmin()) {
    console.warn('[scanner] Supabase env vars not set — task reminder scanner DISABLED.');
  } else {
    console.log(`[scanner] task reminder scanner ON — every ${SCANNER_INTERVAL_MS}ms, cap ${TASK_SCAN_CAP}/tick.`);
    console.log(`[digest] daily digest job ON — opt-in only, target ~${DIGEST_HOUR_IST}:00 IST.`);
    // Hydrate the in-memory digest guard from the durable store so a restart after
    // today's digest already ran doesn't re-blast it (review ALT-273B M6).
    void (async () => {
      const persisted = await getJobLastDateIst(getSupabaseAdmin(), 'daily_digest');
      if (persisted) {
        scannerState.lastDigestDateIst = persisted;
        console.log(`[digest] hydrated last-run date from task_job_run: ${persisted}`);
      }
    })();
    // Run an initial tick shortly after boot (catch up on anything due during
    // any downtime), then on the interval.
    setTimeout(() => { void safeRunTaskScanTick(); }, 5000);
    setInterval(() => { void safeRunTaskScanTick(); }, SCANNER_INTERVAL_MS);
    setInterval(() => { void safeRunDailyDigest(); }, DIGEST_INTERVAL_MS);
  }
});
