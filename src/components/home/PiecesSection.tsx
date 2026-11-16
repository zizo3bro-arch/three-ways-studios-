import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useCatalog } from '../../hooks/useCatalog';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { ProductPlate } from '../shop/ProductPlate';
import { Reveal } from '../ui/Reveal';

/* =========================================================
   CHAPTER 03 — THE PIECES
   Real studio photography, real prices, real stock. The shop grid
   arrives only after the two editorial chapters, exactly as the
   campaign sequence demands.
   ========================================================= */

export function PiecesSection() {
  const { products, loading } = useCatalog();
  const { settings } = useSiteSettings();
  const heading = (settings.products_heading || 'Two patterns').split(' ').slice(0, 2).join(' ');
  const headingTail = (settings.products_heading || 'Two patterns').split(' ').slice(2).join(' ');
  const subheading = settings.products_subheading || 'one obsession';
  const pieces = products.slice(0, 2);

  return (
    <section
      id="pieces"
      aria-labelledby="pieces-title"
      className="relative bg-ivory py-20 sm:py-24 lg:py-28"
    >
      <div className="mx-auto w-full max-w-[1660px] px-4 sm:px-6 lg:px-10">
        <div className="flex flex-col gap-6 border-b border-ink/12 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <Reveal preset="soft">
            <p className="tws-eyebrow text-crimson-bright">Chapter 03 — The Pieces</p>
            <h2
              id="pieces-title"
              className="mt-4 font-display uppercase leading-[0.88] tracking-[0.002em] text-ink text-[clamp(2.35rem,7.4vw,5.6rem)]"
            >
              {heading}
              {headingTail ? <span className="block">{headingTail}</span> : null}
              <span className="block">{subheading}</span>
            </h2>
          </Reveal>

          <Reveal preset="soft" delay={0.12} className="flex shrink-0 flex-col items-start gap-4 sm:items-end">
            <p className="max-w-xs text-[13px] leading-relaxed text-ink-soft sm:text-right">
              Sizes S — XL, cut long in the leg. Every piece is held until you choose a size.
            </p>
            <Link to="/shop" className="tws-pill tws-pill--outline h-12">
              All pieces
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
          </Reveal>
        </div>

        {pieces.length === 0 ? (
          <p className="mt-16 text-center text-[12px] font-bold uppercase tracking-[0.28em] text-ink-faint">
            {loading ? 'Loading the drop…' : 'The shop is between drops.'}
          </p>
        ) : (
          <div className="mt-9 grid gap-5 sm:mt-12 md:grid-cols-2 md:gap-6 lg:gap-8">
            {pieces.map((product, index) => (
              <ProductPlate key={product.id} product={product} index={index} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
