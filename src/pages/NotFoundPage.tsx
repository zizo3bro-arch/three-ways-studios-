import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export function NotFoundPage() {
  return (
    <section className="flex min-h-[75svh] flex-col items-center justify-center bg-white px-4 py-24 text-center">
      <p className="tws-eyebrow text-crimson">404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        Page not found
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
        The page you are looking for does not exist or has been moved.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link to="/shop" className="tws-pill">
          Go to Shop
          <ArrowRight className="h-4 w-4" strokeWidth={2} />
        </Link>
        <Link to="/" className="tws-pill tws-pill--outline">
          Back Home
        </Link>
      </div>
    </section>
  );
}
