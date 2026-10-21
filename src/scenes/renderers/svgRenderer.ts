import type { LineageScene } from '../types';
import type { CreateRendererResult, LineageRenderer, RendererEventHandlers, RendererInfo, Viewport } from './types';
import { CLASSIFICATION_TAG, nodePaint, PROVENANCE_BADGE, RAW, RELATION_STYLE_HEX } from './palette';
import { worldFromScreen } from '../interaction';

/**
 * SVG DOM backend: one <g> per node, one <path> per edge, direct DOM.
 * This is the reference implementation — its semantics are the contract the
 * WebGL backend must reproduce. DOM nodes give free hit-testing and text
 * rendering; the cost is one DOM element per graph element, which the
 * benchmark harness measures rather than asserts.
 */

const NODE_W = 178;
const NODE_H = 46;
const COL_GAP = 250;
const ROW_GAP = 62;

const SVG_NS = 'http://www.w3.org/2000/svg';

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag) as SVGElementTagNameMap[K];
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

export function createSvgRenderer(): CreateRendererResult {
  const issues: string[] = [];
  if (typeof document === 'undefined') {
    return { renderer: null, issues: ['document unavailable — SVG backend requires a DOM'] };
  }

  let host: HTMLDivElement | null = null;
  let svg: SVGSVGElement | null = null;
  let handlers: RendererEventHandlers | null = null;
  let scene: LineageScene | null = null;
  let viewport: Viewport = { x: 0, y: 0, scale: 1 };
  let selection: string | null = null;
  let highlight: Set<string> | null = null;
  let width = 0;
  let height = 0;

  let edgeLayer: SVGGElement | null = null;
  let nodeLayer: SVGGElement | null = null;
  let rootGroup: SVGGElement | null = null;
  let nodeEls = new Map<string, SVGGElement>();

  const info: RendererInfo = {
    backendId: 'svg-dom',
    kind: 'svg',
    details: 'one SVG element per graph element; DOM hit-testing; text via <text>',
  };

  // Dimming lives on the node groups, which setScene rebuilds (and selection rebuilds the scene), so it is reapplied after every build.
  const applyHighlight = () => {
    for (const [id, g] of nodeEls) g.setAttribute('opacity', highlight !== null && !highlight.has(id) ? '0.25' : '1');
  };

  const applyTransform = () => {
    // Convention: screen = world * scale + offset. Applied to the content
    // group — the outer <svg> is a fixed-size viewport element and ignores a
    // transform attribute of this form.
    if (rootGroup) rootGroup.setAttribute('transform', `translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`);
  };

  const worldFromEvent = (cx: number, cy: number): { x: number; y: number } | null => {
    if (!host) return null;
    const rect = host.getBoundingClientRect();
    // Convention-shared inverse mapping, in CSS pixels.
    return worldFromScreen(viewport, cx - rect.left, cy - rect.top);
  };

  const renderer: LineageRenderer = {
    info,
    mount(h, eventHandlers) {
      host = h;
      handlers = eventHandlers;
      svg = el('svg', { width: '100%', height: '100%', role: 'img' });
      if (svg) svg.style.display = 'block';
      rootGroup = el('g', { 'aria-label': 'lineage scene' });
      edgeLayer = el('g', {});
      nodeLayer = el('g', {});
      rootGroup.appendChild(edgeLayer);
      rootGroup.appendChild(nodeLayer);
      svg.appendChild(rootGroup);
      // Attach to the host. Without this the SVG is built and never shown: the backend drew nothing in a real browser.
      h.appendChild(svg);

      h.addEventListener('click', (ev: MouseEvent) => {
        const nodeId = renderer.hitTest(ev.clientX, ev.clientY);
        handlers?.onNodeClick(nodeId);
      });
    },
    setScene(s) {
      scene = s;
      if (!svg || !edgeLayer || !nodeLayer) return;
      // Full rebuild. Incremental DOM diffing is possible; the benchmark
      // measures this implementation as written (full rebuild per scene).
      edgeLayer.textContent = '';
      nodeLayer.textContent = '';
      nodeEls = new Map();

      const defs = el('defs', {});
      const marker = el('marker', { id: 'svg-arrow', viewBox: '0 0 8 8', refX: 7, refY: 4, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
      const arrow = el('path', { d: 'M0,0 L8,4 L0,8', fill: 'none', stroke: RAW.lineStrong, 'stroke-width': 1.4 });
      marker.appendChild(arrow);
      defs.appendChild(marker);
      edgeLayer.appendChild(defs);

      const pos = s.layout.positions;
      for (const e of s.edges) {
        const a = pos[e.from];
        const b = pos[e.to];
        if (!a || !b) continue;
        const ax = 20 + a.column * COL_GAP + NODE_W;
        const ay = 20 + a.row * ROW_GAP + NODE_H / 2;
        const bx = 20 + b.column * COL_GAP;
        const by = 20 + b.row * ROW_GAP + NODE_H / 2;
        const mx = (ax + bx) / 2;
        const style = RELATION_STYLE_HEX[e.relation];
        const path = el('path', {
          d: `M ${ax} ${ay} C ${mx} ${ay}, ${mx} ${by}, ${bx - 4} ${by}`,
          fill: 'none',
          stroke: style.stroke,
          'stroke-width': 1.4,
          opacity: 0.7,
          'marker-end': 'url(#svg-arrow)',
        });
        if (style.dash) path.setAttribute('stroke-dasharray', `${style.dash[0]} ${style.dash[1]}`);
        edgeLayer.appendChild(path);
      }

      const nodeById = new Map(s.nodes.map((n) => [n.id, n]));
      for (const n of s.nodes) {
        const p = pos[n.id];
        if (!p) continue;
        const x = 20 + p.column * COL_GAP;
        const y = 20 + p.row * ROW_GAP;
        const tag = CLASSIFICATION_TAG[n.classification];
        const prov = PROVENANCE_BADGE[n.provenance];

        const g = el('g', { transform: `translate(${x} ${y})`, 'data-node-id': n.id });
        const selected = n.id === selection;
        const paint = nodePaint(n.classification, { selected, dimmed: false });
        const bg = el('rect', {
          width: NODE_W, height: NODE_H, rx: 4,
          fill: paint.fill.hex, 'fill-opacity': paint.fill.alpha,
          stroke: selected ? paint.stroke.hex : 'none', 'stroke-width': selected ? 1.5 : 0,
        });
        const ring = el('rect', { width: NODE_W, height: NODE_H, rx: 4, fill: 'none', stroke: paint.stroke.hex, 'stroke-opacity': selected ? 0 : paint.stroke.alpha, 'stroke-width': 1, ...(paint.hollow ? { 'stroke-dasharray': '4 3' } : {}) });
        const tagText = el('text', { x: 10, y: 17, fill: tag.color, 'font-size': 9, 'font-family': 'IBM Plex Mono, monospace', 'letter-spacing': 0.8 });
        tagText.textContent = tag.label;
        const label = el('text', { x: 10, y: 31, fill: RAW.fg1, 'font-size': 11, 'font-family': 'IBM Plex Sans, sans-serif' });
        label.textContent = n.label.length > 25 ? n.label.slice(0, 24) + '…' : n.label;
        const sub = el('text', { x: 10, y: 41, fill: RAW.fg3, 'font-size': 9, 'font-family': 'IBM Plex Mono, monospace' });
        sub.textContent = n.sessionId ? n.sessionId : 'trajectory not in registry';
        g.appendChild(bg);
        g.appendChild(ring);
        g.appendChild(tagText);
        g.appendChild(label);
        g.appendChild(sub);

        // Provenance badge: the class's SHAPE (disc / half / diamond / dashed ring) plus its three letters, so it survives colour-blindness.
        const provBadge = el('text', { x: NODE_W - 10, y: 17, fill: prov.color, 'font-size': 9, 'text-anchor': 'end', 'font-family': 'IBM Plex Mono, monospace', 'letter-spacing': 0.8 });
        provBadge.textContent = prov.label;
        g.appendChild(provBadge);
        const gx = NODE_W - 10 - prov.label.length * 6.2 - 7;
        const gy = 14;
        if (prov.glyph === 'disc') g.appendChild(el('circle', { cx: gx, cy: gy, r: 3.4, fill: prov.color }));
        else if (prov.glyph === 'half') {
          g.appendChild(el('circle', { cx: gx, cy: gy, r: 3.1, fill: 'none', stroke: prov.color, 'stroke-width': 1.1 }));
          g.appendChild(el('path', { d: `M${gx} ${gy - 3.1}a3.1 3.1 0 0 0 0 6.2z`, fill: prov.color }));
        } else if (prov.glyph === 'diamond') g.appendChild(el('path', { d: `M${gx} ${gy - 4}l4 4l-4 4l-4 -4z`, fill: prov.color }));
        else g.appendChild(el('circle', { cx: gx, cy: gy, r: 3.1, fill: 'none', stroke: prov.color, 'stroke-width': 1, 'stroke-dasharray': '1.6 1.4' }));

        // Explicit gap marker: no trajectory in the observation registry. A hollow dashed ring (the N/A shape), clear of the badge.
        if (n.sessionId === null) {
          g.appendChild(el('circle', { cx: NODE_W - 12, cy: NODE_H - 10, r: 4, fill: 'none', stroke: RAW.na, 'stroke-width': 1.2, 'stroke-dasharray': '2 1.8' }));
        }

      nodeLayer.appendChild(g);
      nodeEls.set(n.id, g);
      void nodeById;
      }
      applyTransform();
      applyHighlight();
    },
    setViewport(vp) {
      viewport = vp;
      applyTransform();
    },
    setSelection(nodeId) {
      selection = nodeId;
      if (scene) this.setScene(scene);
    },
    setHighlight(ids) {
      highlight = ids;
      applyHighlight();
    },
    resize(w, h) {
      width = w;
      height = h;
      if (svg) {
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      }
    },
    hitTest(clientX, clientY) {
      if (!host) return null;
      const world = worldFromEvent(clientX, clientY);
      if (!world) return null;
      for (const n of scene?.nodes ?? []) {
        const p = scene?.layout.positions[n.id];
        if (!p) continue;
        const x = 20 + p.column * COL_GAP;
        const y = 20 + p.row * ROW_GAP;
        if (world.x >= x && world.x <= x + NODE_W && world.y >= y && world.y <= y + NODE_H) return n.id;
      }
      return null;
    },
    destroy() {
      if (svg) svg.remove();
      svg = null;
      host = null;
      rootGroup = null;
      nodeLayer = null;
      edgeLayer = null;
      nodeEls = new Map();
      void width;
      void height;
    },
  };

  return { renderer, issues };
}
