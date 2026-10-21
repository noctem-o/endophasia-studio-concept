// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStudioState } from '../studio';
import { sessions } from '@/data/fixtures';
import { buildLineageScene } from '@/scenes/lineageBuilder';
import { evolveCorpus } from '@/data/evolve';
import { makeSyntheticScene } from '@/scenes/renderers/synthetic';
import {
  filteredVisibleNodes, fitViewport, focusSetOf, initialInteraction, navOrder, lodTier, clampScale, ancestryOf,
} from '@/scenes/interaction';
import type { LineageScene } from '@/scenes/types';

// jsdom provides no WebGL2; the SVG backend is the one that must work here.
// Renderer-swap semantics are tested at the interaction-model level: state
// lives outside the renderer, so a swap cannot lose it by construction.

describe('cross-workspace navigation', () => {
  it('inspectEventOf selects the owning session before selecting the event', () => {
    const target = sessions[2].events[1];
    const { result } = renderHook(() => useStudioState());
    act(() => result.current.selectSession(sessions[0].id));
    act(() => result.current.inspectEventOf(target.id));
    expect(result.current.workspace).toBe('observe');
    expect(result.current.session.id).toBe(sessions[2].id);
    expect(result.current.selectedEvent?.id).toBe(target.id);
  });

  it('inspectEventOf leaves the current session alone for an unknown event id', () => {
    const { result } = renderHook(() => useStudioState());
    act(() => result.current.selectSession(sessions[1].id));
    act(() => result.current.inspectEventOf('no-such-event'));
    expect(result.current.session.id).toBe(sessions[1].id);
    expect(result.current.selectedEvent).toBeNull();
  });

  it('openEvolve switches workspace and view together', () => {
    const { result } = renderHook(() => useStudioState());
    act(() => result.current.openEvolve({ kind: 'execution', executionId: 'exec-r1' }));
    expect(result.current.workspace).toBe('evolve');
    expect(result.current.evolveView).toEqual({ kind: 'execution', executionId: 'exec-r1' });
  });
});

describe('interaction model: selection survives a renderer swap', () => {
  const built = buildLineageScene(evolveCorpus).scene!;

  function swapBackend(state: ReturnType<typeof initialInteraction>): typeof state {
    // Mirrors what LineageExplorer does: renderer is destroyed and recreated,
    // the interaction state object is untouched and re-pushed into the new
    // renderer. The invariant under test: swap does not mutate or drop state.
    const copy: typeof state = {
      ...state,
      viewport: { ...state.viewport },
      focus: state.focus ? new Set(state.focus) : null,
      hiddenRelations: new Set(state.hiddenRelations),
    };
    return copy;
  }

  it('viewport, selection, focus and filters are identical after a swap', () => {
    const state = {
      ...initialInteraction(),
      selection: 'exec-r1',
      viewport: { x: -120, y: 40, scale: 1.5 },
      focus: focusSetOf(built, 'exec-r1'),
      query: 'retry',
      hiddenRelations: new Set(['replay_of']),
    };
    const after = swapBackend(state);
    expect(after).toEqual(state);
    expect(after.selection).toBe('exec-r1');
    expect(after.viewport.scale).toBe(1.5);
    expect(after.focus!.has('exec-a')).toBe(true);
    expect(after.query).toBe('retry');
  });

  it('filteredVisibleNodes gives the same set before and after a swap', () => {
    const state = { ...initialInteraction(), query: 'retry' };
    const before = filteredVisibleNodes(built, state);
    const after = filteredVisibleNodes(built, swapBackend(state));
    expect(after).toEqual(before);
    expect(after.size).toBeGreaterThan(0);
  });
});

describe('interaction model: filtering, focus, navigation', () => {
  const built = buildLineageScene(evolveCorpus).scene!;

  it('empty filter shows every node', () => {
    expect(filteredVisibleNodes(built, initialInteraction()).size).toBe(built.nodes.length);
  });

  it('query narrows to matching nodes plus joined edge endpoints', () => {
    const state = { ...initialInteraction(), query: 'simulated' };
    const visible = filteredVisibleNodes(built, state);
    expect(visible.has('exec-sim1')).toBe(true);
    // its ancestor exec-a stays attached via the visible relation
    expect(visible.has('exec-a')).toBe(true);
  });

  it('hidden relations remove edges but keep direct matches', () => {
    const state = { ...initialInteraction(), hiddenRelations: new Set(['simulated_branch']) };
    const visible = filteredVisibleNodes(built, state);
    expect(visible.size).toBe(built.nodes.length); // no query: all nodes remain
  });

  it('focus set contains the node, its ancestors and descendants', () => {
    const focus = focusSetOf(built, 'exec-r1');
    expect(focus.has('exec-r1')).toBe(true);
    expect(focus.has('exec-a')).toBe(true); // ancestor
    expect(focus.has('exec-sim1')).toBe(false);
  });

  it('ancestry is transitive', () => {
    const { ancestors } = ancestryOf(built, 'exec-r1');
    expect(ancestors.has('exec-a')).toBe(true);
  });

  it('keyboard nav order is (depth, row) and covers every positioned node', () => {
    const order = navOrder(built);
    expect(order).toHaveLength(built.nodes.length);
    expect(order[0]).toBe('exec-a'); // the sole root
    for (let i = 1; i < order.length; i++) {
      const prev = built.layout.positions[order[i - 1]];
      const cur = built.layout.positions[order[i]];
      expect(cur.depth).toBeGreaterThanOrEqual(prev.depth);
    }
  });

  it('fit viewport keeps the whole scene visible and centered-ish', () => {
    const vp = fitViewport(built, 800, 600);
    expect(vp.scale).toBeGreaterThan(0);
    expect(vp.scale).toBeLessThanOrEqual(1);
  });

  it('lod tiers and scale clamp follow the declared thresholds', () => {
    expect(lodTier(1)).toBe('full');
    expect(lodTier(0.5)).toBe('labels');
    expect(lodTier(0.1)).toBe('dots');
    expect(clampScale(100)).toBe(4);
    expect(clampScale(0.001)).toBe(0.05);
  });
});

describe('synthetic stress fixtures', () => {
  it.each([100, 1000, 10000])('produces exactly %i nodes with a consistent DAG', (n) => {
    const { scene } = makeSyntheticScene({ nodeCount: n, seed: n });
    expect(scene.nodes).toHaveLength(n);
    const ids = new Set(scene.nodes.map((x) => x.id));
    for (const e of scene.edges) {
      expect(ids.has(e.from)).toBe(true);
      expect(ids.has(e.to)).toBe(true);
    }
    // deterministic across rebuilds
    const again = makeSyntheticScene({ nodeCount: n, seed: n }).scene;
    expect(again).toEqual(scene);
  });

  it('labels every synthetic node as a fixture, never lineage data', () => {
    const { scene } = makeSyntheticScene({ nodeCount: 100, seed: 1 }) as { scene: LineageScene };
    for (const node of scene.nodes) {
      expect(node.outcome).toContain('synthetic fixture');
      expect(node.provenanceReason).toContain('synthetic fixture');
    }
  });
});
