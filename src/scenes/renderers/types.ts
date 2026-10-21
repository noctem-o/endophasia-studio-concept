import type { LineageScene } from '../types';

/**
 * Renderer adapter contract. A renderer receives scene DATA and draws it.
 * It never receives code, HTML strings, or markup-bearing labels; renderers
 * own presentation only. Scientific meaning lives in the scene.
 *
 * The interaction model (viewport, selection, highlight) lives outside the
 * renderer: the application holds it as plain state and pushes it in. Any
 * renderer can therefore be swapped without changing what the user has
 * selected or where the camera is.
 */

/** Camera state in world → screen form: screen = world * scale + offset. */
export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

export interface RendererInfo {
  /** Stable identifier of the backend implementation. */
  backendId: 'svg-dom' | 'webgl2-instanced';
  kind: 'svg' | 'webgl2';
  /** Capability details as measured at creation time, or explicit 'not available'. */
  details: string;
}

export interface RendererEventHandlers {
  onNodeClick: (nodeId: string | null) => void;
}

export interface LineageRenderer {
  readonly info: RendererInfo;
  mount(host: HTMLDivElement, handlers: RendererEventHandlers): void;
  setScene(scene: LineageScene): void;
  setViewport(vp: Viewport): void;
  setSelection(nodeId: string | null): void;
  /** Focus set: nodes to keep at full emphasis; null clears. */
  setHighlight(nodeIds: Set<string> | null): void;
  resize(width: number, height: number): void;
  hitTest(clientX: number, clientY: number): string | null;
  destroy(): void;
}

export interface CreateRendererResult {
  renderer: LineageRenderer | null;
  /** Explicit, factual creation notes (probe results, fallback reasons). */
  issues: string[];
}

export const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, scale: 1 };
