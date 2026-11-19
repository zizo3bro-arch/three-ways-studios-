import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Circle, Clock, XCircle } from 'lucide-react';
import { formatEGP } from '../../lib/format';
import { ORDER_TRACKING_STEPS, resolveTrackingStage } from '../../lib/orderTracking';
import type { TrackedOrderData } from '../../types/database';

interface OrderTrackingResultProps {
  order: TrackedOrderData;
  lookupEmail: string;
  onNavigate?: () => void;
}

export function OrderTrackingResult({ order, lookupEmail, onNavigate }: OrderTrackingResultProps) {
  const stage = resolveTrackingStage(order.status, order.tracking);
  const formattedDate = new Date(order.created_at).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div
      className="mt-3.5 border border-ink/18 px-4 py-4"
      data-testid="order-tracking-result"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/14 pb-3">
        <div>
          <p className="tws-eyebrow text-ink-faint">Order {order.order_reference}</p>
          <p className="mt-1 font-display text-lg uppercase leading-none text-ink">
            {stage.label}
          </p>
          <p className="mt-1 text-[12.5px] text-ink-soft">{stage.description}</p>
        </div>
        <span className="text-[11px] uppercase tracking-[0.12em] text-ink-faint">
          {formattedDate}
        </span>
      </div>

      {stage.is_cancelled ? (
        <div className="mt-3 flex items-center gap-2 border-l-2 border-crimson bg-[rgba(165,18,27,0.06)] px-3 py-2.5 text-[12.5px] text-crimson-deep">
          <XCircle className="h-4 w-4 shrink-0 text-crimson" strokeWidth={1.9} />
          <span>This order was cancelled and will not be dispatched.</span>
        </div>
      ) : (
        <ol className="mt-3.5 space-y-2.5" aria-label="Order status progression">
          {ORDER_TRACKING_STEPS.map((item) => {
            const reached = stage.is_completed || stage.step >= item.step;
            const current = !stage.is_completed && stage.step === item.step;
            return (
              <li
                key={item.step}
                data-step-active={current ? 'true' : 'false'}
                data-step-reached={reached ? 'true' : 'false'}
                className="flex items-start gap-2.5 text-[12.5px]"
              >
                {reached && !current ? (
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-crimson"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                ) : current ? (
                  <Clock
                    className="mt-0.5 h-4 w-4 shrink-0 text-crimson"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                ) : (
                  <Circle
                    className="mt-0.5 h-4 w-4 shrink-0 text-ink/25"
                    strokeWidth={1.7}
                    aria-hidden="true"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p
                    className={[
                      'font-semibold uppercase tracking-[0.08em]',
                      current
                        ? 'text-crimson'
                        : reached
                          ? 'text-ink'
                          : 'text-ink-faint',
                    ].join(' ')}
                  >
                    {item.step}. {item.label}
                  </p>
                  <p className={reached ? 'text-ink-soft' : 'text-ink-faint/80'}>
                    {item.description}
                  </p>
                </div>
              </li>
            );
          })}
          {stage.is_completed ? (
            <li className="flex items-center gap-2 border-t border-ink/12 pt-2.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-crimson">
              <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={2} />
              Delivered — Completed purchase
            </li>
          ) : null}
        </ol>
      )}

      {order.items.length > 0 ? (
        <ul className="mt-3.5 space-y-1.5 border-t border-ink/12 pt-3 text-[12.5px] text-ink-soft">
          {order.items.map((item, idx) => (
            <li key={`${item.product_name}-${idx}`} className="flex justify-between gap-3">
              <span className="truncate">
                {item.product_name} ({item.color_name} · {item.size_name}) × {item.quantity}
              </span>
              <span className="shrink-0 font-medium tabular-nums text-ink">
                {formatEGP(item.line_total)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-3 border-t border-ink/12 pt-2.5 text-[12.5px] leading-relaxed text-ink-soft">
        {order.items.length} {order.items.length === 1 ? 'piece' : 'pieces'} ·{' '}
        <span className="font-semibold text-ink">{formatEGP(order.total_amount)}</span> COD to{' '}
        {order.city || order.governorate || 'Cairo'}.
      </p>

      <Link
        to={`/order-confirmation/${encodeURIComponent(order.order_reference)}`}
        state={{ email: lookupEmail.trim().toLowerCase() }}
        onClick={onNavigate}
        className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-crimson hover:text-crimson-deep"
      >
        Open confirmation
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
