import { createClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, studioUrl, publicKey } from './supabase';

// Only imported by the lazy /admin tree. Keep the original auth storage key
// and the user's existing session. Permissions come from Supabase Auth + RLS.
export const adminClient = isSupabaseConfigured
  ? createClient(studioUrl!, publicKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null;
