import { Instagram } from 'lucide-react';
import { useSiteSettings, DEFAULT_SITE_SETTINGS } from '../../context/SiteSettingsContext';
import type { SocialLinks as SocialSettings } from '../../types/database';

export function socialUrl(key: keyof SocialSettings, settings: SocialSettings) {
  try {
    const url = new URL(settings[key] || '');
    const hosts = {
      instagram: ['instagram.com'],
      tiktok: ['tiktok.com'],
      youtube: ['youtube.com'],
      x: ['x.com', 'twitter.com'],
    };
    if (
      url.protocol === 'https:' &&
      hosts[key].includes(url.hostname.replace(/^www\./, '')) &&
      url.pathname.length > 1
    )
      return url.href;
  } catch {
    /* Invalid or unset setting: keep the studio's configured default profile. */
  }
  return DEFAULT_SITE_SETTINGS.social_links[key];
}
const paths = {
  x: 'M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.5 22H2.3l8.2-9.4L2.8 2h6.4l4.6 6.6L18.9 2ZM17.8 20h1.8L8.2 4H6.3l11.5 16Z',
  youtube:
    'M23 7.1a3 3 0 0 0-2.1-2.2C19 4.4 12 4.4 12 4.4s-7 0-8.9.5A3 3 0 0 0 1 7.1C.5 9 .5 12 .5 12s0 3 .5 4.9a3 3 0 0 0 2.1 2.2c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.2c.5-1.9.5-4.9.5-4.9s0-3-.5-4.9ZM9.7 15.5v-7l6.2 3.5-6.2 3.5Z',
  tiktok:
    'M16.5 2c.4 2.8 2.2 4.6 5 4.9v3.7a9.2 9.2 0 0 1-5-1.6v7a7 7 0 1 1-6-6.9v3.8a3.4 3.4 0 1 0 2.3 3.2V2h3.7Z',
};
export function SocialLinks() {
  const { settings } = useSiteSettings();
  return (
    <ul className="social-links" aria-label="Social profiles">
      {(['instagram', 'tiktok', 'youtube', 'x'] as const).map((key) => (
        <li key={key}>
          <a
            href={socialUrl(key, settings.social_links)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Three Ways Studios on ${key}`}
          >
            {key === 'instagram' ? (
              <Instagram />
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d={paths[key]} />
              </svg>
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}
