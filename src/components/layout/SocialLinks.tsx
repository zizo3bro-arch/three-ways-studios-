import { AtSign, Instagram, Music2, Youtube } from 'lucide-react';
import { useSiteSettings } from '../../context/SiteSettingsContext';

/* =========================================================
   Social links — read from site_settings so admin edits take
   effect; external URLs open safely in a new tab.
   ========================================================= */

const ICONS: Record<string, typeof Instagram> = {
  instagram: Instagram,
  tiktok: Music2,
  youtube: Youtube,
  x: AtSign,
};

export function SocialLinks({ className = '', tone = 'ink' }: { className?: string; tone?: 'ink' | 'ivory' }) {
  const { settings } = useSiteSettings();
  const entries = Object.entries(settings.social_links ?? {}).filter(([, href]) => Boolean(href));

  if (entries.length === 0) return null;

  return (
    <ul className={`flex items-center gap-2.5 ${className}`}>
      {entries.map(([key, href]) => {
        const Icon = ICONS[key] ?? Instagram;
        const label = key.toUpperCase();
        return (
          <li key={key}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Three Ways Studios on ${label}`}
              title={`${label} — opens in a new tab`}
              className={[
                'flex h-9 w-9 items-center justify-center rounded-full border transition-colors duration-300',
                tone === 'ivory'
                  ? 'border-ivory/25 text-ivory/80 hover:border-ivory hover:bg-ivory hover:text-ink'
                  : 'border-ink/20 text-ink-soft hover:border-crimson-bright hover:bg-crimson-bright hover:text-ivory',
              ].join(' ')}
            >
              <Icon className="h-[15px] w-[15px]" strokeWidth={1.7} />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
