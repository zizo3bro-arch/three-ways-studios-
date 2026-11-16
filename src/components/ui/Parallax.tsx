import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';
import { useRef, type ReactNode } from 'react';

/* =========================================================
   Parallax — slow, small, GPU-only. Range is deliberately tiny
   (tens of pixels) so it reads as atmosphere, not as a gimmick.
   Disabled under prefers-reduced-motion.
   ========================================================= */

interface ParallaxProps {
  children: ReactNode;
  /** total travel in px across the element's scroll pass */
  distance?: number;
  className?: string;
  /** 0 = drifts up, 1 = drifts down */
  polarity?: number;
}

export function Parallax({ children, distance = 44, className, polarity = 0 }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const smooth = useSpring(scrollYProgress, { stiffness: 60, damping: 22, mass: 0.6 });
  const y = useTransform(smooth, [0, 1], [
    polarity === 0 ? distance : -distance,
    polarity === 0 ? -distance : distance,
  ]);

  return (
    <div ref={ref} className={className}>
      <motion.div style={reduceMotion ? undefined : { y }}>{children}</motion.div>
    </div>
  );
}
