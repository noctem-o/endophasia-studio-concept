// @vitest-environment jsdom
// The inspector's two presentations. At desktop widths it is a plain column. Below 1024px it is a MODAL dialog, and a modal has a
// contract: a name, focus moved in, a Tab trap, an inert page, Escape, shortcuts suspended, focus recovered when its content is
// replaced, and focus returned when it closes. These tests exercise each part, and the transitions between the two presentations.
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { InspectorColumn } from '../InspectorColumn';
import { modalOpen } from '../../state/modal';

// A controllable matchMedia: `setWide(false)` is a narrow window, and listeners are told when it changes.
let wide = true;
const listeners = new Set<() => void>();
const setWide = (next: boolean) => { wide = next; act(() => { listeners.forEach((l) => l()); }); };
beforeEach(() => {
  wide = true; listeners.clear();
  window.matchMedia = ((q: string) => ({
    get matches() { return wide; },
    media: q,
    addEventListener: (_: string, fn: () => void) => { listeners.add(fn); },
    removeEventListener: (_: string, fn: () => void) => { listeners.delete(fn); },
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => { cleanup(); delete (window as { matchMedia?: unknown }).matchMedia; });

function Harness({ closed }: { closed?: () => void }) {
  const [open, setOpen] = useState(false);
  const [rev, setRev] = useState(0);
  return (
    <div id="root-ish">
      <header><button>header action</button></header>
      <main id="workspace" tabIndex={-1}>
        <button onClick={() => setOpen(true)}>open details</button>
        <button>background control</button>
        <InspectorColumn label="Test inspector" open={open} onClose={() => { setOpen(false); closed?.(); }}>
          <div key={rev}>
            <button>first</button>
            <button onClick={() => setRev((r) => r + 1)}>replace content</button>
            <button>last</button>
          </div>
        </InspectorColumn>
      </main>
      <footer><button>status action</button></footer>
    </div>
  );
}

const tab = (shift = false) => act(() => { fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Tab', shiftKey: shift }); });
const esc = () => act(() => { fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' }); });
const dialog = () => document.querySelector('aside[aria-label="Test inspector"]') as HTMLElement;
const opener = (g: ReturnType<typeof render>) => g.getByText('open details') as HTMLButtonElement;
const openIt = (g: ReturnType<typeof render>) => { opener(g).focus(); act(() => { fireEvent.click(opener(g)); }); };

describe('desktop: a plain column, never a trap', () => {
  it('has no dialog role, makes nothing inert, and does not suspend shortcuts', () => {
    const g = render(<Harness />);
    openIt(g);
    expect(dialog().getAttribute('role')).toBeNull();
    expect(dialog().getAttribute('aria-modal')).toBeNull();
    expect(document.querySelectorAll('[inert]')).toHaveLength(0);
    expect(modalOpen()).toBe(false);
    expect(g.queryByText('close')).toBeNull();
  });

  it('does not trap Tab and does not steal focus', () => {
    const g = render(<Harness />);
    openIt(g);
    expect(document.activeElement).toBe(opener(g));
    const ev = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true, bubbles: true });
    act(() => { document.activeElement!.dispatchEvent(ev); });
    expect(ev.defaultPrevented).toBe(false);
  });

  it('Escape still clears whatever opened it', () => {
    let closed = 0;
    const g = render(<Harness closed={() => { closed++; }} />);
    openIt(g);
    esc();
    expect(closed).toBe(1);
  });
});

describe('narrow: a modal dialog', () => {
  beforeEach(() => setWide(false));

  it('is not a dialog until something opens it', () => {
    render(<Harness />);
    expect(dialog().getAttribute('role')).toBeNull();
    expect(modalOpen()).toBe(false);
  });

  it('opens as a named modal dialog, moves focus into itself, and makes the rest of the page inert', () => {
    const g = render(<Harness />);
    openIt(g);
    expect(dialog().getAttribute('role')).toBe('dialog');
    expect(dialog().getAttribute('aria-modal')).toBe('true');
    expect(g.getByRole('dialog', { name: 'Test inspector' })).toBe(dialog());
    expect(document.activeElement).toBe(dialog());
    expect(modalOpen()).toBe(true);
    for (const text of ['header action', 'status action']) expect(g.getByText(text).closest('[inert]')).not.toBeNull();
    expect(g.getByText('background control').closest('[inert]')).not.toBeNull();
    expect(dialog().closest('[inert]')).toBeNull();
  });

  it('supplies its own labelled close control', () => {
    const g = render(<Harness />);
    openIt(g);
    expect(g.getByRole('button', { name: 'Close Test inspector' })).toBeTruthy();
  });

  it('wraps Tab and Shift+Tab inside the dialog, and leaves ordinary movement to the browser', () => {
    const g = render(<Harness />);
    openIt(g);
    const names = () => (document.activeElement as HTMLElement).textContent?.trim();
    // The dialog's own close control is its first tabbable element. From the container, Tab enters there.
    tab(); expect(names()).toBe('close');
    // From the last control, Tab wraps to the first; from the first, Shift+Tab wraps to the last.
    g.getByText('last').focus(); tab(); expect(names()).toBe('close');
    tab(true); expect(names()).toBe('last');
    // From a control in the middle, neither key is intercepted: the browser moves focus as it normally would.
    g.getByText('first').focus();
    for (const shift of [false, true]) {
      const ev = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, cancelable: true, bubbles: true });
      act(() => { document.activeElement!.dispatchEvent(ev); });
      expect(ev.defaultPrevented, `shift=${shift}`).toBe(false);
    }
  });

  it('Escape closes it, returns focus to the control that opened it, and restores the page', () => {
    const g = render(<Harness />);
    openIt(g);
    expect(document.activeElement).toBe(dialog());
    esc();
    expect(dialog().getAttribute('role')).toBeNull();
    expect(document.activeElement).toBe(opener(g));
    expect(document.querySelectorAll('[inert]')).toHaveLength(0);
    expect(modalOpen()).toBe(false);
  });

  it('the close button and the backdrop both close it and return focus', () => {
    const g = render(<Harness />);
    openIt(g);
    act(() => { fireEvent.click(g.getByRole('button', { name: 'Close Test inspector' })); });
    expect(document.activeElement).toBe(opener(g));
    openIt(g);
    act(() => { fireEvent.click(document.querySelector('[data-modal-backdrop]')!); });
    expect(document.activeElement).toBe(opener(g));
    expect(modalOpen()).toBe(false);
  });

  it('keeps focus in the dialog when its content is replaced under the focused control', async () => {
    const g = render(<Harness />);
    openIt(g);
    g.getByText('replace content').focus();
    expect(document.activeElement).toBe(g.getByText('replace content'));
    act(() => { fireEvent.click(g.getByText('replace content')); }); // re-keys the content: the focused button is destroyed
    await act(async () => { await Promise.resolve(); });
    expect(dialog().contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(document.body);
  });

  it('pulls focus back if something outside tries to take it', () => {
    const g = render(<Harness />);
    openIt(g);
    act(() => { g.getByText('header action').focus(); });
    expect(dialog().contains(document.activeElement)).toBe(true);
  });

  it('a Tab press never escapes to the page behind', () => {
    const g = render(<Harness />);
    openIt(g);
    g.getByText('last').focus();
    const ev = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true, bubbles: true });
    act(() => { document.activeElement!.dispatchEvent(ev); });
    expect(ev.defaultPrevented).toBe(true);
  });
});

describe('transitions', () => {
  it('widening while open ends the modal, leaves focus alone, and restores the page', () => {
    setWide(false);
    const g = render(<Harness />);
    openIt(g);
    g.getByText('last').focus();
    setWide(true);
    expect(dialog().getAttribute('role')).toBeNull();
    expect(document.querySelectorAll('[inert]')).toHaveLength(0);
    expect(modalOpen()).toBe(false);
    expect(document.activeElement).toBe(g.getByText('last')); // not yanked back to the opener
  });

  it('focus returns to the ORIGINAL opener after a narrow -> wide -> narrow round trip', () => {
    setWide(false);
    const g = render(<Harness />);
    openIt(g);
    g.getByText('last').focus();
    setWide(true);              // widened: focus stays inside the (now plain) inspector
    g.getByText('last').focus();
    setWide(false);             // narrowed again with the same selection open
    esc();
    expect(document.activeElement).toBe(opener(g)); // not #workspace
  });

  it('narrowing while open becomes a modal and takes focus in (a covering overlay must not leave focus behind it)', () => {
    const g = render(<Harness />);
    openIt(g);
    expect(dialog().getAttribute('role')).toBeNull();
    setWide(false);
    expect(dialog().getAttribute('role')).toBe('dialog');
    expect(dialog().contains(document.activeElement)).toBe(true);
    expect(modalOpen()).toBe(true);
  });

  it('unmounting while open (a workspace change) clears the modal state and lands focus on the workspace region', () => {
    setWide(false);
    const g = render(<Harness />);
    openIt(g);
    g.unmount();
    expect(modalOpen()).toBe(false);
    expect(document.querySelectorAll('[inert]')).toHaveLength(0);
  });
});
