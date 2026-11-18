import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { customerClient } from '../lib/customerClient';

export interface CustomerProfile {
  id: string;
  email: string;
  fullName: string;
  createdAt: string | null;
}

interface SignUpResult {
  error: string | null;
  needsEmailConfirmation?: boolean;
  email?: string;
}

interface CustomerAuthValue {
  customer: CustomerProfile | null;
  loading: boolean;
  available: boolean;
  signUp: (params: { fullName: string; email: string; password: string }) => Promise<SignUpResult>;
  signIn: (params: { email: string; password: string }) => Promise<{ error: string | null }>;
  signOut: () => Promise<{ error: string | null }>;
}

const CustomerAuthContext = createContext<CustomerAuthValue | undefined>(undefined);

const STORAGE_KEY = 'tws-customer-auth';

function hasStoredCustomerSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
}

function extractNameFromMetadata(meta: Record<string, unknown> | undefined | null): string {
  if (!meta || typeof meta !== 'object') return '';
  const candidates = [
    meta.full_name,
    meta.name,
    [meta.first_name, meta.last_name]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .join(' '),
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function toSafeProfile(user: {
  id: string;
  email?: string | null;
  created_at?: string | null;
  user_metadata?: Record<string, unknown>;
} | null | undefined): CustomerProfile | null {
  if (!user?.id || !user.email) return null;
  return {
    id: user.id,
    email: user.email.trim().toLowerCase(),
    fullName: extractNameFromMetadata(user.user_metadata),
    createdAt: user.created_at ?? null,
  };
}

/** Syncs the authenticated customer's profile row in public.customers as a
 * companion to the auth.users trigger. Silently ignores PGRST202 on
 * deployments where migration 008 has not been applied yet. */
async function syncCustomerDirectory(preferredName?: string): Promise<string | null> {
  if (!customerClient) return null;
  try {
    const { data, error } = await customerClient.rpc('register_customer_account', {
      p_full_name: preferredName?.trim() || null,
    });
    if (error) {
      if (error.code !== 'PGRST202') {
        console.warn('Customer profile sync skipped:', error.message);
      }
      return null;
    }
    if (data && typeof data === 'object' && 'full_name' in data && typeof data.full_name === 'string') {
      return data.full_name.trim() || null;
    }
  } catch {
    // Non-fatal: auth.users already holds the registered customer account.
  }
  return null;
}

export function CustomerAuthProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(() => Boolean(customerClient) && hasStoredCustomerSession());
  const syncedUid = useRef<string | null>(null);

  useEffect(() => {
    if (!customerClient) {
      setLoading(false);
      return;
    }

    let mounted = true;
    let syncTimer: number | undefined;

    const { data: listener } = customerClient.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const profile = toSafeProfile(session?.user);
      setCustomer(profile);
      setLoading(false);

      window.clearTimeout(syncTimer);
      if (profile && syncedUid.current !== profile.id) {
        syncedUid.current = profile.id;
        syncTimer = window.setTimeout(() => {
          void syncCustomerDirectory(profile.fullName).then((syncedName) => {
            if (!mounted || !syncedName) return;
            setCustomer((prev) =>
              prev && prev.id === profile.id && !prev.fullName ? { ...prev, fullName: syncedName } : prev
            );
          });
        }, 0);
      } else if (!profile) {
        syncedUid.current = null;
      }
    });

    return () => {
      mounted = false;
      window.clearTimeout(syncTimer);
      listener.subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(
    async ({ fullName, email, password }: { fullName: string; email: string; password: string }): Promise<SignUpResult> => {
      if (!customerClient) {
        return { error: 'Account registration is unavailable while the studio is offline.' };
      }
      const cleanName = fullName.trim();
      const cleanEmail = email.trim().toLowerCase();

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return { error: 'Enter a valid email address.' };
      }
      if (password.length < 8) {
        return { error: 'Use a password with at least 8 characters.' };
      }

      const { data, error } = await customerClient.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: cleanName ? { full_name: cleanName, name: cleanName } : {},
        },
      });

      if (error) {
        return { error: error.message || 'Could not create your account. Please try again.' };
      }

      // Supabase returns an empty identities array when an address is already registered
      // under email-confirmation protection.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        return { error: 'An account with this email already exists. Please sign in instead.' };
      }

      if (!data.user) {
        return { error: 'Registration could not be confirmed. Please try again.' };
      }

      if (data.session) {
        syncedUid.current = data.user.id;
        const syncedName = await syncCustomerDirectory(cleanName);
        const base = toSafeProfile(data.user);
        if (base) {
          setCustomer({
            ...base,
            fullName: base.fullName || cleanName || syncedName || '',
          });
        }
        return { error: null, email: cleanEmail };
      }

      return {
        error: null,
        needsEmailConfirmation: true,
        email: cleanEmail,
      };
    },
    []
  );

  const signIn = useCallback(
    async ({ email, password }: { email: string; password: string }): Promise<{ error: string | null }> => {
      if (!customerClient) {
        return { error: 'Sign in is unavailable while the studio is offline.' };
      }
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !password) {
        return { error: 'Enter your email address and password.' };
      }

      const { data, error } = await customerClient.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        const message = error.message.toLowerCase().includes('invalid login')
          ? 'Incorrect email or password.'
          : error.message;
        return { error: message };
      }

      const profile = toSafeProfile(data.user);
      if (profile) {
        syncedUid.current = profile.id;
        setCustomer(profile);
        const syncedName = await syncCustomerDirectory(profile.fullName);
        if (syncedName && !profile.fullName) {
          setCustomer((prev) => (prev && prev.id === profile.id ? { ...prev, fullName: syncedName } : prev));
        }
      }

      return { error: null };
    },
    []
  );

  const signOut = useCallback(async (): Promise<{ error: string | null }> => {
    syncedUid.current = null;
    if (customerClient) {
      const { error } = await customerClient.auth.signOut({ scope: 'local' });
      if (error) return { error: error.message };
    }
    setCustomer(null);
    return { error: null };
  }, []);

  return (
    <CustomerAuthContext.Provider
      value={{
        customer,
        loading,
        available: Boolean(customerClient),
        signUp,
        signIn,
        signOut,
      }}
    >
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error('useCustomerAuth must be used within CustomerAuthProvider');
  return ctx;
}
