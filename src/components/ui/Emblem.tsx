import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';

/* =========================================================
   Emblem — the Three Ways Studios logo mark and wordmark.
   The uploaded logo artwork is a crimson cross with three
   panthers; it is placed as a plate so it reads as a mark, not
   as an image asset dropped into the page.
   ========================================================= */

interface EmblemProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  withWordmark?: boolean;
}

const SIZES: Record<NonNullable<EmblemProps['size']>, string> = {
  xs: 'h-7 w-7',
  sm: 'h-9 w-9 sm:h-10 sm:w-10',
  md: 'h-12 w-12',
  lg: 'h-20 w-20 sm:h-24 sm:w-24',
};

export function Emblem({ size = 'sm', className = '', withWordmark = true }: EmblemProps) {
  return (
    <Link
      to="/"
      aria-label="Three Ways Studios — home"
      className={`group inline-flex items-center gap-2.5 ${className}`}
    >
      <span className={`relative block shrink-0 ${SIZES[size]}`}>
        <img
          src="/assets/three-ways-studios-logo.png"
          alt=""
          width={766}
          height={885}
          decoding="async"
          className="h-full w-full object-contain object-left transition-opacity duration-300 group-hover:opacity-80"
        />
      </span>
      {withWordmark ? (
        <span className="hidden select-none flex-col leading-none min-[380px]:flex">
          <span className="font-signature text-[22px] leading-[0.8] text-ink transition-colors duration-300 group-hover:text-crimson sm:text-[25px]">
            Three Ways
          </span>
          <span className="font-signature -mt-[1px] pl-[14px] text-[22px] leading-[0.8] text-ink transition-colors duration-300 group-hover:text-crimson sm:text-[25px]">
            Studios
          </span>
        </span>
      ) : null}
    </Link>
  );
}

export function EmblemPlate({ className = '' }: { className?: string }) {
  return (
    <img
      src="/assets/three-ways-studios-logo-full.jpeg"
      alt="Three Ways Studios — three panthers over the crimson cross"
      width={1440}
      height={1440}
      decoding="async"
      loading="lazy"
      className={`h-full w-full object-cover ${className}`}
    />
  );
}

/** Tiny inline lockup used in dark/administrative surfaces. */
export function EmblemMark({ className = '' }: { className?: string }) {
  return (
    <img
      src="/assets/three-ways-studios-logo.png"
      alt=""
      width={766}
      height={885}
      decoding="async"
      className={`h-8 w-8 object-contain ${className}`}
    />
  );
}

export { ChevronDown };
