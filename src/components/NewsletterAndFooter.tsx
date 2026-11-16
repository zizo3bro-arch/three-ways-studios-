import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { subscribeNewsletter } from '../lib/api';

export function NewsletterAndFooter() {
  const { settings } = useSiteSettings();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setStatus(null);
    const res = await subscribeNewsletter(email);
    setSubmitting(false);
    if (res.ok) {
      setStatus({ type: 'ok', msg: 'You are subscribed to THREE WAYS STUDIOS updates.' });
      setEmail('');
    } else {
      setStatus({ type: 'err', msg: res.error ?? 'Could not subscribe right now.' });
    }
  };

  return (
    <footer className="relative mx-auto max-w-[1380px] px-5 pt-16 pb-12 sm:px-8 lg:px-12">
      {/* Newsletter Row */}
      <div className="flex flex-col justify-between gap-6 border-t border-white/10 pt-14 pb-16 lg:flex-row lg:items-center">
        <p className="max-w-xs text-sm leading-relaxed text-[#cfc6c6]">
          {settings.newsletter_text}
        </p>

        <form onSubmit={handleSubscribe} className="w-full max-w-xl">
          <div className="flex flex-col overflow-hidden rounded-[6px] border border-white/15 bg-black/35 sm:flex-row">
            <label htmlFor="newsletter-email" className="sr-only">
              Email address
            </label>
            <input
              id="newsletter-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              className="flex-1 bg-transparent px-4 py-3 text-xs text-white placeholder-[#7d7373] focus:outline-none"
            />
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#8e0911] to-[#c4111a] px-6 py-3 text-xs font-medium tracking-[0.14em] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <span>{submitting ? 'Sending...' : 'Subscribe'}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          {status && (
            <p
              className={`mt-2 flex items-center gap-1.5 text-xs ${
                status.type === 'ok' ? 'text-[#e5d8d8]' : 'text-[#ff7575]'
              }`}
            >
              {status.type === 'ok' && <Check className="h-3.5 w-3.5 text-[#d4121b]" />}
              {status.msg}
            </p>
          )}
        </form>
      </div>

      {/* Main Footer Navigation + Socials */}
      <div className="flex flex-col justify-between gap-8 border-t border-white/10 py-10 md:flex-row md:items-center">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
          <Link to="/" className="inline-flex items-center gap-3">
            <span className="font-script text-3xl text-[#f2eded] sm:text-4xl">
              {settings.hero_script_text}
            </span>
          </Link>

          <span className="hidden h-7 w-px bg-white/15 sm:inline-block" />

          <nav aria-label="Footer navigation" className="flex flex-wrap items-center gap-6">
            {settings.footer_links.map((item) => (
              <Link
                key={item.label}
                to={item.path}
                className="text-xs tracking-[0.08em] text-[#a89d9d] transition-colors hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Social Icons */}
        <div className="flex items-center gap-5 text-[#cfc6c6]">
          <a
            href={settings.social_links.instagram || 'https://instagram.com'}
            target="_blank"
            rel="noreferrer"
            aria-label="Instagram"
            className="transition-colors hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-none stroke-current" strokeWidth="1.7">
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1" className="fill-current stroke-none" />
            </svg>
          </a>
          <a
            href={settings.social_links.tiktok || 'https://tiktok.com'}
            target="_blank"
            rel="noreferrer"
            aria-label="TikTok"
            className="transition-colors hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-current">
              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.7a8.18 8.18 0 0 0 4.76 1.52v-3.4a4.85 4.85 0 0 1-1-.13z" />
            </svg>
          </a>
          <a
            href={settings.social_links.youtube || 'https://youtube.com'}
            target="_blank"
            rel="noreferrer"
            aria-label="YouTube"
            className="transition-colors hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-[19px] w-[19px] fill-current">
              <path d="M21.58 7.19a2.75 2.75 0 0 0-1.94-1.95C17.93 4.78 12 4.78 12 4.78s-5.93 0-7.64.46A2.75 2.75 0 0 0 2.42 7.2 28.7 28.7 0 0 0 2 12a28.7 28.7 0 0 0 .42 4.81 2.75 2.75 0 0 0 1.94 1.95c1.71.46 7.64.46 7.64.46s5.93 0 7.64-.46a2.75 2.75 0 0 0 1.94-1.95A28.7 28.7 0 0 0 22 12a28.7 28.7 0 0 0-.42-4.81zM10 15V9l5.2 3L10 15z" />
            </svg>
          </a>
          <a
            href={settings.social_links.x || 'https://x.com'}
            target="_blank"
            rel="noreferrer"
            aria-label="X"
            className="transition-colors hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-[16px] w-[16px] fill-current">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
        </div>
      </div>

      {/* Copyright & Tagline */}
      <div className="flex flex-col justify-between gap-4 border-t border-white/8 pt-6 text-[10px] tracking-[0.14em] text-[#847878] sm:flex-row sm:items-center">
        <p>{settings.copyright_text}</p>
        <div className="flex items-center gap-4">
          <span className="uppercase">{settings.footer_tagline}</span>
          <span className="h-px w-10 bg-white/25" />
        </div>
      </div>
    </footer>
  );
}
