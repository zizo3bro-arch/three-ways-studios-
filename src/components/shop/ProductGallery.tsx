import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Expand } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { GalleryFrame } from '../../data/catalog';
import { ProductLightbox } from './ProductLightbox';

/** Native horizontal scroll-snap owns gallery swipe inertia and preserves
 * vertical page scrolling. A deliberate tap or click on any photograph opens
 * the full-screen zoom viewer at that exact frame. */
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
  const [viewerOpen, setViewerOpen] = useState(false);

  const gestureRef = useRef<{
    x: number;
    y: number;
    scrollLeft: number;
    scrollY: number;
    time: number;
    moved: boolean;
    multiTouch: boolean;
  } | null>(null);
  const lastTouchOpenRef = useRef(-1000);

  const go = useCallback((i: number, behavior?: ScrollBehavior) => {
    const el = rail.current;
    if (!el) return;
    const mode =
      behavior ?? (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth');
    el.scrollTo({ left: i * el.clientWidth, behavior: mode });
  }, []);

  useEffect(() => {
    if (!chosenImage) return;
    const idx = frames.findIndex((f) => f.url === chosenImage);
    if (idx >= 0 && rail.current) {
      rail.current.scrollLeft = rail.current.clientWidth * idx;
      setActive(idx);
    }
  }, [chosenImage, frames]);

  const handleViewerIndex = useCallback(
    (nextIndex: number) => {
      setActive(nextIndex);
      go(nextIndex, 'instant');
    },
    [go]
  );

  const openFrame = (frameIndex: number) => {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    const scrolledX =
      gesture && rail.current ? Math.abs(rail.current.scrollLeft - gesture.scrollLeft) > 6 : false;
    const scrolledY = gesture ? Math.abs(window.scrollY - gesture.scrollY) > 6 : false;
    if (gesture?.moved || gesture?.multiTouch || scrolledX || scrolledY) return;
    setActive(frameIndex);
    setViewerOpen(true);
  };

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
                type="button"
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
                type="button"
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
        <div className="gallery-stage">
          <div
            ref={rail}
            className="gallery-rail"
            tabIndex={frames.length > 1 ? 0 : -1}
            aria-label="Product images"
            onTouchStart={(e) => {
              if (e.touches.length > 1 && gestureRef.current) {
                gestureRef.current.multiTouch = true;
              }
            }}
            onScroll={(e) => {
              const el = e.currentTarget;
              if (el.clientWidth) {
                setActive(
                  Math.max(0, Math.min(frames.length - 1, Math.round(el.scrollLeft / el.clientWidth)))
                );
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                go(Math.max(0, Math.min(frames.length - 1, active + (e.key === 'ArrowRight' ? 1 : -1))));
              } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setViewerOpen(true);
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
                  className="gallery-photo-tap"
                  onPointerDown={(e) => {
                    gestureRef.current = {
                      x: e.clientX,
                      y: e.clientY,
                      scrollLeft: rail.current?.scrollLeft ?? 0,
                      scrollY: window.scrollY,
                      time: performance.now(),
                      moved: false,
                      multiTouch: false,
                    };
                  }}
                  onPointerMove={(e) => {
                    const gesture = gestureRef.current;
                    if (!gesture) return;
                    if (Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) > 10) {
                      gesture.moved = true;
                    }
                  }}
                  onTouchEnd={(e) => {
                    const gesture = gestureRef.current;
                    if (!gesture || e.touches.length > 0) return;
                    const t = e.changedTouches[0];
                    if (t && Math.hypot(t.clientX - gesture.x, t.clientY - gesture.y) > 12) {
                      gesture.moved = true;
                    }
                    if (!gesture.moved && !gesture.multiTouch && performance.now() - gesture.time < 450) {
                      lastTouchOpenRef.current = performance.now();
                      openFrame(i);
                    }
                  }}
                  onClick={() => {
                    if (performance.now() - lastTouchOpenRef.current < 450) return;
                    openFrame(i);
                  }}
                />
              </figure>
            ))}
          </div>

          <button
            type="button"
            className="gallery-expand-btn"
            aria-label={`Inspect ${name} full screen`}
            onClick={() => setViewerOpen(true)}
          >
            <Expand aria-hidden="true" />
            <span>Zoom</span>
          </button>
        </div>
      ) : (
        <p className="gallery-empty">Photography is not available for this piece.</p>
      )}

      {frames.length > 1 && (
        <div className="gallery-thumbs" role="group" aria-label="Select product image">
          {frames.map((f, i) => (
            <button
              type="button"
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

      <ProductLightbox
        open={viewerOpen}
        frames={frames}
        index={active}
        name={name}
        onIndexChange={handleViewerIndex}
        onClose={() => setViewerOpen(false)}
      />
    </section>
  );
}
