import { useMemo, useState } from 'react';
import { GitBranch, FlaskConical, CircleDot } from 'lucide-react';
import type { EvolveCorpus } from '../../domain/evolve';
import type { StudioState } from '../../state/studio';
import { evolveCorpus, EVOLVE_NOTE } from '../../data/evolve';
import { validateCorpus, cellStats } from '../../analysis/evolve';
import { SectionLabel } from '../primitives';
import { candidateStatusMeta, continuationMeta } from '../../domain/evolve';
import type { CandidateStatus } from '../../domain/evolve';
import { LineageExplorer, type ExplorerSceneEntry } from '@/scenes/LineageExplorer';
import { buildLineageScene } from '@/scenes/lineageBuilder';
import { makeSyntheticScene } from '@/scenes/renderers/synthetic';
import { ExecutionDetail } from './ExecutionDetail';
import { CheckpointPanel } from './CheckpointPanel';
import { ExperimentView } from './ExperimentView';
import { CandidateView } from './CandidateView';
import { RELATION_META } from './shared';

export function EvolveWorkspace({ studio }: { studio: StudioState }) {
  const corpus = evolveCorpus;
  const view = studio.evolveView;
  // Remembered so returning to the lineage overview keeps the graph selection.
  const [lastExecId, setLastExecId] = useState<string | null>(null);
  if (view.kind === 'execution' && view.executionId !== lastExecId) setLastExecId(view.executionId);
  const sessionLabels = useMemo(() => new Map(studio.sessions.map((s) => [s.id, s.label])), [studio.sessions]);
  const validation = useMemo(() => validateCorpus(corpus, new Set(studio.sessions.map((s) => s.id))), [corpus, studio.sessions]);

  const openExecution = (id: string) => studio.setEvolveView({ kind: 'execution', executionId: id });
  const openCheckpoint = (id: string) => studio.setEvolveView({ kind: 'checkpoint', checkpointId: id });
  const openExperiment = (id: string) => studio.setEvolveView({ kind: 'experiment', experimentId: id });
  const openCandidate = (id: string) => studio.setEvolveView({ kind: 'candidate', candidateId: id });
  const openSessionInObserve = (sid: string) => {
    const session = studio.sessions.find((s) => s.id === sid);
    if (session && session.events.length > 0) studio.inspectEventOf(session.events[0].id);
  };

  const selectedExec = view.kind === 'execution' ? corpus.executions.find((e) => e.id === view.executionId) : undefined;
  const selectedCp = view.kind === 'checkpoint' ? corpus.checkpoints.find((c) => c.id === view.checkpointId) : undefined;
  const selectedExp = view.kind === 'experiment' ? corpus.experiments.find((x) => x.id === view.experimentId) : undefined;
  const selectedCand = view.kind === 'candidate' ? corpus.candidates.find((c) => c.id === view.candidateId) : undefined;

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        {view.kind === 'corpus' && (
          <CorpusOverview
            selectedExecId={lastExecId}
            onSelect={(id) => openExecution(id)}
            validation={validation}
          />
        )}
        {view.kind !== 'corpus' && (
          <DetailCanvas
            kind={view.kind}
            label={
              selectedExec?.label ?? selectedCp?.label ?? selectedExp?.label ?? selectedCand?.label ?? 'record not found'
            }
            onBack={() => studio.setEvolveView({ kind: 'corpus' })}
          >
            {selectedExec && (
              <ExecutionDetail
                corpus={corpus} exec={selectedExec}
                onOpenSession={openSessionInObserve}
                onSelectCheckpoint={openCheckpoint}
              />
            )}
            {selectedCp && (
              <CheckpointPanel
                corpus={corpus} cp={selectedCp}
                onOpenExecution={openExecution}
                onOpenExperiment={openExperiment}
              />
            )}
            {selectedExp && (
              <ExperimentView
                corpus={corpus} exp={selectedExp}
                onOpenExecution={openExecution}
                onOpenTrial={(tid) => {
                  const t = corpus.trials.find((x) => x.id === tid);
                  if (t) studio.setEvolveView({ kind: 'execution', executionId: t.executionId });
                }}
              />
            )}
            {selectedCand && (
              <CandidateView
                corpus={corpus} cand={selectedCand}
                onOpenExecution={openExecution}
                onOpenExperiment={openExperiment}
                onOpenCandidate={openCandidate}
              />
            )}
          </DetailCanvas>
        )}
      </div>

      <aside aria-label="Evolve record inspector" className="hidden w-[420px] shrink-0 overflow-y-auto border-l border-ink-700/70 bg-ink-900 lg:block">
        {view.kind === 'execution' && selectedExec && (
          <TrialListPanel
            corpus={corpus}
            execId={selectedExec.id}
            onOpenExecution={openExecution}
            onOpenSession={openSessionInObserve}
            sessionLabel={selectedExec.sessionId ? sessionLabels.get(selectedExec.sessionId) : undefined}
          />
        )}
        {view.kind === 'experiment' && selectedExp && (
          <ExperimentSidePanel corpus={corpus} experimentId={selectedExp.id} onOpenExecution={openExecution} />
        )}
        {view.kind === 'corpus' && (
          <CorpusSidePanel corpus={corpus} validation={validation} />
        )}
        {view.kind === 'checkpoint' && selectedCp && (
          <CheckpointSidePanel corpus={corpus} cpId={selectedCp.id} onOpenExecution={openExecution} />
        )}
        {view.kind === 'candidate' && selectedCand && (
          <CandidateSidePanel corpus={corpus} candId={selectedCand.id} onOpenCandidate={openCandidate} />
        )}
      </aside>
    </div>
  );
}

function CorpusOverview({ selectedExecId, onSelect, validation }: {
  selectedExecId: string | null;
  onSelect: (id: string) => void;
  validation: ReturnType<typeof validateCorpus>;
}) {
  const corpus = evolveCorpus;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-2 border-b border-ink-700/70 bg-ink-900/60 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-teal-accent" aria-hidden />
            <h1 className="text-sm font-semibold text-ink-50">Counterfactual Laboratory</h1>
          </div>
          <span className="font-mono text-2xs text-ink-400">
            {corpus.executions.length} executions · {corpus.edges.length} typed relations · {corpus.experiments.length} experiments · {corpus.trials.length} trials
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-[3px] border border-amber-accent/40 bg-amber-accent/8 px-2 py-1 font-mono text-2xs font-semibold tracking-widest text-amber-accent">
            <FlaskConical className="h-3 w-3" aria-hidden />
            SYNTHETIC PROGRAMME
          </span>
        </div>
        <p className="max-w-3xl text-2xs leading-relaxed text-ink-400">{EVOLVE_NOTE}</p>
        {validation.errors.length === 0 && validation.warnings.length === 0 ? (
          <p className="font-mono text-2xs text-teal-accent/80">corpus validation: all referential checks pass</p>
        ) : (
          <p className="font-mono text-2xs text-amber-accent">
            corpus validation: {validation.errors.length} error(s), {validation.warnings.length} warning(s)
          </p>
        )}
      </div>
      <div className="min-h-0 flex-1">
        <LineageExplorer
          scenes={explorerScenes}
          initialSelection={selectedExecId}
          onOpenNode={onSelect}
        />
      </div>
    </div>
  );
}

/** Scenes for the explorer: the corpus lineage plus synthetic stress fixtures. */
const explorerScenes: ExplorerSceneEntry[] = (() => {
  const built = buildLineageScene(evolveCorpus);
  const entries: ExplorerSceneEntry[] = [];
  if (built.scene) {
    entries.push({ id: built.scene.sceneId, label: 'recorded lineage (synthetic programme)', scene: built.scene, synthetic: false });
  }
  for (const n of [100, 1000, 10000]) {
    const s = makeSyntheticScene({ nodeCount: n, seed: n });
    entries.push({ id: s.scene.sceneId, label: `${n} nodes`, scene: s.scene, synthetic: true });
  }
  return entries;
})();

function DetailCanvas({ kind, label, onBack, children }: {
  kind: string;
  label: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-ink-700/70 bg-ink-900/60 px-4 py-2">
        <button
          onClick={onBack}
          className="rounded-[4px] border border-ink-600/70 bg-ink-850 px-2.5 py-1 font-mono text-2xs uppercase tracking-widest text-ink-300 transition-colors hover:border-teal-accent/40 hover:text-ink-100"
        >
          ← lineage
        </button>
        <span className="font-mono text-2xs uppercase tracking-widest text-ink-400">{kind}</span>
        <span className="truncate text-xs text-ink-100">{label}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

// ─── Side panels ─────────────────────────────────────────────────────────────

function TrialListPanel({ corpus, execId, onOpenExecution, onOpenSession, sessionLabel }: {
  corpus: EvolveCorpus;
  execId: string;
  onOpenExecution: (id: string) => void;
  onOpenSession: (sid: string) => void;
  sessionLabel?: string;
}) {
  const trials = corpus.trials.filter((t) => t.executionId === execId);
  const exec = corpus.executions.find((e) => e.id === execId)!;
  return (
    <div className="space-y-3 p-4">
      <SectionLabel>execution</SectionLabel>
      <dl className="space-y-1.5">
        <Body k="id" v={exec.id} />
        <Body k="role" v={exec.role} />
        <Body k="outcome" v={exec.outcome} />
        {typeof exec.sessionId === 'string' && (
          <div className="grid grid-cols-[118px_1fr] items-baseline gap-3">
            <dt className="font-mono text-2xs text-ink-400">trajectory</dt>
            <dd>
              <button onClick={() => onOpenSession(exec.sessionId as string)} className="rounded-[3px] border border-teal-accent/40 bg-teal-accent/8 px-1.5 py-0.5 font-mono text-2xs text-teal-accent transition-colors hover:bg-teal-accent/15">
                open {exec.sessionId} in Observe →
              </button>
              {sessionLabel && <div className="mt-1 text-2xs text-ink-400">{sessionLabel}</div>}
            </dd>
          </div>
        )}
      </dl>

      <SectionLabel>trials referencing this execution</SectionLabel>
      {trials.length === 0 ? (
        <p className="text-2xs text-ink-500">no trial records reference this execution</p>
      ) : (
        <div className="space-y-1.5">
          {trials.map((t) => (
            <div key={t.id} className="rounded-[4px] border border-ink-700/50 bg-ink-850 p-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-2xs text-ink-100">{t.id}</span>
                <span className="font-mono text-2xs text-ink-400">{t.taskId}</span>
              </div>
              <div className="mt-1"><OutcomeChipInline t={t} /></div>
              {t.note && <p className="mt-1 text-2xs leading-relaxed text-ink-400">{t.note}</p>}
            </div>
          ))}
        </div>
      )}

      <SectionLabel>related executions</SectionLabel>
      <div className="space-y-1">
        {corpus.edges.filter((e) => e.from === execId || e.to === execId).map((e) => {
          const other = e.from === execId ? e.to : e.from;
          return (
            <button key={e.id} onClick={() => onOpenExecution(other)} className="w-full rounded-[4px] border border-ink-700/40 bg-ink-900 p-2 text-left transition-colors hover:border-teal-accent/30">
              <div className="font-mono text-2xs text-ink-200">
                <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${RELATION_META[e.relation].dot}`} aria-hidden />
                {RELATION_META[e.relation].label} · {other}
              </div>
            </button>
          );
        })}
        {corpus.edges.filter((e) => e.from === execId || e.to === execId).length === 0 && (
          <p className="text-2xs text-ink-500">no lineage edges</p>
        )}
      </div>
    </div>
  );
}

function OutcomeChipInline({ t }: { t: { id: string; outcome: string; check: { status: string }; evaluator: { status: string } } }) {
  return (
    <div className="flex flex-wrap gap-2 font-mono text-2xs">
      <span className={t.outcome === 'completed' ? 'text-teal-accent' : t.outcome === 'failed' ? 'text-red-accent' : 'text-amber-accent'}>{t.outcome}</span>
      <span className="text-ink-400">check {t.check.status}</span>
      <span className="text-ink-400">evaluator {t.evaluator.status}</span>
    </div>
  );
}

function ExperimentSidePanel({ corpus, experimentId, onOpenExecution }: {
  corpus: EvolveCorpus;
  experimentId: string;
  onOpenExecution: (id: string) => void;
}) {
  const exp = corpus.experiments.find((x) => x.id === experimentId)!;
  const trials = corpus.trials.filter((t) => t.experimentId === experimentId);
  return (
    <div className="space-y-3 p-4">
      <SectionLabel>trials in this experiment</SectionLabel>
      <p className="font-mono text-2xs text-ink-400">{trials.length} trial records</p>
      <div className="space-y-1.5">
        {trials.map((t) => (
          <div key={t.id} className="rounded-[4px] border border-ink-700/50 bg-ink-850 p-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-2xs text-ink-100">{t.id}</span>
              <span className="font-mono text-2xs text-ink-400">{t.taskId}</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <OutcomeChipInline t={t} />
              <button onClick={() => onOpenExecution(t.executionId)} className="ml-auto font-mono text-2xs text-ink-400 hover:text-ink-100">
                {t.executionId} →
              </button>
            </div>
          </div>
        ))}
      </div>
      <SectionLabel>arms &amp; cells</SectionLabel>
      <div className="space-y-1.5">
        {exp.armIds.map((aid) => {
          const arm = corpus.arms.find((a) => a.id === aid)!;
          const cell = cellStats(corpus.trials, aid);
          return (
            <div key={aid} className="rounded-[4px] border border-ink-700/50 bg-ink-850 p-2">
              <div className="font-mono text-2xs text-ink-200">{arm.label}</div>
              <div className="mt-0.5 font-mono text-2xs text-ink-400">
                {cell.total} trials · {cell.passes}/{cell.passDenominator} checks passed
                {'interrupted' in cell && cell.interrupted > 0 && ` · ${cell.interrupted} interrupted`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CorpusSidePanel({ corpus, validation }: {
  corpus: EvolveCorpus;
  validation: ReturnType<typeof validateCorpus>;
}) {
  const [tab, setTab] = useState<'experiments' | 'candidates' | 'checkpoints'>('experiments');
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 border-b border-ink-700/70">
        {(['experiments', 'candidates', 'checkpoints'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`flex-1 border-b-2 px-2 py-2 font-mono text-2xs uppercase tracking-widest transition-colors ${
              tab === t ? 'border-teal-accent text-ink-50' : 'border-transparent text-ink-400 hover:text-ink-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === 'experiments' && (
          <div className="space-y-1.5">
            {corpus.experiments.map((x) => (
              <div key={x.id} className="rounded-[4px] border border-ink-700/50 bg-ink-850 p-2.5">
                <div className="flex items-center gap-2">
                  <CircleDot className={`h-3 w-3 ${x.status === 'complete' ? 'text-teal-accent' : x.status === 'degraded' ? 'text-amber-accent' : 'text-red-accent'}`} aria-hidden />
                  <span className="text-2xs font-medium text-ink-100">{x.label}</span>
                </div>
                <p className="mt-1 text-2xs leading-relaxed text-ink-400">{x.question}</p>
                <p className="mt-1 font-mono text-2xs text-ink-500">{x.status} · {x.armIds.length} arms</p>
              </div>
            ))}
          </div>
        )}
        {tab === 'candidates' && (
          <div className="space-y-1.5">
            {corpus.candidates.map((c) => {
              const m = candidateStatusMeta[c.status as CandidateStatus];
              return (
                <div key={c.id} className="rounded-[4px] border border-ink-700/50 bg-ink-850 p-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-[3px] border px-1 py-0.5 font-mono text-[9px] font-semibold tracking-widest ${m.text} ${m.border} ${m.bg}`}>{m.label}</span>
                    <span className="text-2xs font-medium text-ink-100">{c.label}</span>
                  </div>
                  <p className="mt-1 text-2xs leading-relaxed text-ink-400">{c.change.summary}</p>
                </div>
              );
            })}
          </div>
        )}
        {tab === 'checkpoints' && (
          <div className="space-y-1.5">
            {corpus.checkpoints.map((cp) => (
              <div key={cp.id} className="rounded-[4px] border border-ink-700/50 bg-ink-850 p-2.5">
                <div className="font-mono text-2xs text-ink-100">{cp.id}</div>
                <p className="mt-0.5 text-2xs text-ink-300">{cp.label}</p>
                <p className="mt-1 text-2xs leading-relaxed text-ink-400">{cp.note}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div className="shrink-0 border-t border-ink-700/70 p-3">
          <SectionLabel>corpus validation</SectionLabel>
          {validation.errors.map((e, i) => <p key={`e${i}`} className="mt-1 font-mono text-2xs text-red-accent">{e}</p>)}
          {validation.warnings.map((w, i) => <p key={`w${i}`} className="mt-1 font-mono text-2xs text-amber-accent">{w}</p>)}
        </div>
      )}
    </div>
  );
}

function CheckpointSidePanel({ corpus, cpId, onOpenExecution }: {
  corpus: EvolveCorpus;
  cpId: string;
  onOpenExecution: (id: string) => void;
}) {
  const branches = corpus.edges.filter((e) => e.note?.includes(cpId));
  return (
    <div className="space-y-3 p-4">
      <SectionLabel>recorded branches</SectionLabel>
      {branches.length === 0 ? (
        <p className="text-2xs text-ink-500">no continuation has been recorded from this checkpoint</p>
      ) : (
        <div className="space-y-1.5">
          {branches.map((e) => {
            const exec = corpus.executions.find((x) => x.id === e.from);
            return (
              <button key={e.id} onClick={() => exec && onOpenExecution(exec.id)} className="w-full rounded-[4px] border border-ink-700/50 bg-ink-850 p-2.5 text-left transition-colors hover:border-teal-accent/30">
                <div className="font-mono text-2xs text-ink-100">{e.from}</div>
                <div className="mt-0.5 font-mono text-2xs text-ink-400">
                  <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${RELATION_META[e.relation].dot}`} aria-hidden />
                  {RELATION_META[e.relation].label}
                </div>
                {exec && <p className="mt-1 text-2xs leading-relaxed text-ink-300">{exec.label}</p>}
              </button>
            );
          })}
        </div>
      )}
      <SectionLabel>continuation kinds</SectionLabel>
      <div className="space-y-1.5">
        {Object.entries(continuationMeta).map(([kind, m]) => (
          <div key={kind} className="rounded-[4px] border border-ink-700/40 bg-ink-900 p-2">
            <div className="font-mono text-2xs font-semibold tracking-widest text-ink-200">{m.label}</div>
            <p className="mt-0.5 text-2xs leading-relaxed text-ink-400">{m.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CandidateSidePanel({ corpus, candId, onOpenCandidate }: {
  corpus: EvolveCorpus;
  candId: string;
  onOpenCandidate: (id: string) => void;
}) {
  const cand = corpus.candidates.find((c) => c.id === candId)!;
  const others = corpus.candidates.filter((c) => c.id !== candId);
  return (
    <div className="space-y-3 p-4">
      <SectionLabel>compare against another candidate</SectionLabel>
      <div className="space-y-1.5">
        {others.map((o) => {
          const m = candidateStatusMeta[o.status];
          return (
            <button key={o.id} onClick={() => onOpenCandidate(o.id)} className="w-full rounded-[4px] border border-ink-700/50 bg-ink-850 p-2.5 text-left transition-colors hover:border-blue-accent/40">
              <div className="flex items-center gap-2">
                <span className={`rounded-[3px] border px-1 py-0.5 font-mono text-[9px] font-semibold tracking-widest ${m.text} ${m.border} ${m.bg}`}>{m.label}</span>
                <span className="text-2xs font-medium text-ink-100">{o.label}</span>
              </div>
              <p className="mt-1 font-mono text-2xs text-ink-400">open record →</p>
            </button>
          );
        })}
      </div>
      <p className="text-2xs leading-relaxed text-ink-400">
        The candidate record for <span className="font-mono">{cand.id}</span> is shown on the left. Select another candidate to
        open its record; differences in target, artifact, status and evaluation are visible side by side.
      </p>
    </div>
  );
}

function Body({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[118px_1fr] items-baseline gap-3">
      <dt className="font-mono text-2xs text-ink-400">{k}</dt>
      <dd className="min-w-0 break-words font-mono text-2xs text-ink-100">{v}</dd>
    </div>
  );
}
