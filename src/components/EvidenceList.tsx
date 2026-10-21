import { useState } from 'react';
import type { EvidenceItem } from '../domain/types';
import { EvidenceBadge } from './primitives';

export function EvidenceList({ items }: { items: EvidenceItem[] }) {
  return (
    <ul className="overflow-hidden rounded-[4px] border border-ink-700/70 bg-ink-850/40">
      {items.map((item, i) => (
        <EvidenceRow key={i} item={item} />
      ))}
    </ul>
  );
}

function EvidenceRow({ item }: { item: EvidenceItem }) {
  const [open, setOpen] = useState(false);
  const hasSource = !!item.sourceId;
  const hasExtra = (item.kind === 'DER' && item.process) || (item.kind === 'NA' && item.reason);

  return (
    <li className="border-b border-ink-800 last:border-b-0">
      <div className="flex items-center gap-2 px-3 py-2">
        <EvidenceBadge kind={item.kind} />
        <span className="min-w-0 flex-1 text-2xs font-medium text-ink-100">{item.label}</span>
        {hasSource && (
          <button
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="shrink-0 font-mono text-[10px] text-blue-accent/90 underline decoration-blue-accent/30 underline-offset-2 hover:decoration-blue-accent"
          >
            {item.sourceId}
          </button>
        )}
        {hasExtra && (
          <button
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label="Toggle details"
            className="shrink-0 rounded p-0.5 font-mono text-[10px] text-ink-400 hover:text-ink-200"
          >
            {open ? '−' : '+'}
          </button>
        )}
      </div>
      <div className="px-3 pb-2">
        <p className="text-2xs leading-relaxed text-ink-300">{item.detail}</p>
        {open && item.kind === 'DER' && item.process && (
          <div className="mt-1.5 border-l-2 border-amber-accent/40 pl-2">
            <div className="font-mono text-[9px] uppercase tracking-widest text-amber-accent/80">declared process</div>
            <p className="mt-0.5 font-mono text-[10px] leading-relaxed text-amber-accent/90">{item.process}</p>
          </div>
        )}
        {open && item.kind === 'NA' && item.reason && (
          <div className="mt-1.5 border-l-2 border-ink-500 pl-2">
            <div className="font-mono text-[9px] uppercase tracking-widest text-ink-400">reason unavailable</div>
            <p className="mt-0.5 font-mono text-[10px] leading-relaxed text-ink-300">{item.reason}</p>
          </div>
        )}
        {open && hasSource && (
          <div className="mt-1.5 border-l-2 border-blue-accent/40 pl-2">
            <div className="font-mono text-[9px] uppercase tracking-widest text-blue-accent/80">provenance</div>
            <p className="mt-0.5 font-mono text-[10px] leading-relaxed text-ink-300">
              read from {item.sourceId} at recording time; interpretation depends on that source's recorded condition
            </p>
          </div>
        )}
      </div>
    </li>
  );
}
