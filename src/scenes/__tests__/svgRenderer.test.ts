// @vitest-environment jsdom
// Regression: the SVG backend built its <svg> in mount() but never attached it to the host, so it drew nothing in a real
// browser (the tests ran in jsdom and never looked inside the host). These tests inspect the DOM the backend actually produces.
import { describe, it, expect } from 'vitest';
import { createSvgRenderer } from '../renderers/svgRenderer';
import { buildLineageScene } from '../lineageBuilder';
import { evolveCorpus } from '@/data/evolve';
import { nodePaint } from '../renderers/palette';

const scene = buildLineageScene(evolveCorpus).scene!;

function mounted() {
  const { renderer } = createSvgRenderer();
  const host = document.createElement('div');
  document.body.appendChild(host);
  renderer!.mount(host, { onNodeClick: () => {} });
  renderer!.resize(800, 600);
  renderer!.setScene(scene);
  return { renderer: renderer!, host };
}

describe('svg-dom backend draws into its host', () => {
  it('attaches an <svg> to the host, with one group per node and one path per edge', () => {
    const { host } = mounted();
    const svg = host.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.querySelectorAll('[data-node-id]')).toHaveLength(scene.nodes.length);
    expect(svg!.querySelectorAll('path[marker-end]')).toHaveLength(scene.edges.length);
  });

  it('applies the camera to the content group, and follows viewport changes', () => {
    const { renderer, host } = mounted();
    renderer.setViewport({ x: 12, y: 34, scale: 0.5 });
    expect(host.querySelector('svg > g')!.getAttribute('transform')).toBe('translate(12 34) scale(0.5)');
  });

  it('marks the selected node and keeps every node in the DOM when selection changes', () => {
    const { renderer, host } = mounted();
    const id = scene.nodes[1].id;
    renderer.setSelection(id);
    const groups = host.querySelectorAll('[data-node-id]');
    expect(groups).toHaveLength(scene.nodes.length);
    const sel = host.querySelector(`[data-node-id="${id}"] rect`)!;
    expect(sel.getAttribute('stroke')).toBe(nodePaint(scene.nodes[1].classification, { selected: true, dimmed: false }).stroke.hex);
  });

  it('draws a simulated projection hollow and dashed, and a node without a session with an explicit gap marker', () => {
    const { host } = mounted();
    const sim = scene.nodes.find((n) => n.classification === 'simulated-projection')!;
    const ring = host.querySelectorAll(`[data-node-id="${sim.id}"] rect`)[1];
    expect(ring.getAttribute('stroke-dasharray')).toBeTruthy();
    const gapNode = scene.nodes.find((n) => n.sessionId === null)!;
    expect(host.querySelector(`[data-node-id="${gapNode.id}"] circle[stroke-dasharray]`)).not.toBeNull();
  });

  it('hit-tests a node at its own screen position and nothing in empty space', () => {
    const { renderer, host } = mounted();
    host.getBoundingClientRect = () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0, toJSON() {} });
    renderer.setViewport({ x: 0, y: 0, scale: 1 });
    const first = scene.nodes[0];
    const p = scene.layout.positions[first.id];
    const x = 20 + p.column * scene.encoding.columnGap + 5;
    const y = 20 + p.row * scene.encoding.rowGap + 5;
    expect(renderer.hitTest(x, y)).toBe(first.id);
    expect(renderer.hitTest(790, 590)).toBeNull();
  });

  it('removes its <svg> from the host on destroy', () => {
    const { renderer, host } = mounted();
    renderer.destroy();
    expect(host.querySelector('svg')).toBeNull();
  });
});
