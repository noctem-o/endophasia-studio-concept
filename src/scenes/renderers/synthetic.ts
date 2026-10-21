import type { LineageScene } from '../types';

/**
 * Deterministic synthetic scene generator for renderer stress fixtures.
 * These are synthetic graph fixtures for measuring renderers — explicitly NOT
 * experimental results, and never presented as lineage data.
 *
 * Structure: a trunk of `layers` depth; each layer fans out to a controlled
 * number of children, giving a balanced DAG with a declared edge count.
 */

export interface SyntheticSceneSpec {
  nodeCount: number;
  /** Deterministic seed for the fan-out jitter. */
  seed: number;
  label?: string;
}

export interface SyntheticScene {
  scene: LineageScene;
  spec: SyntheticSceneSpec;
}

/** Small deterministic PRNG (mulberry32) — same seed, same graph. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeSyntheticScene(spec: SyntheticSceneSpec): SyntheticScene {
  const rand = mulberry32(spec.seed);

  // Layer sizes: distribute nodeCount across ~sqrt(n) layers, then jitter.
  const targetLayers = Math.max(4, Math.round(Math.sqrt(spec.nodeCount)));
  const perLayer = Math.max(1, Math.floor(spec.nodeCount / targetLayers));
  const layerCounts: number[] = [];
  let assigned = 0;
  for (let i = 0; i < targetLayers; i++) {
    const remaining = spec.nodeCount - assigned;
    const layersLeft = targetLayers - i;
    const n = i === targetLayers - 1 ? remaining : Math.min(perLayer, remaining - (layersLeft - 1));
    layerCounts.push(n);
    assigned += n;
  }

  const nodes: LineageScene['nodes'][number][] = [];
  const edges: LineageScene['edges'] = [];
  const layerIds: string[][] = [];

  let counter = 0;
  for (let d = 0; d < layerCounts.length; d++) {
    const ids: string[] = [];
    for (let r = 0; r < layerCounts[d]; r++) {
      const id = `syn-${spec.seed}-${counter++}`;
      ids.push(id);
      const hasSession = rand() > 0.15;
      const provenance = rand() > 0.92 ? 'derived' : hasSession ? 'observed' : 'not-applicable';
      nodes.push({
        id,
        label: `${spec.label ?? 'synthetic'} ${id}`,
        role: d === 0 ? 'baseline' : 'trial',
        classification: d === 0 ? 'baseline' : 'trial',
        provenance,
        provenanceReason:
          provenance === 'derived'
            ? 'synthetic fixture: projection'
            : hasSession
              ? 'synthetic fixture: observed'
              : 'synthetic fixture: no trajectory',
        sessionId: hasSession ? `sess-${id}` : null,
        outcome: 'synthetic fixture — not a measured result',
        startedAt: null,
        armIds: [],
        candidateIds: [],
        coordinates: { declared: 19, recorded: 19, unavailable: 0 },
      });
    }
    layerIds.push(ids);
  }

  // Each node connects to 1–3 parents in the previous layer (guarantees a DAG
  // with all nodes reachable from layer 0).
  let edgeCounter = 0;
  for (let d = 1; d < layerIds.length; d++) {
    const prev = layerIds[d - 1];
    for (const child of layerIds[d]) {
      const parentCount = 1 + Math.floor(rand() * 3);
      for (let k = 0; k < parentCount; k++) {
        const parent = prev[Math.floor(rand() * prev.length)];
        edges.push({ id: `syn-e-${spec.seed}-${edgeCounter++}`, from: child, to: parent, relation: 'forked_from' });
      }
    }
  }

  const positions: LineageScene['layout']['positions'] = {};
  for (let d = 0; d < layerIds.length; d++) {
    layerIds[d].forEach((id, row) => {
      positions[id] = { column: d, row, depth: d };
    });
  }

  const scene: LineageScene = {
    kind: 'lineage-scene',
    schemaVersion: 1,
    sceneId: `synthetic-${spec.nodeCount}-${spec.seed}`,
    contentDigest: '',
    nodes,
    edges,
    roots: layerIds[0],
    layout: { algorithm: 'layered-longest-path-v1', deterministic: true, positions },
    encoding: { nodeWidth: 178, nodeHeight: 46, columnGap: 250, rowGap: 62 },
    missing: {
      sessionlessNodeIds: nodes.filter((n) => n.sessionId === null).map((n) => n.id),
      nonResultNodeIds: nodes.filter((n) => n.provenance === 'derived').map((n) => n.id),
    },
  };
  return { scene, spec };
}
