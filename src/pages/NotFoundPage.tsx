import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { SprayType } from '../components/ui/SprayType';

/* =========================================================
   404 — same canvas, same type, one way back into the drop.
   ========================================================= */

export function NotFoundPage() {
  return (
    <section className="tws-paper relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-4 py-24 text-center">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 opacity-[0.55]">
        <SprayType text="NOT IN THE ARCHIVE" />
      </div>

      <div className="relative z-10">
        <p className="tws-eyebrow text-crimson-bright">Error 404</p>
        <h1 className="mt-4 font-display uppercase leading-[0.9] tracking-[0.002em] text-ink text-[clamp(2.2rem,7vw,4.4rem)]">
          This page never
          <span className="block">made the cut</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-[13.5px] leading-relaxed text-ink-soft">
          The link is broken or the piece has sold through. Two silhouettes are waiting in the shop.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
          <Link to="/shop" className="tws-pill h-13">
            Go to the shop
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
          <Link to="/" className="tws-pill tws-pill--outline h-13">
            Back to the campaign
          </Link>
        </div>
      </div>
    </section>
  );
}
