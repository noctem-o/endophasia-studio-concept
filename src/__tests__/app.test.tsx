// @vitest-environment jsdom
// The application as a user drives it: workspace keys, the synthetic marker everywhere, Observe's filtered stepping, the session
// switcher's keyboard behaviour, and the epistemic statements the Compare and Capabilities inspectors must make.
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render, fireEvent, cleanup, within, act } from '@testing-library/react';
import App from '../App';

beforeAll(() => {
  const g = globalThis as { ResizeObserver?: unknown };
  if (typeof g.ResizeObserver === 'undefined') g.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(cleanup);

const press = (key: string, init: KeyboardEventInit = {}, target: Element | Window | Document = window) => act(() => { fireEvent.keyDown(target, { key, ...init }); });
const pressed = (name: string) => document.querySelector(`nav[aria-label="Workspaces"] button[aria-pressed="true"]`)?.textContent?.includes(name) ?? false;
const row = (seq: number) => document.querySelector(`tr[data-seq="${seq}"]`) as HTMLElement;
const inspector = () => document.querySelector('aside[aria-label="Event inspector"]') as HTMLElement;

describe('workspace keys', () => {
  it('1–4 switch workspace; the number is not part of the accessible name', () => {
    const { getByRole } = render(<App />);
    expect(getByRole('button', { name: 'Evolve' })).toBeTruthy();
    expect(pressed('Observe')).toBe(true);
    press('2'); expect(pressed('Compare')).toBe(true);
    press('3'); expect(pressed('Capabilities')).toBe(true);
    press('4'); expect(pressed('Evolve')).toBe(true);
    press('1'); expect(pressed('Observe')).toBe(true);
  });

  it('ignores the keys while typing in a field, and when Ctrl, Alt or ⌘ is held', () => {
    const { getByLabelText } = render(<App />);
    press('3', {}, getByLabelText('Search events'));
    expect(pressed('Observe')).toBe(true);
    press('3', { ctrlKey: true }); press('3', { metaKey: true }); press('3', { altKey: true });
    expect(pressed('Observe')).toBe(true);
  });

  it('? opens the shortcut sheet', () => {
    render(<App />);
    press('?');
    const dialog = document.querySelector('dialog[aria-label="Keyboard shortcuts"]') as HTMLDialogElement;
    expect(dialog.hasAttribute('open')).toBe(true);
  });
});

describe('the synthetic-data marker is never absent', () => {
  it('is on screen in every workspace, and the lab and its stress fixtures add their own', () => {
    const { getByText, getByLabelText } = render(<App />);
    for (const key of ['1', '2', '3', '4']) {
      press(key);
      expect(getByText('SYNTHETIC DATA')).toBeTruthy();
    }
    expect(getByText('SYNTHETIC PROGRAMME')).toBeTruthy();
    const sceneSelect = getByLabelText('Scene') as HTMLSelectElement;
    const stress = [...sceneSelect.options].find((o) => o.textContent?.includes('100 nodes'))!;
    act(() => { fireEvent.change(sceneSelect, { target: { value: stress.value } }); });
    expect(getByText(/SYNTHETIC FIXTURE · 100 NODES/)).toBeTruthy();
    expect(getByText('SYNTHETIC DATA')).toBeTruthy();
  });
});

describe('Observe: stepping and filters', () => {
  it('opens on the session brief, not an empty state', () => {
    render(<App />);
    expect(within(inspector()).getByText('Evidence mix')).toBeTruthy();
  });

  it('j and k walk the events being shown, never one a filter hides', () => {
    const { getByRole } = render(<App />);
    act(() => { fireEvent.click(row(1)); });
    act(() => { fireEvent.click(getByRole('button', { name: /^Tool/ })); });
    // Event 1 is a lifecycle event, now hidden: the selection is not shown, and j enters at the first VISIBLE event.
    expect(within(inspector()).queryByText(/^Event$/)).toBeNull();
    press('j');
    expect(row(5).getAttribute('aria-selected')).toBe('true');
    press('j');
    expect(row(6).getAttribute('aria-selected')).toBe('true');
    expect(document.querySelector('tr[data-seq="2"]')).toBeNull();
    press('k'); press('k'); press('k');
    expect(row(5).getAttribute('aria-selected')).toBe('true');
  });

  it('Escape returns to the session brief', () => {
    render(<App />);
    act(() => { fireEvent.click(row(4)); });
    expect(row(4).getAttribute('aria-selected')).toBe('true');
    press('Escape');
    expect(within(inspector()).getByText('Evidence mix')).toBeTruthy();
  });

  it('a link to an event the filters hide resets the filters instead of landing on nothing', () => {
    const { getByRole, getByLabelText } = render(<App />);
    act(() => { fireEvent.click(getByRole('button', { name: /Recorded session/ })); });
    act(() => { fireEvent.click(getByRole('option', { name: /run-2b7e90/ })); });
    act(() => { fireEvent.click(row(7)); }); // a model event that points at the failed tool call
    act(() => { fireEvent.click(getByRole('button', { name: /^Model/ })); });
    expect(document.querySelector('tr[data-seq="6"]')).toBeNull();
    const rel = within(inspector()).getAllByRole('button').find((b) => b.textContent?.includes('seq 6'))!;
    act(() => { fireEvent.click(rel); });
    expect(row(6)?.getAttribute('aria-selected')).toBe('true');
    expect((getByLabelText('Search events') as HTMLInputElement).value).toBe('');
  });
});

describe('session switcher', () => {
  it('opens as a listbox, moves with the arrow keys, chooses with Enter, and returns focus on Escape', () => {
    const { getByRole } = render(<App />);
    const button = getByRole('button', { name: /Recorded session/ });
    act(() => { fireEvent.click(button); });
    const list = getByRole('listbox');
    expect(within(list).getAllByRole('option')).toHaveLength(6);
    press('ArrowDown', {}, list);
    press('Enter', {}, list);
    expect(getByRole('button', { name: /Recorded session: run-2b7e90/ })).toBeTruthy();
    act(() => { fireEvent.click(getByRole('button', { name: /Recorded session/ })); });
    press('Escape', {}, getByRole('listbox'));
    expect(document.activeElement).toBe(getByRole('button', { name: /Recorded session/ }));
  });
});

describe('Compare states its limits', () => {
  it('says an exact link does not establish equivalence, and that a pair with no compared field can be proposed but never exact', () => {
    const { getByLabelText } = render(<App />);
    press('2');
    const colA = getByLabelText(/Events of trajectory A: run-3f92c1/);
    const aEvent = (n: number) => within(colA).getByRole('button', { name: new RegExp(`event ${n}:`) });
    act(() => { fireEvent.click(aEvent(5)); });
    expect(document.body.textContent).toContain('does not say the two events had the same content');
    act(() => { fireEvent.click(aEvent(1)); });
    expect(document.body.textContent).toContain('proposed but never exact');
    expect(document.body.textContent).toContain('not a verified pairing');
  });

  it('draws no link for an unmatched event, and says it is not an error', () => {
    const { getByLabelText } = render(<App />);
    press('2');
    act(() => { fireEvent.click(within(getByLabelText(/Events of trajectory A: run-3f92c1/)).getByRole('button', { name: /event 10:/ })); });
    expect(document.body.textContent).toContain('No counterpart was proposed in B');
    expect(document.body.textContent).toContain('not an error');
  });
});

describe('Capabilities do not claim what the record does not show', () => {
  it('an unverified capability has no observed evidence and the inspector says neither claim is made', () => {
    render(<App />);
    press('3');
    const grid = document.querySelector('table[aria-label="Capabilities: declared against observed"]') as HTMLElement;
    const r = [...grid.querySelectorAll('tr')].find((x) => x.textContent?.includes('artifacts.export'))!;
    act(() => { fireEvent.click(r); });
    expect(document.body.textContent).toContain('No observed evidence backs this');
    expect(document.body.textContent).toContain('neither is claimed');
  });
});

describe('Evolve', () => {
  it('selecting stays in the graph (the explorer remains mounted) and the lab tabs move with the arrow keys', () => {
    const { getByRole, getByTestId } = render(<App />);
    press('4');
    const viewport = getByRole('application');
    act(() => { fireEvent.keyDown(viewport, { key: 'ArrowRight' }); });
    expect(getByTestId('lineage-explorer')).toBeTruthy();
    expect(document.querySelector('aside[aria-label="Evolve record inspector"]')?.textContent).toContain('Execution');
    const lineageTab = getByRole('tab', { name: /Lineage/ });
    act(() => { fireEvent.keyDown(lineageTab, { key: 'ArrowRight' }); });
    expect(getByRole('tab', { name: /Experiments/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('shows a trial with no verdict as unavailable, not as a pass or a fail', () => {
    const { getByRole } = render(<App />);
    press('4');
    act(() => { fireEvent.click(getByRole('tab', { name: /Experiments/ })); });
    act(() => { fireEvent.click(getByRole('button', { name: /Experiment 4/ })); });
    expect(document.body.textContent).toContain('no verdicts');
  });
});

describe('drawers are never a trap', () => {
  it('Escape closes the Experiments details drawer', () => {
    const { getByRole } = render(<App />);
    press('4');
    act(() => { fireEvent.click(getByRole('tab', { name: /Experiments/ })); });
    act(() => { fireEvent.click(getByRole('button', { name: /design & trial details/ })); });
    const drawer = () => document.querySelector('aside[aria-label="Trial inspector"]') as HTMLElement;
    expect(drawer().className).toContain('fixed');
    press('Escape');
    expect(drawer().className).not.toContain('fixed');
  });
});
