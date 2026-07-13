'use strict';

/**
 * writeGateway.js — server-side write gatekeeper (ALT-431)
 *
 * Import write-engine (DEC-14) implemented 2026-06-28:
 *   company.import, contact.import, lead.import  — real upsert via importEngine.js
 *   company.importUndo, contact.importUndo, lead.importUndo — batch undo
 *
 * Mounts on the Express app as a router under POST /api/write.
 * Verifies the caller's Supabase JWT → resolves the actor's profiles row
 * (user_id + role) server-side → validates action against the per-role
 * allow-list → performs the write with the service-role client.
 *
 * IDENTITY: never trust a client-supplied actor id. Always derive from JWT.
 * ADDITIVE: does NOT change any existing endpoint behaviour.
 *
 * Usage (in server.js):
 *   const writeGateway = require('./src/writeGateway');
 *   writeGateway.mount(app, getSupabaseAdmin);
 *
 * How to register a new action handler:
 *   1. Add the action name to the ROLE_ALLOW_LIST for every role that may call it.
 *   2. Add an async handler to ACTION_HANDLERS:
 *        async handler(admin, actor, payload) → { ok: true, ... } | throws
 *      `actor` is { authUid, userId, role } — all server-derived.
 *      `payload` is whatever the client sent (validated by the handler).
 *   3. The gateway routes, verifies, and wraps errors automatically.
 *
 * Contract:
 *   POST /api/write
 *   Headers: Authorization: Bearer <supabase-access-token>
 *   Body:    { action: string, entity: string, payload: object }
 *   200 OK:  { ok: true, ...actionResult }
 *   400:     { ok: false, error: string }   (validation / unknown action)
 *   401:     { ok: false, error: string }   (missing / invalid token)
 *   403:     { ok: false, error: string }   (role not allowed)
 *   500:     { ok: false, error: string }   (handler threw)
 *   503:     { ok: false, error: string }   (Supabase env vars not set)
 */

/* ── Import engine (DEC-14) ──────────────────────────────────────── */
const { runImport, undoBatch } = require('./importEngine');

/* ── Role constants (mirrors role_master in DB) ──────────────────── */
const ROLES = {
  ADMIN:        'ADMIN',       // role_id 1
  TEAM_LEAD:    'TEAM_LEAD',   // role_id 2
  AGENT:        'AGENT',       // role_id 3
  SALES_HEAD:   'SALES_HEAD',  // role_id 4
  SALES_PERSON: 'SALES_PERSON',// role_id 5
  QC:           'QC',          // role_id 6
};

/* ── Allow-list: action → set of roles that may call it ─────────── */
/**
 * To restrict an action to admins only: [ROLES.ADMIN]
 * To allow outreach team: [ROLES.ADMIN, ROLES.TEAM_LEAD, ROLES.AGENT, ROLES.QC]
 * To allow sales side: [ROLES.ADMIN, ROLES.SALES_HEAD, ROLES.SALES_PERSON]
 *
 * When you add a new action, add it here first — the gateway rejects anything
 * not in this map with a 400 "unknown action" before it even checks role.
 */
const ROLE_ALLOW_LIST = {
  // ── Lead / record operations ──────────────────────────────────────
  'lead.reassign':       [ROLES.ADMIN, ROLES.TEAM_LEAD],
  'record.markDnc':      [ROLES.ADMIN, ROLES.TEAM_LEAD, ROLES.AGENT, ROLES.QC],
  'record.setFeasibility': [ROLES.ADMIN, ROLES.TEAM_LEAD, ROLES.QC],

  // ── Import write-engine (DEC-14) — all ADMIN only ───────────────────────
  'company.import':      [ROLES.ADMIN],
  'contact.import':      [ROLES.ADMIN],
  'lead.import':         [ROLES.ADMIN],
  'company.importUndo':  [ROLES.ADMIN],
  'contact.importUndo':  [ROLES.ADMIN],
  'lead.importUndo':     [ROLES.ADMIN],

  // ── Other planned / placeholder actions ──────────────────────────────────
  'lead.export':         [ROLES.ADMIN, ROLES.TEAM_LEAD],          // ALT-import-agent
  'contact.markDnc':     [ROLES.ADMIN, ROLES.TEAM_LEAD, ROLES.AGENT, ROLES.QC],
  'ownership.reassign':  [ROLES.ADMIN],                           // bulk ownership fix
  'feedback.upsert':     [ROLES.ADMIN, ROLES.SALES_HEAD, ROLES.SALES_PERSON], // HungerBox agent
};

/* ── Action handlers ──────────────────────────────────────────────── */
/**
 * Each handler: async (admin, actor, payload) => resultObject
 *   admin   — service-role Supabase client (bypasses RLS)
 *   actor   — { authUid: string, userId: number|null, role: string }
 *   payload — raw client object (validate inside the handler)
 *
 * Throw an Error to return 500 with the message (sanitised — raw Supabase
 * error messages are wrapped and logged, not forwarded to the client).
 *
 * TODO markers show what each HungerBox / import agent needs to fill in.
 */
const ACTION_HANDLERS = {

  /* ── lead.reassign ─────────────────────────────────────────────────
   * Reassign a lead_report row to a new agent.
   * Payload: { lead_report_id: number, new_user_id: number }
   *
   * TODO (HungerBox agent / any agent extending this): add domain validation
   *   (e.g. confirm the new_user_id is an AGENT, confirm the lead exists).
   */
  async 'lead.reassign'(admin, actor, payload) {
    const { lead_report_id, new_user_id } = payload || {};
    if (!lead_report_id || typeof lead_report_id !== 'number') {
      throw new GatewayValidationError('payload.lead_report_id must be a number');
    }
    if (!new_user_id || typeof new_user_id !== 'number') {
      throw new GatewayValidationError('payload.new_user_id must be a number');
    }

    // TODO: optionally verify new_user_id is an active AGENT before writing.

    const { error } = await admin
      .from('lead_report')
      .update({
        user_id: new_user_id,
        updated_by: String(actor.userId ?? actor.authUid),
        updated_date: new Date().toISOString(),
      })
      .eq('report_id', lead_report_id);

    if (error) {
      console.error('[writeGateway] lead.reassign DB error:', error.message);
      throw new Error('Failed to reassign lead');
    }
    return { reassigned: true, lead_report_id, new_user_id };
  },

  /* ── record.markDnc ────────────────────────────────────────────────
   * Mark a contact/company as Do-Not-Call.
   * Payload: { entity_type: 'contact'|'company', entity_id: number }
   *
   * TODO (import agent / HungerBox agent): replace the table name and column
   *   below with the real DNC field once the schema is confirmed.  Currently
   *   writes to `lead_master.is_dnc`.  Adjust entity_type routing as needed.
   */
  async 'record.markDnc'(admin, actor, payload) {
    const { entity_type, entity_id } = payload || {};
    if (!entity_type || !['contact', 'company', 'lead'].includes(entity_type)) {
      throw new GatewayValidationError("payload.entity_type must be 'contact', 'company', or 'lead'");
    }
    if (!entity_id || typeof entity_id !== 'number') {
      throw new GatewayValidationError('payload.entity_id must be a number');
    }

    // TODO: map entity_type to the correct table + PK column when schema is finalised.
    // Current stub uses lead_master as a placeholder.
    const TABLE_MAP = {
      lead:    { table: 'lead_master',   pk: 'lead_id' },
      contact: { table: 'lead_master',   pk: 'lead_id' },   // TODO: swap to contacts table
      company: { table: 'lead_master',   pk: 'lead_id' },   // TODO: swap to companies table
    };
    const { table, pk } = TABLE_MAP[entity_type];

    const { error } = await admin
      .from(table)
      .update({
        is_dnc: true,
        updated_by: String(actor.userId ?? actor.authUid),
        updated_date: new Date().toISOString(),
      })
      .eq(pk, entity_id);

    if (error) {
      console.error('[writeGateway] record.markDnc DB error:', error.message);
      throw new Error('Failed to mark DNC');
    }
    return { marked: true, entity_type, entity_id };
  },

  /* ── record.setFeasibility ─────────────────────────────────────────
   * Set the feasibility flag on a lead record.
   * Payload: { lead_id: number, feasibility: string }
   *
   * TODO: confirm the exact column name in lead_master (feasibility? is_feasible?).
   */
  async 'record.setFeasibility'(admin, actor, payload) {
    const { lead_id, feasibility } = payload || {};
    if (!lead_id || typeof lead_id !== 'number') {
      throw new GatewayValidationError('payload.lead_id must be a number');
    }
    if (feasibility === undefined || feasibility === null) {
      throw new GatewayValidationError('payload.feasibility is required');
    }

    const { error } = await admin
      .from('lead_master')
      .update({
        feasibility,                                           // TODO: confirm column name
        updated_by: String(actor.userId ?? actor.authUid),
        updated_date: new Date().toISOString(),
      })
      .eq('lead_id', lead_id);

    if (error) {
      console.error('[writeGateway] record.setFeasibility DB error:', error.message);
      throw new Error('Failed to set feasibility');
    }
    return { updated: true, lead_id, feasibility };
  },

  /* ── Import write-engine handlers (DEC-14) ──────────────────────── */
  /**
   * company.import / contact.import / lead.import
   *
   * Payload: {
   *   entity:   'company' | 'contact' | 'lead',
   *   rows:     MappedRow[],  // ≤ 500 rows per call; target-field keys
   *   filename: string?,
   * }
   * Response: { ok: true, batchId, total, inserted, updated, skipped, error, rowResults[] }
   *
   * importEngine throws with e.name='GatewayValidationError' for payload errors
   * (entity unknown, rows empty/too-large).  Re-wrap those as real
   * GatewayValidationError so the gateway returns 400 instead of 500.
   */
  async 'company.import'(admin, actor, payload) {
    try { return await runImport(admin, actor, { ...payload, entity: 'company' }); }
    catch (e) { if (e.name === 'GatewayValidationError') throw new GatewayValidationError(e.message); throw e; }
  },

  async 'contact.import'(admin, actor, payload) {
    try { return await runImport(admin, actor, { ...payload, entity: 'contact' }); }
    catch (e) { if (e.name === 'GatewayValidationError') throw new GatewayValidationError(e.message); throw e; }
  },

  async 'lead.import'(admin, actor, payload) {
    try { return await runImport(admin, actor, { ...payload, entity: 'lead' }); }
    catch (e) { if (e.name === 'GatewayValidationError') throw new GatewayValidationError(e.message); throw e; }
  },

  /**
   * company.importUndo / contact.importUndo / lead.importUndo
   *
   * Payload: { batchId: number }
   * Response: { ok: true, batchId, undone, failed, errors[] }
   *
   * Reverses every inserted + updated row in the batch:
   *   inserted → soft-deleted (deleted_date set)
   *   updated  → prior column values restored from import_row.undo_payload
   */
  async 'company.importUndo'(admin, actor, payload) {
    const { batchId } = payload || {};
    if (!batchId || typeof batchId !== 'number') {
      throw new GatewayValidationError('payload.batchId must be a number');
    }
    return undoBatch(admin, batchId, actor);
  },

  async 'contact.importUndo'(admin, actor, payload) {
    const { batchId } = payload || {};
    if (!batchId || typeof batchId !== 'number') {
      throw new GatewayValidationError('payload.batchId must be a number');
    }
    return undoBatch(admin, batchId, actor);
  },

  async 'lead.importUndo'(admin, actor, payload) {
    const { batchId } = payload || {};
    if (!batchId || typeof batchId !== 'number') {
      throw new GatewayValidationError('payload.batchId must be a number');
    }
    return undoBatch(admin, batchId, actor);
  },

  /* ── Other stubbed / placeholder handlers ────────────────────────── */
  // These exist so the allow-list entry above doesn't orphan.

  async 'lead.export'(_admin, _actor, _payload) {
    // TODO (import agent — ALT-import): implement export-grant logic.
    return { ok: true, stubbed: true, message: 'lead.export handler not yet implemented' };
  },

  async 'contact.markDnc'(_admin, actor, payload) {
    // TODO: implement when contacts table schema is confirmed.
    // For now, delegate to record.markDnc with entity_type='contact'.
    return ACTION_HANDLERS['record.markDnc'](_admin, actor, { ...payload, entity_type: 'contact' });
  },

  async 'ownership.reassign'(_admin, _actor, _payload) {
    // TODO (ownership fix agent — ALT-write-path-blocker): bulk reassign created_by -> user_id.
    return { ok: true, stubbed: true, message: 'ownership.reassign handler not yet implemented' };
  },

  async 'feedback.upsert'(_admin, _actor, _payload) {
    // TODO (HungerBox feedback agent): upsert sales feedback on a deal.
    return { ok: true, stubbed: true, message: 'feedback.upsert handler not yet implemented' };
  },
};

/* ── Validation error subclass (400 vs 500) ──────────────────────── */
class GatewayValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GatewayValidationError';
  }
}

/* ── Core middleware: resolve actor from JWT ─────────────────────── */
/**
 * Verifies the Supabase JWT and attaches the actor profile to req.gatewayActor.
 * Rejects with 401 if token is missing/invalid, 503 if Supabase not configured.
 * req.gatewayActor = { authUid: string, userId: number|null, role: string|null }
 */
async function resolveGatewayActor(req, res, next, getSupabaseAdmin) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({ ok: false, error: 'Supabase env vars not set (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)' });
  }

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    return res.status(401).json({ ok: false, error: 'missing Authorization: Bearer token' });
  }

  let user;
  try {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ ok: false, error: 'invalid or expired token' });
    }
    user = data.user;
  } catch (e) {
    console.error('[writeGateway] auth.getUser threw:', e.message);
    return res.status(503).json({ ok: false, error: 'auth check failed' });
  }

  // Resolve the profiles row to get the numeric user_id and role.
  // We never trust a client-supplied userId.
  let userId = null;
  let role = null;
  try {
    const { data: prof } = await admin
      .from('profiles')
      .select('user_id, role')
      .eq('id', user.id)
      .maybeSingle();
    if (prof) {
      userId = prof.user_id ?? null;
      role   = prof.role   ?? null;
    }
  } catch (e) {
    console.error('[writeGateway] profiles lookup threw:', e.message);
    // Non-fatal: actor is partially resolved; role check below will catch null role.
  }

  req.gatewayActor = { authUid: user.id, userId, role };
  next();
}

/* ── mount() — called from server.js ─────────────────────────────── */
/**
 * Attaches the write-gateway route to the Express app.
 * Call once after other routes are registered:
 *   writeGateway.mount(app, getSupabaseAdmin);
 *
 * @param {import('express').Application} app
 * @param {() => import('@supabase/supabase-js').SupabaseClient|null} getSupabaseAdmin
 */
function mount(app, getSupabaseAdmin) {
  /**
   * POST /api/write
   *
   * Auth: any valid Supabase JWT. Role is resolved server-side.
   * Body: { action: string, entity: string, payload: object }
   *
   * Notes:
   * - The `entity` field is free-form context passed through to the handler
   *   (useful for logging and future routing; not enforced here).
   * - `payload` is handler-specific. Each handler validates its own payload.
   */
  app.post('/api/write', (req, res, next) => {
    // Inline the actor-resolution middleware (closure over getSupabaseAdmin).
    resolveGatewayActor(req, res, next, getSupabaseAdmin);
  }, async (req, res) => {
    const { action, entity = '', payload = {} } = req.body || {};
    const actor = req.gatewayActor; // { authUid, userId, role }

    /* 1. Basic shape validation */
    if (!action || typeof action !== 'string') {
      return res.status(400).json({ ok: false, error: 'body.action (string) is required' });
    }

    /* 2. Action must be registered */
    if (!Object.prototype.hasOwnProperty.call(ROLE_ALLOW_LIST, action)) {
      return res.status(400).json({ ok: false, error: `unknown action: ${action}` });
    }

    /* 3. Role check */
    const allowedRoles = ROLE_ALLOW_LIST[action];
    if (!actor.role || !allowedRoles.includes(actor.role)) {
      console.warn(
        `[writeGateway] 403 — actor uid=${actor.authUid} role=${actor.role} tried action=${action}`
      );
      return res.status(403).json({
        ok: false,
        error: `role '${actor.role ?? 'unknown'}' is not permitted to call action '${action}'`,
      });
    }

    /* 4. Resolve the service-role client (actor already validated, so it must exist) */
    const admin = getSupabaseAdmin();
    if (!admin) {
      return res.status(503).json({ ok: false, error: 'Supabase env vars not set' });
    }

    /* 5. Dispatch to the action handler */
    const handler = ACTION_HANDLERS[action];
    if (!handler) {
      // Should never happen (allow-list and handler map must be kept in sync),
      // but guard against a developer adding an allow-list entry without a handler.
      console.error(`[writeGateway] no handler for registered action: ${action}`);
      return res.status(500).json({ ok: false, error: 'action handler not implemented' });
    }

    try {
      console.log(
        `[writeGateway] action=${action} entity=${entity} actor_uid=${actor.authUid} ` +
        `actor_user_id=${actor.userId} role=${actor.role}`
      );
      const result = await handler(admin, actor, payload);
      return res.status(200).json({ ok: true, ...result });
    } catch (e) {
      if (e instanceof GatewayValidationError) {
        // Payload validation errors from the handler → 400
        return res.status(400).json({ ok: false, error: e.message });
      }
      // Unexpected DB / logic errors → 500, sanitised
      console.error(`[writeGateway] handler error for action=${action}:`, e.message);
      return res.status(500).json({ ok: false, error: 'write failed — see server logs' });
    }
  });

  console.log('[writeGateway] mounted on POST /api/write');
}

module.exports = { mount, ROLE_ALLOW_LIST, ACTION_HANDLERS, GatewayValidationError };
