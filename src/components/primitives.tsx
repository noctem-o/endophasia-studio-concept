import type { EvidenceItem, EventStatus, Source } from '@/data/types';
import { evidenceKindMeta } from '@/data/sessions';

export function EvidenceBadge({ kind, small }: { kind: EvidenceItem['kind']; small?: boolean }) {
  const m = evidenceKindMeta[kind];
  return (
    <span
      title={`${m.full} — ${m.desc}`}
      className={`inline-flex items-center justify-center border font-mono font-semibold tracking-widest ${m.cls} ${
        small ? 'h-4 min-w-[2rem] px-1 text-[9px]' : 'h-5 min-w-[2.5rem] px-1.5 text-2xs'
      } rounded-[3px]`}
    >
      {m.label}
    </span>
  );
}

export const statusMeta: Record<EventStatus, { label: string; dot: string; text: string }> = {
  ok: { label: 'ok', dot: 'bg-teal-accent', text: 'text-teal-accent' },
  error: { label: 'error', dot: 'bg-red-accent', text: 'text-red-accent' },
  partial: { label: 'partial', dot: 'bg-amber-accent', text: 'text-amber-accent' },
  pending: { label: 'pending', dot: 'bg-ink-400', text: 'text-ink-300' },
};

export function StatusChip({ status }: { status: EventStatus }) {
  const m = statusMeta[status];
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-2xs ${m.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

export const sourceConditionMeta: Record<
  Source['condition'],
  { label: string; cls: string; icon: string }
> = {
  readable: { label: 'READABLE', cls: 'text-teal-accent border-teal-accent/35 bg-teal-accent/8', icon: '●' },
  empty: { label: 'EMPTY', cls: 'text-ink-300 border-ink-500/40 bg-ink-700/40', icon: '○' },
  absent: { label: 'ABSENT', cls: 'text-ink-400 border-ink-500/40 bg-ink-700/40', icon: '—' },
  degraded: { label: 'DEGRADED', cls: 'text-amber-accent border-amber-accent/35 bg-amber-accent/8', icon: '◐' },
  unopenable: { label: 'UNOPENABLE', cls: 'text-red-accent border-red-accent/35 bg-red-accent/8', icon: '✕' },
};

export function SourceConditionChip({ condition }: { condition: Source['condition'] }) {
  const m = sourceConditionMeta[condition];
  return (
    <span className={`inline-flex items-center gap-1.5 border rounded-[3px] px-1.5 py-0.5 font-mono text-2xs tracking-wider ${m.cls}`}>
      <span aria-hidden className="text-[9px]">{m.icon}</span>
      {m.label}
    </span>
  );
}

export function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-ink-700/60 px-4 py-2.5">
      <h2 className="font-mono text-2xs font-semibold uppercase tracking-[0.18em] text-ink-300">
        {children}
      </h2>
      {right}
    </div>
  );
}

export function NotRecorded({ what }: { what: string }) {
  return <span className="font-mono text-2xs text-ink-400">{what} not recorded</span>;
}
