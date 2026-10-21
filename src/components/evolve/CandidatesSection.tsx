import { useMemo, useState } from 'react';
import type { Candidate, EvolveCorpus, PromotionRecord, PromotionStage, PromotionStep } from '../../domain/evolve';
import { candidateStatusMeta } from '../../domain/evolve';
import { cellStats, compareArms } from '../../analysis/evolve';
import { Button, SelectField } from '../../ui/controls';
import { Badge, Callout, Def, DefList, Section } from '../../ui/layout';
import { IntervalBar } from '../../ui/viz';
import { InspectorColumn } from '../InspectorColumn';
import { Block, DossierBody, DossierHeader, ListItem, ListPane, Split } from './LabLayout';
import { diffCandidates } from './candidateDiff';
import { outcomeQualification } from './evolveMeta';

/** The gates a candidate can pass, in order. Each is a SEPARATE recorded decision. */
const GATES: { stage: PromotionStage; label: string }[] = [
  { stage: 'observed', label: 'Observed' },
  { stage: 'proposed', label: 'Proposed' },
  { stage: 'isolated', label: 'Isolated' },
  { stage: 'evaluated', label: 'Evaluated' },
  { stage: 'compared', label: 'Compared' },
  { stage: 'reviewed', label: 'Reviewed' },
  { stage: 'authorised', label: 'Authorised' },
  { stage: 'promoted', label: 'Promoted' },
];

type GateState = 'done' | 'failed' | 'unavailable' | 'none';

const stateWord: Record<GateState, string> = { done: 'recorded', failed: 'failed', unavailable: 'unavailable', none: 'no record' };

function Gate({ label, state, selected, onClick }: { label: string; state: GateState; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`${label} gate: ${stateWord[state]}`}
      className={`group flex w-full min-w-0 flex-col items-center gap-1.5 rounded-ctl px-1 py-2 text-center transition-colors duration-100 ${selected ? 'bg-surface-3' : 'hover:bg-surface-2'}`}
    >
      <span
        aria-hidden
        className={`relative flex h-6 w-6 items-center justify-center rounded-full border ${
          state === 'done' ? 'border-select bg-select text-surface-0'
          : state === 'failed' ? 'border-fault bg-fault/15 text-fault'
          : state === 'unavailable' ? 'hatch border-dashed border-na bg-surface-1 text-na'
          : 'border-dashed border-line-strong text-fg-4'
        }`}
      >
        {state === 'done' && <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2.4 6.4 5 9l4.8-5.4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        {state === 'failed' && <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>}
      </span>
      <span className={`text-2xs font-medium ${state === 'none' ? 'text-fg-3' : 'text-fg-1'}`}>{label}</span>
      <span className={`font-mono text-2xs ${state === 'failed' ? 'text-fault' : 'text-fg-3'}`}>{stateWord[state]}</span>
    </button>
  );
}

/**
 * The promotion sequence as a row of separate gates, with a deliberate gap between them: it is not a pipeline. Passing the
 * evaluation gate does not open the review gate, and authorisation does not promote. A gate with no record is shown as exactly
 * that, never as "pending" or "in progress".
 */
function GateRail({ promo }: { promo: PromotionRecord | undefined }) {
  const [open, setOpen] = useState<PromotionStage | null>(null);
  const stepOf = (stage: PromotionStage): PromotionStep | undefined => promo?.steps.find((s) => s.stage === stage);
  const stateOf = (stage: PromotionStage): GateState => stepOf(stage)?.status ?? 'none';
  const detail = open ? stepOf(open) : undefined;
  const blocked = promo?.steps.find((s) => s.stage === 'blocked');

  return (
    <div>
      <div className="grid grid-cols-8 gap-x-1.5" role="group" aria-label="Promotion gates">
        {GATES.map((g) => <Gate key={g.stage} label={g.label} state={stateOf(g.stage)} selected={open === g.stage} onClick={() => setOpen(open === g.stage ? null : g.stage)} />)}
      </div>
      <p className="mt-1 text-2xs leading-relaxed text-fg-3">Each gate is its own recorded decision, and the gaps are deliberate. Evaluation success never implies authorisation; authorisation never implies promotion.</p>

      {open && (
        <div className="mt-3 rounded-ctl border border-line bg-surface-2 p-3" role="region" aria-label={`${open} gate detail`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium capitalize text-fg-1">{open}</span>
            <Badge>{stateWord[stateOf(open)]}</Badge>
            {detail?.recordId && <span className="font-mono text-2xs text-fg-3">{detail.recordId}</span>}
            {detail?.authority && <span className="font-mono text-2xs text-fg-2">authority: {detail.authority}</span>}
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-fg-2">{detail ? detail.note : 'No record exists for this gate. Nothing is implied about it.'}</p>
        </div>
      )}
      {blocked && <Callout tone="attn" title="Blocked" className="mt-3">{blocked.note}</Callout>}
      {promo && (
        <div className="mt-3 rounded-ctl border border-line bg-surface-1 p-3">
          <div className="eyebrow">Recorded outcome</div>
          <p className="mt-1 text-xs leading-relaxed text-fg-1">{promo.outcome}</p>
          {promo.authorisation && <p className="mt-1.5 font-mono text-2xs text-fg-3">authorisation by {promo.authorisation.authority}: {promo.authorisation.note}</p>}
        </div>
      )}
    </div>
  );
}

export function CandidatesSection({ corpus, candidateId, onSelect, onOpenExecution, onOpenExperiment }: {
  corpus: EvolveCorpus;
  candidateId: string;
  onSelect: (id: string) => void;
  onOpenExecution: (id: string) => void;
  onOpenExperiment: (id: string) => void;
}) {
  const [drawer, setDrawer] = useState(false); // below lg the trail is a drawer
  const cand = corpus.candidates.find((c) => c.id === candidateId) ?? corpus.candidates[0];
  if (!cand) return null;
  const promo = corpus.promotions.find((p) => p.candidateId === cand.id);
  const status = candidateStatusMeta[cand.status];
  const baseline = corpus.executions.find((e) => e.id === cand.baselineExecutionId);
  const parent = cand.parentId ? corpus.candidates.find((c) => c.id === cand.parentId) : undefined;
  const experiments = corpus.experiments.filter((x) => x.armIds.some((a) => corpus.arms.find((ar) => ar.id === a)?.candidateId === cand.id));

  return (
    <Split
      list={
        <ListPane title="Candidates" count={corpus.candidates.length}>
          {corpus.candidates.map((c) => {
            const m = candidateStatusMeta[c.status];
            return (
              <ListItem key={c.id} selected={c.id === cand.id} onClick={() => { setDrawer(false); onSelect(c.id); }} label={c.label}>
                <span className={`inline-block rounded-tag border px-1.5 font-mono text-2xs font-medium tracking-wider ${m.text} ${m.border} ${m.bg}`}>{m.label}</span>
                <div className="mt-1.5 text-xs font-medium text-fg-1">{c.label}</div>
                <p className="mt-0.5 line-clamp-2 text-2xs leading-snug text-fg-3">{c.change.summary}</p>
              </ListItem>
            );
          })}
        </ListPane>
      }
      inspector={
        <InspectorColumn label="Candidate trail" open={drawer} onClose={() => setDrawer(false)} width="lg:w-[360px]">
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin px-4 py-4">
          <div className="eyebrow">Trail</div>
          <h2 className="mt-1 font-serif text-xl leading-snug text-fg-1">What this candidate touched</h2>
          <div className="mt-4 space-y-4">
            <Section title="Baseline it proposes to replace">
              {baseline ? <button type="button" onClick={() => onOpenExecution(baseline.id)} className="w-full rounded-ctl border border-line bg-surface-2 px-2.5 py-2 text-left transition-colors duration-100 hover:border-line-strong hover:bg-surface-3"><div className="text-xs text-fg-1">{baseline.label}</div><div className="font-mono text-2xs text-fg-3">{baseline.id} · open in lineage →</div></button> : <p className="font-mono text-2xs text-fg-3">{cand.baselineExecutionId}</p>}
            </Section>
            {parent && (
              <Section title="Revision of">
                <button type="button" onClick={() => onSelect(parent.id)} className="w-full rounded-ctl border border-line bg-surface-2 px-2.5 py-2 text-left transition-colors duration-100 hover:border-line-strong hover:bg-surface-3"><div className="text-xs text-fg-1">{parent.label}</div><div className="font-mono text-2xs text-fg-3">{parent.id}</div></button>
              </Section>
            )}
            <Section title="Executions under this candidate" note={`${cand.executionIds.length}`}>
              {cand.executionIds.length === 0 ? <p className="font-mono text-2xs text-fg-3">none: nothing has been run under this candidate</p> : (
                <ul className="space-y-1">{cand.executionIds.map((id) => { const e = corpus.executions.find((x) => x.id === id); return (
                  <li key={id}><button type="button" onClick={() => onOpenExecution(id)} className="w-full rounded-ctl border border-line bg-surface-2 px-2.5 py-1.5 text-left transition-colors duration-100 hover:border-line-strong hover:bg-surface-3"><div className="truncate text-xs text-fg-1">{e?.label ?? id}</div><div className="font-mono text-2xs text-fg-3">{id}</div></button></li>); })}</ul>
              )}
            </Section>
            <Section title="Experiments" note={`${experiments.length}`}>
              {experiments.length === 0 ? <p className="font-mono text-2xs text-fg-3">none defined — a proposal, nothing evaluated</p> : (
                <ul className="space-y-1">{experiments.map((x) => <li key={x.id}><button type="button" onClick={() => onOpenExperiment(x.id)} className="w-full rounded-ctl border border-line bg-surface-2 px-2.5 py-1.5 text-left transition-colors duration-100 hover:border-line-strong hover:bg-surface-3"><div className="truncate text-xs text-fg-1">{x.label}</div><div className="font-mono text-2xs text-fg-3">{x.id} · {x.status}</div></button></li>)}</ul>
              )}
            </Section>
          </div>
          </div>
        </InspectorColumn>
      }
    >
      <DossierBody>
        <DossierHeader
          eyebrow={<><span>{cand.id}</span><span aria-hidden>·</span><span>proposed {cand.proposedAt.slice(0, 10)}</span></>}
          title={cand.label}
          lede={cand.change.summary}
          tags={<><span title={status.desc} className={`rounded-tag border px-2 py-0.5 font-mono text-2xs font-medium tracking-wider ${status.text} ${status.border} ${status.bg}`}>{status.label}</span><span className="text-xs text-fg-3">{status.desc}</span><Button onClick={() => setDrawer(true)} className="lg:hidden">trail</Button></>}
        />

        <Block id="change" title="The change">
          <DefList>
            <Def k="target">{cand.change.target}</Def>
            <Def k="artifact">{cand.change.artifactId}</Def>
            <Def k="baseline" mono={false}>{baseline ? `${baseline.label} (${baseline.id})` : cand.baselineExecutionId}</Def>
            <Def k="note" mono={false}>{cand.note}</Def>
          </DefList>
        </Block>

        <Block id="gates" title="Promotion gates" note="Separate recorded decisions, not a pipeline.">
          <GateRail key={cand.id} promo={promo} />
          {!promo && <p className="mt-3 text-xs text-fg-3">No promotion record exists for this candidate, so no gate has been recorded.</p>}
        </Block>

        <Block id="evaluation" title="Evaluation record" note="Observed fractions with 95% Wilson intervals on one shared axis. A comparison is offered only when the arms are comparable.">
          {experiments.length === 0 ? (
            <p className="text-xs text-fg-3">No experiment is defined: a proposal, nothing evaluated.</p>
          ) : (
            <div className="space-y-3">
              {experiments.map((exp) => <EvaluationCard key={exp.id} corpus={corpus} candidate={cand} expId={exp.id} onOpenExperiment={onOpenExperiment} />)}
            </div>
          )}
        </Block>

        <Block id="diff" title="Compare with another candidate" note="Record-level differences only: these are fields of two records, not a ranking.">
          <CandidateDiff corpus={corpus} base={cand} />
        </Block>
      </DossierBody>
    </Split>
  );
}

function EvaluationCard({ corpus, candidate, expId, onOpenExperiment }: { corpus: EvolveCorpus; candidate: Candidate; expId: string; onOpenExperiment: (id: string) => void }) {
  const exp = corpus.experiments.find((x) => x.id === expId)!;
  const candArms = exp.armIds.filter((a) => corpus.arms.find((ar) => ar.id === a)?.candidateId === candidate.id);
  const baseArms = exp.armIds.filter((a) => corpus.arms.find((ar) => ar.id === a)?.kind === 'baseline');
  const aId = baseArms[0] ?? exp.armIds[0];
  const bId = candArms[0];
  const trials = corpus.trials.filter((t) => t.experimentId === exp.id);
  const report = useMemo(() => (aId && bId ? compareArms(corpus, aId, bId) : null), [corpus, aId, bId]);
  const qualification = aId && bId ? outcomeQualification(corpus, trials, aId, bId) : null;
  const label = (id: string) => corpus.arms.find((a) => a.id === id)?.label ?? id;

  return (
    <div className="rounded-panel border border-line bg-surface-1 p-3.5 shadow-inset">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onOpenExperiment(exp.id)} className="text-left text-sm font-medium text-fg-1 underline decoration-line-strong underline-offset-2 hover:decoration-fg-2">{exp.label}</button>
        <span className="font-mono text-2xs text-fg-3">{exp.id} · {exp.status}</span>
      </div>
      {aId && bId ? (
        <>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {[aId, bId].map((id) => {
              const cell = cellStats(trials, id);
              const rate = 'unavailable' in cell.passRate ? null : cell.passRate;
              return (
                <div key={id}>
                  <div className="mb-1.5 text-xs text-fg-2">{label(id)} <span className="font-mono text-2xs text-fg-3">{id === aId ? 'baseline' : 'candidate'}</span></div>
                  <IntervalBar passes={cell.passes} denominator={cell.passDenominator} interval={rate} emptyReason={'unavailable' in cell.passRate ? cell.passRate.reason : undefined} />
                </div>
              );
            })}
          </div>
          {report && (
            <div className="mt-3 space-y-2">
              <Callout tone={report.verdict === 'comparable' ? 'neutral' : report.verdict === 'confounded' ? 'fault' : 'attn'} title={`coordinates: ${report.verdict.replace(/-/g, ' ')}`}>{report.summary}</Callout>
              {qualification && <Callout tone="attn" title="No outcome to compare">{qualification}</Callout>}
            </div>
          )}
        </>
      ) : (
        <p className="mt-2 text-xs text-fg-3">The candidate arm is not yet defined in this experiment.</p>
      )}
    </div>
  );
}

function CandidateDiff({ corpus, base }: { corpus: EvolveCorpus; base: Candidate }) {
  const others = corpus.candidates.filter((c) => c.id !== base.id);
  const [otherId, setOtherId] = useState(others[0]?.id ?? '');
  const other = others.find((c) => c.id === otherId) ?? others[0];
  if (!other) return <p className="text-xs text-fg-3">There is no other candidate to compare with.</p>;
  const diff = diffCandidates(corpus, base.id, other.id);
  return (
    <div className="space-y-3">
      <SelectField label="Compare with" value={other.id} onChange={setOtherId}>{others.map((c) => <option key={c.id} value={c.id}>{c.id} — {c.label}</option>)}</SelectField>
      <div className="overflow-hidden rounded-panel border border-line">
        <table className="w-full text-left text-xs">
          <thead><tr className="eyebrow border-b border-line bg-surface-2"><th className="px-3 py-2 font-medium">field</th><th className="px-2 py-2 font-medium">{base.id}</th><th className="px-2 py-2 font-medium">{other.id}</th><th className="px-3 py-2 font-medium"><span className="sr-only">differs</span></th></tr></thead>
          <tbody>
            {diff.axes.map((a) => (
              <tr key={a.name} className="border-b border-line-subtle align-top last:border-b-0">
                <td className="px-3 py-1.5 font-mono text-2xs text-fg-3">{a.name}</td>
                <td className={`max-w-0 break-words px-2 py-1.5 font-mono text-2xs ${a.same ? 'text-fg-3' : 'text-fg-1'}`}>{a.a}</td>
                <td className={`max-w-0 break-words px-2 py-1.5 font-mono text-2xs ${a.same ? 'text-fg-3' : 'text-fg-1'}`}>{a.b}</td>
                <td className="whitespace-nowrap px-3 py-1.5 font-mono text-2xs text-attn">{a.same ? '' : '≠'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-2xs leading-relaxed text-fg-3">{diff.summary}</p>
    </div>
  );
}
