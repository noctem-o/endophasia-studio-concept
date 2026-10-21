import { useMemo, useState } from 'react';
import type { EvolveCorpus, Experiment, Trial } from '../../domain/evolve';
import { cellStats, compareArms } from '../../analysis/evolve';
import type { CellStats } from '../../analysis/evolve';
import { KeyVal, SectionLabel } from '../primitives';

const VERDICT_STYLE = {
  comparable: { text: 'text-teal-accent', border: 'border-teal-accent/40', bg: 'bg-teal-accent/8', label: 'COMPARABLE' },
  'changed-outside-declaration': { text: 'text-amber-accent', border: 'border-amber-accent/40', bg: 'bg-amber-accent/8', label: 'CHANGED OUTSIDE DECLARATION' },
  confounded: { text: 'text-red-accent', border: 'border-red-accent/40', bg: 'bg-red-accent/8', label: 'NOT FULLY COMPARABLE' },
} as const;

export function ExperimentView({ corpus, exp, onOpenExecution, onOpenTrial }: {
  corpus: EvolveCorpus;
  exp: Experiment;
  onOpenExecution: (id: string) => void;
  onOpenTrial?: (trialId: string) => void;
}) {
  const arms = exp.armIds.map((id) => corpus.arms.find((a) => a.id === id)!).filter(Boolean);
  const trials = corpus.trials.filter((t) => t.experimentId === exp.id);

  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="font-mono text-2xs uppercase tracking-[0.18em] text-ink-400">{exp.id} · status {exp.status}</div>
        <h3 className="mt-0.5 text-sm font-semibold text-ink-50">{exp.label}</h3>
        <p className="mt-1 text-2xs leading-relaxed text-ink-200">{exp.question}</p>
      </div>

      <SectionLabel>design</SectionLabel>
      <dl className="space-y-1.5">
        <KeyVal k="seed" v={exp.seed === null ? 'recorded draw (null)' : String(exp.seed)} />
        <KeyVal k="repetitions" v={String(exp.repetitions)} />
        <KeyVal k="started" v={exp.startedAt} />
        <KeyVal k="holdout" v={
          exp.design.holdoutUsed
            ? exp.design.holdoutSealed
              ? <span className="text-teal-accent">used · sealed from selection</span>
              : <span className="text-red-accent">used · NOT sealed</span>
            : <span className="text-ink-400">not used</span>
        } />
        <KeyVal k="controlled" v={exp.design.controlled.join(', ')} mono={false} />
      </dl>
      {exp.design.confounds.length > 0 && (
        <div className="rounded-[4px] border border-amber-accent/30 bg-amber-accent/5 p-2.5">
          <div className="font-mono text-2xs font-semibold uppercase tracking-widest text-amber-accent">declared confounds</div>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {exp.design.confounds.map((c, i) => <li key={i} className="text-2xs leading-relaxed text-ink-200">{c}</li>)}
          </ul>
        </div>
      )}
      <p className="text-2xs leading-relaxed text-ink-400">{exp.note}</p>

      <SectionLabel>arms</SectionLabel>
      <div className="space-y-2">
        {arms.map((arm) => {
          const cell = cellStats(trials, arm.id);
          return (
            <ArmCard key={arm.id} arm={arm} cell={cell} trials={trials.filter((t) => t.armId === arm.id)} corpus={corpus}
              onOpenExecution={onOpenExecution} onOpenTrial={onOpenTrial} />
          );
        })}
      </div>

      {arms.length >= 2 && (
        <ComparabilityPanel corpus={corpus} exp={exp} />
      )}
    </div>
  );
}

function ArmCard({ arm, cell, trials, corpus, onOpenExecution, onOpenTrial }: {
  arm: EvolveCorpus['arms'][number];
  cell: CellStats;
  trials: Trial[];
  corpus: EvolveCorpus;
  onOpenExecution: (id: string) => void;
  onOpenTrial?: (trialId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const kindStyle: Record<string, string> = {
    baseline: 'text-ink-200 border-ink-500/50 bg-ink-700/40',
    candidate: 'text-amber-accent border-amber-accent/40 bg-amber-accent/8',
    control: 'text-blue-accent border-blue-accent/40 bg-blue-accent/8',
    confounded: 'text-red-accent border-red-accent/40 bg-red-accent/8',
  };

  return (
    <div className="overflow-hidden rounded-[4px] border border-ink-700/60 bg-ink-900/70">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="w-full px-3 py-2.5 text-left transition-colors hover:bg-ink-850">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-[3px] border px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-widest ${kindStyle[arm.kind]}`}>{arm.kind.toUpperCase()}</span>
          <span className="text-xs font-medium text-ink-100">{arm.label}</span>
          <span className="ml-auto font-mono text-2xs text-ink-400">{cell.total} trial{cell.total === 1 ? '' : 's'}</span>
        </div>
        <p className="mt-1 text-2xs leading-relaxed text-ink-300">{arm.intent}</p>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-2xs">
          <PassRateCell cell={cell} />
          <span className="text-ink-400">
            usage: <UsageCell cell={cell} />
          </span>
        </div>
        {arm.changedCoordinates.length > 0 && (
          <div className="mt-1 font-mono text-2xs text-ink-400">
            declared changes: <span className="text-amber-accent/90">{arm.changedCoordinates.join(', ')}</span>
          </div>
        )}
      </button>
      {open && (
        <div className="border-t border-ink-700/50">
          {trials.map((t) => {
            const exec = corpus.executions.find((e) => e.id === t.executionId);
            return (
              <div key={t.id} className="border-b border-ink-800/50 px-3 py-2 last:border-b-0">
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => onOpenTrial?.(t.id)} className="font-mono text-2xs text-teal-accent hover:underline">{t.id}</button>
                  <span className="font-mono text-2xs text-ink-400">{t.taskId} · #{t.index}</span>
                  <OutcomeChip t={t} />
                  {exec && (
                    <button onClick={() => onOpenExecution(exec.id)} className="ml-auto font-mono text-2xs text-ink-400 hover:text-ink-100">
                      {exec.id} →
                    </button>
                  )}
                </div>
                {t.note && <p className="mt-0.5 text-2xs leading-relaxed text-ink-400">{t.note}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function OutcomeChip({ t }: { t: Trial }) {
  const style = {
    completed: 'text-teal-accent',
    failed: 'text-red-accent',
    interrupted: 'text-amber-accent',
    unclassified: 'text-ink-400',
  }[t.outcome];
  const check = t.check.status === 'passed' ? '\u2713' : t.check.status === 'failed' ? '\u2715' : '\u2205';
  const checkCls = t.check.status === 'passed' ? 'text-teal-accent' : t.check.status === 'failed' ? 'text-red-accent' : 'text-amber-accent';
  return (
    <span className="inline-flex items-center gap-2 font-mono text-2xs">
      <span className={style}>{t.outcome}</span>
      <span className={checkCls} title={`check: ${t.check.status}${t.check.reason ? ` — ${t.check.reason}` : ''}`}>
        check {check}
      </span>
      {t.evaluator.status === 'unavailable' && <span className="text-amber-accent" title={t.evaluator.reason}>evaluator \u2205</span>}
    </span>
  );
}

function PassRateCell({ cell }: { cell: CellStats }) {
  if ('unavailable' in cell.passRate) {
    return <span className="text-ink-500">pass rate: no verdicts</span>;
  }
  const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
  return (
    <span className="text-ink-200" title="Wilson score interval, 95%. A failed check is a task failure; an unavailable check enters neither side.">
      pass {cell.passes}/{cell.passDenominator} · {pct(cell.passRate.centre)}{' '}
      <span className="text-ink-500">[{pct(cell.passRate.low)}, {pct(cell.passRate.high)}]</span>
    </span>
  );
}

function UsageCell({ cell }: { cell: CellStats }) {
  if ('unavailable' in cell.usage) return <span className="text-ink-500">not recorded</span>;
  return (
    <span className="text-ink-200" title="Median and interquartile range over trials with recorded usage. Missing rows are counted, never zeroed.">
      ~{(cell.usage.medianTokens / 1000).toFixed(1)}k tok
      {cell.usage.missing > 0 && <span className="text-amber-accent"> · {cell.usage.missing} missing</span>}
    </span>
  );
}

function ComparabilityPanel({ corpus, exp }: { corpus: EvolveCorpus; exp: Experiment }) {
  const [aId, setAId] = useState(exp.armIds[0]);
  const [bId, setBId] = useState(exp.armIds[1]);
  const [showCoords, setShowCoords] = useState(false);

  const report = useMemo(() => compareArms(corpus, aId, bId), [corpus, aId, bId]);
  const verdict = VERDICT_STYLE[report.verdict];

  const grouped = useMemo(() => {
    const g: Record<string, typeof report.coordinates> = { matched: [], changed: [], unmatched: [] };
    for (const c of report.coordinates) (g[c.cls === 'changed' ? 'changed' : c.cls === 'unmatched' ? 'unmatched' : 'matched'] ?? g.matched).push(c);
    return g;
  }, [report]);

  return (
    <div className="space-y-2">
      <SectionLabel>comparability inspector — {exp.armIds.length} arms</SectionLabel>
      <div className="flex flex-wrap items-center gap-2">
        <select value={aId} onChange={(e) => setAId(e.target.value)} aria-label="Arm A"
          className="max-w-[220px] rounded-[4px] border border-ink-600/70 bg-ink-850 px-2 py-1 font-mono text-2xs text-ink-100 focus:outline-none">
          {exp.armIds.map((id) => <option key={id} value={id}>{corpus.arms.find((a) => a.id === id)?.label ?? id}</option>)}
        </select>
        <span className="font-mono text-2xs text-ink-500">vs</span>
        <select value={bId} onChange={(e) => setBId(e.target.value)} aria-label="Arm B"
          className="max-w-[220px] rounded-[4px] border border-ink-600/70 bg-ink-850 px-2 py-1 font-mono text-2xs text-ink-100 focus:outline-none">
          {exp.armIds.map((id) => <option key={id} value={id}>{corpus.arms.find((a) => a.id === id)?.label ?? id}</option>)}
        </select>
        <span className={`ml-auto rounded-[3px] border px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-widest ${verdict.text} ${verdict.border} ${verdict.bg}`}>
          {verdict.label}
        </span>
      </div>
      <p className="text-2xs leading-relaxed text-ink-300">{report.summary}</p>
      <button onClick={() => setShowCoords(!showCoords)} aria-expanded={showCoords}
        className="font-mono text-2xs text-ink-400 underline-offset-2 hover:text-ink-100 hover:underline">
        {showCoords ? 'hide' : 'show'} all {report.coordinates.length} coordinates
      </button>
      {showCoords && (
        <div className="space-y-1">
          {(['matched', 'changed', 'unmatched'] as const).map((cls) =>
            grouped[cls].map((c) => (
              <div key={c.kind} className="grid grid-cols-[118px_1fr] items-baseline gap-3 border-b border-ink-800/50 pb-1" title={c.why}>
                <div className="font-mono text-2xs text-ink-400">{c.label}</div>
                <div className="min-w-0 break-words font-mono text-2xs">
                  {cls === 'matched' && <span className="text-ink-300">{c.a} <span className="text-ink-600">=</span> {c.b}</span>}
                  {cls === 'changed' && (
                    <span className="text-amber-accent">
                      {c.a} <span className="text-ink-600">\u2260</span> {c.b}
                      {c.declaredChange && <span className="ml-1.5 text-ink-400">(declared change)</span>}
                    </span>
                  )}
                  {cls === 'unmatched' && (
                    <span className="text-red-accent/90">
                      {c.aUnavailable ? `A: UNAVAILABLE — ${c.aUnavailable}` : `A: ${c.a}`} <span className="text-ink-600">|</span>{' '}
                      {c.bUnavailable ? `B: UNAVAILABLE — ${c.bUnavailable}` : `B: ${c.b}`}
                    </span>
                  )}
                </div>
              </div>
            )),
          )}
        </div>
      )}
    </div>
  );
}
