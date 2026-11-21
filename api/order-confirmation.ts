/**
 * POST /api/order-confirmation
 *
 * Sends the customer order-confirmation email. Body: { "order_id": "<uuid>" }
 * Only the order id is accepted — the email is constructed server-side from
 * the order row and nothing from the request can influence the content,
 * recipient or sender. Responses are minimal and never echo addresses.
 */
import { handleOrderNotificationRequest } from './_lib/handler';
import { createProductionDeps } from './_lib/production';
import type { ApiRequest, ApiResponse } from './_lib/types';

const deps = createProductionDeps('order-confirmation');

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  await handleOrderNotificationRequest(deps, req, res);
}
