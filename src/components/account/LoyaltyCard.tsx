import { useState } from 'react';

interface LoyaltyCardProps {
  memberName: string;
  email: string;
  progress: number;
}

/** The provided artwork is kept intact on both faces of a single 3D card. */
export function LoyaltyCard({ memberName, email, progress }: LoyaltyCardProps) {
  const [showFront, setShowFront] = useState(false);
  const cardLabel = `${memberName || 'Three Ways Studios member'} loyalty card for ${email}`;

  return (
    <div className="loyalty-card-wrap">
      <button
        type="button"
        className="loyalty-card-button"
        aria-label={showFront ? 'Show the back of your rewards card' : 'Show the front of your rewards card'}
        aria-pressed={showFront}
        onClick={() => setShowFront((current) => !current)}
      >
        <span
          className={`loyalty-card-3d${showFront ? ' is-front' : ''}`}
          data-testid="loyalty-card-3d"
          data-side={showFront ? 'front' : 'back'}
        >
          <span className="loyalty-card-face loyalty-card-face--back">
            <img
              src="/images/loyalty-card-back.png"
              alt={`${cardLabel} — back`}
              draggable={false}
              width="637"
              height="368"
            />
          </span>
          <span className="loyalty-card-face loyalty-card-face--front">
            <img
              src="/images/loyalty-card-front.png"
              alt={`${cardLabel} — front`}
              draggable={false}
              width="636"
              height="364"
            />
          </span>
        </span>
      </button>
      <p className="loyalty-card-hint" aria-live="polite">
        {showFront ? 'Front of your card · tap to turn it over' : 'Back of your card · tap to reveal the front'}
      </p>
      <div className="loyalty-card-progress">
        <div className="loyalty-card-progress-heading">
          <span>Completed eligible orders</span>
          <strong>{progress}/5</strong>
        </div>
        <div className="loyalty-card-dots" aria-label={`${progress} of 5 eligible orders completed`}>
          {[1, 2, 3, 4, 5].map((step) => (
            <span
              key={step}
              className={step <= progress ? 'is-complete' : ''}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
