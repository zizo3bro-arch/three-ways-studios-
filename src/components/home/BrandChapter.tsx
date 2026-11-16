import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { SmokeField } from '../ui/SmokeField';
import { Reveal } from '../ui/Reveal';
import { EASE_CINEMATIC } from '../../lib/motion';

/* =========================================================
   CHAPTER 01 — THE BRAND FRAME
   Full screen, cinematic. Red smoke drifts behind the type, never
   over it. This is the only place the smoke lives at full strength.
   ========================================================= */

const LINES = ['WE CUT', 'THE LEG', 'LONG, WIDE', 'AND LOUD.'];

export function BrandChapter() {
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });

  const smokeY = useTransform(scrollYProgress, [0, 1], ['6%', '-10%']);
  const headlineY = useTransform(scrollYProgress, [0, 1], ['6%', '-4%']);

  return (
    <section
      id="brand"
      ref={ref}
      aria-labelledby="brand-statement"
      className="relative isolate flex min-h-[100svh] w-full items-center overflow-hidden bg-ivory py-24 sm:py-28"
    >
      {/* smoke stays behind every piece of content */}
      <motion.div style={reduceMotion ? undefined : { y: smokeY }} className="absolute inset-0 z-0">
        <SmokeField variant="full" opacity="mid" />
      </motion.div>

      <div aria-hidden="true" className="tws-grain pointer-events-none absolute inset-0 z-[2]" />

      <motion.div
        style={reduceMotion ? undefined : { y: headlineY }}
        className="relative z-10 mx-auto w-full max-w-[1660px] px-4 sm:px-6 lg:px-10"
      >
        <Reveal className="flex items-center gap-3" preset="soft">
          <span aria-hidden="true" className="h-px w-9 bg-crimson-bright/70 sm:w-14" />
          <p className="tws-eyebrow text-crimson-bright">Chapter 01 — The House</p>
        </Reveal>

        <h2
          id="brand-statement"
          className="mt-7 font-display uppercase leading-[0.87] tracking-[0.002em] text-ink sm:mt-9"
        >
          <span className="sr-only">We cut the leg long, wide and loud.</span>
          <span aria-hidden="true" className="block text-[clamp(2.9rem,11.6vw,9.6rem)]">
            {LINES.map((line, index) => (
              <span key={line} className="tws-line-mask block">
                <motion.span
                  initial={{ y: '110%', opacity: 0 }}
                  whileInView={{ y: '0%', opacity: 1 }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{ duration: reduceMotion ? 0.01 : 1.05, delay: reduceMotion ? 0 : index * 0.11, ease: EASE_CINEMATIC }}
                  className="block"
                >
                  {line}
                </motion.span>
              </span>
            ))}
          </span>
        </h2>

        <div className="mt-10 grid gap-9 sm:mt-12 lg:mt-16 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-5 lg:col-start-1">
            <Reveal preset="soft" delay={0.05}>
              <p className="font-serif text-[clamp(1.15rem,2.4vw,1.55rem)] italic leading-[1.45] text-ink sm:text-[1.3rem]">
                Three Ways Studios is a Cairo house built around a single obsession — the
                silhouette below the knee.
              </p>
            </Reveal>
          </div>

          <div className="lg:col-span-4 lg:col-start-7">
            <Reveal preset="soft" delay={0.14}>
              <p className="text-[14px] leading-[1.75] text-ink-soft sm:text-[15px]">
                Two patterns a season, cut from heavyweight selvedge and finished by hand in
                the atelier. No filler drops, no colour-of-the-month, no print. The garment
                carries the whole argument — cloth, rise, and a leg that keeps going.
              </p>
            </Reveal>
          </div>

          <div className="lg:col-span-2 lg:col-start-11">
            <Reveal preset="soft" delay={0.2}>
              <dl className="border-t border-ink/15">
                {[
                  ['Founded', 'Cairo 2024'],
                  ['Cloth', '13 — 14 oz'],
                  ['Pieces', '02'],
                ].map(([label, value]) => (
                  <div key={label} className="border-b border-ink/12 py-2.5">
                    <dt className="text-[8.5px] font-bold uppercase tracking-[0.24em] text-ink-faint">{label}</dt>
                    <dd className="mt-0.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </div>

        <Reveal className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3 sm:mt-16" preset="soft" delay={0.1}>
          <span aria-hidden="true" className="h-[1px] flex-1 bg-ink/15" />
          <p className="tws-signature tws-signature--ink text-[clamp(1.6rem,4.6vw,2.6rem)] leading-none">
            fashion beyond limits
          </p>
          <span aria-hidden="true" className="h-[1px] flex-1 bg-ink/15" />
        </Reveal>
      </motion.div>
    </section>
  );
}
