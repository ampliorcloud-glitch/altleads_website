/**
 * KeyboardHelp — global keyboard-shortcuts overlay (press "?").
 *
 * A centered modal listing the shortcuts that ACTUALLY work in the app today:
 *   • Cmd/Ctrl-K       open the global search / command palette (CommandPalette.tsx)
 *   • ↑ / ↓            move between results in the command palette
 *   • Enter            open the highlighted result / focused row
 *   • Enter / Space    open the focused list row (Leads/Companies/Contacts/…)
 *   • Esc              close any open dialog, drawer, palette — or this overlay
 *   • ?                open this shortcuts overlay
 *
 * Mounted once at the app root. App owns the global "?" (Shift+/) keydown that
 * opens it (only when the user isn't typing in a field). Mirrors the existing
 * modals: role="dialog" + aria-modal, focus trap (useFocusTrap), Escape-to-close,
 * a click-the-backdrop-to-close, and focus restore on close.
 */
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useFocusTrap } from '../../lib/useFocusTrap';

interface KeyboardHelpProps {
  open: boolean;
  onClose: () => void;
}

/** One row of the shortcuts table: a key (or key combo) and what it does. */
interface Shortcut {
  /** One or more <kbd> tokens; multiple = a combo (joined visually). */
  keys: string[];
  label: string;
}

/** ONLY shortcuts that are wired up and working in the app today. */
const SHORTCUTS: Shortcut[] = [
  { keys: ['Ctrl', 'K'], label: 'Open search (also ⌘K on Mac)' },
  { keys: ['↑', '↓'], label: 'Move between search results' },
  { keys: ['J'], label: 'Move the row cursor down (in a list)' },
  { keys: ['K'], label: 'Move the row cursor up (in a list)' },
  { keys: ['Enter'], label: 'Open the highlighted result or focused row' },
  { keys: ['X'], label: 'Select / unselect the focused row' },
  { keys: ['/'], label: 'Jump to the search box' },
  { keys: ['Space'], label: 'Open the focused list row' },
  { keys: ['Esc'], label: 'Clear the row cursor / close any dialog or search' },
  { keys: ['?'], label: 'Show this shortcuts list' },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 22,
        height: 22,
        padding: '0 7px',
        fontSize: 11,
        fontWeight: 600,
        fontFamily: 'inherit',
        color: '#374151',
        background: '#F9FAFB',
        border: '1px solid #D1D5DB',
        borderRadius: 5,
        boxShadow: '0 1px 0 #E5E7EB',
        lineHeight: 1,
      }}
    >
      {children}
    </kbd>
  );
}

export function KeyboardHelp({ open, onClose }: KeyboardHelpProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Keep Tab focus inside the dialog while open (matches the other modals).
  useFocusTrap(dialogRef, open);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Move focus into the dialog when it opens, and restore it to whatever was
  // focused before, on close (a11y — same pattern the app uses elsewhere).
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => dialogRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(t);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(17,24,39,0.36)', zIndex: 11000 }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        tabIndex={-1}
        style={{
          background: '#FFFFFF',
          borderRadius: 12,
          border: '1px solid #E5E7EB',
          boxShadow: '0 20px 60px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)',
          width: '100%',
          maxWidth: 460,
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
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>
            Keyboard shortcuts
          </h3>
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

        {/* Body — shortcuts list */}
        <div style={{ padding: '8px 20px 16px' }}>
          {SHORTCUTS.map((s, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                padding: '10px 0',
                borderBottom: i < SHORTCUTS.length - 1 ? '1px solid #F3F4F6' : 'none',
              }}
            >
              <span style={{ fontSize: 13, color: '#374151' }}>{s.label}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                {s.keys.map((k, j) => (
                  <React.Fragment key={j}>
                    {j > 0 && (
                      <span style={{ fontSize: 11, color: '#9CA3AF' }}>+</span>
                    )}
                    <Kbd>{k}</Kbd>
                  </React.Fragment>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default KeyboardHelp;
