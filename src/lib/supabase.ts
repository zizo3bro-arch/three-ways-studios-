import { createClient } from '@supabase/supabase-js';

const configuredUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
export const publicKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

/** createClient appends rest/v1, auth/v1 and storage/v1 itself. Accept the
 * existing project's dashboard-copied API endpoint without appending that
 * route a second time. Never change hosts, infer a project from a key or
 * discard the path prefix of a self-hosted gateway. */
function projectBase(input?: string) {
  if (!input) return undefined;
  try {
    const url = new URL(input);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return undefined;
    const prefix = url.pathname.replace(/\/(?:rest|auth|storage|functions|realtime)\/v1(?:\/.*)?$/i, '');
    return url.origin + prefix.replace(/\/+$/, '');
  } catch {
    return undefined;
  }
}
export const studioUrl = projectBase(configuredUrl);
export const isSupabaseConfigured = Boolean(
  studioUrl && !studioUrl.includes('your-project-id') && publicKey
);
// Bad or partial real configuration is a connection error, not permission to show sample stock.
export const showCampaignPreview =
  (!configuredUrl && !publicKey) || Boolean(configuredUrl?.includes('your-project-id'));
// Storefront queries always use the public role, even when staff visit the shop in the same browser.
export const supabase = isSupabaseConfigured
  ? createClient(studioUrl!, publicKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'tws-storefront',
      },
    })
  : null;
