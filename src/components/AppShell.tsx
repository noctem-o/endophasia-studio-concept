import { Activity, FlaskConical, GitCompareArrows, Microscope, Boxes } from 'lucide-react';
import type { Session } from '../domain/types';
import { sessionStateMeta } from '../state/meta';
import type { WorkspaceId } from '../state/studio';

const WORKSPACES: { id: WorkspaceId; label: string; icon: typeof Microscope }[] = [
  { id: 'observe', label: 'Observe', icon: Microscope },
  { id: 'compare', label: 'Compare', icon: GitCompareArrows },
  { id: 'capabilities', label: 'Capabilities', icon: Boxes },
];

export function AppHeader({ sessions, activeSession, workspace, onWorkspace, onSelectSession }: {
  sessions: Session[];
  activeSession: Session;
  workspace: WorkspaceId;
  onWorkspace: (w: WorkspaceId) => void;
  onSelectSession: (id: string) => void;
}) {
  const stateMeta = sessionStateMeta[activeSession.state];

  return (
    <header className="shrink-0 border-b border-ink-700/70 bg-ink-900">
      <div className="flex h-12 items-center gap-4 px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-[4px] border border-teal-accent/40 bg-teal-accent/10">
            <Activity className="h-3.5 w-3.5 text-teal-accent" strokeWidth={2} />
          </div>
          <div className="leading-none">
            <div className="text-[13px] font-semibold tracking-tight text-ink-50">Endophasia Studio</div>
            <div className="mt-0.5 font-mono text-[10px] tracking-wider text-ink-400">OBSERVATION WORKSPACE · CONCEPT</div>
          </div>
        </div>

        <div className="mx-1 h-6 w-px bg-ink-700" />

        <nav aria-label="Workspaces" className="flex items-center gap-1">
          {WORKSPACES.map(({ id, label, icon: Icon }) => {
            const active = workspace === id;
            return (
              <button
                key={id}
                onClick={() => onWorkspace(id)}
                aria-pressed={active}
                className={`flex items-center gap-1.5 rounded-[4px] px-2.5 py-1.5 font-mono text-2xs uppercase tracking-widest transition-colors ${
                  active
                    ? 'bg-ink-750 text-ink-50'
                    : 'text-ink-400 hover:bg-ink-800 hover:text-ink-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="mx-1 h-6 w-px bg-ink-700" />

        <label className="flex items-center gap-2">
          <span className="font-mono text-2xs uppercase tracking-widest text-ink-400">Session</span>
          <select
            value={activeSession.id}
            onChange={(e) => onSelectSession(e.target.value)}
            aria-label="Recorded session"
            className="max-w-[260px] rounded-[4px] border border-ink-600/70 bg-ink-850 px-2 py-1 font-mono text-2xs text-ink-100 focus:border-teal-accent/50 focus:outline-none"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id} — {s.label}
              </option>
            ))}
          </select>
        </label>

        <span className={`hidden shrink-0 rounded-[3px] border px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-widest sm:inline ${stateMeta.text} ${stateMeta.border} ${stateMeta.bg}`}>
          {stateMeta.label}
        </span>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden font-mono text-2xs text-ink-400 xl:inline">
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

export function AppFooter() {
  return (
    <footer className="flex shrink-0 items-center gap-4 border-t border-ink-700/70 bg-ink-900 px-4 py-1.5 font-mono text-[10px] text-ink-500">
      <span>endophasia studio — design exploration</span>
      <span aria-hidden className="hidden h-3 w-px bg-ink-700 sm:block" />
      <span className="hidden text-amber-accent/80 md:inline">all data is synthetic; not connected to a real runtime</span>
      <span className="ml-auto hidden lg:inline">read-only surface · provenance-first</span>
    </footer>
  );
}
