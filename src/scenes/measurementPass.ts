import { createRenderer, type BackendId } from './renderers';
import { measureRenderer, type MeasurementBlock } from './renderers/measure';
import type { ExplorerSceneEntry } from './sceneEntry';

/**
 * One measurement pass: for every scene on offer, mount the chosen backend into a hidden host, and time scene construction (when
 * the entry supplies a verified builder), scene upload and viewport apply. Everything it returns is a CPU-side main-thread
 * timing; see MEASUREMENT_DEFINITIONS for what each figure is not.
 */
export function runMeasurementPass(backend: BackendId, entries: ExplorerSceneEntry[]): MeasurementBlock[] {
  const blocks: MeasurementBlock[] = [];
  for (const entry of entries) {
    const s = entry.scene;
    const renderer = createRenderer(backend).renderer;
    if (!renderer) continue;
    const host = document.createElement('div');
    host.style.width = '800px';
    host.style.height = '600px';
    host.style.position = 'absolute';
    host.style.opacity = '0';
    host.style.pointerEvents = 'none';
    document.body.appendChild(host);
    try {
      renderer.mount(host, { onNodeClick: () => {} });
      renderer.resize(800, 600);
      blocks.push(measureRenderer(backend, s, {
        buildScene: entry.build ? entry.build.run : null,
        buildLabel: entry.build?.label,
        pushScene: () => renderer.setScene(s),
        pushViewport: () => renderer.setViewport({ x: 0, y: 0, scale: 0.9 }),
      }));
    } finally {
      renderer.destroy();
      host.remove();
    }
  }
  return blocks;
}
