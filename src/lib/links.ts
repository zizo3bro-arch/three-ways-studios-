/** Link handling for CMS-editable destinations.
 *
 * The console lets staff type a button destination or a social URL. Only two
 * shapes are ever rendered: a site-internal path, or a plain https URL. Anything
 * else (javascript:, data:, protocol-relative //host) falls back to the studio's
 * own default, so a CMS field can never inject script or leave the site broken.
 */
export function safeDestination(value: string | null | undefined, fallback: string): string {
  const raw = (value ?? '').trim();
  if (!raw) return fallback;
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  try {
    const url = new URL(raw);
    if (url.protocol === 'https:' && url.hostname) return url.href;
  } catch {
    /* not an absolute URL */
  }
  return fallback;
}

export function isExternal(href: string): boolean {
  return /^https:\/\//i.test(href);
}

/** True when a value would be accepted by `safeDestination`. */
export function isValidDestination(value: string): boolean {
  const raw = value.trim();
  if (!raw) return true;
  if (raw.startsWith('/') && !raw.startsWith('//')) return true;
  try {
    return new URL(raw).protocol === 'https:';
  } catch {
    return false;
  }
}

/** A social / contact URL must be https and must have a host. */
export function isValidHttpsUrl(value: string): boolean {
  const raw = value.trim();
  if (!raw) return true;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && Boolean(url.hostname.split('.').length > 1);
  } catch {
    return false;
  }
}

export function isValidEmail(value: string): boolean {
  const raw = value.trim();
  return raw === '' || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw);
}

export function isValidPhone(value: string): boolean {
  const raw = value.trim();
  return raw === '' || /^\+?[\d\s()-]{6,20}$/.test(raw);
}
