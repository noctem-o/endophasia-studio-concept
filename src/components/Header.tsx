import { Activity, FlaskConical } from 'lucide-react';
import type { Session } from '@/data/types';

export function Header({ sessions, activeId, onSelect }: {
  sessions: Session[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <header className="shrink-0 border-b border-ink-700/70 bg-ink-900">
      <div className="flex items-center gap-4 px-4 h-12">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-[4px] border border-teal-accent/40 bg-teal-accent/10">
            <Activity className="h-3.5 w-3.5 text-teal-accent" strokeWidth={2} />
          </div>
          <div className="leading-none">
            <div className="text-[13px] font-semibold tracking-tight text-ink-50">Endophasia Studio</div>
            <div className="mt-0.5 font-mono text-[10px] tracking-wider text-ink-400">OBSERVATION WORKSPACE</div>
          </div>
        </div>

        <div className="mx-2 h-6 w-px bg-ink-700" />

        <nav aria-label="Recorded sessions" className="flex items-center gap-1">
          <span className="mr-1 font-mono text-2xs uppercase tracking-widest text-ink-400">Session</span>
          {sessions.map((s) => {
            const active = s.id === activeId;
            return (
              <button
                key={s.id}
                onClick={() => onSelect(s.id)}
                aria-pressed={active}
                title={s.label}
                className={`max-w-[220px] truncate rounded-[4px] border px-2.5 py-1 font-mono text-2xs transition-colors ${
                  active
                    ? 'border-teal-accent/50 bg-teal-accent/10 text-teal-accent'
                    : 'border-ink-600/60 text-ink-300 hover:border-ink-500 hover:bg-ink-750 hover:text-ink-100'
                }`}
              >
                {s.id}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden font-mono text-2xs text-ink-400 lg:inline">
            observation only — no interventions from this surface
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-[3px] border border-amber-accent/40 bg-amber-accent/8 px-2 py-1 font-mono text-2xs font-semibold tracking-widest text-amber-accent">
            <FlaskConical className="h-3 w-3" aria-hidden />
            DEMONSTRATION DATA
          </span>
        </div>
      </div>
    </header>
  );
}
