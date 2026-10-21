import type { Ref } from 'react';
import { RotateCcw } from 'lucide-react';
import type { EventCategory, EventStatus, EvidenceKind } from '../../domain/types';
import { CATEGORY_ORDER, categoryMeta, EVIDENCE_ORDER, evidenceMeta } from '../../state/meta';
import type { EventFilters } from '../../state/observe';
import { filtersActive } from '../../state/observe';
import { Button, Chip, Kbd, SearchField } from '../../ui/controls';
import { ProvGlyph } from '../../ui/marks';

const toggle = <T,>(set: ReadonlySet<T>, v: T): Set<T> => {
  const next = new Set(set);
  if (next.has(v)) next.delete(v);
  else next.add(v);
  return next;
};

/** Counts beside each option are tallies of the session's own records, so a filter that would match nothing says so before you click. */
export function FilterBar({ filters, onChange, onReset, shown, total, categoryCounts, evidenceCounts, statusCounts, searchRef }: {
  filters: EventFilters;
  onChange: (next: EventFilters) => void;
  onReset: () => void;
  shown: number;
  total: number;
  categoryCounts: Record<EventCategory, number>;
  evidenceCounts: Record<EvidenceKind, number>;
  statusCounts: Record<EventStatus, number>;
  searchRef: Ref<HTMLInputElement>;
}) {
  const count = (n: number) => <span className="ml-0.5 text-fg-3 tnum">{n}</span>;
  return (
    <div role="search" aria-label="Filter events" className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface-1 px-4 py-2">
      <div className="relative">
        <SearchField value={filters.query} onChange={(query) => onChange({ ...filters, query })} placeholder="Search events and fields" label="Search events" inputRef={searchRef} className="w-64" />
        {!filters.query && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"><Kbd>/</Kbd></span>}
      </div>

      <div role="group" aria-label="Category" className="flex flex-wrap items-center gap-1">
        {CATEGORY_ORDER.map((c) => {
          const m = categoryMeta[c];
          const Icon = m.icon;
          return (
            <Chip key={c} active={filters.categories.has(c)} onClick={() => onChange({ ...filters, categories: toggle(filters.categories, c) })} title={`${m.name} events`} leading={<Icon className="h-3 w-3" aria-hidden />}>
              {m.name}{count(categoryCounts[c])}
            </Chip>
          );
        })}
      </div>

      <div role="group" aria-label="Best evidence class" className="flex items-center gap-1">
        {EVIDENCE_ORDER.map((k) => (
          <Chip key={k} active={filters.evidence.has(k)} onClick={() => onChange({ ...filters, evidence: toggle(filters.evidence, k) })} title={`Events whose strongest evidence is ${evidenceMeta[k].full.toLowerCase()}`} leading={<ProvGlyph kind={k} size={10} />}>
            {evidenceMeta[k].label}{count(evidenceCounts[k])}
          </Chip>
        ))}
      </div>

      <div role="group" aria-label="Status" className="flex items-center gap-1">
        {(['ok', 'error', 'partial'] as const).map((s) => (
          <Chip key={s} active={filters.statuses.has(s)} onClick={() => onChange({ ...filters, statuses: toggle(filters.statuses, s) })}>
            {s}{count(statusCounts[s])}
          </Chip>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-3">
        {filtersActive(filters) && (
          <Button onClick={onReset} leading={<RotateCcw className="h-3 w-3" aria-hidden />} title="Clear every filter">reset</Button>
        )}
        <span className="font-mono text-2xs text-fg-2 tnum" aria-live="polite">
          {shown} <span className="text-fg-3">of</span> {total} <span className="text-fg-3">events</span>
        </span>
      </div>
    </div>
  );
}
