/**
 * leadStateFlag.ts — ALT-470 / ALT-471 / ALT-472.
 *
 * Master gate for the "lead-state v2" cluster:
 *   • ALT-471 — qualification status (Unqualified / In Process / Qualified) + audit
 *   • ALT-472 — structured lost-reason capture (lookup + multi-select)
 *   • ALT-470 — UTM attribution (display; import mapping is always on, harmless
 *               because the columns simply don't exist until the migration applies)
 *
 * While LEAD_STATE_V2 is false the QualificationCard never mounts and none of the
 * new tables/columns are queried, so production is byte-for-byte unchanged.
 *
 * Enable order: apply `apply-leadstate-qualification-lost-utm.cjs` (after sign-off)
 * → flip LEAD_STATE_V2 → rebuild. The new lead_report columns + lost_reason tables
 * inherit the project-membership SELECT RLS when that migration applies.
 */

// ── Master gate ───────────────────────────────────────────────────────────────
export const LEAD_STATE_V2 = false;

// ── Qualification (ALT-471) ───────────────────────────────────────────────────
export type QualificationStatus = 'unqualified' | 'in_process' | 'qualified';

export const QUALIFICATION_OPTIONS: ReadonlyArray<{ value: QualificationStatus; label: string }> = [
  { value: 'unqualified', label: 'Unqualified' },
  { value: 'in_process', label: 'In Process' },
  { value: 'qualified', label: 'Qualified' },
];

/** Visual config per qualification value (badge bg/fg). */
export function qualificationStyle(status: QualificationStatus | null): {
  bg: string;
  color: string;
  label: string;
} {
  switch (status) {
    case 'qualified':
      return { bg: '#ECFDF5', color: '#047857', label: 'Qualified' };
    case 'in_process':
      return { bg: '#FFF7ED', color: '#C2410C', label: 'In Process' };
    case 'unqualified':
      return { bg: 'rgba(196,77,77,0.06)', color: '#B91C1C', label: 'Unqualified' };
    default:
      return { bg: '#F3F4F6', color: '#6B7280', label: 'Not triaged' };
  }
}

// ── Lost-reason gating (ALT-472) ──────────────────────────────────────────────
//
// stage_master ids whose meaning is "lost / cancelled / dropped" — when the lead's
// current stage is one of these, the UI prompts the rep to record ≥1 lost reason.
// (Postponed stages 7/11/12 are NOT terminal, so they are intentionally excluded.)
//   6  = Meeting Droped By Amplior
//   10 = Meeting Cancelled
//   13 = Meeting cancelled by Altleads
//   14 = Meeting cancelled by sales team
//   15 = Meeting cancelled by Lead
export const LOST_STAGE_IDS: ReadonlyArray<number> = [6, 10, 13, 14, 15];

/** True when the given stage_id is a terminal "lost" stage that wants a reason. */
export function isLostStage(stageId: number | null | undefined): boolean {
  return stageId != null && LOST_STAGE_IDS.includes(stageId);
}
