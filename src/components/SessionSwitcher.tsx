import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import type { Session } from '../domain/types';
import { sessionStateMeta } from '../state/meta';
import { Badge } from '../ui/layout';

/**
 * Chooses a recorded session. A menu-button + listbox (not a bare <select>) so each choice can say what the session is:
 * its scenario, its recorded state, and how many events it holds. Arrow keys, Home/End, Enter/Space and Escape work;
 * focus returns to the button on close.
 */
export function SessionSwitcher({ sessions, value, onChange, label = 'Recorded session' }: {
  sessions: Session[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = sessions.find((s) => s.id === value) ?? sessions[0];

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    setCursor(Math.max(0, sessions.findIndex((s) => s.id === value)));
    listRef.current?.focus();
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onPointer);
    return () => window.removeEventListener('mousedown', onPointer);
  }, [open, sessions, value]);

  const choose = (id: string) => {
    onChange(id);
    close(true);
  };

  const onListKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(sessions.length - 1, c + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setCursor(0); }
    else if (e.key === 'End') { e.preventDefault(); setCursor(sessions.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(sessions[cursor].id); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
    else if (e.key === 'Tab') close(false);
  };

  if (!current) return null;
  const st = sessionStateMeta[current.state];

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${label}: ${current.id}`}
        onClick={() => setOpen((o) => !o)}
        className="group flex h-9 max-w-full items-center gap-2.5 rounded-ctl border border-line bg-surface-2 pl-3 pr-2 text-left transition-colors duration-100 hover:border-line-strong"
      >
        <span className="font-mono text-xs font-medium text-fg-1">{current.id}</span>
        <span className="hidden min-w-0 truncate text-xs text-fg-2 md:inline">{current.label}</span>
        <span className={`hidden shrink-0 rounded-tag border px-1.5 font-mono text-2xs tracking-wider lg:inline ${st.text} ${st.border} ${st.bg}`}>{st.label}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-fg-3 group-hover:text-fg-1" aria-hidden />
      </button>

      {open && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`${listId}-${cursor}`}
          onKeyDown={onListKey}
          className="absolute left-0 top-full z-30 mt-1.5 w-[min(560px,92vw)] overflow-hidden rounded-panel border border-line-strong bg-surface-1 shadow-pop"
        >
          <div className="border-b border-line px-3 py-2 eyebrow">Recorded sessions · synthetic fixtures</div>
          <ul className="max-h-[60vh] overflow-y-auto scrollbar-thin py-1">
            {sessions.map((s, i) => {
              const m = sessionStateMeta[s.state];
              const selected = s.id === value;
              return (
                <li
                  key={s.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => choose(s.id)}
                  className={`flex cursor-pointer items-start gap-3 px-3 py-2 ${i === cursor ? 'bg-surface-3' : ''}`}
                >
                  <Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${selected ? 'text-fg-1' : 'text-transparent'}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-medium text-fg-1">{s.id}</span>
                      <span className={`rounded-tag border px-1.5 font-mono text-2xs tracking-wider ${m.text} ${m.border} ${m.bg}`}>{m.label}</span>
                      <Badge title="Events recorded in this session">{s.events.length} events</Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-fg-1">{s.label}</div>
                    <div className="mt-0.5 text-2xs leading-snug text-fg-3">{s.scenario}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
