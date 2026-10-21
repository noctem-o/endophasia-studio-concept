import type { ContinuationKind, EvolveCorpus, Execution, LineageRelation } from '../../domain/evolve';

/** Derive the continuation kind from the lineage record, not from an authored field. */
export function continuationKindOf(corpus: EvolveCorpus, exec: Execution): ContinuationKind | null {
  if (exec.role !== 'continuation') return null;
  const edge = corpus.edges.find((e) => e.from === exec.id);
  if (edge?.relation === 'simulated_branch') return 'simulated';
  if (edge?.relation === 'replay_of') return 'replayed';
  return 'recorded';
}

export const RELATION_META: Record<LineageRelation, { label: string; hint: string }> = {
  forked_from: { label: 'forked from', hint: 'continued from a checkpoint of the parent execution' },
  replay_of: { label: 'replay of', hint: 'recorded responses held fixed — control flow only' },
  candidate_of: { label: 'candidate of', hint: 'trial execution under a candidate change' },
  evaluated_against: { label: 'evaluated against', hint: 'compared against the reference configuration' },
  continuation_of: { label: 'continuation of', hint: 'a continuation with no narrower relation declared' },
  simulated_branch: { label: 'simulated branch', hint: 'a projection over recorded state — never an execution result' },
};
