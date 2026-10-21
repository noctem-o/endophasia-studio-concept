import type { Source } from '../../domain/types';
import { sourceMeta } from '../../state/meta';
import { SourceConditionTag, SourceGlyph } from '../../ui/marks';

/**
 * The independent sources behind a session's records, each with the condition it was found in. Selecting one filters the matrix
 * to the capabilities whose evidence cites it, so "this source was degraded" can be followed to everything resting on it.
 */
export function SourceLedger({ sources, active, citedCount, onToggle }: {
  sources: Source[];
  active: string | null;
  citedCount: (sourceId: string) => number;
  onToggle: (id: string) => void;
}) {
  const open = sources.find((s) => s.id === active) ?? null;
  return (
    <section aria-label="Source ledger" className="border-b border-line bg-surface-1 px-4 py-3">
      <div className="mb-2 flex items-baseline gap-3">
        <h2 className="eyebrow">Source ledger</h2>
        <span className="text-2xs text-fg-3">The records come from these independent sources. Select one to see which capabilities rest on it.</span>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {sources.map((s) => {
          const m = sourceMeta[s.condition];
          const on = s.id === active;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onToggle(s.id)}
                aria-pressed={on}
                className={`relative flex h-full w-full flex-col rounded-ctl border px-2.5 py-2 text-left transition-colors duration-100 ${on ? 'border-line-strong bg-surface-3' : 'border-line bg-surface-2 hover:border-line-strong'} ${s.condition === 'absent' ? 'border-dashed' : ''}`}
              >
                {on && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 rounded-l-ctl bg-select" />}
                <span className="flex items-center gap-2">
                  <SourceGlyph condition={s.condition} size={11} />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-fg-1">{s.name}</span>
                </span>
                <span className="mt-1.5 flex items-center gap-2">
                  <SourceConditionTag condition={s.condition} />
                  <span className="font-mono text-2xs text-fg-3 tnum">{s.records !== undefined ? `${s.records} rec` : '—'}</span>
                </span>
                <span className="mt-1 font-mono text-2xs text-fg-3">{s.id} · cited by {citedCount(s.id)}</span>
                <span className="sr-only">{m.desc}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {open && (
        <p className="mt-2 rounded-ctl border border-line bg-surface-2 px-3 py-2 text-xs leading-relaxed text-fg-2">
          <span className="font-mono text-2xs text-fg-3">{open.id} · {open.kind} — </span>{open.note}
        </p>
      )}
    </section>
  );
}
