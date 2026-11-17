import type { CSSProperties } from 'react';

/* =========================================================
   SprayType — the house's painted letterform, reusable.
   One component owns the three-layer paint (halo, bleed, core)
   plus the overspray speckle, so every surface that says the
   name in paint says it the same way.

   Layers are absolutely stacked inside a box whose height is set
   from the font metrics in index.css, so the halo can never push
   the layout around or overflow into neighbouring content.
   ========================================================= */

interface SprayTypeProps {
  text: string;
  className?: string;
  /**
   * Explicit font-size. When omitted, .tws-spray--display derives the
   * size from the viewport so the paint fills its container exactly
   * (see index.css — the divisor is the font's measured advance width).
   */
  fontSize?: string;
  /** paint opacity 0–1 */
  opacity?: number;
  /** lines to break into on phones only (e.g. ["THREE", "WAYS"]) */
  mobileWords?: string[];
  style?: CSSProperties;
}

export function SprayType({
  text,
  className = '',
  fontSize,
  opacity = 1,
  mobileWords,
  style,
}: SprayTypeProps) {
  const words = mobileWords && mobileWords.length > 0 ? mobileWords : null;

  return (
    <div
      aria-hidden="true"
      className={`tws-spray ${className}`}
      style={{ ...(fontSize ? { fontSize } : null), opacity, ...style }}
    >
      {(['halo', 'bleed', 'core'] as const).map((layer) => (
        <span key={layer} className={`tws-spray__layer tws-spray__layer--${layer}`}>
          {words ? (
            <>
              {words.map((word, index) => (
                <span
                  key={word}
                  className="tws-spray__word"
                  data-second={index > 0 ? 'true' : undefined}
                >
                  {word}
                  {index < words.length - 1 ? ' ' : ''}
                </span>
              ))}
            </>
          ) : (
            text
          )}
        </span>
      ))}
      <span className="tws-spray__speckle" />
    </div>
  );
}
