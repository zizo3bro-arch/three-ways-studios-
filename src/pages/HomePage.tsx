import { useEffect } from 'react';
import { HeroSection } from '../components/HeroSection';
import { ProductsSection } from '../components/ProductsSection';

export function HomePage() {
  useEffect(() => {
    document.title = 'THREE WAYS STUDIOS — Women’s Editorial Streetwear Pants';
  }, []);

  return (
    <main>
      <HeroSection />
      <ProductsSection />
    </main>
  );
}
