import type { OrderStatus, OrderTrackingStage } from '../types/database';

export interface TrackingStepDefinition {
  step: 1 | 2 | 3 | 4;
  label: string;
  description: string;
}

export const ORDER_TRACKING_STEPS: readonly TrackingStepDefinition[] = [
  {
    step: 1,
    label: 'Accepted',
    description: 'Order accepted.',
  },
  {
    step: 2,
    label: 'Preparing',
    description: 'Order is being prepared.',
  },
  {
    step: 3,
    label: 'Ready / Not Shipped',
    description: 'Order has not left yet.',
  },
  {
    step: 4,
    label: 'Out for Delivery',
    description: 'Order is on its way.',
  },
] as const;

export function resolveTrackingStage(
  status: OrderStatus,
  serverTracking?: OrderTrackingStage | null
): OrderTrackingStage {
  if (
    serverTracking &&
    typeof serverTracking.step === 'number' &&
    typeof serverTracking.label === 'string' &&
    typeof serverTracking.description === 'string'
  ) {
    return serverTracking;
  }

  switch (status) {
    case 'pending':
    case 'confirmed':
      return {
        step: 1,
        code: 'accepted',
        label: 'Accepted',
        description: 'Order accepted.',
        is_completed: false,
        is_cancelled: false,
      };
    case 'processing':
      return {
        step: 2,
        code: 'preparing',
        label: 'Preparing',
        description: 'Order is being prepared.',
        is_completed: false,
        is_cancelled: false,
      };
    case 'ready':
      return {
        step: 3,
        code: 'ready',
        label: 'Ready / Not Shipped',
        description: 'Order has not left yet.',
        is_completed: false,
        is_cancelled: false,
      };
    case 'shipped':
      return {
        step: 4,
        code: 'out_for_delivery',
        label: 'Out for Delivery',
        description: 'Order is on its way.',
        is_completed: false,
        is_cancelled: false,
      };
    case 'delivered':
      return {
        step: 5,
        code: 'delivered',
        label: 'Delivered',
        description: 'Order delivered and completed.',
        is_completed: true,
        is_cancelled: false,
      };
    case 'cancelled':
      return {
        step: 0,
        code: 'cancelled',
        label: 'Cancelled',
        description: 'Order was cancelled.',
        is_completed: false,
        is_cancelled: true,
      };
    default:
      return {
        step: 1,
        code: 'accepted',
        label: 'Accepted',
        description: 'Order accepted.',
        is_completed: false,
        is_cancelled: false,
      };
  }
}

export const ADMIN_STATUS_OPTIONS: Array<{ value: OrderStatus; label: string }> = [
  { value: 'pending', label: 'PENDING — Accepted' },
  { value: 'confirmed', label: 'CONFIRMED — Accepted' },
  { value: 'processing', label: 'PROCESSING — Preparing' },
  { value: 'ready', label: 'READY — Ready / Not Shipped' },
  { value: 'shipped', label: 'SHIPPED — Out for Delivery' },
  { value: 'delivered', label: 'DELIVERED — Completed Purchase' },
  { value: 'cancelled', label: 'CANCELLED — Cancelled' },
];
