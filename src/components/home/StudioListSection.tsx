import { useState, type FormEvent } from 'react';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { ArrowRight } from 'lucide-react';
import { subscribeNewsletter } from '../../lib/api';

export function StudioListSection() {
  const { settings } = useSiteSettings();
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  async function subscribe(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setNotice(null);
    setPending(true);
    const result = await subscribeNewsletter(email);
    setPending(false);
    setNotice({ ok: result.ok, text: result.message });
    if (result.ok) setEmail('');
  }
  return (
    <section className="newsletter" aria-labelledby="newsletter-title">
      <h2 id="newsletter-title" className="section-label">
        {settings.newsletter_text}
      </h2>
      <form onSubmit={subscribe}>
        <label className="sr-only" htmlFor="studio-email">
          Email address
        </label>
        <input
          id="studio-email"
          type="email"
          required
          autoComplete="email"
          placeholder="Enter your email address"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setNotice(null);
          }}
        />
        <button className="tws-pill compact-pill" disabled={pending}>
          {pending ? 'Subscribing…' : 'Subscribe'} <ArrowRight />
        </button>
      </form>
      {notice && (
        <p className="form-note" role={notice.ok ? 'status' : 'alert'}>
          {notice.text}
        </p>
      )}
    </section>
  );
}
