/**
 * Global confirmation dialog (UX-AUDIT Top-30 #3).
 *
 * Before this, the only confirm in the entire app was one window.confirm — every
 * other irreversible action (cancel meeting, approve report, disable user,
 * unassign member, convert) fired on a single click. This provides one branded,
 * accessible confirm used everywhere.
 *
 * Usage:
 *   const confirm = useConfirm();
 *   if (await confirm({ title: 'Cancel this meeting?', message: '…', tone: 'danger', confirmLabel: 'Cancel meeting' })) {
 *     // proceed
 *   }
 *
 * - Returns a Promise<boolean> (true = confirmed).
 * - Escape or backdrop click resolves false.
 * - role="dialog" + aria-modal, initial focus on the confirm button, focus restore.
 * - Optional `requireText`: user must type a phrase to enable the confirm button
 *   (for the most destructive actions).
 */
import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { useFocusTrap } from '../../lib/useFocusTrap';
import { motion, AnimatePresence } from 'framer-motion';

export interface ConfirmOptions {
  title?: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  /** When set, the confirm button stays disabled until the user types this text. */
  requireText?: string;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface ActiveRequest {
  opts: ConfirmOptions;
  resolve: (ok: boolean) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<ActiveRequest | null>(null);
  const [typed, setTyped] = useState('');
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  // Keep Tab focus inside the confirm dialog while open (ALT-203).
  useFocusTrap(dialogRef, Boolean(active));

  const confirm = useCallback<ConfirmFn>((opts) => {
    lastFocused.current = (document.activeElement as HTMLElement) ?? null;
    setTyped('');
    return new Promise<boolean>((resolve) => {
      setActive({ opts, resolve });
    });
  }, []);

  const close = useCallback((ok: boolean) => {
    setActive((cur) => {
      cur?.resolve(ok);
      return null;
    });
    // Restore focus to whatever triggered the dialog.
    // Guard: if that element was unmounted while the dialog was open,
    // isConnected will be false — fall back to document.body (Fix 2 — ALT-UX).
    const prev = lastFocused.current;
    if (prev && typeof prev.focus === 'function') {
      window.setTimeout(() => {
        if (prev.isConnected) {
          prev.focus();
        } else {
          document.body.focus();
        }
      }, 0);
    }
  }, []);

  // Focus the confirm button when a dialog opens — unless it has a type-to-confirm
  // field, which autofocuses itself (don't steal focus from it).
  useEffect(() => {
    if (active && !active.opts.requireText) {
      window.setTimeout(() => confirmBtnRef.current?.focus(), 0);
    }
  }, [active]);

  // Escape closes (cancel).
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); close(false); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, close]);

  const o = active?.opts;
  const isDanger = o?.tone === 'danger';
  const needsText = Boolean(o?.requireText);
  const textOk = !needsText || typed.trim() === o?.requireText?.trim();

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {active && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onMouseDown={(e) => { if (e.target === e.currentTarget) close(false); }}
              style={{
                position: 'fixed', inset: 0, zIndex: 10000,
                background: 'rgba(0, 0, 0, 0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 16,
              }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-title"
                style={{
                  background: 'var(--color-surface)', 
                  borderRadius: 'var(--radius-card)', 
                  width: '100%', maxWidth: 420,
                  boxShadow: 'var(--shadow-lg)', 
                  overflow: 'hidden',
                }}
              >
                <div style={{ padding: '18px 20px 16px' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    {isDanger && (
                      <span style={{
                        flexShrink: 0, width: 34, height: 34, borderRadius: '50%',
                        background: 'rgba(196,77,77,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <AlertTriangle size={18} color="#DC2626" />
                      </span>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 id="confirm-title" style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--color-text-title, #111827)' }}>
                        {o?.title ?? 'Are you sure?'}
                      </h3>
                      {o?.message != null && (
                        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--color-text-subtle, #4B5563)', lineHeight: 1.5 }}>
                          {o.message}
                        </div>
                      )}
                      {needsText && (
                        <input
                          autoFocus
                          value={typed}
                          onChange={(e) => setTyped(e.target.value)}
                          placeholder={`Type "${o?.requireText}" to confirm`}
                          className="input-brand-focus"
                          style={{
                            marginTop: 10, width: '100%', height: 38, padding: '0 10px',
                            border: '1px solid var(--border-input)', 
                            borderRadius: 'var(--radius-btn)', fontSize: 13,
                            background: 'transparent', color: 'inherit'
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'flex-end', gap: 8,
                  padding: '12px 20px', 
                  background: 'var(--color-surface-base, #F9FAFB)', 
                  borderTop: '1px solid var(--border-subtle, #F3F4F6)',
                }}>
                  <button
                    type="button"
                    onClick={() => close(false)}
                    style={{
                      height: 38, padding: '0 14px', 
                      borderRadius: 'var(--radius-btn)', 
                      fontSize: 13, fontWeight: 500,
                      border: '1px solid var(--border-input)', 
                      background: 'var(--color-surface, #fff)', 
                      color: 'inherit', cursor: 'pointer',
                    }}
                  >
                    {o?.cancelLabel ?? 'Cancel'}
                  </button>
                  <button
                    ref={confirmBtnRef}
                    type="button"
                    disabled={!textOk}
                    onClick={() => close(true)}
                    style={{
                      height: 38, padding: '0 14px', 
                      borderRadius: 'var(--radius-btn)', 
                      fontSize: 13, fontWeight: 600,
                      border: 'none', cursor: textOk ? 'pointer' : 'not-allowed',
                      background: isDanger ? '#DC2626' : 'var(--color-brand)',
                      color: '#fff', opacity: textOk ? 1 : 0.5,
                    }}
                  >
                    {o?.confirmLabel ?? 'Confirm'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}
