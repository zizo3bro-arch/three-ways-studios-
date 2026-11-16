import { HeroSection } from '../components/HeroSection';
import { ProductsSection } from '../components/ProductsSection';
import { InformationSection } from '../components/InformationSection';

export function HomePage() {
  return (
    <main className="w-full overflow-x-clip">
      <HeroSection />
      <ProductsSection />
      <InformationSection />
    </main>
  );
}
