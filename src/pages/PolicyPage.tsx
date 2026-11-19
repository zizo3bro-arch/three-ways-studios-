import { Link } from 'react-router-dom';
import { socialUrl } from '../components/layout/SocialLinks';
import { useContentBlock, useSiteSettings } from '../context/SiteSettingsContext';

export function PolicyPage({ privacy }: { privacy: boolean }) {
  const { settings } = useSiteSettings();
  const contactLine = useContentBlock('policy.contact', 'Three Ways Studios, Cairo, Egypt.');
  return (
    <article className="policy-page page-width">
      <h1>{privacy ? 'Privacy policy' : 'Terms & conditions'}</h1>
      {privacy ? (
        <>
          <h2>Your details</h2>
          <p>
            We use your name, email, phone number and delivery address to process and deliver your order.
            Order details are stored in our studio database; delivery information is used to arrange your
            shipment.
          </p>
          <h2>On this device</h2>
          <p>
            Your bag and saved pieces are kept in browser storage. To look up a receipt, you need its
            order reference and the email used at checkout.
          </p>
          <h2>The studio list</h2>
          <p>
            Subscribing saves your email address for studio updates. Contact us to leave the list or ask
            about your information.
          </p>
        </>
      ) : (
        <>
          <h2>Orders & payment</h2>
          <p>
            Prices are in Egyptian pounds. Stock, discounts, delivery and the amount due are checked at
            checkout. Payment is cash on delivery. Keep the order reference issued after your order is
            saved.
          </p>
          <h2>Delivery & returns</h2>
          <p>
            We deliver across Egypt. Unworn pieces with their original tags can be returned within 14
            days of delivery.{' '}
            <Link to="/about#service" className="text-action">
              Shipping & returns
            </Link>
          </p>
        </>
      )}
      <h2>Contact</h2>
      <p>
        {contactLine}{' '}
        {settings.contact_email?.trim() ? (
          <>
            <a href={`mailto:${settings.contact_email.trim()}`} className="text-action">
              {settings.contact_email.trim()}
            </a>
            .{' '}
          </>
        ) : null}
        <a
          href={socialUrl('instagram', settings.social_links)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-action"
        >
          Message the studio on Instagram
        </a>
        .
      </p>
    </article>
  );
}
