import type { LineageScene } from './types';
import type { Viewport } from './renderers/types';

/**
 * Renderer-independent interaction model. Viewport, selection, filtering and
 * focus are application state; the renderer is a disposable view of it.
 * Switching backends must preserve all of it, which falls out structurally:
 * none of this state ever enters a renderer except as pushed data.
 */

export interface InteractionState {
  viewport: Viewport;
  selection: string | null;
  /** Ancestor/descendant focus set (null = no focus mode). */
  focus: Set<string> | null;
  /** Substring filter on node label or id; empty string = no filter. */
  query: string;
  /** Relations to hide; empty set = show all. */
  hiddenRelations: Set<string>;
  selectedSceneId: string | null;
}

export function initialInteraction(): InteractionState {
  return {
    viewport: { x: 0, y: 0, scale: 1 },
    selection: null,
    focus: null,
    query: '',
    hiddenRelations: new Set(),
    selectedSceneId: null,
  };
}

/** Ancestors (things this node derives from) and descendants. Corpus direction: from = child, to = ancestor. */
export function ancestryOf(scene: LineageScene, nodeId: string): { ancestors: Set<string>; descendants: Set<string> } {
  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  for (const e of scene.edges) {
    if (!parents.has(e.from)) parents.set(e.from, []);
    parents.get(e.from)!.push(e.to);
    if (!children.has(e.to)) children.set(e.to, []);
    children.get(e.to)!.push(e.from);
  }
  const walk = (id: string, into: Set<string>, via: Map<string, string[]>) => {
    for (const next of via.get(id) ?? []) {
      if (!into.has(next)) {
        into.add(next);
        walk(next, into, via);
      }
    }
  };
  const ancestors = new Set<string>();
  walk(nodeId, ancestors, parents);
  const descendants = new Set<string>();
  walk(nodeId, descendants, children);
  return { ancestors, descendants };
}

/** Focus set for a node: itself, its ancestors and its descendants. */
export function focusSetOf(scene: LineageScene, nodeId: string): Set<string> {
  const { ancestors, descendants } = ancestryOf(scene, nodeId);
  const set = new Set<string>([nodeId, ...ancestors, ...descendants]);
  return set;
}

/**
 * Filtered node set: query match on label/id, plus edge endpoints joined over
 * visible relations so a match's immediate context stays readable.
 * Deterministic and renderer-independent.
 */
export function filteredVisibleNodes(scene: LineageScene, state: InteractionState): Set<string> {
  const q = state.query.trim().toLowerCase();
  const matches = new Set<string>();
  for (const n of scene.nodes) {
    if (q === '' || n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)) matches.add(n.id);
  }
  if (q === '' && state.hiddenRelations.size === 0) return matches;

  const keep = new Set(matches);
  if (matches.size > 0) {
    for (const e of scene.edges) {
      if (state.hiddenRelations.has(e.relation)) continue;
      if (keep.has(e.from)) keep.add(e.to);
      if (keep.has(e.to)) keep.add(e.from);
    }
  }
  return keep;
}

/** Semantic zoom: three declared LOD tiers. Thresholds are presentation policy. */
export type LodTier = 'full' | 'labels' | 'dots';

export function lodTier(scale: number): LodTier {
  if (scale >= 0.8) return 'full';
  if (scale >= 0.3) return 'labels';
  return 'dots';
}

export const LOD_THRESHOLDS = { full: 0.8, labels: 0.3 } as const;

/** World-space scene bounds for fit/zoom-to-fit and the minimap. */
export function sceneBounds(scene: LineageScene): { width: number; height: number } {
  let maxCol = 0;
  let maxRow = 0;
  for (const p of Object.values(scene.layout.positions)) {
    maxCol = Math.max(maxCol, p.column);
    maxRow = Math.max(maxRow, p.row);
  }
  return {
    width: 40 + maxCol * scene.encoding.columnGap + scene.encoding.nodeWidth,
    height: 40 + maxRow * scene.encoding.rowGap + scene.encoding.nodeHeight,
  };
}

export function fitViewport(scene: LineageScene, viewW: number, viewH: number): Viewport {
  const b = sceneBounds(scene);
  const scale = Math.min(1, Math.min(viewW / b.width, viewH / b.height));
  return {
    scale,
    x: (viewW - b.width * scale) / 2,
    y: (viewH - b.height * scale) / 2,
  };
}

/** Keyboard navigation order: nodes sorted by (depth, row) — reading order. */
export function navOrder(scene: LineageScene): string[] {
  return scene.nodes
    .map((n) => ({ id: n.id, p: scene.layout.positions[n.id] }))
    .filter((x) => x.p)
    .sort((a, b) => a.p.depth - b.p.depth || a.p.row - b.p.row)
    .map((x) => x.id);
}

/** Clamp scale into the declared zoom range. */
export function clampScale(scale: number): number {
  return Math.min(4, Math.max(0.05, scale));
}

// ─── Coordinate convention (the single documented mapping) ───────────────────
//
//   screen = world * scale + offset
//
// `offset` is viewport.x/.y in CSS pixels; `scale` is unitless. Every backend
// (SVG group transform, WebGL camera uniform, CPU hit-testing, pan and zoom
// about the cursor, fit, zoom-to-selection, minimap) must go through these two
// pure functions. screenFromWorld ∘ worldFromScreen is the identity.

export function screenFromWorld(vp: Viewport, wx: number, wy: number): { x: number; y: number } {
  return { x: wx * vp.scale + vp.x, y: wy * vp.scale + vp.y };
}

export function worldFromScreen(vp: Viewport, sx: number, sy: number): { x: number; y: number } {
  return { x: (sx - vp.x) / vp.scale, y: (sy - vp.y) / vp.scale };
}

/** Zoom keeping the world point under the cursor stationary. */
export function zoomAbout(vp: Viewport, nextScale: number, screenX: number, screenY: number): Viewport {
  const s = clampScale(nextScale);
  const before = worldFromScreen(vp, screenX, screenY);
  return { scale: s, x: screenX - before.x * s, y: screenY - before.y * s };
}

/** Center the viewport on a node's world rect at a target scale. */
export function zoomToNode(
  scene: LineageScene,
  nodeId: string,
  viewW: number,
  viewH: number,
  targetScale = 1,
): Viewport | null {
  const p = scene.layout.positions[nodeId];
  if (!p) return null;
  const wx = 20 + p.column * scene.encoding.columnGap + scene.encoding.nodeWidth / 2;
  const wy = 20 + p.row * scene.encoding.rowGap + scene.encoding.nodeHeight / 2;
  const s = clampScale(targetScale);
  return { scale: s, x: viewW / 2 - wx * s, y: viewH / 2 - wy * s };
}
