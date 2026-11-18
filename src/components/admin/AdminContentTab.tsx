import { useEffect, useState } from 'react';
import { Check, Save } from 'lucide-react';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { adminClient as supabase } from '../../lib/adminClient';
import type { SiteSettings } from '../../types/database';

export function AdminContentTab() {
  const { settings, loading, error: readError, refreshSettings } = useSiteSettings();
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
    if (!supabase || loading || readError) return;
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

    if (
      ![parsedNav, parsedFooter].every(
        (list) =>
          Array.isArray(list) &&
          list.every((item) => item && typeof item.path === 'string' && typeof item.label === 'string')
      )
    ) {
      setError('Links must be arrays of { label, path } entries.');
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

  if (readError)
    return (
      <p role="alert" className="form-note">
        {readError}{' '}
        <button className="text-action" onClick={refreshSettings}>
          Retry
        </button>
      </p>
    );
  return (
    <form onSubmit={handleSave} className="space-y-6 border border-ink/12 p-6">
      <div>
        <h2 className="text-sm font-medium tracking-[0.2em] text-ink uppercase">
          Website Content &amp; Editorial Copy
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          Update hero typography, collection labels, navigation, newsletter, and footer copy live.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[10px] tracking-[0.16em] text-ink-faint uppercase">
            Hero Blurred Background Text
          </label>
          <input
            type="text"
            value={form.hero_bg_text}
            onChange={(e) => setForm({ ...form, hero_bg_text: e.target.value })}
            className="w-full border border-ink/15 bg-paper/50 px-3 py-2 text-xs text-ink"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] tracking-[0.16em] text-ink-faint uppercase">
            Hero Handwritten Script Text
          </label>
          <input
            type="text"
            value={form.hero_script_text}
            onChange={(e) => setForm({ ...form, hero_script_text: e.target.value })}
            className="w-full border border-ink/15 bg-paper/50 px-3 py-2 text-xs text-ink"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] tracking-[0.16em] text-ink-faint uppercase">
            Hero Tagline
          </label>
          <input
            type="text"
            value={form.hero_tagline}
            onChange={(e) => setForm({ ...form, hero_tagline: e.target.value })}
            className="w-full border border-ink/15 bg-paper/50 px-3 py-2 text-xs text-ink"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] tracking-[0.16em] text-ink-faint uppercase">
            Hero Collection Label
          </label>
          <input
            type="text"
            value={form.hero_collection_label}
            onChange={(e) => setForm({ ...form, hero_collection_label: e.target.value })}
            className="w-full border border-ink/15 bg-paper/50 px-3 py-2 text-xs text-ink"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] tracking-[0.16em] text-ink-faint uppercase">
            Hero CTA Button Label
          </label>
          <input
            type="text"
            value={form.hero_cta_label}
            onChange={(e) => setForm({ ...form, hero_cta_label: e.target.value })}
            className="w-full border border-ink/15 bg-paper/50 px-3 py-2 text-xs text-ink"
          />
        </div>
        <label className="block text-[10px] uppercase tracking-[0.16em] text-ink-faint">
          Collections heading
          <input
            value={form.products_heading}
            onChange={(e) => setForm({ ...form, products_heading: e.target.value })}
            className="mt-1 w-full border border-ink/15 bg-paper/50 px-3 py-2 text-xs text-ink"
          />
        </label>
        <div>
          <label className="mb-1 block text-[10px] tracking-[0.16em] text-ink-faint uppercase">
            Collections Link Label
          </label>
          <input
            type="text"
            value={form.products_subheading}
            onChange={(e) => setForm({ ...form, products_subheading: e.target.value })}
            className="w-full border border-ink/15 bg-paper/50 px-3 py-2 text-xs text-ink"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-[10px] tracking-[0.16em] text-ink-faint uppercase">
            Newsletter Heading
          </label>
          <input
            type="text"
            value={form.newsletter_text}
            onChange={(e) => setForm({ ...form, newsletter_text: e.target.value })}
            className="w-full border border-ink/15 bg-paper/50 px-3 py-2 text-xs text-ink"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] tracking-[0.16em] text-ink-faint uppercase">
            Footer Tagline
          </label>
          <input
            type="text"
            value={form.footer_tagline}
            onChange={(e) => setForm({ ...form, footer_tagline: e.target.value })}
            className="w-full border border-ink/15 bg-paper/50 px-3 py-2 text-xs text-ink"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] tracking-[0.16em] text-ink-faint uppercase">
            Copyright Line
          </label>
          <input
            type="text"
            value={form.copyright_text}
            onChange={(e) => setForm({ ...form, copyright_text: e.target.value })}
            className="w-full border border-ink/15 bg-paper/50 px-3 py-2 text-xs text-ink"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] tracking-[0.16em] text-ink-faint uppercase">
            Header Navigation Links (JSON)
          </label>
          <textarea
            rows={5}
            value={navJson}
            onChange={(e) => setNavJson(e.target.value)}
            className="w-full border border-ink/15 bg-paper/50 px-3 py-2 font-mono text-[11px] text-ink"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] tracking-[0.16em] text-ink-faint uppercase">
            Footer Links (JSON)
          </label>
          <textarea
            rows={5}
            value={footerJson}
            onChange={(e) => setFooterJson(e.target.value)}
            className="w-full border border-ink/15 bg-paper/50 px-3 py-2 font-mono text-[11px] text-ink"
          />
        </div>
      </div>

      {error && <p className="text-xs text-crimson-deep">{error}</p>}

      <button
        type="submit"
        disabled={saving || loading}
        className="inline-flex items-center gap-2 rounded-full bg-crimson px-6 py-2.5 text-xs font-medium tracking-[0.18em] text-paper uppercase hover:bg-crimson-deep"
      >
        {saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
        {saving ? 'Saving...' : saved ? 'Saved Live' : 'Publish Website Copy'}
      </button>
    </form>
  );
}
