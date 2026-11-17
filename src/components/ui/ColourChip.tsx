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
  /**
   * Describe the plate itself for screen readers. Default off: most call
   * sites already name the colour in adjacent text, so announcing it again
   * would be noise — and the plate is decorative, not informative.
   */
  describe?: boolean;
}

export function ColourChip({
  label,
  size = 'sm',
  className = '',
  describe = false,
}: ColourChipProps) {
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
      ) : describe ? (
        <span className="sr-only">Colour plate</span>
      ) : null}
    </span>
  );
}
