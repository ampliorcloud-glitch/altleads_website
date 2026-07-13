'use strict';

/**
 * eventBus.js — transactional outbox emitter + worker skeleton
 *
 * Part of the automation-rails v0 foundation (event spine).
 * See docs/product/AUTOMATION-EVENT-SPINE.md for full architecture.
 *
 * ── EXPORTS ────────────────────────────────────────────────────────────
 *
 *   emitEvent(supabaseAdmin, opts) → Promise<void>
 *     Insert an event_outbox row in the same logical flow as a domain write.
 *     Best-effort: a failure logs but never throws (never blocks the domain op).
 *
 *   startOutboxWorker(supabaseAdmin, opts?) → void
 *     Start the polling worker that claims pending rows and dispatches them
 *     to registered handlers.  OPT-IN: only starts if
 *     process.env.ENABLE_OUTBOX_WORKER === 'true'.  Do NOT call this in
 *     server.js yet — see the TODO comment at the bottom of server.js.
 *
 * ── HOW TO REGISTER A HANDLER (when v1 automation ships) ──────────────
 *
 *   Import HANDLERS and add an entry keyed by event_type:
 *
 *     const { HANDLERS } = require('./eventBus');
 *     HANDLERS['lead.stage_changed'] = async (admin, row) => {
 *       // row = { id, event_type, aggregate_type, aggregate_id, payload, actor_user_id, ... }
 *       // Return value is ignored; throw to signal failure (worker retries).
 *       await notifyTeamLeadOnWon(admin, row);
 *     };
 *
 *   The handler receives the full outbox row and the service-role Supabase client.
 *   It should be idempotent — the worker may retry on transient failures.
 *
 * ── ENVIRONMENT FLAGS ──────────────────────────────────────────────────
 *
 *   ENABLE_OUTBOX_WORKER=true   Start the background drain worker.
 *                               Default: false (worker is off unless explicitly set).
 *
 *   OUTBOX_POLL_INTERVAL_MS     How often the worker polls for pending rows.
 *                               Default: 15000 (15 s).  Set lower in dev/test.
 *
 *   OUTBOX_MAX_ATTEMPTS         Rows that fail this many times are marked 'failed'
 *                               and never retried.  Default: 5.
 *
 * ── ZERO BEHAVIOUR CHANGE ──────────────────────────────────────────────
 *   This file exports functions — nothing executes at require-time.
 *   The worker starts ONLY when startOutboxWorker() is called AND
 *   ENABLE_OUTBOX_WORKER==='true'.  Neither condition is true today.
 */

/* ── Handler registry ─────────────────────────────────────────────────── */

/**
 * Map of event_type → async handler function.
 * Empty by default — no automations are active until a v1 handler is registered.
 *
 * @type {Record<string, (admin: import('@supabase/supabase-js').SupabaseClient, row: object) => Promise<void>>}
 */
const HANDLERS = {};

/* ── emitEvent ────────────────────────────────────────────────────────── */

/**
 * Insert an event_outbox row for a domain event.
 *
 * Call this from the write-gateway action handlers (writeGateway.js) immediately
 * after a successful domain write — same request, service-role client, no extra
 * round-trip overhead.  The insert is best-effort: if the outbox table doesn't
 * exist yet (migration not applied) or the insert fails for any reason, the error
 * is logged but never propagated.  The domain write is already committed — do not
 * roll it back over an event emission failure.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 *   Service-role Supabase client (bypasses RLS; only the write-gateway / notify-
 *   service has this — never pass the anon client here).
 *
 * @param {{
 *   eventType:     string,   // e.g. 'lead.stage_changed', 'lead.dnc_marked'
 *   aggregateType: string,   // e.g. 'lead', 'contact', 'company', 'task'
 *   aggregateId:   number,   // PK of the affected entity
 *   payload?:      object,   // optional snapshot / context (keep small, no PII blobs)
 *   actorUserId?:  number|null, // numeric user_id of the actor (server-derived, never trusted from client)
 * }} opts
 *
 * @returns {Promise<void>}
 */
async function emitEvent(supabaseAdmin, { eventType, aggregateType, aggregateId, payload = {}, actorUserId = null }) {
  if (!supabaseAdmin) {
    console.warn('[eventBus] emitEvent called without a supabaseAdmin client — skipping.');
    return;
  }
  if (!eventType || !aggregateType || aggregateId == null) {
    console.warn('[eventBus] emitEvent: missing required field(s) (eventType, aggregateType, aggregateId) — skipping.');
    return;
  }

  try {
    const { error } = await supabaseAdmin.from('event_outbox').insert({
      event_type:     eventType,
      aggregate_type: aggregateType,
      aggregate_id:   Number(aggregateId),
      payload:        payload || {},
      actor_user_id:  actorUserId != null ? Number(actorUserId) : null,
      // created_at, status, attempts all have DB defaults
    });

    if (error) {
      // Log for ops visibility but never throw — the domain write succeeded.
      console.error(`[eventBus] emitEvent insert failed (event_type=${eventType} aggregate=${aggregateType}:${aggregateId}):`, error.message);
    } else {
      console.log(`[eventBus] emitted ${eventType} for ${aggregateType}:${aggregateId} (actor=${actorUserId ?? 'system'})`);
    }
  } catch (e) {
    console.error('[eventBus] emitEvent threw (suppressed):', e.message);
  }
}

/* ── startOutboxWorker ────────────────────────────────────────────────── */

// Re-entrancy guard: prevents overlapping ticks if a tick takes longer than the
// poll interval (mirrors the scanner pattern in server.js).
let workerInFlight = false;

const POLL_INTERVAL_MS  = parseInt(process.env.OUTBOX_POLL_INTERVAL_MS || '15000', 10);
const MAX_ATTEMPTS      = parseInt(process.env.OUTBOX_MAX_ATTEMPTS     || '5',     10);
// How many rows to claim per tick (safety cap — mirrors TASK_SCAN_CAP).
const CLAIM_BATCH_SIZE  = parseInt(process.env.OUTBOX_BATCH_SIZE       || '20',    10);

/**
 * One worker tick:
 *   1. SELECT pending rows (oldest first, capped to CLAIM_BATCH_SIZE).
 *   2. For each row: mark 'processing', dispatch to HANDLERS[event_type].
 *   3. On success: mark 'done', set processed_at.
 *   4. On failure: increment attempts; if attempts >= MAX_ATTEMPTS → 'failed';
 *      else reset to 'pending' so the next tick retries.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 */
async function runWorkerTick(admin) {
  // 1. Claim a batch of pending rows.
  const { data: rows, error: fetchErr } = await admin
    .from('event_outbox')
    .select('id, event_type, aggregate_type, aggregate_id, payload, actor_user_id, attempts, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(CLAIM_BATCH_SIZE);

  if (fetchErr) {
    console.error('[eventBus] worker tick fetch failed:', fetchErr.message);
    return;
  }
  if (!rows || rows.length === 0) return; // nothing pending

  console.log(`[eventBus] worker tick: ${rows.length} pending row(s).`);

  for (const row of rows) {
    // 2. Mark as 'processing' atomically (only if still 'pending' — prevents duplicate
    //    claiming if two processes share the same DB, though we run only one worker).
    const { error: claimErr } = await admin
      .from('event_outbox')
      .update({ status: 'processing' })
      .eq('id', row.id)
      .eq('status', 'pending'); // idempotency guard

    if (claimErr) {
      console.warn(`[eventBus] could not claim row ${row.id}:`, claimErr.message);
      continue;
    }

    const handler = HANDLERS[row.event_type];

    if (!handler) {
      // No handler registered for this event type yet — mark done so we don't
      // spin on it forever.  When a handler is later registered, new events will
      // be processed; historical unhandled events are already gone.
      console.log(`[eventBus] no handler for event_type='${row.event_type}' (row ${row.id}) — marking done.`);
      await admin.from('event_outbox').update({
        status: 'done',
        processed_at: new Date().toISOString(),
        error: 'no handler registered',
      }).eq('id', row.id);
      continue;
    }

    try {
      // 3. Dispatch.
      await handler(admin, row);

      await admin.from('event_outbox').update({
        status: 'done',
        processed_at: new Date().toISOString(),
        attempts: (row.attempts || 0) + 1,
        error: null,
      }).eq('id', row.id);

      console.log(`[eventBus] handled ${row.event_type} row ${row.id} OK.`);

    } catch (handlerErr) {
      // 4. Handler threw — retry or permanently fail.
      const newAttempts = (row.attempts || 0) + 1;
      const permanentlyFailed = newAttempts >= MAX_ATTEMPTS;

      const update = {
        status:   permanentlyFailed ? 'failed' : 'pending',
        attempts: newAttempts,
        error:    handlerErr.message || String(handlerErr),
      };
      if (permanentlyFailed) {
        console.error(
          `[eventBus] row ${row.id} (${row.event_type}) permanently FAILED after ${newAttempts} attempt(s):`,
          handlerErr.message,
        );
      } else {
        console.warn(
          `[eventBus] row ${row.id} (${row.event_type}) failed (attempt ${newAttempts}/${MAX_ATTEMPTS}) — will retry:`,
          handlerErr.message,
        );
      }
      await admin.from('event_outbox').update(update).eq('id', row.id);
    }
  }
}

/** Wrapper that prevents overlapping ticks and swallows any uncaught throw. */
async function safeRunWorkerTick(admin) {
  if (workerInFlight) {
    console.warn('[eventBus] previous worker tick still running — skipping this interval.');
    return;
  }
  workerInFlight = true;
  try {
    await runWorkerTick(admin);
  } catch (e) {
    console.error('[eventBus] worker tick threw (suppressed — worker continues):', e.message);
  } finally {
    workerInFlight = false;
  }
}

/**
 * Start the outbox background worker.
 *
 * OPT-IN GATE: does nothing unless process.env.ENABLE_OUTBOX_WORKER === 'true'.
 * This means the function is safe to call unconditionally in server.js once the
 * migration is applied — the env var keeps it off in production until automations
 * are ready.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {{ intervalMs?: number }} [opts]
 */
function startOutboxWorker(supabaseAdmin, opts = {}) {
  if (process.env.ENABLE_OUTBOX_WORKER !== 'true') {
    // Default-off.  The gate is intentional: do not start the worker until
    // the migration is applied and at least one handler is registered.
    return;
  }

  if (!supabaseAdmin) {
    console.warn('[eventBus] startOutboxWorker: no supabaseAdmin client — worker NOT started.');
    return;
  }

  const intervalMs = opts.intervalMs || POLL_INTERVAL_MS;
  console.log(`[eventBus] outbox worker STARTING — poll every ${intervalMs}ms, max ${MAX_ATTEMPTS} attempts, batch ${CLAIM_BATCH_SIZE}.`);

  // Initial tick shortly after boot (catch up on anything that accumulated during downtime).
  setTimeout(() => { void safeRunWorkerTick(supabaseAdmin); }, 3000);
  setInterval(() => { void safeRunWorkerTick(supabaseAdmin); }, intervalMs);
}

/* ── Exports ──────────────────────────────────────────────────────────── */

module.exports = { emitEvent, startOutboxWorker, HANDLERS };

// ── TODO: enable the worker in server.js ──────────────────────────────
// After the migration is applied and at least one handler exists, add this
// ONE line to server.js in the startup block (after getSupabaseAdmin() check):
//
//   const { startOutboxWorker } = require('./src/eventBus');
//   startOutboxWorker(getSupabaseAdmin());         // no-ops until ENABLE_OUTBOX_WORKER=true
//
// The env var keeps it off in production; flip it on in a single deploy when ready.
