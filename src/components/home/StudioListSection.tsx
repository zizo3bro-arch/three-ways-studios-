import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { subscribeNewsletter } from '../../lib/api';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { Reveal } from '../ui/Reveal';

/* =========================================================
   THE STUDIO LIST — one letter per drop. Wired to the real
   newsletter endpoint (Supabase when configured, local store in
   demo mode) and issues the WELCOME10 code at checkout.
   Set on the paper with a single hairline, no card.
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
    try {
      const result = await subscribeNewsletter(trimmedEmail);

      if (!result.ok) {
        setError(result.error ?? 'That did not go through — try again in a moment.');
        return;
      }

      try {
        const raw = localStorage.getItem('tws_studio_list_v1');
        const list = raw
          ? (JSON.parse(raw) as Array<{ name: string; email: string; at: string }>)
          : [];
        list.unshift({
          name: trimmedName,
          email: trimmedEmail.toLowerCase(),
          at: new Date().toISOString(),
        });
        localStorage.setItem('tws_studio_list_v1', JSON.stringify(list.slice(0, 200)));
      } catch {
        // storage unavailable — the subscription is already recorded
      }

      setCode(result.discountCode ?? null);
      setDone(true);
    } catch {
      // network/transport failure — surface it instead of leaving the form stuck
      setError('The studio list is unavailable right now. Please try again in a moment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="studio-list"
      aria-labelledby="studio-list-title"
      className="relative border-t border-ink/14 py-16 sm:py-20 lg:py-24"
    >
      <div className="mx-auto grid w-full max-w-[1800px] gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:px-10">
        <Reveal className="lg:col-span-7" preset="soft">
          <p className="tws-index">05 / The studio list</p>
          <h2
            id="studio-list-title"
            className="mt-3 font-display uppercase leading-[0.85] tracking-[0.004em] text-ink"
            style={{ fontSize: 'clamp(2.1rem, 6.4vw, 5rem)' }}
          >
            One letter
            <span className="block text-crimson">per drop.</span>
          </h2>
          <p className="mt-5 max-w-lg font-serif text-[15px] italic leading-relaxed text-ink-soft sm:text-[16.5px]">
            {settings.newsletter_text ||
              'Early access to the cut, the fitting notes, and 10% off your first pair.'}
          </p>
          <p className="mt-6 max-w-md text-[10px] font-semibold uppercase leading-[2] tracking-[0.2em] text-ink-faint">
            No spam · one letter per drop · unsubscribe in one click
          </p>
        </Reveal>

        <div className="lg:col-span-5">
          <Reveal preset="soft" delay={0.1}>
            <div className="border-t border-ink/25 pt-6">
              {done ? (
                <div>
                  <p className="tws-eyebrow text-crimson">You are on the list</p>
                  <h3 className="mt-3 tws-signature text-ink text-[2.6rem] leading-[0.9]">
                    Welcome in.
                  </h3>
                  <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
                    {name.trim().split(' ')[0] || 'friend'}, your place in the next fitting round is
                    held.
                    {code ? (
                      <>
                        {' '}
                        Use <span className="font-bold tracking-[0.14em] text-crimson">{code}</span>{' '}
                        at checkout for 10% off your first pair.
                      </>
                    ) : null}
                  </p>
                  <Link to="/shop" className="tws-pill mt-6 h-[52px] w-full justify-center">
                    Go to the shop
                    <ArrowRight className="h-4 w-4" strokeWidth={2} />
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="studio-name" className="mb-1 block tws-eyebrow text-ink-soft">
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
                      className="tws-field text-[15px]"
                    />
                  </div>
                  <div>
                    <label htmlFor="studio-email" className="mb-1 block tws-eyebrow text-ink-soft">
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
                      className="tws-field text-[15px]"
                    />
                  </div>

                  {error ? (
                    <p role="alert" className="text-[12px] font-semibold leading-snug text-crimson">
                      {error}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="tws-pill h-[52px] w-full justify-center disabled:opacity-60"
                  >
                    {submitting ? 'Sending…' : 'Join the studio list'}
                    <ArrowRight className="h-4 w-4" strokeWidth={2} />
                  </button>
                </form>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
