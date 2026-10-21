// @vitest-environment jsdom
// The explorer's filter and relation toggles must change what is DRAWN. Both once changed only the node count: neither reached the
// renderer, so typing a filter left every node at full strength and "hide replay of" left every edge in place.
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { LineageExplorer } from '../LineageExplorer';
import { explorerScenes } from '../explorerScenes';

beforeAll(() => {
  const g = globalThis as { ResizeObserver?: unknown };
  if (typeof g.ResizeObserver === 'undefined') g.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(cleanup);

const recorded = explorerScenes.filter((e) => !e.synthetic);
const nodes = (c: HTMLElement) => Array.from(c.querySelectorAll<SVGGElement>('[role="application"] svg [data-node-id]'));
const dimmed = (c: HTMLElement) => nodes(c).filter((n) => n.getAttribute('opacity') === '0.25').map((n) => n.getAttribute('data-node-id'));
const openKey = (r: ReturnType<typeof render>) => act(() => { fireEvent.click(r.getByRole('button', { name: 'Key' })); }); // collapsed by default on a narrow canvas
const edges = (c: HTMLElement) => c.querySelectorAll('[role="application"] svg path[marker-end]').length;

describe('the text filter changes what is drawn', () => {
  it('dims the nodes that do not match, leaves the matches at full strength, and clears when emptied', () => {
    const { container, getByLabelText } = render(<LineageExplorer scenes={recorded} />);
    const total = nodes(container).length;
    expect(total).toBe(recorded[0].scene.nodes.length);
    expect(dimmed(container)).toEqual([]);
    act(() => { fireEvent.change(getByLabelText('Filter nodes'), { target: { value: 'replay' } }); });
    const dim = dimmed(container);
    expect(dim.length).toBeGreaterThan(0);
    expect(dim.length).toBeLessThan(total);
    expect(nodes(container)).toHaveLength(total); // dimmed, not removed: context stays visible
    act(() => { fireEvent.change(getByLabelText('Filter nodes'), { target: { value: '' } }); });
    expect(dimmed(container)).toEqual([]);
  });

  it('survives a selection (the SVG backend rebuilds its scene on every selection change)', () => {
    const { container, getByLabelText, getByRole } = render(<LineageExplorer scenes={recorded} />);
    act(() => { fireEvent.change(getByLabelText('Filter nodes'), { target: { value: 'replay' } }); });
    const before = dimmed(container);
    act(() => { fireEvent.keyDown(getByRole('application'), { key: 'ArrowRight' }); });
    expect(dimmed(container)).toEqual(before);
  });

  it('a lineage focus and a filter together keep only what satisfies both', () => {
    const { container, getByLabelText, getByRole, getByText } = render(<LineageExplorer scenes={recorded} />);
    act(() => { fireEvent.keyDown(getByRole('application'), { key: 'ArrowRight' }); });
    act(() => { fireEvent.click(getByText('focus lineage')); });
    const focusOnly = dimmed(container).length;
    expect(focusOnly).toBeGreaterThan(0);
    act(() => { fireEvent.change(getByLabelText('Filter nodes'), { target: { value: 'zzz-matches-nothing' } }); });
    expect(dimmed(container).length).toBe(nodes(container).length);
  });
});

describe('the relation toggles change what is drawn', () => {
  it('hiding a relation removes exactly its edges, and showing it restores them', () => {
    const r = render(<LineageExplorer scenes={recorded} />);
    const { container, getByRole } = r;
    openKey(r);
    const all = edges(container);
    expect(all).toBe(recorded[0].scene.edges.length);
    const replay = recorded[0].scene.edges.filter((e) => e.relation === 'replay_of').length;
    expect(replay).toBeGreaterThan(0);
    act(() => { fireEvent.click(getByRole('button', { name: /^replay of/ })); });
    expect(edges(container)).toBe(all - replay);
    expect(nodes(container)).toHaveLength(recorded[0].scene.nodes.length); // nodes are untouched
    act(() => { fireEvent.click(getByRole('button', { name: /^replay of/ })); });
    expect(edges(container)).toBe(all);
  });

  it('keeps the selection and the dimming across a relation toggle', () => {
    const r = render(<LineageExplorer scenes={recorded} />);
    const { container, getByLabelText, getByRole } = r;
    openKey(r);
    act(() => { fireEvent.change(getByLabelText('Filter nodes'), { target: { value: 'replay' } }); });
    act(() => { fireEvent.keyDown(getByRole('application'), { key: 'ArrowRight' }); });
    const dim = dimmed(container);
    act(() => { fireEvent.click(getByRole('button', { name: /^forked from/ })); });
    expect(dimmed(container)).toEqual(dim);
  });
});
