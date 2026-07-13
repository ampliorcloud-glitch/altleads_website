/**
 * leadState.ts — data layer for ALT-470/471/472 (lead-state v2).
 *
 * Every function here is called ONLY when LEAD_STATE_V2 is true (the card that
 * uses them is flag-gated at the page level). Until the staged migration
 * `apply-leadstate-qualification-lost-utm.cjs` is applied, these queries would
 * 404 on the missing columns/tables — which is exactly why the flag stays off in
 * prod until the migration lands.
 *
 * Conventions: actor / *_by audit fields are the app `user_id` as a STRING
 * (matches lead_report.created_by/updated_by varchar columns elsewhere).
 */

import { supabase } from '../lib/supabase';
import type { QualificationStatus } from '../lib/leadStateFlag';

// ── Qualification (ALT-471) ───────────────────────────────────────────────────

export interface QualificationState {
  qualification_status: QualificationStatus | null;
  qualified_by: number | null;
  qualified_on: string | null;
}

/** Read the qualification triple for one report. Returns nulls if never set. */
export async function fetchQualification(reportId: number): Promise<QualificationState> {
  const { data, error } = await supabase
    .from('lead_report')
    .select('qualification_status, qualified_by, qualified_on')
    .eq('report_id', reportId)
    .maybeSingle();
  if (error || !data) {
    return { qualification_status: null, qualified_by: null, qualified_on: null };
  }
  return data as QualificationState;
}

/**
 * Set (or clear) the qualification status, stamping who/when.
 * actorUserId is the app user_id (number); we stamp qualified_by with it.
 */
export async function updateQualification(
  reportId: number,
  status: QualificationStatus | null,
  actorUserId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const patch =
    status == null
      ? { qualification_status: null, qualified_by: null, qualified_on: null }
      : {
          qualification_status: status,
          qualified_by: actorUserId,
          qualified_on: new Date().toISOString(),
        };
  const { error } = await supabase.from('lead_report').update(patch).eq('report_id', reportId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ── Lost reasons (ALT-472) ────────────────────────────────────────────────────

export interface LostReason {
  lost_reason_id: number;
  label: string;
  sort_order: number;
}

/** Active lost-reason lookup options, ordered for display. */
export async function fetchLostReasonOptions(): Promise<LostReason[]> {
  const { data, error } = await supabase
    .from('lost_reason')
    .select('lost_reason_id, label, sort_order')
    .is('deleted_date', null)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error || !data) return [];
  return data as LostReason[];
}

/** The lost_reason_ids currently selected for a report (live junction rows). */
export async function fetchSelectedLostReasons(reportId: number): Promise<number[]> {
  const { data, error } = await supabase
    .from('lead_lost_reason')
    .select('lost_reason_id')
    .eq('report_id', reportId)
    .is('deleted_date', null);
  if (error || !data) return [];
  return (data as { lost_reason_id: number }[]).map((r) => r.lost_reason_id);
}

/**
 * Reconcile the selected reasons for a report: soft-delete rows no longer chosen,
 * insert rows newly chosen. Idempotent; safe to call with the full desired set.
 */
export async function setLostReasons(
  reportId: number,
  desiredReasonIds: number[],
  actor: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const current = await fetchSelectedLostReasons(reportId);
  const desired = new Set(desiredReasonIds);
  const toRemove = current.filter((id) => !desired.has(id));
  const toAdd = desiredReasonIds.filter((id) => !current.includes(id));

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('lead_lost_reason')
      .update({ deleted_date: new Date().toISOString(), deleted_by: actor })
      .eq('report_id', reportId)
      .in('lost_reason_id', toRemove)
      .is('deleted_date', null);
    if (error) return { ok: false, error: error.message };
  }
  if (toAdd.length > 0) {
    const rows = toAdd.map((lost_reason_id) => ({
      report_id: reportId,
      lost_reason_id,
      created_by: actor,
    }));
    const { error } = await supabase.from('lead_lost_reason').insert(rows);
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}

// ── Competitor tracking (ALT-473) ─────────────────────────────────────────────

export interface Competitor {
  competitor_id: number;
  name: string;
}

/** Active competitor lookup options, alphabetical. */
export async function fetchCompetitorOptions(): Promise<Competitor[]> {
  const { data, error } = await supabase
    .from('competitor')
    .select('competitor_id, name')
    .is('deleted_date', null)
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (error || !data) return [];
  return data as Competitor[];
}

/** competitor_ids currently linked to a report (live junction rows). */
export async function fetchSelectedCompetitors(reportId: number): Promise<number[]> {
  const { data, error } = await supabase
    .from('lead_competitor')
    .select('competitor_id')
    .eq('report_id', reportId)
    .is('deleted_date', null);
  if (error || !data) return [];
  return (data as { competitor_id: number }[]).map((r) => r.competitor_id);
}

/**
 * Inline-add a competitor by name (case-insensitive). Returns the existing id if
 * a live competitor already matches, else inserts and returns the new id.
 */
export async function ensureCompetitor(
  name: string,
  actor: string,
): Promise<{ ok: true; competitor_id: number } | { ok: false; error: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: 'Name required' };
  const { data: existing } = await supabase
    .from('competitor')
    .select('competitor_id, name')
    .is('deleted_date', null)
    .ilike('name', trimmed)
    .limit(1);
  const hit = (existing ?? [])[0] as { competitor_id: number } | undefined;
  if (hit) return { ok: true, competitor_id: hit.competitor_id };
  const { data, error } = await supabase
    .from('competitor')
    .insert({ name: trimmed, created_by: actor })
    .select('competitor_id')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Insert failed' };
  return { ok: true, competitor_id: (data as { competitor_id: number }).competitor_id };
}

/** Reconcile linked competitors for a report (soft-delete removed, insert added). */
export async function setCompetitors(
  reportId: number,
  desiredIds: number[],
  actor: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const current = await fetchSelectedCompetitors(reportId);
  const desired = new Set(desiredIds);
  const toRemove = current.filter((id) => !desired.has(id));
  const toAdd = desiredIds.filter((id) => !current.includes(id));

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('lead_competitor')
      .update({ deleted_date: new Date().toISOString(), deleted_by: actor })
      .eq('report_id', reportId)
      .in('competitor_id', toRemove)
      .is('deleted_date', null);
    if (error) return { ok: false, error: error.message };
  }
  if (toAdd.length > 0) {
    const rows = toAdd.map((competitor_id) => ({ report_id: reportId, competitor_id, created_by: actor }));
    const { error } = await supabase.from('lead_competitor').insert(rows);
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}

// ── UTM attribution (ALT-470) ─────────────────────────────────────────────────

export interface UtmState {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
}

/** Read UTM attribution off lead_master. Returns nulls when absent. */
export async function fetchUtm(leadId: number): Promise<UtmState> {
  const { data, error } = await supabase
    .from('lead_master')
    .select('utm_source, utm_medium, utm_campaign')
    .eq('lead_id', leadId)
    .maybeSingle();
  if (error || !data) return { utm_source: null, utm_medium: null, utm_campaign: null };
  return data as UtmState;
}
