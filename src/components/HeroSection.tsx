import { useEffect, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { useSiteSettings } from '../context/SiteSettingsContext';

export function HeroSection() {
  const { settings } = useSiteSettings();
  const { scrollY } = useScroll();
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });

  const bgTextY = useTransform(scrollY, [0, 700], [0, 90]);
  const scriptTextY = useTransform(scrollY, [0, 700], [0, 42]);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const onMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 16;
      const ny = (e.clientY / window.innerHeight - 0.5) * 12;
      setMouseOffset({ x: nx, y: ny });
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const scrollToProducts = () => {
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section
      aria-label="THREE WAYS STUDIOS Hero"
      className="relative flex min-h-[88vh] flex-col justify-between overflow-hidden px-5 pt-28 pb-12 sm:min-h-[92vh] sm:px-8 lg:px-12"
    >
      {/* Center Composition: Massive Blurred Crimson Typography + Handwritten Script */}
      <div className="relative flex flex-1 flex-col items-center justify-center py-10 sm:py-16">
        {/* Massive Blurred Background Wordmark: THREE WAYS */}
        <motion.div
          style={{
            y: bgTextY,
            x: mouseOffset.x * -0.45,
          }}
          className="pointer-events-none relative flex w-full items-center justify-center select-none"
        >
          <motion.h1
            initial={{ opacity: 0, filter: 'blur(26px)', scale: 0.96 }}
            animate={{ opacity: 0.88, filter: 'blur(4.5px)', scale: 1 }}
            transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
            className="font-display-tall text-center text-[21vw] leading-[0.82] tracking-[-0.01em] text-[#9b0810] uppercase sm:text-[18.5vw] lg:text-[16vw]"
            style={{
              textShadow:
                '0 0 65px rgba(212, 18, 27, 0.55), 0 0 120px rgba(140, 8, 16, 0.45)',
              transform: 'scaleY(1.18)',
            }}
          >
            {settings.hero_bg_text}
          </motion.h1>
        </motion.div>

        {/* Handwritten Script Layered Over Giant Typography with Drawing/Reveal Effect */}
        <motion.div
          style={{
            y: scriptTextY,
            x: mouseOffset.x * 0.25,
          }}
          className="relative z-10 -mt-[12vw] flex flex-col items-center sm:-mt-[10.5vw] lg:-mt-[9.5vw]"
        >
          <motion.div
            initial={{ clipPath: 'inset(0 100% 0 0)', opacity: 0.2 }}
            animate={{ clipPath: 'inset(0 0% 0 0)', opacity: 1 }}
            transition={{ duration: 1.55, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="px-4 py-2 text-center"
          >
            <span
              className="font-script inline-block text-[11vw] leading-none text-[#f7f2f2] sm:text-[8.2vw] lg:text-[7vw]"
              style={{
                textShadow: '0 4px 28px rgba(0, 0, 0, 0.85)',
              }}
            >
              {settings.hero_script_text}
              <sup className="font-sans-ui ml-1 align-super text-[11px] font-light opacity-75 sm:text-sm">
                ®
              </sup>
            </span>
          </motion.div>

          {/* Animated Signature Underline Sweep */}
          <svg
            viewBox="0 0 420 26"
            className="-mt-2 h-5 w-52 overflow-visible sm:w-72 lg:w-88"
            aria-hidden="true"
          >
            <motion.path
              d="M 8 20 Q 170 4, 412 10"
              fill="none"
              stroke="rgba(247, 242, 242, 0.72)"
              strokeWidth="1.8"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.2, delay: 1.1, ease: 'easeOut' }}
            />
          </svg>
        </motion.div>
      </div>

      {/* Bottom Editorial Controls matching Reference Layout */}
      <div className="mx-auto flex w-full max-w-[1380px] flex-col items-start justify-between gap-8 pt-6 sm:flex-row sm:items-end">
        {/* Left: FASHION BEYOND LIMITS + Vertical Hairline + SCROLL DOWN */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.65 }}
          className="flex flex-col items-start"
        >
          <p className="max-w-[130px] text-[11px] leading-[1.45] font-medium tracking-[0.18em] text-[#e6dfdf] uppercase">
            {settings.hero_tagline}
          </p>
          <div className="my-5 h-10 w-px bg-white/30" />
          <button
            type="button"
            onClick={scrollToProducts}
            className="group flex items-center gap-3 text-[10px] tracking-[0.22em] text-[#cfc6c6] uppercase transition-colors hover:text-white"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/35 transition-all duration-300 group-hover:translate-y-0.5 group-hover:border-white">
              <ArrowDown className="h-3 w-3" />
            </span>
            <span>SCROLL DOWN</span>
          </button>
        </motion.div>

        {/* Right: NEW COLLECTION / 2026 + SHOP NOW */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.8 }}
          className="flex flex-col items-start sm:items-end"
        >
          <p className="text-[11px] leading-[1.5] font-medium tracking-[0.18em] text-[#e6dfdf] uppercase sm:text-right">
            {settings.hero_collection_label.split('/').map((part, idx) => (
              <span key={idx} className="block">
                {idx === 1 ? `/ ${part.trim()}` : part.trim()}
              </span>
            ))}
          </p>
          <button
            type="button"
            onClick={scrollToProducts}
            className="group mt-4 inline-flex items-center gap-4 rounded-full border border-white/35 bg-black/25 px-7 py-2.5 text-[11px] font-medium tracking-[0.2em] text-white uppercase transition-all duration-300 hover:border-[#d4121b] hover:bg-[#b30e16]/85"
          >
            <span>{settings.hero_cta_label}</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
          </button>
        </motion.div>
      </div>
    </section>
  );
}
