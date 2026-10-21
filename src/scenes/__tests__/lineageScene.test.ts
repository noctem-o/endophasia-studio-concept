import { describe, it, expect } from 'vitest';
import { buildLineageScene } from '../lineageBuilder';
import { fnv1a, stableStringify } from '../digest';
import { evolveCorpus } from '@/data/evolve';

describe('scene digest utilities', () => {
  it('is deterministic for the same input', () => {
    expect(fnv1a('lineage-scene')).toBe(fnv1a('lineage-scene'));
  });

  it('differs for different inputs', () => {
    expect(fnv1a('a')).not.toBe(fnv1a('b'));
  });

  it('stableStringify is key-order independent', () => {
    expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }));
  });
});

describe('buildLineageScene', () => {
  const { scene, issues } = buildLineageScene(evolveCorpus);

  it('builds without issues on the shipped corpus', () => {
    expect(issues).toEqual([]);
    expect(scene).not.toBeNull();
  });

  it('is byte-identical across repeated builds (determinism)', () => {
    const again = buildLineageScene(evolveCorpus).scene;
    expect(again).toEqual(scene);
  });

  it('is invariant to corpus array order (identity from ids, not positions)', () => {
    const shuffled: typeof evolveCorpus = {
      ...evolveCorpus,
      executions: [...evolveCorpus.executions].reverse(),
      edges: [...evolveCorpus.edges].reverse(),
    };
    const result = buildLineageScene(shuffled).scene;
    expect(result).toEqual(scene);
  });

  it('carries the schema version and stable scene id', () => {
    expect(scene!.schemaVersion).toBe(1);
    expect(scene!.sceneId).toBe('evolve-lineage');
  });

  it('every node id matches a corpus execution id', () => {
    const corpusIds = new Set(evolveCorpus.executions.map((e) => e.id));
    for (const node of scene!.nodes) expect(corpusIds.has(node.id), node.id).toBe(true);
  });

  it('every edge endpoints resolve to scene nodes', () => {
    const ids = new Set(scene!.nodes.map((n) => n.id));
    for (const e of scene!.edges) {
      expect(ids.has(e.from), e.id).toBe(true);
      expect(ids.has(e.to), e.id).toBe(true);
    }
  });

  it('rejects cyclic lineage as invalid history', () => {
    const cyclic: typeof evolveCorpus = {
      ...evolveCorpus,
      edges: [
        ...evolveCorpus.edges,
        { id: 'e-cycle', from: 'exec-a', to: 'exec-r1', relation: 'forked_from' as const },
      ],
    };
    const result = buildLineageScene(cyclic);
    expect(result.scene).toBeNull();
    expect(result.issues.some((i) => i.severity === 'error' && i.message.includes('cycle'))).toBe(true);
  });

  it('rejects self-loops and dangling edges with errors', () => {
    const broken: typeof evolveCorpus = {
      ...evolveCorpus,
      edges: [
        { id: 'e-self', from: 'exec-a', to: 'exec-a', relation: 'forked_from' as const },
        { id: 'e-dangle', from: 'exec-ghost', to: 'exec-a', relation: 'forked_from' as const },
      ],
    };
    const result = buildLineageScene(broken);
    expect(result.scene).toBeNull();
    expect(result.issues.filter((i) => i.severity === 'error')).toHaveLength(2);
  });

  it('marks the simulated projection as derived with an explicit reason (simulated ≠ real)', () => {
    const sim = scene!.nodes.find((n) => n.id === 'exec-sim1');
    expect(sim).toBeDefined();
    expect(sim!.provenance).toBe('derived');
    expect(sim!.provenanceReason).toContain('not a real execution');
    expect(scene!.missing.nonResultNodeIds).toContain('exec-sim1');
  });

  it('keeps replay status out of provenance: the replay node\'s evidence is observed (session recorded), its classification is replay', () => {
    const replay = scene!.nodes.find((n) => n.id === 'exec-replay1');
    expect(replay!.provenance).toBe('observed');
    expect(replay!.classification).toBe('replay');
  });

  it('sessionless nodes are listed as missing, never fabricated', () => {
    for (const node of scene!.nodes) {
      if (node.sessionId === null) expect(scene!.missing.sessionlessNodeIds).toContain(node.id);
      else expect(scene!.missing.sessionlessNodeIds).not.toContain(node.id);
    }
  });

  it('provenance covers every node exactly once (OBS/REP/DER/N-A evidence vocabulary)', () => {
    const valid = ['observed', 'reported', 'derived', 'not-applicable'] as const;
    for (const node of scene!.nodes) expect(valid).toContain(node.provenance);
  });

  it('arm membership keys on execution ids from the corpus, not the arm id', () => {
    const r1 = scene!.nodes.find((n) => n.id === 'exec-r1');
    const ctx1 = scene!.nodes.find((n) => n.id === 'exec-ctx1');
    expect(r1!.armIds).toContain('arm-retry-b');
    expect(ctx1!.armIds).toContain('arm-ctx-hi');
    for (const node of scene!.nodes) {
      for (const aid of node.armIds) {
        const arm = evolveCorpus.arms.find((a) => a.id === aid);
        expect(arm, `${node.id} -> ${aid}`).toBeDefined();
        expect(arm!.executionIds).toContain(node.id);
      }
    }
  });

  it('rejects duplicate execution ids with errors', () => {
    const dup: typeof evolveCorpus = {
      ...evolveCorpus,
      executions: [...evolveCorpus.executions, evolveCorpus.executions[0]],
    };
    const result = buildLineageScene(dup);
    expect(result.scene).toBeNull();
    expect(result.issues.some((i) => i.message.includes('duplicate execution id'))).toBe(true);
  });
});

describe('layered layout invariants (layered-longest-path-v1)', () => {
  const { scene } = buildLineageScene(evolveCorpus);

  it('assigns a position to every node and no others', () => {
    const ids = new Set(scene!.nodes.map((n) => n.id));
    expect(Object.keys(scene!.layout.positions).sort()).toEqual([...ids].sort());
  });

  it('root nodes sit at column 0 (depth 0)', () => {
    for (const rootId of scene!.roots) {
      expect(scene!.layout.positions[rootId].column).toBe(0);
      expect(scene!.layout.positions[rootId].depth).toBe(0);
    }
  });

  it('a child (edge.from) is always one or more layers deeper than its ancestor (edge.to)', () => {
    const pos = scene!.layout.positions;
    for (const e of scene!.edges) {
      expect(pos[e.from].depth).toBeGreaterThanOrEqual(pos[e.to].depth + 1);
    }
  });

  it('rows are compact per column with no gaps', () => {
    const byCol = new Map<number, number[]>();
    for (const p of Object.values(scene!.layout.positions)) {
      const list = byCol.get(p.column) ?? [];
      list.push(p.row);
      byCol.set(p.column, list);
    }
    for (const rows of byCol.values()) {
      rows.sort((a, b) => a - b);
      rows.forEach((r, i) => expect(r).toBe(i));
    }
  });

  it('depth equals the longest path from a root', () => {
    // exec-a is the root; exec-r1 forks from it: depth 1. Chains multiply.
    expect(scene!.layout.positions['exec-a'].depth).toBe(0);
    expect(scene!.layout.positions['exec-r1'].depth).toBe(1);
  });

  it('layout is deterministic across rebuilds', () => {
    const again = buildLineageScene(evolveCorpus).scene!.layout;
    expect(again).toEqual(scene!.layout);
  });

  it('declares its algorithm and determinism in the document', () => {
    expect(scene!.layout.algorithm).toBe('layered-longest-path-v1');
    expect(scene!.layout.deterministic).toBe(true);
  });
});
