import { useState } from 'react';
import { ArrowRight, ArrowUp, Check } from 'lucide-react';
import { subscribeNewsletter } from '../lib/api';

const FACTS: Array<{ label: string; value: string }> = [
  { label: 'The House', value: 'Cairo — Atelier & Flagship' },
  { label: 'The Craft', value: 'Raw selvedge · 13–14 oz' },
  { label: 'The Reach', value: 'Worldwide · COD in Egypt' },
];

export function InformationSection() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (trimmedName.length < 2) {
      setError('Please tell us your name.');
      return;
    }
    setSubmitting(true);
    const res = await subscribeNewsletter(trimmedEmail);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not join right now — please try again.');
      return;
    }
    try {
      const raw = localStorage.getItem('tws_studio_list_v1');
      const list = raw ? (JSON.parse(raw) as Array<{ name: string; email: string }>) : [];
      list.push({ name: trimmedName, email: trimmedEmail.toLowerCase() });
      localStorage.setItem('tws_studio_list_v1', JSON.stringify(list));
    } catch {
      // storage unavailable — subscription already recorded server-side
    }
    setDone(true);
  };

  return (
    <section
      id="information"
      aria-label="Information — about Three Ways Studios"
      className="relative border-t border-ink/12 bg-transparent text-ink"
    >
      <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-10 px-5 py-14 sm:px-8 sm:py-16 lg:grid-cols-12 lg:gap-10 lg:px-12 xl:gap-16">
        {/* ——— LEFT · brief brand note ——— */}
        <div className="lg:col-span-5">
          <p className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.34em] text-crimson">
            <span aria-hidden="true" className="h-px w-8 bg-crimson/60" />
            Information
          </p>
          <h2 className="mt-4 font-display text-4xl uppercase leading-[0.92] text-ink sm:text-5xl">
            Three Ways
            <span className="block">Studios</span>
          </h2>
          <p className="mt-5 max-w-sm text-[14px] leading-relaxed text-ink-soft">
            Editorial streetwear built around one obsession — the perfect pair of pants.
            Hand-cut in Cairo.
          </p>

          <dl className="mt-7 max-w-sm border-t border-ink/15">
            {FACTS.map(({ label, value }) => (
              <div
                key={label}
                className="flex items-baseline justify-between gap-6 border-b border-ink/12 py-3"
              >
                <dt className="text-[9px] font-bold uppercase tracking-[0.28em] text-ink-faint">
                  {label}
                </dt>
                <dd className="text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-ink">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ——— RIGHT · Name & Email — Studio List card ——— */}
        <div className="lg:col-span-6 lg:col-start-7">
          <div className="max-w-lg rounded-[1.75rem] border-2 border-ink bg-[#FFFFFF] p-6 shadow-[0_24px_60px_-28px_rgba(20,18,16,0.45)] sm:p-8">
            {done ? (
              <div>
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-white">
                  <Check className="h-5 w-5" strokeWidth={2.6} />
                </span>
                <h3 className="mt-5 font-script text-4xl leading-none text-ink sm:text-5xl">
                  Welcome to the list.
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                  Your seat at Drop 01 is held,{' '}
                  <span className="font-semibold text-ink">
                    {name.trim().split(' ')[0] || 'friend'}
                  </span>
                  . Your welcome code{' '}
                  <span className="font-bold tracking-[0.18em] text-crimson">WELCOME10</span>{' '}
                  applies 10% off at checkout.
                </p>
                <a
                  href="#products"
                  className="mt-6 inline-flex h-12 items-center gap-3 rounded-full bg-ink pl-7 pr-2 text-[10px] font-bold uppercase tracking-[0.24em] text-white transition-colors duration-300 hover:bg-crimson-bright"
                >
                  Back to the drop
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink">
                    <ArrowUp className="h-4 w-4" strokeWidth={2} />
                  </span>
                </a>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate={false}>
                <p className="text-[10px] font-bold uppercase tracking-[0.34em] text-crimson">
                  The Studio List
                </p>
                <h3 className="mt-2 font-display text-3xl uppercase leading-[0.95] text-ink sm:text-4xl">
                  Name &amp; Email
                </h3>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">
                  One letter per drop — plus 10% off your first order.
                </p>

                <div className="mt-5 space-y-4">
                  <div>
                    <label
                      htmlFor="studio-name"
                      className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.26em] text-ink"
                    >
                      Your name
                    </label>
                    <input
                      id="studio-name"
                      type="text"
                      required
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Omar Hassan"
                      className="h-14 w-full rounded-xl border-2 border-ink/40 bg-white px-4 text-base text-ink outline-none transition-colors duration-150 placeholder:text-ink-faint focus:border-crimson-bright focus:ring-4 focus:ring-crimson-bright/15"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="studio-email"
                      className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.26em] text-ink"
                    >
                      Your email
                    </label>
                    <input
                      id="studio-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="h-14 w-full rounded-xl border-2 border-ink/40 bg-white px-4 text-base text-ink outline-none transition-colors duration-150 placeholder:text-ink-faint focus:border-crimson-bright focus:ring-4 focus:ring-crimson-bright/15"
                    />
                  </div>
                </div>

                {error && (
                  <p role="alert" className="mt-3 text-xs font-semibold text-crimson-bright">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="group mt-5 inline-flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-crimson-bright px-6 text-[11px] font-bold uppercase tracking-[0.26em] text-white transition-colors duration-200 hover:bg-crimson-deep disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Securing your place…' : 'Join the Studio List'}
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={2.2} />
                </button>
                <p className="mt-3 text-center text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                  Unsubscribe anytime · No spam
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
