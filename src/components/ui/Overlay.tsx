import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { overlayBackdrop, overlayPanelRight, overlaySheet } from '../../lib/motion';
import { useBodyScrollLock, useEscapeKey } from '../../lib/scrollLock';

/* =========================================================
   Overlay — one shell for bag, search, account and the mobile menu:
   backdrop, escape, tab trap, focus restore, ref-counted scroll lock.
   ========================================================= */

type Placement = 'right' | 'sheet' | 'full';

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  placement?: Placement;
  panelClassName?: string;
  hideClose?: boolean;
}

const PANEL_VARIANTS: Record<Placement, typeof overlayPanelRight> = {
  right: overlayPanelRight,
  sheet: overlaySheet,
  full: overlaySheet,
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Overlay({
  open,
  onClose,
  label,
  children,
  placement = 'right',
  panelClassName = '',
  hideClose = false,
}: OverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useBodyScrollLock(open);
  useEscapeKey(open, onClose);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panelRef.current)?.focus();
    }, 90);

    return () => {
      window.clearTimeout(timer);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  const trapFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (!nodes || nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const alignment =
    placement === 'right'
      ? 'justify-end'
      : placement === 'sheet'
        ? 'items-end justify-center'
        : 'items-center justify-center';

  return (
    <AnimatePresence>
      {open ? (
        <div className={`fixed inset-0 z-[70] flex ${alignment}`} role="dialog" aria-modal="true" aria-label={label}>
          <motion.button
            type="button"
            aria-label={`Close ${label.toLowerCase()}`}
            onClick={onClose}
            variants={overlayBackdrop}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="absolute inset-0 cursor-default bg-[#100e0c]/45 backdrop-blur-[3px]"
          />

          <motion.div
            ref={panelRef}
            tabIndex={-1}
            variants={PANEL_VARIANTS[placement]}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onKeyDown={trapFocus}
            className={[
              'relative z-10 flex max-h-full flex-col overflow-hidden border-ink/10 bg-ivory text-ink outline-none shadow-[0_30px_90px_rgba(12,10,8,0.42)]',
              placement === 'right' ? 'h-full w-full max-w-[440px] border-l px-5 py-4 sm:px-7 sm:py-6' : '',
              placement === 'sheet' ? 'w-full max-w-3xl rounded-t-[1.75rem] border-x border-t px-5 pb-6 pt-4 sm:px-8 sm:pb-9 sm:pt-5' : '',
              placement === 'full' ? 'h-[100svh] w-full max-w-[1180px] px-5 py-4 sm:h-auto sm:max-h-[88svh] sm:rounded-[1.75rem] sm:border sm:px-7 sm:py-6' : '',
              panelClassName,
            ].join(' ')}
          >
            {!hideClose ? (
              <div className="flex items-start justify-between gap-4">
                <span className="sr-only">{label}</span>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={`Close ${label.toLowerCase()}`}
                  className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ink/20 text-ink transition-colors duration-300 hover:border-ink hover:bg-ink hover:text-ivory"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            ) : null}
            {children}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
