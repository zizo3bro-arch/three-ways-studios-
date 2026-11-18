import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Search } from 'lucide-react';
import { useUI } from '../../context/UIContext';
import { useCatalog } from '../../hooks/useCatalog';
import { primaryImage } from '../../data/catalog';
import { formatEGP } from '../../lib/format';
import { Overlay } from '../ui/Overlay';

export function SearchOverlay() {
  const { overlay, closeOverlay } = useUI();
  const { products, loading, error, retry } = useCatalog();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const navigate = useNavigate();
  const open = overlay === 'search';
  useEffect(() => {
    if (!open) {
      setQuery('');
      setCursor(0);
    }
  }, [open]);
  const results = useMemo(() => {
    const words = query.toLowerCase().trim().split(/\s+/);
    return products.filter((p) => {
      const text = [
        p.name,
        p.slug,
        p.category,
        p.collection_name,
        p.description,
        p.fabric_info,
        ...(p.variants ?? []).map((v) => v.color_name),
      ]
        .join(' ')
        .toLowerCase();
      return words.every((word) => text.includes(word));
    });
  }, [products, query]);
  return (
    <Overlay open={open} onClose={closeOverlay} label="Search products" placement="top">
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-col pb-3">
        <div className="flex items-center gap-3">
          <Search size={18} className="text-crimson" />
          <label htmlFor="studio-search" className="sr-only">
            Search products by name
          </label>
          <input
            id="studio-search"
            data-initial-focus
            className="tws-field"
            placeholder="Search the collection…"
            autoComplete="off"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={(e) => {
              if (!results.length) return;
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                setCursor((cursor + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length);
              }
              if (e.key === 'Enter' && results[cursor]) {
                closeOverlay();
                navigate(`/product/${results[cursor].slug}`);
              }
            }}
          />
          {query && (
            <button
              className="text-action"
              onClick={() => {
                setQuery('');
                setCursor(0);
              }}
            >
              Clear
            </button>
          )}
        </div>
        <div className="my-3 flex items-center justify-between gap-3 text-xs">
          <p aria-live="polite">{loading ? 'Loading pieces…' : `${results.length} pieces`}</p>
          <Link to="/shop" className="text-action" onClick={closeOverlay}>
            View all
          </Link>
        </div>
        {error ? (
          <p role="alert" className="form-note">
            {error}{' '}
            <button onClick={retry} className="text-action">
              Retry
            </button>
          </p>
        ) : (
          <ul className="grid max-h-[56svh] gap-x-6 overflow-y-auto sm:grid-cols-2">
            {results.map((p, i) => {
              const img = primaryImage(p);
              return (
                <li key={p.id}>
                  <Link
                    to={`/product/${p.slug}`}
                    onClick={closeOverlay}
                    onMouseEnter={() => setCursor(i)}
                    className={`flex items-center gap-4 border-b py-3 text-sm ${cursor === i ? 'border-crimson' : 'border-ink/20'}`}
                  >
                    {img && (
                      <img
                        alt=""
                        src={img.url}
                        loading="lazy"
                        className="h-16 w-14 object-contain mix-blend-multiply"
                      />
                    )}
                    <span className="flex-1">
                      {p.name}
                      <small className="block">{formatEGP(p.price)}</small>
                    </span>
                    <ArrowRight size={16} className="text-crimson" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {!error && !loading && !results.length && (
          <p className="form-note">No pieces match this search.</p>
        )}
      </div>
    </Overlay>
  );
}
