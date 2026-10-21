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

/**
 * A projection arm: every execution that anchors it is a simulated branch (derived from the lineage record, never authored).
 * A projection is not an execution and has no trials, so it has no pass rate: it must not be drawn on a results axis, and
 * "no verdicts yet" would be the wrong sentence, because none can exist.
 */
export function isProjectionArm(corpus: EvolveCorpus, armId: string): boolean {
  const arm = corpus.arms.find((a) => a.id === armId);
  if (!arm || arm.executionIds.length === 0) return false;
  return arm.executionIds.every((id) => {
    const exec = corpus.executions.find((e) => e.id === id);
    return exec !== undefined && continuationKindOf(corpus, exec) === 'simulated';
  });
}

/**
 * Why an outcome comparison between two arms cannot be offered even when their coordinates are comparable, or null when it can.
 * `compareArms` judges COORDINATES; it says nothing about whether either arm has any verdict to compare. This qualifies its
 * verdict in the interface (the analysis itself is unchanged).
 */
export function outcomeQualification(corpus: EvolveCorpus, trials: { armId: string; check: { status: string } }[], aId: string, bId: string): string | null {
  const label = (id: string) => corpus.arms.find((a) => a.id === id)?.label ?? id;
  for (const id of [aId, bId]) {
    if (isProjectionArm(corpus, id)) return `“${label(id)}” is a projection: it has no pass rate and is never compared with results.`;
  }
  for (const id of [aId, bId]) {
    const judged = trials.filter((t) => t.armId === id && t.check.status !== 'unavailable').length;
    if (judged === 0) return `The coordinates can be compared, but “${label(id)}” has no check verdicts in this experiment, so there is no outcome to compare.`;
  }
  return null;
}
