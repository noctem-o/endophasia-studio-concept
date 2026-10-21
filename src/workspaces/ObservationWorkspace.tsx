import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { TrajectoryEvent } from '../domain/types';
import type { StudioState } from '../state/studio';
import { categoryMeta, evidenceMeta, statusMeta } from '../state/meta';
import { EventInspector } from '../components/inspector/EventInspector';
import { TrajectoryRibbon } from '../components/TrajectoryRibbon';

const CATEGORIES = ['lifecycle', 'model', 'tool', 'context', 'verification', 'intervention'] as const;

export function ObservationWorkspace({ studio }: { studio: StudioState }) {
  const session = studio.session;
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [evidenceFilter, setEvidenceFilter] = useState<Set<string>>(new Set());

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, value: string) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return session.events.filter((e) => {
      if (categoryFilter.size && !categoryFilter.has(e.category)) return false;
      if (statusFilter.size && !statusFilter.has(e.status)) return false;
      if (evidenceFilter.size && !evidenceFilter.has(bestEvidenceClass(e))) return false;
      if (q) {
        const hay = [e.title, e.kind, e.tool ?? '', e.summary, ...e.fields.map((f) => f.value)]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [session, query, categoryFilter, statusFilter, evidenceFilter]);

  const selected = filtered.find((e) => e.id === studio.eventId) ?? null;

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <FilterBar
          query={query} onQuery={setQuery}
          categoryFilter={categoryFilter} onCategory={(v) => toggle(categoryFilter, setCategoryFilter, v)}
          statusFilter={statusFilter} onStatus={(v) => toggle(statusFilter, setStatusFilter, v)}
          evidenceFilter={evidenceFilter} onEvidence={(v) => toggle(evidenceFilter, setEvidenceFilter, v)}
          filteredCount={filtered.length} totalCount={session.events.length}
        />
        <EventTable events={filtered} selectedId={studio.eventId} onSelect={studio.setEventId} />
        <TrajectoryRibbon events={filtered} selectedId={studio.eventId} onSelect={studio.setEventId} />
      </div>
      <aside
        aria-label="Event inspector"
        className="hidden w-[420px] shrink-0 overflow-y-auto border-l border-ink-700/70 bg-ink-900 lg:block"
      >
        {selected ? (
          <EventInspector session={session} event={selected} onNavigateRef={studio.setEventId} />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center font-mono text-2xs text-ink-500">
            select an event to inspect its evidence
          </div>
        )}
      </aside>
    </div>
  );
}

function bestEvidenceClass(e: TrajectoryEvent): string {
  const rank: Record<string, number> = { OBS: 3, REP: 2, DER: 1, NA: 0 };
  let best = 'NA';
  let bestRank = -1;
  for (const ev of e.evidence) {
    const r = rank[ev.kind] ?? 0;
    if (r > bestRank) {
      bestRank = r;
      best = ev.kind;
    }
  }
  return best;
}

function FilterBar(props: {
  query: string; onQuery: (v: string) => void;
  categoryFilter: Set<string>; onCategory: (v: string) => void;
  statusFilter: Set<string>; onStatus: (v: string) => void;
  evidenceFilter: Set<string>; onEvidence: (v: string) => void;
  filteredCount: number; totalCount: number;
}) {
  const chip = (active: boolean) =>
    `rounded-full border px-2 py-0.5 font-mono text-2xs transition-colors ${
      active ? '' : 'border-ink-600/60 text-ink-400 hover:border-ink-500 hover:text-ink-200'
    }`;

  return (
    <div className="shrink-0 space-y-2 border-b border-ink-700/70 bg-ink-900/60 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-500" aria-hidden />
          <input
            value={props.query}
            onChange={(e) => props.onQuery(e.target.value)}
            placeholder="Search events, fields…"
            aria-label="Search events"
            className="w-56 rounded-[4px] border border-ink-600/70 bg-ink-850 py-1 pl-7 pr-2 text-xs text-ink-100 placeholder:text-ink-500 focus:border-teal-accent/50 focus:outline-none"
          />
          {props.query && (
            <button
              onClick={() => props.onQuery('')}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-200"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <span className="font-mono text-2xs uppercase tracking-widest text-ink-500">category</span>
        {CATEGORIES.map((c) => {
          const active = props.categoryFilter.has(c);
          const m = categoryMeta[c];
          return (
            <button key={c} onClick={() => props.onCategory(c)} aria-pressed={active}
              className={`${chip(active)} ${active ? `${m.border} ${m.bg} ${m.text}` : ''}`}>
              {m.label}
            </button>
          );
        })}

        <span aria-hidden className="hidden h-4 w-px bg-ink-700 sm:block" />

        <span className="font-mono text-2xs uppercase tracking-widest text-ink-500">status</span>
        {(['ok', 'error', 'partial'] as const).map((s) => {
          const active = props.statusFilter.has(s);
          return (
            <button key={s} onClick={() => props.onStatus(s)} aria-pressed={active}
              className={`${chip(active)} ${active ? `${statusMeta[s].text} border-current/40 bg-current/10` : ''}`}>
              {s}
            </button>
          );
        })}

        <span aria-hidden className="hidden h-4 w-px bg-ink-700 sm:block" />

        <span className="font-mono text-2xs uppercase tracking-widest text-ink-500">evidence</span>
        {(['OBS', 'REP', 'DER', 'NA'] as const).map((c) => {
          const active = props.evidenceFilter.has(c);
          const m = evidenceMeta[c];
          return (
            <button key={c} onClick={() => props.onEvidence(c)} aria-pressed={active} title={m.full}
              className={`${chip(active)} ${active ? `${m.border} ${m.bg} ${m.text}` : ''}`}>
              {m.label}
            </button>
          );
        })}

        <span className="ml-auto font-mono text-2xs text-ink-400">
          {props.filteredCount} / {props.totalCount} events
        </span>
      </div>
    </div>
  );
}

function EventTable({ events, selectedId, onSelect }: {
  events: TrajectoryEvent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <table className="w-full border-collapse text-left text-xs">
        <thead className="sticky top-0 z-10 bg-ink-900 text-2xs font-mono uppercase tracking-widest text-ink-500">
          <tr className="border-b border-ink-700">
            <th scope="col" className="px-4 py-2 font-medium">#</th>
            <th scope="col" className="px-2 py-2 font-medium">time</th>
            <th scope="col" className="px-2 py-2 font-medium">event</th>
            <th scope="col" className="hidden px-2 py-2 font-medium md:table-cell">category</th>
            <th scope="col" className="px-2 py-2 font-medium">status</th>
            <th scope="col" className="hidden px-2 py-2 font-medium sm:table-cell">evidence</th>
            <th scope="col" className="hidden px-4 py-2 font-medium lg:table-cell">summary</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => {
            const cm = categoryMeta[e.category];
            const selected = e.id === selectedId;
            return (
              <tr
                key={e.id}
                onClick={() => onSelect(e.id)}
                aria-selected={selected}
                className={`cursor-pointer border-b border-ink-800/70 transition-colors ${
                  selected ? 'bg-teal-accent/10' : 'hover:bg-ink-850'
                }`}
              >
                <td className="px-4 py-1.5 font-mono text-2xs text-ink-500">{e.seq}</td>
                <td className="px-2 py-1.5 font-mono text-2xs text-ink-400">{e.at.slice(11, 19)}</td>
                <td className="px-2 py-1.5">
                  <span className="font-medium text-ink-100">{e.title}</span>
                  {e.tool && <span className="ml-1.5 font-mono text-2xs text-ink-400">{e.tool}</span>}
                </td>
                <td className="hidden px-2 py-1.5 md:table-cell">
                  <span className={`rounded-[3px] border px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-widest ${cm.border} ${cm.bg} ${cm.text}`}>
                    {cm.label}
                  </span>
                </td>
                <td className="px-2 py-1.5">
                  <StatusDot status={e.status} />
                </td>
                <td className="hidden px-2 py-1.5 sm:table-cell">
                  <div className="flex gap-1">
                    {e.evidence.map((ev, i) => (
                      <span key={i} title={`${ev.kind} — ${ev.label}`} className={`font-mono text-[10px] ${evidenceMeta[ev.kind].text}`}>
                        {evidenceMeta[ev.kind].glyph}
                      </span>
                    ))}
                    {e.evidence.length === 0 && <span className="font-mono text-[10px] text-ink-600">—</span>}
                  </div>
                </td>
                <td className="hidden max-w-[320px] truncate px-4 py-1.5 text-ink-300 lg:table-cell">{e.summary}</td>
              </tr>
            );
          })}
          {events.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center font-mono text-2xs text-ink-500">
                no events match the current filters
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatusDot({ status }: { status: TrajectoryEvent['status'] }) {
  const m = statusMeta[status];
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-2xs ${m.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} aria-hidden />
      {m.label}
    </span>
  );
}
