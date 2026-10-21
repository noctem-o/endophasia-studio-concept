import type { EvolveCorpus, Candidate, Trial } from '../../domain/evolve';
import { candidateStatusMeta } from '../../domain/evolve';
import { cellStats, compareArms } from '../../analysis/evolve';
import { KeyVal, SectionLabel } from '../primitives';
import { OutcomeChip } from './ExperimentView';

const STAGE_LABEL: Record<string, string> = {
  observed: 'observed', proposed: 'proposed', isolated: 'isolated', evaluated: 'evaluated',
  compared: 'compared', reviewed: 'reviewed', authorised: 'authorised', promoted: 'promoted', blocked: 'blocked',
};

const STAGE_STYLE: Record<string, string> = {
  done: 'text-teal-accent border-teal-accent/40 bg-teal-accent/8',
  failed: 'text-red-accent border-red-accent/40 bg-red-accent/8',
  unavailable: 'text-ink-400 border-ink-500/40 bg-ink-700/40',
};

export function CandidateView({ corpus, cand, onOpenExecution, onOpenExperiment, onOpenCandidate }: {
  corpus: EvolveCorpus;
  cand: Candidate;
  onOpenExecution: (id: string) => void;
  onOpenExperiment: (id: string) => void;
  onOpenCandidate: (id: string) => void;
}) {
  const status = candidateStatusMeta[cand.status];
  const baseline = corpus.executions.find((e) => e.id === cand.baselineExecutionId);
  const parent = cand.parentId ? corpus.candidates.find((c) => c.id === cand.parentId) : undefined;
  const promo = corpus.promotions.find((p) => p.candidateId === cand.id);
  const experiments = corpus.experiments.filter((x) => x.armIds.some((a) => corpus.arms.find((ar) => ar.id === a)?.candidateId === cand.id));

  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="font-mono text-2xs uppercase tracking-[0.18em] text-ink-400">{cand.id}</div>
        <h3 className="mt-0.5 text-sm font-semibold text-ink-50">{cand.label}</h3>
        <span className={`mt-1.5 inline-block rounded-[3px] border px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-widest ${status.text} ${status.border} ${status.bg}`} title={status.desc}>
          {status.label}
        </span>
      </div>

      <SectionLabel>change</SectionLabel>
      <dl className="space-y-1.5">
        <KeyVal k="target" v={cand.change.target} />
        <KeyVal k="artifact" v={cand.change.artifactId} />
        <KeyVal k="summary" v={cand.change.summary} mono={false} />
        <KeyVal k="baseline" v={
          baseline ? (
            <button onClick={() => onOpenExecution(baseline.id)} className="font-mono text-2xs text-teal-accent hover:underline">
              {baseline.id} — {baseline.label} →
            </button>
          ) : cand.baselineExecutionId
        } />
        {parent && <KeyVal k="parent candidate" v={<button onClick={() => onOpenCandidate(parent.id)} className="font-mono text-2xs text-blue-accent hover:underline">{parent.id} →</button>} />}
        <KeyVal k="proposed" v={cand.proposedAt} />
      </dl>
      <p className="text-2xs leading-relaxed text-ink-400">{cand.note}</p>

      <SectionLabel>evaluation record</SectionLabel>
      {experiments.length === 0 ? (
        <p className="text-2xs text-ink-500">no experiment defined — a proposal, nothing evaluated</p>
      ) : (
        <div className="space-y-2">
          {experiments.map((exp) => {
            const candArms = exp.armIds.filter((a) => corpus.arms.find((ar) => ar.id === a)?.candidateId === cand.id);
            const baseArms = exp.armIds.filter((a) => corpus.arms.find((ar) => ar.id === a)?.kind === 'baseline');
            const aId = baseArms[0] ?? exp.armIds[0];
            const bId = candArms[0];
            return (
              <div key={exp.id} className="rounded-[4px] border border-ink-700/60 bg-ink-900/70 p-3">
                <button onClick={() => onOpenExperiment(exp.id)} className="font-mono text-2xs text-blue-accent hover:underline">
                  {exp.id} — {exp.label} →
                </button>
                {aId && bId && <ArmPairSummary corpus={corpus} aId={aId} bId={bId} />}
                {aId && !bId && <p className="mt-1 text-2xs text-ink-400">candidate arm not yet defined in this experiment</p>}
              </div>
            );
          })}
        </div>
      )}

      {promo && (
        <>
          <SectionLabel>promotion sequence — separate recorded decisions</SectionLabel>
          <p className="text-2xs leading-relaxed text-ink-400">
            Evaluation, authorisation and promotion are different records. Success at one stage never implies the next.
          </p>
          <div className="space-y-1.5">
            {promo.steps.map((step, i) => (
              <div key={i} className="flex gap-2.5">
                <div className="flex flex-col items-center pt-1">
                  <span className={`h-2 w-2 rounded-full ${step.status === 'done' ? 'bg-teal-accent' : step.status === 'failed' ? 'bg-red-accent' : 'bg-ink-600'}`} aria-hidden />
                  {i < promo.steps.length - 1 && <span className="w-px flex-1 bg-ink-700" aria-hidden />}
                </div>
                <div className="flex-1 pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-[3px] border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest ${STAGE_STYLE[step.status]}`}>
                      {STAGE_LABEL[step.stage]}
                    </span>
                    {step.recordId && <span className="font-mono text-2xs text-ink-400">{step.recordId}</span>}
                    {step.authority && <span className="font-mono text-2xs text-blue-accent">{step.authority}</span>}
                  </div>
                  <p className="mt-0.5 text-2xs leading-relaxed text-ink-300">{step.note}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-[4px] border border-ink-700/60 bg-ink-850 p-2.5">
            <div className="font-mono text-2xs uppercase tracking-widest text-ink-300">outcome</div>
            <p className="mt-1 text-2xs leading-relaxed text-ink-100">{promo.outcome}</p>
          </div>
        </>
      )}
      {!promo && (
        <p className="text-2xs text-ink-500">no promotion record — the sequence below has not started for this candidate</p>
      )}
    </div>
  );
}

function ArmPairSummary({ corpus, aId, bId }: { corpus: EvolveCorpus; aId: string; bId: string }) {
  const trials = corpus.trials;
  const a = cellStats(trials, aId);
  const b = cellStats(trials, bId);
  const report = compareArms(corpus, aId, bId);

  return (
    <div className="mt-2 space-y-1.5">
      <div className="grid grid-cols-2 gap-2">
        <CellBox label={aId} cell={a} />
        <CellBox label={bId} cell={b} />
      </div>
      <p className="font-mono text-2xs text-ink-400">
        comparability: <span className={report.verdict === 'comparable' ? 'text-teal-accent' : 'text-amber-accent'}>{report.verdict.replace(/-/g, ' ')}</span>
      </p>
    </div>
  );
}

function CellBox({ label, cell }: { label: string; cell: ReturnType<typeof cellStats> }) {
  const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
  return (
    <div className="rounded-[4px] border border-ink-700/50 bg-ink-850 p-2">
      <div className="font-mono text-2xs text-ink-400">{label}</div>
      {'unavailable' in cell.passRate ? (
        <div className="mt-0.5 font-mono text-2xs text-ink-500">no verdicts</div>
      ) : (
        <div className="mt-0.5 font-mono text-2xs text-ink-100">
          {cell.passes}/{cell.passDenominator} · {pct(cell.passRate.centre)}
          <span className="ml-1 text-ink-500">±[{pct(cell.passRate.low)}, {pct(cell.passRate.high)}]</span>
        </div>
      )}
      {'unavailable' in cell.usage ? (
        <div className="font-mono text-2xs text-ink-500">usage not recorded</div>
      ) : (
        <div className="font-mono text-2xs text-ink-300">
          ~{(cell.usage.medianTokens / 1000).toFixed(1)}k tok
          {cell.usage.missing > 0 && <span className="text-amber-accent"> · {cell.usage.missing} missing</span>}
        </div>
      )}
      {cell.interrupted > 0 && (
        <div className="font-mono text-2xs text-amber-accent">{cell.interrupted} interrupted</div>
      )}
    </div>
  );
}

export function TrialDetail({ corpus, trial, onOpenExecution, onOpenSession }: {
  corpus: EvolveCorpus;
  trial: Trial;
  onOpenExecution: (id: string) => void;
  onOpenSession?: (sessionId: string) => void;
}) {
  const exec = corpus.executions.find((e) => e.id === trial.executionId);
  const arm = corpus.arms.find((a) => a.id === trial.armId);
  const exp = corpus.experiments.find((x) => x.id === trial.experimentId);

  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="font-mono text-2xs uppercase tracking-[0.18em] text-ink-400">trial · {trial.id}</div>
        <h3 className="mt-0.5 text-sm font-semibold text-ink-50">{trial.taskId} — attempt {trial.index}</h3>
      </div>

      <SectionLabel>verdicts</SectionLabel>
      <dl className="space-y-1.5">
        <KeyVal k="outcome" v={<OutcomeChip t={trial} />} />
        <KeyVal k="check" v={
          trial.check.status === 'unavailable'
            ? <span className="font-mono text-2xs text-amber-accent">UNAVAILABLE — {trial.check.reason}</span>
            : <span className="font-mono text-2xs text-ink-100">{trial.check.status}{trial.check.reason ? ` — ${trial.check.reason}` : ''}</span>
        } />
        <KeyVal k="evaluator" v={
          trial.evaluator.status === 'unavailable'
            ? <span className="font-mono text-2xs text-amber-accent">UNAVAILABLE — {trial.evaluator.reason}</span>
            : <span className="font-mono text-2xs text-ink-100">{trial.evaluator.status}</span>
        } />
        <KeyVal k="usage" v={
          'unavailable' in trial.usage
            ? <span className="font-mono text-2xs text-amber-accent">UNAVAILABLE — {trial.usage.reason}</span>
            : <span className="font-mono text-2xs text-ink-100">{trial.usage.promptTokens.toLocaleString()} prompt + {trial.usage.completionTokens.toLocaleString()} completion</span>
        } />
        <KeyVal k="wall time" v={
          typeof trial.wallMs === 'number'
            ? `${(trial.wallMs / 1000).toFixed(1)} s`
            : <span className="font-mono text-2xs text-amber-accent">UNAVAILABLE — {trial.wallMs.reason}</span>
        } />
      </dl>
      {trial.note && <p className="text-2xs leading-relaxed text-ink-300">{trial.note}</p>}

      <SectionLabel>context</SectionLabel>
      <dl className="space-y-1.5">
        {exp && (
          <KeyVal k="experiment" v={
            <span className="font-mono text-2xs text-ink-100">{exp.id} — {exp.label}</span>
          } />
        )}
        {arm && <KeyVal k="arm" v={<span className="font-mono text-2xs text-ink-100">{arm.label} ({arm.kind})</span>} />}
        {exec && (
          <KeyVal k="execution" v={
            <button onClick={() => onOpenExecution(exec.id)} className="font-mono text-2xs text-teal-accent hover:underline">
              {exec.id} — {exec.label} →
            </button>
          } />
        )}
        {trial.sessionId && onOpenSession && (
          <KeyVal k="trajectory" v={
            <button onClick={() => onOpenSession(trial.sessionId!)} className="rounded-[3px] border border-teal-accent/40 bg-teal-accent/8 px-1.5 py-0.5 font-mono text-2xs text-teal-accent transition-colors hover:bg-teal-accent/15">
              open {trial.sessionId} in Observe →
            </button>
          } />
        )}
        {!trial.sessionId && (
          <KeyVal k="trajectory" v={<span className="font-mono text-2xs text-ink-500">not in the observation registry — verdicts come from trial records only</span>} />
        )}
      </dl>
    </div>
  );
}
