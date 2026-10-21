import type { Checkpoint, EvolveCorpus } from '../../domain/evolve';
import { continuationMeta, continuationSupport } from '../../domain/evolve';
import type { ContinuationKind } from '../../domain/evolve';
import { KeyVal, SectionLabel } from '../primitives';

const STATE_LABELS: Record<keyof Checkpoint['state'], string> = {
  workspaceSnapshot: 'Workspace snapshot',
  conversationPrefix: 'Conversation prefix',
  toolDefinitions: 'Tool definitions',
  environmentPin: 'Environment pin',
  recordedResponses: 'Recorded responses (cassette)',
};

export function CheckpointPanel({ corpus, cp, onOpenExecution, onOpenExperiment }: {
  corpus: EvolveCorpus;
  cp: Checkpoint;
  onOpenExecution: (executionId: string) => void;
  onOpenExperiment?: (experimentId: string) => void;
}) {
  const support = continuationSupport(cp);
  const relatedExp = corpus.experiments.find((x) => x.checkpointId === cp.id);
  const branchEdges = corpus.edges.filter((e) => e.note?.includes(cp.id) || (e.relation === 'simulated_branch' && e.note?.includes('ckpt')));

  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="font-mono text-2xs uppercase tracking-[0.18em] text-ink-400">checkpoint · {cp.id}</div>
        <h3 className="mt-0.5 text-sm font-semibold text-ink-50">{cp.label}</h3>
      </div>

      <SectionLabel>position</SectionLabel>
      <dl className="space-y-1.5">
        <KeyVal k="execution" v={
          <button onClick={() => onOpenExecution(cp.executionId)} className="font-mono text-2xs text-teal-accent hover:underline">
            {cp.executionId} →
          </button>
        } />
        <KeyVal k="after event" v={cp.afterEventId} />
        <KeyVal k="after seq" v={String(cp.afterSeq)} />
      </dl>

      <SectionLabel>recorded state</SectionLabel>
      <div className="space-y-1.5">
        {(Object.keys(STATE_LABELS) as (keyof Checkpoint['state'])[]).map((k) => {
          const item = cp.state[k];
          return (
            <div key={k} className={`rounded-[4px] border p-2.5 ${item.present ? 'border-teal-accent/25 bg-teal-accent/5' : 'border-amber-accent/30 bg-amber-accent/5'}`}>
              <div className={`font-mono text-2xs font-semibold tracking-widest ${item.present ? 'text-teal-accent' : 'text-amber-accent'}`}>
                {item.present ? '\u25c9 present' : '\u2205 absent'}
                <span className="ml-2 font-normal text-ink-300">{STATE_LABELS[k]}</span>
              </div>
              <p className="mt-1 text-2xs leading-relaxed text-ink-300">{item.note}</p>
            </div>
          );
        })}
      </div>

      <SectionLabel>continuation support — derived, not claimed</SectionLabel>
      <p className="text-2xs leading-relaxed text-ink-400">
        Forkability is a consequence of what is recorded, not a property asserted of the checkpoint.
      </p>
      <div className="space-y-1.5">
        {(Object.keys(continuationMeta) as ContinuationKind[]).map((kind) => {
          const s = support[kind];
          const m = continuationMeta[kind];
          return (
            <div key={kind} className={`rounded-[4px] border p-2.5 ${s.supported ? 'border-ink-700/60 bg-ink-850' : 'border-ink-700/40 bg-ink-900 opacity-80'}`}>
              <div className="flex items-center justify-between">
                <span className={`font-mono text-2xs font-semibold tracking-widest ${s.supported ? 'text-ink-100' : 'text-ink-500'}`}>{m.label}</span>
                <span className={`font-mono text-2xs ${s.supported ? 'text-teal-accent' : 'text-ink-500'}`}>
                  {s.supported ? 'supported' : 'not supported'}
                </span>
              </div>
              <p className="mt-1 text-2xs leading-relaxed text-ink-300">{m.desc}</p>
              <p className={`mt-1 font-mono text-2xs ${s.supported ? 'text-ink-400' : 'text-amber-accent/80'}`}>{s.reason}</p>
            </div>
          );
        })}
      </div>

      <SectionLabel>counterfactuals on record</SectionLabel>
      {relatedExp ? (
        <button
          onClick={() => onOpenExperiment?.(relatedExp.id)}
          className="w-full rounded-[4px] border border-blue-accent/30 bg-blue-accent/8 p-2.5 text-left transition-colors hover:border-blue-accent/50"
        >
          <div className="font-mono text-2xs text-blue-accent">experiment · {relatedExp.id}</div>
          <div className="mt-0.5 text-2xs text-ink-200">{relatedExp.label}</div>
          <p className="mt-1 text-2xs leading-relaxed text-ink-300">{relatedExp.question}</p>
        </button>
      ) : (
        <p className="text-2xs text-ink-500">no experiment has been defined from this checkpoint</p>
      )}
      {branchEdges.length > 0 && (
        <div className="space-y-1">
          {branchEdges.map((e) => (
            <div key={e.id} className="rounded-[4px] border border-ink-700/40 bg-ink-900 p-2">
              <div className="font-mono text-2xs text-ink-300">{e.from} {RELATION(e.relation)} {e.to}</div>
              {e.note && <p className="mt-0.5 text-2xs text-ink-400">{e.note}</p>}
            </div>
          ))}
        </div>
      )}
      <p className="text-2xs leading-relaxed text-ink-400">{cp.note}</p>
    </div>
  );
}

function RELATION(r: string): string {
  return r.replace(/_/g, ' ');
}
