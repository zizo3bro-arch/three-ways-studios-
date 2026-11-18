import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export function NotFoundPage() {
  return (
    <section className="relative isolate flex min-h-[80svh] flex-col items-center justify-center overflow-hidden px-4 py-28 text-center">
      <div className="relative z-10">
        <p className="tws-eyebrow text-crimson">404 — off the rail</p>
        <h1
          className="mt-4 font-display uppercase leading-[0.86] tracking-[0.004em] text-ink"
          style={{ fontSize: 'clamp(2.4rem, 7.5vw, 5rem)' }}
        >
          This page isn’t
          <span className="block text-crimson">in the drop</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md font-serif text-[15px] italic leading-relaxed text-ink-soft">
          The link you followed doesn’t resolve to a page at the house. The two silhouettes are still
          where you left them.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
          <Link to="/shop" className="tws-pill h-12">
            Go to the shop
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
          <Link to="/" className="tws-pill tws-pill--outline h-12">
            Back home
          </Link>
        </div>
      </div>
    </section>
  );
}
