/**
 * Shared atoms for the Lead Workspace (panel + 3 tabs).
 * Theme: Inter, white surfaces, 1px #E5E7EB borders, brand blue #1A7EE8 used
 * for interactive accents. Matches Figma "New UI" design system.
 */
import React, { useState } from 'react';
import { Loader2, ChevronDown } from 'lucide-react';
import { initials } from '../../data/leadWorkspace';
import { CopyButton } from '../ui/CopyButton';

export const card = 'bg-white border border-gray-200 rounded-lg';

/* ── Loading / empty ─────────────────────────────────────────── */

export function LoadingBlock({ label = 'Loading...' }: { label?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 0',
        gap: 8,
        fontSize: 13,
        color: 'var(--color-gray-400)',
      }}
    >
      <Loader2 size={15} className="animate-spin" />
      {label}
    </div>
  );
}

export function EmptyBlock({ message }: { message: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        fontSize: 13,
        color: 'var(--color-gray-400)',
        textAlign: 'center',
      }}
    >
      {message}
    </div>
  );
}

/* ── Avatar (initials) ───────────────────────────────────────── */

export function Avatar({ name, system = false }: { name: string; system?: boolean }) {
  return (
    <span
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 600,
        flexShrink: 0,
        background: system ? 'var(--color-gray-100)' : 'var(--color-brand-light)',
        color: system ? 'var(--color-gray-500)' : 'var(--color-brand)',
        border: `1px solid ${system ? 'var(--border-color)' : 'rgba(196,149,106,0.25)'}`,
      }}
    >
      {system ? 'SY' : initials(name)}
    </span>
  );
}

/* ── Collapsible section (right panel) ───────────────────────── */

export function CollapsibleSection({
  title,
  action,
  defaultOpen = true,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-card)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--color-gray-700)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <ChevronDown
            size={14}
            color="var(--color-gray-400)"
            style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }}
          />
          {title}
        </button>
        {action}
      </div>
      {open && <div style={{ padding: '0 16px 16px' }}>{children}</div>}
    </div>
  );
}

/* ── Field rows ──────────────────────────────────────────────── */

export function PanelField({
  label,
  value,
  href,
  copy = false,
}: {
  label: string;
  value?: string | null;
  href?: string;
  /** When true, shows a copy-to-clipboard button next to a present value. */
  copy?: boolean;
}) {
  const has = value && value.trim();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 0' }}>
      <span style={{ fontSize: 11, color: 'var(--color-gray-400)', fontWeight: 500 }}>
        {label}
      </span>
      {has ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {href ? (
            <a
              href={href}
              target={href.startsWith('http') ? '_blank' : undefined}
              rel="noopener noreferrer"
              style={{ fontSize: 13, color: 'var(--color-brand)', wordBreak: 'break-all' }}
            >
              {value}
            </a>
          ) : (
            <span style={{ fontSize: 13, color: 'var(--color-gray-700)', wordBreak: 'break-word' }}>
              {value}
            </span>
          )}
          {copy ? <CopyButton value={value} label={label} /> : null}
        </span>
      ) : (
        <span style={{ fontSize: 13, color: 'var(--color-gray-300)' }}>—</span>
      )}
    </div>
  );
}

/* ── Form atoms ──────────────────────────────────────────────── */

export const inputCls =
  'w-full border rounded-md px-3 py-2 text-sm placeholder-gray-400 ' +
  'transition-colors outline-none input-brand-focus';

export function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label
      style={{
        display: 'block',
        marginBottom: 5,
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--color-gray-500)',
      }}
    >
      {children}
      {required && <span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span>}
    </label>
  );
}

/* ── Buttons ─────────────────────────────────────────────────── */

export function PrimaryButton({
  children,
  onClick,
  type = 'button',
  disabled,
  loading,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  loading?: boolean;
}) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        background: isDisabled ? 'var(--color-gray-300)' : 'var(--color-brand)',
        color: '#fff',
        fontWeight: 500,
        fontSize: 13,
        padding: '7px 16px',
        height: 34,
        borderRadius: 'var(--radius-btn)',
        border: 'none',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.15s',
        opacity: isDisabled ? 0.6 : 1,
      }}
      onMouseEnter={(e) => { if (!isDisabled) (e.currentTarget as HTMLElement).style.background = 'var(--color-brand-dark)'; }}
      onMouseLeave={(e) => { if (!isDisabled) (e.currentTarget as HTMLElement).style.background = 'var(--color-brand)'; }}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  disabled,
  loading,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const isDisabled = disabled || loading;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        background: 'var(--color-surface)',
        color: 'var(--color-gray-700)',
        fontWeight: 500,
        fontSize: 13,
        padding: '7px 16px',
        height: 34,
        borderRadius: 'var(--radius-btn)',
        border: '1px solid var(--border-input)',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        transition: 'border-color 0.15s, color 0.15s',
        opacity: isDisabled ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        if (!isDisabled) {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-brand)';
          (e.currentTarget as HTMLElement).style.color = 'var(--color-brand)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isDisabled) {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-input)';
          (e.currentTarget as HTMLElement).style.color = 'var(--color-gray-700)';
        }
      }}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

/* ── Inline error / success ──────────────────────────────────── */

export function InlineNote({ kind, children }: { kind: 'error' | 'success'; children: React.ReactNode }) {
  const color = kind === 'error' ? 'var(--color-danger)' : 'var(--color-success)';
  return (
    <p style={{ fontSize: 12, color, margin: '4px 0 0' }}>
      {children}
    </p>
  );
}
