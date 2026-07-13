/**
 * writeGateway.ts — typed client wrapper for the server-side write gateway (ALT-431)
 *
 * Provides `callGateway(action, entity, payload)` as a drop-in replacement for
 * direct Supabase writes on privileged/sensitive actions.
 *
 * Feature flag: USE_WRITE_GATEWAY (default false)
 * ─────────────────────────────────────────────────
 * When false (current default), callGateway() is a no-op that returns
 * { ok: false, bypassed: true } so callers can fall back to their existing
 * direct Supabase write.  Flip to true once the gateway is validated in prod.
 *
 * Set at build time via the VITE_ env var, OR at runtime by calling
 * `setWriteGatewayEnabled(true)` (useful for gradual rollout / admin toggle).
 *
 * Base URL
 * ────────
 * Reuses the same VITE_NOTIFY_URL env var as notify.ts (see lib/notify.ts).
 * In production (combined server, same origin): VITE_NOTIFY_URL is unset →
 *   gateway requests go to the same host on /api/write.
 * In local dev (separate servers): set VITE_NOTIFY_URL=http://localhost:8787.
 *
 * Usage
 * ─────
 *   import { callGateway } from '@/lib/writeGateway';
 *
 *   // With fallback pattern (recommended during rollout):
 *   const gw = await callGateway('lead.reassign', 'lead_report', { lead_report_id: 42, new_user_id: 7 });
 *   if (gw.bypassed) {
 *     // flag is off — do your existing direct Supabase write here
 *   } else if (!gw.ok) {
 *     throw new Error(gw.error ?? 'Gateway write failed');
 *   }
 *
 *   // Without fallback (when flag is permanently on):
 *   const result = await callGateway('record.markDnc', 'lead', { entity_type: 'lead', entity_id: 99 });
 *   if (!result.ok) throw new Error(result.error);
 *
 * Adding a new action
 * ───────────────────
 * 1. Add the action to GATEWAY_ACTIONS below (type safety + discoverability).
 * 2. Register it in the server-side ROLE_ALLOW_LIST (notify-service/src/writeGateway.js).
 * 3. Implement the ACTION_HANDLER on the server side.
 * 4. Call callGateway(action, entity, payload) from the React component/hook.
 */

import { supabase } from './supabase';

/* ── Feature flags ───────────────────────────────────────────────── */

/**
 * Master switch.  Defaults to the VITE_USE_WRITE_GATEWAY env var (string
 * 'true' = on).  Override at runtime with setWriteGatewayEnabled().
 */
let _enabled: boolean =
  (import.meta as any).env?.VITE_USE_WRITE_GATEWAY === 'true';

/**
 * Override the flag at runtime (e.g. from an admin feature-flag panel).
 * Changes apply immediately; does not persist across page reloads.
 */
export function setWriteGatewayEnabled(on: boolean): void {
  _enabled = on;
}

/** Read current flag value. */
export function isWriteGatewayEnabled(): boolean {
  return _enabled;
}

/* ── Base URL (mirrors notify.ts) ────────────────────────────────── */

const NOTIFY_URL: string = (import.meta as any).env?.VITE_NOTIFY_URL ?? '';

/* ── Action catalogue (for type safety) ──────────────────────────── */

/**
 * Every registered gateway action.  Keep in sync with the server-side
 * ROLE_ALLOW_LIST in notify-service/src/writeGateway.js.
 */
export type GatewayAction =
  | 'lead.reassign'
  | 'record.markDnc'
  | 'record.setFeasibility'
  // ── Import write-engine (DEC-14) ──
  | 'company.import'
  | 'contact.import'
  | 'lead.import'
  | 'company.importUndo'
  | 'contact.importUndo'
  | 'lead.importUndo'
  // ── Other ──
  | 'lead.export'
  | 'contact.markDnc'
  | 'ownership.reassign'
  | 'feedback.upsert';

/* ── Response types ──────────────────────────────────────────────── */

/** Returned when the feature flag is OFF — caller should use its fallback path. */
export interface GatewayBypassed {
  ok: false;
  bypassed: true;
}

/** Returned when the flag is ON and the request succeeded. */
export interface GatewaySuccess {
  ok: true;
  bypassed?: false;
  [key: string]: unknown;
}

/** Returned when the flag is ON but the request failed. */
export interface GatewayFailure {
  ok: false;
  bypassed?: false;
  error: string;
  status?: number;
}

export type GatewayResult = GatewayBypassed | GatewaySuccess | GatewayFailure;

/* ── callGateway ─────────────────────────────────────────────────── */

/**
 * Call the server-side write gateway.
 *
 * @param action  - One of the registered GatewayAction strings.
 * @param entity  - Free-form label for logging (e.g. 'lead_report', 'lead').
 * @param payload - Action-specific payload object; validated server-side.
 * @returns GatewayResult
 *   • { ok: false, bypassed: true }  — flag is off; caller uses its own path.
 *   • { ok: true, ...result }         — success.
 *   • { ok: false, error, status? }  — server rejected the request.
 */
export async function callGateway(
  action: GatewayAction,
  entity: string,
  payload: Record<string, unknown>
): Promise<GatewayResult> {
  // Flag is off — signal the caller to fall back to direct Supabase writes.
  if (!_enabled) {
    return { ok: false, bypassed: true };
  }

  // Attach the caller's current Supabase session token.
  let accessToken: string | undefined;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    accessToken = sessionData?.session?.access_token;
  } catch {
    // If we can't get a session, the server will reject with 401.
  }

  if (!accessToken) {
    return { ok: false, error: 'no active session — cannot call write gateway', status: 401 };
  }

  let res: Response;
  try {
    res = await fetch(`${NOTIFY_URL}/api/write`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ action, entity, payload }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[writeGateway] fetch failed:', msg);
    return { ok: false, error: 'network error — write gateway unreachable', status: 0 };
  }

  let body: Record<string, unknown>;
  try {
    body = await res.json();
  } catch {
    return { ok: false, error: `gateway returned non-JSON (HTTP ${res.status})`, status: res.status };
  }

  if (!res.ok || body.ok === false) {
    const errorMsg = typeof body.error === 'string' ? body.error : `HTTP ${res.status}`;
    console.warn(`[writeGateway] action=${action} failed (${res.status}):`, errorMsg);
    return { ok: false, error: errorMsg, status: res.status };
  }

  return { ok: true, ...body } as GatewaySuccess;
}

/* ── Convenience re-exports ──────────────────────────────────────── */

/**
 * Check whether the current user's role permits a given action.
 * This is a CLIENT-SIDE hint only (not a security boundary — the server enforces
 * the real check). Use to hide UI controls the user cannot call anyway.
 *
 * role: the value from profiles.role (e.g. 'ADMIN', 'AGENT').
 */
export function roleCanCall(role: string | null | undefined, action: GatewayAction): boolean {
  const ROLE_ALLOW_LIST: Record<GatewayAction, string[]> = {
    'lead.reassign':        ['ADMIN', 'TEAM_LEAD'],
    'record.markDnc':       ['ADMIN', 'TEAM_LEAD', 'AGENT', 'QC'],
    'record.setFeasibility':['ADMIN', 'TEAM_LEAD', 'QC'],
    // Import write-engine (DEC-14)
    'company.import':       ['ADMIN'],
    'contact.import':       ['ADMIN'],
    'lead.import':          ['ADMIN'],
    'company.importUndo':   ['ADMIN'],
    'contact.importUndo':   ['ADMIN'],
    'lead.importUndo':      ['ADMIN'],
    // Other
    'lead.export':          ['ADMIN', 'TEAM_LEAD'],
    'contact.markDnc':      ['ADMIN', 'TEAM_LEAD', 'AGENT', 'QC'],
    'ownership.reassign':   ['ADMIN'],
    'feedback.upsert':      ['ADMIN', 'SALES_HEAD', 'SALES_PERSON'],
  };
  if (!role) return false;
  return (ROLE_ALLOW_LIST[action] ?? []).includes(role);
}
