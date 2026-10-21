import { evolveCorpus } from '@/data/evolve';
import { buildLineageScene } from './lineageBuilder';
import { makeSyntheticScene } from './renderers/synthetic';
import type { ExplorerSceneEntry } from './sceneEntry';

/**
 * The scenes the explorer offers: the recorded lineage built from the corpus, plus synthetic stress fixtures. Each carries the
 * operation that constructs it, so the diagnostics can time scene construction on the scene actually displayed.
 */
export const explorerScenes: ExplorerSceneEntry[] = (() => {
  const built = buildLineageScene(evolveCorpus);
  const entries: ExplorerSceneEntry[] = [];
  if (built.scene) {
    entries.push({
      id: built.scene.sceneId,
      label: 'recorded lineage (synthetic programme)',
      scene: built.scene,
      synthetic: false,
      build: { label: 'scene build (corpus → scene)', run: () => buildLineageScene(evolveCorpus).scene },
    });
  }
  for (const n of [100, 1000, 10000]) {
    const s = makeSyntheticScene({ nodeCount: n, seed: n });
    entries.push({
      id: s.scene.sceneId,
      label: `${n} nodes`,
      scene: s.scene,
      synthetic: true,
      build: { label: 'scene generation (synthetic fixture)', run: () => makeSyntheticScene({ nodeCount: n, seed: n }).scene },
    });
  }
  return entries;
})();
