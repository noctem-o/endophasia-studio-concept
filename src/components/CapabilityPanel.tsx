import { useState } from 'react';
import type { Capability } from '@/data/types';
import { EvidenceBadge } from './primitives';

const statusMeta: Record<Capability['status'], { label: string; cls: string; glyph: string }> = {
  admitted: { label: 'ADMITTED', cls: 'text-teal-accent', glyph: '●' },
  'partially-admitted': { label: 'PARTIAL', cls: 'text-amber-accent', glyph: '◐' },
  unavailable: { label: 'UNAVAILABLE', cls: 'text-ink-400', glyph: '○' },
  mismatched: { label: 'MISMATCH', cls: 'text-red-accent', glyph: '▲' },
  unverified: { label: 'UNVERIFIED', cls: 'text-blue-accent', glyph: '◇' },
};

export function CapabilityList({ capabilities, selectedId, onSelect }: {
  capabilities: Capability[];
  selectedId: string | null;
  onSelect: (c: Capability) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<'all' | Capability['status']>('all');
  const filtered = statusFilter === 'all' ? capabilities : capabilities.filter((c) => c.status === statusFilter);

  const counts = capabilities.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});

  const filters: { key: 'all' | Capability['status']; label: string }[] = [
    { key: 'all', label: `All ${capabilities.length}` },
    { key: 'admitted', label: `Admitted ${counts.admitted ?? 0}` },
    { key: 'partially-admitted', label: `Partial ${counts['partially-admitted'] ?? 0}` },
    { key: 'unavailable', label: `Unavailable ${counts.unavailable ?? 0}` },
    { key: 'mismatched', label: `Mismatch ${counts.mismatched ?? 0}` },
    { key: 'unverified', label: `Unverified ${counts.unverified ?? 0}` },
  ];

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex flex-wrap gap-1 px-4 pb-2 pt-3">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            aria-pressed={statusFilter === f.key}
            className={`rounded-[3px] border px-1.5 py-0.5 font-mono text-[10px] transition-colors ${
              statusFilter === f.key
                ? 'border-teal-accent/50 bg-teal-accent/10 text-teal-accent'
                : 'border-ink-600/60 text-ink-400 hover:border-ink-500 hover:text-ink-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto scrollbar-thin px-2 pb-3">
        {filtered.map((cap) => {
          const meta = statusMeta[cap.status];
          const selected = cap.id === selectedId;
          return (
            <li key={cap.id}>
              <button
                onClick={() => onSelect(cap)}
                aria-pressed={selected}
                className={`group flex w-full items-center gap-2.5 rounded-[4px] border px-2.5 py-2 text-left transition-colors ${
                  selected
                    ? 'border-teal-accent/40 bg-teal-accent/8'
                    : 'border-transparent hover:border-ink-600 hover:bg-ink-800'
                }`}
              >
                <span aria-hidden className={`text-[10px] ${meta.cls}`}>{meta.glyph}</span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate font-mono text-2xs font-medium ${selected ? 'text-ink-50' : 'text-ink-200'}`}>
                    {cap.name}
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[10px] text-ink-400">
                    {cap.declared}
                  </span>
                </span>
                <span className={`shrink-0 font-mono text-[9px] font-semibold tracking-widest ${meta.cls}`}>
                  {meta.label}
                </span>
                <span className="flex shrink-0 gap-1">
                  {cap.evidence.slice(0, 3).map((e, i) => (
                    <EvidenceBadge key={i} kind={e.kind} small />
                  ))}
                </span>
              </button>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="px-3 py-4 font-mono text-2xs text-ink-400">No capabilities with this status.</li>
        )}
      </ul>
    </div>
  );
}

export function CapabilityDetail({ cap }: { cap: Capability }) {
  const meta = statusMeta[cap.status];
  return (
    <div className="flex min-h-0 flex-col">
      <div className="border-b border-ink-700/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="font-mono text-[13px] font-semibold text-ink-50">{cap.name}</h3>
          <span className={`font-mono text-2xs font-semibold tracking-widest ${meta.cls}`}>
            {meta.glyph} {meta.label}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        <div className="grid grid-cols-1 gap-0 border-b border-ink-700/60">
          <div className="border-b border-ink-800 px-4 py-3">
            <div className="font-mono text-[10px] uppercase tracking-widest text-ink-400">Declared</div>
            <p className="mt-1 text-2xs text-ink-200">{cap.declared}</p>
          </div>
          <div className="px-4 py-3">
            <div className="font-mono text-[10px] uppercase tracking-widest text-ink-400">Observed</div>
            <p className="mt-1 text-2xs text-ink-200">{cap.observed}</p>
          </div>
        </div>

        <div className="border-b border-ink-700/60 px-4 py-3">
          <div className="font-mono text-[10px] uppercase tracking-widest text-ink-400">Restrictions</div>
          {cap.restrictions.length > 0 ? (
            <ul className="mt-1.5 space-y-1">
              {cap.restrictions.map((r) => (
                <li key={r} className="flex items-start gap-2 text-2xs text-ink-200">
                  <span aria-hidden className="mt-1 h-1 w-1 shrink-0 rounded-full bg-ink-400" />
                  {r}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 font-mono text-2xs text-ink-400">None recorded</p>
          )}
        </div>

        <div className="px-4 py-3">
          <div className="font-mono text-[10px] uppercase tracking-widest text-ink-400">Evidence basis</div>
          <ul className="mt-2 space-y-2">
            {cap.evidence.map((e, i) => (
              <li key={i} className="rounded-[4px] border border-ink-700/70 bg-ink-850/60 p-2.5">
                <div className="flex items-center gap-2">
                  <EvidenceBadge kind={e.kind} />
                  <span className="text-2xs font-medium text-ink-100">{e.label}</span>
                  {e.sourceId && (
                    <span className="ml-auto font-mono text-[10px] text-ink-400">{e.sourceId}</span>
                  )}
                </div>
                <p className="mt-1.5 text-2xs leading-relaxed text-ink-300">{e.detail}</p>
                {e.kind === 'DER' && e.process && (
                  <p className="mt-1.5 border-l-2 border-amber-accent/40 pl-2 font-mono text-[10px] text-amber-accent/90">
                    process: {e.process}
                  </p>
                )}
                {e.kind === 'NA' && e.reason && (
                  <p className="mt-1.5 border-l-2 border-ink-500 pl-2 font-mono text-[10px] text-ink-400">
                    reason: {e.reason}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
