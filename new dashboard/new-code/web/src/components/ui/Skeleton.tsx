/**
 * Skeleton loading placeholders (ALT-200).
 *
 * Replaces the single centered spinner on lists/cards with shimmer/pulse
 * placeholders that mirror the eventual layout — so content fades in without
 * the page jumping (cumulative layout shift) when data arrives.
 *
 * Usage:
 *   {loading ? <SkeletonTable rows={10} cols={5} /> : <LeadsTable ... />}
 *   {loading ? <SkeletonCards count={6} /> : <CompanyCards ... />}
 *   {loading ? <SkeletonText lines={3} /> : <p>{record.notes}</p>}
 *
 * - Uses Tailwind's `animate-pulse` + the neutral gray token for the fill.
 * - SkeletonTable/Cards expose an aria-busy="status" region with a
 *   visually-hidden "Loading…" label so assistive tech announces the wait.
 * - Pure presentational; no deps beyond react.
 */
import React from 'react';

/** Accept a CSS dimension as a number (px) or a raw string (e.g. '60%'). */
type Dimension = number | string;

function toCss(value: Dimension | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === 'number' ? `${value}px` : value;
}

interface SkeletonProps {
  width?: Dimension;
  height?: Dimension;
  /** Corner radius; number (px) or string. Defaults to var(--radius-input). */
  radius?: Dimension;
  className?: string;
  style?: React.CSSProperties;
}

/** A single shimmering placeholder block. */
export function Skeleton({ width, height, radius, className, style }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse${className ? ` ${className}` : ''}`}
      style={{
        width: toCss(width),
        height: toCss(height),
        borderRadius: toCss(radius) ?? 'var(--radius-input)',
        background: 'var(--color-gray-100)',
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

interface SkeletonTextProps {
  /** Number of stacked text bars. Defaults to 3. */
  lines?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Stacked text bars of slightly varying widths to mimic a paragraph.
 * The last line is shorter, like real wrapped text.
 */
export function SkeletonText({ lines = 3, className, style }: SkeletonTextProps) {
  // Deterministic widths so the layout is stable across renders.
  const widths = ['96%', '88%', '92%', '84%', '90%'];
  const count = Math.max(1, lines);
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{ display: 'flex', flexDirection: 'column', gap: 8, ...style }}
    >
      {Array.from({ length: count }, (_, i) => (
        <Skeleton
          key={i}
          height={12}
          width={i === count - 1 && count > 1 ? '60%' : widths[i % widths.length]}
          radius={4}
        />
      ))}
    </div>
  );
}

interface SkeletonTableProps {
  /** Body rows to render. Defaults to 8. */
  rows?: number;
  /** Columns per row. Defaults to 6. */
  cols?: number;
  className?: string;
  style?: React.CSSProperties;
}

const SR_ONLY: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

/**
 * A list/table placeholder built from divs (no <table>) using CSS grid, so it
 * drops into card-style list views and matches a ~44px row height. A faint
 * header row sits on top. Announced to assistive tech as a busy status region.
 */
export function SkeletonTable({ rows = 8, cols = 6, className, style }: SkeletonTableProps) {
  const colCount = Math.max(1, cols);
  const rowCount = Math.max(1, rows);
  const gridCols = `repeat(${colCount}, minmax(0, 1fr))`;

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className={className}
      style={{
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-card)',
        background: 'var(--color-surface)',
        overflow: 'hidden',
        ...style,
      }}
    >
      <span style={SR_ONLY}>Loading…</span>

      {/* Header row — fainter, slightly shorter bars. */}
      <div
        aria-hidden="true"
        style={{
          display: 'grid',
          gridTemplateColumns: gridCols,
          gap: 16,
          alignItems: 'center',
          height: 44,
          padding: '0 16px',
          background: 'var(--color-gray-50)',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        {Array.from({ length: colCount }, (_, c) => (
          <Skeleton key={c} height={10} width={c === 0 ? '70%' : '50%'} radius={4} />
        ))}
      </div>

      {/* Body rows. */}
      {Array.from({ length: rowCount }, (_, r) => (
        <div
          key={r}
          aria-hidden="true"
          style={{
            display: 'grid',
            gridTemplateColumns: gridCols,
            gap: 16,
            alignItems: 'center',
            height: 44,
            padding: '0 16px',
            borderBottom: r === rowCount - 1 ? 'none' : '1px solid var(--color-gray-100)',
          }}
        >
          {Array.from({ length: colCount }, (_, c) => (
            <Skeleton key={c} height={12} width={c === 0 ? '85%' : `${55 + ((r + c) % 4) * 8}%`} radius={4} />
          ))}
        </div>
      ))}
    </div>
  );
}

interface SkeletonCardsProps {
  /** Number of card placeholders. Defaults to 4. */
  count?: number;
  className?: string;
  style?: React.CSSProperties;
}

/** A responsive grid of card-shaped placeholders. */
export function SkeletonCards({ count = 4, className, style }: SkeletonCardsProps) {
  const cardCount = Math.max(1, count);
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 16,
        ...style,
      }}
    >
      <span style={SR_ONLY}>Loading…</span>
      {Array.from({ length: cardCount }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          style={{
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-card)',
            background: 'var(--color-surface)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* Avatar + title row. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Skeleton width={40} height={40} radius="50%" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              <Skeleton height={12} width="70%" radius={4} />
              <Skeleton height={10} width="45%" radius={4} />
            </div>
          </div>
          {/* Body lines. */}
          <SkeletonText lines={2} />
          {/* Footer / meta row. */}
          <Skeleton height={28} width="100%" radius="var(--radius-btn)" />
        </div>
      ))}
    </div>
  );
}
