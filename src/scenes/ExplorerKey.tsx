import { ChevronDown } from 'lucide-react';
import { ALL_RELATIONS, RELATION_LABEL } from './relations';
import type { LineageRelation } from '@/domain/evolve';
import { ProvGlyph } from '@/ui/marks';
import type { EvidenceKind } from '@/domain/types';
import { CLASSIFICATION_TAG, nodePaint, RELATION_STYLE_HEX } from './renderers/palette';
import type { BackendId } from './renderers';
import type { SceneNodeClassification } from './types';

const RELATION_HINT: Record<LineageRelation, string> = {
  forked_from: 'Continued from a checkpoint of the parent execution',
  replay_of: 'Recorded responses held fixed: control flow only',
  candidate_of: 'A trial run under a candidate change',
  evaluated_against: 'Compared with the reference configuration',
  continuation_of: 'A continuation with no narrower relation declared',
  simulated_branch: 'A projection over recorded state, never an execution result',
};

const CLASS_HINT: Record<SceneNodeClassification, string> = {
  baseline: 'a recorded reference run',
  trial: 'a recorded run under an arm',
  continuation: 'a new run from a checkpoint',
  replay: 'recorded responses held fixed',
  'simulated-projection': 'a projection, not a run',
};

const PROV: { kind: EvidenceKind; label: string; what: string }[] = [
  { kind: 'OBS', label: 'OBS', what: 'observed' },
  { kind: 'REP', label: 'REP', what: 'reported' },
  { kind: 'DER', label: 'DER', what: 'derived' },
  { kind: 'NA', label: 'N/A', what: 'unavailable' },
];

/** Swatch of a node as the renderer paints it, so the key cannot disagree with the graph. */
function NodeSwatch({ k }: { k: SceneNodeClassification }) {
  const p = nodePaint(k, { selected: false, dimmed: false });
  return (
    <svg width="26" height="14" viewBox="0 0 26 14" aria-hidden className="shrink-0">
      <rect x="0.5" y="0.5" width="25" height="13" rx="2.5" fill={p.fill.hex} fillOpacity={p.fill.alpha} stroke={p.stroke.hex} strokeOpacity={p.stroke.alpha} strokeDasharray={p.hollow ? '3 2' : undefined} />
    </svg>
  );
}

/**
 * The key to the graph. It doubles as the relation filter: each relation row is a toggle, so the legend and the control are one
 * thing. Dash patterns are drawn only for the SVG backend, because the WebGL backend draws every edge solid; there a relation is
 * told apart by colour, and the key says what is actually on screen.
 */
export function ExplorerKey({ open, onToggle, hidden, onToggleRelation, backend }: {
  open: boolean;
  onToggle: () => void;
  hidden: ReadonlySet<string>;
  onToggleRelation: (r: LineageRelation) => void;
  backend: BackendId;
}) {
  return (
    <div className="w-[236px] overflow-hidden rounded-panel border border-line bg-surface-1/95 shadow-pop backdrop-blur-[2px]">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex h-8 w-full items-center gap-2 px-3 text-left hover:bg-surface-2">
        <span className="eyebrow">Key</span>
        <ChevronDown className={`ml-auto h-3.5 w-3.5 text-fg-3 transition-transform duration-100 ${open ? '' : '-rotate-90'}`} aria-hidden />
      </button>
      {open && (
        <div className="space-y-3 border-t border-line px-3 pb-3 pt-2.5">
          <section aria-label="Relations">
            <div className="eyebrow mb-1">Relations <span className="normal-case tracking-normal text-fg-3">· click to hide</span></div>
            <ul className="space-y-0.5">
              {ALL_RELATIONS.map((r) => {
                const off = hidden.has(r);
                const style = RELATION_STYLE_HEX[r];
                const dash = backend === 'svg-dom' && style.dash ? style.dash.join(' ') : undefined;
                return (
                  <li key={r}>
                    <button
                      type="button"
                      onClick={() => onToggleRelation(r)}
                      aria-pressed={!off}
                      title={`${RELATION_HINT[r]}${off ? ' (hidden)' : ''}`}
                      className={`flex h-6 w-full items-center gap-2 rounded-tag px-1 text-left transition-opacity duration-100 hover:bg-surface-2 ${off ? 'opacity-40' : ''}`}
                    >
                      <svg width="28" height="8" viewBox="0 0 28 8" aria-hidden className="shrink-0">
                        <path d="M1 4h26" stroke={style.stroke} strokeWidth="2" strokeLinecap="round" strokeDasharray={dash} />
                      </svg>
                      <span className={`font-mono text-2xs ${off ? 'text-fg-3 line-through' : 'text-fg-2'}`}>{RELATION_LABEL[r]}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-label="Execution kinds">
            <div className="eyebrow mb-1">Execution kinds</div>
            <ul className="space-y-1">
              {(Object.keys(CLASSIFICATION_TAG) as SceneNodeClassification[]).map((k) => (
                <li key={k} className="flex items-center gap-2" title={CLASS_HINT[k]}>
                  <NodeSwatch k={k} />
                  <span className="font-mono text-2xs text-fg-2">{CLASSIFICATION_TAG[k].label}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="Evidence provenance">
            <div className="eyebrow mb-1">Provenance of the record</div>
            <ul className="flex flex-wrap gap-x-3 gap-y-1">
              {PROV.map((p) => (
                <li key={p.kind} className="flex items-center gap-1.5 font-mono text-2xs text-fg-2" title={p.what}>
                  <ProvGlyph kind={p.kind} size={11} />
                  {p.label}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-2xs leading-relaxed text-fg-3">observed · reported · derived · unavailable</p>
            <p className="mt-1.5 text-2xs leading-relaxed text-fg-3">Replay is an execution kind, not a provenance class: a replay of a recorded run is still evidence-observed.</p>
          </section>

          <section aria-label="Gaps" className="flex items-center gap-2">
            <svg width="26" height="14" viewBox="0 0 26 14" aria-hidden className="shrink-0"><circle cx="13" cy="7" r="4.5" fill="none" stroke="currentColor" className="text-na" strokeWidth="1.3" strokeDasharray="2.2 1.8" /></svg>
            <span className="text-2xs leading-snug text-fg-3">no trajectory in the observation registry: shown as a gap, not as a link</span>
          </section>
        </div>
      )}
    </div>
  );
}
