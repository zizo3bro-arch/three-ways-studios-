import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { HeroSection } from '../components/HeroSection';
import { ProductCard } from '../components/ProductCard';
import { DEMO_PRODUCTS } from '../data/demoProducts';
import { fetchPublishedProducts } from '../lib/api';
import type { Product } from '../types/database';

const FEATURED_COLLECTIONS = [
  {
    title: "Women's Collection",
    subtitle: 'Super-flare & architectural denim',
    image: '/images/collection-women.jpg',
    to: '/collections?category=Women',
  },
  {
    title: "Men's Collection",
    subtitle: 'Technical cargo & raw selvedge',
    image: '/images/collection-men.jpg',
    to: '/collections?category=Men',
  },
  {
    title: 'New Arrivals',
    subtitle: 'Latest 2026 studio drops',
    image: '/images/prod-obsidian-flare.jpg',
    to: '/collections?filter=new',
  },
  {
    title: 'Best Sellers',
    subtitle: 'Signature silhouettes',
    image: '/images/prod-atelier-trouser.jpg',
    to: '/collections?filter=best',
  },
];

export function HomePage() {
  const [products, setProducts] = useState<Product[]>(DEMO_PRODUCTS);

  useEffect(() => {
    let active = true;
    fetchPublishedProducts().then(({ products: loaded }) => {
      if (active && loaded.length > 0) {
        setProducts(loaded);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const featuredProducts = products.slice(0, 6);

  return (
    <main className="w-full overflow-x-hidden">
      {/* 1. Hero Section */}
      <HeroSection />

      {/* 2. Featured Collections */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.26em] text-[#d4121b] uppercase">
              Curated Divisions
            </p>
            <h2 className="font-display-tall mt-1 text-3xl tracking-wide text-white uppercase sm:text-4xl">
              Featured Collections
            </h2>
          </div>
          <Link
            to="/collections"
            className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-[#c7bcbc] uppercase transition hover:text-white"
          >
            View All Pieces
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURED_COLLECTIONS.map((col) => (
            <Link
              key={col.title}
              to={col.to}
              className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-white/10 bg-[#0d0809]"
            >
              <img
                src={col.image}
                alt={col.title}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover object-center transition duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#060405] via-[#060405]/30 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5">
                <p className="text-[10px] font-semibold tracking-[0.22em] text-[#d4121b] uppercase">
                  {col.subtitle}
                </p>
                <h3 className="font-display-tall mt-1 text-2xl tracking-wide text-white uppercase">
                  {col.title}
                </h3>
                <span className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.2em] text-[#f2eded] uppercase transition group-hover:text-[#d4121b]">
                  Shop Collection
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 3. Featured Products */}
      <section className="border-t border-white/10 bg-[#090607]/60">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.26em] text-[#d4121b] uppercase">
                2026 Studio Release
              </p>
              <h2 className="font-display-tall mt-1 text-3xl tracking-wide text-white uppercase sm:text-4xl">
                Featured Silhouettes
              </h2>
            </div>
            <Link
              to="/collections"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-xs font-semibold tracking-[0.2em] text-white uppercase transition hover:border-[#b30e16] hover:bg-[#b30e16]"
            >
              Shop All
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* 4. Brand Campaign Section */}
      <section className="border-t border-white/10 bg-[#060405]">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:px-8">
          <div className="lg:col-span-6">
            <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-white/10 bg-[#0d0809]">
              <img
                src="/images/brand-campaign.jpg"
                alt="THREE WAYS STUDIOS Editorial Brand Campaign"
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover object-center"
              />
            </div>
          </div>

          <div className="lg:col-span-6">
            <p className="text-[11px] font-semibold tracking-[0.26em] text-[#d4121b] uppercase">
              The House Philosophy
            </p>
            <h2 className="font-display-tall mt-2 text-4xl tracking-wide text-white uppercase sm:text-5xl">
              THREE WAYS.
              <span className="block text-[#d4121b]">ZERO COMPROMISE.</span>
            </h2>
            <p className="mt-5 text-sm leading-relaxed text-[#b8adad] sm:text-base">
              Born in the underground, THREE WAYS STUDIOS rejects disposable fast fashion. Every
              pair of trousers is pattern-engineered for dramatic movement, razor-sharp proportion,
              and enduring heavyweight construction.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                to="/collections"
                className="inline-flex items-center gap-2 rounded-full bg-[#b30e16] px-7 py-3.5 text-xs font-bold tracking-[0.22em] text-white uppercase transition hover:bg-[#d4121b]"
              >
                SHOP NOW
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/about"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-7 py-3.5 text-xs font-semibold tracking-[0.22em] text-[#f2eded] uppercase transition hover:border-white/40"
              >
                Our Story
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
