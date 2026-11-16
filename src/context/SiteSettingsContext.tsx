import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { SiteSettings } from '../types/database';

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  id: 'default',
  hero_bg_text: 'THREE WAYS',
  hero_script_text: 'Three Ways Studios',
  hero_tagline: 'FASHION BEYOND LIMITS.',
  hero_collection_label: 'NEW COLLECTION / 2026',
  hero_cta_label: 'SHOP NOW',
  products_heading: 'Two patterns',
  products_subheading: 'one obsession',
  newsletter_text: 'Early access to the cut, the fitting notes, and 10% off your first pair.',
  footer_tagline: 'A Cairo house cutting wide-flare denim in small runs. Fashion beyond limits — one silhouette at a time.',
  copyright_text: '© 2026 Three Ways Studios. All rights reserved.',
  nav_links: [
    { label: 'SHOP', path: '/shop' },
    { label: 'COLLECTIONS', path: '/collections' },
    { label: 'ABOUT', path: '/about' },
    { label: 'JOURNAL', path: '/journal' },
  ],
  footer_links: [
    { label: 'All pieces', path: '/shop' },
    { label: 'Collections', path: '/collections' },
    { label: 'The house', path: '/about' },
    { label: 'Journal', path: '/journal' },
  ],
  social_links: {
    instagram: 'https://www.instagram.com/threewaysstudios',
    tiktok: 'https://www.tiktok.com/@threewaysstudios',
    youtube: 'https://www.youtube.com/@threewaysstudios',
    x: 'https://www.twitter.com/threewaysstudio',
  },
};

interface SiteSettingsContextValue {
  settings: SiteSettings;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const SiteSettingsContext = createContext<SiteSettingsContextValue>({
  settings: DEFAULT_SITE_SETTINGS,
  loading: false,
  refreshSettings: async () => {},
});

export function SiteSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [loading, setLoading] = useState(Boolean(supabase));

  const fetchSettings = async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('*')
        .eq('id', 'default')
        .maybeSingle();

      if (!error && data) {
        setSettings({
          ...DEFAULT_SITE_SETTINGS,
          ...data,
          nav_links: Array.isArray(data.nav_links) ? data.nav_links : DEFAULT_SITE_SETTINGS.nav_links,
          footer_links: Array.isArray(data.footer_links)
            ? data.footer_links
            : DEFAULT_SITE_SETTINGS.footer_links,
          social_links: data.social_links || DEFAULT_SITE_SETTINGS.social_links,
        });
      }
    } catch {
      // Keep default copy if table isn't initialized yet
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <SiteSettingsContext.Provider value={{ settings, loading, refreshSettings: fetchSettings }}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext);
}
