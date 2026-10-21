import { useState } from 'react';
import { ChevronRight, Copy, MinusSquare, PlusSquare } from 'lucide-react';
import { evidenceKindMeta } from '@/data/sessions';
import type { EvidenceItem, StructuredValue, TrajectoryEvent } from '@/data/types';
import { EvidenceBadge, StatusChip } from './primitives';

function EvidenceRow({ item }: { item: EvidenceItem }) {
  const [open, setOpen] = useState(false);
  const expandable = (item.kind === 'DER' && item.process) || (item.kind === 'NA' && item.reason);
  return (
    <li className="border-b border-ink-800 last:border-b-0">
      <div className="flex items-center gap-2 px-3 py-2">
        <EvidenceBadge kind={item.kind} />
        <span className="min-w-0 flex-1 text-2xs font-medium text-ink-100">{item.label}</span>
        {item.sourceId && (
          <button
            onClick={() => setOpen((o) => !o)}
            className="shrink-0 font-mono text-[10px] text-blue-accent/90 underline decoration-blue-accent/30 underline-offset-2 hover:decoration-blue-accent"
          >
            {item.sourceId}
          </button>
        )}
        {expandable && (
          <button
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="shrink-0 rounded p-0.5 text-ink-400 hover:text-ink-200"
          >
            <ChevronRight className={`h-3 w-3 transition-transform ${open ? 'rotate-90' : ''}`} />
          </button>
        )}
      </div>
      <div className="px-3 pb-2">
        <p className="text-2xs leading-relaxed text-ink-300">{item.detail}</p>
        {open && item.kind === 'DER' && item.process && (
          <div className="mt-1.5 border-l-2 border-amber-accent/40 pl-2">
            <div className="font-mono text-[9px] uppercase tracking-widest text-amber-accent/80">declared process</div>
            <p className="mt-0.5 font-mono text-[10px] leading-relaxed text-amber-accent/90">{item.process}</p>
          </div>
        )}
        {open && item.kind === 'NA' && item.reason && (
          <div className="mt-1.5 border-l-2 border-ink-500 pl-2">
            <div className="font-mono text-[9px] uppercase tracking-widest text-ink-400">reason unavailable</div>
            <p className="mt-0.5 font-mono text-[10px] leading-relaxed text-ink-300">{item.reason}</p>
          </div>
        )}
        {open && item.sourceId && (
          <div className="mt-1.5 border-l-2 border-blue-accent/40 pl-2">
            <div className="font-mono text-[9px] uppercase tracking-widest text-blue-accent/80">provenance</div>
            <p className="mt-0.5 font-mono text-[10px] leading-relaxed text-ink-300">
              read from {item.sourceId} at recording time; content depends on that source's condition
            </p>
          </div>
        )}
      </div>
    </li>
  );
}

function JsonNode({ label, value, depth, defaultOpen }: { label?: string; value: StructuredValue; depth: number; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? depth < 1);
  const isArray = Array.isArray(value);
  const isObject = !isArray && typeof value === 'object' && value !== null;
  const expandable = isArray || isObject;

  if (!expandable) {
    const val = value === null ? 'null' : String(value);
    const cls =
      typeof value === 'string'
        ? 'text-teal-accent/90'
        : typeof value === 'number'
          ? 'text-blue-accent'
          : typeof value === 'boolean'
            ? 'text-amber-accent'
            : 'text-ink-400';
    return (
      <div className="flex gap-2 py-px" style={{ paddingLeft: depth * 14 }}>
        {label !== undefined && <span className="font-mono text-2xs text-ink-300">{label}:</span>}
        <span className={`font-mono text-2xs ${cls} break-all`}>
          {typeof value === 'string' ? `"${val}"` : val}
        </span>
      </div>
    );
  }

  const entries: [string, StructuredValue][] = isArray
    ? value.map((v, i) => [String(i), v])
    : Object.entries(value as Record<string, StructuredValue>);

  return (
    <div style={{ paddingLeft: depth * 14 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 py-px text-left"
      >
        {open ? (
          <MinusSquare className="h-3 w-3 shrink-0 text-ink-400" aria-hidden />
        ) : (
          <PlusSquare className="h-3 w-3 shrink-0 text-ink-400" aria-hidden />
        )}
        {label !== undefined && <span className="font-mono text-2xs text-ink-300">{label}:</span>}
        <span className="font-mono text-2xs text-ink-400">
          {isArray ? `Array(${entries.length})` : `Object(${entries.length})`}
        </span>
      </button>
      {open && (
        <div className="border-l border-ink-700/60">
          {entries.map(([k, v]) => (
            <JsonNode key={k} label={k} value={v} depth={0} defaultOpen={depth < 0} />
          ))}
        </div>
      )}
    </div>
  );
}

export function EventInspector({ event }: { event: TrajectoryEvent | null }) {
  const [tab, setTab] = useState<'fields' | 'evidence' | 'usage'>('fields');

  if (!event) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <div className="font-mono text-2xs uppercase tracking-widest text-ink-400">Evidence inspector</div>
        <p className="max-w-[240px] text-2xs leading-relaxed text-ink-500">
          Select an event from the trajectory or a capability from the inventory to inspect its
          recorded evidence.
        </p>
      </div>
    );
  }

  const hasUsage = !!event.usage;
  const evidenceKinds = new Set(event.evidence.map((e) => e.kind));

  return (
    <div className="flex min-h-0 flex-col">
      <div className="border-b border-ink-700/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-2xs text-ink-400 tnum">#{event.seq}</span>
          <h3 className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink-50">{event.title}</h3>
          <StatusChip status={event.status} />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-ink-400">
          <span>{event.at}</span>
          <span>offset {event.offsetMs} ms</span>
          <span>producer: {event.producer}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-ink-700/60 px-3 py-1.5">
        {(
          [
            ['fields', `Fields ${event.fields.length ? `(${event.fields.length})` : ''}`],
            ['evidence', `Evidence (${event.evidence.length})`],
            ['usage', hasUsage ? 'Usage' : 'Usage — N/A'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={`rounded-[3px] px-2 py-1 font-mono text-2xs tracking-wide transition-colors ${
              tab === key ? 'bg-ink-700 text-ink-50' : 'text-ink-400 hover:bg-ink-800 hover:text-ink-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {tab === 'fields' && (
          <div>
            <p className="px-4 py-2.5 text-2xs leading-relaxed text-ink-300">{event.summary}</p>
            {event.fields.length > 0 && (
              <dl className="mx-4 mb-3 overflow-hidden rounded-[4px] border border-ink-700/70">
                {event.fields.map((f, i) => (
                  <div
                    key={f.key}
                    className={`flex items-baseline gap-3 px-3 py-1.5 ${i % 2 === 0 ? 'bg-ink-850/60' : 'bg-ink-900/40'}`}
                  >
                    <dt className="w-36 shrink-0 font-mono text-2xs text-ink-400">{f.key}</dt>
                    <dd className={`min-w-0 break-all text-2xs text-ink-100 ${f.mono !== false ? 'font-mono' : ''}`}>
                      {f.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {event.structured && (
              <div className="mx-4 mb-4 rounded-[4px] border border-ink-700/70 bg-ink-900/50">
                <div className="flex items-center justify-between border-b border-ink-700/60 px-3 py-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-ink-400">
                    {event.structured.key}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(JSON.stringify(event.structured?.value, null, 2));
                    }}
                    className="flex items-center gap-1 rounded px-1 py-0.5 font-mono text-[10px] text-ink-400 hover:text-ink-200"
                    title="Copy JSON"
                  >
                    <Copy className="h-3 w-3" /> copy
                  </button>
                </div>
                <div className="px-3 py-2">
                  <JsonNode value={event.structured.value} depth={0} defaultOpen />
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'evidence' && (
          <div>
            <div className="flex flex-wrap gap-1.5 px-4 pt-3 pb-2">
              {(['OBS', 'REP', 'DER', 'NA'] as const).map((k) => {
                const m = evidenceKindMeta[k];
                const present = evidenceKinds.has(k);
                return (
                  <span
                    key={k}
                    title={`${m.full} — ${m.desc}`}
                    className={`inline-flex items-center gap-1 rounded-[3px] border px-1.5 py-0.5 font-mono text-[10px] ${
                      present ? m.cls : 'border-ink-700/60 text-ink-600 line-through'
                    }`}
                  >
                    {k} · {m.full}
                  </span>
                );
              })}
            </div>
            <ul className="mx-4 mb-4 overflow-hidden rounded-[4px] border border-ink-700/70 bg-ink-850/40">
              {event.evidence.map((e, i) => (
                <EvidenceRow key={i} item={e} />
              ))}
            </ul>
          </div>
        )}

        {tab === 'usage' && (
          <div className="px-4 py-4">
            {hasUsage && event.usage ? (
              <dl className="grid grid-cols-3 gap-2">
                {[
                  ['prompt tokens', event.usage.promptTokens.toLocaleString()],
                  ['completion tokens', event.usage.completionTokens.toLocaleString()],
                  ['cache reads', event.usage.cacheReadTokens?.toLocaleString() ?? 'not recorded'],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-[4px] border border-ink-700/70 bg-ink-850/60 p-2.5">
                    <dt className="font-mono text-[9px] uppercase tracking-widest text-ink-400">{k}</dt>
                    <dd className="mt-1 font-mono text-sm text-ink-50 tnum">{v}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <div className="rounded-[4px] border border-ink-700/70 bg-ink-850/60 p-4">
                <div className="flex items-center gap-2">
                  <EvidenceBadge kind="NA" />
                  <span className="text-2xs font-medium text-ink-100">Usage data unavailable</span>
                </div>
                <p className="mt-2 text-2xs leading-relaxed text-ink-300">
                  No usage record is attached to this event. Missing usage is shown as unavailable,
                  not as zero.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
