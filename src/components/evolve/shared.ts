import type { EvolveCorpus, Execution } from '../../domain/evolve';

/** Derive the continuation kind from the lineage record, not from an authored field. */
export function continuationKindOf(corpus: EvolveCorpus, exec: Execution): 'replayed' | 'recorded' | 'simulated' | null {
  if (exec.role !== 'continuation') return null;
  const edge = corpus.edges.find((e) => e.from === exec.id);
  if (edge?.relation === 'simulated_branch') return 'simulated';
  if (edge?.relation === 'replay_of') return 'replayed';
  return 'recorded';
}

export const RELATION_META = {
  forked_from: { label: 'forked from', color: 'text-teal-accent', dot: 'bg-teal-accent', hint: 'continued from a checkpoint of the parent execution' },
  replay_of: { label: 'replay of', color: 'text-blue-accent', dot: 'bg-blue-accent', hint: 'recorded responses held fixed — control flow only' },
  candidate_of: { label: 'candidate of', color: 'text-amber-accent', dot: 'bg-amber-accent', hint: 'trial execution under a candidate change' },
  evaluated_against: { label: 'evaluated against', color: 'text-violet-300', dot: 'bg-violet-300', hint: 'compared against the reference configuration' },
  continuation_of: { label: 'continuation of', color: 'text-ink-300', dot: 'bg-ink-300', hint: 'a continuation with no narrower relation declared' },
  simulated_branch: { label: 'simulated branch', color: 'text-red-accent', dot: 'bg-red-accent', hint: 'a projection over recorded state — never an execution result' },
} as const;
