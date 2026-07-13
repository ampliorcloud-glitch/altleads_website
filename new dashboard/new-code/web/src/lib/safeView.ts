/**
 * safeView.ts — ALT-492/493: "safe view" for non-owned records.
 *
 * When SAFE_VIEW is true, outreach agents (non-exempt roles) see:
 *   • Email + phone fields MASKED on records they don't own (ALT-492).
 *   • Those rows rendered dull/grey in lists (ALT-493).
 *
 * Exempt roles (Admin, Team Lead, QC) always see unmasked, normal styling.
 * Owners always see their own records unmasked, normal styling.
 *
 * IMPORTANT — this is a PRESENTATIONAL / UI-layer concern only.
 * The row is still fetched from the DB; we only hide sensitive fields in the
 * React render layer. True server-side field redaction (RLS column grants)
 * is a future step and is NOT implemented here. A comment in each masking
 * callsite (see isForeignRecord) notes this.
 *
 * How to enable: flip SAFE_VIEW to true. Production is unchanged while false.
 *
 * Relevant tickets: ALT-492, ALT-493.
 */

// ── Master gate ───────────────────────────────────────────────────────────────
//
// Set to false → zero UI change in prod.
// Set to true  → masking + grey row styling enabled for non-exempt, non-owner users.
//
export const SAFE_VIEW = false;

// ── Exemption helper ──────────────────────────────────────────────────────────

/**
 * Returns true when, under the SAFE_VIEW flag, the current user is looking at a
 * record they do NOT own and are NOT exempt from masking.
 *
 * @param ownerUserId  The numeric user_id of the record's owner (null = unassigned).
 * @param currentUserId The numeric user_id from profile (null if not loaded yet).
 * @param exempt       True when the current user is Admin, Team Lead, or QC —
 *                     these roles always see unmasked records with normal styling.
 *
 * Presentational note: masking happens in the React render layer only. The
 * record data is still fetched from Supabase. Server-side field redaction via
 * RLS column grants is a future step (not yet implemented).
 */
export function isForeignRecord(
  ownerUserId: number | null,
  currentUserId: number | null,
  exempt: boolean,
): boolean {
  if (!SAFE_VIEW) return false;           // gate is off → nothing is "foreign"
  if (exempt) return false;               // admin / TL / QC → always visible
  if (ownerUserId == null) return false;  // unassigned → treat as visible (safe default)
  if (currentUserId == null) return false; // auth not loaded yet → don't mask
  return ownerUserId !== currentUserId;
}

// ── Mask helpers ──────────────────────────────────────────────────────────────

/**
 * Mask an email address to show only domain (e.g. "user@example.com" → "•••@example.com").
 * Returns the original value unchanged when it is null / empty / not an email.
 */
export function maskEmail(value: string | null | undefined): string {
  if (!value) return value ?? '';
  const at = value.indexOf('@');
  if (at <= 0) return '•••';
  return `•••${value.slice(at)}`; // hide local-part, keep domain for context
}

/**
 * Mask a phone/mobile number to show only last 4 digits (e.g. "9812345678" → "••••5678").
 * Returns the original value unchanged when it is null / empty.
 */
export function maskPhone(value: string | null | undefined): string {
  if (!value) return value ?? '';
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return '••••';
  return `••••${digits.slice(-4)}`;
}

/**
 * maskContact: convenience wrapper.
 * @param value The raw field value (email or phone).
 * @param kind  'email' | 'phone' — selects the right mask pattern.
 */
export function maskContact(
  value: string | null | undefined,
  kind: 'email' | 'phone',
): string {
  return kind === 'email' ? maskEmail(value) : maskPhone(value);
}

// ── Row style helper ──────────────────────────────────────────────────────────

/**
 * Returns React inline-style overrides that render a list row as dull / muted
 * when it belongs to another rep (ALT-493). Returns {} when the record is not
 * foreign (caller always spreads this so there is no conditional render needed).
 */
export function foreignRowStyle(
  isForeign: boolean,
): React.CSSProperties {
  if (!isForeign) return {};
  return { opacity: 0.55, filter: 'grayscale(30%)' };
}

// React import needed for the CSSProperties return type above.
import type React from 'react';
