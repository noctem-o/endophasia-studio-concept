import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { EvidenceItem, Source } from '../domain/types';
import { evidenceMeta } from '../state/meta';
import { ProvTag, SourceConditionTag } from '../ui/marks';

/**
 * Evidence as a stack of records. Each carries its provenance class (shape + hue), what it says, and — expanded — WHY it has that
 * class: the declared derivation for DER, the stated reason for N/A, and for anything with a source, that source's own recorded
 * condition looked up in the session's source ledger (never a generic sentence). Derived and unavailable items start open,
 * because their explanation is the content.
 */
export function EvidenceList({ items, sources = [] }: { items: EvidenceItem[]; sources?: Source[] }) {
  if (items.length === 0) {
    return <p className="rounded-ctl border border-line bg-surface-2 px-3 py-2 font-mono text-2xs text-fg-3">no evidence items are attached to this record</p>;
  }
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <EvidenceRow key={i} item={item} source={item.sourceId ? sources.find((s) => s.id === item.sourceId) : undefined} />
      ))}
    </ul>
  );
}

function EvidenceRow({ item, source }: { item: EvidenceItem; source?: Source }) {
  const m = evidenceMeta[item.kind];
  const expandable = Boolean(item.sourceId || item.process || item.reason);
  const [open, setOpen] = useState(item.kind === 'DER' || item.kind === 'NA');

  return (
    <li className="relative overflow-hidden rounded-ctl border border-line bg-surface-2">
      <span aria-hidden className={`absolute inset-y-0 left-0 w-0.5 ${m.fill}`} />
      <div className="flex items-center gap-2 py-2 pl-3.5 pr-2.5">
        <ProvTag kind={item.kind} />
        <span className="min-w-0 flex-1 text-xs font-medium text-fg-1">{item.label}</span>
        {item.sourceId && <span className="shrink-0 font-mono text-2xs text-fg-3" title="Independent source this item was read from">{item.sourceId}</span>}
        {expandable && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={`${open ? 'Hide' : 'Show'} why this is ${m.full.toLowerCase()}`}
            className="shrink-0 rounded-tag p-0.5 text-fg-3 hover:text-fg-1"
          >
            <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-100 ${open ? 'rotate-90' : ''}`} aria-hidden />
          </button>
        )}
      </div>
      <p className="pb-2 pl-3.5 pr-3 text-xs leading-relaxed text-fg-2">{item.detail}</p>

      {open && (
        <div className="space-y-2 border-t border-line-subtle bg-surface-1 py-2 pl-3.5 pr-3">
          {item.kind === 'DER' && item.process && <Reason label="declared derivation" body={item.process} />}
          {item.kind === 'NA' && item.reason && <Reason label="reason unavailable" body={item.reason} />}
          {item.sourceId && (
            <div>
              <div className="eyebrow">source</div>
              {source ? (
                <div className="mt-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-fg-1">{source.name}</span>
                    <span className="font-mono text-2xs text-fg-3">{source.id} · {source.kind}</span>
                    <SourceConditionTag condition={source.condition} />
                  </div>
                  <p className="text-xs leading-relaxed text-fg-3">{source.note}</p>
                </div>
              ) : (
                <p className="mt-1 text-xs leading-relaxed text-fg-3">
                  Read from <span className="font-mono text-fg-2">{item.sourceId}</span>; this view has no ledger entry for it, so its condition is not shown.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function Reason({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <p className="mt-1 font-mono text-2xs leading-relaxed text-fg-2">{body}</p>
    </div>
  );
}
