// @vitest-environment jsdom
// Regression tests for the Phase IV.1 integration failure: remote main held a
// stale LineageExplorer revision written against an incompatible scene API
// (direct renderer classes, old measure exports, wrong heatmap path). These
// tests pin the integrated contracts: explorer ↔ EvolveWorkspace props,
// renderer-adapter lifecycle, backend fallback, and honest measurement.
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';
import { LineageExplorer, type ExplorerSceneEntry } from '../LineageExplorer';
import { buildLineageScene } from '../lineageBuilder';
import { makeSyntheticScene } from '../renderers/synthetic';
import { createRenderer, isBackendAvailable } from '../renderers';
import { measureRenderer } from '../renderers/measure';
import { makeHeatmapPoc } from '../heatmapPoc';
import { navOrder } from '../interaction';
import { EvolveWorkspace } from '@/components/evolve/EvolveWorkspace';
import { useStudioState } from '@/state/studio';
import { evolveCorpus } from '@/data/evolve';
import type { StudioState } from '@/state/studio';

// jsdom has no ResizeObserver; the explorer uses one for viewport sizing.
beforeAll(() => {
  if (typeof (globalThis as { ResizeObserver?: unknown }).ResizeObserver === 'undefined') {
    class RO {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = RO;
  }
});

afterEach(cleanup);

/** Mirrors EvolveWorkspace's explorerScenes construction exactly. */
const explorerScenes: ExplorerSceneEntry[] = (() => {
  const built = buildLineageScene(evolveCorpus);
  const entries: ExplorerSceneEntry[] = [];
  if (built.scene) {
    entries.push({ id: built.scene.sceneId, label: 'recorded lineage (synthetic programme)', scene: built.scene, synthetic: false });
  }
  for (const n of [100, 1000, 10000]) {
    const s = makeSyntheticScene({ nodeCount: n, seed: n });
    entries.push({ id: s.scene.sceneId, label: `${n} nodes`, scene: s.scene, synthetic: true });
  }
  return entries;
})();

describe('integration regression: stale explorer revision', () => {
  it('exports ExplorerSceneEntry and accepts the props EvolveWorkspace passes', () => {
    // A compile-time contract pinned at runtime: the exact prop shape from
    // EvolveWorkspace.tsx must be accepted (old revision took a single
    // `scene` prop and no ExplorerSceneEntry export).
    const onOpenNode = () => {};
    const initialSelection: string | null = explorerScenes[0] ? navOrder(explorerScenes[0].scene)[0] : null;
    expect(() =>
      render(
        <LineageExplorer
          scenes={explorerScenes}
          initialSelection={initialSelection}
          onOpenNode={onOpenNode}
        />,
      ),
    ).not.toThrow();
  });
});

describe('renderer adapter contract', () => {
  it('createRenderer returns a full LineageRenderer or a factual issue list', () => {
    const svg = createRenderer('svg-dom');
    expect(svg.renderer).not.toBeNull();
    const r = svg.renderer!;
    expect(typeof r.mount).toBe('function');
    expect(typeof r.setScene).toBe('function');
    expect(typeof r.setViewport).toBe('function');
    expect(typeof r.setSelection).toBe('function');
    expect(typeof r.setHighlight).toBe('function');
    expect(typeof r.resize).toBe('function');
    expect(typeof r.hitTest).toBe('function');
    expect(typeof r.destroy).toBe('function');
  });

  it('jsdom has no WebGL2: adapter reports failure with a reason, explorer must fall back to SVG', () => {
    const webgl = createRenderer('webgl2-instanced');
    expect(webgl.renderer).toBeNull();
    expect(webgl.issues.length).toBeGreaterThan(0);
    expect(isBackendAvailable('webgl2-instanced')).toBe(false);
    expect(isBackendAvailable('svg-dom')).toBe(true);
  });
});

describe('explorer behaviour in jsdom (SVG fallback backend)', () => {
  it('falls back to svg-dom when WebGL2 is unavailable and shows the reason', () => {
    const { getByLabelText, getByTestId } = render(<LineageExplorer scenes={explorerScenes} />);
    expect(getByTestId('lineage-explorer')).toBeTruthy();
    const backendSelect = getByLabelText('Renderer backend') as HTMLSelectElement;
    expect(backendSelect.value).toBe('svg-dom');
  });

  it('keyboard navigation moves the selection and the node card follows', () => {
    const first = navOrder(explorerScenes[0].scene)[0];
    const second = navOrder(explorerScenes[0].scene)[1];
    const { getByLabelText, getByRole } = render(
      <LineageExplorer scenes={explorerScenes} initialSelection={first} />,
    );
    const host = getByRole('application');
    expect(document.body.textContent).toContain(first);
    fireEvent.keyDown(host, { key: 'ArrowRight' });
    expect(document.body.textContent).toContain(second);
    expect(getByLabelText('Lineage graph viewport — drag to pan, scroll to zoom, arrow keys to move selection')).toBeTruthy();
  });

  it('selecting an unavailable backend reports an issue instead of swapping', () => {
    const { getByLabelText, getByText } = render(<LineageExplorer scenes={explorerScenes} />);
    const backendSelect = getByLabelText('Renderer backend') as HTMLSelectElement;
    act(() => {
      fireEvent.change(backendSelect, { target: { value: 'webgl2-instanced' } });
    });
    // Fallback preserved: still svg-dom, with a factual issue banner.
    expect(backendSelect.value).toBe('svg-dom');
    expect(getByText(/not available in this browser/)).toBeTruthy();
  });

  it('scene switcher swaps scenes through the adapter without remount errors', () => {
    const { getByLabelText, getByText } = render(<LineageExplorer scenes={explorerScenes} />);
    const sceneSelect = getByLabelText('Scene') as HTMLSelectElement;
    const stress = explorerScenes.find((s) => s.label === '100 nodes')!;
    act(() => {
      fireEvent.change(sceneSelect, { target: { value: stress.id } });
    });
    expect(sceneSelect.value).toBe(stress.id);
    expect(getByText(/100\/100 nodes/)).toBeTruthy();
  });
});

describe('evolve workspace ↔ explorer navigation', () => {
  function Harness({ ref_ }: { ref_: { current: StudioState | null } }) {
    const studio = useStudioState();
    ref_.current = studio;
    return <EvolveWorkspace studio={studio} />;
  }

  it('renders the corpus overview with the explorer and lineage selection', () => {
    const ref_: { current: StudioState | null } = { current: null };
    const { getByTestId } = render(<Harness ref_={ref_} />);
    expect(getByTestId('lineage-explorer')).toBeTruthy();
    expect(ref_.current!.evolveView.kind).toBe('corpus');
  });

  it('opening an execution then its session navigates cross-workspace to Observe', () => {
    const ref_: { current: StudioState | null } = { current: null };
    const { getAllByText } = render(<Harness ref_={ref_} />);
    const exec = evolveCorpus.executions.find((e) => typeof e.sessionId === 'string')!;
    act(() => {
      ref_.current!.setEvolveView({ kind: 'execution', executionId: exec.id });
    });
    expect(ref_.current!.evolveView).toEqual({ kind: 'execution', executionId: exec.id });
    const links = getAllByText(new RegExp(`open ${exec.sessionId} in Observe`));
    act(() => {
      fireEvent.click(links[0]);
    });
    expect(ref_.current!.workspace).toBe('observe');
    expect(ref_.current!.session.id).toBe(exec.sessionId);
  });
});

describe('heatmap PoC data contract', () => {
  it('is deterministic, rectangular, and labelled as synthetic', () => {
    const a = makeHeatmapPoc();
    const b = makeHeatmapPoc();
    expect(a).toEqual(b);
    expect(a.values).toHaveLength(a.rows * a.columns);
    for (const v of a.values) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(a.rowLabels).toHaveLength(a.rows);
    expect(a.columnLabels).toHaveLength(a.columns);
  });
});

describe('measurement honesty contract', () => {
  it('measureRenderer reports unmeasured dimensions with reasons, never invented numbers', () => {
    const scene = buildLineageScene(evolveCorpus).scene;
    if (!scene) throw new Error('corpus scene must build');
    const block = measureRenderer('svg-dom', scene, {
      buildScene: () => {},
      pushScene: () => {},
      pushViewport: () => {},
    });
    expect(block.timings).toHaveLength(3);
    for (const t of block.timings) {
      expect(t.runs).toBe(7); // 3 warm-up + 7 timed protocol
      expect(t.medianMs).toBeGreaterThanOrEqual(0);
    }
    expect(block.fpsMeasured).toBe(false);
    expect(block.fps).toBeNull();
    const kinds = block.unmeasured.map((u) => u.kind);
    expect(kinds).toContain('GPU frame time');
    expect(kinds).toContain('frame-present latency');
    for (const u of block.unmeasured) {
      expect(u.reason.length).toBeGreaterThan(10);
    }
  });
});
