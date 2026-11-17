import { useCallback } from 'react';
import { HeroSection } from '../components/home/HeroSection';
import { PiecesSection } from '../components/home/PiecesSection';

/* =========================================================
   HOME — short, clean, focused:
   Header (AppShell) -> Exact Reference Hero -> Two Pants Products -> Minimal Footer (AppShell).
   ========================================================= */

export function HomePage() {
  const scrollToProducts = useCallback(() => {
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <div className="w-full bg-white">
      <HeroSection onScrollDown={scrollToProducts} />
      <PiecesSection />
    </div>
  );
}
