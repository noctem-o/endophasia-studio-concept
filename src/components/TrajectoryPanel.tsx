import { useMemo, useState } from 'react';
import { categoryColor } from '@/data/sessions';
import type { EventCategory, Session, TrajectoryEvent } from '@/data/types';
import { StatusChip } from './primitives';

const categories: (EventCategory | 'all')[] = ['all', 'lifecycle', 'model', 'tool', 'context', 'verification', 'intervention'];

function fmtOffset(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  return `${m}m ${(s - m * 60).toFixed(0)}s`;
}

function fmtClock(at: string): string {
  return at.slice(11, 19);
}

function compactBarData(events: TrajectoryEvent[]) {
  return events.map((e) => ({
    seq: e.seq,
    pct: e.offsetMs / (events[events.length - 1]?.offsetMs || 1),
    error: e.status === 'error',
    partial: e.status === 'partial',
    cat: e.category,
  }));
}

export function TrajectoryPanel({ session, selectedEventId, onSelectEvent }: {
  session: Session;
  selectedEventId: string | null;
  onSelectEvent: (e: TrajectoryEvent) => void;
}) {
  const [catFilter, setCatFilter] = useState<EventCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'issues'>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    return session.events.filter((e) => {
      if (catFilter !== 'all' && e.category !== catFilter) return false;
      if (statusFilter === 'issues' && e.status === 'ok') return false;
      if (query) {
        const q = query.toLowerCase();
        const hay = `${e.title} ${e.summary} ${e.producer} ${e.fields.map((f) => f.value).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [session, catFilter, statusFilter, query]);

  const compact = compactBarData(session.events);
  const last = session.events[session.events.length - 1];

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-700/60 px-4 py-2">
        <div className="flex flex-wrap gap-1">
          {categories.map((c) => {
            const active = catFilter === c;
            const color = c === 'all' ? null : categoryColor[c as EventCategory];
            return (
              <button
                key={c}
                onClick={() => setCatFilter(c)}
                aria-pressed={active}
                className={`rounded-[3px] border px-1.5 py-0.5 font-mono text-[10px] tracking-wider transition-colors ${
                  active
                    ? color
                      ? `${color.text} ${color.border} ${color.bg}`
                      : 'border-teal-accent/50 bg-teal-accent/10 text-teal-accent'
                    : 'border-ink-600/60 text-ink-400 hover:border-ink-500 hover:text-ink-200'
                }`}
              >
                {c === 'all' ? 'ALL' : color?.label}
              </button>
            );
          })}
        </div>
        <div className="mx-1 h-4 w-px bg-ink-700" />
        <button
          onClick={() => setStatusFilter(statusFilter === 'all' ? 'issues' : 'all')}
          aria-pressed={statusFilter === 'issues'}
          className={`rounded-[3px] border px-1.5 py-0.5 font-mono text-[10px] tracking-wider transition-colors ${
            statusFilter === 'issues'
              ? 'border-amber-accent/50 bg-amber-accent/10 text-amber-accent'
              : 'border-ink-600/60 text-ink-400 hover:border-ink-500 hover:text-ink-200'
          }`}
        >
          ERRORS / PARTIAL
        </button>
        <div className="ml-auto flex items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(ev) => setQuery(ev.target.value)}
            placeholder="Filter events…"
            aria-label="Filter events"
            className="w-44 rounded-[4px] border border-ink-600/70 bg-ink-850 px-2 py-1 font-mono text-2xs text-ink-100 placeholder:text-ink-500 focus:border-teal-accent/50 focus:outline-none"
          />
        </div>
      </div>

      {/* compact structure bar */}
      <div className="border-b border-ink-700/60 px-4 py-2.5" aria-hidden>
        <div className="relative h-5">
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-ink-700" />
          {compact.map((c) => (
            <div
              key={c.seq}
              className="absolute top-1/2 -translate-y-1/2"
              style={{ left: `calc(${(c.pct * 100).toFixed(2)}% )` }}
            >
              <span
                className={`block h-2.5 w-[3px] rounded-full ${
                  c.error ? 'bg-red-accent' : c.partial ? 'bg-amber-accent' : categoryColor[c.cat].dot
                }`}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between font-mono text-[9px] text-ink-500">
          <span>seq 1</span>
          <span>{fmtOffset(last?.offsetMs ?? 0)} span</span>
          <span>seq {last?.seq}</span>
        </div>
      </div>

      {/* event list */}
      <ol className="min-h-0 flex-1 overflow-y-auto scrollbar-thin py-1">
        {filtered.map((e) => {
          const color = categoryColor[e.category];
          const selected = e.id === selectedEventId;
          return (
            <li key={e.id}>
              <button
                onClick={() => onSelectEvent(e)}
                aria-pressed={selected}
                className={`flex w-full items-start gap-3 border-l-2 px-4 py-2 text-left transition-colors ${
                  selected
                    ? 'border-l-teal-accent bg-ink-800'
                    : 'border-l-transparent hover:bg-ink-850'
                }`}
              >
                <span className="w-14 shrink-0 pt-0.5 text-right font-mono text-2xs text-ink-400 tnum">
                  {fmtClock(e.at)}
                </span>
                <span className="w-10 shrink-0 pt-0.5 font-mono text-2xs text-ink-500 tnum">
                  #{e.seq}
                </span>
                <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${color.dot}`} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className={`truncate text-2xs font-medium ${selected ? 'text-ink-50' : 'text-ink-100'}`}>
                      {e.title}
                    </span>
                    <span className={`shrink-0 font-mono text-[9px] tracking-widest ${color.text}`}>
                      {color.label}
                    </span>
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-ink-500">
                      {e.producer}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-2xs text-ink-400">{e.summary}</span>
                </span>
                <span className="shrink-0 pt-0.5">
                  <StatusChip status={e.status} />
                </span>
              </button>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="px-4 py-6 text-center font-mono text-2xs text-ink-400">
            No events match the current filters.
          </li>
        )}
      </ol>

      <div className="flex items-center justify-between border-t border-ink-700/60 px-4 py-1.5 font-mono text-[10px] text-ink-500">
        <span>
          {filtered.length} of {session.events.length} records shown
        </span>
        <span>storage order</span>
      </div>
    </div>
  );
}
