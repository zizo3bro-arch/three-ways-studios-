/* =========================================================
   SmokeField — slow red smoke, scoped to the cinematic chapter.
   Layer 1 + 2: the real smoke plate (multiply-blended on ivory).
   Layer 3: two soft crimson hazes for depth.
   Animate=transform only; the blur is baked into the layer once.
   `variant="soft"` = single layer for hero-adjacent / mobile use.
   ========================================================= */

interface SmokeFieldProps {
  variant?: 'full' | 'soft';
  /** extra opacity multiplier via class only — keeps the effect restrained */
  opacity?: 'low' | 'mid' | 'high';
  className?: string;
}

export function SmokeField({ variant = 'full', opacity = 'mid', className = '' }: SmokeFieldProps) {
  const opacityClass =
    opacity === 'low' ? 'opacity-[0.55]' : opacity === 'high' ? 'opacity-[0.95]' : 'opacity-[0.78]';

  return (
    <div
      aria-hidden="true"
      className={`tws-smoke ${variant === 'soft' ? 'tws-smoke--soft' : ''} ${opacityClass} ${className}`}
    >
      <div className="tws-smoke__layer" />
      {variant === 'full' ? <div className="tws-smoke__layer tws-smoke__layer--b" /> : null}
      <div className="tws-smoke__haze" />
    </div>
  );
}
