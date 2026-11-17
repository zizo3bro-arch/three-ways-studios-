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
  // The hero opens the page; the scroll cue drops the visitor to the next
  // editorial beat (the house chapter) rather than skipping straight to the rail.
  const scrollToNext = useCallback(() => {
    document.getElementById('brand')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <>
      <HeroSection onScrollDown={scrollToNext} />
      <BrandChapter />
      <FeaturedCollection />
      <PiecesSection />
      <JournalTeaser />
      <StudioListSection />
    </>
  );
}
