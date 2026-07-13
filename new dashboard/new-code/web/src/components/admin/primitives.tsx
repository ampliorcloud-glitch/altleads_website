import React from 'react';
import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Status toggle pill — Figma: inline toggle + label                 */
/* ------------------------------------------------------------------ */

/** Toggle-style status display — matching Figma's "Active/Inactive" pill with dot. */
export function StatusToggle({
  enabled,
  onToggle,
  busy,
}: {
  enabled: boolean;
  onToggle?: () => void;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy || !onToggle}
      className="flex items-center gap-1.5 select-none disabled:opacity-60"
      style={{ cursor: onToggle ? 'pointer' : 'default' }}
      aria-label={enabled ? 'Disable' : 'Enable'}
    >
      {/* Toggle track */}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          width: 32,
          height: 18,
          borderRadius: 9,
          background: enabled ? '#22C55E' : '#E4E4E7',
          transition: 'background 0.2s',
          padding: '2px',
          flexShrink: 0,
          position: 'relative',
        }}
      >
        {busy ? (
          <Loader2 size={12} className="animate-spin text-white" style={{ margin: '0 auto' }} />
        ) : (
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 1px 2px rgba(0,0,0,0.18)',
              transform: enabled ? 'translateX(14px)' : 'translateX(0)',
              transition: 'transform 0.18s',
              display: 'block',
            }}
          />
        )}
      </span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: enabled ? '#16A34A' : '#71717A',
          whiteSpace: 'nowrap',
        }}
      >
        {enabled ? 'Active' : 'Inactive'}
      </span>
    </button>
  );
}

/** Muted tinted status pill — Figma flat badge style, no ring. */
export function StatusPill({ enabled }: { enabled: boolean }) {
  const s = enabled
    ? { bg: '#F0FDF4', text: '#16A34A', label: 'Active' }
    : { bg: 'rgba(196,77,77,0.06)', text: '#DC2626', label: 'Inactive' };
  return (
    <span
      style={{
        background: s.bg,
        color: s.text,
        fontSize: 11,
        fontWeight: 500,
        borderRadius: 4,
        padding: '2px 8px',
        display: 'inline-flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        lineHeight: '18px',
      }}
    >
      {s.label}
    </span>
  );
}

/** Role chip — brand blue tint (matching Figma yellow role tags). */
export function RoleChip({ label }: { label: string }) {
  return (
    <span
      style={{
        background: '#FEFCE8',
        color: '#854D0E',
        fontSize: 11,
        fontWeight: 500,
        borderRadius: 4,
        padding: '2px 8px',
        display: 'inline-flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        lineHeight: '18px',
      }}
    >
      {label}
    </span>
  );
}

/** Initials avatar — neutral circle. */
export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        background: '#E8F2FD',
        color: '#1A7EE8',
        fontWeight: 600,
        width: size,
        height: size,
        fontSize: size < 30 ? 10 : 12,
        flexShrink: 0,
        letterSpacing: '0.02em',
      }}
    >
      {initials}
    </span>
  );
}

/** Standard surface card — white, hairline border, 8px radius. */
export function Card({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

/**
 * Figma-style table header — blue text, blue underline on each header cell,
 * first cell is "Sr. No." in compact width.
 */
export function FigmaTableHead({
  columns,
}: {
  columns: { key: string; label: string; align?: 'left' | 'right'; width?: number | string }[];
}) {
  return (
    <thead>
      <tr style={{ borderBottom: '2px solid #E5E7EB', background: '#FFFFFF' }}>
        {columns.map((c, i) => (
          <th
            key={c.key}
            style={{
              padding: i === 0 ? '10px 12px' : '10px 16px',
              fontSize: 13,
              fontWeight: 600,
              color: '#1A7EE8',
              whiteSpace: 'nowrap',
              textAlign: c.align === 'right' ? 'right' : 'left',
              width: c.width,
              borderBottom: '2px solid #1A7EE8',
            }}
          >
            {c.label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function LoadingRow({ colSpan, label = 'Loading...' }: { colSpan: number; label?: string }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: '40px 16px', textAlign: 'center' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontSize: 13,
            color: '#9CA3AF',
          }}
        >
          <Loader2 size={16} className="animate-spin" />
          {label}
        </div>
      </td>
    </tr>
  );
}

export function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: '#9CA3AF' }}
      >
        {label}
      </td>
    </tr>
  );
}

export function ErrorRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13 }}>
        <span style={{ color: '#EF4444' }}>{label}</span>
      </td>
    </tr>
  );
}

/** Figma pencil edit icon button */
export function EditIconButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-stone-400 hover:text-stone-700 transition-colors"
      aria-label="Edit"
      style={{ padding: '4px 6px' }}
    >
      {/* pencil svg matching Figma */}
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M9.917 1.75a1.237 1.237 0 0 1 1.75 1.75L4.083 11.083l-2.333.583.583-2.333L9.917 1.75Z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/** Figma-style "+ Add X" primary button */
export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: '#1A7EE8',
        color: '#fff',
        fontSize: 13,
        fontWeight: 500,
        borderRadius: 6,
        padding: '8px 16px',
        border: 'none',
        cursor: 'pointer',
        height: 36,
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#1463B8'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#1A7EE8'; }}
    >
      <span style={{ fontSize: 16, lineHeight: 1, fontWeight: 400 }}>+</span>
      {label}
    </button>
  );
}

/** Figma-style section card with a left blue accent bar and title */
export function SectionCard({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: '1px solid #F3F4F6',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              display: 'block',
              width: 4,
              height: 20,
              background: '#1A7EE8',
              borderRadius: 2,
              flexShrink: 0,
            }}
          />
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>{title}</h3>
        </div>
        {action && <div>{action}</div>}
      </div>
      <div style={{ padding: '16px 20px' }}>{children}</div>
    </div>
  );
}
