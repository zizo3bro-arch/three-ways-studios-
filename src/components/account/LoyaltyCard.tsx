import { useEffect, useRef, useState } from 'react';

export interface LoyaltyCardProps {
  memberName: string;
  email: string;
  /** Completed eligible (delivered) orders in the current five-order cycle. */
  progress: number;
  /** True while the server-reported stamp count is still being fetched. */
  pending?: boolean;
  /**
   * Play the entrance animation once: show the back, then flip to the front
   * after a short beat. Disabled for prefers-reduced-motion and after the
   * first reveal so later data updates never replay it.
   */
  autoReveal?: boolean;
}

/**
 * Circle geometry measured pixel-by-pixel from the supplied front artwork
 * (1337x775). Each entry is the centre as a fraction of the card box plus its
 * own width/height fractions, so the overlay lands exactly on the printed
 * white rings at any rendered size.
 */
const CIRCLES = [
  { cx: 0.14248, cy: 0.21226, w: 0.13463, h: 0.23484 },
  { cx: 0.3261, cy: 0.21226, w: 0.13538, h: 0.23484 },
  { cx: 0.51272, cy: 0.2129, w: 0.13912, h: 0.24387 },
  { cx: 0.69708, cy: 0.2129, w: 0.13538, h: 0.23613 },
  { cx: 0.88482, cy: 0.2129, w: 0.13987, h: 0.24387 },
];

const MILESTONES = [
  { label: '1st order', reward: 'Regular price' },
  { label: '2nd order', reward: 'Regular price' },
  { label: '3rd order', reward: '10% off that order' },
  { label: '4th order', reward: '20% off that order' },
  { label: '5th order', reward: 'One pair of pants free' },
];

/**
 * The five circles are part of the supplied front artwork, so progress is drawn
 * as an overlay aligned to the artwork's own geometry (percentages of the card
 * box). Nothing is baked into the image and no label is printed in the middle
 * of the design.
 */
export function LoyaltyCard({
  memberName,
  email,
  progress,
  pending = false,
  autoReveal = true,
}: LoyaltyCardProps) {
  // false = showing the back (script logo side), true = showing the front.
  const [showFront, setShowFront] = useState(false);
  const [announce, setAnnounce] = useState('');
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const played = useRef(false);

  const safeProgress = Math.max(0, Math.min(5, Math.round(progress)));
  const cardLabel = `${memberName || 'Three Ways Studios member'} loyalty card for ${email}`;

  // Entrance animation: back face first, then a single flip to the front.
  useEffect(() => {
    if (!autoReveal || played.current) return;
    const node = wrapRef.current;
    const reduce =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setShowFront(true);
      played.current = true;
      return;
    }
    // Only play when the card is actually on screen.
    if (!node || typeof IntersectionObserver === 'undefined') {
      setShowFront(true);
      played.current = true;
      return;
    }
    let timer: number | undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        timer = window.setTimeout(() => {
          played.current = true;
          setShowFront(true);
        }, 850);
      },
      { threshold: 0.55 }
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (timer) window.clearTimeout(timer);
    };
  }, [autoReveal]);

  const flip = () => {
    played.current = true;
    setShowFront((current) => {
      setAnnounce(current ? 'Showing the back of your card' : 'Showing the front of your card');
      return !current;
    });
  };

  return (
    <div className="lw-card" ref={wrapRef}>
      <input
        type="checkbox"
        id="loyalty-card-flip"
        className="lw-card-input"
        checked={showFront}
        onChange={flip}
        data-testid="loyalty-card-input"
        aria-label="Turn the loyalty card over"
      />
      <div className="lw-card-stage">
        <label
          htmlFor="loyalty-card-flip"
          className="lw-card-tilt"
          data-testid="loyalty-card-label"
        >
          <span
            className={`lw-card-3d${showFront ? ' is-front' : ''}`}
            data-testid="loyalty-card-3d"
            data-side={showFront ? 'front' : 'back'}
          >
            {/* BACK — script logo artwork (shown first) */}
            <span className="lw-card-face lw-card-face--back">
              <img
                src="/images/loyalty-card-back.png"
                alt={`${cardLabel} — back`}
                width={1337}
                height={783}
                draggable={false}
                decoding="async"
                fetchPriority="high"
              />
            </span>

            {/* FRONT — five circles + THREEWAYS */}
            <span className="lw-card-face lw-card-face--front">
              <img
                src="/images/loyalty-card-front.png"
                alt={`${cardLabel} — front, ${safeProgress} of 5 orders completed`}
                width={1337}
                height={775}
                draggable={false}
                decoding="async"
              />
              <span className="lw-stamps" aria-hidden="true">
                {CIRCLES.map((circle, index) => {
                  const done = index < safeProgress;
                  // Circle 5 is the free-pair milestone: highlight it while the
                  // reward is still unlocked and unredeemed for this cycle.
                  const isFree = index === 4;
                  const ready = isFree && safeProgress === 5;
                  return (
                    <span
                      key={circle.cx}
                      className={[
                        'lw-stamp',
                        done ? 'is-done' : '',
                        ready ? 'is-ready' : '',
                        pending ? 'is-pending' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      style={{
                        left: `${circle.cx * 100}%`,
                        top: `${circle.cy * 100}%`,
                        width: `${circle.w * 100}%`,
                        height: `${circle.h * 100}%`,
                      }}
                      data-testid={`loyalty-circle-${index + 1}`}
                      data-complete={done ? 'true' : 'false'}
                    >
                      <span className="lw-stamp-inner">
                        {done ? (
                          index === 4 ? (
                            <svg viewBox="0 0 24 24" className="lw-stamp-gift" aria-hidden="true">
                              <path
                                d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          ) : (
                            <span className="lw-stamp-count">{index + 1}</span>
                          )
                        ) : null}
                      </span>
                    </span>
                  );
                })}
              </span>
            </span>
          </span>
        </label>
      </div>

      <p className="lw-card-hint" aria-live="polite">
        {showFront ? 'Tap the card to see the back' : 'Tap the card to see the front'}
        <span className="lw-sr-only">{announce}</span>
      </p>

      <div className="lw-progress">
        <p className="lw-progress-count" data-testid="loyalty-progress-text">
          {pending ? (
            'Checking your orders…'
          ) : (
            <>
              <strong>{safeProgress}</strong> of 5 orders completed
            </>
          )}
        </p>
        <ol className="lw-steps" aria-label="Loyalty milestones">
          {MILESTONES.map((milestone, index) => {
            const done = index < safeProgress;
            const next = index === safeProgress;
            return (
              <li
                key={milestone.label}
                className={done ? 'is-done' : next ? 'is-next' : ''}
                data-testid={`loyalty-milestone-${index + 1}`}
                data-state={done ? 'complete' : next ? 'next' : 'upcoming'}
              >
                <span className="lw-step-dot" aria-hidden="true" />
                <span className="lw-step-text">
                  <strong>{milestone.label}</strong>
                  <em>{milestone.reward}</em>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
