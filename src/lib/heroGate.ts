export const HERO_UNLOCK_EVENT = 'tws:hero-unlock';

export interface HeroUnlockDetail {
  targetId?: string | null;
}

/**
 * Ask the home page to leave the locked hero and scroll to a section.
 * The home page owns the lock state, so navigation/CTAs only dispatch intent.
 */
export function requestSectionReveal(targetId?: string | null) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<HeroUnlockDetail>(HERO_UNLOCK_EVENT, {
      detail: { targetId: targetId ?? null },
    })
  );
}

export function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
