import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { StructuredValue } from '../domain/types';

interface JsonTreeProps {
  value: StructuredValue;
  label?: string;
  rootOpen?: boolean;
}

/** A structured record, verbatim. Values are neutral on purpose: a string is not "observed" and a number is not "reported",
 *  so syntax takes no provenance hue. Type is carried by form (quotes, tabular numerals, dimmed null). */
export function JsonTree({ value, label, rootOpen = true }: JsonTreeProps) {
  return (
    <div className="rounded-ctl border border-line bg-surface-2 px-3 py-2.5">
      <Node label={label} value={value} depth={0} open={rootOpen} />
    </div>
  );
}

function Node({ label, value, depth, open: initialOpen }: { label?: string; value: StructuredValue; depth: number; open: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  const isArray = Array.isArray(value);
  const isObject = !isArray && typeof value === 'object' && value !== null;
  const expandable = isArray || isObject;

  if (!expandable) {
    const cls =
      typeof value === 'string' ? 'text-fg-1' : value === null ? 'text-fg-3 italic' : 'text-fg-2 tnum';
    const display = value === null ? 'null' : typeof value === 'string' ? `"${value}"` : String(value);
    return (
      <div className="flex gap-2 py-px" style={{ paddingLeft: depth * 14 }}>
        {label !== undefined && <span className="shrink-0 font-mono text-2xs text-fg-3">{label}:</span>}
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
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1 py-px text-left hover:text-fg-1"
      >
        <ChevronRight aria-hidden className={`h-3 w-3 shrink-0 text-fg-3 transition-transform duration-100 ${open ? 'rotate-90' : ''}`} />
        {label !== undefined && <span className="font-mono text-2xs text-fg-3">{label}:</span>}
        <span className="font-mono text-2xs text-fg-3">{isArray ? `Array(${entries.length})` : `Object(${entries.length})`}</span>
      </button>
      {open && (
        <div className="ml-1.5 border-l border-line">
          {entries.map(([k, v]) => (
            <Node key={k} label={k} value={v} depth={0} open={false} />
          ))}
        </div>
      )}
    </div>
  );
}
