/**
 * statusColors.ts — THE canonical status/stage color source (ruling F3,
 * AMBIGUOUS-DECISIONS "Engineered rulings 2026-07-02").
 *
 * Two palettes per stage, different jobs:
 *  - BADGE  (bg + text pair): pills/labels — Figma design-system pastels.
 *  - CHART  (single muted fill): bars/graphs — softer so large areas don't shout.
 *
 * Add new stages HERE, never inline in a component/page. Unknown stages fall
 * back to neutral gray via the helpers — never throw on unseen DB values.
 */

export interface BadgeStyle { bg: string; text: string; }

export const DEFAULT_BADGE_STYLE: BadgeStyle = { bg: '#F3F4F6', text: '#6B7280' };

export const STAGE_BADGE_STYLES: Record<string, BadgeStyle> = {
  // Real stages (stage_master values as they exist in prod — incl. typos)
  'Warm':                              { bg: '#EFF6FF', text: '#1D4ED8' },
  'Hot Prospect':                      { bg: 'rgba(196,77,77,0.06)', text: '#DC2626' },
  'New Meeting':                       { bg: '#F3F4F6', text: '#6B7280' },
  'Meeting Scheduled':                 { bg: '#F5F3FF', text: '#7C3AED' },
  'Meeting Confirmed':                 { bg: '#F0FDF4', text: '#16A34A' },
  'Meeting Successful':                { bg: '#F0FDF4', text: '#16A34A' },
  'Meeting Follow-Up':                 { bg: '#FFFBEB', text: '#D97706' },
  'Meeting Cancelled':                 { bg: 'rgba(196,77,77,0.06)', text: '#DC2626' },
  'Meeting Droped By Amplior':         { bg: 'rgba(196,77,77,0.06)', text: '#DC2626' },
  'Meeting Posponed by Lead':          { bg: '#FFFBEB', text: '#D97706' },
  'Meeting postponed by Salesperson':  { bg: '#FFFBEB', text: '#D97706' },
  'Meeting postponed by lead':         { bg: '#FFFBEB', text: '#D97706' },
  'Meeting cancelled by Altleads':     { bg: 'rgba(196,77,77,0.06)', text: '#DC2626' },
  'Meeting cancelled by sales team':   { bg: 'rgba(196,77,77,0.06)', text: '#DC2626' },
  'Meeting cancelled by Lead':         { bg: 'rgba(196,77,77,0.06)', text: '#DC2626' },
  // Legacy / Figma-visible stages
  'New':              { bg: '#F3F4F6', text: '#6B7280' },
  'Cold':             { bg: '#F3F4F6', text: '#6B7280' },
  'Contacted':        { bg: '#EFF6FF', text: '#1D4ED8' },
  'Engaged':          { bg: '#F5F3FF', text: '#7C3AED' },
  'Proposal Sent':    { bg: '#FFFBEB', text: '#D97706' },
  'Negotiation':      { bg: '#FFF7ED', text: '#EA580C' },
  'Closed Won':       { bg: '#F0FDF4', text: '#16A34A' },
  'Won':              { bg: '#16A34A', text: '#FFFFFF' }, // solid green (Figma "Won" button)
  'Closed Lost':      { bg: 'rgba(196,77,77,0.06)', text: '#DC2626' },
  'Meeting':          { bg: '#ECFEFF', text: '#0891B2' },
  'Request Approval': { bg: '#FFF7ED', text: '#EA580C' },
};

export function stageBadgeStyle(stage: string): BadgeStyle {
  return STAGE_BADGE_STYLES[stage] ?? DEFAULT_BADGE_STYLE;
}

/** Muted single-color fills for charts (dashboard bars etc.). */
export const STAGE_CHART_COLORS: Record<string, string> = {
  'Meeting Successful':               '#86efac',
  'Meeting Scheduled':                '#c4b5fd',
  'Meeting Confirmed':                '#6ee7b7',
  'Meeting Follow-Up':                '#fcd34d',
  'New Meeting':                      '#a1a1aa',
  'Warm':                             '#93c5fd',
  'Hot Prospect':                     '#fdba74',
  'Meeting Cancelled':                '#fca5a5',
  'Meeting Droped By Amplior':        '#fca5a5',
  'Meeting Posponed by Lead':         '#fde68a',
  'Meeting postponed by Salesperson': '#fde68a',
  'Meeting postponed by lead':        '#fde68a',
  'Meeting cancelled by Altleads':    '#fca5a5',
  'Meeting cancelled by sales team':  '#fca5a5',
  'Meeting cancelled by Lead':        '#fca5a5',
};

export function stageChartColor(stage: string, fallback = '#d4d4d8'): string {
  return STAGE_CHART_COLORS[stage] ?? fallback;
}
