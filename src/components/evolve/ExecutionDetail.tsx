import type { EvolveCorpus, Execution } from '../../domain/evolve';
import { continuationMeta, COORDINATE_SPECS } from '../../domain/evolve';
import { continuationKindOf } from './shared';
import { KeyVal, SectionLabel, NotRecorded } from '../primitives';

export function ExecutionDetail({ corpus, exec, onOpenSession, onSelectCheckpoint }: {
  corpus: EvolveCorpus;
  exec: Execution;
  onOpenSession?: (sessionId: string) => void;
  onSelectCheckpoint?: (checkpointId: string) => void;
}) {
  const kind = continuationKindOf(corpus, exec);
  const checkpoints = corpus.checkpoints.filter((c) => c.executionId === exec.id);
  const outgoing = corpus.edges.filter((e) => e.from === exec.id);
  const incoming = corpus.edges.filter((e) => e.to === exec.id);

  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="font-mono text-2xs uppercase tracking-[0.18em] text-ink-400">{exec.id}</div>
        <h3 className="mt-0.5 text-sm font-semibold text-ink-50">{exec.label}</h3>
      </div>

      {kind && (
        <div className="rounded-[4px] border border-ink-700/60 bg-ink-850 p-2.5">
          <div className="font-mono text-2xs font-semibold tracking-widest text-ink-300">
            CONTINUATION · <span className="text-blue-accent">{continuationMeta[kind].label}</span>
          </div>
          <p className="mt-1 text-2xs leading-relaxed text-ink-300">{continuationMeta[kind].desc}</p>
        </div>
      )}

      <SectionLabel>record</SectionLabel>
      <dl className="space-y-1.5">
        <KeyVal k="role" v={exec.role} />
        <KeyVal k="outcome" v={exec.outcome} mono={false} />
        <KeyVal k="started" v={exec.startedAt} />
        <KeyVal k="duration" v={`${(exec.durationMs / 1000).toFixed(1)} s`} />
        {exec.sessionId ? (
          <KeyVal k="trajectory" v={
            onOpenSession ? (
              <button
                onClick={() => onOpenSession(exec.sessionId!)}
                className="rounded-[3px] border border-teal-accent/40 bg-teal-accent/8 px-1.5 py-0.5 font-mono text-2xs text-teal-accent transition-colors hover:bg-teal-accent/15"
              >
                open {exec.sessionId} in Observe →
              </button>
            ) : exec.sessionId
          } />
        ) : (
          <KeyVal k="trajectory" v={<NotRecorded what="no session in the observation registry" />} />
        )}
        <KeyVal k="note" v={exec.note} mono={false} />
      </dl>

      <SectionLabel>declared coordinates</SectionLabel>
      <p className="text-2xs leading-relaxed text-ink-400">
        Each coordinate is recorded or explicitly UNAVAILABLE. Missing is never treated as default or zero.
      </p>
      <dl className="space-y-1">
        {COORDINATE_SPECS.map((spec) => {
          const v = exec.coordinates[spec.kind];
          return (
            <div key={spec.kind} className="grid grid-cols-[118px_1fr] items-baseline gap-3 border-b border-ink-800/50 pb-1">
              <dt className="font-mono text-2xs text-ink-400" title={spec.why}>{spec.label}</dt>
              <dd className="min-w-0 break-words text-2xs">
                {v ? (v.status === 'recorded'
                  ? <span className="font-mono text-ink-100">{v.value}</span>
                  : <span className="font-mono text-amber-accent/90" title={v.reason}>UNAVAILABLE — {v.reason}</span>
                ) : <span className="font-mono text-ink-600">not declared</span>}
              </dd>
            </div>
          );
        })}
      </dl>

      {(checkpoints.length > 0 || outgoing.length > 0 || incoming.length > 0) && (
        <>
          <SectionLabel>lineage</SectionLabel>
          <div className="space-y-1.5">
            {checkpoints.map((cp) => (
              <button
                key={cp.id}
                onClick={() => onSelectCheckpoint?.(cp.id)}
                className="w-full rounded-[4px] border border-ink-700/60 bg-ink-850 p-2.5 text-left transition-colors hover:border-teal-accent/40"
              >
                <div className="font-mono text-2xs text-teal-accent">checkpoint · {cp.id}</div>
                <div className="mt-0.5 text-2xs text-ink-200">{cp.label}</div>
              </button>
            ))}
            {[...outgoing, ...incoming].map((edge) => {
              const dir = outgoing.includes(edge) ? '→' : '←';
              const other = outgoing.includes(edge) ? edge.to : edge.from;
              return (
                <div key={edge.id} className="rounded-[4px] border border-ink-700/40 bg-ink-900 p-2">
                  <div className="font-mono text-2xs text-ink-300">
                    {dir} <span className="text-ink-100">{RELATION_LABEL(edge.relation)}</span> <span className="font-mono text-ink-400">{other}</span>
                  </div>
                  {edge.note && <p className="mt-0.5 text-2xs leading-relaxed text-ink-400">{edge.note}</p>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function RELATION_LABEL(r: string): string {
  return r.replace(/_/g, ' ');
}
