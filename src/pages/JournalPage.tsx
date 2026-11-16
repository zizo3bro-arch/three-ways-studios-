import { useEffect } from 'react';
import { Link } from 'react-router-dom';

const JOURNAL_ENTRIES = [
  {
    issue: 'ISSUE 01 · 2026',
    title: 'Architecture of the Silhouette',
    excerpt:
      'Why THREE WAYS STUDIOS dedicates 100% of its pattern studio to women’s pants — studying posture, drape, and movement across heavy twill and technical cotton.',
  },
  {
    issue: 'ISSUE 02 · 2026',
    title: 'Crimson in Shadow',
    excerpt:
      'Inside the visual direction of the 2026 collection: deep charcoal textures, atmospheric crimson lighting, and raw editorial restraint.',
  },
  {
    issue: 'ISSUE 03 · 2026',
    title: 'Precision Fit Without Guesswork',
    excerpt:
      'How each garment carries its own height-and-weight measurement matrix to power our Smart Size Finder.',
  },
];

export function JournalPage() {
  useEffect(() => {
    document.title = 'Journal — THREE WAYS STUDIOS';
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-5 pt-32 pb-24 sm:px-8">
      <div className="border-b border-white/12 pb-8">
        <p className="text-[10px] tracking-[0.24em] text-[#d4121b] uppercase">EDITORIAL NOTES</p>
        <h1 className="mt-2 text-3xl font-normal text-white">Journal</h1>
      </div>

      <div className="mt-10 divide-y divide-white/10">
        {JOURNAL_ENTRIES.map((entry) => (
          <article key={entry.issue} className="py-8">
            <span className="text-[10px] tracking-[0.22em] text-[#d4121b] uppercase">
              {entry.issue}
            </span>
            <h2 className="mt-2 text-xl font-normal text-white">{entry.title}</h2>
            <p className="mt-3 max-w-2xl text-xs leading-relaxed text-[#b8adad]">
              {entry.excerpt}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-8">
        <Link
          to="/#products"
          className="inline-block rounded-full border border-white/25 px-6 py-2.5 text-xs tracking-[0.2em] text-white uppercase hover:border-white"
        >
          Shop 2026 Collection
        </Link>
      </div>
    </main>
  );
}
