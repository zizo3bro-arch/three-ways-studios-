/**
 * POST /api/admin-new-order
 *
 * Sends the studio-admin new-order notification. Body: { "order_id": "<uuid>" }
 * as above. The ONLY recipient is the server-configured studio inbox
 * (ADMIN_NOTIFICATION_EMAIL) — never a value from the request body.
 */
import { handleOrderNotificationRequest } from './_lib/handler';
import { createProductionDeps } from './_lib/production';
import type { ApiRequest, ApiResponse } from './_lib/types';

const deps = createProductionDeps('admin-new-order');

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  await handleOrderNotificationRequest(deps, req, res);
}
