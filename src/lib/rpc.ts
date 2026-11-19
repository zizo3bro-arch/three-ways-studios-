import { adminClient } from './adminClient';

/**
 * Calls a server-side function on the admin connection.
 *
 * The console never computes stock, loyalty or order state in the browser: it
 * asks PostgreSQL, which also enforces the admin check. Errors are surfaced
 * verbatim so the person clicking sees exactly what the database refused.
 */
export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!adminClient) throw new Error('The studio is not connected. Please try again later.');
  const { data, error } = await adminClient.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}
