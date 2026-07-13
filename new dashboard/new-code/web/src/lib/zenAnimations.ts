import type { Variants, Transition } from 'framer-motion';

/* ============================================================
   ZEN ANIMATION PRESETS — Framer Motion
   Consistent animation language across the app.
   ============================================================ */

// ---------- EASING ----------
export const zenEase = {
  out: [0.16, 1, 0.3, 1] as const,
  spring: { type: 'spring' as const, stiffness: 300, damping: 30 },
  springBouncy: { type: 'spring' as const, stiffness: 400, damping: 25 },
  gentle: { type: 'spring' as const, stiffness: 200, damping: 20 },
};

// ---------- PAGE TRANSITIONS ----------
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

export const pageTransitionConfig: Transition = {
  duration: 0.3,
  ease: [0.16, 1, 0.3, 1],
};

// ---------- STAGGER CONTAINER ----------
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

export const staggerContainerFast: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.05,
    },
  },
};

// ---------- STAGGER ITEMS ----------
export const staggerItem: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  },
};

export const staggerItemScale: Variants = {
  initial: { opacity: 0, scale: 0.95, y: 8 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  },
};

// ---------- CARD ANIMATIONS ----------
export const cardHover = {
  rest: {
    y: 0,
    boxShadow: '0 1px 2px rgba(44,34,26,0.04)',
    transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
  },
  hover: {
    y: -2,
    boxShadow: '0 10px 15px -3px rgba(44,34,26,0.08), 0 4px 6px -4px rgba(44,34,26,0.04)',
    transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
  },
  tap: {
    y: 0,
    scale: 0.98,
    transition: { duration: 0.1 },
  },
};

// ---------- MODAL / DIALOG ----------
export const modalOverlay: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const modalContent: Variants = {
  initial: { opacity: 0, scale: 0.96, y: 12 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: 8,
    transition: { duration: 0.15 },
  },
};

// ---------- DRAWER / SLIDE ----------
export const drawerRight: Variants = {
  initial: { x: '100%' },
  animate: { x: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } },
  exit: { x: '100%', transition: { duration: 0.2 } },
};

export const drawerLeft: Variants = {
  initial: { x: '-100%' },
  animate: { x: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } },
  exit: { x: '-100%', transition: { duration: 0.2 } },
};

// ---------- TOAST ----------
export const toastAnimation: Variants = {
  initial: { opacity: 0, y: 16, scale: 0.95 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 400, damping: 25 },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.95,
    transition: { duration: 0.15 },
  },
};

// ---------- FADE ----------
export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

// ---------- SCALE IN (tooltips, popovers) ----------
export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.9 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.1 },
  },
};

// ---------- TABLE ROW ----------
export const tableRow: Variants = {
  initial: { opacity: 0, x: -8 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
  },
};

// ---------- NOTIFICATION BELL RING ----------
export const bellRing = {
  initial: { rotate: 0 },
  ring: {
    rotate: [0, 15, -15, 10, -10, 5, 0],
    transition: { duration: 0.6, ease: 'easeInOut' },
  },
};

// ---------- BUTTON PRESS ----------
export const buttonPress = {
  whileTap: { scale: 0.97 },
  whileHover: { scale: 1.02 },
  transition: { type: 'spring' as const, stiffness: 400, damping: 17 },
};

// ---------- SIDEBAR NAV ITEM ----------
export const navItemHover = {
  rest: { backgroundColor: 'transparent' },
  hover: { backgroundColor: 'var(--color-surface-hover)' },
};

// ---------- SCROLL REVEAL (for use with Framer motion.div) ----------
export const scrollReveal: Variants = {
  offscreen: { opacity: 0, y: 20 },
  onscreen: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
};
