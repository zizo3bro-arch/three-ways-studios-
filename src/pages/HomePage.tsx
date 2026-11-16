import { useCallback } from 'react';
import { HeroSection } from '../components/home/HeroSection';
import { BrandChapter } from '../components/home/BrandChapter';
import { FeaturedCollection } from '../components/home/FeaturedCollection';
import { PiecesSection } from '../components/home/PiecesSection';
import { JournalTeaser } from '../components/home/JournalTeaser';
import { StudioListSection } from '../components/home/StudioListSection';

/* =========================================================
   HOME — a sequence, not a template:
   campaign frame → cinematic brand chapter (red smoke) → the
   collection → the pieces → the journal → the list.
   ========================================================= */

export function HomePage() {
  const scrollToBrand = useCallback(() => {
    document.getElementById('brand')?.scrollIntoView({ block: 'start' });
  }, []);

  return (
    <div className="relative w-full overflow-x-clip">
      <HeroSection onScrollDown={scrollToBrand} />
      <BrandChapter />
      <FeaturedCollection />
      <PiecesSection />
      <JournalTeaser />
      <StudioListSection />
    </div>
  );
}
