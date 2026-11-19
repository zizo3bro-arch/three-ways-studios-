import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { CustomerOrderHistoryItem } from '../../types/database';
import { resolveTrackingStage } from '../../lib/orderTracking';

const STEPS = ['Accepted', 'Preparing', 'Ready', 'On the way', 'Delivered'];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatEGP(value: number) {
  return `EGP ${value.toLocaleString('en-EG', { maximumFractionDigits: 0 })}`;
}

/**
 * One order, at a glance: number, date, status chip, total and a plain-language
 * timeline. The fifth node lights up only for a delivered order, which is
 * exactly the event that stamps a loyalty circle.
 */
export function AccountOrderCard({
  order,
  email,
  onNavigate,
}: {
  order: CustomerOrderHistoryItem;
  email: string;
  onNavigate?: () => void;
}) {
  const stage = resolveTrackingStage(order.status, order.tracking);
  const cancelled = stage.is_cancelled;
  const delivered = stage.is_completed && !cancelled;
  const reached = delivered ? 5 : cancelled ? Math.min(stage.step, 4) : stage.step;

  return (
    <li className="ord-card" data-testid="purchase-history-item" data-status={stage.code}>
      <div className="ord-card-top">
        <div className="min-w-0">
          <p className="ord-ref">{order.order_reference}</p>
          <p className="ord-date">{formatDate(order.created_at)}</p>
        </div>
        <div className="ord-card-right">
          <span
            className={`ord-chip${cancelled ? ' is-cancelled' : delivered ? ' is-done' : ''}`}
          >
            {stage.label}
          </span>
          <p className="ord-total">{formatEGP(order.total_amount)}</p>
        </div>
      </div>

      <ol className={`ord-steps${cancelled ? ' is-cancelled' : ''}`} aria-label="Order progress">
        {STEPS.map((label, index) => {
          const done = index < reached;
          const current = !cancelled && !delivered && index === reached - 1;
          return (
            <li
              key={label}
              className={done ? (current ? 'is-current' : 'is-done') : ''}
              aria-current={current ? 'step' : undefined}
            >
              <span className="ord-step-dot" aria-hidden="true" />
              <span className="ord-step-label">{label}</span>
            </li>
          );
        })}
      </ol>

      <ul className="ord-items">
        {order.items.map((item, idx) => (
          <li key={`${order.order_id}-${idx}`}>
            <span className="truncate">
              {item.product_name}
              <span className="ord-variant">
                {' '}
                {item.color_name} / {item.size_name} × {item.quantity}
              </span>
            </span>
            <span className="ord-line-total">{formatEGP(item.line_total)}</span>
          </li>
        ))}
      </ul>

      {(order.loyalty_free_reward_amount ?? 0) > 0 ? (
        <p className="ord-reward">
          Free pair of pants applied
          {order.loyalty_free_reward_product_name
            ? ` — ${order.loyalty_free_reward_product_name}`
            : ''}
        </p>
      ) : null}

      <div className="ord-card-foot">
        <span>
          {delivered
            ? 'Counted toward your loyalty card'
            : cancelled
              ? 'Not counted toward your loyalty card'
              : 'Counts once it is marked delivered'}
        </span>
        <Link
          to={`/order-confirmation/${encodeURIComponent(order.order_reference)}`}
          state={{ email }}
          onClick={onNavigate}
          className="ord-link"
        >
          Receipt
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </li>
  );
}
