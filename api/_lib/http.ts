import type { ApiRequest, ApiResponse } from './types';

export const BODY_LIMIT_BYTES = 16 * 1024;

export class BodyTooLargeError extends Error {
  constructor(limit: number) {
    super(`Request body exceeds ${limit} bytes`);
    this.name = 'BodyTooLargeError';
  }
}

export class InvalidJsonError extends Error {
  constructor() {
    super('Request body must be valid JSON');
    this.name = 'InvalidJsonError';
  }
}

/** Reads a JSON payload from a Vercel Node-compatible request. */
export async function readJsonBody(req: ApiRequest, maxBytes = BODY_LIMIT_BYTES): Promise<unknown> {
  let text: string;
  if (typeof req.body === 'string') {
    text = req.body;
  } else if (typeof req[Symbol.asyncIterator] === 'function') {
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of req as AsyncIterable<Buffer | string>) {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk;
      total += buf.length;
      if (total > maxBytes) throw new BodyTooLargeError(maxBytes);
      chunks.push(buf);
    }
    text = Buffer.concat(chunks).toString('utf8');
  } else {
    throw new InvalidJsonError();
  }
  if (Buffer.byteLength(text, 'utf8') > maxBytes) throw new BodyTooLargeError(maxBytes);
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new InvalidJsonError();
  }
}

/**
 * Vercel runtime does not expose a res.json helper in plain `api/` handlers;
 * send JSON manually with the security headers required for this endpoint.
 */
export function sendJson(
  res: ApiResponse,
  statusCode: number,
  body: unknown,
  extraHeaders: Record<string, string> = {}
): void {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [key, value] of Object.entries(extraHeaders)) res.setHeader(key, value);
  res.writeHead(statusCode, {});
  res.end(JSON.stringify(body));
}

export function jsonError(
  res: ApiResponse,
  statusCode: number,
  reason: string,
  extra: Record<string, unknown> = {},
  extraHeaders: Record<string, string> = {}
): void {
  sendJson(res, statusCode, { error: reason, ...extra }, extraHeaders);
}

/** Content-Type must name JSON; anything else is refused before the body is read. */
export function hasJsonContentType(req: ApiRequest): boolean {
  const raw = req.headers['content-type'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return false;
  return /^application\/json\b/i.test(value.trim());
}
