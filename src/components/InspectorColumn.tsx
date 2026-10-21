import { useEffect } from 'react';
import type { ReactNode } from 'react';

/**
 * The inspector column. From the `lg` breakpoint up it is a fixed column beside the workspace. Below it, the inspector is not
 * lost (it used to be hidden outright): it opens as a drawer over the workspace while something is selected, and closes with its
 * own button or Esc. Its content is the same either way.
 */
export function InspectorColumn({ label, open, onClose, children, width = 'lg:w-[400px] 2xl:w-[440px]' }: {
  label: string;
  /** Whether the drawer is shown below `lg`. At `lg` and above the column is always shown. */
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}) {
  // A drawer must never be a trap: Escape closes it (at lg and above this just clears whatever opened it).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      {open && <button type="button" tabIndex={-1} aria-hidden onClick={onClose} className="fixed inset-0 z-20 bg-black/50 lg:hidden" />}
      <aside
        aria-label={label}
        className={`${open ? 'fixed inset-y-0 right-0 z-30 flex w-[min(440px,92vw)] shadow-pop' : 'hidden'} shrink-0 flex-col border-l border-line bg-surface-1 lg:static lg:z-auto lg:flex lg:shadow-none ${width}`}
      >
        {children}
      </aside>
    </>
  );
}
