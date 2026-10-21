import { modalOpen } from './modal';

/** True when a key press belongs to a text field, a select or an editable region, not to the application. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable === true;
}

/** A plain key press: no Ctrl, Alt or ⌘, not aimed at a field, and no modal open over the page. Application shortcuts must pass this. */
export function isPlainShortcut(e: KeyboardEvent): boolean {
  return !e.ctrlKey && !e.metaKey && !e.altKey && !isTypingTarget(e.target) && !modalOpen();
}
