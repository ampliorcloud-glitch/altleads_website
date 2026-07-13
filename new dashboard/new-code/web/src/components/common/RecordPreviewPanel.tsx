/**
 * RecordPreviewPanel — generic right-hand slide-over "preview" surface (ALT-327/328).
 *
 * The reusable SHELL behind the list-row preview pattern: click a row → a compact
 * "mini record" slides in from the right instead of navigating away, with an
 * "Open full record →" affordance for the full detail page.
 *
 * Presentation only — it fetches no data and knows nothing about the record type.
 * The caller supplies the body (`children`) and the actions:
 *   - openFullHref → the full detail page URL; the "Open full record" action opens
 *                    it in a NEW browser tab (ALT-334) via window.open(..., '_blank').
 *   - onOpenFull   → legacy fallback: a click handler (e.g. navigate) used only
 *                    when openFullHref is not supplied. Prefer openFullHref so the
 *                    record opens in a new tab and the preview list stays put.
 *   - onClose      → dismiss the panel
 *
 * Behaviour matches the rest of the app's overlays: semi-transparent backdrop,
 * close on ESC + backdrop click, and the shared useFocusTrap so keyboard focus
 * stays inside while open (role="dialog" + aria-modal).
 *
 * This is the pilot pattern; keep it record-agnostic so other modules (Leads,
 * Companies, Meetings) can drop their own *Preview body inside the same shell.
 */
import { useEffect, useRef } from 'react';
import type { ReactNode, CSSProperties } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { useFocusTrap } from '../../lib/useFocusTrap';

export function RecordPreviewPanel({
  title,
  onClose,
  onOpenFull,
  openFullHref,
  openFullLabel = 'Open full record',
  children,
}: {
  title?: string;
  onClose: () => void;
  /** Legacy click handler; only used when openFullHref is not provided. */
  onOpenFull?: () => void;
  /** Detail-page URL — opened in a NEW tab when set (ALT-334). Preferred. */
  openFullHref?: string;
  openFullLabel?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true);

  // Close on ESC.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      {/* Backdrop — click to dismiss. */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(17, 24, 39, 0.35)',
          backdropFilter: 'blur(1px)',
        }}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title ? `${title} preview` : 'Record preview'}
        tabIndex={-1}
        style={{
          position: 'relative',
          width: 420,
          maxWidth: '92vw',
          height: '100%',
          background: 'var(--color-surface, #fff)',
          boxShadow: '-8px 0 24px rgba(0, 0, 0, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'recordPreviewSlideIn 0.18s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '12px 14px 12px 18px',
            borderBottom: '1px solid var(--border-color, #E5E7EB)',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', letterSpacing: 0.2 }}>
            {title ?? 'Preview'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {(() => {
              // Shared visual for the "Open full record" action (button or anchor).
              const openFullStyle: CSSProperties = {
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                fontWeight: 500,
                color: '#fff',
                background: 'var(--color-brand, #1A7EE8)',
                border: 'none',
                borderRadius: 6,
                padding: '6px 11px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                textDecoration: 'none',
              };
              // Preferred: open the detail page in a NEW tab (ALT-334).
              if (openFullHref) {
                return (
                  <a
                    href={openFullHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={openFullStyle}
                    title={openFullLabel}
                  >
                    {openFullLabel}
                    <ArrowRight size={13} />
                  </a>
                );
              }
              // Legacy fallback: in-app navigation via the supplied handler.
              if (onOpenFull) {
                return (
                  <button type="button" onClick={onOpenFull} style={openFullStyle} title={openFullLabel}>
                    {openFullLabel}
                    <ArrowRight size={13} />
                  </button>
                );
              }
              return null;
            })()}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              title="Close (Esc)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 30,
                height: 30,
                color: '#6B7280',
                background: 'none',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#F3F4F6'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Body (scrolls) */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 18px' }}>
          {children}
        </div>
      </div>

      <style>{`
        @keyframes recordPreviewSlideIn {
          from { transform: translateX(16px); opacity: 0.4; }
          to   { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default RecordPreviewPanel;
