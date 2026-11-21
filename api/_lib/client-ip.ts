import { isIP } from 'node:net';
import type { ApiRequest } from './types.js';

export type ClientIpSource =
  | 'x-vercel-forwarded-for'
  | 'x-forwarded-for'
  | 'x-real-ip'
  | 'unknown';

export interface ClientIpResolution {
  ip: string;
  source: ClientIpSource;
  /** True only when the request is observed on Vercel, where the headers are Vercel-set. */
  trusted: boolean;
}

function vercelEnvValue(): string {
  // Vercel documents the deployment marker `VERCEL` ('1') at https://vercel.com/docs/env-vars
  // and in the functions documentation. There is no VERCEL_SYSTEM_ENV variable — using one
  // here was misleading; VERCEL is the only reliable documented signal.
  return (process.env.VERCEL ?? '').trim();
}

/**
 * Vercel documented request headers (https://vercel.com/docs/headers/request-headers):
 *
 *   x-forwarded-for — "The public IP address of the client that made the request. If you
 *     are trying to use Vercel behind a proxy, we currently overwrite the X-Forwarded-For
 *     header and do not forward external IPs. This restriction is in place to prevent IP spoofing."
 *   x-vercel-forwarded-for — identical to x-forwarded-for, "However, x-forwarded-for could be
 *     overwritten if you're using a proxy on top of Vercel."
 *   x-real-ip — "This header is identical to the x-forwarded-for header."
 *
 * Only request headers Vercel sets at the edge are used, and only on direct Vercel traffic
 * (VERCEL === '1'). Outside Vercel every header is client-controlled, so nothing is trusted.
 *
 * Prefer x-vercel-forwarded-for (Vercel-specific, immune to a proxy on top of Vercel),
 * then x-forwarded-for, then x-real-ip. The value is validated as a single IPv4/IPv6 address;
 * anything else falls through to the fixed "unknown" bucket (fail-closed).
 */
export function resolveClientIp(
  headers: Record<string, string | string[] | undefined>,
  vercelHeader = vercelEnvValue()
): ClientIpResolution {
  if (vercelHeader !== '1') {
    return { ip: 'unknown', source: 'unknown', trusted: false };
  }
  for (const name of ['x-vercel-forwarded-for', 'x-forwarded-for', 'x-real-ip'] as const) {
    const raw = headers[name];
    const value = Array.isArray(raw) ? raw[0] : raw;
    const first = value?.split(',')[0]?.trim();
    if (first && isIP(first)) {
      return { ip: first, source: name, trusted: true };
    }
  }
  return { ip: 'unknown', source: 'unknown', trusted: false };
}
