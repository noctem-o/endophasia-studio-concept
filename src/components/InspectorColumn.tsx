import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { useIsWide } from './useIsWide';
import { useModalDrawer } from './useModalDrawer';

/**
 * The inspector. From the `lg` breakpoint up it is a column beside the workspace: a plain complementary region, always shown,
 * never trapping anything. Below it, whenever something is selected it is a MODAL dialog over the workspace: it covers most of the
 * screen behind a backdrop that blocks the page, so it behaves as a modal (see useModalDrawer for the whole contract: focus in and
 * back out, Tab wrap, inert page, Escape, shortcuts suspended, focus recovery). The content is the same either way.
 */
export function InspectorColumn({ label, open, onClose, children, width = 'lg:w-[400px] 2xl:w-[440px]' }: {
  label: string;
  /** Whether the drawer is shown below `lg`. At `lg` and above the column is always shown. */
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}) {
  const wide = useIsWide();
  const modal = !wide && open;
  const ref = useRef<HTMLElement>(null);
  useModalDrawer(ref, modal, open, onClose);

  // At desktop widths Escape still clears whatever opened the inspector (as it always did); the modal handles its own Escape.
  useEffect(() => {
    if (!open || !wide) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('dialog[open]')) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, wide, onClose]);

  return (
    <>
      {open && <button type="button" tabIndex={-1} aria-hidden data-modal-backdrop onClick={onClose} className="fixed inset-0 z-20 bg-black/50 lg:hidden" />}
      <aside
        ref={ref}
        aria-label={label}
        role={modal ? 'dialog' : undefined}
        aria-modal={modal ? true : undefined}
        tabIndex={modal ? -1 : undefined}
        className={`${open ? 'fixed inset-y-0 right-0 z-30 flex w-[min(440px,92vw)] shadow-pop' : 'hidden'} shrink-0 flex-col border-l border-line bg-surface-1 outline-none lg:static lg:z-auto lg:flex lg:shadow-none ${width}`}
      >
        {modal && (
          <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line bg-surface-2 px-3">
            <span className="eyebrow truncate">{label}</span>
            <button
              type="button"
              onClick={onClose}
              aria-label={`Close ${label}`}
              className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-ctl border border-line px-2 font-mono text-2xs text-fg-2 transition-colors duration-100 hover:border-line-strong hover:bg-surface-3 hover:text-fg-1"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              close
            </button>
          </div>
        )}
        {children}
      </aside>
    </>
  );
}
