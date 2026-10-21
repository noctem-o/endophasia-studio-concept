import type { Source } from '@/data/types';
import { SourceConditionChip } from './primitives';

export function SourcesPanel({ sources }: { sources: Source[] }) {
  return (
    <div className="px-4 py-3">
      <p className="mb-3 text-2xs leading-relaxed text-ink-400">
        Independent evidence sources, reported per source. Conditions are not combined into an
        overall health score.
      </p>
      <ul className="space-y-1.5">
        {sources.map((s) => (
          <li
            key={s.id}
            className="rounded-[4px] border border-ink-700/70 bg-ink-850/50 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-mono text-2xs font-medium text-ink-100">
                {s.name}
              </span>
              <span className="shrink-0 font-mono text-[9px] text-ink-500">{s.kind}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <SourceConditionChip condition={s.condition} />
              {typeof s.records === 'number' ? (
                <span className="font-mono text-[10px] text-ink-300 tnum">{s.records} records</span>
              ) : (
                <span className="font-mono text-[10px] text-ink-500">Not recorded</span>
              )}
            </div>
            <p className="mt-1.5 text-2xs leading-snug text-ink-400">{s.note}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
