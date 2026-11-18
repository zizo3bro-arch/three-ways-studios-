import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured } from '../lib/supabase';
import { adminClient as supabase } from '../lib/adminClient';

/* =========================================================
   AUTH — Supabase Auth, unchanged in substance.

   The admin check is a read of public.admin_users under RLS
   ("auth.uid() = id OR public.is_admin()"), so:
     · a signed-in customer gets no row back and is not staff;
     · a stranger with the anon key cannot read the table;
     · revoking access is a DELETE from admin_users, and the next
       page load drops the session's admin claim.

   No credential is stored in this file. There is no allow-list,
   no email constant, and no fallback password anywhere in the
   client bundle — the email/password pair lives in Supabase Auth
   and the environment, never in Git.
   ========================================================= */

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  // guards against a late resolve repainting state for a superseded session
  const checkId = useRef(0);

  const verifyAdmin = useCallback(async (uid: string | undefined) => {
    if (!supabase || !uid) {
      return false;
    }

    const { data, error } = await supabase.from('admin_users').select('id').eq('id', uid).maybeSingle();
    if (error) throw error;
    return data?.id === uid;
  }, []);

  const applySession = useCallback(
    async (next: Session | null) => {
      const myCheck = ++checkId.current;
      setSession(next);
      setUser(next?.user ?? null);

      if (!next?.user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      let ok = false;
      try {
        ok = await verifyAdmin(next.user.id);
      } catch (error) {
        console.error('Staff membership check failed:', error);
      }
      // a newer session event has already claimed the state
      if (myCheck !== checkId.current) return;
      setIsAdmin(ok);
      setLoading(false);
    },
    [verifyAdmin]
  );

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    let timer: number | undefined;
    let lastUid: string | undefined;
    // INITIAL_SESSION is emitted on subscription. Postpone the database read
    // until the auth callback has released the Supabase session lock.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!mounted) return;
      ++checkId.current;
      clearTimeout(timer);
      if (next?.user.id !== lastUid || !next) {
        setIsAdmin(false);
        setLoading(Boolean(next));
        setUser(next?.user ?? null);
        setSession(next);
      }
      lastUid = next?.user.id;
      timer = window.setTimeout(() => {
        if (mounted) void applySession(next);
      }, 0);
    });

    return () => {
      mounted = false;
      ++checkId.current;
      clearTimeout(timer);
      listener.subscription.unsubscribe();
    };
  }, [applySession]);

  const signIn = async (email: string, password: string) => {
    if (!supabase) {
      return {
        error:
          'The studio backend is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the deployment environment.',
      };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      // never echo provider wording that hints at account existence
      const message = error.message.toLowerCase().includes('invalid login')
        ? 'That email and password do not match a studio account.'
        : error.message;
      return { error: message };
    }

    let denial = 'This account is not authorised for the studio console.';
    try {
      if (await verifyAdmin(data.user?.id)) return { error: null };
    } catch (error) {
      console.error('Staff membership check failed:', error);
      denial = 'Unable to verify staff access. Please try again.';
    }
    const { error: logoutError } = await supabase.auth.signOut({ scope: 'local' });
    if (logoutError) console.error('Unable to end unverified session:', logoutError.message);
    return { error: denial };
  };

  const signOut = async () => {
    if (supabase) {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    }
    checkId.current += 1;
    setIsAdmin(false);
    setSession(null);
    setUser(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ session, user, isAdmin, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
