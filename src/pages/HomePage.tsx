import { useCallback, useEffect, useRef, useState } from 'react';
import { HeroSection } from '../components/HeroSection';
import { ProductsSection } from '../components/ProductsSection';
import { InformationSection } from '../components/InformationSection';
import {
  HERO_UNLOCK_EVENT,
  scrollToSection,
  type HeroUnlockDetail,
} from '../lib/heroGate';
import { useBodyScrollLock } from '../lib/scrollLock';

export function HomePage() {
  // The hero holds the first screen until the visitor chooses to shop.
  const [revealed, setRevealed] = useState(false);
  const revealedRef = useRef(false);

  const reveal = useCallback((targetId?: string | null) => {
    const destination = targetId || 'products';

    if (revealedRef.current) {
      scrollToSection(destination);
      return;
    }

    revealedRef.current = true;
    setRevealed(true);
    // Wait for the unlock to paint before handing scroll back to the browser.
    window.setTimeout(() => scrollToSection(destination), 140);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<HeroUnlockDetail>).detail;
      reveal(detail?.targetId);
    };
    window.addEventListener(HERO_UNLOCK_EVENT, handler);
    return () => window.removeEventListener(HERO_UNLOCK_EVENT, handler);
  }, [reveal]);

  useBodyScrollLock(!revealed);

  useEffect(() => {
    if (!revealed) window.scrollTo(0, 0);
  }, [revealed]);

  return (
    <main
      className={[
        'relative w-full overflow-x-clip',
        revealed ? '' : 'tws-hero-locked',
      ].join(' ')}
    >
      <HeroSection onShopNow={() => reveal('products')} />

      <div
        inert={!revealed}
        aria-hidden={!revealed}
        className={[
          'transition-opacity duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
          revealed ? 'opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
      >
        <ProductsSection />
        <InformationSection />
      </div>
    </main>
  );
}
