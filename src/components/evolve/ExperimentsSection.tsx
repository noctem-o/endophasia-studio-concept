import { useMemo, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import type { EvolveCorpus, Experiment, ExperimentArm, Trial } from '../../domain/evolve';
import { cellStats, compareArms } from '../../analysis/evolve';
import type { CellStats, CoordinateComparison } from '../../analysis/evolve';
import { Button, Chip, IconButton, SelectField } from '../../ui/controls';
import { InspectorColumn } from '../InspectorColumn';
import { Badge, Callout, Def, DefList, NotRecorded, Section } from '../../ui/layout';
import { IntervalBar } from '../../ui/viz';
import { Block, DossierBody, DossierHeader, ListItem, ListPane, Split } from './LabLayout';
import { CheckMark, ContinuationTag, OutcomeText } from './shared';
import { isProjectionArm, outcomeQualification } from './evolveMeta';

type Verdict = ReturnType<typeof compareArms>['verdict'];

const VERDICT: Record<Verdict, { label: string; tone: 'neutral' | 'attn' | 'fault' }> = {
  comparable: { label: 'COMPARABLE', tone: 'neutral' },
  'changed-outside-declaration': { label: 'CHANGED OUTSIDE ITS DECLARATION', tone: 'attn' },
  confounded: { label: 'NOT FULLY COMPARABLE — NO VERDICT OFFERED', tone: 'fault' },
};

const statusTag = (s: Experiment['status']) =>
  s === 'complete'
    ? 'border-line-strong text-fg-2'
    : 'border-attn/50 bg-attn/10 text-attn';

export function ExperimentsSection({ corpus, experimentId, onSelect, onOpenExecution, onOpenSession }: {
  corpus: EvolveCorpus;
  experimentId: string;
  onSelect: (id: string) => void;
  onOpenExecution: (id: string) => void;
  onOpenSession: (sessionId: string) => void;
}) {
  const exp = corpus.experiments.find((x) => x.id === experimentId) ?? corpus.experiments[0];
  const [trialId, setTrialId] = useState<string | null>(null);
  // Below lg the inspector is a drawer: opened by a trial or by the Details button.
  const [drawer, setDrawer] = useState(false);
  const trials = useMemo(() => corpus.trials.filter((t) => t.experimentId === exp?.id), [corpus, exp]);
  const trial = trials.find((t) => t.id === trialId) ?? null;
  if (!exp) return null;
  const arms = exp.armIds.map((id) => corpus.arms.find((a) => a.id === id)).filter((a): a is ExperimentArm => Boolean(a));

  return (
    <Split
      list={
        <ListPane title="Experiments" count={corpus.experiments.length}>
          {corpus.experiments.map((x) => (
            <ListItem key={x.id} selected={x.id === exp.id} onClick={() => { setTrialId(null); setDrawer(false); onSelect(x.id); }} label={x.label}>
              <div className="text-xs font-medium text-fg-1">{x.label}</div>
              <div className="mt-1 flex items-center gap-2 font-mono text-2xs text-fg-3 tnum">
                <span className={`rounded-tag border px-1.5 ${statusTag(x.status)}`}>{x.status}</span>
                {x.armIds.length} arms · {corpus.trials.filter((t) => t.experimentId === x.id).length} trials
              </div>
              <p className="mt-1 line-clamp-2 text-2xs leading-snug text-fg-3">{x.question}</p>
            </ListItem>
          ))}
        </ListPane>
      }
      inspector={
        <InspectorColumn label="Trial inspector" open={drawer} onClose={() => setDrawer(false)} width="lg:w-[380px]">
          {trial ? (
            <TrialInspector corpus={corpus} trial={trial} onClose={() => { setTrialId(null); setDrawer(false); }} onOpenExecution={onOpenExecution} onOpenSession={onOpenSession} />
          ) : (
            <DesignPanel exp={exp} />
          )}
        </InspectorColumn>
      }
    >
      <DossierBody>
        <DossierHeader
          eyebrow={<><span>{exp.id}</span><span aria-hidden>·</span><span>started {exp.startedAt.slice(0, 10)}</span><span className={`rounded-tag border px-1.5 ${statusTag(exp.status)}`}>{exp.status}</span></>}
          title={exp.label}
          lede={exp.question}
          tags={<Button onClick={() => setDrawer(true)} className="lg:hidden">design &amp; trial details</Button>}
        />
        {exp.design.confounds.length > 0 && (
          <Callout tone="attn" title="Declared confounds">
            <ul className="list-disc space-y-1 pl-4">{exp.design.confounds.map((c, i) => <li key={i}>{c}</li>)}</ul>
          </Callout>
        )}

        <Block
          id="arms"
          title="Arms"
          note="Every bar is drawn on the same 0–100% axis. The bar is the 95% Wilson interval; the tick is the observed fraction; n is always printed. A check that was unavailable enters neither side of the denominator."
        >
          <div className={`grid gap-3 ${arms.length >= 3 ? 'xl:grid-cols-3' : ''} md:grid-cols-2`}>
            {arms.map((arm) => isProjectionArm(corpus, arm.id)
              ? <ProjectionCard key={arm.id} arm={arm} corpus={corpus} />
              : <ArmCard key={arm.id} arm={arm} cell={cellStats(trials, arm.id)} />)}
          </div>
        </Block>

        {arms.length >= 2 && (
          <Block id="comparability" title="Comparability" note="Two arms are compared coordinate by coordinate. A missing coordinate is neither equal nor different: it blocks the comparison.">
            <ComparabilityPanel corpus={corpus} exp={exp} />
          </Block>
        )}

        <Block id="trials" title="Trials" note={`${trials.length} trial records. Select one to see its verdicts.`}>
          <TrialTable corpus={corpus} trials={trials} selectedId={trialId} onSelect={(id) => { setTrialId(id); setDrawer(id !== null); }} />
        </Block>
      </DossierBody>
    </Split>
  );
}

// ─── Arms ────────────────────────────────────────────────────────────────────

/**
 * An arm anchored only by a simulated branch. It is drawn as what it is: hatched, with no results axis, no usage and no pass
 * rate, because a projection has none to show (and "no verdicts yet" would imply some could arrive).
 */
function ProjectionCard({ arm, corpus }: { arm: ExperimentArm; corpus: EvolveCorpus }) {
  const execs = arm.executionIds.map((id) => corpus.executions.find((e) => e.id === id)).filter((e): e is NonNullable<typeof e> => Boolean(e));
  return (
    <article className="hatch-der-faint flex flex-col rounded-panel border border-der/40 bg-surface-1 p-3.5">
      <div className="flex items-center gap-2">
        <ContinuationTag kind="simulated" />
        <span className="ml-auto font-mono text-2xs text-fg-3">no trials: it is not an execution</span>
      </div>
      <h4 className="mt-2 text-sm font-medium text-fg-1">{arm.label}</h4>
      <p className="mt-1 text-xs leading-relaxed text-fg-3">{arm.intent}</p>
      <p className="mt-3 rounded-ctl border border-der/30 bg-surface-1/90 px-2.5 py-2 text-xs leading-relaxed text-fg-1">A projection has no pass rate. It carries no usage and is excluded from every aggregate and from every comparison of results.</p>
      {execs.length > 0 && <p className="mt-2 font-mono text-2xs text-fg-3">projection: {execs.map((e) => e.id).join(', ')}</p>}
    </article>
  );
}

function ArmCard({ arm, cell }: { arm: ExperimentArm; cell: CellStats }) {
  const confounded = arm.kind === 'confounded';
  const rate = 'unavailable' in cell.passRate ? null : cell.passRate;
  return (
    <article className="flex flex-col rounded-panel border border-line bg-surface-1 p-3.5 shadow-inset">
      <div className="flex items-center gap-2">
        <span className={`rounded-tag border px-1.5 font-mono text-2xs font-medium tracking-wider ${confounded ? 'border-attn/50 bg-attn/10 text-attn' : 'border-line-strong text-fg-2'}`}>{arm.kind.toUpperCase()}</span>
        <span className="ml-auto font-mono text-2xs text-fg-3 tnum">{cell.total} {cell.total === 1 ? 'trial' : 'trials'}</span>
      </div>
      <h4 className="mt-2 text-sm font-medium text-fg-1">{arm.label}</h4>
      <p className="mt-1 text-xs leading-relaxed text-fg-3">{arm.intent}</p>
      <div className="mt-3">
        <IntervalBar
          passes={cell.passes}
          denominator={cell.passDenominator}
          interval={rate}
          emptyReason={'unavailable' in cell.passRate ? cell.passRate.reason : undefined}
        />
      </div>
      <dl className="mt-3 space-y-2 border-t border-line-subtle pt-2.5 font-mono text-2xs">
        <div><dt className="text-fg-3">usage</dt><dd className="mt-0.5 text-fg-2">{'unavailable' in cell.usage ? <NotRecorded reason={cell.usage.reason} /> : (
          <span className="tnum">~{(cell.usage.medianTokens / 1000).toFixed(1)}k tok <span className="text-fg-3">median of {cell.usage.n}</span>{cell.usage.missing > 0 && <span className="text-attn"> · {cell.usage.missing} missing, not zero</span>}</span>
        )}</dd></div>
        {cell.interrupted > 0 && <div><dt className="text-fg-3">interrupted</dt><dd className="mt-0.5 text-attn tnum">{cell.interrupted}</dd></div>}
        {arm.changedCoordinates.length > 0 && (
          <div><dt className="text-fg-3">declared changes</dt><dd className="mt-1 flex min-w-0 flex-wrap gap-1">{arm.changedCoordinates.map((c) => <Badge key={c}>{c}</Badge>)}</dd></div>
        )}
      </dl>
    </article>
  );
}

// ─── Comparability ───────────────────────────────────────────────────────────

function ComparabilityPanel({ corpus, exp }: { corpus: EvolveCorpus; exp: Experiment }) {
  const [aId, setAId] = useState(exp.armIds[0]);
  const [bId, setBId] = useState(exp.armIds[1] ?? exp.armIds[0]);
  const [all, setAll] = useState(false);
  // Keep the chosen arms valid when the experiment changes under us.
  const a = exp.armIds.includes(aId) ? aId : exp.armIds[0];
  const b = exp.armIds.includes(bId) ? bId : (exp.armIds[1] ?? exp.armIds[0]);
  const report = useMemo(() => compareArms(corpus, a, b), [corpus, a, b]);
  const v = VERDICT[report.verdict];
  const qualification = useMemo(() => outcomeQualification(corpus, corpus.trials.filter((t) => t.experimentId === exp.id), a, b), [corpus, exp.id, a, b]);
  const rows = report.coordinates.filter((c) => all || c.cls !== 'matched');
  const hidden = report.coordinates.length - rows.length;
  const armLabel = (id: string) => corpus.arms.find((x) => x.id === id)?.label ?? id;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <SelectField label="Arm A" value={a} onChange={setAId}>{exp.armIds.map((id) => <option key={id} value={id}>{armLabel(id)}</option>)}</SelectField>
        <span className="font-mono text-2xs text-fg-3">against</span>
        <SelectField label="Arm B" value={b} onChange={setBId}>{exp.armIds.map((id) => <option key={id} value={id}>{armLabel(id)}</option>)}</SelectField>
      </div>

      <Callout tone={v.tone} title={v.label}>{report.summary}</Callout>
      {qualification && <Callout tone="attn" title="No outcome to compare">{qualification}</Callout>}

      {report.drift.length > 0 && (
        <Callout tone="attn" title="Within-arm drift">
          <p>A coordinate that varies between replicates of one arm is not a property of the arm.</p>
          <ul className="mt-1.5 space-y-1">
            {report.drift.map((d) => (
              <li key={d.kind} className="font-mono text-2xs"><span className="text-fg-1">{d.label}</span> varies: {d.variants.map((x) => `${x.value} (${x.executionIds.join(', ')})`).join(' | ')}</li>
            ))}
          </ul>
        </Callout>
      )}

      <div className="overflow-hidden rounded-panel border border-line">
        <div className="flex items-center gap-3 border-b border-line bg-surface-2 px-3 py-2">
          <span className="eyebrow">Coordinates</span>
          <span className="font-mono text-2xs text-fg-3 tnum">{rows.length} shown{hidden > 0 ? ` · ${hidden} matched hidden` : ''}</span>
          <Chip active={all} onClick={() => setAll((x) => !x)} className="ml-auto" title="Show the coordinates that matched as well">show matched</Chip>
        </div>
        {rows.length === 0 ? (
          <p className="px-3 py-4 font-mono text-2xs text-fg-3">every coordinate matched — nothing differs between these arms</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead><tr className="eyebrow border-b border-line-subtle"><th className="px-3 py-1.5 font-medium">coordinate</th><th className="px-2 py-1.5 font-medium">A</th><th className="px-2 py-1.5 font-medium">B</th><th className="px-3 py-1.5 font-medium">state</th></tr></thead>
            <tbody>{rows.map((c) => <CoordinateRow key={c.kind} c={c} />)}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function CoordinateRow({ c }: { c: CoordinateComparison }) {
  const state =
    c.cls === 'matched' ? { text: '= matched', cls: 'text-fg-3' }
    : c.cls === 'changed' ? (c.declaredChange ? { text: '≠ declared change', cls: 'text-fg-1' } : { text: '≠ outside declaration', cls: 'text-attn' })
    : c.cls === 'unmatched' ? { text: '∅ cannot compare', cls: 'text-attn' }
    : { text: 'not declared', cls: 'text-fg-3' };
  const side = (value?: string, why?: string) => (why ? <NotRecorded reason={why} /> : <span className="font-mono text-2xs text-fg-1">{value ?? '—'}</span>);
  return (
    <tr className="border-b border-line-subtle align-top last:border-b-0" title={c.why}>
      <td className="px-3 py-1.5"><div className="text-xs text-fg-1">{c.label}</div><div className="font-mono text-2xs text-fg-3">{c.group}</div></td>
      <td className="max-w-0 px-2 py-1.5">{side(c.a, c.aUnavailable)}</td>
      <td className="max-w-0 px-2 py-1.5">{side(c.b, c.bUnavailable)}</td>
      <td className={`whitespace-nowrap px-3 py-1.5 font-mono text-2xs ${state.cls}`}>{state.text}</td>
    </tr>
  );
}

// ─── Trials ──────────────────────────────────────────────────────────────────

function TrialTable({ corpus, trials, selectedId, onSelect }: { corpus: EvolveCorpus; trials: Trial[]; selectedId: string | null; onSelect: (id: string | null) => void }) {
  const armLabel = (id: string) => corpus.arms.find((a) => a.id === id)?.label ?? id;
  return (
    <div className="overflow-hidden rounded-panel border border-line">
      <table className="w-full text-left text-xs">
        <thead><tr className="eyebrow border-b border-line bg-surface-2">
          <th className="px-3 py-2 font-medium">trial</th><th className="px-2 py-2 font-medium">arm</th><th className="px-2 py-2 font-medium">outcome</th><th className="px-2 py-2 font-medium">check</th><th className="hidden px-2 py-2 font-medium md:table-cell">evaluator</th><th className="hidden px-3 py-2 text-right font-medium xl:table-cell">usage</th>
        </tr></thead>
        <tbody>
          {trials.map((t) => {
            const sel = t.id === selectedId;
            return (
              <tr key={t.id} onClick={() => onSelect(sel ? null : t.id)} aria-selected={sel} tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(sel ? null : t.id); } }}
                className={`relative cursor-pointer border-b border-line-subtle last:border-b-0 ${sel ? 'bg-surface-3' : 'hover:bg-surface-2'}`}>
                <td className="relative px-3 py-2">{sel && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-select" />}<div className="font-mono text-2xs text-fg-1">{t.id}</div><div className="font-mono text-2xs text-fg-3">{t.taskId} · #{t.index}</div></td>
                <td className="max-w-[180px] truncate px-2 py-2 text-fg-2">{armLabel(t.armId)}</td>
                <td className="px-2 py-2"><OutcomeText outcome={t.outcome} /></td>
                <td className="px-2 py-2"><CheckMark status={t.check.status} reason={t.check.reason} /></td>
                <td className="hidden px-2 py-2 md:table-cell"><CheckMark status={t.evaluator.status} reason={t.evaluator.reason} /></td>
                <td className="hidden px-3 py-2 text-right font-mono text-2xs tnum xl:table-cell">
                  {'unavailable' in t.usage ? <NotRecorded reason={t.usage.reason} /> : <span className="text-fg-2">{(t.usage.promptTokens + t.usage.completionTokens).toLocaleString()} tok</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Inspector ───────────────────────────────────────────────────────────────

function DesignPanel({ exp }: { exp: Experiment }) {
  return (
    <div className="h-full min-h-0 space-y-4 overflow-y-auto scrollbar-thin px-4 py-4">
      <header><div className="eyebrow">Design</div><h2 className="mt-1 font-serif text-xl leading-snug text-fg-1">How this was set up</h2></header>
      <DefList>
        <Def k="seed">{exp.seed === null ? 'recorded draw (null)' : String(exp.seed)}</Def>
        <Def k="repetitions">{exp.repetitions}</Def>
        <Def k="started">{exp.startedAt}</Def>
        <Def k="holdout" mono={false}>
          {exp.design.holdoutUsed ? (exp.design.holdoutSealed ? 'used · sealed from selection' : <span className="text-fault">used · NOT sealed from selection</span>) : 'not used'}
        </Def>
      </DefList>
      <Section title="Held constant"><ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-fg-2">{exp.design.controlled.map((c, i) => <li key={i}>{c}</li>)}</ul></Section>
      <Section title="Note"><p className="text-xs leading-relaxed text-fg-3">{exp.note}</p></Section>
      <p className="rounded-ctl border border-dashed border-line-strong px-3 py-2.5 text-xs leading-relaxed text-fg-3">Select a trial to see its verdicts, usage and links.</p>
    </div>
  );
}

function TrialInspector({ corpus, trial, onClose, onOpenExecution, onOpenSession }: { corpus: EvolveCorpus; trial: Trial; onClose: () => void; onOpenExecution: (id: string) => void; onOpenSession: (sid: string) => void }) {
  const exec = corpus.executions.find((e) => e.id === trial.executionId);
  const arm = corpus.arms.find((a) => a.id === trial.armId);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-4"><span className="eyebrow">Trial</span><span className="font-mono text-2xs text-fg-3">{trial.id}</span><IconButton label="Close trial" onClick={onClose} className="ml-auto"><X className="h-3.5 w-3.5" aria-hidden /></IconButton></div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto scrollbar-thin px-4 py-4">
        <header><h2 className="text-lg font-medium text-fg-1">{trial.taskId} — attempt {trial.index}</h2>{trial.note && <p className="mt-1.5 text-xs leading-relaxed text-fg-3">{trial.note}</p>}</header>
        <Section title="Verdicts">
          <DefList>
            <Def k="outcome"><OutcomeText outcome={trial.outcome} /></Def>
            <Def k="check">{trial.check.status === 'unavailable' ? <NotRecorded reason={trial.check.reason} /> : <CheckMark status={trial.check.status} reason={trial.check.reason} />}</Def>
            <Def k="evaluator">{trial.evaluator.status === 'unavailable' ? <NotRecorded reason={trial.evaluator.reason} /> : <CheckMark status={trial.evaluator.status} />}</Def>
            <Def k="usage">{'unavailable' in trial.usage ? <NotRecorded reason={trial.usage.reason} /> : `${trial.usage.promptTokens.toLocaleString()} prompt + ${trial.usage.completionTokens.toLocaleString()} completion`}</Def>
            <Def k="wall time">{typeof trial.wallMs === 'number' ? `${(trial.wallMs / 1000).toFixed(1)} s` : <NotRecorded reason={trial.wallMs.reason} />}</Def>
          </DefList>
          <p className="mt-2 text-2xs leading-relaxed text-fg-3">A failed evaluator run is not a failed task, and an unavailable check is not a failed check.</p>
        </Section>
        <Section title="Context">
          <DefList>
            {arm && <Def k="arm" mono={false}>{arm.label} <span className="font-mono text-2xs text-fg-3">({arm.kind})</span></Def>}
            {exec && <Def k="execution" mono={false}><button type="button" onClick={() => onOpenExecution(exec.id)} className="text-left text-fg-1 underline decoration-line-strong underline-offset-2 hover:decoration-fg-2">{exec.label}</button></Def>}
          </DefList>
        </Section>
        <Section title="Trajectory">
          {trial.sessionId ? (
            <Button onClick={() => onOpenSession(trial.sessionId!)} leading={<ExternalLink className="h-3 w-3" aria-hidden />}>open {trial.sessionId} in Observe →</Button>
          ) : (
            <div className="space-y-1.5"><NotRecorded what="trajectory" reason="not in the observation registry" /><p className="text-2xs leading-relaxed text-fg-3">Verdicts come from the trial record only.</p></div>
          )}
        </Section>
      </div>
    </div>
  );
}
