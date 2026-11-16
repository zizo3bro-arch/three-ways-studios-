import { motion, useReducedMotion, useScroll, useSpring } from 'framer-motion';

/* Hairline crimson progress rule pinned under the navigation. */
export function ScrollProgress() {
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.4 });

  if (reduceMotion) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[65] h-[2px]">
      <motion.div
        style={{ scaleX }}
        className="h-full w-full origin-left bg-crimson-bright/80"
      />
    </div>
  );
}
