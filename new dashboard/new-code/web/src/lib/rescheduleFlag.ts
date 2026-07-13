/**
 * rescheduleFlag.ts — ALT-480 reschedule intelligence.
 *
 * READ-ONLY display over data that already exists in meeting_reschedule.
 * There is NO migration — flipping this flag makes the feature live immediately.
 * Default false to keep prod visually unchanged until you choose to turn it on.
 */
export const RESCHEDULE_INSIGHT = false;
