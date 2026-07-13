/**
 * StatusBadge — coloured pill for status-like values (contact_status,
 * account_status, decision_power, feasibility, etc.).
 *
 * Matches the flat pill look of Badge.tsx (bg + text, 4px radius). Colours are
 * resolved from the lowercased value via a small keyword map; anything unknown
 * falls back to neutral grey. The `category` prop is accepted for future
 * per-category tuning but is not required.
 */

import React from 'react';

interface ToneStyle {
  bg: string;
  text: string;
}

const TONES: Record<string, ToneStyle> = {
  green: { bg: '#F0FDF4', text: '#16A34A' },
  blue: { bg: '#EFF6FF', text: '#1D4ED8' },
  amber: { bg: '#FFFBEB', text: '#D97706' },
  orange: { bg: '#FFF7ED', text: '#EA580C' },
  red: { bg: 'rgba(196,77,77,0.06)', text: '#DC2626' },
  purple: { bg: '#F5F3FF', text: '#7C3AED' },
  cyan: { bg: '#ECFEFF', text: '#0891B2' },
  grey: { bg: '#F3F4F6', text: '#6B7280' },
};

/** Map a normalised status value -> tone key. */
const VALUE_TONE: Record<string, keyof typeof TONES> = {
  // temperature
  hot: 'red',
  warm: 'amber',
  cold: 'blue',
  // outcomes
  won: 'green',
  lost: 'red',
  qualified: 'green',
  unqualified: 'grey',
  // pipeline-ish
  new: 'grey',
  open: 'blue',
  contacted: 'blue',
  engaged: 'purple',
  interested: 'green',
  not_interested: 'red',
  active: 'green',
  inactive: 'grey',
  pending: 'amber',
  // feasibility
  feasible: 'green',
  not_feasible: 'red',
  yes: 'green',
  no: 'red',
  maybe: 'amber',
  // decision power
  decision_maker: 'green',
  influencer: 'purple',
  gatekeeper: 'amber',
  end_user: 'cyan',
  high: 'green',
  medium: 'amber',
  low: 'grey',
};

function toneFor(value: string): ToneStyle {
  const norm = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  const toneKey = VALUE_TONE[norm];
  return toneKey ? TONES[toneKey] : TONES.grey;
}

interface StatusBadgeProps {
  value: string | null | undefined;
  /** Optional dropdown category (contact_status, account_status, …) — reserved. */
  category?: string;
}

export function StatusBadge({ value }: StatusBadgeProps) {
  const label = (value ?? '').trim();
  const tone = label ? toneFor(label) : TONES.grey;
  return (
    <span
      style={{
        background: tone.bg,
        color: tone.text,
        fontSize: 11,
        fontWeight: 500,
        borderRadius: 'var(--radius-badge, 4px)',
        padding: '2px 8px',
        display: 'inline-flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        lineHeight: '18px',
      }}
    >
      {label || '—'}
    </span>
  );
}
