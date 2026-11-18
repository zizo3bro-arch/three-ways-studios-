import { Link } from 'react-router-dom';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { SocialLinks, socialUrl } from './SocialLinks';
import { Emblem } from '../ui/Emblem';

export function SiteFooter() {
  const { settings } = useSiteSettings();
  const legalLabel = (path: string, fallback: string) =>
    settings.footer_links.find((item) => item?.path === path)?.label || fallback;
  const contact =
    settings.footer_links.find((item) => /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(item?.path))?.path ||
    socialUrl('instagram', settings.social_links);
  return (
    <footer className="page-width colophon">
      <div className="colophon-row">
        <Emblem />
        <SocialLinks />
        <nav aria-label="Footer navigation">
          <Link to="/terms" aria-label="Terms & conditions">
            {legalLabel('/terms', 'Terms')}
          </Link>
          <i />
          <Link to="/privacy" aria-label="Privacy policy">
            {legalLabel('/privacy', 'Privacy')}
          </Link>
        </nav>
      </div>
      <div className="colophon-meta">
        <p>{settings.copyright_text}</p>
        <p>
          {settings.footer_tagline} <span>·</span>{' '}
          <a className="text-action" href={contact} target="_blank" rel="noopener noreferrer">
            Contact the studio
          </a>
        </p>
      </div>
    </footer>
  );
}
