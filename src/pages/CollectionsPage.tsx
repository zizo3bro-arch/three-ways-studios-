import { useEffect, useState } from 'react';
import { ProductCard } from '../components/ProductCard';
import { fetchPublishedProducts } from '../lib/api';
import type { Product } from '../types/database';

export function CollectionsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Collections — THREE WAYS STUDIOS';
    fetchPublishedProducts().then(({ products: data }) => {
      setProducts(data);
      setLoading(false);
    });
  }, []);

  const collections = Array.from(
    new Set(products.map((p) => p.collection_name || '2026 Collection'))
  );

  return (
    <main className="mx-auto max-w-[1380px] px-5 pt-32 pb-24 sm:px-8 lg:px-12">
      <div className="border-b border-white/12 pb-8">
        <p className="text-[10px] tracking-[0.24em] text-[#d4121b] uppercase">
          THREE WAYS STUDIOS ARCHIVE
        </p>
        <h1 className="mt-2 text-3xl font-normal text-white">Collections</h1>
        <p className="mt-3 max-w-xl text-xs leading-relaxed text-[#a99e9e]">
          Every silhouette from THREE WAYS STUDIOS is engineered exclusively as women&apos;s pants —
          built around architectural drape, tailored structure, and contemporary Cairo streetwear.
        </p>
      </div>

      {loading ? (
        <div className="mt-10 grid grid-cols-2 gap-6 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="tws-card-surface aspect-[3/4] animate-pulse rounded-[6px]" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="mt-12 border border-white/12 bg-black/35 p-10 text-center">
          <p className="text-sm text-white">No collections published yet.</p>
          <p className="mt-2 text-xs text-[#9e9494]">
            Publish women&apos;s pants in the Admin Dashboard to populate collections dynamically.
          </p>
        </div>
      ) : (
        <div className="mt-12 space-y-16">
          {collections.map((col) => (
            <section key={col}>
              <div className="mb-6 flex items-center gap-4">
                <h2 className="text-lg font-normal text-white">{col}</h2>
                <span className="h-px flex-1 bg-white/12" />
              </div>
              <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
                {products
                  .filter((p) => (p.collection_name || '2026 Collection') === col)
                  .map((p, idx) => (
                    <ProductCard key={p.id} product={p} index={idx} />
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
