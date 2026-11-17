import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Reveal } from '../ui/Reveal';
import { SprayType } from '../ui/SprayType';
import { EASE_CINEMATIC } from '../../lib/motion';

/* =========================================================
   CHAPTER 01 — THE HOUSE
   The statement, set enormous on the paper with the name
   ghosted behind it in spray paint. No photo, no panel:
   pure typography doing the work.
   ========================================================= */

const LINES = ['WE CUT', 'THE LEG', 'LONG, WIDE', 'AND LOUD.'];

export function BrandChapter() {
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const drift = useTransform(scrollYProgress, [0, 1], ['3%', '-6%']);
  const ghostX = useTransform(scrollYProgress, [0, 1], ['-3%', '3%']);

  return (
    <section
      id="brand"
      ref={ref}
      aria-labelledby="brand-statement"
      className="relative isolate overflow-hidden border-t border-ink/14 py-16 sm:py-24 lg:py-32"
    >
      {/* ghosted name, huge and low-contrast behind the statement */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-1/2 z-0 -translate-y-1/2"
      >
        <motion.div style={reduceMotion ? undefined : { x: ghostX }} className="opacity-[0.075]">
          <SprayType text="THREE WAYS" />
        </motion.div>
      </div>

      <motion.div
        style={reduceMotion ? undefined : { y: drift }}
        className="relative z-10 mx-auto w-full max-w-[1800px] px-4 sm:px-6 lg:px-10"
      >
        <Reveal preset="soft">
          <p className="tws-index">01 / The house</p>
        </Reveal>

        <h2
          id="brand-statement"
          className="mt-6 font-display uppercase leading-[0.84] tracking-[0.002em] text-ink sm:mt-8"
        >
          <span className="sr-only">We cut the leg long, wide and loud.</span>
          <span aria-hidden="true" className="block" style={{ fontSize: 'clamp(2.6rem, 10.6vw, 9rem)' }}>
            {LINES.map((line, index) => (
              <span key={line} className="block overflow-hidden">
                <motion.span
                  initial={{ y: '108%', opacity: 0 }}
                  whileInView={{ y: '0%', opacity: 1 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{
                    duration: reduceMotion ? 0.01 : 1.05,
                    delay: reduceMotion ? 0 : index * 0.09,
                    ease: EASE_CINEMATIC,
                  }}
                  className="block"
                >
                  {line}
                </motion.span>
              </span>
            ))}
          </span>
        </h2>

        <div className="mt-10 grid gap-8 sm:mt-12 lg:grid-cols-12 lg:gap-10">
          <Reveal preset="soft" delay={0.05} className="lg:col-span-5">
            <p className="font-serif text-[clamp(1.1rem,2.3vw,1.5rem)] italic leading-[1.45] text-ink">
              Three Ways Studios is a Cairo house built around a single obsession — the silhouette
              below the knee.
            </p>
          </Reveal>

          <Reveal preset="soft" delay={0.12} className="lg:col-span-4 lg:col-start-7">
            <p className="text-[13.5px] leading-[1.75] text-ink-soft sm:text-[14.5px]">
              Two patterns a season, cut from heavyweight selvedge and finished by hand in the
              atelier. No filler drops, no colour-of-the-month, no print. The garment carries the
              whole argument — cloth, rise, and a leg that keeps going.
            </p>
            <Link
              to="/about"
              className="group mt-5 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-ink transition-colors hover:text-crimson"
            >
              Read the house rules
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </Reveal>

          <Reveal preset="soft" delay={0.18} className="lg:col-span-2 lg:col-start-11">
            <dl className="border-t border-ink/20">
              {[
                ['Founded', 'Cairo 2024'],
                ['Cloth', '13–14 oz'],
                ['Pieces', '02'],
              ].map(([label, value]) => (
                <div key={label} className="border-b border-ink/14 py-2.5">
                  <dt className="text-[8.5px] font-bold uppercase tracking-[0.24em] text-ink-faint">
                    {label}
                  </dt>
                  <dd className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>

        <Reveal preset="soft" delay={0.1} className="mt-12 flex items-center gap-6 sm:mt-16">
          <span aria-hidden="true" className="h-px flex-1 bg-ink/20" />
          <p className="tws-signature text-crimson" style={{ fontSize: 'clamp(1.7rem, 5vw, 3rem)' }}>
            fashion beyond limits
          </p>
          <span aria-hidden="true" className="h-px flex-1 bg-ink/20" />
        </Reveal>
      </motion.div>
    </section>
  );
}
