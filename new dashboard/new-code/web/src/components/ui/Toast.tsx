/**
 * Global toast system (UX-AUDIT Top-30 #2) with Zen animations.
 *
 * One app-wide place for success / error / info feedback, replacing the ad-hoc
 * per-page inline notes that never dismissed (or vanished at random speeds).
 *
 * Usage:
 *   const toast = useToast();
 *   toast.success('Status updated');
 *   toast.error('You can only edit records you own');
 *
 * - Auto-dismisses (success/info 4s, errors 6s; pass duration:0 to make sticky).
 * - Renders into document.body via a portal so it sits above modals.
 * - The viewport is an aria-live region; errors are role="alert" so assistive
 *   tech announces results (UX-AUDIT a11y theme).
 * - Framer Motion spring entrance and smooth exit animations.
 */
import React, {
  createContext, useCallback, useContext, useMemo, useRef, useState,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { toastAnimation } from '../../lib/zenAnimations';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface ToastOptions {
  variant?: ToastVariant;
  /** ms before auto-dismiss; 0 keeps it until dismissed. */
  duration?: number;
}

interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
  duration: number;
}

interface ToastApi {
  show: (message: string, opts?: ToastOptions) => void;
  success: (message: string, opts?: Omit<ToastOptions, 'variant'>) => void;
  error: (message: string, opts?: Omit<ToastOptions, 'variant'>) => void;
  info: (message: string, opts?: Omit<ToastOptions, 'variant'>) => void;
  warning: (message: string, opts?: Omit<ToastOptions, 'variant'>) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const VARIANT_STYLE: Record<ToastVariant, { bg: string; border: string; fg: string; Icon: typeof Info }> = {
  success: { bg: '#F0FDF4', border: '#BBF7D0', fg: '#15803D', Icon: CheckCircle2 },
  error:   { bg: 'rgba(196,77,77,0.06)', border: 'rgba(196,77,77,0.15)', fg: '#B91C1C', Icon: AlertCircle },
  warning: { bg: '#FFFBEB', border: '#FDE68A', fg: '#B45309', Icon: AlertTriangle },
  info:    { bg: '#EFF6FF', border: '#BFDBFE', fg: '#1D4ED8', Icon: Info },
};

function ToastCard({ item, onClose }: { item: ToastItem; onClose: (id: number) => void }) {
  const s = VARIANT_STYLE[item.variant];
  const { Icon } = s;
  return (
    <motion.div
      layout
      variants={toastAnimation}
      initial="initial"
      animate="animate"
      exit="exit"
      role={item.variant === 'error' ? 'alert' : 'status'}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        minWidth: 300, maxWidth: 440,
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: 'var(--radius-card, 12px)',
        padding: '12px 14px',
        boxShadow: 'var(--shadow-lg)',
        color: s.fg,
        fontSize: 13,
        lineHeight: 1.5,
        pointerEvents: 'auto',
      }}
    >
      <Icon size={17} style={{ flexShrink: 0, marginTop: 2 }} />
      <span style={{ flex: 1, wordBreak: 'break-word' }}>{item.message}</span>
      <motion.button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onClose(item.id)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: s.fg, opacity: 0.5, padding: 2, flexShrink: 0, lineHeight: 0,
          borderRadius: 4,
        }}
      >
        <X size={14} />
      </motion.button>
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((message: string, opts?: ToastOptions) => {
    const variant = opts?.variant ?? 'info';
    const duration = opts?.duration ?? (variant === 'error' ? 6000 : 4000);
    const id = (idRef.current += 1);
    setItems((prev) => [...prev, { id, variant, message, duration }]);
    if (duration > 0) window.setTimeout(() => remove(id), duration);
  }, [remove]);

  const api = useMemo<ToastApi>(() => ({
    show,
    success: (m, o) => show(m, { ...o, variant: 'success' }),
    error: (m, o) => show(m, { ...o, variant: 'error' }),
    info: (m, o) => show(m, { ...o, variant: 'info' }),
    warning: (m, o) => show(m, { ...o, variant: 'warning' }),
  }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          aria-atomic="false"
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
            display: 'flex', flexDirection: 'column', gap: 12,
            pointerEvents: 'none',
          }}
        >
          <AnimatePresence mode="popLayout">
            {items.map((item) => (
              <ToastCard key={item.id} item={item} onClose={remove} />
            ))}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
