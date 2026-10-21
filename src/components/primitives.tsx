import type { ReactNode } from 'react';
import type { EvidenceKind, EventStatus, SourceCondition } from '../domain/types';
import { CapabilityGlyph, ProvMark, ProvTag, SourceConditionTag, StatusMark } from '../ui/marks';
import { EmptyState, NotRecorded as UiNotRecorded } from '../ui/layout';

/**
 * COMPAT layer: the old primitive names, now backed by the design system in src/ui. Screens are being converted to import from
 * src/ui directly; this file is deleted when none remain.
 */

export function EvidenceBadge({ kind, title }: { kind: EvidenceKind; small?: boolean; withGlyph?: boolean; title?: string }) {
  return <ProvTag kind={kind} title={title} />;
}

export function StatusChip({ status }: { status: EventStatus }) {
  return <StatusMark status={status} showOk />;
}

export { CapabilityGlyph, EmptyState };

export function SourceConditionChip({ condition }: { condition: SourceCondition }) {
  return <SourceConditionTag condition={condition} />;
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex min-h-[24px] items-center justify-between border-b border-line-subtle pb-1">
      <h2 className="eyebrow">{children}</h2>
      {right}
    </div>
  );
}

export function KeyVal({ k, v, mono = true, provenance }: { k: string; v: ReactNode; mono?: boolean; provenance?: EvidenceKind }) {
  return (
    <div className="grid grid-cols-[112px_minmax(0,1fr)] items-baseline gap-3">
      <dt className="min-w-0 font-mono text-2xs text-fg-3 [overflow-wrap:anywhere]">{k}</dt>
      <dd className={`min-w-0 break-words text-xs text-fg-1 ${mono ? 'font-mono' : ''}`}>
        {v}
        {provenance && <span className="ml-2 align-middle"><ProvMark kind={provenance} /></span>}
      </dd>
    </div>
  );
}

export function NotRecorded({ what }: { what: string }) {
  return <UiNotRecorded what={what} />;
}
