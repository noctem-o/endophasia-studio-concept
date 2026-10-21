import type { EvolveCorpus } from '@/domain/evolve';
import type {
  LineageScene,
  SceneBuildResult,
  SceneEdge,
  SceneIssue,
  SceneLayout,
  SceneNode,
  SceneNodeClassification,
  SceneProvenance,
} from './types';
import { LINEAGE_SCENE_SCHEMA_VERSION } from './types';
import { fnv1a, stableStringify } from './digest';

/**
 * Deterministic scene builder: EvolveCorpus → LineageScene.
 *
 * - Scientific meaning (identity, provenance, relations, missing information)
 *   is derived once, here, independently of any renderer.
 * - The builder is a pure function: same corpus, same scene, byte-identical.
 * - Provenance is explicit per node (OBS/REP/DER/N-A) with its reason, and is
 *   the evidence dimension only: continuation status (replay, simulated
 *   projection) lives on classification and relations, never on provenance.
 * - Missing information is carried into the scene as markers, never dropped
 *   or filled with defaults.
 * - Layout is a declared deterministic algorithm over the scene graph; it is
 *   presentation and carries no scientific meaning.
 */

export function buildLineageScene(corpus: EvolveCorpus, sceneId = 'evolve-lineage'): SceneBuildResult {
  const issues: SceneIssue[] = [];

  const issuesFromValidation = validateLineageStructure(corpus);
  issues.push(...issuesFromValidation);
  const hasErrors = issues.some((i) => i.severity === 'error');

  // Deterministic node order: corpus order (already stable in the fixtures),
  // re-sorted by id so scene identity does not depend on array order.
  const sortedExecs = [...corpus.executions].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const armIdsByExec = new Map<string, string[]>();
  for (const arm of corpus.arms) {
    // arm.executionIds are execution ids; the membership map is keyed by them.
    for (const eid of arm.executionIds) {
      const list = armIdsByExec.get(eid) ?? [];
      list.push(arm.id);
      armIdsByExec.set(eid, list);
    }
  }
  // An execution may also declare its arm directly.
  for (const exec of corpus.executions) {
    if (exec.armId && !armIdsByExec.get(exec.id)?.includes(exec.armId)) {
      const list = armIdsByExec.get(exec.id) ?? [];
      list.push(exec.armId);
      armIdsByExec.set(exec.id, list);
    }
  }

  const candidateIdsByExec = new Map<string, string[]>();
  for (const cand of corpus.candidates) {
    for (const eid of cand.executionIds) {
      const list = candidateIdsByExec.get(eid) ?? [];
      list.push(cand.id);
      candidateIdsByExec.set(eid, list);
    }
  }

  const edgesById = [...corpus.edges].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const nodes: SceneNode[] = sortedExecs.map((exec) => {
    const provenance = provenanceOf(exec, corpus);
    const coords = Object.values(exec.coordinates);
    const recorded = coords.filter((c) => c?.status === 'recorded').length;
    const unavailable = coords.filter((c) => c?.status === 'unavailable').length;
    return {
      id: exec.id,
      label: exec.label,
      role: exec.role,
      classification: classify(exec.id, corpus),
      provenance: provenance.value,
      provenanceReason: provenance.reason,
      sessionId: exec.sessionId ?? null,
      outcome: exec.outcome,
      startedAt: exec.startedAt,
      armIds: [...(armIdsByExec.get(exec.id) ?? [])].sort(),
      candidateIds: [...(candidateIdsByExec.get(exec.id) ?? [])].sort(),
      coordinates: { declared: coords.length, recorded, unavailable },
    };
  });

  const edges: SceneEdge[] = edgesById.map((e) => ({ id: e.id, from: e.from, to: e.to, relation: e.relation }));

  const nodeIds = new Set(nodes.map((n) => n.id));
  // Corpus edge direction: `from` is the child, `to` is the ancestor it derives
  // from. A node has a parent when it appears as `from` in any edge.
  const hasParent = new Set<string>();
  for (const e of edges) {
    if (!nodeIds.has(e.from)) continue;
    hasParent.add(e.from);
  }
  const roots = nodes.filter((n) => !hasParent.has(n.id)).map((n) => n.id);

  const layout = layeredLongestPathLayout(nodeIds, edges, roots);

  const missing = {
    sessionlessNodeIds: nodes.filter((n) => n.sessionId === null).map((n) => n.id),
    nonResultNodeIds: nodes.filter((n) => n.provenance === 'derived').map((n) => n.id),
  };

  const scene: LineageScene = {
    kind: 'lineage-scene',
    schemaVersion: LINEAGE_SCENE_SCHEMA_VERSION,
    sceneId,
    contentDigest: '',
    nodes,
    edges,
    roots,
    layout,
    encoding: { nodeWidth: 178, nodeHeight: 46, columnGap: 250, rowGap: 62 },
    missing,
  };
  scene.contentDigest = fnv1a(stableStringify({ ...scene, contentDigest: '' }));

  return { scene: hasErrors ? null : scene, issues };
}

/** Verify the corpus is structurally sound enough to become a scene. */
function validateLineageStructure(corpus: EvolveCorpus): SceneIssue[] {
  const issues: SceneIssue[] = [];
  const execIds = new Set(corpus.executions.map((e) => e.id));

  for (const e of corpus.edges) {
    if (!execIds.has(e.from)) issues.push({ severity: 'error', message: `edge ${e.id}: unknown from-execution ${e.from}` });
    if (!execIds.has(e.to)) issues.push({ severity: 'error', message: `edge ${e.id}: unknown to-execution ${e.to}` });
    if (e.from === e.to) issues.push({ severity: 'error', message: `edge ${e.id}: self-loop on ${e.from}` });
  }

  // Duplicate node or edge ids would break stable identity and the digest.
  const seenExec = new Set<string>();
  for (const e of corpus.executions) {
    if (seenExec.has(e.id)) issues.push({ severity: 'error', message: `duplicate execution id ${e.id}` });
    seenExec.add(e.id);
  }
  const seenEdge = new Set<string>();
  for (const e of corpus.edges) {
    if (seenEdge.has(e.id)) issues.push({ severity: 'error', message: `duplicate edge id ${e.id}` });
    seenEdge.add(e.id);
  }

  // Cycle detection over the directed relation graph. A cyclic lineage is not
  // renderable as a layered graph and is invalid as a history.
  const adjacency = new Map<string, string[]>();
  for (const e of corpus.edges) {
    if (!execIds.has(e.from) || !execIds.has(e.to) || e.from === e.to) continue;
    const list = adjacency.get(e.from) ?? [];
    list.push(e.to);
    adjacency.set(e.from, list);
  }
  const state = new Map<string, 'visiting' | 'done'>();
  const cycleAt = new Set<string>();
  const visit = (id: string): boolean => {
    const st = state.get(id);
    if (st === 'visiting') {
      cycleAt.add(id);
      return true;
    }
    if (st === 'done') return false;
    state.set(id, 'visiting');
    for (const next of adjacency.get(id) ?? []) {
      if (visit(next)) {
        state.set(id, 'done');
        return true;
      }
    }
    state.set(id, 'done');
    return false;
  };
  for (const id of [...execIds].sort()) {
    if (visit(id)) break;
  }
  for (const id of cycleAt) {
    issues.push({ severity: 'error', message: `lineage cycle through execution ${id} — a history cannot be its own ancestor` });
  }

  return issues;
}

function classify(execId: string, corpus: EvolveCorpus): SceneNodeClassification {
  const exec = corpus.executions.find((e) => e.id === execId)!;
  // Derivation edges point from the child at its ancestor.
  const derivations = corpus.edges.filter((e) => e.from === execId);
  const relations = new Set(derivations.map((e) => e.relation));

  if (relations.has('simulated_branch')) return 'simulated-projection';
  if (relations.has('replay_of')) return 'replay';
  if (exec.role === 'continuation') return 'continuation';
  if (exec.role === 'baseline') return 'baseline';
  return 'trial';
}

/**
 * Evidence provenance is assigned once, here, and carries its reason.
 * OBS: trajectory recorded in the observation registry. REP: outcome known
 * only from the record's own reporting. DER: deterministic projection — not
 * a real execution. N-A: not currently produced by the corpus builder; the
 * value is kept in the vocabulary for records with no evidential basis.
 *
 * Continuation status (replay, simulated projection) is deliberately NOT a
 * provenance value: it lives on classification and relations, per the
 * corpus's evidence vocabulary where REP means reported, never replay.
 */
function provenanceOf(exec: EvolveCorpus['executions'][number], corpus: EvolveCorpus): { value: SceneProvenance; reason: string } {
  const derivations = corpus.edges.filter((e) => e.from === exec.id);
  if (derivations.some((e) => e.relation === 'simulated_branch') || (exec.role === 'continuation' && !exec.sessionId && exec.durationMs === 0)) {
    return {
      value: 'derived',
      reason: 'deterministic projection over a recorded checkpoint prefix — not a real execution; carries no usage rows',
    };
  }
  if (exec.sessionId) {
    return { value: 'observed', reason: 'trajectory recorded in the observation registry' };
  }
  return { value: 'reported', reason: 'no recorded trajectory in the registry; outcome known only from the record itself' };
}

/**
 * Layered layout, algorithm 'layered-longest-path-v1':
 * - depth = longest path from any root (root depth 0);
 * - columns = depth (left-to-right);
 * - rows assigned per depth column in stable id order, compacting to avoid gaps.
 * Pure and deterministic: identical graph in, identical coordinates out.
 */
function layeredLongestPathLayout(nodeIds: Set<string>, edges: SceneEdge[], roots: string[]): SceneLayout {
  // Corpus direction: from = child, to = ancestor. Depth flows parent → child.
  const parentEdges = new Map<string, string[]>();
  for (const e of edges) {
    if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) continue;
    const list = parentEdges.get(e.from) ?? [];
    list.push(e.to);
    parentEdges.set(e.from, list);
  }

  const depth = new Map<string, number>();
  const computeDepth = (id: string, seen: Set<string>): number => {
    if (depth.has(id)) return depth.get(id)!;
    if (seen.has(id)) return 0; // cycle guard; cyclic graphs are rejected earlier
    seen.add(id);
    let d = 0;
    for (const parent of parentEdges.get(id) ?? []) d = Math.max(d, 1 + computeDepth(parent, seen));
    depth.set(id, d);
    return d;
  };
  for (const root of roots) computeDepth(root, new Set());
  for (const id of nodeIds) if (!depth.has(id)) computeDepth(id, new Set());

  const byDepth = new Map<number, string[]>();
  for (const id of nodeIds) {
    const d = depth.get(id) ?? 0;
    const list = byDepth.get(d) ?? [];
    list.push(id);
    byDepth.set(d, list);
  }

  const positions: SceneLayout['positions'] = {};
  for (const [d, ids] of [...byDepth.entries()].sort((a, b) => a[0] - b[0])) {
    const sorted = [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    sorted.forEach((id, row) => {
      positions[id] = { column: d, row, depth: d };
    });
  }

  return { algorithm: 'layered-longest-path-v1', deterministic: true, positions };
}
