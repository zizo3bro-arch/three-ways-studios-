import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/* =========================================================
   UI shell state — one owner for every overlay so the navbar, the
   bag, search, the account panel and quick view stay in sync
   (only one shell overlay at a time; Escape / scroll-lock are
   handled inside <Overlay />).

   Quick view is URL-driven (?piece=slug) so it is linkable,
   survives refresh, and the browser back button closes it.
   ========================================================= */

export type ShellOverlay = 'search' | 'account' | 'menu';

interface UIContextValue {
  overlay: ShellOverlay | null;
  openOverlay: (name: ShellOverlay) => void;
  closeOverlay: () => void;
  quickViewSlug: string;
  openQuickView: (slug: string) => void;
  closeQuickView: () => void;
}

const UIContext = createContext<UIContextValue | undefined>(undefined);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [overlay, setOverlay] = useState<ShellOverlay | null>(null);
  const [params, setParams] = useSearchParams();
  const quickViewSlug = params.get('piece') ?? '';

  const closeOverlay = useCallback(() => setOverlay(null), []);
  const openOverlay = useCallback((name: ShellOverlay) => setOverlay(name), []);
  const openQuickView = useCallback(
    (slug: string) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set('piece', slug);
          return next;
        },
        { preventScrollReset: true }
      );
    },
    [setParams]
  );

  const closeQuickView = useCallback(() => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete('piece');
        return next;
      },
      { replace: true, preventScrollReset: true }
    );
  }, [setParams]);

  // opening the mobile menu should never leave another overlay behind
  useEffect(() => {
    if (quickViewSlug && overlay) closeQuickView();
  }, [overlay, quickViewSlug, closeQuickView]);

  const value = useMemo(
    () => ({
      overlay,
      openOverlay,
      closeOverlay,
      quickViewSlug,
      openQuickView,
      closeQuickView,
    }),
    [overlay, openOverlay, closeOverlay, quickViewSlug, openQuickView, closeQuickView]
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
}
