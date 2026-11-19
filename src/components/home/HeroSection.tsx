import { ArrowDown, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { isExternal, safeDestination } from '../../lib/links';

/** The pigment is live type, not a photograph of a page. Two scales of noise
 * break the edge of the ink; the fine grain is confined to the overspray. */
function PaintedType({ text }: { text: string }) {
  return (
    <svg className="campaign-paint" viewBox="0 0 1000 405" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <filter
          id="studio-aerosol"
          filterUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="1000"
          height="405"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency=".16 .19"
            numOctaves="3"
            seed="11"
            result="rag"
          />
          <feGaussianBlur in="SourceAlpha" stdDeviation="7.2" result="edge" />
          <feDisplacementMap
            in="edge"
            in2="rag"
            scale="17"
            xChannelSelector="R"
            yChannelSelector="G"
            result="ink"
          />
          <feGaussianBlur in="SourceAlpha" stdDeviation="16" result="mist" />
          <feTurbulence type="fractalNoise" baseFrequency=".63" numOctaves="2" seed="5" result="dust" />
          <feColorMatrix
            in="dust"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  3.6 0 0 0 -1.28"
            result="grit"
          />
          <feComposite in="mist" in2="grit" operator="arithmetic" k1=".96" k2=".42" result="spray" />
          <feComposite in="ink" in2="spray" operator="over" result="mark" />
          <feTurbulence type="fractalNoise" baseFrequency=".009 .016" numOctaves="4" seed="24" />
          <feColorMatrix
            type="matrix"
            values=".46 0 0 0 .30  .08 0 0 0 .014  .09 0 0 0 .022  0 0 0 0 .98"
          />
          <feComposite in2="mark" operator="in" />
        </filter>
      </defs>
      <g filter="url(#studio-aerosol)">
        <text
          x="40"
          y="371"
          textLength="928"
          lengthAdjust="spacingAndGlyphs"
          fontSize="368"
          fontFamily="Anton, Impact, sans-serif"
          letterSpacing="12"
          wordSpacing="-16"
        >
          {text}
        </text>
      </g>
    </svg>
  );
}

export function HeroSection() {
  const { settings } = useSiteSettings();
  const signature = settings.hero_script_text.trim();
  const ctaHref = safeDestination(settings.hero_cta_href, '/shop');
  const ctaLabel = settings.hero_cta_label || 'Shop now';
  const heroImage = (settings.hero_image_url || '').trim();
  return (
    <section id="top" className="campaign" aria-labelledby="campaign-title">
      <h1 id="campaign-title" className="sr-only">
        Three Ways Studios — {settings.hero_tagline}
      </h1>
      <div className="campaign-art">
        {heroImage ? (
          <img
            className="campaign-hero-image"
            src={heroImage}
            alt=""
            aria-hidden="true"
            loading="eager"
            decoding="async"
          />
        ) : null}
        <PaintedType text={settings.hero_bg_text || 'THREE WAYS'} />
        {/^three\s*ways\s*studios[®™.\s]*$/i.test(signature) || !signature ? (
          <img
            className="campaign-signature"
            src="/media/signature.svg"
            alt=""
            width="1593"
            height="465"
            fetchPriority="high"
          />
        ) : (
          <span className="campaign-signature campaign-script">{signature}</span>
        )}
      </div>
      <div className="page-width campaign-notes">
        <div>
          <p className="campaign-caption">
            {(settings.hero_tagline || 'Fashion beyond limits.')
              .trim()
              .split(/\s+/)
              .map((word, i) => (
                <span key={i}>{word}</span>
              ))}
          </p>
          <a className="scroll-cue" href="#products">
            <span>
              <ArrowDown />
            </span>
            Scroll down
          </a>
        </div>
        <div className="campaign-release">
          <p className="campaign-caption">
            {(settings.hero_collection_label || 'New collection / 2026')
              .trim()
              .split(/\s+(?!\d)/)
              .map((word, i) => (
                <span key={i}>{word}</span>
              ))}
          </p>
          {isExternal(ctaHref) ? (
            <a
              className="tws-pill compact-pill"
              href={ctaHref}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="hero-cta"
            >
              {ctaLabel} <ArrowRight />
            </a>
          ) : (
            <Link className="tws-pill compact-pill" to={ctaHref} data-testid="hero-cta">
              {ctaLabel} <ArrowRight />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
