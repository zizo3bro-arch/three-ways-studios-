import type { Transition, Variants } from 'framer-motion';

/* =========================================================
   MOTION LANGUAGE — one restrained vocabulary for the whole site.
   Everything is opacity + transform only (no layout animation),
   so it stays cheap on mobile and honours prefers-reduced-motion
   through <MotionConfig reducedMotion="user"> in App.
   ========================================================= */

export const EASE_CINEMATIC: Transition['ease'] = [0.22, 1, 0.36, 1];

export const softTransition: Transition = {
  duration: 0.72,
  ease: EASE_CINEMATIC,
};

export const revealUp: Variants = {
  hidden: { opacity: 0, y: 26 },
  visible: { opacity: 1, y: 0, transition: softTransition },
};

export const revealSoft: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE_CINEMATIC } },
};

export const lineReveal: Variants = {
  hidden: { y: '112%', opacity: 0 },
  visible: { y: '0%', opacity: 1, transition: { duration: 1.05, ease: EASE_CINEMATIC } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.965 },
  visible: { opacity: 1, scale: 1, transition: { duration: 1.05, ease: EASE_CINEMATIC } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.85, ease: 'easeOut' } },
};

export function stagger(children = 0.08, delay = 0): Variants {
  return {
    hidden: {},
    visible: {
      transition: { staggerChildren: children, delayChildren: delay },
    },
  };
}

export const viewportOnce = { once: true, amount: 0.28 } as const;
export const viewportHero = { once: true, amount: 0.05 } as const;

/** Overlay transitions shared by drawer, search, account and menu. */
export const overlayBackdrop: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3, ease: 'easeOut' } },
};

export const overlayPanelRight: Variants = {
  hidden: { x: '100%' },
  visible: { x: 0, transition: { type: 'spring', damping: 32, stiffness: 300 } },
};

export const overlaySheet: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.42, ease: EASE_CINEMATIC } },
};
