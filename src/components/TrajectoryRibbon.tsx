import { useEffect, useRef } from 'react';
import type { TrajectoryEvent } from '../domain/types';
import { categoryMeta } from '../state/meta';

export function TrajectoryRibbon({ events, selectedId, onSelect }: {
  events: TrajectoryEvent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selectedId]);

  return (
    <div className="shrink-0 border-t border-ink-700/70 bg-ink-900/60 px-4 py-3" aria-label="Trajectory ribbon">
      <div className="mb-1.5 flex items-center gap-3 font-mono text-2xs uppercase tracking-widest text-ink-500">
        <span>trajectory</span>
        <span className="text-ink-600">{events.length} shown</span>
        <span className="ml-auto hidden text-ink-600 md:inline">click to select · ↑↓ or j/k to navigate</span>
      </div>
      <div className="flex h-10 items-stretch gap-[3px] overflow-x-auto pb-1">
        {events.map((event) => {
          const cm = categoryMeta[event.category];
          const selected = event.id === selectedId;
          const statusTint =
            event.status === 'error'
              ? 'bg-red-accent/25'
              : event.status === 'partial'
                ? 'bg-amber-accent/20'
                : 'bg-ink-700/50';
          return (
            <button
              key={event.id}
              ref={selected ? selectedRef : undefined}
              onClick={() => onSelect(event.id)}
              aria-label={`seq ${event.seq}: ${event.title}`}
              aria-current={selected ? 'true' : undefined}
              title={`seq ${event.seq} · ${event.title} · ${event.status}`}
              style={{ flexBasis: '20px', minWidth: '12px' }}
              className={`group relative min-w-[12px] shrink-0 grow rounded-[3px] border transition-all ${
                event.category === 'intervention' ? 'border-dashed ' : ''
              }${
                selected
                  ? 'border-teal-accent bg-teal-accent/30 ring-1 ring-teal-accent/60'
                  : `${cm.border} ${statusTint} hover:brightness-125`
              }`}
            >
              <span className="pointer-events-none absolute inset-x-0 bottom-0 text-center font-mono text-[8px] leading-none text-ink-400 opacity-0 transition-opacity group-hover:opacity-100">
                {event.seq}
              </span>
              <span
                aria-hidden
                className={`pointer-events-none absolute left-1/2 top-1 h-1 w-1 -translate-x-1/2 rounded-full ${cm.dot}`}
              />
            </button>
          );
        })}
        {events.length === 0 && (
          <span className="font-mono text-2xs text-ink-500">no events to display</span>
        )}
      </div>
    </div>
  );
}
