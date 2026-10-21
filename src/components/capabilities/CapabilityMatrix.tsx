import type { Capability, Session } from '../../domain/types';
import { capabilityMeta } from '../../state/meta';
import { backing, exercisedBy, exercisePositions } from '../../state/capabilities';
import { CapabilityGlyph, ProvGlyph, ProvStack } from '../../ui/marks';

/** Where in the trajectory a capability was exercised: a tick per event along storage order. None is stated as none, not drawn as an empty bar. */
export function ExerciseStrip({ session, cap, width = 132 }: { session: Session; cap: Capability; width?: number }) {
  const events = exercisedBy(session, cap);
  if (events.length === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-2xs text-fg-3" title="No event in this session used this capability">
        <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden><circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 1.7" /></svg>
        never exercised
      </span>
    );
  }
  const pos = exercisePositions(session, events);
  return (
    <span className="inline-flex items-center gap-2" title={`Exercised at seq ${events.map((e) => e.seq).join(', ')}`}>
      <svg width={width} height="14" viewBox={`0 0 ${width} 14`} role="img" aria-label={`Exercised ${events.length} times, at seq ${events.map((e) => e.seq).join(', ')}`}>
        <line x1="2" x2={width - 2} y1="7" y2="7" className="stroke-line-strong" strokeWidth="1" />
        {pos.map((p, i) => <rect key={i} x={4 + p * (width - 8) - 1} y="2.5" width="2" height="9" rx="0.5" className="fill-fg-1" />)}
      </svg>
      <span className="font-mono text-2xs text-fg-2 tnum">{events.length}×</span>
    </span>
  );
}

/**
 * Declared against observed, capability by capability. The two middle columns are marked ONLY when evidence of that class backs
 * them: a declared capability that was never exercised shows a reported mark and an empty observed cell, never a colour it has
 * not earned.
 */
export function CapabilityMatrix({ session, selectedId, dimmed, onSelect }: {
  session: Session;
  selectedId: string | null;
  /** Capability ids to de-emphasise (those not citing the selected source). */
  dimmed: ReadonlySet<string>;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-auto scrollbar-thin">
      <table role="grid" aria-label="Capabilities: declared against observed" className="w-full text-left text-xs">
        <thead className="sticky top-0 z-10 bg-surface-1 shadow-hairline">
          <tr role="row" className="eyebrow">
            <th scope="col" className="w-[210px] py-2 pl-4 pr-2 font-medium">capability</th>
            <th scope="col" className="px-2 py-2 font-medium"><span className="inline-flex items-center gap-1.5"><ProvGlyph kind="REP" size={10} />declared</span></th>
            <th scope="col" className="px-2 py-2 font-medium"><span className="inline-flex items-center gap-1.5"><ProvGlyph kind="OBS" size={10} />observed</span></th>
            <th scope="col" className="hidden w-[176px] px-2 py-2 font-medium xl:table-cell">exercised in this session</th>
            <th scope="col" className="hidden w-[84px] px-2 py-2 font-medium lg:table-cell">limits</th>
            <th scope="col" className="w-[84px] py-2 pl-2 pr-4 font-medium">evidence</th>
          </tr>
        </thead>
        <tbody>
          {session.capabilities.map((cap) => {
            const m = capabilityMeta[cap.status];
            const b = backing(cap);
            const sel = cap.id === selectedId;
            const kinds = [...new Set(cap.evidence.map((e) => e.kind))];
            return (
              <tr
                key={cap.id}
                role="row"
                aria-selected={sel}
                tabIndex={0}
                onClick={() => onSelect(cap.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(cap.id); } }}
                className={`relative cursor-pointer border-b border-line-subtle align-top outline-offset-[-2px] transition-colors duration-75 ${sel ? 'bg-surface-3' : 'hover:bg-surface-2'} ${dimmed.has(cap.id) ? 'opacity-30' : ''}`}
              >
                <td role="gridcell" className="relative py-2.5 pl-4 pr-2">
                  {sel && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-select" />}
                  <div className="flex items-center gap-2"><CapabilityGlyph status={cap.status} /><span className="font-mono text-xs font-medium text-fg-1">{cap.name}</span></div>
                  <span className={`mt-1 inline-block rounded-tag border px-1.5 font-mono text-2xs tracking-wider ${m.text} ${m.border} ${m.bg}`} title={m.desc}>{m.label}</span>
                </td>
                <td role="gridcell" className="max-w-0 px-2 py-2.5">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0">{b.declared.length > 0 ? <ProvGlyph kind="REP" size={11} /> : <ProvGlyph kind="NA" size={11} />}</span>
                    <p className="line-clamp-2 text-xs leading-snug text-fg-2">{cap.declared}</p>
                  </div>
                </td>
                <td role="gridcell" className="max-w-0 px-2 py-2.5">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0">{b.observed.length > 0 ? <ProvGlyph kind="OBS" size={11} /> : <ProvGlyph kind="NA" size={11} />}</span>
                    <p className={`line-clamp-2 text-xs leading-snug ${b.observed.length > 0 ? 'text-fg-2' : 'text-fg-3'}`}>{cap.observed}</p>
                  </div>
                </td>
                <td role="gridcell" className="hidden px-2 py-2.5 xl:table-cell"><ExerciseStrip session={session} cap={cap} /></td>
                <td role="gridcell" className="hidden px-2 py-2.5 font-mono text-2xs text-fg-3 tnum lg:table-cell" title={cap.restrictions.join(' · ')}>{cap.restrictions.length === 0 ? '—' : `${cap.restrictions.length} ${cap.restrictions.length === 1 ? 'limit' : 'limits'}`}</td>
                <td role="gridcell" className="py-2.5 pl-2 pr-4"><ProvStack kinds={kinds} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {session.capabilities.length === 0 && <p className="px-4 py-10 text-center font-mono text-2xs text-fg-3">no capabilities declared</p>}
    </div>
  );
}
