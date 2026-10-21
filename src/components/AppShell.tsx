import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Keyboard, Lock } from 'lucide-react';
import type { WorkspaceId } from '../state/studio';
import { WORKSPACES } from '../state/workspaces';
import { BrandMark, SyntheticTag } from '../ui/marks';
import { Kbd } from '../ui/controls';

export function AppHeader({ workspace, onWorkspace, onHelp }: {
  workspace: WorkspaceId;
  onWorkspace: (w: WorkspaceId) => void;
  onHelp: () => void;
}) {
  return (
    <header className="shrink-0 border-b border-line bg-surface-1">
      <div className="flex h-12 items-stretch gap-6 px-4">
        <div className="flex items-center gap-2.5">
          <BrandMark />
          <div className="leading-none">
            <div className="text-sm font-semibold tracking-tight text-fg-1">Endophasia <span className="font-normal text-fg-3">Studio</span></div>
          </div>
        </div>

        <nav aria-label="Workspaces" className="flex items-stretch gap-1">
          {WORKSPACES.map(({ id, label, key, icon: Icon, blurb }) => {
            const active = workspace === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onWorkspace(id)}
                aria-pressed={active}
                aria-keyshortcuts={key}
                title={`${blurb} (${key})`}
                className={`relative flex items-center gap-1.5 px-3 text-xs font-medium transition-colors duration-100 ${active ? 'text-fg-1' : 'text-fg-3 hover:text-fg-1'}`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {label}
                <span aria-hidden className="ml-0.5 font-mono text-2xs text-fg-4">{key}</span>
                <span aria-hidden className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-select transition-opacity duration-100 ${active ? 'opacity-100' : 'opacity-0'}`} />
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden items-center gap-1.5 font-mono text-2xs text-fg-3 lg:inline-flex" title="This surface only observes. It cannot start, steer, write to or change anything.">
            <Lock className="h-3 w-3" aria-hidden />
            read-only
          </span>
          <SyntheticTag />
          <button
            type="button"
            onClick={onHelp}
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
            className="inline-flex h-7 w-7 items-center justify-center rounded-ctl border border-line text-fg-3 transition-colors duration-100 hover:border-line-strong hover:bg-surface-2 hover:text-fg-1"
          >
            <Keyboard className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </header>
  );
}

/** The band every workspace opens with: where you are, and the controls that change it. One height, one anatomy. */
export function WorkspaceBar({ children, actions, className = '' }: { children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={`flex min-h-[52px] shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface-1 px-4 py-2 ${className}`}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">{children}</div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function AppStatusBar({ context }: { context: ReactNode }) {
  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-line bg-surface-1 px-4 font-mono text-2xs text-fg-3">
      <span className="min-w-0 truncate text-fg-2" aria-live="polite">{context}</span>
      <span className="ml-auto hidden shrink-0 md:inline">all data is synthetic · nothing is connected to a runtime</span>
      <span className="hidden shrink-0 items-center gap-1 lg:inline-flex"><Kbd>?</Kbd> shortcuts</span>
    </footer>
  );
}

// ─── Keyboard shortcut sheet ─────────────────────────────────────────────────

const SHORTCUTS: { group: string; rows: { keys: string[]; what: string }[] }[] = [
  { group: 'Everywhere', rows: [
    { keys: ['1', '2', '3', '4'], what: 'Switch workspace' },
    { keys: ['?'], what: 'This sheet' },
    { keys: ['/'], what: 'Focus the search field' },
  ] },
  { group: 'Observe', rows: [
    { keys: ['j', '↓'], what: 'Next event in the filtered list' },
    { keys: ['k', '↑'], what: 'Previous event in the filtered list' },
    { keys: ['Esc'], what: 'Clear the selection' },
  ] },
  { group: 'Lineage graph (focus it first)', rows: [
    { keys: ['←', '→', '↑', '↓'], what: 'Move the selection' },
    { keys: ['f'], what: 'Focus the selected execution’s lineage' },
    { keys: ['0'], what: 'Fit the whole graph' },
  ] },
];

export function ShortcutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    } else if (!open && d.open) {
      if (typeof d.close === 'function') d.close();
      else d.removeAttribute('open');
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      aria-label="Keyboard shortcuts"
      className="w-[min(520px,92vw)] rounded-panel border border-line-strong bg-surface-1 p-0 text-fg-1 shadow-pop backdrop:bg-black/60"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-sm font-medium">Keyboard shortcuts</h2>
        <button type="button" onClick={onClose} className="rounded-ctl border border-line px-2 py-1 font-mono text-2xs text-fg-2 hover:border-line-strong hover:text-fg-1">close · Esc</button>
      </div>
      <div className="space-y-4 px-4 py-4">
        {SHORTCUTS.map((g) => (
          <section key={g.group}>
            <h3 className="eyebrow mb-1.5">{g.group}</h3>
            <ul className="space-y-1.5">
              {g.rows.map((r) => (
                <li key={r.what} className="flex items-center gap-3 text-xs text-fg-2">
                  <span className="flex w-[128px] shrink-0 flex-wrap gap-1">{r.keys.map((k) => <Kbd key={k}>{k}</Kbd>)}</span>
                  {r.what}
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="border-t border-line-subtle pt-3 text-2xs leading-relaxed text-fg-3">
          Number keys and <Kbd>?</Kbd> are ignored while you are typing in a field, and when Ctrl, Alt or ⌘ is held.
        </p>
      </div>
    </dialog>
  );
}
