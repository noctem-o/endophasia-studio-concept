import type { EvolveCorpus } from '../../domain/evolve';
import { candidateStatusMeta } from '../../domain/evolve';

export interface DiffReport {
  axes: { name: string; a: string; b: string; same: boolean }[];
  summary: string;
}

export function diffCandidates(corpus: EvolveCorpus, aId: string, bId: string): DiffReport {
  const a = corpus.candidates.find((c) => c.id === aId)!;
  const b = corpus.candidates.find((c) => c.id === bId)!;
  const axes = [
    { name: 'target', a: a.change.target, b: b.change.target, same: a.change.target === b.change.target },
    { name: 'artifact', a: a.change.artifactId, b: b.change.artifactId, same: a.change.artifactId === b.change.artifactId },
    { name: 'status', a: candidateStatusMeta[a.status].label, b: candidateStatusMeta[b.status].label, same: a.status === b.status },
    { name: 'baseline', a: a.baselineExecutionId, b: b.baselineExecutionId, same: a.baselineExecutionId === b.baselineExecutionId },
    { name: 'executions', a: String(a.executionIds.length), b: String(b.executionIds.length), same: a.executionIds.length === b.executionIds.length },
    { name: 'proposed at', a: a.proposedAt, b: b.proposedAt, same: a.proposedAt === b.proposedAt },
  ];
  const different = axes.filter((x) => !x.same);
  const summary = different.length === 0
    ? 'The two candidate records are identical on every compared axis.'
    : `They differ on ${different.length} of ${axes.length} axes: ${different.map((d) => d.name).join(', ')}.`;
  return { axes, summary };
}
