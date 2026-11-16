import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { lineReveal, revealSoft, revealUp, stagger, viewportOnce, viewportHero } from '../../lib/motion';
import type { Variants } from 'framer-motion';

/* =========================================================
   Reveal — the house scroll animation. A handful of presets, one
   behaviour: fires once, transform+opacity only, and reduced motion
   is honoured globally by <MotionConfig reducedMotion="user">.
   ========================================================= */

type Preset = 'up' | 'soft' | 'line' | 'stagger' | 'none';
type Tag = 'div' | 'span' | 'li' | 'p' | 'h2' | 'section';

const PRESETS: Record<Preset, Variants> = {
  up: revealUp,
  soft: revealSoft,
  line: lineReveal,
  stagger: stagger(0.09, 0.05),
  none: { hidden: {}, visible: {} },
};

interface RevealProps {
  children: ReactNode;
  preset?: Preset;
  delay?: number;
  className?: string;
  amount?: 'hero' | 'section';
  as?: Tag;
  id?: string;
}

export function Reveal({
  children,
  preset = 'up',
  delay = 0,
  className,
  amount = 'section',
  as = 'div',
  id,
}: RevealProps) {
  const Component =
    as === 'li'
      ? motion.li
      : as === 'span'
        ? motion.span
        : as === 'p'
          ? motion.p
          : as === 'h2'
            ? motion.h2
            : as === 'section'
              ? motion.section
              : motion.div;

  return (
    <Component
      id={id}
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={amount === 'hero' ? viewportHero : viewportOnce}
      variants={PRESETS[preset]}
      transition={delay ? { delay } : undefined}
    >
      {children}
    </Component>
  );
}
