import { useEffect, useRef, useState } from 'react';

export type LoyaltyRewardKind = 'percent_10' | 'percent_20' | 'free_pants';

export interface LoyaltyCardProps {
  memberName: string;
  email: string;
  /** Delivered, qualifying orders inside the current five-order cycle (0-5). */
  progress: number;
  /**
   * The reward that is unlocked and waiting for the customer's next order.
   * `percent_10` at 2/5, `percent_20` at 3/5, `free_pants` at 4/5.
   */
  unlocked?: LoyaltyRewardKind | null;
  /** Percent value configured for the *next* percent milestone, for the ring hint. */
  unlockedPercent?: number | null;
  /** True while the server-reported progress is still being fetched. */
  pending?: boolean;
  /**
   * Play the entrance animation once: show the back, then flip to the front
   * after a short beat. Disabled for prefers-reduced-motion and after the first
   * reveal so later data updates never replay it.
   */
  autoReveal?: boolean;
}

/**
 * Circle geometry measured pixel-by-pixel from the supplied front artwork
 * (1343x781). Each entry is the centre as a fraction of the card box plus its
 * own width/height fractions, so the overlay lands exactly on the printed white
 * rings at any rendered size. The artwork itself is never redrawn: the glossy
 * red, the shine and the five rings are the merchant's own image.
 */
const CIRCLES = [
  { cx: 0.14483, cy: 0.21446, w: 0.13403, h: 0.23303 },
  { cx: 0.32762, cy: 0.21383, w: 0.13321, h: 0.23175 },
  { cx: 0.5134, cy: 0.21446, w: 0.1385, h: 0.24072 },
  { cx: 0.69658, cy: 0.21446, w: 0.13403, h: 0.23303 },
  { cx: 0.88347, cy: 0.21511, w: 0.1385, h: 0.23944 },
];

const MILESTONES: Array<{ label: string; reward: string }> = [
  { label: 'Order 1', reward: 'Regular' },
  { label: 'Order 2', reward: 'Regular' },
  { label: 'Order 3', reward: '10% off' },
  { label: 'Order 4', reward: '20% off' },
  { label: 'Order 5', reward: 'Pair free' },
];

function Check({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M4.5 12.6 9.4 17.4 19.5 6.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Gift({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The physical loyalty card. Two supplied faces, one 3D flip.
 *
 * · The back (script logo) is shown first; after a short intentional beat the
 *   card flips once and leaves the front — the five-ring side — facing the
 *   customer. The flip replays only when the card is re-entered, never on data
 *   refreshes.
 * · Tapping (or Enter/Space, via the checkbox) turns the card over again.
 * · `prefers-reduced-motion` skips the animation and shows the front at once.
 */
export function LoyaltyCard({
  memberName,
  email,
  progress,
  unlocked = null,
  unlockedPercent = null,
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
  const firstEmpty = safeProgress < 5 ? safeProgress : -1;

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
        }, 900);
      },
      { threshold: 0.5 }
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
    <div className="lw-card" ref={wrapRef} data-testid="loyalty-card-art">
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
        <label htmlFor="loyalty-card-flip" className="lw-card-tilt" data-testid="loyalty-card-label">
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
                width={1344}
                height={788}
                draggable={false}
                decoding="async"
                fetchPriority="high"
              />
            </span>

            {/* FRONT — five rings + THREEWAYS */}
            <span className="lw-card-face lw-card-face--front">
              <img
                src="/images/loyalty-card-front.png"
                alt={`${cardLabel} — front, ${safeProgress} of 5 orders completed`}
                width={1343}
                height={781}
                draggable={false}
                decoding="async"
              />
              <span className="lw-stamps" aria-hidden="true">
                {CIRCLES.map((circle, index) => {
                  const done = index < safeProgress;
                  const isFree = index === 4;
                  // The fifth circle is the free-pair milestone: it pulses while
                  // the reward is unlocked and unspent.
                  const ready = isFree && unlocked === 'free_pants';
                  // The next circle carries the percent reward waiting for the
                  // customer, so the card explains itself without extra copy.
                  const hint =
                    !done && !ready && index === firstEmpty && unlockedPercent
                      ? `${unlockedPercent}%`
                      : null;
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
                          isFree ? (
                            <Gift className="lw-stamp-gift" />
                          ) : (
                            <Check className="lw-stamp-check" />
                          )
                        ) : ready ? (
                          <Gift className="lw-stamp-gift" />
                        ) : hint ? (
                          <span className="lw-stamp-hint">{hint}</span>
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
        <div className="lw-progress-row">
          <p className="lw-progress-count" data-testid="loyalty-progress-text">
            {pending ? (
              'Checking your orders…'
            ) : (
              <>
                <strong>{safeProgress}</strong>
                <span className="lw-progress-of">/ 5</span>
                <span className="lw-progress-label">orders counted</span>
              </>
            )}
          </p>
          <ol className="lw-dots" aria-label="Loyalty milestones">
            {MILESTONES.map((milestone, index) => {
              const done = index < safeProgress;
              const next = index === safeProgress;
              return (
                <li
                  key={milestone.label}
                  className={done ? 'is-done' : next ? 'is-next' : ''}
                  title={`${milestone.label} · ${milestone.reward}`}
                  data-testid={`loyalty-milestone-${index + 1}`}
                  data-state={done ? 'complete' : next ? 'next' : 'upcoming'}
                />
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}
