import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  ImagePlus,
  Link2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { adminClient as supabase } from '../../lib/adminClient';
import {
  isValidDestination,
  isValidEmail,
  isValidHttpsUrl,
  isValidPhone,
} from '../../lib/links';
import type { NavLinkItem, SiteSettings, SocialChannel } from '../../types/database';

/* =========================================================
   WEBSITE CONTENT — a real CMS, organised by page section.

   · Every field has a plain-language name, a one-line explanation and a
     validation rule; nothing is raw JSON and nothing is a technical label.
   · Edits live in a draft. "Unsaved changes" is explicit, and Discard restores
     the last saved copy in one click.
   · A preview shows the hero, navigation and footer exactly as the draft will
     render, before publishing.
   · The same server-side URL rules the storefront uses are applied here, so an
     invalid destination is caught before it reaches a customer.
   ========================================================= */

type FieldKind = 'text' | 'textarea' | 'number' | 'select';

interface TextField {
  key: keyof SiteSettings;
  label: string;
  hint: string;
  kind?: FieldKind;
  options?: Array<{ value: string; label: string }>;
  maxLength?: number;
  validate?: (value: string) => string | null;
  multiline?: boolean;
}

interface Section {
  id: string;
  title: string;
  description: string;
  fields: TextField[];
}

const SECTIONS: Section[] = [
  {
    id: 'hero',
    title: 'Homepage hero',
    description: 'The first screen: the painted wordmark, the signature, the copy and the button.',
    fields: [
      {
        key: 'hero_bg_text',
        label: 'Large background wordmark',
        hint: 'Painted across the top of the homepage. Two words read best.',
        maxLength: 40,
        validate: (v) => (v.trim() ? null : 'Enter the wordmark text.'),
      },
      {
        key: 'hero_script_text',
        label: 'Handwritten signature line',
        hint: 'Leave as "Three Ways Studios" to use the studio signature artwork.',
        maxLength: 60,
      },
      {
        key: 'hero_tagline',
        label: 'Tagline',
        hint: 'The stacked statement under the hero, e.g. "Fashion beyond limits."',
        maxLength: 80,
      },
      {
        key: 'hero_collection_label',
        label: 'Collection label',
        hint: 'Sits on the right of the hero, above the button.',
        maxLength: 60,
      },
      {
        key: 'hero_cta_label',
        label: 'Button label',
        hint: 'What the hero button says.',
        maxLength: 32,
      },
      {
        key: 'hero_cta_href',
        label: 'Button destination',
        hint: 'A site path such as /shop or /collections, or a full https link.',
        validate: (v) =>
          isValidDestination(v) ? null : 'Use a path that starts with / or a full https:// link.',
      },
    ],
  },
  {
    id: 'collection',
    title: 'Homepage collection rail',
    description: 'The "Our collections" strip: its heading, its link and which pieces it shows.',
    fields: [
      {
        key: 'products_heading',
        label: 'Section heading',
        hint: 'Shown in the ruled heading above the product plates.',
        maxLength: 60,
      },
      {
        key: 'products_subheading',
        label: 'Link label',
        hint: 'The "view all" link on the right of the heading.',
        maxLength: 60,
      },
      {
        key: 'home_collection_mode',
        label: 'Which pieces to show',
        hint: 'The whole published catalogue, or only pieces marked "Featured" in Products.',
        kind: 'select',
        options: [
          { value: 'catalog', label: 'All published pieces' },
          { value: 'featured', label: 'Only featured pieces' },
        ],
      },
      {
        key: 'home_collection_limit',
        label: 'Maximum pieces',
        hint: 'Between 1 and 48. The rest stay on /shop.',
        kind: 'number',
        validate: (v) => {
          const n = Number(v);
          return Number.isInteger(n) && n >= 1 && n <= 48 ? null : 'Enter a whole number from 1 to 48.';
        },
      },
    ],
  },
  {
    id: 'newsletter',
    title: 'Newsletter',
    description: 'The email capture section above the footer.',
    fields: [
      {
        key: 'newsletter_text',
        label: 'Heading',
        hint: 'One short invitation, e.g. "Stay in the loop".',
        maxLength: 60,
      },
      {
        key: 'newsletter_description',
        label: 'Description',
        hint: 'Explains what the customer gets. Mention the one-time 10% if you keep it.',
        kind: 'textarea',
        maxLength: 220,
      },
      {
        key: 'newsletter_cta_label',
        label: 'Button label',
        hint: 'e.g. "Subscribe".',
        maxLength: 24,
      },
    ],
  },
  {
    id: 'footer',
    title: 'Footer & contact',
    description: 'The closing line of every page, and how customers reach the studio.',
    fields: [
      {
        key: 'footer_tagline',
        label: 'Footer description',
        hint: 'A short line next to the copyright, e.g. "Independent streetwear. Cairo, Egypt."',
        kind: 'textarea',
        maxLength: 140,
      },
      {
        key: 'copyright_text',
        label: 'Copyright line',
        hint: 'The small print at the very bottom.',
        maxLength: 120,
      },
      {
        key: 'contact_email',
        label: 'Contact email',
        hint: 'Used by the footer "contact" link. Leave empty to keep the Instagram link.',
        validate: (v) => (isValidEmail(v) ? null : 'Enter a valid email address.'),
      },
      {
        key: 'contact_phone',
        label: 'Contact phone',
        hint: 'Shown next to the email. Digits, spaces and + only.',
        validate: (v) => (isValidPhone(v) ? null : 'Enter a phone number such as +20 100 000 0000.'),
      },
    ],
  },
  {
    id: 'messages',
    title: 'Store messages',
    description: 'The announcement strip and the small pieces of copy customers read in empty states.',
    fields: [
      {
        key: 'announcement_text',
        label: 'Announcement text',
        hint: 'A short studio message, e.g. free delivery over EGP 3,500.',
        maxLength: 120,
      },
      {
        key: 'announcement_enabled',
        label: 'Show the announcement',
        hint: 'Switch it off without deleting the text.',
        kind: 'select',
        options: [
          { value: 'false', label: 'Hidden' },
          { value: 'true', label: 'Shown on the storefront' },
        ],
      },
    ],
  },
];

/** Curated storefront copy. Each key is read by the page named in the hint. */
const CONTENT_BLOCKS: Array<{ key: string; label: string; hint: string; fallback: string }> = [
  {
    key: 'cart.empty',
    label: 'Empty bag message',
    hint: 'Shown in the bag drawer and on /cart.',
    fallback: 'Your bag is empty.',
  },
  {
    key: 'shop.empty',
    label: 'No pieces published',
    hint: 'Shown on /shop when nothing matches the filters.',
    fallback: 'No pieces published yet.',
  },
  {
    key: 'account.orders_empty',
    label: 'No orders yet',
    hint: 'Shown in the customer account before the first order.',
    fallback: 'No orders yet.',
  },
  {
    key: 'account.loyalty_note',
    label: 'Rewards card explanation',
    hint: 'The one-line reminder under the loyalty card.',
    fallback: 'Every delivered order stamps a circle. Rewards unlock on the next order.',
  },
  {
    key: 'policy.contact',
    label: 'Policy page contact line',
    hint: 'Shown at the bottom of /terms and /privacy.',
    fallback: 'Three Ways Studios, Cairo, Egypt.',
  },
];

const SOCIAL_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  x: 'X / Twitter',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
};

function cloneSettings(settings: SiteSettings): SiteSettings {
  return {
    ...settings,
    nav_links: settings.nav_links.map((item) => ({ ...item })),
    footer_links: settings.footer_links.map((item) => ({ ...item })),
    social_channels: (settings.social_channels ?? []).map((channel) => ({ ...channel })),
    content_blocks: { ...(settings.content_blocks ?? {}) },
    social_links: { ...settings.social_links },
  };
}

function sameSettings(a: SiteSettings, b: SiteSettings) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function AdminContentTab() {
  const { settings, loading, error: readError, refreshSettings } = useSiteSettings();
  const [draft, setDraft] = useState<SiteSettings>(() => cloneSettings(settings));
  const [baseline, setBaseline] = useState<SiteSettings>(() => cloneSettings(settings));
  const [activeSection, setActiveSection] = useState('hero');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  // Adopt the server copy only when there is nothing unsaved to protect.
  useEffect(() => {
    if (loading) return;
    setBaseline((current) => {
      setDraft((draftValue) => (sameSettings(draftValue, current) ? cloneSettings(settings) : draftValue));
      return cloneSettings(settings);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, loading]);

  const dirty = useMemo(() => !sameSettings(draft, baseline), [draft, baseline]);

  const update = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setSavedAt(null);
    setFieldErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  };

  const updateBlock = (key: string, value: string) => {
    setDraft((current) => ({
      ...current,
      content_blocks: { ...current.content_blocks, [key]: value },
    }));
    setSavedAt(null);
  };

  const validateAll = () => {
    const errors: Record<string, string> = {};
    for (const section of SECTIONS) {
      for (const field of section.fields) {
        if (!field.validate) continue;
        const raw = String(draft[field.key] ?? '');
        const message = field.validate(raw);
        if (message) errors[field.key as string] = message;
      }
    }
    const keys = new Set<string>();
    for (const link of draft.nav_links) {
      const key = link.label.trim().toLowerCase();
      if (!link.label.trim()) errors['nav_links'] = 'Every navigation link needs a label.';
      else if (!isValidDestination(link.path)) errors['nav_links'] = 'Use a path starting with / or an https link.';
      else if (keys.has(key)) errors['nav_links'] = 'Two navigation links share the same label.';
      keys.add(key);
    }
    for (const link of draft.footer_links) {
      if (!link.label.trim()) errors['footer_links'] = 'Every footer link needs a label.';
      else if (!isValidDestination(link.path)) errors['footer_links'] = 'Use a path starting with / or an https link.';
    }
    for (const channel of draft.social_channels) {
      if (channel.enabled && channel.url && !isValidHttpsUrl(channel.url)) {
        errors[`social_${channel.key}`] = 'Enter a full https:// link to this profile.';
      }
      if (channel.enabled && !channel.url) {
        errors[`social_${channel.key}`] = 'Add the profile link, or switch this icon off.';
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || loading || readError) return;
    setError(null);
    if (!validateAll()) {
      setError('Some fields need attention before publishing.');
      return;
    }
    setSaving(true);
    const { id: _ignoredId, updated_at: _ignoredUpdatedAt, ...editable } = draft;
    const payload: Record<string, unknown> = {
      id: 'default',
      ...editable,
      // Keep the legacy flat map in step with the ordered channel list so older
      // storefront builds and the footer fallback keep working.
      social_links: draft.social_channels.reduce<Record<string, string>>((acc, channel) => {
        if (channel.url.trim()) acc[channel.key] = channel.url.trim();
        return acc;
      }, {}),
    };
    const { error: updErr } = await supabase.from('site_settings').upsert(payload);
    setSaving(false);
    if (updErr) {
      setError(updErr.message);
      return;
    }
    await refreshSettings();
    setBaseline(cloneSettings(draft));
    setSavedAt(new Date());
  };

  const handleDiscard = () => {
    setDraft(cloneSettings(baseline));
    setFieldErrors({});
    setError(null);
    setSavedAt(null);
  };

  const handleUploadHeroImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !supabase) return;
    setUploading(true);
    setError(null);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `site/hero-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(path, file, { upsert: false });
      if (uploadError) throw new Error(uploadError.message);
      const { data } = supabase.storage.from('product-images').getPublicUrl(path);
      update('hero_image_url', data.publicUrl);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? `Image upload failed: ${uploadError.message}`
          : 'Image upload failed.'
      );
    } finally {
      setUploading(false);
    }
  };

  if (readError) {
    return (
      <p role="alert" className="form-note">
        {readError}{' '}
        <button className="text-action" onClick={refreshSettings}>
          Retry
        </button>
      </p>
    );
  }

  const section = SECTIONS.find((item) => item.id === activeSection) ?? SECTIONS[0];

  return (
    <form onSubmit={handleSave} className="cms">
      <div className="cms-head">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-ink">Website content</h2>
          <p className="mt-1 max-w-[62ch] text-xs leading-relaxed text-ink-faint">
            Every customer-facing word, image and link, organised by the page it appears on. Nothing
            here touches product data or prices.
          </p>
        </div>
        <div className="cms-status">
          {dirty ? (
            <span className="cms-chip is-dirty" data-testid="cms-unsaved">
              <AlertTriangle className="h-3 w-3" /> Unsaved changes
            </span>
          ) : savedAt ? (
            <span className="cms-chip is-saved" data-testid="cms-saved">
              <Check className="h-3 w-3" /> Published{' '}
              {savedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : (
            <span className="cms-chip">All changes published</span>
          )}
        </div>
      </div>

      <div className="cms-layout">
        {/* section rail */}
        <nav className="cms-rail" aria-label="Content sections">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={item.id === activeSection}
              onClick={() => setActiveSection(item.id)}
              data-testid={`cms-section-${item.id}`}
            >
              {item.title}
            </button>
          ))}
          <button
            type="button"
            aria-current={activeSection === 'navigation'}
            onClick={() => setActiveSection('navigation')}
            data-testid="cms-section-navigation"
          >
            Navigation
          </button>
          <button
            type="button"
            aria-current={activeSection === 'social'}
            onClick={() => setActiveSection('social')}
            data-testid="cms-section-social"
          >
            Social &amp; contact
          </button>
          <button
            type="button"
            aria-current={activeSection === 'copy'}
            onClick={() => setActiveSection('copy')}
            data-testid="cms-section-copy"
          >
            Storefront copy
          </button>
        </nav>

        <div className="cms-panel">
          {/* ——— configured text sections ——— */}
          {SECTIONS.some((item) => item.id === activeSection) ? (
            <>
              <header className="cms-panel-head">
                <h3>{section.title}</h3>
                <p>{section.description}</p>
              </header>
              <div className="cms-fields">
                {section.fields.map((field) => {
                  const value = draft[field.key];
                  const asString =
                    field.key === 'announcement_enabled' ? String(Boolean(value)) : String(value ?? '');
                  const message = fieldErrors[field.key as string];
                  return (
                    <label key={field.key as string} className="cms-field" data-field={field.key as string}>
                      <span className="cms-label">{field.label}</span>
                      <span className="cms-hint">{field.hint}</span>
                      {field.kind === 'textarea' ? (
                        <textarea
                          rows={3}
                          value={asString}
                          maxLength={field.maxLength}
                          onChange={(event) => update(field.key, event.target.value)}
                          className={message ? 'tws-field is-invalid' : 'tws-field'}
                        />
                      ) : field.kind === 'select' ? (
                        <select
                          value={asString}
                          onChange={(event) =>
                            update(
                              field.key,
                              (field.key === 'announcement_enabled'
                                ? event.target.value === 'true'
                                : event.target.value) as never
                            )
                          }
                          className="tws-field"
                        >
                          {field.options?.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.kind === 'number' ? 'number' : 'text'}
                          value={asString}
                          maxLength={field.maxLength}
                          min={field.kind === 'number' ? 1 : undefined}
                          max={field.kind === 'number' ? 48 : undefined}
                          onChange={(event) => update(field.key, event.target.value)}
                          className={message ? 'tws-field is-invalid' : 'tws-field'}
                        />
                      )}
                      {message ? (
                        <span role="alert" className="cms-error">
                          {message}
                        </span>
                      ) : null}
                    </label>
                  );
                })}

                {activeSection === 'hero' ? (
                  <div className="cms-field">
                    <span className="cms-label">Hero image</span>
                    <span className="cms-hint">
                      Optional. A photograph or artwork behind the painted wordmark. Keep it dark or
                      textured — it sits under the type at low opacity.
                    </span>
                    <div className="cms-image">
                      {draft.hero_image_url ? (
                        <img src={draft.hero_image_url} alt="Hero preview" />
                      ) : (
                        <span className="cms-image-empty">No hero image — the paper surface shows through.</span>
                      )}
                      <div className="cms-image-actions">
                        <button
                          type="button"
                          onClick={() => fileInput.current?.click()}
                          disabled={uploading}
                          className="cms-btn"
                        >
                          <ImagePlus className="h-3.5 w-3.5" />
                          {uploading ? 'Uploading…' : draft.hero_image_url ? 'Replace' : 'Upload'}
                        </button>
                        {draft.hero_image_url ? (
                          <button
                            type="button"
                            onClick={() => update('hero_image_url', '')}
                            className="cms-btn is-danger"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                          </button>
                        ) : null}
                      </div>
                      <input
                        ref={fileInput}
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={handleUploadHeroImage}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {/* ——— navigation ——— */}
          {activeSection === 'navigation' ? (
            <>
              <header className="cms-panel-head">
                <h3>Navigation</h3>
                <p>The links in the masthead. Order is the order customers see.</p>
              </header>
              <LinkEditor
                items={draft.nav_links}
                onChange={(items) => update('nav_links', items)}
                label="Masthead link"
                error={fieldErrors['nav_links']}
              />
            </>
          ) : null}

          {/* ——— footer links ——— */}
          {activeSection === 'footer' ? (
            <>
              <header className="cms-panel-head">
                <h3>Footer</h3>
                <p>The closing line of every page, and how customers reach the studio.</p>
              </header>
              <div className="cms-fields">
                {SECTIONS.find((item) => item.id === 'footer')!.fields.map((field) => {
                  const message = fieldErrors[field.key as string];
                  return (
                    <label key={field.key as string} className="cms-field">
                      <span className="cms-label">{field.label}</span>
                      <span className="cms-hint">{field.hint}</span>
                      {field.kind === 'textarea' ? (
                        <textarea
                          rows={2}
                          value={String(draft[field.key] ?? '')}
                          maxLength={field.maxLength}
                          onChange={(event) => update(field.key, event.target.value)}
                          className={message ? 'tws-field is-invalid' : 'tws-field'}
                        />
                      ) : (
                        <input
                          value={String(draft[field.key] ?? '')}
                          maxLength={field.maxLength}
                          onChange={(event) => update(field.key, event.target.value)}
                          className={message ? 'tws-field is-invalid' : 'tws-field'}
                        />
                      )}
                      {message ? (
                        <span role="alert" className="cms-error">
                          {message}
                        </span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
              <LinkEditor
                items={draft.footer_links}
                onChange={(items) => update('footer_links', items)}
                label="Footer link"
                error={fieldErrors['footer_links']}
              />
            </>
          ) : null}

          {/* ——— social & contact ——— */}
          {activeSection === 'social' ? (
            <>
              <header className="cms-panel-head">
                <h3>Social &amp; contact</h3>
                <p>
                  Each icon opens the link you set here. Switch one off to hide it from the site
                  without losing the link.
                </p>
              </header>

              <div className="cms-social">
                {draft.social_channels.map((channel, index) => {
                  const message = fieldErrors[`social_${channel.key}`];
                  return (
                    <div key={channel.key} className="cms-social-row" data-testid={`cms-social-${channel.key}`}>
                      <label className="cms-toggle">
                        <input
                          type="checkbox"
                          checked={channel.enabled}
                          onChange={(event) => {
                            const next: SocialChannel[] = draft.social_channels.map((item, i) =>
                              i === index ? { ...item, enabled: event.target.checked } : item
                            );
                            update('social_channels', next);
                          }}
                        />
                        <span>{SOCIAL_LABELS[channel.key] ?? channel.label}</span>
                      </label>
                      <input
                        type="url"
                        value={channel.url}
                        placeholder={`https://www.${channel.key}.com/threewaysstudios`}
                        aria-label={`${SOCIAL_LABELS[channel.key] ?? channel.label} link`}
                        onChange={(event) => {
                          const next: SocialChannel[] = draft.social_channels.map((item, i) =>
                            i === index ? { ...item, url: event.target.value } : item
                          );
                          update('social_channels', next);
                        }}
                        className={message ? 'tws-field is-invalid' : 'tws-field'}
                      />
                      <span className="cms-social-actions">
                        {channel.url ? (
                          <a
                            href={channel.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="cms-link-preview"
                            title="Open this link in a new tab"
                          >
                            <Link2 className="h-3.5 w-3.5" /> Preview
                          </a>
                        ) : null}
                        <span className={channel.enabled ? 'cms-chip is-saved' : 'cms-chip'}>
                          {channel.enabled ? 'Shown' : 'Hidden'}
                        </span>
                      </span>
                      {message ? (
                        <span role="alert" className="cms-error">
                          {message}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <label className="cms-field">
                <span className="cms-label">WhatsApp link</span>
                <span className="cms-hint">
                  Optional direct chat link, e.g. https://wa.me/201000000000. The icon uses the channel
                  link above when that one is set.
                </span>
                <input
                  value={draft.whatsapp_url}
                  onChange={(event) => update('whatsapp_url', event.target.value)}
                  placeholder="https://wa.me/201000000000"
                  className={
                    draft.whatsapp_url && !isValidHttpsUrl(draft.whatsapp_url)
                      ? 'tws-field is-invalid'
                      : 'tws-field'
                  }
                />
                {draft.whatsapp_url && !isValidHttpsUrl(draft.whatsapp_url) ? (
                  <span role="alert" className="cms-error">
                    Enter a full https:// link.
                  </span>
                ) : null}
              </label>
            </>
          ) : null}

          {/* ——— storefront copy ——— */}
          {activeSection === 'copy' ? (
            <>
              <header className="cms-panel-head">
                <h3>Storefront copy</h3>
                <p>
                  Small, specific sentences customers read on other pages. Leave a field empty to use
                  the studio's original wording.
                </p>
              </header>
              <div className="cms-fields">
                {CONTENT_BLOCKS.map((block) => (
                  <label key={block.key} className="cms-field" data-block={block.key}>
                    <span className="cms-label">{block.label}</span>
                    <span className="cms-hint">{block.hint}</span>
                    <input
                      value={draft.content_blocks?.[block.key] ?? ''}
                      placeholder={block.fallback}
                      maxLength={200}
                      onChange={(event) => updateBlock(block.key, event.target.value)}
                      className="tws-field"
                    />
                    <span className="cms-fallback">
                      Current live copy: “{draft.content_blocks?.[block.key]?.trim() || block.fallback}”
                    </span>
                  </label>
                ))}
              </div>
            </>
          ) : null}

          {error ? (
            <p role="alert" className="cms-banner is-error">
              {error}
            </p>
          ) : null}

          <footer className="cms-actions">
            <button
              type="button"
              onClick={handleDiscard}
              disabled={!dirty || saving}
              className="cms-btn"
              data-testid="cms-discard"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Discard changes
            </button>
            <button
              type="submit"
              disabled={saving || loading || !dirty}
              className="cms-btn is-primary"
              data-testid="cms-publish"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Publishing…' : 'Publish website content'}
            </button>
          </footer>
        </div>

        {/* ——— live preview ——— */}
        <aside className="cms-preview" aria-label="Preview">
          <p className="cms-label">Preview</p>
          <div className="cms-preview-card">
            <div className="cms-preview-hero">
              <span className="cms-preview-paint">{draft.hero_bg_text || 'THREE WAYS'}</span>
              <span className="cms-preview-script">
                {draft.hero_script_text || 'Three Ways Studios'}
              </span>
            </div>
            <div className="cms-preview-copy">
              <p>{draft.hero_tagline || 'Fashion beyond limits.'}</p>
              <p className="cms-preview-release">{draft.hero_collection_label}</p>
              <span className="cms-preview-pill">{draft.hero_cta_label || 'Shop now'}</span>
            </div>
            <div className="cms-preview-nav">
              {draft.nav_links.map((link, index) => (
                <span key={`${link.label}-${index}`}>{link.label || '—'}</span>
              ))}
            </div>
            <p className="cms-preview-note">
              {draft.footer_tagline || 'Independent streetwear. Cairo, Egypt.'}
            </p>
          </div>
          <p className="cms-preview-hint">
            Updates here are a preview only — nothing reaches customers until you publish.
          </p>
        </aside>
      </div>
    </form>
  );
}

function LinkEditor({
  items,
  onChange,
  label,
  error,
}: {
  items: NavLinkItem[];
  onChange: (items: NavLinkItem[]) => void;
  label: string;
  error?: string;
}) {
  const move = (index: number, delta: number) => {
    const next = [...items];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="cms-links">
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className="cms-link-row">
          <input
            value={item.label}
            aria-label={`${label} ${index + 1} label`}
            placeholder="Label"
            onChange={(event) =>
              onChange(items.map((entry, i) => (i === index ? { ...entry, label: event.target.value } : entry)))
            }
            className="tws-field"
          />
          <input
            value={item.path}
            aria-label={`${label} ${index + 1} destination`}
            placeholder="/shop"
            onChange={(event) =>
              onChange(items.map((entry, i) => (i === index ? { ...entry, path: event.target.value } : entry)))
            }
            className="tws-field"
          />
          <span className="cms-link-tools">
            <button type="button" onClick={() => move(index, -1)} aria-label="Move up" disabled={index === 0}>
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => move(index, 1)}
              aria-label="Move down"
              disabled={index === items.length - 1}
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
              aria-label={`Remove ${item.label || 'link'}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, { label: '', path: '/' }])}
        className="cms-btn"
      >
        <Plus className="h-3.5 w-3.5" /> Add link
      </button>
      {error ? (
        <span role="alert" className="cms-error">
          {error}
        </span>
      ) : null}
    </div>
  );
}
