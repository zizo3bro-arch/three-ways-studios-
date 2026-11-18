import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import type { GalleryFrame } from '../../data/catalog';
import { useBodyScrollLock, useEscapeKey } from '../../lib/scrollLock';

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2.5;
const ZOOM_STEP = 0.65;
const FOCUSABLE = 'button:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface TransformState {
  scale: number;
  x: number;
  y: number;
}

const IDENTITY: TransformState = { scale: 1, x: 0, y: 0 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function touchDistance(a: React.Touch, b: React.Touch): number {
  return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
}

function touchMidpoint(a: React.Touch, b: React.Touch): { x: number; y: number } {
  return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
}

export interface ProductLightboxProps {
  open: boolean;
  frames: GalleryFrame[];
  index: number;
  name: string;
  onIndexChange: (nextIndex: number) => void;
  onClose: () => void;
}

export function ProductLightbox({
  open,
  frames,
  index,
  name,
  onIndexChange,
  onClose,
}: ProductLightboxProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const [transform, setTransform] = useState<TransformState>(IDENTITY);
  const [interacting, setInteracting] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [stageSize, setStageSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const transformRef = useRef<TransformState>(IDENTITY);
  transformRef.current = transform;

  const indexRef = useRef(index);
  indexRef.current = index;

  // Gesture state refs (never trigger re-renders unless visible coordinates change)
  const pinchRef = useRef<{
    startDist: number;
    startMid: { x: number; y: number };
    startTransform: TransformState;
  } | null>(null);

  const touchPanRef = useRef<{
    startX: number;
    startY: number;
    startTime: number;
    originX: number;
    originY: number;
    moved: boolean;
    hadMultiTouch: boolean;
    mode: 'pan' | 'swipe';
  } | null>(null);

  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const lastTouchZoomAtRef = useRef(0);
  const suppressBackdropClickRef = useRef(false);

  const safeIndex = frames.length ? clamp(index, 0, frames.length - 1) : 0;
  const currentFrame = frames[safeIndex];

  useBodyScrollLock(open);
  useEscapeKey(open, onClose);

  // Compute exact unscaled fitted dimensions that fill maximum viewport area
  // while strictly preserving naturalWidth : naturalHeight aspect ratio.
  const fittedSize = (() => {
    if (!naturalSize || !naturalSize.w || !naturalSize.h || !stageSize.w || !stageSize.h) {
      return null;
    }
    const maxW = stageSize.w * 0.95;
    const maxH = stageSize.h * 0.94;
    const ratio = Math.min(maxW / naturalSize.w, maxH / naturalSize.h);
    return {
      width: Math.max(1, Math.round(naturalSize.w * ratio)),
      height: Math.max(1, Math.round(naturalSize.h * ratio)),
    };
  })();

  const clampPan = useCallback((scale: number, x: number, y: number): TransformState => {
    const cleanScale = clamp(scale, MIN_ZOOM, MAX_ZOOM);
    if (cleanScale <= 1.005) return IDENTITY;

    const stage = stageRef.current;
    const img = imageRef.current;
    if (!stage || !img) {
      return { scale: cleanScale, x, y };
    }

    const stageW = stage.clientWidth || 1;
    const stageH = stage.clientHeight || 1;
    const baseW = img.offsetWidth || stageW * 0.85;
    const baseH = img.offsetHeight || stageH * 0.85;
    const scaledW = baseW * cleanScale;
    const scaledH = baseH * cleanScale;

    const overflowX = (scaledW - stageW) / 2;
    const overflowY = (scaledH - stageH) / 2;
    const maxX = overflowX > 0 ? overflowX : Math.min((scaledW - baseW) / 2, stageW * 0.32);
    const maxY = overflowY > 0 ? overflowY : Math.min((scaledH - baseH) / 2, stageH * 0.32);

    return {
      scale: cleanScale,
      x: clamp(x, -maxX, maxX),
      y: clamp(y, -maxY, maxY),
    };
  }, []);

  const zoomAroundPoint = useCallback(
    (nextScale: number, clientX: number, clientY: number, from?: TransformState) => {
      const origin = from ?? transformRef.current;
      const targetScale = clamp(nextScale, MIN_ZOOM, MAX_ZOOM);
      if (targetScale <= 1.01) {
        setTransform(IDENTITY);
        return;
      }
      const stage = stageRef.current;
      if (!stage) {
        setTransform({ scale: targetScale, x: 0, y: 0 });
        return;
      }
      const rect = stage.getBoundingClientRect();
      const ox = clientX - (rect.left + rect.width / 2);
      const oy = clientY - (rect.top + rect.height / 2);
      const factor = targetScale / origin.scale;
      const nextX = ox - (ox - origin.x) * factor;
      const nextY = oy - (oy - origin.y) * factor;
      setTransform(clampPan(targetScale, nextX, nextY));
    },
    [clampPan]
  );

  const zoomAroundCenter = useCallback(
    (nextScale: number) => {
      const stage = stageRef.current;
      if (!stage) {
        setTransform(nextScale <= 1.01 ? IDENTITY : { scale: clamp(nextScale, MIN_ZOOM, MAX_ZOOM), x: 0, y: 0 });
        return;
      }
      const rect = stage.getBoundingClientRect();
      setInteracting(false);
      zoomAroundPoint(nextScale, rect.left + rect.width / 2, rect.top + rect.height / 2);
    },
    [zoomAroundPoint]
  );

  const resetZoom = useCallback(() => {
    setInteracting(false);
    setSwipeOffset(0);
    setTransform(IDENTITY);
  }, []);

  const goTo = useCallback(
    (target: number) => {
      if (!frames.length) return;
      const next = clamp(target, 0, frames.length - 1);
      if (next === indexRef.current) {
        setSwipeOffset(0);
        return;
      }
      setInteracting(false);
      setSwipeOffset(0);
      setTransform(IDENTITY);
      setNaturalSize(null);
      lastTapRef.current = null;
      onIndexChange(next);
    },
    [frames.length, onIndexChange]
  );

  // Reset transform when opened or when frame URL changes externally
  useEffect(() => {
    setTransform(IDENTITY);
    setSwipeOffset(0);
    setInteracting(false);
    pinchRef.current = null;
    touchPanRef.current = null;
    lastTapRef.current = null;
  }, [open, currentFrame?.url]);

  // Read cached image natural size immediately if already complete
  useEffect(() => {
    if (!open) return;
    const img = imageRef.current;
    if (img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    }
  }, [open, currentFrame?.url]);

  // Track stage dimensions across viewport resizes and mobile orientation changes
  useEffect(() => {
    if (!open) return;
    const stage = stageRef.current;
    if (!stage) return;

    const measure = () => {
      setStageSize({ w: stage.clientWidth, h: stage.clientHeight });
      setTransform((prev) => (prev.scale > 1 ? clampPan(prev.scale, prev.x, prev.y) : prev));
    };

    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure);
      observer.observe(stage);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open, frames.length, clampPan]);

  // Focus close button on open and restore previous focus on close
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => {
      closeBtnRef.current?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      previous?.focus?.();
    };
  }, [open]);

  // Non-passive mouse-wheel / trackpad pinch zoom & complete background scroll containment
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const stage = stageRef.current;
    if (!dialog || !stage) return;

    let wheelIdleTimer: number | undefined;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (!stage.contains(event.target as Node)) return;

      const modeMultiplier = event.deltaMode === 1 ? 24 : event.deltaMode === 2 ? 120 : 1;
      const normalizedDelta = event.deltaY * modeMultiplier;
      if (normalizedDelta === 0) return;

      const sensitivity = event.ctrlKey ? 0.0085 : 0.0024;
      const step = clamp(-normalizedDelta * sensitivity, -0.55, 0.55);
      const current = transformRef.current;
      const nextScale = clamp(current.scale * Math.exp(step), MIN_ZOOM, MAX_ZOOM);

      setInteracting(true);
      zoomAroundPoint(nextScale <= 1.02 ? MIN_ZOOM : nextScale, event.clientX, event.clientY, current);

      window.clearTimeout(wheelIdleTimer);
      wheelIdleTimer = window.setTimeout(() => setInteracting(false), 140);
    };

    const preventBackgroundTouch = (event: TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.lightbox-thumbs')) return;
      if (event.cancelable) event.preventDefault();
    };

    dialog.addEventListener('wheel', onWheel, { passive: false });
    dialog.addEventListener('touchmove', preventBackgroundTouch, { passive: false });
    return () => {
      window.clearTimeout(wheelIdleTimer);
      dialog.removeEventListener('wheel', onWheel);
      dialog.removeEventListener('touchmove', preventBackgroundTouch);
    };
  }, [open, zoomAroundPoint]);

  // Keyboard navigation, zoom shortcuts and focus trap
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }

    if (event.key === 'ArrowRight' && frames.length > 1) {
      event.preventDefault();
      goTo(safeIndex + 1);
    } else if (event.key === 'ArrowLeft' && frames.length > 1) {
      event.preventDefault();
      goTo(safeIndex - 1);
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomAroundCenter(transformRef.current.scale + ZOOM_STEP);
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      zoomAroundCenter(transformRef.current.scale - ZOOM_STEP);
    } else if (event.key === '0') {
      event.preventDefault();
      resetZoom();
    }
  };

  // Touch handlers: pinch-to-zoom, double-tap zoom, zoomed drag, and 1x gallery swipe
  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length >= 2) {
      const [t0, t1] = [event.touches[0], event.touches[1]];
      pinchRef.current = {
        startDist: Math.max(1, touchDistance(t0, t1)),
        startMid: touchMidpoint(t0, t1),
        startTransform: transformRef.current,
      };
      if (touchPanRef.current) touchPanRef.current.hadMultiTouch = true;
      lastTapRef.current = null;
      setSwipeOffset(0);
      setInteracting(true);
      return;
    }

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      const current = transformRef.current;
      touchPanRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: performance.now(),
        originX: current.x,
        originY: current.y,
        moved: false,
        hadMultiTouch: false,
        mode: current.scale > 1.02 ? 'pan' : 'swipe',
      };
      setInteracting(true);
    }
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length >= 2 && pinchRef.current) {
      const [t0, t1] = [event.touches[0], event.touches[1]];
      const { startDist, startMid, startTransform } = pinchRef.current;
      const dist = touchDistance(t0, t1);
      const mid = touchMidpoint(t0, t1);
      const nextScale = clamp(startTransform.scale * (dist / startDist), MIN_ZOOM, MAX_ZOOM);

      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const startOx = startMid.x - (rect.left + rect.width / 2);
      const startOy = startMid.y - (rect.top + rect.height / 2);
      const factor = nextScale / startTransform.scale;
      const zoomedX = startOx - (startOx - startTransform.x) * factor;
      const zoomedY = startOy - (startOy - startTransform.y) * factor;
      const panDx = mid.x - startMid.x;
      const panDy = mid.y - startMid.y;

      setTransform(clampPan(nextScale, zoomedX + panDx, zoomedY + panDy));
      return;
    }

    if (event.touches.length === 1 && touchPanRef.current && !pinchRef.current) {
      const touch = event.touches[0];
      const gesture = touchPanRef.current;
      const dx = touch.clientX - gesture.startX;
      const dy = touch.clientY - gesture.startY;

      if (Math.hypot(dx, dy) > 8) {
        gesture.moved = true;
      }

      if (gesture.mode === 'pan' || transformRef.current.scale > 1.02) {
        gesture.mode = 'pan';
        setTransform(clampPan(transformRef.current.scale, gesture.originX + dx, gesture.originY + dy));
      } else if (frames.length > 1) {
        const atStart = safeIndex === 0 && dx > 0;
        const atEnd = safeIndex === frames.length - 1 && dx < 0;
        setSwipeOffset(dx * (atStart || atEnd ? 0.18 : 0.55));
      }
    }
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    // Transition cleanly from 2-finger pinch down to 1-finger pan without jumping
    if (pinchRef.current && event.touches.length === 1) {
      pinchRef.current = null;
      const remaining = event.touches[0];
      const current = transformRef.current;
      touchPanRef.current = {
        startX: remaining.clientX,
        startY: remaining.clientY,
        startTime: performance.now(),
        originX: current.x,
        originY: current.y,
        moved: true,
        hadMultiTouch: true,
        mode: current.scale > 1.02 ? 'pan' : 'swipe',
      };
      return;
    }

    if (event.touches.length > 0) return;

    const endedPinch = Boolean(pinchRef.current);
    pinchRef.current = null;
    const gesture = touchPanRef.current;
    touchPanRef.current = null;
    setInteracting(false);

    if (endedPinch || gesture?.hadMultiTouch) {
      suppressBackdropClickRef.current = true;
      if (transformRef.current.scale < 1.05) {
        setTransform(IDENTITY);
      }
      return;
    }

    if (!gesture) return;

    const changed = event.changedTouches[0];
    const endX = changed ? changed.clientX : gesture.startX;
    const endY = changed ? changed.clientY : gesture.startY;
    const dx = endX - gesture.startX;
    const dy = endY - gesture.startY;
    const elapsed = performance.now() - gesture.startTime;

    // Swipe between gallery frames when not zoomed in
    if (gesture.mode === 'swipe' && gesture.moved) {
      suppressBackdropClickRef.current = true;
      setSwipeOffset(0);
      if (frames.length > 1 && Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy) * 1.1) {
        if (dx < 0 && safeIndex < frames.length - 1) {
          goTo(safeIndex + 1);
          return;
        }
        if (dx > 0 && safeIndex > 0) {
          goTo(safeIndex - 1);
          return;
        }
      }
      return;
    }

    if (gesture.moved) {
      suppressBackdropClickRef.current = true;
      if (transformRef.current.scale < 1.04) {
        setTransform(IDENTITY);
      }
      return;
    }

    // Clean single-finger tap: check for double-tap zoom
    if (elapsed < 340) {
      const now = performance.now();
      const prev = lastTapRef.current;
      if (prev && now - prev.time < 330 && Math.hypot(endX - prev.x, endY - prev.y) < 40) {
        lastTapRef.current = null;
        lastTouchZoomAtRef.current = now;
        suppressBackdropClickRef.current = true;
        if (transformRef.current.scale > 1.05) {
          setTransform(IDENTITY);
        } else {
          zoomAroundPoint(DOUBLE_TAP_ZOOM, endX, endY);
        }
      } else {
        lastTapRef.current = { time: now, x: endX, y: endY };
      }
    }
  };

  // Desktop mouse drag when zoomed in
  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const current = transformRef.current;
    if (current.scale <= 1.02) return;

    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = current.x;
    const originY = current.y;
    let moved = false;

    setInteracting(true);

    const onMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (Math.hypot(dx, dy) > 4) moved = true;
      setTransform(clampPan(transformRef.current.scale, originX + dx, originY + dy));
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setInteracting(false);
      if (moved) suppressBackdropClickRef.current = true;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Desktop double-click zoom toggle
  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (performance.now() - lastTouchZoomAtRef.current < 500) return;
    event.preventDefault();
    suppressBackdropClickRef.current = true;
    setInteracting(false);
    if (transformRef.current.scale > 1.05) {
      setTransform(IDENTITY);
    } else {
      zoomAroundPoint(DOUBLE_TAP_ZOOM, event.clientX, event.clientY);
    }
  };

  // Close when clicking empty stage area at 1x zoom (never while dragging or zoomed)
  const handleStageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (suppressBackdropClickRef.current) {
      suppressBackdropClickRef.current = false;
      return;
    }
    if (event.target === stageRef.current && transformRef.current.scale <= 1.02) {
      onClose();
    }
  };

  if (!open || !currentFrame || typeof document === 'undefined') return null;

  const isZoomed = transform.scale > 1.02;
  const zoomPercent = Math.round(transform.scale * 100);
  const translateX = isZoomed ? transform.x : swipeOffset;
  const translateY = isZoomed ? transform.y : 0;

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${name} image viewer`}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="product-lightbox paper-surface"
    >
      {/* Top toolbar */}
      <header className="lightbox-bar">
        <div className="lightbox-meta">
          <span className="lightbox-counter" aria-live="polite" aria-atomic="true">
            {safeIndex + 1} / {frames.length}
          </span>
          <span className="lightbox-title">{name}</span>
        </div>

        <div className="lightbox-controls">
          <button
            type="button"
            className="lightbox-btn"
            aria-label="Zoom out"
            disabled={transform.scale <= MIN_ZOOM + 0.01}
            onClick={() => zoomAroundCenter(transform.scale - ZOOM_STEP)}
          >
            <ZoomOut />
          </button>
          <button
            type="button"
            className="lightbox-zoom-readout"
            aria-label={isZoomed ? `Reset zoom from ${zoomPercent}%` : `Zoom level ${zoomPercent}%`}
            onClick={() => (isZoomed ? resetZoom() : zoomAroundCenter(2))}
          >
            {isZoomed ? <RotateCcw className="h-3.5 w-3.5" /> : null}
            <span>{zoomPercent}%</span>
          </button>
          <button
            type="button"
            className="lightbox-btn"
            aria-label="Zoom in"
            disabled={transform.scale >= MAX_ZOOM - 0.01}
            onClick={() => zoomAroundCenter(transform.scale + ZOOM_STEP)}
          >
            <ZoomIn />
          </button>
          <button
            ref={closeBtnRef}
            type="button"
            className="lightbox-btn lightbox-close"
            aria-label="Close image viewer"
            onClick={onClose}
          >
            <X />
          </button>
        </div>
      </header>

      {/* Main interactive viewport */}
      <div className="lightbox-body">
        {frames.length > 1 ? (
          <button
            type="button"
            className="lightbox-nav lightbox-nav--prev"
            aria-label="Previous image in viewer"
            disabled={safeIndex === 0}
            onClick={() => goTo(safeIndex - 1)}
          >
            <ArrowLeft />
          </button>
        ) : null}

        <div
          ref={stageRef}
          data-testid="lightbox-stage"
          data-zoom={transform.scale.toFixed(2)}
          className={[
            'lightbox-stage',
            isZoomed ? (interacting ? 'is-grabbing' : 'is-zoomed') : 'is-fit',
          ].join(' ')}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          onClick={handleStageClick}
        >
          <img
            ref={imageRef}
            key={currentFrame.url}
            src={currentFrame.url}
            alt={currentFrame.alt || `${name} — view ${safeIndex + 1}`}
            draggable={false}
            decoding="async"
            onLoad={(event) => {
              const img = event.currentTarget;
              if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
              }
            }}
            className="lightbox-image"
            style={{
              width: fittedSize ? `${fittedSize.width}px` : undefined,
              height: fittedSize ? `${fittedSize.height}px` : undefined,
              transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${transform.scale})`,
              transition: interacting ? 'none' : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
        </div>

        {frames.length > 1 ? (
          <button
            type="button"
            className="lightbox-nav lightbox-nav--next"
            aria-label="Next image in viewer"
            disabled={safeIndex >= frames.length - 1}
            onClick={() => goTo(safeIndex + 1)}
          >
            <ArrowRight />
          </button>
        ) : null}
      </div>

      {/* Footer thumbnails when piece has multiple images */}
      {frames.length > 1 ? (
        <div className="lightbox-thumbs" role="group" aria-label="Viewer gallery thumbnails">
          {frames.map((frame, i) => (
            <button
              key={frame.url}
              type="button"
              aria-label={`Show image ${i + 1} of ${frames.length}`}
              aria-pressed={i === safeIndex}
              onClick={() => goTo(i)}
              className="lightbox-thumb"
            >
              <img src={frame.url} alt="" loading="lazy" draggable={false} />
            </button>
          ))}
        </div>
      ) : null}
    </div>,
    document.body
  );
}
