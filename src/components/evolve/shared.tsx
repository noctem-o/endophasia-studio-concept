import type { ReactNode } from 'react';
import type { ContinuationKind, LineageRelation, Trial } from '../../domain/evolve';
import { continuationMeta } from '../../domain/evolve';
import { RELATION_STYLE_HEX } from '../../scenes/renderers/palette';

/** A line sample in the relation's own colour — the same one the graph draws with. */
export function RelationLine({ relation, width = 24 }: { relation: LineageRelation; width?: number }) {
  const st = RELATION_STYLE_HEX[relation];
  return (
    <svg width={width} height="8" viewBox={`0 0 ${width} 8`} aria-hidden className="shrink-0">
      <path d={`M1 4h${width - 2}`} stroke={st.stroke} strokeWidth="2" strokeLinecap="round" strokeDasharray={st.dash?.join(' ')} />
    </svg>
  );
}

/**
 * The three kinds of continuation, kept visibly apart because they support different claims:
 *   REPLAYED     recorded responses held fixed — sage ring, the same colour a replay node has in the graph
 *   NEW EXECUTION a genuinely new recorded run — solid ivory
 *   SIMULATED    a projection, never a result — HATCHED violet (the derived hue), the one that must never look like a trial
 */
export function ContinuationTag({ kind }: { kind: ContinuationKind }) {
  const label = continuationMeta[kind].label;
  if (kind === 'simulated') {
    return <span className="hatch-der inline-flex h-5 items-center rounded-tag border border-der/60 bg-surface-1 px-1.5 font-mono text-2xs font-semibold tracking-wider text-der">{label}</span>;
  }
  if (kind === 'replayed') {
    return <span className="inline-flex h-5 items-center rounded-tag border border-dashed border-replay/70 px-1.5 font-mono text-2xs font-semibold tracking-wider text-replay">{label}</span>;
  }
  return <span className="inline-flex h-5 items-center rounded-tag border border-line-strong bg-surface-3 px-1.5 font-mono text-2xs font-semibold tracking-wider text-fg-1">{label}</span>;
}

/** A verdict that may be missing. Unavailable is hatched and says why; it is never drawn as a pass or a fail. */
export function CheckMark({ status, reason, label }: { status: 'passed' | 'failed' | 'unavailable'; reason?: string; label?: string }) {
  const text = label ? `${label} ` : '';
  if (status === 'unavailable') {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-2xs text-fg-3" title={`${text}unavailable${reason ? `: ${reason}` : ''}`}>
        <span className="hatch-faint inline-block h-3 w-3 rounded-tag border border-dashed border-line-strong" aria-hidden />
        {text}n/a
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-2xs ${status === 'failed' ? 'text-fault' : 'text-fg-1'}`} title={`${text}${status}${reason ? `: ${reason}` : ''}`}>
      <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
        {status === 'passed'
          ? <path d="M2 5.8 4.4 8.2 9 3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          : <path d="M2.4 2.4 8.6 8.6M8.6 2.4 2.4 8.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />}
      </svg>
      {text}{status}
    </span>
  );
}

/** Trial outcome, in words: outcome is not provenance and takes no hue. */
export function OutcomeText({ outcome }: { outcome: Trial['outcome'] }) {
  const cls = outcome === 'failed' ? 'text-fault' : outcome === 'interrupted' ? 'text-attn' : outcome === 'unclassified' ? 'text-fg-3' : 'text-fg-1';
  return <span className={`font-mono text-2xs ${cls}`}>{outcome}</span>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="eyebrow">{children}</div>;
}
