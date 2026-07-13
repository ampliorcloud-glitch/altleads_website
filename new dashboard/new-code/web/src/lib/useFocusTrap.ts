/**
 * useFocusTrap — keep keyboard focus inside an open modal/dialog (ALT-203).
 *
 * While `active`, Tab / Shift+Tab cycle only through the focusable elements
 * inside the referenced container, so keyboard and screen-reader users can't
 * tab out into the (inert) page behind the dialog. Pairs with the role="dialog"
 * + aria-modal + Escape-to-close + focus-restore the modals already have.
 *
 * Usage:
 *   const ref = useRef<HTMLDivElement>(null);
 *   useFocusTrap(ref, open);
 *   return <div ref={ref} role="dialog" aria-modal="true"> … </div>;
 *
 * - Pure event-listener side effect; no setState, nothing during render.
 * - Re-queries focusable children on each Tab (handles dynamically added fields).
 */
import { useEffect } from 'react';
import type { RefObject } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
): void {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !container) return;

      // Only elements actually rendered/visible (offsetParent !== null) can take focus.
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

      if (focusable.length === 0) {
        // Nothing focusable — keep focus on the container itself.
        e.preventDefault();
        container.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (activeEl === first || !container.contains(activeEl)) {
          e.preventDefault();
          last.focus();
        }
      } else if (activeEl === last || !container.contains(activeEl)) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [active, containerRef]);
}
