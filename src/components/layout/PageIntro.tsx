import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { SprayType } from '../ui/SprayType';
import { Reveal } from '../ui/Reveal';
import { EASE_CINEMATIC } from '../../lib/motion';

/* =========================================================
   PageIntro — the interior pages open with the same device as the
   home hero: oversized sprayed house type behind a crisp title.
   ========================================================= */

interface PageIntroProps {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  sprayText: string;
  aside?: ReactNode;
  actions?: ReactNode;
}

export function PageIntro({ eyebrow, title, description, sprayText, aside, actions }: PageIntroProps) {
  const reduceMotion = useReducedMotion();

  return (
    <header className="tws-paper relative isolate overflow-hidden border-b border-ink/12 px-4 pb-12 pt-[104px] sm:px-6 sm:pb-16 sm:pt-[168px] lg:px-10">
      <div aria-hidden="true" className="tws-grain pointer-events-none absolute inset-0 z-[2]" />

      <div className="pointer-events-none absolute inset-x-0 top-[38%] z-0 -translate-y-1/2 opacity-[0.62]">
        <motion.div
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: reduceMotion ? 0.01 : 1.6, ease: EASE_CINEMATIC }}
        >
          <SprayType text={sprayText} />
        </motion.div>
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1660px]">
        <Reveal preset="soft">
          <p className="tws-eyebrow flex items-center gap-3 text-crimson-bright">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-crimson-bright" />
            {eyebrow}
          </p>
        </Reveal>

        <div className="mt-5 grid gap-7 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <Reveal preset="soft" delay={0.05}>
              <h1 className="font-display uppercase leading-[0.88] tracking-[0.002em] text-ink text-[clamp(2.4rem,8vw,6rem)]">
                {title}
              </h1>
            </Reveal>
          </div>
          <div className="lg:col-span-4 lg:col-start-8">
            {description ? (
              <Reveal preset="soft" delay={0.12}>
                <div className="text-[13.5px] leading-[1.7] text-ink-soft sm:text-[15px]">{description}</div>
              </Reveal>
            ) : null}
            {actions ? (
              <Reveal preset="soft" delay={0.18} className="mt-5 flex flex-wrap items-center gap-2.5">
                {actions}
              </Reveal>
            ) : null}
          </div>
          {aside ? (
            <div className="lg:col-span-12">
              <Reveal preset="soft" delay={0.2}>
                {aside}
              </Reveal>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
