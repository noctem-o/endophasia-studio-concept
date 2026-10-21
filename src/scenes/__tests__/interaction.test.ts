import { describe, expect, it } from 'vitest';
import {
  clampScale,
  fitViewport,
  screenFromWorld,
  sceneBounds,
  worldFromScreen,
  zoomAbout,
  zoomToNode,
} from '../interaction';
import { buildLineageScene } from '../lineageBuilder';
import { makeSyntheticScene } from '../renderers/synthetic';
import { evolveCorpus } from '@/data/evolve';
import type { LineageScene } from '../types';

const corpusScene = buildLineageScene(evolveCorpus).scene as LineageScene;

const viewW = 1200;
const viewH = 800;

// A canonical world point: the center of the scene bounds.
const bounds = sceneBounds(corpusScene);
const worldPoint = { x: bounds.width / 2, y: bounds.height / 2 };

// A canonical screen point near the middle of the view.
const screenPoint = { x: 640, y: 371 };

describe('coordinate convention: screen = world * scale + offset', () => {
  it.each([0.05, 0.3, 1, 2.5, 4])('round-trips at scale %f', (scale) => {
    const vp = { x: 173, y: -64, scale };
    const fwd = screenFromWorld(vp, worldPoint.x, worldPoint.y);
    const back = worldFromScreen(vp, fwd.x, fwd.y);
    expect(back.x).toBeCloseTo(worldPoint.x, 10);
    expect(back.y).toBeCloseTo(worldPoint.y, 10);

    const fwd2 = worldFromScreen(vp, screenPoint.x, screenPoint.y);
    const back2 = screenFromWorld(vp, fwd2.x, fwd2.y);
    expect(back2.x).toBeCloseTo(screenPoint.x, 10);
    expect(back2.y).toBeCloseTo(screenPoint.y, 10);
  });

  it.each([173, -912, 0, 4096])('round-trips at offset x=%f', (x) => {
    const vp = { x, y: 12, scale: 1.5 };
    const fwd = screenFromWorld(vp, worldPoint.x, worldPoint.y);
    const back = worldFromScreen(vp, fwd.x, fwd.y);
    expect(back.x).toBeCloseTo(worldPoint.x, 10);
    expect(back.y).toBeCloseTo(worldPoint.y, 10);
  });

  it('matches the SVG group transform interpretation', () => {
    // SVG uses translate(offset) scale(scale) applied to world coords; the
    // resulting screen position of a world point must equal screenFromWorld.
    const vp = { x: 80, y: 40, scale: 1.25 };
    const wx = 37;
    const wy = 51;
    const svgX = vp.x + vp.scale * wx; // translate then scale on world coords
    const svgY = vp.y + vp.scale * wy;
    const s = screenFromWorld(vp, wx, wy);
    expect(s.x).toBe(svgX);
    expect(s.y).toBe(svgY);
  });
});

describe('zoomAbout keeps the cursor world point stationary', () => {
  it('preserves the world point under the cursor across zoom levels', () => {
    let vp = fitViewport(corpusScene, viewW, viewH);
    const anchor = worldFromScreen(vp, screenPoint.x, screenPoint.y);
    for (const target of [0.1, 0.42, 1, 1.7, 4, 0.05]) {
      vp = zoomAbout(vp, target, screenPoint.x, screenPoint.y);
      const after = worldFromScreen(vp, screenPoint.x, screenPoint.y);
      expect(after.x).toBeCloseTo(anchor.x, 10);
      expect(after.y).toBeCloseTo(anchor.y, 10);
      expect(vp.scale).toBe(clampScale(target));
    }
  });

  it('clamps scale into the declared zoom range', () => {
    const vp = { x: 0, y: 0, scale: 1 };
    expect(zoomAbout(vp, 100, 0, 0).scale).toBe(4);
    expect(zoomAbout(vp, 0.0001, 0, 0).scale).toBe(0.05);
  });
});

describe('zoomToNode centers the node', () => {
  it('maps the node center to the viewport center for every node', () => {
    for (const n of corpusScene.nodes) {
      const vp = zoomToNode(corpusScene, n.id, viewW, viewH, 1.5);
      expect(vp).not.toBeNull();
      const p = corpusScene.layout.positions[n.id];
      const wx = 20 + p.column * corpusScene.encoding.columnGap + corpusScene.encoding.nodeWidth / 2;
      const wy = 20 + p.row * corpusScene.encoding.rowGap + corpusScene.encoding.nodeHeight / 2;
      const s = screenFromWorld(vp!, wx, wy);
      expect(s.x).toBeCloseTo(viewW / 2, 10);
      expect(s.y).toBeCloseTo(viewH / 2, 10);
    }
  });

  it('returns null for an unknown node id', () => {
    expect(zoomToNode(corpusScene, 'does-not-exist', viewW, viewH)).toBeNull();
  });
});

describe('fitViewport', () => {
  it('places the whole scene inside the view and never exceeds scale 1', () => {
    const vp = fitViewport(corpusScene, viewW, viewH);
    const tl = screenFromWorld(vp, 0, 0);
    const br = screenFromWorld(vp, bounds.width, bounds.height);
    expect(tl.x).toBeGreaterThanOrEqual(0);
    expect(tl.y).toBeGreaterThanOrEqual(0);
    expect(br.x).toBeLessThanOrEqual(viewW);
    expect(br.y).toBeLessThanOrEqual(viewH);
    expect(vp.scale).toBeLessThanOrEqual(1);
  });
});

describe('synthetic scenes obey the same convention', () => {
  const synthetic = makeSyntheticScene({ nodeCount: 64, seed: 7 }).scene;
  it('zoomToNode centers a node in a synthetic scene', () => {
    const n = synthetic.nodes[13];
    const vp = zoomToNode(synthetic, n.id, viewW, viewH, 2);
    expect(vp).not.toBeNull();
    const p = synthetic.layout.positions[n.id];
    const wx = 20 + p.column * synthetic.encoding.columnGap + synthetic.encoding.nodeWidth / 2;
    const wy = 20 + p.row * synthetic.encoding.rowGap + synthetic.encoding.nodeHeight / 2;
    const s = screenFromWorld(vp!, wx, wy);
    expect(s.x).toBeCloseTo(viewW / 2, 10);
    expect(s.y).toBeCloseTo(viewH / 2, 10);
  });
});
