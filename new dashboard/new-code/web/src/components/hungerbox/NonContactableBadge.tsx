/**
 * NonContactableBadge — visual indicator shown on contacts/companies that are
 * DNC or non-feasible. Provides the reddish-blur wrapper treatment described in
 * HUNGERBOX-LAUNCH.md §2/§3.
 *
 * When HUNGERBOX_FEATURES is false this component renders nothing (feature-flagged).
 */
import React from 'react';
import { HUNGERBOX_FEATURES } from '../../lib/hungerbox';
import type { ContactNonContactableState } from '../../data/dnc';

// -----------------------------------------------------------------------
// Inline badge (small pill for list rows and detail headers)
// -----------------------------------------------------------------------
interface BadgeProps {
  state: ContactNonContactableState;
}

export function NonContactableBadge({ state }: BadgeProps) {
  if (!HUNGERBOX_FEATURES) return null;
  if (!state.is_non_contactable) return null;

  const label =
    state.company_dnc || state.site_dnc
      ? state.company_non_feasible || state.site_non_feasible
        ? 'DNC + Non-feasible'
        : 'DNC'
      : 'Non-feasible';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: 'rgba(196,77,77,0.06)',
        color: '#DC2626',
        border: '1px solid rgba(196,77,77,0.15)',
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.4,
        padding: '2px 6px',
        textTransform: 'uppercase',
        lineHeight: '14px',
        flexShrink: 0,
      }}
      title={state.reason ?? undefined}
    >
      {label}
    </span>
  );
}

// -----------------------------------------------------------------------
// Row blur wrapper — wraps a table row's content in a reddish-blur overlay
// when the contact / company is non-contactable.
// -----------------------------------------------------------------------
interface BlurWrapperProps {
  state: ContactNonContactableState;
  children: React.ReactNode;
  /** Additional className forwarded to the outer span. */
  className?: string;
}

export function NonContactableBlurWrapper({ state, children, className }: BlurWrapperProps) {
  if (!HUNGERBOX_FEATURES || !state.is_non_contactable) {
    return <>{children}</>;
  }

  return (
    <span
      className={className}
      style={{
        display: 'contents',
        position: 'relative',
      }}
    >
      <span
        style={{
          display: 'contents',
          filter: 'blur(1.5px)',
          opacity: 0.55,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
        title={state.reason ?? 'Non-contactable'}
        aria-label={`Non-contactable: ${state.reason ?? ''}`}
      >
        {children}
      </span>
    </span>
  );
}

// -----------------------------------------------------------------------
// Tooltip / reason chip for detail pages
// -----------------------------------------------------------------------
interface ReasonChipProps {
  state: ContactNonContactableState;
}

export function NonContactableReasonChip({ state }: ReasonChipProps) {
  if (!HUNGERBOX_FEATURES || !state.is_non_contactable) return null;

  const parts: string[] = [];
  if (state.company_dnc) parts.push('Whole company is DNC');
  if (state.site_dnc) parts.push('This site is DNC');
  if (state.company_non_feasible) parts.push('Whole company is non-feasible');
  if (state.site_non_feasible) parts.push('This site is non-feasible');

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'flex-start',
        gap: 8,
        background: 'rgba(196,77,77,0.06)',
        border: '1px solid rgba(196,77,77,0.15)',
        borderRadius: 6,
        padding: '8px 12px',
        fontSize: 12,
        color: '#991B1B',
        lineHeight: 1.5,
      }}
      role="alert"
    >
      <span style={{ fontWeight: 700 }}>
        {state.reason}
      </span>
      {parts.length > 1 && (
        <span style={{ color: '#B91C1C' }}>
          ({parts.join('; ')})
        </span>
      )}
    </div>
  );
}
