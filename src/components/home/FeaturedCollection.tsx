import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Reveal } from '../ui/Reveal';
import { SmokeField } from '../ui/SmokeField';
import { EASE_CINEMATIC } from '../../lib/motion';

/* =========================================================
   CHAPTER 02 — THE COLLECTION
   One campaign photograph, one title, one paragraph, one button.
   The image uncovers with a clip-path wipe as it enters the viewport.
   ========================================================= */

const COLLECTION_FABRICS = [
  ['Cloth', 'Japanese selvedge · 14 oz / 13 oz'],
  ['Rise', 'High, sculpted, single-needle'],
  ['Hem', 'Open flare, unfinished option on request'],
  ['Made', 'Cairo atelier, small runs'],
];

export function FeaturedCollection() {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const imageScale = useTransform(scrollYProgress, [0, 0.5, 1], [1.12, 1.02, 1.07]);
  const textY = useTransform(scrollYProgress, [0, 1], ['5%', '-5%']);

  return (
    <section
      id="collection"
      aria-labelledby="collection-title"
      className="relative isolate overflow-hidden border-y border-ink/10 bg-ivory py-20 sm:py-24 lg:py-28"
    >
      {/* whisper of smoke, kept far behind the photography and copy */}
      <SmokeField variant="soft" opacity="low" />

      <div className="relative z-10 mx-auto w-full max-w-[1660px] px-4 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <Reveal preset="soft">
            <p className="tws-eyebrow flex items-center gap-3 text-crimson-bright">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-crimson-bright" />
              Chapter 02 — The Collection
            </p>
            <h2
              id="collection-title"
              className="mt-4 font-display uppercase leading-[0.88] tracking-[0.002em] text-ink text-[clamp(2.35rem,7.4vw,5.6rem)]"
            >
              Drop 01
              <span className="block">The flare series</span>
            </h2>
          </Reveal>

          <Reveal preset="soft" delay={0.1} className="max-w-sm">
            <p className="text-[13.5px] leading-[1.7] text-ink-soft sm:text-[14.5px]">
              Two silhouettes and nothing else: a midnight wide-flare in 14 oz raw selvedge, and
              an onyx super-flare cut to sweep the floor. Hand-finished in Cairo, released once,
              not repeated.
            </p>
          </Reveal>
        </div>

        {/* the campaign plate */}
        <div ref={ref} className="mt-9 grid gap-4 sm:mt-12 lg:grid-cols-12 lg:gap-6">
          <motion.div
            initial={{ clipPath: 'inset(12% 0% 12% 0%)', opacity: 0.4 }}
            whileInView={{ clipPath: 'inset(0% 0% 0% 0%)', opacity: 1 }}
            viewport={{ once: true, amount: 0.22 }}
            transition={{ duration: reduceMotion ? 0.01 : 1.25, ease: EASE_CINEMATIC }}
            className="relative overflow-hidden rounded-[1.25rem] border border-ink/12 bg-paper lg:col-span-8"
          >
            <motion.img
              src="/media/campaign-01.jpg"
              alt="Campaign 01 — the Midnight Wide-Flare photographed from the waist down in the Cairo studio, red haze drifting behind the model"
              width={1600}
              height={873}
              loading="lazy"
              decoding="async"
              style={reduceMotion ? undefined : { scale: imageScale }}
              className="h-full w-full object-cover"
            />
            <div aria-hidden="true" className="tws-grain pointer-events-none absolute inset-0" />
            <figcaption className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-4 bg-gradient-to-t from-[#16130f]/72 via-[#16130f]/12 to-transparent p-4 sm:p-6">
              <p className="text-[9px] font-bold uppercase tracking-[0.26em] text-ivory/90 sm:text-[10px]">
                Campaign 01 — Cairo, 2026
              </p>
              <p className="hidden max-w-[320px] text-right font-serif text-[12.5px] italic leading-snug text-ivory/85 sm:block">
                “The flare is not a trend here. It is the pattern we started from.”
              </p>
            </figcaption>
          </motion.div>

          <motion.div
            style={reduceMotion ? undefined : { y: textY }}
            className="flex flex-col justify-between gap-6 rounded-[1.25rem] border border-ink/12 bg-paper p-5 sm:p-7 lg:col-span-4"
          >
            <div>
              <p className="tws-eyebrow text-ink-faint">The specification</p>
              <dl className="mt-4 border-t border-ink/12">
                {COLLECTION_FABRICS.map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-5 border-b border-ink/10 py-2.5">
                    <dt className="text-[9px] font-bold uppercase tracking-[0.22em] text-ink-faint">{label}</dt>
                    <dd className="text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-ink">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div>
              <Link to="/collections" className="tws-pill h-14 w-full justify-center sm:w-auto sm:min-w-[286px]">
                Discover the collection
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </Link>
              <p className="mt-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
                Cash on delivery across Egypt · Worldwide shipping
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
