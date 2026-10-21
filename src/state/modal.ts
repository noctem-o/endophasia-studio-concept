/**
 * Whether a modal surface (the narrow-screen inspector drawer) is open. While one is, the application's global keyboard shortcuts
 * (workspace keys, `?`, `/`, j/k) must stand down: they act on content the modal covers, and one of them (switching workspace)
 * would unmount the modal and drop focus. A counter, so nested or overlapping surfaces cannot release each other early.
 */
let depth = 0;

export const modalOpen = (): boolean => depth > 0;

/** Marks a modal as open; returns the function that closes it. Idempotent per call. */
export function enterModal(): () => void {
  depth++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    depth = Math.max(0, depth - 1);
  };
}
