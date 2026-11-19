import { Instagram } from 'lucide-react';
import { useSiteSettings, DEFAULT_SITE_SETTINGS } from '../../context/SiteSettingsContext';
import type { SocialChannel, SocialLinks as SocialSettings } from '../../types/database';

const HOSTS: Record<string, string[]> = {
  instagram: ['instagram.com'],
  tiktok: ['tiktok.com'],
  youtube: ['youtube.com'],
  x: ['x.com', 'twitter.com'],
  facebook: ['facebook.com', 'fb.com'],
  whatsapp: ['wa.me', 'api.whatsapp.com', 'whatsapp.com'],
};

/**
 * Only an https link on the network's own domain is accepted. Anything else
 * falls back to the studio's configured default, so a mistyped CMS entry can
 * never send a customer to an unexpected host.
 */
export function socialUrl(key: keyof SocialSettings, settings: SocialSettings) {
  try {
    const url = new URL(settings[key] || '');
    if (
      url.protocol === 'https:' &&
      HOSTS[key]?.includes(url.hostname.replace(/^www\./, '')) &&
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
  facebook:
    'M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06C2 17.08 5.66 21.25 10.44 22v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.49-3.91 3.77-3.91 1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.77l-.44 2.91h-2.33V22C18.34 21.25 22 17.08 22 12.06Z',
  whatsapp:
    'M12.04 2C6.6 2 2.2 6.4 2.2 11.84c0 1.74.46 3.44 1.32 4.94L2 22l5.36-1.4a9.83 9.83 0 0 0 4.68 1.19c5.44 0 9.84-4.4 9.84-9.84S17.48 2 12.04 2Zm0 17.94c-1.5 0-2.98-.4-4.27-1.16l-.3-.18-3.18.83.85-3.1-.2-.32a8.13 8.13 0 0 1-1.25-4.35c0-4.5 3.66-8.16 8.16-8.16s8.16 3.66 8.16 8.16-3.66 8.16-8.16 8.16Zm4.48-6.11c-.24-.12-1.45-.72-1.67-.8-.22-.08-.39-.12-.55.12-.16.24-.63.8-.77.96-.14.16-.28.18-.52.06-.24-.12-1.03-.38-1.96-1.21-.72-.65-1.21-1.45-1.35-1.69-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.33-.75-1.81-.2-.48-.4-.42-.55-.42h-.47c-.16 0-.42.06-.63.3-.22.24-.83.81-.83 1.98s.85 2.3.97 2.46c.12.16 1.67 2.55 4.05 3.58.57.24 1.01.39 1.35.5.57.18 1.09.15 1.5.09.46-.07 1.45-.59 1.65-1.16.2-.57.2-1.06.14-1.16-.06-.11-.22-.17-.46-.29Z',
};

function ChannelIcon({ channel }: { channel: SocialChannel }) {
  if (channel.key === 'instagram') return <Instagram />;
  const path = paths[channel.key as keyof typeof paths];
  if (!path) return <Instagram />;
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

/**
 * The footer's social row. Channels are ordered and individually switchable from
 * the Studio Console; a disabled channel is not rendered at all, and an invalid
 * URL falls back to the studio's configured profile rather than a broken link.
 */
export function SocialLinks() {
  const { settings } = useSiteSettings();
  const channels = (settings.social_channels ?? []).filter(
    (channel) => channel.enabled && (channel.url || DEFAULT_SITE_SETTINGS.social_links[channel.key])
  );
  if (!channels.length) return null;

  return (
    <ul className="social-links" aria-label="Social profiles">
      {channels.map((channel) => (
        <li key={channel.key}>
          <a
            href={channel.url || socialUrl(channel.key, settings.social_links)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Three Ways Studios on ${channel.label}`}
            data-testid={`social-${channel.key}`}
          >
            <ChannelIcon channel={channel} />
          </a>
        </li>
      ))}
    </ul>
  );
}
