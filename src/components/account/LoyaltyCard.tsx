interface LoyaltyCardProps {
  memberName: string;
  email: string;
  /** Completed eligible orders in the current five-order cycle (0-5). */
  progress: number;
  /** True while the server-reported stamp count is still being fetched. */
  pending?: boolean;
}

/**
 * The supplied artwork is used unchanged on both faces of a single card:
 * `loyalty-card-back.png` (the THREE WAYS / stamp side) is shown first, and
 * tapping flips to `loyalty-card-front.png` (the script logo side).
 *
 * The card is pure CSS 3D — no image is ever recreated or substituted — and it
 * renders as soon as the account exists, so the artwork is never blocked by the
 * loyalty data request.
 */
export function LoyaltyCard({ memberName, email, progress, pending = false }: LoyaltyCardProps) {
  const cardLabel = `${memberName || 'Three Ways Studios member'} loyalty card for ${email}`;
  const safeProgress = Math.max(0, Math.min(5, progress));

  return (
    <div className="loyalty-card-wrap">
      {/* Native checkbox: the flip works without JavaScript state and remains
          keyboard accessible. The label wraps both card faces. */}
      <input
        type="checkbox"
        id="loyalty-card-flip"
        className="loyalty-card-input"
        data-testid="loyalty-card-input"
      />
      <label
        htmlFor="loyalty-card-flip"
        className="loyalty-card-button"
        data-testid="loyalty-card-label"
      >
        <span className="loyalty-card-3d" data-testid="loyalty-card-3d">
          <span className="loyalty-card-face loyalty-card-face--back">
            <img
              src="/images/loyalty-card-back.png"
              alt={`${cardLabel} — stamps side`}
              draggable={false}
              width="637"
              height="368"
              loading="eager"
              decoding="async"
            />
          </span>
          <span className="loyalty-card-face loyalty-card-face--front">
            <img
              src="/images/loyalty-card-front.png"
              alt={`${cardLabel} — logo side`}
              draggable={false}
              width="636"
              height="364"
              loading="eager"
              decoding="async"
            />
          </span>
        </span>
        <span className="loyalty-card-sr-only">Tap the card to turn it over</span>
      </label>

      <div className="loyalty-card-progress">
        <div className="loyalty-card-progress-heading">
          <span>Completed eligible orders</span>
          <strong data-testid="loyalty-card-progress">
            {pending ? '—/5' : `${safeProgress}/5`}
          </strong>
        </div>
        <div
          className="loyalty-card-dots"
          aria-label={pending ? 'Loading your stamp count' : `${safeProgress} of 5 eligible orders completed`}
        >
          {[1, 2, 3, 4, 5].map((step) => (
            <span
              key={step}
              className={!pending && step <= safeProgress ? 'is-complete' : ''}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
