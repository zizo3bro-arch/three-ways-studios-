import { Link } from 'react-router-dom';

/* =========================================================
   Emblem — the real house mark (three panthers over the crimson
   cross, with the handwritten lockup). Used exactly as supplied in
   /public/assets — never redrawn, never replaced.
   ========================================================= */

interface EmblemProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  withWordmark?: boolean;
  wordmarkClass?: string;
}

const SIZES: Record<NonNullable<EmblemProps['size']>, string> = {
  xs: 'h-8 w-8',
  sm: 'h-11 w-11 sm:h-12 sm:w-12',
  md: 'h-16 w-16',
  lg: 'h-24 w-24 sm:h-28 sm:w-28',
};

export function Emblem({
  size = 'sm',
  className = '',
  withWordmark = true,
  wordmarkClass = 'text-[1.5rem] sm:text-[1.85rem]',
}: EmblemProps) {
  return (
    <Link
      to="/"
      aria-label="Three Ways Studios — home"
      className={`group flex items-center gap-2 sm:gap-2.5 ${className}`}
    >
      <span
        className={`relative block shrink-0 overflow-hidden ${SIZES[size]} rounded-[3px] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]`}
      >
        <img
          src="/assets/three-ways-studios-logo.png"
          alt=""
          aria-hidden="true"
          width={766}
          height={885}
          decoding="async"
          className="h-full w-full object-contain object-left"
        />
      </span>
      {withWordmark ? (
        <span className="relative -mt-1 hidden select-none leading-none min-[430px]:inline-block">
          <span className={`block -rotate-2 tws-signature tws-signature--ink leading-[0.8] ${wordmarkClass}`}>
            Three&nbsp;Ways&nbsp;Studios
            <sup className="ml-0.5 align-super font-sans text-[6px] font-bold tracking-normal text-ink/70 sm:text-[7px]">
              ®
            </sup>
          </span>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-0.5 right-1 h-[1px] w-[38%] -rotate-3 rounded-full bg-ink/70"
          />
        </span>
      ) : null}
    </Link>
  );
}

/** Full-bleed house plate — the un-cropped campaign artwork. */
export function EmblemPlate({ className = '' }: { className?: string }) {
  return (
    <img
      src="/assets/three-ways-studios-logo-full.jpeg"
      alt="Three Ways Studios — three panthers over the crimson cross, handwritten house lockup"
      width={1440}
      height={1440}
      decoding="async"
      loading="lazy"
      className={`h-full w-full object-cover ${className}`}
    />
  );
}
