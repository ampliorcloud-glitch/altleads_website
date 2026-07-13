/**
 * freshnessFlag.ts — ALT-484-lite cold-lead / freshness signal.
 *
 * READ-ONLY display over existing data — NO migration. Flipping this flag makes
 * the "last activity N days ago" badge live immediately. Default false so prod is
 * visually unchanged until you turn it on.
 *
 * Thresholds (whole days since last activity): warn ≥ WARN_DAYS, alert ≥ STALE_DAYS.
 */
export const FRESHNESS_INSIGHT = false;

export const WARN_DAYS = 14;
export const STALE_DAYS = 30;
