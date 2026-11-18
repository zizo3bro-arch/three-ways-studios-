import { createClient } from '@supabase/supabase-js';

export const studioUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const publicKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const isSupabaseConfigured = Boolean(
  studioUrl && /^https?:\/\//.test(studioUrl) && !studioUrl.includes('your-project-id') && publicKey
);
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
