import { createClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, publicKey, studioUrl } from './supabase';

/** Dedicated customer account client for the public storefront.
 * Uses its own storage key so customer sessions are strictly isolated from
 * both the anonymous catalog client (`supabase`) and the `/admin` console
 * client (`adminClient`). A staff login never appears in the customer panel,
 * and a customer account never grants console access. */
export const customerClient = isSupabaseConfigured
  ? createClient(studioUrl!, publicKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'tws-customer-auth',
      },
    })
  : null;
