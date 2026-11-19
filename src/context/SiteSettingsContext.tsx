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
  // 013 — website control. These are the values a fresh installation starts
  // with; every one of them is editable in the Studio Console.
  hero_cta_href: '/shop',
  hero_image_url: '',
  newsletter_description:
    'Submit your email address for early release notes and a one-time 10% discount at checkout.',
  newsletter_cta_label: 'Subscribe',
  contact_email: '',
  contact_phone: '',
  whatsapp_url: '',
  announcement_text: '',
  announcement_enabled: false,
  social_channels: [
    { key: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/threewaysstudios', enabled: true },
    { key: 'tiktok', label: 'TikTok', url: 'https://www.tiktok.com/@threewaysstudios', enabled: true },
    { key: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/@threewaysstudios', enabled: true },
    { key: 'x', label: 'X / Twitter', url: 'https://www.twitter.com/threewaysstudio', enabled: true },
    { key: 'facebook', label: 'Facebook', url: '', enabled: false },
    { key: 'whatsapp', label: 'WhatsApp', url: '', enabled: false },
  ],
  content_blocks: {},
  home_collection_mode: 'catalog',
  home_collection_limit: 24,
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
          social_channels:
            Array.isArray(data.social_channels) && data.social_channels.length
              ? (data.social_channels as SiteSettings['social_channels'])
              : DEFAULT_SITE_SETTINGS.social_channels,
          content_blocks:
            data.content_blocks && typeof data.content_blocks === 'object'
              ? (data.content_blocks as Record<string, string>)
              : {},
          home_collection_mode:
            data.home_collection_mode === 'featured' ? 'featured' : 'catalog',
          home_collection_limit: Number.isFinite(Number(data.home_collection_limit))
            ? Number(data.home_collection_limit)
            : DEFAULT_SITE_SETTINGS.home_collection_limit,
          hero_cta_href: data.hero_cta_href || DEFAULT_SITE_SETTINGS.hero_cta_href,
          hero_image_url: data.hero_image_url ?? '',
          newsletter_description:
            data.newsletter_description || DEFAULT_SITE_SETTINGS.newsletter_description,
          newsletter_cta_label:
            data.newsletter_cta_label || DEFAULT_SITE_SETTINGS.newsletter_cta_label,
          contact_email: data.contact_email ?? '',
          contact_phone: data.contact_phone ?? '',
          whatsapp_url: data.whatsapp_url ?? '',
          announcement_text: data.announcement_text ?? '',
          announcement_enabled: Boolean(data.announcement_enabled),
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

/**
 * Reads one editable storefront string. The default is always the studio's own
 * published copy, so a missing or empty field can never render a blank label.
 */
export function useContentBlock(key: string, fallback: string) {
  const { settings } = useSiteSettings();
  const value = settings.content_blocks?.[key];
  return typeof value === 'string' && value.trim() ? value : fallback;
}
