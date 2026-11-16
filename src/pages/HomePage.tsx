import { useCallback } from 'react';
import { HeroSection } from '../components/HeroSection';
import { ProductsSection } from '../components/ProductsSection';
import { InformationSection } from '../components/InformationSection';
import { scrollToSection } from '../lib/heroGate';

export function HomePage() {
  const handleShopNow = useCallback(() => {
    scrollToSection('products');
  }, []);

  return (
    <main className="relative w-full overflow-x-clip">
      <HeroSection onShopNow={handleShopNow} />

      {/* 1-line Editorial Transition Strip directly below the hero */}
      <div
        id="collection-strip"
        aria-label="Editorial collection marker"
        className="relative mx-auto max-w-[1640px] px-5 pt-4 pb-2 sm:px-8 lg:px-12"
      >
        <div className="flex items-center justify-between gap-4 border-y border-ink/14 py-3.5 text-[9px] font-bold uppercase tracking-[0.34em] text-ink-soft sm:text-[10px]">
          <span aria-hidden="true" className="hidden h-1.5 w-1.5 rounded-full bg-crimson-bright sm:inline-block" />
          <p className="mx-auto text-center">
            COLLECTION 01 — HAND-CUT IN CAIRO
          </p>
          <span aria-hidden="true" className="hidden h-1.5 w-1.5 rounded-full bg-crimson-bright sm:inline-block" />
        </div>
      </div>

      <ProductsSection />
      <InformationSection />
    </main>
  );
}
