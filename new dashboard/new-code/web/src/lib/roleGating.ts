/**
 * roleGating.ts — Feature-flag wrapper for strict role-based UI gating.
 *
 * ALL new role restrictions introduced for the locked access-control model
 * (ACCESS-CONTROL-MODEL.md Part 9, 2026-06-28) are guarded by the
 * STRICT_ROLE_GATING flag (default: false).
 *
 * When false  → behaviour is exactly as it was before this change (prod-safe).
 * When true   → the locked role rules below are enforced in the UI layer.
 *
 * Flip to true only AFTER throwaway-login RLS validation passes (see Part 9
 * VALIDATION PLAN).  The flag lives here so there is exactly ONE place to flip.
 *
 * Relevant tickets: ALT-152/433, ALT-458, ALT-459, ALT-463.
 */

// ── Master gate ──────────────────────────────────────────────────────────────
//
// Set to true when you are ready to enforce the locked role model in the UI.
// RLS enforcement is independent and lives in apply-access-control-rls.cjs.
//
export const STRICT_ROLE_GATING = false;

// ── Role capability predicates ───────────────────────────────────────────────
//
// Each predicate receives the relevant auth flags and returns a boolean that
// represents what the UI SHOULD do when STRICT_ROLE_GATING is true.
// Callers wrap them like:
//
//   const canEdit = canEditCompanyContact(flags) && STRICT_ROLE_GATING
//                   ? false
//                   : existingCheck;
//
// Or more idiomatically use the helper returned by gated():
//
//   const show = gated(canEditCompanyContact(flags), wasAlreadyTrue);
//

export interface RoleFlags {
  isAdmin: boolean;
  isTeamLead: boolean;
  isQC: boolean;
  isAgent: boolean;
  isSalesUser: boolean;
  canReassign: boolean;  // resolved BEFORE this module — includes QC exclusion
}

/**
 * Whether this role may CREATE or EDIT company_master / contact_master records.
 * Admin, Team Lead, QC only.  Agents and Sales are DENIED.
 * (ALT-458 / Part 9 "AGENT does NOT edit company or contact master")
 */
export function canEditCompanyContact(flags: RoleFlags): boolean {
  return flags.isAdmin || flags.isTeamLead || flags.isQC;
}

/**
 * Whether this role may APPROVE lead reports.
 * Admin, Team Lead, QC.  (QC already included in isApprover — this is a
 * parallel helper for callers that only have RoleFlags.)
 */
export function canApprove(flags: RoleFlags): boolean {
  return flags.isAdmin || flags.isTeamLead || flags.isQC;
}

/**
 * Whether this role may REASSIGN a record's owner.
 * Admin and Team Lead only.  QC cannot reassign (Part 9 "QC — like TL minus assign").
 * Agents and Sales cannot reassign.
 */
export function canReassignRecord(flags: RoleFlags): boolean {
  return flags.isAdmin || flags.isTeamLead;
  // NOTE: isSalesHead is NOT included here for the internal CRM; the sales-portal
  // downline reassignment is deferred. canReassign in AuthContext still includes
  // isSalesHead for the /sales shell — see AuthContext.tsx comment.
}

/**
 * Whether this agent-role user may edit the lead report / outcome fields.
 * Agents may edit lead_report fields ONLY from "Meeting Scheduled" (stage_id 4) onward.
 * Admin/TL/QC may always edit. Sales may never edit.
 *
 * @param flags     Role flags for the current user.
 * @param stageId   The current lead_report.stage_id (null = no report yet → deny agent).
 */
export function agentCanEditLeadReport(flags: RoleFlags, stageId: number | null): boolean {
  if (flags.isAdmin || flags.isTeamLead || flags.isQC) return true;
  if (flags.isSalesUser) return false;
  if (flags.isAgent) {
    // stage_id 4 = "Meeting Scheduled" (DB-confirmed 2026-06-28)
    // Agents may edit at stage 4 and all subsequent stages.
    return stageId != null && stageId >= 4;
  }
  return false;
}

// ── Gate helper ──────────────────────────────────────────────────────────────

/**
 * Apply a role gate only when STRICT_ROLE_GATING is enabled.
 *
 * @param strictValue  What the value should be under the strict model.
 * @param legacyValue  The current value (before this change).
 * @returns legacyValue when gating is off, strictValue when gating is on.
 */
export function gated<T>(strictValue: T, legacyValue: T): T {
  return STRICT_ROLE_GATING ? strictValue : legacyValue;
}
