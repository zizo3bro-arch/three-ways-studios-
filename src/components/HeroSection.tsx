import { ArrowDown, ArrowRight } from 'lucide-react';

interface HeroSectionProps {
  onShopNow: () => void;
}

export function HeroSection({ onShopNow }: HeroSectionProps) {
  return (
    <section
      id="top"
      aria-label="THREE WAYS STUDIOS — introduction"
      className="tws-paper relative flex h-[100svh] flex-col overflow-hidden"
    >
      {/* Static archival grain */}
      <div aria-hidden="true" className="tws-grain pointer-events-none absolute inset-0" />

      <div className="relative mx-auto flex h-full w-full max-w-[1600px] flex-col px-5 pb-5 pt-[4.75rem] sm:px-8 sm:pb-6 sm:pt-24 lg:px-12">
        {/* ——— Top editorial micro-labels ——— */}
        <div className="flex items-start justify-between text-[8px] font-bold uppercase leading-relaxed tracking-[0.3em] text-ink-soft sm:text-[9px]">
          <p>
            Est. MMXXVI
            <span className="block text-ink-faint">Cairo — Egypt</span>
          </p>
          <p className="text-right">
            Drop 01 / 2026
            <span className="block text-ink-faint">Wide-Flare Denim</span>
          </p>
        </div>

        {/* ——— Center stack: crimson titan + charcoal script ——— */}
        <div className="relative flex flex-1 flex-col items-center justify-center py-4 sm:py-6">
          <h1
            aria-label="THREE WAYS STUDIOS"
            className="select-none text-center font-display uppercase"
          >
            <span
              aria-hidden="true"
              className="tws-hero-word tws-hero-title block whitespace-nowrap"
            >
              THREE WAYS
            </span>
          </h1>

          {/* Sweeping charcoal calligraphic flourish across the titan type */}
          <p
            aria-hidden="true"
            className="tws-script-ink pointer-events-none absolute left-1/2 top-1/2 w-full -translate-x-1/2 -translate-y-1/2 select-none whitespace-nowrap text-center font-script"
          >
            <span className="tws-hero-script block rotate-[-4deg] leading-none">
              Three Ways Studios
              <sup className="ml-1 align-super font-sans text-[0.16em] font-medium tracking-normal">
                ®
              </sup>
            </span>
          </p>

          {/* Sharp ultra-condensed charcoal center lockup */}
          <div className="mt-4 flex items-center gap-3 sm:mt-7 sm:gap-5">
            <span aria-hidden="true" className="h-px w-10 bg-ink/35 sm:w-20" />
            <p className="font-display text-[10px] uppercase tracking-[0.58em] text-ink sm:text-xs lg:text-sm">
              Three Ways Studios
            </p>
            <span aria-hidden="true" className="h-px w-10 bg-ink/35 sm:w-20" />
          </div>
          <p className="mt-2 text-[8px] font-semibold uppercase tracking-[0.42em] text-crimson sm:text-[9px]">
            Fashion Beyond Limits
          </p>
        </div>

        {/* ——— Bottom corner micro-labels ——— */}
        <div className="flex items-end justify-between gap-4">
          {/* Bottom-left: tagline + scroll cue */}
          <div className="flex items-end gap-4 sm:gap-5">
            <p className="font-display text-[11px] uppercase leading-[1.05] tracking-[0.06em] text-ink sm:text-sm">
              Fashion
              <br />
              Beyond
              <br />
              Limits.
            </p>
            <span aria-hidden="true" className="hidden h-12 w-px bg-ink/25 sm:block" />
            <button
              type="button"
              onClick={onShopNow}
              aria-label="Enter the drop and see the products"
              className="group flex flex-col items-center gap-2"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/30 text-ink transition-colors duration-300 group-hover:border-crimson-bright group-hover:bg-crimson-bright group-hover:text-cream">
                <ArrowDown className="tws-scroll-cue h-4 w-4" strokeWidth={2} />
              </span>
              <span className="text-[7px] font-bold uppercase tracking-[0.3em] text-ink-soft sm:text-[8px]">
                Scroll Down
              </span>
            </button>
          </div>

          {/* Bottom-right: drop label + pill CTA */}
          <div className="flex flex-col items-end gap-3 text-right">
            <p className="font-display text-[11px] uppercase leading-[1.05] tracking-[0.06em] text-ink sm:text-sm">
              New
              <br />
              Collection
              <span className="mt-1 block text-[9px] tracking-[0.28em] text-ink-soft">
                / 2026
              </span>
            </p>
            <button
              type="button"
              onClick={onShopNow}
              aria-label="Shop now — enter the drop"
              className="group inline-flex h-11 items-center gap-2.5 rounded-full bg-ink pl-6 pr-2 text-[10px] font-bold uppercase tracking-[0.24em] text-cream transition-colors duration-300 hover:bg-crimson-bright sm:h-12 sm:pl-7 sm:text-[11px]"
            >
              Shop Now
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cream text-ink transition-transform duration-300 group-hover:translate-x-0.5">
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
