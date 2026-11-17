import { Link } from 'react-router-dom';

/* =========================================================
   Emblem — the Three Ways Studios logo mark and wordmark.
   ========================================================= */

interface EmblemProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  withWordmark?: boolean;
}

const SIZES: Record<NonNullable<EmblemProps['size']>, string> = {
  xs: 'h-7 w-7',
  sm: 'h-9 w-9 sm:h-10 sm:w-10',
  md: 'h-14 w-14',
  lg: 'h-24 w-24 sm:h-28 sm:w-28',
};

export function Emblem({ size = 'sm', className = '', withWordmark = true }: EmblemProps) {
  return (
    <Link
      to="/"
      aria-label="Three Ways Studios — home"
      className={`group inline-flex items-center gap-2.5 ${className}`}
    >
      <span
        className={`relative block shrink-0 overflow-hidden ${SIZES[size]} rounded-[2px] transition-transform duration-300 group-hover:scale-[1.03]`}
      >
        <img
          src="/assets/three-ways-studios-logo.png"
          alt="Three Ways Studios"
          width={766}
          height={885}
          decoding="async"
          className="h-full w-full object-contain object-left"
        />
      </span>
      {withWordmark ? (
        <span className="hidden select-none text-[11px] font-bold uppercase tracking-[0.2em] text-ink transition-colors group-hover:text-crimson min-[380px]:inline-block sm:text-xs">
          Three Ways Studios
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
