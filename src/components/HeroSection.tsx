import { ArrowDown, ArrowRight } from 'lucide-react';

interface HeroSectionProps {
  onShopNow: () => void;
}

export function HeroSection({ onShopNow }: HeroSectionProps) {
  return (
    <section
      id="top"
      aria-label="Three Ways Studios — Fashion Beyond Limits"
      className="relative flex min-h-[100svh] w-full flex-col justify-between overflow-hidden pt-20 sm:pt-24"
    >
      {/* Subtle static surface scuffs & concrete grain */}
      <div aria-hidden="true" className="tws-grain pointer-events-none absolute inset-0" />

      {/* ——— CENTERpiece: Giant spray-painted red THREE WAYS + crisp white handwritten script ——— */}
      <div className="relative mx-auto flex w-full max-w-[1680px] flex-1 items-center justify-center px-2 py-8 sm:px-6 lg:px-10">
        <h1 className="sr-only">Three Ways Studios — Fashion Beyond Limits</h1>

        <div className="relative flex w-full items-center justify-center select-none">
          {/* Spray-painted crimson stencil letters */}
          <svg
            aria-hidden="true"
            viewBox="0 0 1600 580"
            preserveAspectRatio="xMidYMid meet"
            className="h-auto w-full max-w-[1580px] overflow-visible"
          >
            <defs>
              {/* Authentic aerosol spray edge + paint overspray halo + fine speckle */}
              <filter
                id="tws-spray-paint"
                x="-10%"
                y="-18%"
                width="120%"
                height="136%"
                colorInterpolationFilters="sRGB"
              >
                {/* Outer crimson aerosol mist */}
                <feGaussianBlur in="SourceGraphic" stdDeviation="16" result="mistOuter" />
                <feColorMatrix
                  in="mistOuter"
                  type="matrix"
                  values="1 0 0 0 0.06
                          0 1 0 0 0
                          0 0 1 0 0
                          0 0 0 0.58 0"
                  result="mistSoft"
                />

                {/* Organic edge roughening for spray stencil */}
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.042 0.055"
                  numOctaves="3"
                  seed="17"
                  result="edgeNoise"
                />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="edgeNoise"
                  scale="15"
                  xChannelSelector="R"
                  yChannelSelector="G"
                  result="roughened"
                />
                <feGaussianBlur in="roughened" stdDeviation="4.2" result="coreSoft" />

                {/* Merge outer mist + dense crimson core */}
                <feMerge result="paintBase">
                  <feMergeNode in="mistSoft" />
                  <feMergeNode in="coreSoft" />
                </feMerge>

                {/* Fine surface grit / concrete bleed-through inside the red paint */}
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.75"
                  numOctaves="2"
                  seed="5"
                  result="fineGrit"
                />
                <feColorMatrix
                  in="fineGrit"
                  type="matrix"
                  values="0 0 0 0 0.56
                          0 0 0 0 0.02
                          0 0 0 0 0.04
                          0 0 0 0.24 0.84"
                  result="gritAlpha"
                />
                <feComposite in="paintBase" in2="gritAlpha" operator="in" result="texturedPaint" />
                <feBlend in="paintBase" in2="texturedPaint" mode="multiply" />
              </filter>

              <linearGradient id="tws-crimson-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#9e0c14" />
                <stop offset="48%" stopColor="#89070e" />
                <stop offset="100%" stopColor="#72040a" />
              </linearGradient>
            </defs>

            {/* Giant condensed red spray-painted letters */}
            <g filter="url(#tws-spray-paint)">
              <text
                x="390"
                y="455"
                textAnchor="middle"
                fill="url(#tws-crimson-grad)"
                fontFamily="Anton, Impact, sans-serif"
                fontSize="430"
                letterSpacing="-4"
                textLength="680"
                lengthAdjust="spacingAndGlyphs"
              >
                THREE
              </text>
              <text
                x="1195"
                y="455"
                textAnchor="middle"
                fill="url(#tws-crimson-grad)"
                fontFamily="Anton, Impact, sans-serif"
                fontSize="430"
                letterSpacing="-4"
                textLength="710"
                lengthAdjust="spacingAndGlyphs"
              >
                WAYS
              </text>
            </g>

            {/* Subtle vintage concrete scratch lines across the paint */}
            <g stroke="#e6e3dc" strokeOpacity="0.24" strokeLinecap="round" fill="none">
              <path d="M260 150 L278 245" strokeWidth="1.2" />
              <path d="M685 128 L668 232" strokeWidth="1.1" />
              <path d="M1118 168 L1138 290" strokeWidth="1.2" />
              <path d="M1365 210 L1348 345" strokeWidth="1" />
            </g>
          </svg>

          {/* Crisp white handwritten script overlay + flourish underline */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <div className="relative -mt-1 -rotate-[6deg] px-4 sm:-mt-2">
              <span
                className="block whitespace-nowrap font-script text-[clamp(3.1rem,11.2vw,10.6rem)] leading-[0.86] tracking-[0.01em] text-[#fbfaf7]"
                style={{
                  textShadow:
                    '0 2px 14px rgba(55, 4, 8, 0.42), 0 1px 2px rgba(35, 3, 6, 0.55)',
                }}
              >
                Three Ways Studios
              </span>

              {/* Registered marks stacked near the end of Studios, matching the reference */}
              <span className="absolute -right-1 top-[26%] flex flex-col gap-1.5 text-[9px] font-semibold leading-none text-[#fbfaf7]/95 sm:-right-3 sm:top-[28%] sm:text-[13px]">
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[#fbfaf7]/85 text-[7px] sm:h-5 sm:w-5 sm:text-[10px]">
                  R
                </span>
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[#fbfaf7]/85 text-[7px] sm:h-5 sm:w-5 sm:text-[9px]">
                  TM
                </span>
              </span>

              {/* Handwritten white flourish underline beneath "Studios" */}
              <svg
                viewBox="0 0 420 58"
                fill="none"
                className="ml-auto -mt-2 mr-1 w-[46%] overflow-visible sm:-mt-4 sm:mr-2"
              >
                <path
                  d="M8 48 C 122 25, 268 11, 412 4"
                  stroke="#fbfaf7"
                  strokeWidth="3.6"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* ——— BOTTOM CORNERS: Left tagline + Scroll Down | Right Collection + Shop Now pill ——— */}
      <div className="relative mx-auto flex w-full max-w-[1640px] items-end justify-between gap-6 px-5 pb-7 sm:px-8 sm:pb-10 lg:px-12">
        {/* Bottom-left: FASHION BEYOND LIMITS. + vertical hairline + circular SCROLL DOWN */}
        <div className="flex flex-col items-start">
          <p className="text-[12px] font-extrabold uppercase leading-[1.12] tracking-[0.04em] text-ink sm:text-[15px]">
            FASHION
            <br />
            BEYOND
            <br />
            LIMITS.
          </p>

          <span
            aria-hidden="true"
            className="my-3.5 ml-[17px] block h-9 w-[1.25px] bg-ink/65 sm:my-4 sm:ml-[19px] sm:h-12"
          />

          <button
            type="button"
            onClick={onShopNow}
            aria-label="Scroll down to products"
            className="group inline-flex items-center gap-3.5 text-left"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/75 text-ink transition-colors duration-200 group-hover:border-crimson-bright group-hover:bg-crimson-bright group-hover:text-white sm:h-10 sm:w-10">
              <ArrowDown className="tws-scroll-cue h-4 w-4" strokeWidth={1.8} />
            </span>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-ink transition-colors duration-200 group-hover:text-crimson-bright sm:text-[11px]">
              SCROLL DOWN
            </span>
          </button>
        </div>

        {/* Bottom-right: NEW COLLECTION / 2026 + solid dark pill SHOP NOW → */}
        <div className="flex flex-col items-end text-right">
          <p className="text-[12px] font-extrabold uppercase leading-[1.15] tracking-[0.04em] text-ink sm:text-[15px]">
            NEW
            <br />
            COLLECTION
            <br />
            / 2026
          </p>

          <button
            type="button"
            onClick={onShopNow}
            aria-label="Shop now — scroll to products"
            className="group mt-4 inline-flex h-12 items-center justify-between gap-6 rounded-full bg-[#111010] px-7 text-[11px] font-bold uppercase tracking-[0.1em] text-white shadow-[0_10px_28px_rgba(17,16,16,0.22)] transition-colors duration-200 hover:bg-crimson-bright sm:mt-5 sm:h-14 sm:min-w-[218px] sm:px-8 sm:text-[12px]"
          >
            <span>SHOP NOW</span>
            <ArrowRight
              className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
              strokeWidth={1.9}
            />
          </button>
        </div>
      </div>
    </section>
  );
}
