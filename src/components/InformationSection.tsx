import { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { subscribeNewsletter } from '../lib/api';

const FACTS: Array<{ label: string; value: string }> = [
  { label: 'The House', value: 'Cairo — Atelier & Flagship' },
  { label: 'The Craft', value: 'Raw selvedge · 13–14 oz' },
  { label: 'The Reach', value: 'Worldwide · COD in Egypt' },
  { label: 'The Code', value: 'Three silhouettes. Zero compromise.' },
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
      className="relative border-t border-ink/12 bg-cream text-ink"
    >
      <div aria-hidden="true" className="tws-grain pointer-events-none absolute inset-0" />
      <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-12 lg:gap-10 lg:px-12 xl:gap-16">
        {/* ——— LEFT · Information ——— */}
        <div className="lg:col-span-5">
          <p className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.34em] text-crimson">
            <span aria-hidden="true" className="h-px w-8 bg-crimson/60" />
            Information
          </p>
          <h2 className="mt-4 font-display text-4xl uppercase leading-[0.92] text-ink sm:text-5xl xl:text-6xl">
            Three Ways
            <span className="block">Studios</span>
          </h2>
          <p className="mt-6 max-w-md text-[13.5px] leading-relaxed text-ink-soft sm:text-sm">
            Three Ways Studios is an editorial streetwear house dedicated to a single obsession —
            the perfect pair of pants. We cut heavyweight raw selvedge and Italian-blend cloth into
            architectural wide-flare silhouettes, finish every seam by hand in our Cairo atelier,
            and release them in small, numbered drops. Fashion beyond limits — never mass produced,
            never diluted.
          </p>

          <dl className="mt-8 max-w-md border-t border-ink/15">
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

        {/* ——— RIGHT · Name & Email — Studio List form ——— */}
        <div className="flex flex-col justify-center lg:col-span-6 lg:col-start-7">
          {done ? (
            <div className="max-w-md">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-cream">
                <Check className="h-6 w-6" strokeWidth={2.4} />
              </span>
              <h3 className="mt-6 font-script text-4xl text-ink">Welcome to the list.</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                Your seat at Drop 01 is held, <span className="font-semibold text-ink">{name.trim().split(' ')[0] || 'friend'}</span>.
                Your welcome code <span className="font-bold tracking-[0.18em] text-crimson">WELCOME10</span> applies
                10% off at checkout — backend-verified.
              </p>
              <a
                href="#products"
                className="mt-8 inline-flex h-12 items-center gap-3 rounded-full bg-ink pl-7 pr-2 text-[10px] font-bold uppercase tracking-[0.24em] text-cream transition-colors duration-300 hover:bg-crimson-bright"
              >
                Back to the drop
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cream text-ink">
                  <ArrowRight className="h-4 w-4 rotate-90" strokeWidth={2} />
                </span>
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="max-w-md" noValidate={false}>
              <p className="text-[10px] font-bold uppercase tracking-[0.34em] text-crimson">
                The Studio List
              </p>
              <h3 className="mt-3 font-script text-4xl leading-none text-ink sm:text-5xl">
                First access, always.
              </h3>
              <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
                One letter per drop — restocks, fit notes and private previews before the public
                release. No noise, no spam.
              </p>

              <div className="mt-7 space-y-4">
                <div>
                  <label htmlFor="studio-name" className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.28em] text-ink-soft">
                    Name
                  </label>
                  <input
                    id="studio-name"
                    type="text"
                    required
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full rounded-2xl border border-ink/15 bg-cream-card px-5 py-4 text-sm text-ink placeholder-ink-faint shadow-[inset_0_1px_2px_rgba(20,18,16,0.05)] transition-shadow focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-crimson-bright/25"
                  />
                </div>
                <div>
                  <label htmlFor="studio-email" className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.28em] text-ink-soft">
                    Email
                  </label>
                  <input
                    id="studio-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-2xl border border-ink/15 bg-cream-card px-5 py-4 text-sm text-ink placeholder-ink-faint shadow-[inset_0_1px_2px_rgba(20,18,16,0.05)] transition-shadow focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-crimson-bright/25"
                  />
                </div>
              </div>

              {error && (
                <p role="alert" className="mt-4 text-xs font-semibold text-crimson-bright">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="group mt-6 inline-flex h-14 w-full items-center justify-center gap-3 rounded-full bg-ink text-[10px] font-bold uppercase tracking-[0.28em] text-cream transition-all duration-300 hover:bg-crimson-bright disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:pl-10 sm:pr-3"
              >
                {submitting ? 'Securing your place…' : 'Request Early Access'}
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cream text-ink transition-transform duration-300 group-hover:translate-x-1">
                  <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </span>
              </button>
              <p className="mt-4 text-[10px] leading-relaxed tracking-wide text-ink-faint">
                Joining applies your 10% welcome code at checkout. Unsubscribe anytime, one click.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
