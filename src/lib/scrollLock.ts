import { useEffect, useRef } from 'react';

/* =========================================================
   Overlay plumbing: ref-counted scroll lock (including iOS Safari /
   mobile momentum containment via fixed body offset) + escape handling
   with a dialog stack, so Escape always closes the TOP layer only
   (e.g. “Find my size” inside the quick view, quick view under it).
   ========================================================= */

let activeLocks = 0;
let lockedScrollY = 0;

export function lockBodyScroll() {
  if (activeLocks === 0) {
    lockedScrollY = window.scrollY;
    const scrollbarGap = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    document.documentElement.classList.add('tws-scroll-locked');
    document.body.style.position = 'fixed';
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    if (scrollbarGap > 0) {
      document.body.style.paddingRight = `${scrollbarGap}px`;
    }
  }
  activeLocks += 1;
}

export function unlockBodyScroll() {
  if (activeLocks === 0) return;
  activeLocks -= 1;
  if (activeLocks === 0) {
    const restoreY = lockedScrollY;
    document.documentElement.classList.remove('tws-scroll-locked');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.paddingRight = '';
    window.scrollTo(0, restoreY);
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
