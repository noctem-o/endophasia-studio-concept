import type { EvidenceKind } from '../domain/types';
import { EVIDENCE_ORDER, evidenceMeta } from '../state/meta';
import { ProvGlyph } from './marks';

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

/**
 * A pass rate as an interval, not a number. Fixed 0–100% axis on every bar (so bars are comparable across arms), the 95% Wilson
 * interval as the bar, the OBSERVED fraction (passes / denominator) as a tick, and the denominator always printed beside it.
 * The tick is the observed fraction, not the Wilson centre: the centre is a property of the interval and is pulled toward 50%,
 * so printing it as "the pass rate" would overstate or understate what was observed. The observed fraction always lies inside
 * the interval. When there is no verdict the track is hatched and says so: an empty bar would read as 0%, and missing is not zero.
 *
 * Deliberately neutral: pass/fail is an outcome, not provenance, so it takes no hue.
 */
export function IntervalBar({ passes, denominator, interval, emptyReason, compact = false }: {
  passes: number;
  denominator: number;
  interval: { low: number; high: number } | null;
  emptyReason?: string;
  compact?: boolean;
}) {
  const observed = denominator > 0 ? passes / denominator : null;
  const has = interval !== null && observed !== null;
  const label = has
    ? `${passes} of ${denominator} checks passed (${pct(observed)}); 95% Wilson interval ${pct(interval.low)} to ${pct(interval.high)}`
    : `no pass/fail verdicts${emptyReason ? `: ${emptyReason}` : ''}`;
  return (
    <div className="min-w-0">
      <div role="img" aria-label={label} className={`relative overflow-hidden rounded-tag border border-line bg-surface-1 ${compact ? 'h-2.5' : 'h-3.5'} ${has ? '' : 'hatch-faint'}`}>
        {[0.25, 0.5, 0.75].map((t) => (
          <span key={t} aria-hidden className="absolute inset-y-0 w-px bg-line-subtle" style={{ left: `${t * 100}%` }} />
        ))}
        {has && (
          <>
            <span aria-hidden className="absolute inset-y-[3px] rounded-[1px] bg-fg-3/70" style={{ left: `${interval.low * 100}%`, width: `${Math.max(0.8, (interval.high - interval.low) * 100)}%` }} />
            <span aria-hidden className="absolute inset-y-0 w-[2px] bg-select" style={{ left: `calc(${observed * 100}% - 1px)` }} />
          </>
        )}
      </div>
      <div className="mt-1 flex items-baseline gap-2 font-mono text-2xs tnum">
        {has ? (
          <>
            <span className="text-fg-1">{passes}/{denominator}</span>
            <span className="text-fg-2">{pct(observed)}</span>
            <span className="text-fg-3" title="95% Wilson score interval">[{pct(interval.low)}, {pct(interval.high)}]</span>
          </>
        ) : (
          <span className="text-fg-3">no verdicts{emptyReason ? ` — ${emptyReason}` : ''}</span>
        )}
      </div>
    </div>
  );
}

/** Counts of records by their strongest evidence class. A derived tally of real records, labelled as such — not a score. */
export function ProvenanceMix({ counts, total }: { counts: Record<EvidenceKind, number>; total: number }) {
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-tag border border-line bg-surface-1" role="img" aria-label={EVIDENCE_ORDER.map((k) => `${counts[k]} ${evidenceMeta[k].full}`).join(', ')}>
        {EVIDENCE_ORDER.map((k) =>
          counts[k] > 0 ? (
            <span key={k} className={k === 'NA' ? 'hatch-faint' : evidenceMeta[k].fill} style={{ width: `${(counts[k] / Math.max(1, total)) * 100}%` }} />
          ) : null,
        )}
      </div>
      <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
        {EVIDENCE_ORDER.map((k) => (
          <li key={k} className="inline-flex items-center gap-1 font-mono text-2xs text-fg-2 tnum" title={`${evidenceMeta[k].full}: ${evidenceMeta[k].desc}`}>
            <ProvGlyph kind={k} size={10} />
            {evidenceMeta[k].label} <span className="text-fg-1">{counts[k]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
