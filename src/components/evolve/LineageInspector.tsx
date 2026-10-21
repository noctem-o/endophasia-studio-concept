import { ArrowRight, ExternalLink, X } from 'lucide-react';
import type { EvolveCorpus, Execution, LineageRelation } from '../../domain/evolve';
import { continuationMeta, COORDINATE_SPECS } from '../../domain/evolve';
import type { EvidenceKind } from '../../domain/types';
import type { SceneNode } from '../../scenes/types';
import { CLASSIFICATION_TAG } from '../../scenes/renderers/palette';
import type { LineageValidation } from '../../analysis/evolve';
import { Button, IconButton } from '../../ui/controls';
import { Badge, Callout, Def, DefList, NotRecorded, Section } from '../../ui/layout';
import { ProvTag } from '../../ui/marks';
import { CheckMark, ContinuationTag, OutcomeText, RelationLine } from './shared';
import { continuationKindOf, RELATION_META } from './evolveMeta';

const PROV_KIND: Record<SceneNode['provenance'], EvidenceKind> = { observed: 'OBS', reported: 'REP', derived: 'DER', 'not-applicable': 'NA' };

export interface LineageInspectorProps {
  corpus: EvolveCorpus;
  selectedId: string | null;
  node: SceneNode | undefined;
  validation: LineageValidation;
  note: string;
  sessionLabels: Map<string, string>;
  onSelectExecution: (id: string) => void;
  onClear: () => void;
  onOpenSession: (sessionId: string) => void;
  onOpenCheckpoint: (id: string) => void;
  onOpenExperiment: (id: string) => void;
}

export function LineageInspector(p: LineageInspectorProps) {
  const exec = p.selectedId ? p.corpus.executions.find((e) => e.id === p.selectedId) : undefined;
  if (!p.selectedId) return <LineageBrief {...p} />;
  if (!exec) {
    return (
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-2"><span className="eyebrow">Selection</span><IconButton label="Clear selection" onClick={p.onClear} className="ml-auto"><X className="h-3.5 w-3.5" aria-hidden /></IconButton></div>
        <Callout tone="neutral" title="Synthetic fixture node">
          <span className="font-mono">{p.selectedId}</span> belongs to a stress-test scene. It has no execution record, trials or coordinates: it exists only to exercise the renderer.
        </Callout>
      </div>
    );
  }
  return <ExecutionInspector {...p} exec={exec} />;
}

function ExecutionInspector({ corpus, exec, node, sessionLabels, onSelectExecution, onClear, onOpenSession, onOpenCheckpoint, onOpenExperiment }: LineageInspectorProps & { exec: Execution }) {
  const kind = continuationKindOf(corpus, exec);
  const checkpoints = corpus.checkpoints.filter((c) => c.executionId === exec.id);
  const outgoing = corpus.edges.filter((e) => e.from === exec.id);
  const incoming = corpus.edges.filter((e) => e.to === exec.id);
  const trials = corpus.trials.filter((t) => t.executionId === exec.id);
  const labelOf = (id: string) => corpus.executions.find((x) => x.id === id)?.label ?? id;

  const specs = COORDINATE_SPECS.map((spec) => ({ spec, v: exec.coordinates[spec.kind] }));
  const recorded = specs.filter((x) => x.v?.status === 'recorded').length;
  const unavailable = specs.filter((x) => x.v?.status === 'unavailable').length;
  const undeclared = specs.length - recorded - unavailable;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-4">
        <span className="eyebrow">Execution</span>
        <span className="font-mono text-2xs text-fg-3">{exec.id}</span>
        <IconButton label="Clear selection" onClick={onClear} className="ml-auto"><X className="h-3.5 w-3.5" aria-hidden /></IconButton>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto scrollbar-thin px-4 py-4">
        <header>
          <div className="flex flex-wrap items-center gap-2">
            {node && <span className="font-mono text-2xs font-semibold tracking-wider" style={{ color: CLASSIFICATION_TAG[node.classification].color }}>{CLASSIFICATION_TAG[node.classification].label}</span>}
            {node && <ProvTag kind={PROV_KIND[node.provenance]} title={`Provenance of this record: ${node.provenanceReason}`} />}
            <Badge>{exec.role}</Badge>
          </div>
          <h2 className="mt-2 text-lg font-medium leading-snug text-fg-1">{exec.label}</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-fg-2">{exec.outcome}</p>
          {node && <p className="mt-2 text-2xs leading-relaxed text-fg-3">{node.provenanceReason}</p>}
        </header>

        {kind && (
          kind === 'simulated' ? (
            <div className="hatch-der rounded-ctl border border-der/50 bg-surface-1 p-3">
              <div className="flex items-center gap-2"><ContinuationTag kind={kind} /><span className="font-mono text-2xs text-der">never an execution result</span></div>
              <p className="mt-2 text-xs leading-relaxed text-fg-1">{continuationMeta[kind].desc} It carries no usage and is excluded from every aggregate.</p>
            </div>
          ) : (
            <div className="rounded-ctl border border-line bg-surface-2 p-3">
              <div className="flex items-center gap-2"><span className="eyebrow">Continuation</span><ContinuationTag kind={kind} /></div>
              <p className="mt-2 text-xs leading-relaxed text-fg-2">{continuationMeta[kind].desc}</p>
            </div>
          )
        )}

        <Section title="Trajectory">
          {exec.sessionId ? (
            <div className="space-y-1.5">
              <Button onClick={() => onOpenSession(exec.sessionId!)} leading={<ExternalLink className="h-3 w-3" aria-hidden />}>
                open {exec.sessionId} in Observe →
              </Button>
              {sessionLabels.get(exec.sessionId) && <p className="text-xs text-fg-3">{sessionLabels.get(exec.sessionId)}</p>}
            </div>
          ) : (
            <div className="space-y-1.5">
              <NotRecorded what="trajectory" reason="no session in the observation registry" />
              <p className="text-2xs leading-relaxed text-fg-3">Verdicts for this execution come from its trial records only; there is no event log to open.</p>
            </div>
          )}
        </Section>

        <Section title="Record">
          <DefList>
            <Def k="started">{exec.startedAt}</Def>
            <Def k="duration">{(exec.durationMs / 1000).toFixed(1)} s</Def>
            <Def k="note" mono={false}>{exec.note}</Def>
          </DefList>
        </Section>

        <Section title="Relations" note="typed, recorded">
          {outgoing.length + incoming.length === 0 ? (
            <p className="font-mono text-2xs text-fg-3">no lineage edges</p>
          ) : (
            <ul className="space-y-1">
              {outgoing.map((e) => <RelationRow key={e.id} relation={e.relation} dir="out" other={e.to} label={labelOf(e.to)} note={e.note} onSelect={onSelectExecution} />)}
              {incoming.map((e) => <RelationRow key={e.id} relation={e.relation} dir="in" other={e.from} label={labelOf(e.from)} note={e.note} onSelect={onSelectExecution} />)}
            </ul>
          )}
        </Section>

        {checkpoints.length > 0 && (
          <Section title="Checkpoints" note={`${checkpoints.length}`}>
            <ul className="space-y-1">
              {checkpoints.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => onOpenCheckpoint(c.id)} className="flex w-full items-center gap-2 rounded-ctl border border-line bg-surface-2 px-2.5 py-1.5 text-left transition-colors duration-100 hover:border-line-strong hover:bg-surface-3">
                    <span className="font-mono text-2xs text-fg-1">{c.id}</span>
                    <span className="min-w-0 flex-1 truncate text-xs text-fg-2">{c.label}</span>
                    <ArrowRight className="h-3 w-3 shrink-0 text-fg-3" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Trials on record" note={`${trials.length}`}>
          {trials.length === 0 ? (
            <p className="font-mono text-2xs text-fg-3">no trial record references this execution</p>
          ) : (
            <ul className="space-y-1">
              {trials.map((t) => (
                <li key={t.id} className="rounded-ctl border border-line bg-surface-2 px-2.5 py-2">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="font-mono text-2xs text-fg-1">{t.id}</span>
                    <span className="font-mono text-2xs text-fg-3">{t.taskId}</span>
                    <OutcomeText outcome={t.outcome} />
                    <CheckMark status={t.check.status} reason={t.check.reason} label="check" />
                    <CheckMark status={t.evaluator.status} reason={t.evaluator.reason} label="evaluator" />
                    <button type="button" onClick={() => onOpenExperiment(t.experimentId)} className="ml-auto font-mono text-2xs text-fg-2 underline decoration-line-strong underline-offset-2 hover:text-fg-1">{t.experimentId}</button>
                  </div>
                  {t.note && <p className="mt-1 text-2xs leading-relaxed text-fg-3">{t.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Declared coordinates" note={`${recorded} recorded · ${unavailable} unavailable${undeclared ? ` · ${undeclared} undeclared` : ''}`} collapsible defaultOpen={false}>
          <p className="mb-2 text-2xs leading-relaxed text-fg-3">Each coordinate is recorded or explicitly unavailable. A missing one is never treated as a default or as zero.</p>
          <dl className="space-y-1">
            {specs.map(({ spec, v }) => (
              <div key={spec.kind} className="grid grid-cols-[132px_minmax(0,1fr)] items-baseline gap-2 border-b border-line-subtle pb-1">
                <dt className="font-mono text-2xs text-fg-3" title={spec.why}>{spec.label}</dt>
                <dd className="min-w-0 break-words text-2xs">
                  {v ? (
                    v.status === 'recorded' ? <span className="font-mono text-fg-1">{v.value}</span> : <NotRecorded reason={v.reason} />
                  ) : <span className="font-mono text-fg-3">not declared</span>}
                </dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>
    </div>
  );
}

function RelationRow({ relation, dir, other, label, note, onSelect }: { relation: LineageRelation; dir: 'in' | 'out'; other: string; label: string; note?: string; onSelect: (id: string) => void }) {
  const m = RELATION_META[relation];
  return (
    <li>
      <button type="button" onClick={() => onSelect(other)} title={m.hint} className="block w-full rounded-ctl border border-line bg-surface-2 px-2.5 py-1.5 text-left transition-colors duration-100 hover:border-line-strong hover:bg-surface-3">
        <div className="flex items-center gap-2">
          <RelationLine relation={relation} />
          <span className="font-mono text-2xs font-medium text-fg-1">{m.label}</span>
          <span className="font-mono text-2xs text-fg-3">{dir === 'out' ? '→ parent' : '← child'}</span>
        </div>
        <div className="mt-0.5 truncate text-xs text-fg-2">{label} <span className="font-mono text-2xs text-fg-3">{other}</span></div>
        {note && <p className="mt-0.5 text-2xs leading-snug text-fg-3">{note}</p>}
      </button>
    </li>
  );
}

/** What the inspector says before anything is selected: what this graph is, and what the four kinds of run are. */
function LineageBrief({ corpus, validation, note }: LineageInspectorProps) {
  const clean = validation.errors.length === 0 && validation.warnings.length === 0;
  return (
    <div className="h-full min-h-0 space-y-4 overflow-y-auto scrollbar-thin px-4 py-4">
      <header>
        <div className="eyebrow">Lineage</div>
        <h2 className="mt-1 font-serif text-xl leading-snug text-fg-1">Where each run came from</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-fg-3">{corpus.executions.length} executions joined by {corpus.edges.length} typed relations. An edge exists only where a record says so; position is layout, never a result.</p>
      </header>

      <Callout title="Synthetic programme">{note}</Callout>

      <Section title="Four things that are not the same">
        <ul className="space-y-2">
          <KindRow tag={<ContinuationTag kind="recorded" />} body="A recorded run: new model traffic, its own trajectory, real usage." />
          <KindRow tag={<ContinuationTag kind="replayed" />} body={continuationMeta.replayed.desc} />
          <KindRow tag={<span className="inline-flex h-5 items-center rounded-tag border border-line-strong px-1.5 font-mono text-2xs font-semibold tracking-wider text-fg-1">TRIAL</span>} body="A recorded run under an experiment arm, judged by a check and an evaluator, either of which may be unavailable." />
          <KindRow tag={<ContinuationTag kind="simulated" />} body={continuationMeta.simulated.desc} />
        </ul>
      </Section>

      <Section title="Corpus checks">
        {clean ? (
          <p className="font-mono text-2xs text-fg-2">all referential checks pass</p>
        ) : (
          <div className="space-y-1">
            {validation.errors.map((e, i) => <p key={`e${i}`} className="font-mono text-2xs text-fault">{e}</p>)}
            {validation.warnings.map((w, i) => <p key={`w${i}`} className="font-mono text-2xs text-attn">{w}</p>)}
          </div>
        )}
      </Section>

      <p className="rounded-ctl border border-dashed border-line-strong px-3 py-2.5 text-xs leading-relaxed text-fg-3">
        Select an execution to see its record, its relations and its trials. Selecting stays in the graph.
      </p>
    </div>
  );
}

function KindRow({ tag, body }: { tag: React.ReactNode; body: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 w-[112px] shrink-0">{tag}</span>
      <p className="min-w-0 text-xs leading-relaxed text-fg-3">{body}</p>
    </li>
  );
}
