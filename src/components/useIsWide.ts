import { useEffect, useState } from 'react';

/** The `lg` breakpoint, matched to Tailwind's: at and above it the inspector is a column; below it, a modal drawer. */
export const WIDE_QUERY = '(min-width: 1024px)';

/** True at desktop widths. Without matchMedia (a test DOM) it assumes desktop, the layout the column is designed for. */
export function useIsWide(): boolean {
  const [wide, setWide] = useState(() => (typeof window === 'undefined' || typeof window.matchMedia !== 'function' ? true : window.matchMedia(WIDE_QUERY).matches));
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const m = window.matchMedia(WIDE_QUERY);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    on();
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}
