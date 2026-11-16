import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { SprayType } from '../ui/SprayType';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { EASE_CINEMATIC } from '../../lib/motion';

/* =========================================================
   HERO — the campaign frame, rebuilt around the house artwork.
   Warm ivory paper · titan crimson spray lettering · handwritten
   signature · four quiet editorial corners. Nothing here changes
   with product selection.
   ========================================================= */

/**
 * Stacks the admin-configured collection label the way the campaign frame sets it:
 * "NEW COLLECTION / 2026" → ["NEW", "COLLECTION", "/ 2026"]
 */
function labelLines(label: string): string[] {
  const tokens = label.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i] === '/' && tokens[i + 1]) {
      lines.push(`/ ${tokens[i + 1]}`);
      i += 1;
    } else {
      lines.push(tokens[i]);
    }
  }
  return lines.length > 0 ? lines.slice(0, 4) : ['NEW', 'COLLECTION', '/ 2026'];
}

interface HeroSectionProps {
  onScrollDown: () => void;
}

export function HeroSection({ onScrollDown }: HeroSectionProps) {
  const { settings } = useSiteSettings();
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 60);
    return () => window.clearTimeout(timer);
  }, []);

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end start'] });
  const paintY = useTransform(scrollYProgress, [0, 1], ['0%', reduceMotion ? '0%' : '12%']);
  const paintOpacity = useTransform(scrollYProgress, [0, 0.72], [1, reduceMotion ? 1 : 0.15]);
  const cornerY = useTransform(scrollYProgress, [0, 1], ['0%', reduceMotion ? '0%' : '-8%']);

  const sprayText = (settings.hero_bg_text || 'THREE WAYS').toUpperCase();
  const signatureText = settings.hero_script_text || 'Three Ways Studios';

  return (
    <section
      id="top"
      ref={sectionRef}
      aria-label="Three Ways Studios — the 2026 campaign"
      className="tws-paper relative flex min-h-[100svh] w-full flex-col overflow-hidden"
    >
      <div aria-hidden="true" className="tws-grain pointer-events-none absolute inset-0 z-[2]" />

      {/* ——— CENTERPIECE: spray-painted titan type + handwritten signature ——— */}
      <motion.div
        style={reduceMotion ? undefined : { y: paintY, opacity: paintOpacity }}
        className="relative z-[1] mx-auto flex w-full max-w-[1760px] flex-1 items-center justify-center px-1 pt-[86px] pb-2 sm:px-4 sm:pt-[120px] lg:px-8"
      >
        <h1 className="sr-only">
          Three Ways Studios — {settings.hero_tagline || 'Fashion beyond limits'}
        </h1>

        <div className="relative w-full select-none">
          {/* the paint */}
          <motion.div
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: reduceMotion ? 0.01 : 2.1, ease: EASE_CINEMATIC }}
            className="relative"
          >
            <SprayType text={sprayText} className="px-1" />
          </motion.div>

          {/* the signature, drawn over the paint */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0.01 : 1.5, delay: reduceMotion ? 0 : 0.5, ease: EASE_CINEMATIC }}
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <div className="relative -rotate-[6deg] px-3 sm:-rotate-[7deg]">
              <span
                aria-hidden="true"
                className="tws-signature block whitespace-nowrap text-[clamp(2.55rem,10.2vw,10.2rem)] leading-[0.82] tracking-[0.005em]"
              >
                {signatureText || 'Three Ways Studios'}
              </span>

              {/* stacked ® / ™ marks, as drawn on the campaign frame */}
              <span className="absolute -right-0.5 top-[24%] flex flex-col gap-1.5 sm:-right-3 sm:top-[26%] sm:gap-2">
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[#fdfcf9]/85 text-[6px] font-bold leading-none text-[#fdfcf9] sm:h-[22px] sm:w-[22px] sm:text-[10px]">
                  R
                </span>
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[#fdfcf9]/85 text-[6px] font-bold leading-none text-[#fdfcf9] sm:h-[22px] sm:w-[22px] sm:text-[8px]">
                  TM
                </span>
              </span>

              {/* the flourish under "Studios" */}
              <motion.svg
                viewBox="0 0 420 58"
                fill="none"
                aria-hidden="true"
                className="ml-auto -mt-1 w-[42%] overflow-visible sm:-mt-3 sm:mr-1"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: reduceMotion ? 0.01 : 1.5, delay: reduceMotion ? 0 : 1.1, ease: EASE_CINEMATIC }}
              >
                <path
                  d="M8 48 C 122 25, 268 11, 412 4"
                  stroke="#fdfcf9"
                  strokeWidth="3.4"
                  strokeLinecap="round"
                />
              </motion.svg>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* ——— CORNERS ——— */}
      <motion.div
        style={reduceMotion ? undefined : { y: cornerY }}
        className="relative z-[3] mx-auto flex w-full max-w-[1660px] items-end justify-between gap-6 px-4 pb-6 sm:px-6 sm:pb-8 lg:px-10"
      >
        {/* bottom-left: the house line + scroll cue */}
        <div className="flex flex-col items-start">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.35, ease: EASE_CINEMATIC }}
            className="text-[11px] font-extrabold uppercase leading-[1.12] tracking-[0.03em] text-ink sm:text-[15px]"
          >
            {(settings.hero_tagline || 'FASHION BEYOND LIMITS.').split(' ').map((word, index) => (
              <span key={`${word}-${index}`} className="block">
                {word}
              </span>
            ))}
          </motion.p>

          <motion.span
            aria-hidden="true"
            initial={{ scaleY: 0 }}
            animate={{ scaleY: ready ? 1 : 0 }}
            transition={{ duration: 1, delay: 0.6, ease: EASE_CINEMATIC }}
            className="my-3 ml-[15px] block h-8 w-[1.25px] origin-top bg-ink/60 sm:my-4 sm:ml-[19px] sm:h-12"
          />

          <button
            type="button"
            onClick={onScrollDown}
            aria-label="Scroll to the brand chapter"
            className="group inline-flex items-center gap-3 text-left"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/70 text-ink transition-colors duration-300 group-hover:border-crimson-bright group-hover:bg-crimson-bright group-hover:text-ivory sm:h-10 sm:w-10">
              <ArrowDown className="tws-scroll-cue h-4 w-4" strokeWidth={1.8} />
            </span>
            <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-ink transition-colors duration-300 group-hover:text-crimson-bright sm:text-[11px] sm:tracking-[0.18em]">
              SCROLL DOWN
            </span>
          </button>
        </div>

        {/* bottom-right: the drop line + entry into the shop */}
        <div className="flex flex-col items-end text-right">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.45, ease: EASE_CINEMATIC }}
            className="text-[11px] font-extrabold uppercase leading-[1.14] tracking-[0.03em] text-ink sm:text-[15px]"
          >
            {labelLines(settings.hero_collection_label || 'NEW COLLECTION / 2026').map(
              (line, index) => (
                <span key={`${line}-${index}`} className="block">
                  {line}
                </span>
              )
            )}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.6, ease: EASE_CINEMATIC }}
            className="mt-3.5 sm:mt-5"
          >
            <Link
              to="/shop"
              className="group inline-flex h-12 items-center gap-6 rounded-full bg-ink pl-7 pr-4 text-[11px] font-bold uppercase tracking-[0.18em] text-ivory shadow-[0_14px_34px_-18px_rgba(22,19,15,0.75)] transition-colors duration-300 hover:bg-crimson-bright sm:h-14 sm:gap-10 sm:pl-9 sm:pr-5 sm:text-[12px]"
            >
              <span>{settings.hero_cta_label || 'SHOP NOW'}</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ivory/12 transition-colors duration-300 group-hover:bg-ivory/20">
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" strokeWidth={2} />
              </span>
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
