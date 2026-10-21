import { useCallback, useRef } from 'react';
import type { KeyboardEvent, ReactNode, Ref } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

/** Press/selection convention, used by every toggle in the app: a pressed control is a lifted surface with ivory text.
 *  It is never a hue — hue is reserved for provenance, attention and fault. */
const pressed = 'border-line-strong bg-surface-3 text-fg-1';
const rest = 'border-line text-fg-3 hover:border-line-strong hover:bg-surface-2 hover:text-fg-1';

export function Chip({ active, onClick, children, title, className = '', leading }: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  title?: string;
  className?: string;
  leading?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={`inline-flex h-6 items-center gap-1.5 rounded-tag border px-2 font-mono text-2xs font-medium tracking-wide transition-colors duration-100 ${active ? pressed : rest} ${className}`}
    >
      {leading}
      {children}
    </button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-tag border border-line-strong bg-surface-2 px-1 font-mono text-2xs text-fg-2">
      {children}
    </kbd>
  );
}

export function IconButton({ label, onClick, children, active, className = '' }: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-ctl border transition-colors duration-100 ${active ? pressed : rest} ${className}`}
    >
      {children}
    </button>
  );
}

export function Button({ onClick, children, disabled, active, title, className = '', leading }: {
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  active?: boolean;
  title?: string;
  className?: string;
  leading?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={`inline-flex h-7 items-center gap-1.5 rounded-ctl border px-2.5 font-mono text-2xs font-medium tracking-wide transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-40 ${active ? pressed : rest} ${className}`}
    >
      {leading}
      {children}
    </button>
  );
}

export function SearchField({ value, onChange, placeholder, label, inputRef, className = '' }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
  inputRef?: Ref<HTMLInputElement>;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-3" aria-hidden />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-7 w-full rounded-ctl border border-line bg-surface-2 pl-7 pr-7 text-xs text-fg-1 placeholder:text-fg-3 hover:border-line-strong focus:border-line-strong"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Clear search" className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-tag p-0.5 text-fg-3 hover:text-fg-1">
          <X className="h-3 w-3" aria-hidden />
        </button>
      )}
    </div>
  );
}

/** A native <select> (so it is keyboard- and screen-reader-complete for free), dressed to match. */
export function SelectField({ label, value, onChange, children, className = '', showLabel = true }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  className?: string;
  showLabel?: boolean;
}) {
  return (
    <label className={`inline-flex items-center gap-2 ${className}`}>
      {showLabel && <span className="eyebrow">{label}</span>}
      <span className="relative inline-flex">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="h-7 max-w-[300px] appearance-none rounded-ctl border border-line bg-surface-2 py-0 pl-2 pr-7 font-mono text-2xs text-fg-1 hover:border-line-strong focus:border-line-strong"
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-fg-3" aria-hidden />
      </span>
    </label>
  );
}

export function Segmented<T extends string>({ label, value, onChange, options }: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; title?: string }[];
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-ctl border border-line bg-surface-1 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          title={o.title}
          className={`h-6 rounded-tag px-2.5 font-mono text-2xs font-medium tracking-wide transition-colors duration-100 ${value === o.value ? 'bg-surface-3 text-fg-1' : 'text-fg-3 hover:text-fg-1'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Underlined tabs with roving focus and arrow-key movement (WAI-ARIA tabs pattern). */
export function Tabs<T extends string>({ label, value, onChange, tabs, idPrefix }: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  tabs: { value: T; label: ReactNode; count?: number }[];
  idPrefix: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKeyDown = useCallback((e: KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.value === value);
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next >= 0) {
      e.preventDefault();
      onChange(tabs[next].value);
      refs.current[tabs[next].value]?.focus();
    }
  }, [tabs, value, onChange]);

  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex items-end gap-5">
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            ref={(el) => { refs.current[t.value] = el; }}
            role="tab"
            id={`${idPrefix}-tab-${t.value}`}
            aria-selected={on}
            aria-controls={`${idPrefix}-panel`}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={`relative -mb-px h-9 border-b-2 px-0.5 text-xs font-medium transition-colors duration-100 ${on ? 'border-select text-fg-1' : 'border-transparent text-fg-3 hover:text-fg-1'}`}
          >
            {t.label}
            {t.count !== undefined && <span className="ml-1.5 font-mono text-2xs text-fg-3 tnum">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
