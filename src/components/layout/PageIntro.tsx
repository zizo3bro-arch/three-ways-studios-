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
    <header className="relative isolate overflow-hidden pb-8 pt-[calc(var(--header)+clamp(18px,3vw,42px))] sm:pb-10">
      <div className="page-width relative z-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-ink/16 pb-4">
          <p className="tws-eyebrow text-crimson">{eyebrow}</p>
          {meta ? (
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-ink-faint">{meta}</div>
          ) : null}
        </div>

        <div className="mt-6 grid gap-7 lg:grid-cols-12 lg:items-end lg:gap-10">
          <div className="lg:col-span-8">
            <h1
              className="font-display font-medium uppercase leading-[1.04] tracking-[0.04em] text-ink"
              style={{ fontSize: 'clamp(2.1rem, 5.2vw, 4.9rem)' }}
            >
              {title}
            </h1>
          </div>

          <div className="lg:col-span-4">
            {description ? (
              <div className="max-w-lg font-serif text-[16.5px] italic leading-[1.6] text-ink-soft sm:text-[18px]">
                {description}
              </div>
            ) : null}
            {actions ? <div className="mt-5 flex flex-wrap items-center gap-3">{actions}</div> : null}
          </div>

          {aside ? <div className="lg:col-span-12">{aside}</div> : null}
        </div>
      </div>
    </header>
  );
}
