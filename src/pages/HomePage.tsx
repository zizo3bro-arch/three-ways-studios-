import { useCallback } from 'react';
import { HeroSection } from '../components/home/HeroSection';
import { PiecesSection } from '../components/home/PiecesSection';
import { BrandChapter } from '../components/home/BrandChapter';
import { FeaturedCollection } from '../components/home/FeaturedCollection';
import { JournalTeaser } from '../components/home/JournalTeaser';
import { StudioListSection } from '../components/home/StudioListSection';

/* =========================================================
   HOME — one continuous editorial sequence on the paper:
   hero (campaign frame) → the pieces → the house → the
   collection → the journal → the studio list.
   No section paints its own background; they all sit on the
   same ivory grain so the page reads as one printed spread.
   ========================================================= */

export function HomePage() {
  const scrollToProducts = useCallback(() => {
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <>
      <HeroSection onScrollDown={scrollToProducts} />
      <PiecesSection />
      <BrandChapter />
      <FeaturedCollection />
      <JournalTeaser />
      <StudioListSection />
    </>
  );
}
