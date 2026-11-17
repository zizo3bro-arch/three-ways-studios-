import type { ReactNode } from 'react';
import { SprayType } from '../ui/SprayType';

/* =========================================================
   PageIntro — the masthead every interior page opens with.
   An editorial kicker, an enormous display title, the standing
   copy in serif italic, and the page's actions. The ghosted
   word behind it is optional and sits on the paper, never in a
   container.
   ========================================================= */

interface PageIntroProps {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  /** optional painted word behind the title (kept low-contrast) */
  sprayText?: string;
  aside?: ReactNode;
  actions?: ReactNode;
  /** small right-aligned furniture, e.g. a count or an index */
  meta?: ReactNode;
}

export function PageIntro({
  eyebrow,
  title,
  description,
  sprayText,
  aside,
  actions,
  meta,
}: PageIntroProps) {
  return (
    <header className="relative isolate overflow-hidden px-4 pb-10 pt-[104px] sm:px-6 sm:pb-12 sm:pt-[128px] lg:px-10">
      {sprayText ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-1/2 z-0 -translate-y-1/2 opacity-[0.07]"
        >
          {/* The ghost is decorative, but it must never blow the gutter.
              Anton's widest word here (COLLECTIONS) advances 4.71em with
              tracking, so 18vw stays inside the content column at every
              width from 320px up — measured, not guessed. */}
          <SprayType text={sprayText} fontSize="clamp(2.6rem, 18vw, 15rem)" />
        </div>
      ) : null}

      <div className="relative z-10 mx-auto w-full max-w-[1800px]">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-ink/16 pb-4">
          <p className="tws-eyebrow text-crimson">{eyebrow}</p>
          {meta ? <div className="text-[10px] uppercase tracking-[0.2em] text-ink-faint">{meta}</div> : null}
        </div>

        <div className="mt-6 grid gap-7 lg:grid-cols-12 lg:items-end lg:gap-10">
          <div className="lg:col-span-8">
            <h1
              className="font-display uppercase leading-[0.84] tracking-[0.004em] text-ink"
              style={{ fontSize: 'clamp(2.5rem, 8.6vw, 6.6rem)' }}
            >
              {title}
            </h1>
          </div>

          <div className="lg:col-span-4">
            {description ? (
              <div className="max-w-md font-serif text-[15px] italic leading-[1.6] text-ink-soft sm:text-[16px]">
                {description}
              </div>
            ) : null}
            {actions ? (
              <div className="mt-5 flex flex-wrap items-center gap-2.5">{actions}</div>
            ) : null}
          </div>

          {aside ? <div className="lg:col-span-12">{aside}</div> : null}
        </div>
      </div>
    </header>
  );
}
