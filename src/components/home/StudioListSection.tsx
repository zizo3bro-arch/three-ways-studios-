import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { subscribeNewsletter } from '../../lib/api';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { Reveal } from '../ui/Reveal';
import { SmokeField } from '../ui/SmokeField';

/* =========================================================
   THE STUDIO LIST — one letter per drop. Wired to the real
   newsletter endpoint (Supabase when configured, local store in
   demo mode) and issues the WELCOME10 code at checkout.
   ========================================================= */

export function StudioListSection() {
  const { settings } = useSiteSettings();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (trimmedName.length < 2) {
      setError('Tell us your name first — the letter is addressed to someone.');
      return;
    }

    setSubmitting(true);
    const result = await subscribeNewsletter(trimmedEmail);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error ?? 'That did not go through — try again in a moment.');
      return;
    }

    try {
      const raw = localStorage.getItem('tws_studio_list_v1');
      const list = raw ? (JSON.parse(raw) as Array<{ name: string; email: string; at: string }>) : [];
      list.unshift({ name: trimmedName, email: trimmedEmail.toLowerCase(), at: new Date().toISOString() });
      localStorage.setItem('tws_studio_list_v1', JSON.stringify(list.slice(0, 200)));
    } catch {
      // storage unavailable — the subscription is already recorded
    }

    setCode(result.discountCode ?? null);
    setDone(true);
  };

  return (
    <section
      id="studio-list"
      aria-labelledby="studio-list-title"
      className="relative isolate overflow-hidden border-t border-ink/12 bg-ivory py-20 sm:py-24"
    >
      <SmokeField variant="soft" opacity="low" />

      <div className="relative z-10 mx-auto grid w-full max-w-[1660px] gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-8 lg:px-10">
        <Reveal className="lg:col-span-6" preset="soft">
          <p className="tws-eyebrow text-crimson-bright">The Studio List</p>
          <h2
            id="studio-list-title"
            className="mt-4 font-display uppercase leading-[0.9] tracking-[0.002em] text-ink text-[clamp(2.1rem,5.8vw,4.2rem)]"
          >
            One letter
            <span className="block">per drop. nothing else.</span>
          </h2>
          <p className="mt-5 max-w-lg font-serif text-[15px] italic leading-relaxed text-ink-soft sm:text-[16.5px]">
            {settings.newsletter_text ||
              'Early access to the cut, the fitting notes, and 10% off your first pair.'}
          </p>
        </Reveal>

        <div className="lg:col-span-5 lg:col-start-8">
          <Reveal preset="soft" delay={0.1}>
            <div className="rounded-[1.4rem] border border-ink/14 bg-paper p-5 shadow-plate sm:p-7">
              {done ? (
                <div>
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-crimson-bright text-ivory">
                    <Check className="h-5 w-5" strokeWidth={2.4} />
                  </span>
                  <h3 className="mt-4 tws-signature tws-signature--ink text-[2.4rem] leading-[0.9]">
                    Welcome to the list.
                  </h3>
                  <p className="mt-3 text-[13.5px] leading-relaxed text-ink-soft">
                    {name.trim().split(' ')[0] || 'friend'}, your place in the next fitting round is
                    held.
                    {code ? (
                      <>
                        {' '}
                        Use <span className="font-bold tracking-[0.14em] text-crimson">{code}</span> at
                        checkout for 10% off your first pair.
                      </>
                    ) : null}
                  </p>
                  <Link to="/shop" className="tws-pill mt-5 h-12 w-full justify-center">
                    Go to the shop
                    <ArrowRight className="h-4 w-4" strokeWidth={2} />
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3.5">
                  <div>
                    <label htmlFor="studio-name" className="mb-1.5 block tws-eyebrow text-ink-soft">
                      Your name
                    </label>
                    <input
                      id="studio-name"
                      type="text"
                      required
                      autoComplete="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="e.g. Omar Hassan"
                      className="h-13 w-full rounded-xl border border-ink/18 bg-ivory/60 px-4 text-[15px] text-ink outline-none transition-colors duration-200 placeholder:text-ink-faint/80 focus:border-crimson-bright focus:bg-paper"
                    />
                  </div>
                  <div>
                    <label htmlFor="studio-email" className="mb-1.5 block tws-eyebrow text-ink-soft">
                      Your email
                    </label>
                    <input
                      id="studio-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      className="h-13 w-full rounded-xl border border-ink/18 bg-ivory/60 px-4 text-[15px] text-ink outline-none transition-colors duration-200 placeholder:text-ink-faint/80 focus:border-crimson-bright focus:bg-paper"
                    />
                  </div>

                  {error ? (
                    <p role="alert" className="text-[12px] font-semibold leading-snug text-crimson-bright">
                      {error}
                    </p>
                  ) : null}

                  <button type="submit" disabled={submitting} className="tws-pill h-13 w-full justify-center disabled:opacity-60">
                    {submitting ? 'Sending…' : 'Join the studio list'}
                    <ArrowRight className="h-4 w-4" strokeWidth={2} />
                  </button>
                  <p className="text-center text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                    No spam · Unsubscribe in one click
                  </p>
                </form>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
