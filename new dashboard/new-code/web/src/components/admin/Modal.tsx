import React, { useEffect, useRef, useId, isValidElement, cloneElement } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '../../lib/useFocusTrap';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Footer actions, rendered right-aligned. */
  footer?: ReactNode;
  width?: number;
}

export function Modal({ open, title, onClose, children, footer, width = 460 }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Keep Tab focus inside the dialog while open (ALT-203).
  useFocusTrap(dialogRef, open);

  // Escape closes. (Re-registers when onClose changes — harmless; just a listener.)
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Move focus into the dialog ONCE when it opens (a11y — UX-AUDIT Top#26).
  // CRITICAL: depend on `open` ONLY. If onClose were a dep, the parent re-rendering
  // on every keystroke (new onClose identity) would re-run this and re-focus the
  // dialog, stealing focus from inputs after each character typed.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => dialogRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(17,24,39,0.36)' }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{
          background: '#FFFFFF',
          borderRadius: 12,
          border: '1px solid #E5E7EB',
          boxShadow:
            '0 20px 60px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)',
          width: '100%',
          maxWidth: width,
          maxHeight: '90vh',
          overflowY: 'auto',
          outline: 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid #F3F4F6',
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#9CA3AF',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              borderRadius: 4,
            }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px' }}>{children}</div>

        {/* Footer */}
        {footer && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 8,
              padding: '12px 20px',
              borderTop: '1px solid #F3F4F6',
              background: '#F9FAFB',
              borderRadius: '0 0 12px 12px',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Form field primitives                                               */
/* ------------------------------------------------------------------ */

const fieldInput: React.CSSProperties = {
  fontSize: 13,
  padding: '7px 10px',
  border: '1px solid #D1D5DB',
  borderRadius: 6,
  background: '#fff',
  color: '#374151',
  outline: 'none',
  height: 36,
  width: '100%',
  transition: 'border-color 0.15s',
  boxSizing: 'border-box',
};

export function Field({ label, children }: { label: string; children: ReactNode }) {
  const autoId = useId();
  const controlId = isValidElement(children) ? `${autoId}-control` : undefined;
  const labeled =
    controlId && isValidElement(children)
      ? cloneElement(children as React.ReactElement<{ id?: string }>, {
          id: (children as React.ReactElement<{ id?: string }>).props.id ?? controlId,
        })
      : children;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label htmlFor={controlId} style={{ fontSize: 12, fontWeight: 500, color: '#6B7280' }}>{label}</label>
      {labeled}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  id?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={fieldInput}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = '#1A7EE8';
        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(196,149,106,0.1)';
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = '#D1D5DB';
        e.currentTarget.style.boxShadow = 'none';
      }}
    />
  );
}

export function SelectInput({
  value,
  onChange,
  children,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  id?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...fieldInput, cursor: 'pointer' }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = '#1A7EE8';
        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(196,149,106,0.1)';
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = '#D1D5DB';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {children}
    </select>
  );
}

/* ------------------------------------------------------------------ */
/*  Buttons                                                             */
/* ------------------------------------------------------------------ */

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: disabled ? '#93C5FD' : '#1A7EE8',
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: 500,
        borderRadius: 6,
        padding: '7px 16px',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        height: 34,
        transition: 'background 0.15s',
        opacity: disabled ? 0.7 : 1,
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        if (!disabled)
          (e.currentTarget as HTMLButtonElement).style.background = '#1463B8';
      }}
      onMouseLeave={(e) => {
        if (!disabled)
          (e.currentTarget as HTMLButtonElement).style.background = '#1A7EE8';
      }}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: '#FFFFFF',
        color: '#374151',
        fontSize: 13,
        fontWeight: 500,
        borderRadius: 6,
        padding: '7px 16px',
        border: '1px solid #D1D5DB',
        cursor: disabled ? 'not-allowed' : 'pointer',
        height: 34,
        transition: 'border-color 0.15s, color 0.15s',
        opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = '#1A7EE8';
          (e.currentTarget as HTMLButtonElement).style.color = '#1A7EE8';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = '#D1D5DB';
          (e.currentTarget as HTMLButtonElement).style.color = '#374151';
        }
      }}
    >
      {children}
    </button>
  );
}
