import { useMemo, useRef } from 'react';
import { Check, TriangleAlert } from 'lucide-react';
import type { StudioState, EvolveView } from '../../state/studio';
import { evolveCorpus, EVOLVE_NOTE } from '../../data/evolve';
import { validateCorpus } from '../../analysis/evolve';
import { LineageExplorer, type ExplorerSceneEntry } from '@/scenes/LineageExplorer';
import { buildLineageScene } from '@/scenes/lineageBuilder';
import { makeSyntheticScene } from '@/scenes/renderers/synthetic';
import { Tabs } from '../../ui/controls';
import { InspectorColumn } from '../InspectorColumn';
import { LineageInspector } from './LineageInspector';
import { ExperimentsSection } from './ExperimentsSection';
import { CandidatesSection } from './CandidatesSection';
import { CheckpointsSection } from './CheckpointsSection';

type Section = 'lineage' | 'experiments' | 'candidates' | 'checkpoints';

const sectionOf = (v: EvolveView): Section =>
  v.kind === 'corpus' || v.kind === 'execution' ? 'lineage'
  : v.kind === 'experiment' ? 'experiments'
  : v.kind === 'candidate' ? 'candidates'
  : 'checkpoints';

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

/**
 * The Counterfactual Laboratory: one lab, four sections, one record inspector each. The lineage graph stays mounted (and keeps
 * its camera and its renderer) while you select within it; selecting a node shows its record beside the graph instead of
 * replacing the canvas. Everything shown is derived from typed records in the synthetic corpus.
 */
export function EvolveWorkspace({ studio }: { studio: StudioState }) {
  const corpus = evolveCorpus;
  const view = studio.evolveView;
  const section = sectionOf(view);
  const sessionLabels = useMemo(() => new Map(studio.sessions.map((s) => [s.id, s.label])), [studio.sessions]);
  const validation = useMemo(() => validateCorpus(corpus, new Set(studio.sessions.map((s) => s.id))), [corpus, studio.sessions]);
  const lineageNodes = useMemo(() => new Map((buildLineageScene(corpus).scene?.nodes ?? []).map((n) => [n.id, n])), [corpus]);

  // The last record viewed in each section, so switching tabs and coming back returns you to where you were.
  const last = useRef<{ execution: string | null; experiment: string; candidate: string; checkpoint: string }>({
    execution: null, experiment: corpus.experiments[0]?.id ?? '', candidate: corpus.candidates[0]?.id ?? '', checkpoint: corpus.checkpoints[0]?.id ?? '',
  });
  if (view.kind === 'execution') last.current.execution = view.executionId;
  if (view.kind === 'experiment') last.current.experiment = view.experimentId;
  if (view.kind === 'candidate') last.current.candidate = view.candidateId;
  if (view.kind === 'checkpoint') last.current.checkpoint = view.checkpointId;

  const openExecution = (id: string) => studio.setEvolveView({ kind: 'execution', executionId: id });
  const openCheckpoint = (id: string) => studio.setEvolveView({ kind: 'checkpoint', checkpointId: id });
  const openExperiment = (id: string) => studio.setEvolveView({ kind: 'experiment', experimentId: id });
  const openCandidate = (id: string) => studio.setEvolveView({ kind: 'candidate', candidateId: id });
  const openSessionInObserve = (sid: string) => {
    const session = studio.sessions.find((s) => s.id === sid);
    if (session && session.events.length > 0) studio.inspectEventOf(session.events[0].id);
  };

  const goSection = (s: Section) => {
    if (s === 'lineage') studio.setEvolveView(last.current.execution ? { kind: 'execution', executionId: last.current.execution } : { kind: 'corpus' });
    else if (s === 'experiments') openExperiment(last.current.experiment);
    else if (s === 'candidates') openCandidate(last.current.candidate);
    else openCheckpoint(last.current.checkpoint);
  };

  const selectedExecId = view.kind === 'execution' ? view.executionId : null;
  const clean = validation.errors.length === 0 && validation.warnings.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Lab bar */}
      <div className="flex min-h-[56px] shrink-0 flex-wrap items-end gap-x-8 gap-y-1 border-b border-line bg-surface-1 px-4">
        <div className="flex items-center gap-3 self-center py-2">
          <div className="leading-tight">
            <h1 className="font-serif text-lg text-fg-1">Counterfactual Laboratory</h1>
            <div className="font-mono text-2xs text-fg-3 tnum">{corpus.executions.length} executions · {corpus.edges.length} typed relations · {corpus.experiments.length} experiments · {corpus.trials.length} trials</div>
          </div>
        </div>
        <Tabs<Section>
          label="Laboratory sections"
          idPrefix="lab"
          value={section}
          onChange={goSection}
          tabs={[
            { value: 'lineage', label: 'Lineage', count: corpus.executions.length },
            { value: 'experiments', label: 'Experiments', count: corpus.experiments.length },
            { value: 'candidates', label: 'Candidates', count: corpus.candidates.length },
            { value: 'checkpoints', label: 'Checkpoints', count: corpus.checkpoints.length },
          ]}
        />
        <div className="ml-auto flex items-center gap-3 self-center py-2">
          <span
            className={`inline-flex h-6 items-center gap-1.5 rounded-tag border px-2 font-mono text-2xs ${clean ? 'border-line text-fg-3' : 'border-attn/50 bg-attn/10 text-attn'}`}
            title={clean ? 'Every referential check on the corpus passes.' : `${validation.errors.length} error(s), ${validation.warnings.length} warning(s) in the corpus.`}
          >
            {clean ? <Check className="h-3 w-3" aria-hidden /> : <TriangleAlert className="h-3 w-3" aria-hidden />}
            {clean ? 'corpus checks pass' : `${validation.errors.length} errors · ${validation.warnings.length} warnings`}
          </span>
          <span className="hatch inline-flex h-6 items-center rounded-tag border border-line-strong bg-surface-1 px-2 font-mono text-2xs font-semibold tracking-[0.14em] text-fg-1">SYNTHETIC PROGRAMME</span>
        </div>
      </div>

      <div id="lab-panel" role="tabpanel" aria-labelledby={`lab-tab-${section}`} className="min-h-0 flex-1">
        {section === 'lineage' && (
          <div className="flex h-full min-h-0">
            <div className="min-w-0 flex-1">
              <LineageExplorer
                scenes={explorerScenes}
                initialSelection={selectedExecId}
                selectedId={selectedExecId}
                onSelectNode={(id) => (id ? openExecution(id) : studio.setEvolveView({ kind: 'corpus' }))}
                onOpenNode={(id) => {
                  const sid = corpus.executions.find((e) => e.id === id)?.sessionId;
                  if (sid) openSessionInObserve(sid);
                }}
              />
            </div>
            <InspectorColumn label="Evolve record inspector" open={selectedExecId !== null} onClose={() => studio.setEvolveView({ kind: 'corpus' })}>
              <LineageInspector
                corpus={corpus}
                selectedId={selectedExecId}
                node={selectedExecId ? lineageNodes.get(selectedExecId) : undefined}
                validation={validation}
                note={EVOLVE_NOTE}
                sessionLabels={sessionLabels}
                onSelectExecution={openExecution}
                onClear={() => studio.setEvolveView({ kind: 'corpus' })}
                onOpenSession={openSessionInObserve}
                onOpenCheckpoint={openCheckpoint}
                onOpenExperiment={openExperiment}
              />
            </InspectorColumn>
          </div>
        )}
        {section === 'experiments' && (
          <ExperimentsSection
            corpus={corpus}
            experimentId={view.kind === 'experiment' ? view.experimentId : last.current.experiment}
            onSelect={openExperiment}
            onOpenExecution={openExecution}
            onOpenSession={openSessionInObserve}
          />
        )}
        {section === 'candidates' && (
          <CandidatesSection
            corpus={corpus}
            candidateId={view.kind === 'candidate' ? view.candidateId : last.current.candidate}
            onSelect={openCandidate}
            onOpenExecution={openExecution}
            onOpenExperiment={openExperiment}
          />
        )}
        {section === 'checkpoints' && (
          <CheckpointsSection
            corpus={corpus}
            checkpointId={view.kind === 'checkpoint' ? view.checkpointId : last.current.checkpoint}
            onSelect={openCheckpoint}
            onOpenExecution={openExecution}
            onOpenExperiment={openExperiment}
          />
        )}
      </div>
    </div>
  );
}
