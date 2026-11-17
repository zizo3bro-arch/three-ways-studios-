import type { ReactNode } from 'react';

/* =========================================================
   PageIntro — clean, crisp white & deep red header for subpages.
   ========================================================= */

interface PageIntroProps {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  sprayText?: string;
  aside?: ReactNode;
  actions?: ReactNode;
}

export function PageIntro({ eyebrow, title, description, aside, actions }: PageIntroProps) {
  return (
    <header className="border-b border-black/10 bg-[#FAFAF8] px-4 pb-10 pt-24 sm:px-6 sm:pb-12 sm:pt-28 lg:px-10">
      <div className="mx-auto w-full max-w-[1320px]">
        <p className="tws-eyebrow text-crimson">{eyebrow}</p>

        <div className="mt-3 grid gap-6 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl lg:text-5xl">
              {title}
            </h1>
          </div>
          <div className="lg:col-span-5">
            {description ? (
              <div className="text-sm leading-relaxed text-ink-soft">{description}</div>
            ) : null}
            {actions ? (
              <div className="mt-4 flex flex-wrap items-center gap-2.5">{actions}</div>
            ) : null}
          </div>
          {aside ? <div className="lg:col-span-12">{aside}</div> : null}
        </div>
      </div>
    </header>
  );
}
