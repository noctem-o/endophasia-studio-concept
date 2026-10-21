import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { enterModal } from '../state/modal';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/** Makes everything outside `el` inert (every sibling of it and of each ancestor), so neither focus nor assistive technology can
 *  reach the page behind a modal. Elements marked data-modal-backdrop stay live: clicking the backdrop closes the modal. */
function makeSiblingsInert(el: HTMLElement): () => void {
  const changed: HTMLElement[] = [];
  let node: HTMLElement | null = el;
  while (node && node.parentElement && node !== document.body) {
    for (const sib of Array.from(node.parentElement.children)) {
      if (sib === node || !(sib instanceof HTMLElement)) continue;
      if (sib.tagName === 'SCRIPT' || sib.hasAttribute('inert') || sib.hasAttribute('data-modal-backdrop')) continue;
      sib.setAttribute('inert', '');
      changed.push(sib);
    }
    node = node.parentElement;
  }
  return () => changed.forEach((e) => e.removeAttribute('inert'));
}

/** Tabbable and actually shown. Computed style rather than layout, so it behaves the same in a real browser and in a test DOM. */
const isShown = (n: HTMLElement) => {
  if (n.closest('[hidden], [inert]')) return false;
  const cs = getComputedStyle(n);
  return cs.display !== 'none' && cs.visibility !== 'hidden';
};
const focusables = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isShown);

/**
 * The complete modal contract for the narrow-screen inspector, applied while `active`:
 *  - focus moves into the dialog (its container, so the dialog's name is announced) and the initiating control is remembered;
 *  - Tab and Shift+Tab wrap inside it; the rest of the page is inert;
 *  - Escape closes it (unless a native <dialog> such as the shortcut sheet is the topmost surface);
 *  - global shortcuts stand down (state/modal.ts);
 *  - if its content is replaced and the focused element disappears, focus returns to the dialog rather than to <body>;
 *  - on close, focus returns to the initiating control (or, if that is gone, to the workspace region); when it merely stops being
 *    modal because the window widened, focus is left alone; on unmount (a workspace change) it falls back to the workspace region.
 */
export function useModalDrawer(ref: RefObject<HTMLElement | null>, active: boolean, stillOpen: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const openRef = useRef(stillOpen);
  openRef.current = stillOpen;
  const mounted = useRef(true);

  // Declared first, so on unmount its cleanup runs before the modal's and the modal can tell it is going away.
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    const initiator = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const release = enterModal();
    const restoreInert = makeSiblingsInert(el);
    el.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (e.defaultPrevented || document.querySelector('dialog[open]')) return;
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables(el);
      if (items.length === 0) { e.preventDefault(); el.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const at = document.activeElement;
      if (!el.contains(at) || at === el) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && at === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && at === last) {
        e.preventDefault();
        first.focus();
      }
    };
    const pullBack = () => { if (!el.contains(document.activeElement)) el.focus({ preventScroll: true }); };
    const onFocusIn = (e: FocusEvent) => { if (e.target instanceof Node && !el.contains(e.target)) el.focus({ preventScroll: true }); };

    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocusIn);
    const observer = typeof MutationObserver === 'function' ? new MutationObserver(pullBack) : null;
    observer?.observe(el, { childList: true, subtree: true });

    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocusIn);
      observer?.disconnect();
      restoreInert();
      release();
      // Closed, or the whole workspace went away: put focus somewhere sensible. Merely widening past the breakpoint leaves it be.
      if (openRef.current && mounted.current) return;
      const target = initiator && initiator.isConnected && !el.contains(initiator) ? initiator : document.getElementById('workspace');
      target?.focus({ preventScroll: true });
    };
  }, [ref, active]);
}
