/**
 * Server-side notification tracking through the service-role Supabase client.
 * Every claim/outcome goes through the SECURITY DEFINER functions from
 * migration 014; these wrappers are the only path the API endpoints use.
 */
import type { NotificationType } from './types.js';

export async function rateLimitCheck(
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; count: number; retryAfterSeconds: number } | null> {
  try {
    const { data, error } = await rpc('rate_limit_check', {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error || !data || typeof data !== 'object') return null;
    const row = data as { allowed?: unknown; count?: unknown; retry_after_seconds?: unknown };
    return {
      allowed: row.allowed === true,
      count: Number(row.count) || 0,
      retryAfterSeconds:
        typeof row.retry_after_seconds === 'number' && Number.isFinite(row.retry_after_seconds)
          ? Math.max(0, Math.floor(row.retry_after_seconds))
          : windowSeconds,
    };
  } catch {
    return null;
  }
}

export type ClaimOutcome =
  | 'new'
  | 'reclaimed'
  | 'in_flight'
  | 'already_sent'
  | 'failed'
  | 'lost';

export interface ClaimResult {
  outcome: ClaimOutcome;
  claimToken: string | null;
  idempotencyKey: string | null;
  status: string | null;
  claimExpiresAt: string | null;
  lastError: string | null;
}

export async function claimEmailNotification(
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>,
  orderId: string,
  notificationType: NotificationType,
  leaseSeconds: number
): Promise<ClaimResult | null> {
  try {
    const { data, error } = await rpc('claim_email_notification', {
      p_order_id: orderId,
      p_notification_type: notificationType,
      p_lease_seconds: leaseSeconds,
    });
    if (error || !data || typeof data !== 'object') return null;
    const row = data as {
      outcome?: unknown;
      claim_token?: unknown;
      idempotency_key?: unknown;
      status?: unknown;
      claim_expires_at?: unknown;
      last_error?: unknown;
    };
    const outcome = row.outcome;
    if (
      outcome !== 'new' && outcome !== 'reclaimed' && outcome !== 'in_flight' &&
      outcome !== 'already_sent' && outcome !== 'failed' && outcome !== 'lost'
    ) {
      return null;
    }
    return {
      outcome,
      claimToken: typeof row.claim_token === 'string' ? row.claim_token : null,
      idempotencyKey: typeof row.idempotency_key === 'string' ? row.idempotency_key : null,
      status: typeof row.status === 'string' ? row.status : null,
      claimExpiresAt: typeof row.claim_expires_at === 'string' ? row.claim_expires_at : null,
      lastError: typeof row.last_error === 'string' ? row.last_error : null,
    };
  } catch {
    return null;
  }
}

export type OutcomeStatus = 'claimed' | 'sent' | 'failed';

export async function recordEmailOutcome(
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>,
  orderId: string,
  notificationType: NotificationType,
  claimToken: string,
  status: OutcomeStatus,
  opts: { resendId?: string | null; error?: string | null } = {}
): Promise<boolean> {
  try {
    const { data, error } = await rpc('record_email_outcome', {
      p_order_id: orderId,
      p_notification_type: notificationType,
      p_claim_token: claimToken,
      p_status: status,
      p_resend_id: opts.resendId ?? null,
      p_error: opts.error ?? null,
    });
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}
