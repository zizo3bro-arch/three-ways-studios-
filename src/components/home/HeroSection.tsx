import { Link } from 'react-router-dom';

/* =========================================================
   HERO — uses the exact user-supplied reference artwork
   (/assets/hero-reference.jpeg) at its original aspect ratio,
   capped at ~520px height on desktop. The baked-in top navigation
   strip of the reference is neatly tucked behind the edge so
   the functional Navbar is never visually duplicated.
   ========================================================= */

interface HeroSectionProps {
  onScrollDown: () => void;
}

export function HeroSection({ onScrollDown }: HeroSectionProps) {
  return (
    <section
      id="top"
      aria-label="Three Ways Studios — 2026 Collection"
      className="w-full border-b border-black/10 bg-[#E6E2DC] pt-16 sm:pt-[72px]"
    >
      <h1 className="sr-only">Three Ways Studios — Fashion Beyond Limits</h1>

      <div className="relative mx-auto w-full max-w-[1012px] aspect-[828/425] max-h-[520px] overflow-hidden">
        <img
          src="/assets/hero-reference.jpeg"
          alt="Three Ways Studios — Fashion Beyond Limits — New Collection 2026"
          width={828}
          height={499}
          fetchPriority="high"
          decoding="async"
          className="pointer-events-none absolute bottom-0 left-0 block h-auto w-full select-none"
        />

        {/* Interactive hit targets matching the exact controls inside the reference image */}
        <button
          type="button"
          onClick={onScrollDown}
          aria-label="Scroll down to products"
          className="absolute bottom-[3%] left-[2%] h-[16%] w-[18%] cursor-pointer rounded-full bg-transparent focus-visible:outline-crimson"
        />
        <Link
          to="/shop"
          aria-label="Shop now"
          className="absolute bottom-[3.5%] right-[2.5%] h-[16%] w-[18.5%] cursor-pointer rounded-full bg-transparent focus-visible:outline-crimson"
        />
      </div>
    </section>
  );
}
