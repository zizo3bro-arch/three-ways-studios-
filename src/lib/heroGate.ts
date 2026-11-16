export const HERO_UNLOCK_EVENT = 'tws:hero-unlock';

export interface HeroUnlockDetail {
  targetId?: string | null;
}

export function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function requestSectionReveal(targetId?: string | null) {
  if (typeof window === 'undefined') return;
  const destination = targetId || 'products';
  scrollToSection(destination);
}
