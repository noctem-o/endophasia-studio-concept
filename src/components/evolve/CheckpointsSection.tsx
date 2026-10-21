import type { Checkpoint, ContinuationKind, EvolveCorpus } from '../../domain/evolve';
import { continuationMeta, continuationSupport } from '../../domain/evolve';
import { Callout, Def, DefList, Section } from '../../ui/layout';
import { Block, DossierBody, DossierHeader, ListItem, ListPane, Split } from './LabLayout';
import { ContinuationTag, RelationLine } from './shared';
import { RELATION_META } from './evolveMeta';

const STATE_LABELS: Record<keyof Checkpoint['state'], string> = {
  workspaceSnapshot: 'Workspace snapshot',
  conversationPrefix: 'Conversation prefix',
  toolDefinitions: 'Tool definitions',
  environmentPin: 'Environment pin',
  recordedResponses: 'Recorded responses (cassette)',
};

const KINDS: ContinuationKind[] = ['recorded', 'replayed', 'simulated'];
const SHORT: Record<ContinuationKind, string> = { recorded: 'NEW', replayed: 'REPLAY', simulated: 'SIM' };

/** Three small marks: filled = supported, hollow = not. Derived from what is recorded, never from a label on the checkpoint. */
function SupportMarks({ cp }: { cp: Checkpoint }) {
  const support = continuationSupport(cp);
  return (
    <span className="inline-flex items-center gap-2" aria-label={KINDS.map((k) => `${continuationMeta[k].label} ${support[k].supported ? 'supported' : 'not supported'}`).join(', ')}>
      {KINDS.map((k) => (
        <span key={k} className="inline-flex items-center gap-1 font-mono text-2xs text-fg-3" title={`${continuationMeta[k].label}: ${support[k].reason}`}>
          <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden><rect x="0.6" y="0.6" width="7.8" height="7.8" rx="1" fill={support[k].supported ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.1" strokeDasharray={support[k].supported ? undefined : '2 1.4'} className={support[k].supported ? 'text-fg-1' : 'text-fg-4'} /></svg>
          {SHORT[k]}
        </span>
      ))}
    </span>
  );
}

export function CheckpointsSection({ corpus, checkpointId, onSelect, onOpenExecution, onOpenExperiment }: {
  corpus: EvolveCorpus;
  checkpointId: string;
  onSelect: (id: string) => void;
  onOpenExecution: (id: string) => void;
  onOpenExperiment: (id: string) => void;
}) {
  const cp = corpus.checkpoints.find((c) => c.id === checkpointId) ?? corpus.checkpoints[0];
  if (!cp) return null;
  const support = continuationSupport(cp);
  const exp = corpus.experiments.find((x) => x.checkpointId === cp.id);
  const branches = corpus.edges.filter((e) => e.note?.includes(cp.id) || (e.relation === 'simulated_branch' && e.note?.includes('ckpt')));
  const missing = (Object.keys(STATE_LABELS) as (keyof Checkpoint['state'])[]).filter((k) => !cp.state[k].present);

  return (
    <Split
      list={
        <ListPane title="Checkpoints" count={corpus.checkpoints.length}>
          {corpus.checkpoints.map((c) => (
            <ListItem key={c.id} selected={c.id === cp.id} onClick={() => onSelect(c.id)} label={c.label}>
              <div className="font-mono text-2xs text-fg-3">{c.id}</div>
              <div className="mt-0.5 text-xs font-medium text-fg-1">{c.label}</div>
              <div className="mt-1.5"><SupportMarks cp={c} /></div>
            </ListItem>
          ))}
        </ListPane>
      }
      inspector={
        <aside aria-label="Recorded branches" className="hidden w-[360px] shrink-0 flex-col overflow-y-auto scrollbar-thin border-l border-line bg-surface-1 px-4 py-4 lg:flex">
          <div className="eyebrow">Branches</div>
          <h2 className="mt-1 font-serif text-xl leading-snug text-fg-1">What was continued from here</h2>
          <div className="mt-4 space-y-4">
            <Section title="Recorded branches" note={`${branches.length}`}>
              {branches.length === 0 ? <p className="text-xs leading-relaxed text-fg-3">No continuation has been recorded from this checkpoint.</p> : (
                <ul className="space-y-1">
                  {branches.map((e) => {
                    const x = corpus.executions.find((y) => y.id === e.from);
                    return (
                      <li key={e.id}>
                        <button type="button" onClick={() => x && onOpenExecution(x.id)} className="block w-full rounded-ctl border border-line bg-surface-2 px-2.5 py-2 text-left transition-colors duration-100 hover:border-line-strong hover:bg-surface-3">
                          <div className="flex items-center gap-2"><RelationLine relation={e.relation} /><span className="font-mono text-2xs font-medium text-fg-1">{RELATION_META[e.relation].label}</span></div>
                          <div className="mt-0.5 truncate text-xs text-fg-2">{x?.label ?? e.from}</div>
                          <div className="font-mono text-2xs text-fg-3">{e.from}</div>
                          {e.note && <p className="mt-0.5 text-2xs leading-snug text-fg-3">{e.note}</p>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>
            <Section title="Three kinds of continuation">
              <ul className="space-y-2">
                {KINDS.map((k) => <li key={k} className="flex items-start gap-3"><span className="mt-0.5 w-[112px] shrink-0"><ContinuationTag kind={k} /></span><p className="text-2xs leading-relaxed text-fg-3">{continuationMeta[k].desc}</p></li>)}
              </ul>
            </Section>
          </div>
        </aside>
      }
    >
      <DossierBody>
        <DossierHeader
          eyebrow={<><span>checkpoint</span><span aria-hidden>·</span><span>{cp.id}</span></>}
          title={cp.label}
          lede={cp.note}
        />

        <Block id="position" title="Position">
          <DefList>
            <Def k="execution" mono={false}><button type="button" onClick={() => onOpenExecution(cp.executionId)} className="font-mono text-xs text-fg-1 underline decoration-line-strong underline-offset-2 hover:decoration-fg-2">{cp.executionId} — open in lineage →</button></Def>
            <Def k="after event">{cp.afterEventId}</Def>
            <Def k="after seq">{cp.afterSeq}</Def>
          </DefList>
        </Block>

        <Block id="state" title="Recorded state" note={missing.length === 0 ? 'All five artifacts are present.' : `${missing.length} of 5 absent: ${missing.map((k) => STATE_LABELS[k].toLowerCase()).join(', ')}.`}>
          <ul className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
            {(Object.keys(STATE_LABELS) as (keyof Checkpoint['state'])[]).map((k) => {
              const item = cp.state[k];
              return (
                <li key={k} className={`rounded-panel border p-3 ${item.present ? 'border-line-strong bg-surface-1' : 'hatch-faint border-dashed border-line bg-surface-1'}`}>
                  <div className="flex items-center gap-2">
                    {item.present ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="text-fg-1"><circle cx="7" cy="7" r="6" fill="currentColor" /><path d="M4 7.2 6.1 9.2 10 5" fill="none" className="stroke-surface-0" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="text-na"><circle cx="7" cy="7" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2.4 2" /></svg>
                    )}
                    <span className="text-xs font-medium text-fg-1">{STATE_LABELS[k]}</span>
                    <span className={`ml-auto font-mono text-2xs ${item.present ? 'text-fg-2' : 'text-fg-3'}`}>{item.present ? 'present' : 'absent'}</span>
                  </div>
                  <p className="mt-1.5 text-2xs leading-relaxed text-fg-3">{item.note}</p>
                </li>
              );
            })}
          </ul>
        </Block>

        <Block id="support" title="What this checkpoint can support" note="Derived from the recorded state above. Forkability is a consequence of what is recorded, never a property asserted of the checkpoint.">
          <div className="overflow-hidden rounded-panel border border-line">
            {KINDS.map((k) => {
              const s = support[k];
              return (
                <div key={k} className={`flex items-start gap-4 border-b border-line-subtle px-4 py-3 last:border-b-0 ${s.supported ? 'bg-surface-1' : 'hatch-faint bg-surface-1'}`}>
                  <div className="w-[120px] shrink-0 pt-0.5"><ContinuationTag kind={k} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs"><span className={`font-medium ${s.supported ? 'text-fg-1' : 'text-fg-3'}`}>{s.supported ? 'supported' : 'not supported'}</span></div>
                    <p className="mt-0.5 text-2xs leading-relaxed text-fg-3">{continuationMeta[k].desc}</p>
                    <p className={`mt-1 font-mono text-2xs ${s.supported ? 'text-fg-3' : 'text-attn'}`}>{s.reason}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Block>

        <Block id="counterfactuals" title="Counterfactuals on record">
          {exp ? (
            <button type="button" onClick={() => onOpenExperiment(exp.id)} className="block w-full rounded-panel border border-line bg-surface-1 p-3.5 text-left shadow-inset transition-colors duration-100 hover:border-line-strong">
              <div className="font-mono text-2xs text-fg-3">experiment · {exp.id}</div>
              <div className="mt-0.5 text-sm font-medium text-fg-1">{exp.label}</div>
              <p className="mt-1 text-xs leading-relaxed text-fg-3">{exp.question}</p>
            </button>
          ) : (
            <Callout title="None">No experiment has been defined from this checkpoint.</Callout>
          )}
        </Block>
      </DossierBody>
    </Split>
  );
}
