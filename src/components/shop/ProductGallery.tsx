import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { GalleryFrame } from '../../data/catalog';

/** Native scrolling owns gesture direction, inertia and pinch zoom. No touchmove
 * cancellation, swipe threshold or click-to-advance handler on any photograph. */
export function ProductGallery({
  frames,
  name,
  chosenImage,
}: {
  frames: GalleryFrame[];
  name: string;
  chosenImage?: string;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  function go(i: number) {
    const el = rail.current;
    if (el)
      el.scrollTo({
        left: i * el.clientWidth,
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      });
  }
  useEffect(() => {
    if (!chosenImage) return;
    const idx = frames.findIndex((f) => f.url === chosenImage);
    if (idx >= 0 && rail.current) rail.current.scrollLeft = rail.current.clientWidth * idx;
  }, [chosenImage, frames]);
  return (
    <section
      className="piece-gallery"
      aria-label={`${name} photographs`}
      aria-roledescription="carousel"
    >
      <div className="gallery-menu">
        <Link to="/shop" className="back-link">
          <ArrowLeft />
          Back to shop
        </Link>
        {frames.length > 0 && (
          <div className="gallery-pager">
            {frames.length > 1 && (
              <button
                className="icon-action gallery-prev"
                aria-label="Previous product image"
                disabled={active === 0}
                onClick={() => go(active - 1)}
              >
                <ArrowLeft />
              </button>
            )}
            <span aria-live="polite" aria-atomic="true">
              {active + 1} / {frames.length}
            </span>
            {frames.length > 1 && (
              <button
                className="icon-action"
                aria-label="Next product image"
                disabled={active >= frames.length - 1}
                onClick={() => go(active + 1)}
              >
                <ArrowRight />
              </button>
            )}
          </div>
        )}
      </div>
      {frames.length ? (
        <div
          ref={rail}
          className="gallery-rail"
          tabIndex={frames.length > 1 ? 0 : -1}
          aria-label="Product images"
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.clientWidth)
              setActive(
                Math.max(0, Math.min(frames.length - 1, Math.round(el.scrollLeft / el.clientWidth)))
              );
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              e.preventDefault();
              go(Math.max(0, Math.min(frames.length - 1, active + (e.key === 'ArrowRight' ? 1 : -1))));
            }
          }}
        >
          {frames.map((f, i) => (
            <figure className="gallery-frame" key={f.url} aria-label={`${i + 1} of ${frames.length}`}>
              <img
                src={f.url}
                alt={f.alt}
                draggable={false}
                fetchPriority={i === 0 ? 'high' : 'auto'}
                loading={i < 2 ? 'eager' : 'lazy'}
                decoding="async"
              />
            </figure>
          ))}
        </div>
      ) : (
        <p className="gallery-empty">Photography is not available for this piece.</p>
      )}
      {frames.length > 1 && (
        <div className="gallery-thumbs" role="group" aria-label="Select product image">
          {frames.map((f, i) => (
            <button
              key={f.url}
              aria-label={`View image ${i + 1}: ${f.alt}`}
              aria-pressed={i === active}
              onClick={() => go(i)}
            >
              <img src={f.url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
