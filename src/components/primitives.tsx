import type { ReactNode } from 'react';
import type { EvidenceKind, EventStatus, SourceCondition, CapabilityStatus } from '../domain/types';
import { evidenceMeta, statusMeta, sourceMeta, capabilityMeta } from '../state/meta';

// ─── Provenance ──────────────────────────────────────────────────────────────

export function EvidenceBadge({ kind, small, withGlyph, title }: { kind: EvidenceKind; small?: boolean; withGlyph?: boolean; title?: string }) {
  const m = evidenceMeta[kind];
  return (
    <span
      title={title ?? `${m.full} — ${m.desc}`}
      className={`inline-flex items-center justify-center gap-1 border font-mono font-semibold tracking-widest ${m.text} ${m.border} ${m.bg} rounded-[3px] ${
        small ? 'h-4 min-w-[2.1rem] px-1 text-[9px]' : 'h-5 min-w-[2.6rem] px-1.5 text-2xs'
      }`}
    >
      {withGlyph && <span aria-hidden className="text-[8px]">{m.glyph}</span>}
      {m.label}
    </span>
  );
}

export function StatusChip({ status }: { status: EventStatus }) {
  const m = statusMeta[status];
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-2xs ${m.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} aria-hidden />
      {m.label}
    </span>
  );
}

export function CapabilityGlyph({ status, className }: { status: CapabilityStatus; className?: string }) {
  const m = capabilityMeta[status];
  return (
    <span
      aria-label={m.label}
      title={`${m.label} — ${m.desc}`}
      className={`inline-flex items-center justify-center ${m.text} ${className ?? ''}`}
    >
      {m.glyph}
    </span>
  );
}

export function SourceConditionChip({ condition }: { condition: SourceCondition }) {
  const m = sourceMeta[condition];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-[3px] border px-1.5 py-0.5 font-mono text-2xs tracking-wider ${m.text} ${m.border} ${m.bg}`}>
      <span aria-hidden className="text-[9px]">{m.glyph}</span>
      {m.label}
    </span>
  );
}

// ─── Layout primitives ───────────────────────────────────────────────────────

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex min-h-[38px] items-center justify-between border-b border-ink-700/60 bg-ink-900/60 px-4 py-2">
      <h2 className="font-mono text-2xs font-semibold uppercase tracking-[0.18em] text-ink-300">{children}</h2>
      {right}
    </div>
  );
}

export function KeyVal({ k, v, mono = true, provenance }: { k: string; v: ReactNode; mono?: boolean; provenance?: EvidenceKind }) {
  return (
    <div className="grid grid-cols-[118px_1fr] items-baseline gap-3">
      <dt className="font-mono text-2xs text-ink-400">{k}</dt>
      <dd className={`min-w-0 break-words text-2xs text-ink-100 ${mono ? 'font-mono' : ''}`}>
        {v}
        {provenance && (
          <span className={`ml-2 font-mono text-[9px] tracking-widest ${evidenceMeta[provenance].text}`}>
            {provenance}
          </span>
        )}
      </dd>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
      <div className="font-mono text-2xs uppercase tracking-[0.18em] text-ink-400">{title}</div>
      {hint && <p className="max-w-[280px] text-2xs leading-relaxed text-ink-500">{hint}</p>}
    </div>
  );
}

export function NotRecorded({ what }: { what: string }) {
  return <span className="font-mono text-2xs text-ink-500">{what} · not recorded</span>;
}
