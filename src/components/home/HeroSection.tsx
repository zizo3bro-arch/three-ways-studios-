import { useRef, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, ArrowDown } from 'lucide-react';
import { SprayType } from '../ui/SprayType';

/* =========================================================
   HERO — the campaign plate, built from live type.

   The paint is the real wordmark in Anton, sized from the viewport
   so it bleeds edge to edge at every breakpoint (see .tws-spray in
   index.css — the size is derived from the font's measured advance
   width, so it fills exactly rather than approximately).

   The white handwritten lockup crosses it. The editorial furniture
   (tagline + scroll cue, collection + CTA) sits in the corners.

   There is no card, no frame and no banner image: the hero is the
   top of the page, and the paper continues behind it.
   ========================================================= */

interface HeroSectionProps {
  onScrollDown: () => void;
}

export function HeroSection({ onScrollDown }: HeroSectionProps) {
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });

  // the paint drifts a few pixels as the hero leaves — atmosphere, not a gimmick
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '12%']);
  const fade = useTransform(scrollYProgress, [0, 0.9], [1, 0.4]);

  return (
    <section
      id="top"
      ref={ref}
      aria-label="Three Ways Studios — the 2026 collection"
      className="relative isolate overflow-hidden pt-[64px] sm:pt-[76px]"
    >
      <h1 className="sr-only">
        THREE WAYS STUDIOS — Fashion beyond limits. The 2026 collection of wide-flare and
        super-flare denim, cut in Cairo.
      </h1>

      <div className="tws-hero relative mx-auto flex w-full max-w-[1800px] flex-col px-4 sm:px-6 lg:px-10">
        {/* ——— the paint ——— */}
        <motion.div
          style={reduceMotion ? undefined : { y, opacity: fade }}
          className="tws-hero__stage relative flex flex-1 items-center justify-center"
        >
          <div className="relative w-full">
            <SprayType text="THREE WAYS" mobileWords={["THREE", "WAYS"]} className="tws-spray--display" />

            {/* ——— the signature, in white over the paint ——— */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              <motion.div
                initial={reduceMotion ? undefined : { opacity: 0, scale: 0.975 }}
                animate={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
                transition={{ duration: 1.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="relative -rotate-[1.4deg]"
                style={{ width: 'min(88%, 1320px)' } as CSSProperties}
              >
                <span className="tws-hero-signature block text-center">
                  Three Ways Studios
                  <span className="align-super text-[0.15em] tracking-normal">®</span>
                </span>
                <span className="tws-hero-flourish" />
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* ——— editorial furniture ——— */}
        <div className="grid grid-cols-2 items-end gap-6 pb-6 sm:pb-8 md:grid-cols-12">
          {/* left: tagline + scroll cue */}
          <div className="md:col-span-4 lg:col-span-3">
            <p className="text-[11.5px] font-bold uppercase leading-[1.32] tracking-[0.15em] text-ink sm:text-[13px]">
              Fashion
              <br />
              Beyond
              <br />
              Limits.
            </p>

            <div className="mt-4 h-7 w-px bg-ink/45 sm:mt-5 sm:h-9" />

            <button
              type="button"
              onClick={onScrollDown}
              className="group mt-3.5 inline-flex items-center gap-2.5 text-ink"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-ink/45 transition-colors duration-300 group-hover:border-crimson group-hover:bg-crimson group-hover:text-[#fffdf8] sm:h-9 sm:w-9">
                <ArrowDown className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
              <span className="tws-eyebrow text-[9px] tracking-[0.2em] text-ink transition-colors duration-300 group-hover:text-crimson sm:text-[9.5px]">
                Scroll down
              </span>
            </button>
          </div>

          <div className="hidden md:col-span-4 md:block lg:col-span-6" />

          {/* right: collection + CTA */}
          <div className="flex flex-col items-end gap-4 md:col-span-4 lg:col-span-3">
            <p className="text-right text-[11.5px] font-bold uppercase leading-[1.45] tracking-[0.16em] text-ink sm:text-[12.5px]">
              New
              <br />
              Collection
              <br />
              <span className="text-ink-soft">/ 2026</span>
            </p>

            <Link
              to="/shop"
              className="group inline-flex h-[42px] items-center gap-2.5 rounded-full bg-ink px-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[#f7f4ed] transition-colors duration-300 hover:bg-crimson sm:h-[50px] sm:gap-3 sm:px-6 sm:text-[10.5px] sm:tracking-[0.2em]"
            >
              Shop now
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1 sm:h-4 sm:w-4"
                strokeWidth={1.9}
              />
            </Link>
          </div>
        </div>
      </div>

      {/* hairline base so the hero closes without a box */}
      <div className="mx-4 h-px bg-ink/14 sm:mx-6 lg:mx-10" />
    </section>
  );
}
