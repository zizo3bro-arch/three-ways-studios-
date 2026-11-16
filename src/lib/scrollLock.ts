import { useEffect, useRef } from 'react';

let activeLocks = 0;

export function lockBodyScroll() {
  activeLocks += 1;
  document.documentElement.classList.add('tws-scroll-locked');
}

export function unlockBodyScroll() {
  activeLocks = Math.max(0, activeLocks - 1);
  if (activeLocks === 0) {
    document.documentElement.classList.remove('tws-scroll-locked');
  }
}

/** Locks page scroll while `active` is true (safe to nest via reference counting). */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [active]);
}

/** Closes an overlay on Escape without re-registering on every render. */
export function useEscapeKey(active: boolean, onEscape: () => void) {
  const handlerRef = useRef(onEscape);
  handlerRef.current = onEscape;

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handlerRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active]);
}
