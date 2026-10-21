import { useState } from 'react';
import type { StructuredValue } from '../domain/types';

interface JsonTreeProps {
  value: StructuredValue;
  label?: string;
  rootOpen?: boolean;
}

export function JsonTree({ value, label, rootOpen = true }: JsonTreeProps) {
  return <Node label={label} value={value} depth={0} open={rootOpen} />;
}

function Node({ label, value, depth, open: initialOpen }: { label?: string; value: StructuredValue; depth: number; open: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  const isArray = Array.isArray(value);
  const isObject = !isArray && typeof value === 'object' && value !== null;
  const expandable = isArray || isObject;

  if (!expandable) {
    const cls =
      typeof value === 'string'
        ? 'text-teal-accent/90'
        : typeof value === 'number'
          ? 'text-blue-accent'
          : typeof value === 'boolean'
            ? 'text-amber-accent'
            : 'text-ink-400';
    const display = value === null ? 'null' : typeof value === 'string' ? `"${value}"` : String(value);
    return (
      <div className="flex gap-2 py-px" style={{ paddingLeft: depth * 14 }}>
        {label !== undefined && <span className="shrink-0 font-mono text-2xs text-ink-300">{label}:</span>}
        <span className={`break-all font-mono text-2xs ${cls}`}>{display}</span>
      </div>
    );
  }

  const entries: [string, StructuredValue][] = isArray
    ? (value as StructuredValue[]).map((v, i) => [String(i), v])
    : Object.entries(value as Record<string, StructuredValue>);

  return (
    <div style={{ paddingLeft: depth > 0 ? 14 : 0 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 py-px text-left hover:text-ink-100"
      >
        <span aria-hidden className="w-3 shrink-0 font-mono text-2xs text-ink-400">{open ? '−' : '+'}</span>
        {label !== undefined && <span className="font-mono text-2xs text-ink-300">{label}:</span>}
        <span className="font-mono text-2xs text-ink-400">
          {isArray ? `Array(${entries.length})` : `Object(${entries.length})`}
        </span>
      </button>
      {open && (
        <div className="border-l border-ink-700/60">
          {entries.map(([k, v]) => (
            <Node key={k} label={k} value={v} depth={0} open={false} />
          ))}
        </div>
      )}
    </div>
  );
}
