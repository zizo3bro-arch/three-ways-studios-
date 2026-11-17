import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Reveal } from '../ui/Reveal';
import { EASE_CINEMATIC } from '../../lib/motion';

/* =========================================================
   CHAPTER 02 — THE COLLECTION
   One campaign plate, full-bleed to the paper edge, with the
   specification set alongside it as editorial furniture.
   ========================================================= */

const SPEC = [
  ['Cloth', 'Japanese selvedge · 14 oz / 13 oz'],
  ['Rise', 'High, sculpted, single-needle'],
  ['Hem', 'Open flare, unfinished on request'],
  ['Made', 'Cairo atelier, small runs'],
];

export function FeaturedCollection() {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1.1, 1.02, 1.06]);

  return (
    <section
      id="collection"
      aria-labelledby="collection-title"
      className="relative border-t border-ink/14 py-14 sm:py-20 lg:py-24"
    >
      <div className="mx-auto w-full max-w-[1800px] px-4 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Reveal preset="soft">
            <p className="tws-index">03 / The collection</p>
            <h2
              id="collection-title"
              className="mt-3 font-display uppercase leading-[0.85] tracking-[0.004em] text-ink"
              style={{ fontSize: 'clamp(2.2rem, 7.2vw, 5.4rem)' }}
            >
              Drop 01
              <span className="block text-crimson">The flare series</span>
            </h2>
          </Reveal>

          <Reveal preset="soft" delay={0.08} className="max-w-sm">
            <p className="text-[13px] leading-[1.7] text-ink-soft sm:text-[14px]">
              Two silhouettes and nothing else: a midnight wide-flare in 14 oz raw selvedge, and an
              onyx super-flare cut to sweep the floor. Hand-finished in Cairo, released once, not
              repeated.
            </p>
          </Reveal>
        </div>

        <div ref={ref} className="mt-8 grid gap-6 sm:mt-10 lg:grid-cols-12 lg:gap-8">
          {/* the campaign plate — bleeds to the edge, no frame */}
          <motion.div
            initial={{ clipPath: 'inset(10% 0% 10% 0%)', opacity: 0.5 }}
            whileInView={{ clipPath: 'inset(0% 0% 0% 0%)', opacity: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: reduceMotion ? 0.01 : 1.3, ease: EASE_CINEMATIC }}
            className="relative overflow-hidden bg-[rgba(23,19,15,0.05)] lg:col-span-8"
          >
            <motion.img
              src="/media/campaign-01.jpg"
              alt="Campaign 01 — the Midnight Wide-Flare photographed from the waist down in the Cairo studio"
              width={1600}
              height={873}
              loading="lazy"
              decoding="async"
              style={reduceMotion ? undefined : { scale }}
              className="h-full min-h-[280px] w-full object-cover sm:min-h-[380px]"
            />
            <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 bg-gradient-to-t from-[#120e0b]/78 via-[#120e0b]/18 to-transparent p-4 sm:p-6">
              <p className="text-[9px] font-bold uppercase tracking-[0.26em] text-[#f7f4ed]/90 sm:text-[10px]">
                Campaign 01 — Cairo, 2026
              </p>
              <p className="hidden max-w-[320px] text-right font-serif text-[12.5px] italic leading-snug text-[#f7f4ed]/85 sm:block">
                “The flare is not a trend here. It is the pattern we started from.”
              </p>
            </div>
          </motion.div>

          {/* the specification */}
          <Reveal
            preset="soft"
            delay={0.1}
            className="flex flex-col justify-between gap-7 lg:col-span-4"
          >
            <div>
              <p className="tws-eyebrow text-ink-faint">The specification</p>
              <dl className="mt-4 border-t border-ink/14">
                {SPEC.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-baseline justify-between gap-5 border-b border-ink/12 py-3"
                  >
                    <dt className="text-[9px] font-bold uppercase tracking-[0.22em] text-ink-faint">
                      {label}
                    </dt>
                    <dd className="max-w-[62%] text-right text-[10.5px] font-semibold uppercase leading-snug tracking-[0.06em] text-ink">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div>
              <Link to="/collections" className="tws-pill h-[52px] w-full justify-center">
                Discover the collection
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </Link>
              <p className="mt-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
                Cash on delivery across Egypt · Worldwide shipping
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
