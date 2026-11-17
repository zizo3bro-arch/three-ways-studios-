import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

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
      setIsAdmin(false);
      return false;
    }

    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('id')
        .eq('id', uid)
        .maybeSingle();

      const ok = !error && Boolean(data?.id);
      setIsAdmin(ok);
      return ok;
    } catch {
      setIsAdmin(false);
      return false;
    }
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

      const ok = await verifyAdmin(next.user.id);
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

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      void applySession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!mounted) return;
      void applySession(next);
    });

    return () => {
      mounted = false;
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
      const message =
        error.message.toLowerCase().includes('invalid login')
          ? 'That email and password do not match a studio account.'
          : error.message;
      return { error: message };
    }

    const ok = await verifyAdmin(data.user?.id);
    if (!ok) {
      await supabase.auth.signOut();
      return {
        error:
          'This account is authenticated but is not registered as studio staff (no row in public.admin_users).',
      };
    }

    return { error: null };
  };

  const signOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
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
