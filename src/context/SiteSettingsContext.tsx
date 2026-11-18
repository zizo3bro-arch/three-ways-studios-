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
  products_heading: 'Our collections',
  products_subheading: 'View all collections',
  newsletter_text: 'Stay in the loop',
  footer_tagline: 'Independent streetwear. Cairo, Egypt.',
  copyright_text: '© 2026 Three Ways Studios. All rights reserved.',
  nav_links: [
    { label: 'SHOP', path: '/shop' },
    { label: 'COLLECTIONS', path: '/collections' },
  ],
  footer_links: [
    { label: 'Shop', path: '/shop' },
    { label: 'Collections', path: '/collections' },
    { label: 'Size Guide', path: '/about#fit' },
    { label: 'Shipping & Returns', path: '/about#service' },
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
  error: string | null;
  refreshSettings: () => Promise<void>;
}

const SiteSettingsContext = createContext<SiteSettingsContextValue>({
  settings: DEFAULT_SITE_SETTINGS,
  loading: false,
  error: null,
  refreshSettings: async () => {},
});

export function SiteSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  const fetchSettings = async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('*')
        .eq('id', 'default')
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setSettings({
          ...DEFAULT_SITE_SETTINGS,
          ...data,
          // Translate the original seed copy, not the merchant's custom text.
          products_heading:
            !data.products_heading || ['Products', 'Two patterns'].includes(data.products_heading)
              ? DEFAULT_SITE_SETTINGS.products_heading
              : data.products_heading,
          products_subheading:
            !data.products_subheading ||
            ['EXPLORE OUR LATEST COLLECTION', 'one obsession'].includes(data.products_subheading)
              ? DEFAULT_SITE_SETTINGS.products_subheading
              : data.products_subheading,
          newsletter_text:
            !data.newsletter_text ||
            [
              'Subscribe to our newsletter and get exclusive offers.',
              'Early access to the cut, the fitting notes, and 10% off your first pair.',
            ].includes(data.newsletter_text)
              ? DEFAULT_SITE_SETTINGS.newsletter_text
              : data.newsletter_text,
          footer_tagline:
            !data.footer_tagline || data.footer_tagline === 'WEAR THE DIFFERENCE.'
              ? DEFAULT_SITE_SETTINGS.footer_tagline
              : data.footer_tagline,
          nav_links: Array.isArray(data.nav_links) ? data.nav_links : DEFAULT_SITE_SETTINGS.nav_links,
          footer_links: Array.isArray(data.footer_links)
            ? data.footer_links
            : DEFAULT_SITE_SETTINGS.footer_links,
          social_links: data.social_links || DEFAULT_SITE_SETTINGS.social_links,
        });
      }
    } catch (error) {
      console.error('Could not load studio settings:', error);
      setError('Could not load the saved studio settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <SiteSettingsContext.Provider value={{ settings, loading, error, refreshSettings: fetchSettings }}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext);
}
