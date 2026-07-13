/**
 * leadFreshness.ts — ALT-484-lite: "when was this lead last worked?" (READ-ONLY,
 * no migration). The #1 outreach signal — surfaces leads that have gone cold.
 *
 * last_activity = most recent of:
 *   • lead_report.updated_date (passed in — already loaded on the detail page)
 *   • latest meeting_date / updated_date across the lead's meetings
 *
 * Called only when FRESHNESS_INSIGHT is true (component is flag-gated).
 * Chain: lead_report.report_id → meeting_schedule.meeting_id → meeting_master.
 */

import { supabase } from '../lib/supabase';

export interface FreshnessSummary {
  lastAt: string | null;
  daysSince: number | null;
}

function maxDate(...vals: (string | null | undefined)[]): string | null {
  let best: number | null = null;
  let bestRaw: string | null = null;
  for (const v of vals) {
    if (!v) continue;
    const t = Date.parse(v);
    if (Number.isNaN(t)) continue;
    if (best == null || t > best) {
      best = t;
      bestRaw = v;
    }
  }
  return bestRaw;
}

/**
 * Most-recent activity timestamp + whole days since, for a lead.
 * `reportUpdatedDate` is lead_report.updated_date (already in scope on the page).
 * `now` is injected (Date.now()) so the data layer stays pure/testable.
 */
export async function fetchLeadFreshness(
  reportId: number | null,
  reportUpdatedDate: string | null | undefined,
  now: number,
): Promise<FreshnessSummary> {
  let meetingLatest: string | null = null;

  if (reportId != null) {
    const { data: scheds } = await supabase
      .from('meeting_schedule')
      .select('meeting_id')
      .eq('report_id', reportId)
      .is('deleted_date', null);
    const ids = [...new Set(((scheds ?? []) as { meeting_id: number | null }[])
      .map((s) => s.meeting_id)
      .filter((id): id is number => id != null))];
    if (ids.length > 0) {
      const { data: mtgs } = await supabase
        .from('meeting_master')
        .select('meeting_date, updated_date, created_date')
        .in('meeting_id', ids)
        .is('deleted_date', null);
      for (const m of (mtgs ?? []) as { meeting_date: string | null; updated_date: string | null; created_date: string | null }[]) {
        meetingLatest = maxDate(meetingLatest, m.meeting_date, m.updated_date, m.created_date);
      }
    }
  }

  const lastAt = maxDate(reportUpdatedDate, meetingLatest);
  if (!lastAt) return { lastAt: null, daysSince: null };
  const daysSince = Math.floor((now - Date.parse(lastAt)) / 86_400_000);
  return { lastAt, daysSince: daysSince < 0 ? 0 : daysSince };
}
