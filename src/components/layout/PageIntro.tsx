import type { ReactNode } from 'react';

interface PageIntroProps {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  actions?: ReactNode;
  /** small right-aligned furniture, e.g. a count or an index */
  meta?: ReactNode;
}

export function PageIntro({ eyebrow, title, description, aside, actions, meta }: PageIntroProps) {
  return (
    <header className="relative isolate overflow-hidden px-4 pb-10 pt-[104px] sm:px-6 sm:pb-12 sm:pt-[128px] lg:px-10">
      <div className="relative z-10 mx-auto w-full max-w-[1800px]">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-ink/16 pb-4">
          <p className="tws-eyebrow text-crimson">{eyebrow}</p>
          {meta ? (
            <div className="text-[10px] uppercase tracking-[0.2em] text-ink-faint">{meta}</div>
          ) : null}
        </div>

        <div className="mt-6 grid gap-7 lg:grid-cols-12 lg:items-end lg:gap-10">
          <div className="lg:col-span-8">
            <h1
              className="font-display font-medium uppercase leading-[1.06] tracking-[0.04em] text-ink"
              style={{ fontSize: 'clamp(1.8rem, 5vw, 4.6rem)' }}
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
            {actions ? <div className="mt-5 flex flex-wrap items-center gap-2.5">{actions}</div> : null}
          </div>

          {aside ? <div className="lg:col-span-12">{aside}</div> : null}
        </div>
      </div>
    </header>
  );
}
