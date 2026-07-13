import React from 'react';

/**
 * StageBadge — flat colored pill matching the Zen design system.
 * Slightly larger padding and radius for a more premium feel.
 * Border-radius: var(--radius-badge) = 6px.
 */

import { stageBadgeStyle } from '../../lib/statusColors';

interface StageBadgeProps {
  stage: string;
}

export function StageBadge({ stage }: StageBadgeProps) {
  const s = stageBadgeStyle(stage);
  return (
    <span
      style={{
        background: s.bg,
        color: s.text,
        fontSize: 11,
        fontWeight: 500,
        borderRadius: 'var(--radius-badge, 6px)',
        padding: '3px 10px',
        display: 'inline-flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        lineHeight: '18px',
        letterSpacing: '0.01em',
        transition: 'background var(--duration-fast, 200ms) ease, color var(--duration-fast, 200ms) ease',
      }}
    >
      {stage || '—'}
    </span>
  );
}
