import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Search as SearchIcon, X } from 'lucide-react';
import { useUI } from '../../context/UIContext';
import { useCatalog } from '../../hooks/useCatalog';
import { JOURNAL_ENTRIES } from '../../data/journal';
import { primaryImage } from '../../data/catalog';
import { formatEGP } from '../../lib/format';
import type { Product } from '../../types/database';
import { Overlay } from '../ui/Overlay';

/* =========================================================
   SEARCH — real, local, instant. Indexes the live catalogue
   (Supabase rows or studio records), the journal and the house
   pages. Keyboard driven, with a remembered history.
   ========================================================= */

interface Doc {
  id: string;
  kind: 'piece' | 'journal' | 'page';
  title: string;
  meta: string;
  to: string;
  image?: string | null;
  haystack: string;
}

const PAGES: Doc[] = [
  { id: 'p-shop', kind: 'page', title: 'The shop', meta: '/shop', to: '/shop', haystack: 'shop buy pieces pants order all products catalogue' },
  { id: 'p-collections', kind: 'page', title: 'Collections', meta: '/collections', to: '/collections', haystack: 'collections drop 2026 archive flare series' },
  { id: 'p-about', kind: 'page', title: 'The house', meta: '/about', to: '/about', haystack: 'about three ways studios cairo atelier house story manifesto' },
  { id: 'p-journal', kind: 'page', title: 'Journal', meta: '/journal', to: '/journal', haystack: 'journal essays selvedge cut cairo notes writing' },
  { id: 'p-fit', kind: 'page', title: 'Sizes & fit', meta: '/about#fit', to: '/about#fit', haystack: 'size fit chart s m l xl measurements waist inseam finder' },
  { id: 'p-checkout', kind: 'page', title: 'Checkout · cash on delivery', meta: '/checkout', to: '/checkout', haystack: 'checkout cod cash on delivery payment order egypt shipping' },
];

function productDoc(product: Product): Doc {
  const image = primaryImage(product);
  return {
    id: `piece-${product.id}`,
    kind: 'piece',
    title: product.name,
    meta: `${product.collection_name || 'The drop'} · ${formatEGP(product.price)}`,
    to: `/product/${product.slug}`,
    image: image?.url ?? null,
    haystack: [
      product.name,
      product.slug,
      product.description,
      product.fabric_info,
      product.fit_info,
      product.category,
      product.collection_name,
      'wide flare super flare denim selvedge pants trousers new arrival best seller',
      product.is_new_arrival ? 'new arrival' : '',
      product.is_best_seller ? 'best seller' : '',
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
  };
}

function journalDoc(entry: (typeof JOURNAL_ENTRIES)[number]): Doc {
  return {
    id: `journal-${entry.slug}`,
    kind: 'journal',
    title: entry.title.replace(/\n/g, ' '),
    meta: entry.kicker,
    to: `/journal/${entry.slug}`,
    image: entry.image,
    haystack: [entry.title, entry.dek, entry.kicker, ...entry.body].join(' ').toLowerCase(),
  };
}

const HISTORY_KEY = 'tws_search_history_v1';

function score(doc: Doc, terms: string[]): number {
  if (terms.length === 0) return 0;
  let total = 0;
  for (const term of terms) {
    const inTitle = doc.title.toLowerCase().includes(term);
    const inBody = doc.haystack.includes(term);
    if (!inTitle && !inBody) return -1;
    total += inTitle ? 4 : 1;
    if (inBody) total += 1;
  }
  return total + (doc.kind === 'piece' ? 0.5 : 0);
}

export function SearchOverlay() {
  const { overlay, closeOverlay } = useUI();
  const { products } = useCatalog();
  const navigate = useNavigate();
  const open = overlay === 'search';

  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      setHistory(Array.isArray(parsed) ? parsed.slice(0, 5) : []);
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    if (open) return;
    setQuery('');
    setCursor(0);
  }, [open]);

  const { results, suggestions } = useMemo(() => {
    const docs = [...products.map(productDoc), ...JOURNAL_ENTRIES.map(journalDoc), ...PAGES];
    const terms = query.toLowerCase().split(/\s+/).filter((term) => term.length > 1);

    if (terms.length === 0) {
      return {
        results: [] as Doc[],
        suggestions: [docs.find((doc) => doc.kind === 'page')!, docs.find((doc) => doc.kind === 'piece')!].filter(Boolean),
      };
    }

    const scored = docs
      .map((doc) => ({ doc, value: score(doc, terms) }))
      .filter((entry) => entry.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    return {
      results: scored.map((entry) => entry.doc),
      suggestions: docs.filter((doc) => doc.kind === 'page').slice(0, 4),
    };
  }, [products, query]);

  useEffect(() => setCursor(0), [query]);

  const go = (doc: Doc | undefined) => {
    if (!doc) return;
    const trimmed = query.trim();
    if (trimmed.length > 1) {
      setHistory((prev) => {
        const next = [trimmed, ...prev.filter((entry) => entry !== trimmed)].slice(0, 5);
        try {
          localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        } catch {
          // storage unavailable — history just won't persist
        }
        return next;
      });
    }
    closeOverlay();
    navigate(doc.to);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((current) => (current + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((current) => (current - 1 + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      go(results[cursor]);
    }
  };

  const list = results.length > 0 ? results : [];

  return (
    <Overlay open={open} onClose={closeOverlay} label="Search" placement="full" hideClose>
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b border-ink/12 pb-3.5">
          <SearchIcon className="h-5 w-5 shrink-0 text-crimson-bright" strokeWidth={1.8} />
          <label htmlFor="tws-search-input" className="sr-only">
            Search pieces, journal and pages
          </label>
          <input
            id="tws-search-input"
            type="search"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pieces, fabric, journal…"
            className="w-full bg-transparent font-display text-[clamp(1.35rem,4.4vw,2.1rem)] uppercase leading-none tracking-[0.005em] text-ink outline-none placeholder:text-ink-faint/70 [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink/20 text-ink-soft transition-colors hover:border-ink hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={closeOverlay}
              aria-label="Close search"
              className="flex h-9 items-center gap-1.5 rounded-full border border-ink/20 px-3 text-[9px] font-bold uppercase tracking-[0.2em] text-ink-soft transition-colors hover:border-ink hover:text-ink"
            >
              ESC
            </button>
          )}
        </div>

        <p className="tws-eyebrow mt-3 text-ink-faint">
          {query.trim().length > 1
            ? `${list.length} ${list.length === 1 ? 'result' : 'results'}`
            : 'Start with'}
        </p>

        <div ref={listRef} className="mt-2 flex-1 overflow-y-auto pb-2">
          {list.length > 0 ? (
            <ul className="divide-y divide-ink/8">
              {list.map((doc, index) => (
                <li key={doc.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => go(doc)}
                    className={[
                      'group flex w-full items-center gap-4 px-1 py-3.5 text-left transition-colors duration-200',
                      index === cursor ? 'bg-ink/[0.04]' : 'hover:bg-ink/[0.025]',
                    ].join(' ')}
                  >
                    <span className="flex h-16 w-12 shrink-0 items-end justify-center overflow-hidden rounded-[3px] border border-ink/10 bg-paper">
                      {doc.image ? (
                        <img
                          src={doc.image}
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                          className="h-full w-full object-cover object-top"
                        />
                      ) : (
                        <span className="pb-1 text-[8px] font-bold uppercase tracking-[0.2em] text-ink-faint">
                          TWS
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[9px] font-bold uppercase tracking-[0.26em] text-crimson-bright">
                        {doc.kind === 'piece' ? 'Piece' : doc.kind === 'journal' ? 'Journal' : 'Page'}
                      </span>
                      <span className="mt-1 block truncate font-display text-[17px] uppercase leading-tight tracking-[0.01em] text-ink sm:text-[19px]">
                        {doc.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] tracking-wide text-ink-faint">{doc.meta}</span>
                    </span>
                    <ArrowUpRight
                      className={`h-4 w-4 shrink-0 transition-transform duration-300 ${
                        index === cursor ? 'translate-x-0.5 -translate-y-0.5 text-ink' : 'text-ink-faint'
                      }`}
                    />
                  </button>
                </li>
              ))}
            </ul>
          ) : query.trim().length > 1 ? (
            <div className="rounded-2xl border border-ink/12 bg-paper px-5 py-7 text-center">
              <p className="font-display text-2xl uppercase leading-tight text-ink">Nothing in the archive</p>
              <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-ink-soft">
                The house keeps two silhouettes in the shop. Try “flare”, “selvedge”, “size” or a journal title.
              </p>
            </div>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {suggestions.map((doc) => (
                <li key={doc.id}>
                  <button
                    type="button"
                    onClick={() => go(doc)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-ink/12 bg-paper px-4 py-3.5 text-left transition-colors duration-300 hover:border-ink/40"
                  >
                    <span>
                      <span className="block text-[9px] font-bold uppercase tracking-[0.26em] text-ink-faint">
                        {doc.kind}
                      </span>
                      <span className="mt-1 block font-display text-[15px] uppercase tracking-[0.01em] text-ink">
                        {doc.title}
                      </span>
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-ink-faint" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {history.length > 0 ? (
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-ink/10 pt-4">
              <span className="tws-eyebrow text-ink-faint">Recent</span>
              {history.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => setQuery(term)}
                  className="rounded-full border border-ink/18 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft transition-colors hover:border-ink hover:text-ink"
                >
                  {term}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setHistory([]);
                  try {
                    localStorage.removeItem(HISTORY_KEY);
                  } catch {
                    // ignore
                  }
                }}
                className="text-[9px] font-bold uppercase tracking-[0.2em] text-ink-faint underline-offset-4 transition-colors hover:text-crimson-bright hover:underline"
              >
                Clear
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </Overlay>
  );
}
