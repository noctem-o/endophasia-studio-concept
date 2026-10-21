// @vitest-environment jsdom
// Scene-build measurement must time the construction of the scene that is DISPLAYED, or say it did not. The explorer once passed
// `() => { void s.nodes.length; }` as the "scene build": a property lookup reported as a measurement. These tests make that
// mistake detectable at every layer: the harness, the real scene entries, the pass, and the explorer's wiring.
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { measureRenderer, MEASUREMENT_DEFINITIONS } from '../renderers/measure';
import { runMeasurementPass } from '../measurementPass';
import { explorerScenes } from '../explorerScenes';
import type { ExplorerSceneEntry } from '../sceneEntry';
import { LineageExplorer } from '../LineageExplorer';
import { buildLineageScene } from '../lineageBuilder';
import { makeSyntheticScene } from '../renderers/synthetic';
import { evolveCorpus } from '@/data/evolve';

beforeAll(() => {
  const g = globalThis as { ResizeObserver?: unknown };
  if (typeof g.ResizeObserver === 'undefined') g.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(cleanup);

const scene = buildLineageScene(evolveCorpus).scene!;
const other = makeSyntheticScene({ nodeCount: 100, seed: 100 }).scene;
const ops = { pushScene: () => {}, pushViewport: () => {} };
const isBuild = (k: string) => k.startsWith('scene build') || k.startsWith('scene generation') || k.startsWith('scene construction');
const buildKinds = (b: ReturnType<typeof measureRenderer>) => ({
  timed: b.timings.filter((t) => isBuild(t.kind)),
  unmeasured: b.unmeasured.filter((u) => isBuild(u.kind)),
});

describe('the harness refuses to time something that is not scene construction', () => {
  it('a no-op builder (the original mistake) is not timed', () => {
    const noop = vi.fn(() => {});
    const k = buildKinds(measureRenderer('svg-dom', scene, { buildScene: noop, ...ops }));
    expect(k.timed).toEqual([]);
    expect(k.unmeasured).toHaveLength(1);
    expect(k.unmeasured[0].reason).toMatch(/returned no scene/);
  });

  it('a property lookup that happens to return something is not timed either', () => {
    const lookup = () => null;
    const k = buildKinds(measureRenderer('svg-dom', scene, { buildScene: lookup, ...ops }));
    expect(k.timed).toEqual([]);
  });

  it('a builder that builds a DIFFERENT scene is not timed', () => {
    const k = buildKinds(measureRenderer('svg-dom', scene, { buildScene: () => other, ...ops }));
    expect(k.timed).toEqual([]);
    expect(k.unmeasured[0].reason).toMatch(/different scene/);
  });

  it('no builder: scene construction is reported unmeasured, with the reason', () => {
    const k = buildKinds(measureRenderer('svg-dom', scene, { buildScene: null, ...ops }));
    expect(k.timed).toEqual([]);
    expect(k.unmeasured[0].reason).toMatch(/arrived already built/);
  });

  it('a real builder of the displayed scene is verified once, then timed over the stated protocol', () => {
    const build = vi.fn(() => buildLineageScene(evolveCorpus).scene);
    const k = buildKinds(measureRenderer('svg-dom', scene, { buildScene: build, ...ops }));
    expect(k.timed).toHaveLength(1);
    expect(k.timed[0].runs).toBe(7);
    expect(build).toHaveBeenCalledTimes(1 + 3 + 7); // one verifying call, 3 warm-up, 7 timed
    expect(k.unmeasured).toEqual([]);
  });

  it('GPU execution and frame-present latency are always listed unmeasured', () => {
    const kinds = measureRenderer('svg-dom', scene, { buildScene: null, ...ops }).unmeasured.map((u) => u.kind);
    expect(kinds).toEqual(expect.arrayContaining(['GPU frame time', 'frame-present latency']));
  });

  it('every kind of figure has a definition that says what it is NOT', () => {
    for (const d of MEASUREMENT_DEFINITIONS) { expect(d.is.length).toBeGreaterThan(20); expect(d.isNot).toMatch(/^not /); }
    expect(MEASUREMENT_DEFINITIONS.map((d) => d.prefix)).toEqual(expect.arrayContaining(['scene build', 'scene upload', 'viewport apply', 'rAF cadence']));
  });
});

describe('the scenes the explorer offers carry representative builders', () => {
  const entries = explorerScenes.filter((e) => e.scene.nodes.length <= 1000); // keep the suite fast; the 10,000-node entry is checked below

  it.each(entries.map((e) => [e.label, e] as const))('%s: its builder reconstructs exactly the displayed scene', (_l, entry) => {
    expect(entry.build).toBeDefined();
    const rebuilt = entry.build!.run();
    expect(rebuilt).not.toBeNull();
    expect(rebuilt!.contentDigest).toBe(entry.scene.contentDigest);
    expect(rebuilt!.nodes).toHaveLength(entry.scene.nodes.length);
    expect(entry.build!.run()!.contentDigest).toBe(rebuilt!.contentDigest); // repeatable
  });

  it('labels a corpus build and a synthetic generation differently: they are not the same operation', () => {
    expect(explorerScenes.find((e) => !e.synthetic)!.build!.label).toBe('scene build (corpus → scene)');
    for (const e of explorerScenes.filter((x) => x.synthetic)) expect(e.build!.label).toBe('scene generation (synthetic fixture)');
  });

  it('the largest stress scene also reconstructs to the displayed digest', () => {
    const big = explorerScenes.find((e) => e.scene.nodes.length === 10000)!;
    expect(big.build!.run()!.contentDigest).toBe(big.scene.contentDigest);
  });
});

describe('a measurement pass', () => {
  const recorded = explorerScenes.find((e) => !e.synthetic)!;
  const fixture = explorerScenes.find((e) => e.scene.nodes.length === 100)!;

  it('times construction where a verified builder exists and reports it unmeasured where none does', () => {
    const noBuilder: ExplorerSceneEntry = { ...fixture, id: 'prebuilt', build: undefined };
    const blocks = runMeasurementPass('svg-dom', [recorded, fixture, noBuilder]);
    expect(blocks).toHaveLength(3);
    expect(blocks[0].timings.map((t) => t.kind)).toContain('scene build (corpus → scene)');
    expect(blocks[1].timings.map((t) => t.kind)).toContain('scene generation (synthetic fixture)');
    expect(blocks[2].timings.map((t) => t.kind).filter((k) => k.startsWith('scene c') || k.startsWith('scene g') || k.startsWith('scene b'))).toEqual([]);
    expect(blocks[2].unmeasured.map((u) => u.kind)).toContain('scene construction');
  });
});

describe('the explorer wires the entry builders into its measurement pass', () => {
  it('calls each entry\'s own builder, not an internal stand-in', async () => {
    const spy = vi.fn(() => buildLineageScene(evolveCorpus).scene);
    const recorded = explorerScenes.find((e) => !e.synthetic)!;
    const entries: ExplorerSceneEntry[] = [{ ...recorded, build: { label: 'scene build (corpus → scene)', run: spy } }];
    const { getByText, getAllByText } = render(<LineageExplorer scenes={entries} />);
    act(() => { fireEvent.click(getByText('diagnostics')); });
    await act(async () => { fireEvent.click(getByText(/run measurement pass/)); });
    await waitFor(() => expect(getAllByText(/scene build \(corpus → scene\):/).length).toBeGreaterThan(0), { timeout: 8000 });
    expect(spy).toHaveBeenCalledTimes(1 + 3 + 7);
  }, 15000);

  it('an entry with no builder shows scene construction as unmeasured in the panel', async () => {
    const recorded = explorerScenes.find((e) => !e.synthetic)!;
    const { getByText, findByText } = render(<LineageExplorer scenes={[{ ...recorded, build: undefined }]} />);
    act(() => { fireEvent.click(getByText('diagnostics')); });
    await act(async () => { fireEvent.click(getByText(/run measurement pass/)); });
    expect(await findByText(/scene construction: unmeasured/, {}, { timeout: 8000 })).toBeTruthy();
  }, 15000);
});
