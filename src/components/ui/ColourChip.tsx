/* =========================================================
   ColourChip — THE fixed colour display element.

   It is deliberately not derived from product data: it is a white
   square on the navy piece, on the black piece, in the bag, on the
   PDP and in checkout. Product selection can never repaint it, and
   nothing in the app threads a colour value into it.
   ========================================================= */

interface ColourChipProps {
  /** the garment colour is communicated as words, never as a paint chip */
  label?: string;
  size?: 'sm' | 'lg';
  className?: string;
}

export function ColourChip({ label, size = 'sm', className = '' }: ColourChipProps) {
  const chip = size === 'lg' ? 'tws-swatch tws-swatch--lg' : 'tws-swatch';

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span aria-hidden="true" className={chip} />
      {label ? (
        <span
          className={
            size === 'lg'
              ? 'text-[10px] font-bold uppercase tracking-[0.2em] text-ink-soft'
              : 'text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-faint'
          }
        >
          {label}
        </span>
      ) : (
        <span className="sr-only">Colour shown as a fixed white plate</span>
      )}
    </span>
  );
}
