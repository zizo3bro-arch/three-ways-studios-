import { useEffect, useRef } from 'react';

/* =========================================================
   Overlay plumbing: ref-counted scroll lock + escape handling with
   a dialog stack, so Escape always closes the TOP layer only
   (e.g. “Find my size” inside the quick view, quick view under it).
   ========================================================= */

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

const dialogStack: number[] = [];
let nextDialogId = 1;

/** Closes an overlay on Escape — but only when it is the topmost dialog. */
export function useEscapeKey(active: boolean, onEscape: () => void) {
  const handlerRef = useRef(onEscape);
  handlerRef.current = onEscape;

  const idRef = useRef(0);
  if (idRef.current === 0) idRef.current = nextDialogId++;

  useEffect(() => {
    if (!active) return;

    dialogStack.push(idRef.current);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (dialogStack[dialogStack.length - 1] !== idRef.current) return;
      event.preventDefault();
      handlerRef.current();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      const index = dialogStack.indexOf(idRef.current);
      if (index >= 0) dialogStack.splice(index, 1);
    };
  }, [active]);
}
