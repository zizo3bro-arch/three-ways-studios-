import { useEffect, useState } from 'react';
import { Check, Save } from 'lucide-react';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { supabase } from '../../lib/supabase';
import type { SiteSettings } from '../../types/database';

export function AdminContentTab() {
  const { settings, refreshSettings } = useSiteSettings();
  const [form, setForm] = useState<SiteSettings>(settings);
  const [navJson, setNavJson] = useState(JSON.stringify(settings.nav_links, null, 2));
  const [footerJson, setFooterJson] = useState(JSON.stringify(settings.footer_links, null, 2));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(settings);
    setNavJson(JSON.stringify(settings.nav_links, null, 2));
    setFooterJson(JSON.stringify(settings.footer_links, null, 2));
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setError(null);

    let parsedNav = form.nav_links;
    let parsedFooter = form.footer_links;
    try {
      parsedNav = JSON.parse(navJson);
      parsedFooter = JSON.parse(footerJson);
    } catch {
      setError('Navigation or footer links JSON is invalid.');
      return;
    }

    setSaving(true);
    const { error: updErr } = await supabase.from('site_settings').upsert({
      ...form,
      id: 'default',
      nav_links: parsedNav,
      footer_links: parsedFooter,
    });
    setSaving(false);

    if (updErr) {
      setError(updErr.message);
      return;
    }

    await refreshSettings();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 border border-white/12 bg-black/45 p-6">
      <div>
        <h2 className="text-sm font-medium tracking-[0.2em] text-white uppercase">
          Website Content &amp; Editorial Copy
        </h2>
        <p className="mt-1 text-xs text-[#9e9494]">
          Update hero typography, collection labels, navigation, newsletter, and footer copy live.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[10px] tracking-[0.16em] text-[#9e9494] uppercase">
            Hero Blurred Background Text
          </label>
          <input
            type="text"
            value={form.hero_bg_text}
            onChange={(e) => setForm({ ...form, hero_bg_text: e.target.value })}
            className="w-full border border-white/15 bg-black/50 px-3 py-2 text-xs text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] tracking-[0.16em] text-[#9e9494] uppercase">
            Hero Handwritten Script Text
          </label>
          <input
            type="text"
            value={form.hero_script_text}
            onChange={(e) => setForm({ ...form, hero_script_text: e.target.value })}
            className="w-full border border-white/15 bg-black/50 px-3 py-2 text-xs text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] tracking-[0.16em] text-[#9e9494] uppercase">
            Hero Tagline
          </label>
          <input
            type="text"
            value={form.hero_tagline}
            onChange={(e) => setForm({ ...form, hero_tagline: e.target.value })}
            className="w-full border border-white/15 bg-black/50 px-3 py-2 text-xs text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] tracking-[0.16em] text-[#9e9494] uppercase">
            Hero Collection Label
          </label>
          <input
            type="text"
            value={form.hero_collection_label}
            onChange={(e) => setForm({ ...form, hero_collection_label: e.target.value })}
            className="w-full border border-white/15 bg-black/50 px-3 py-2 text-xs text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] tracking-[0.16em] text-[#9e9494] uppercase">
            Hero CTA Button Label
          </label>
          <input
            type="text"
            value={form.hero_cta_label}
            onChange={(e) => setForm({ ...form, hero_cta_label: e.target.value })}
            className="w-full border border-white/15 bg-black/50 px-3 py-2 text-xs text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] tracking-[0.16em] text-[#9e9494] uppercase">
            Products Section Subheading
          </label>
          <input
            type="text"
            value={form.products_subheading}
            onChange={(e) => setForm({ ...form, products_subheading: e.target.value })}
            className="w-full border border-white/15 bg-black/50 px-3 py-2 text-xs text-white"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-[10px] tracking-[0.16em] text-[#9e9494] uppercase">
            Newsletter Copy
          </label>
          <input
            type="text"
            value={form.newsletter_text}
            onChange={(e) => setForm({ ...form, newsletter_text: e.target.value })}
            className="w-full border border-white/15 bg-black/50 px-3 py-2 text-xs text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] tracking-[0.16em] text-[#9e9494] uppercase">
            Footer Tagline
          </label>
          <input
            type="text"
            value={form.footer_tagline}
            onChange={(e) => setForm({ ...form, footer_tagline: e.target.value })}
            className="w-full border border-white/15 bg-black/50 px-3 py-2 text-xs text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] tracking-[0.16em] text-[#9e9494] uppercase">
            Copyright Line
          </label>
          <input
            type="text"
            value={form.copyright_text}
            onChange={(e) => setForm({ ...form, copyright_text: e.target.value })}
            className="w-full border border-white/15 bg-black/50 px-3 py-2 text-xs text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] tracking-[0.16em] text-[#9e9494] uppercase">
            Header Navigation Links (JSON)
          </label>
          <textarea
            rows={5}
            value={navJson}
            onChange={(e) => setNavJson(e.target.value)}
            className="w-full border border-white/15 bg-black/50 px-3 py-2 font-mono text-[11px] text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] tracking-[0.16em] text-[#9e9494] uppercase">
            Footer Links (JSON)
          </label>
          <textarea
            rows={5}
            value={footerJson}
            onChange={(e) => setFooterJson(e.target.value)}
            className="w-full border border-white/15 bg-black/50 px-3 py-2 font-mono text-[11px] text-white"
          />
        </div>
      </div>

      {error && <p className="text-xs text-[#ff7575]">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-full bg-[#b30e16] px-6 py-2.5 text-xs font-medium tracking-[0.18em] text-white uppercase hover:bg-[#d4121b]"
      >
        {saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
        {saving ? 'Saving...' : saved ? 'Saved Live' : 'Publish Website Copy'}
      </button>
    </form>
  );
}
