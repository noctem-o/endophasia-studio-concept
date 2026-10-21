import type { CreateRendererResult, LineageRenderer } from './types';
import { createSvgRenderer } from './svgRenderer';
import { createWebglRenderer } from './webglRenderer';

export type BackendId = 'svg-dom' | 'webgl2-instanced';

export const BACKENDS: { id: BackendId; label: string; description: string }[] = [
  { id: 'svg-dom', label: 'SVG (DOM)', description: 'one element per graph element; text natively; broadest compatibility' },
  { id: 'webgl2-instanced', label: 'WebGL2 (instanced)', description: 'two draw calls per frame; DOM text overlay; requires WebGL2' },
];

/** Try a backend by id. Returned issues are factual creation notes. */
export function createRenderer(id: BackendId): CreateRendererResult {
  switch (id) {
    case 'svg-dom':
      return createSvgRenderer();
    case 'webgl2-instanced':
      return createWebglRenderer();
  }
}

export function isBackendAvailable(id: BackendId): boolean {
  return createRenderer(id).renderer !== null;
}

export type { LineageRenderer };
