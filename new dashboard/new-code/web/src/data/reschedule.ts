/**
 * reschedule.ts — ALT-480 reschedule intelligence (READ-ONLY, no migration).
 *
 * Surfaces the reschedule history that already exists in `meeting_reschedule`
 * (events are written today by UpdateMeetingModal / meetings.ts) as an at-a-glance
 * count + last reason, so a rep/TL can spot a prospect who keeps postponing.
 *
 * Works on real existing data — no schema change. Called only when
 * RESCHEDULE_INSIGHT is true (component is flag-gated at the page).
 *
 * Chain: lead_report.report_id → meeting_schedule.meeting_id → meeting_reschedule.
 */

import { supabase } from '../lib/supabase';

export interface RescheduleSummary {
  count: number;
  lastReason: string | null;
  lastDate: string | null;
}

const EMPTY: RescheduleSummary = { count: 0, lastReason: null, lastDate: null };

/** Reschedule count + most-recent reason across all of a lead's meetings. */
export async function fetchLeadRescheduleSummary(reportId: number): Promise<RescheduleSummary> {
  // 1. meetings belonging to this report
  const { data: scheds, error: e1 } = await supabase
    .from('meeting_schedule')
    .select('meeting_id')
    .eq('report_id', reportId)
    .is('deleted_date', null);
  if (e1 || !scheds || scheds.length === 0) return EMPTY;
  const meetingIds = [...new Set((scheds as { meeting_id: number | null }[])
    .map((s) => s.meeting_id)
    .filter((id): id is number => id != null))];
  if (meetingIds.length === 0) return EMPTY;

  // 2. reschedule events for those meetings (newest first)
  const { data: rows, error: e2 } = await supabase
    .from('meeting_reschedule')
    .select('resone, new_resone, created_date, meeting_date')
    .in('meeting_id', meetingIds)
    .is('deleted_date', null)
    .order('mtg_resch_id', { ascending: false });
  if (e2 || !rows || rows.length === 0) return EMPTY;

  const list = rows as { resone: string | null; new_resone: string | null; created_date: string | null }[];
  const top = list[0];
  const lastReason = ((top.resone || top.new_resone) ?? '').trim() || null;
  return { count: list.length, lastReason, lastDate: top.created_date ?? null };
}
