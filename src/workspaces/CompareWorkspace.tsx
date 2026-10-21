import { useMemo, useState } from 'react';
import { CircleCheck, CircleDashed, HelpCircle, ChevronDown, ChevronRight, AlignLeft } from 'lucide-react';
import type { TrajectoryEvent } from '../domain/types';
import { alignTrajectories, ALIGNMENT_METHODOLOGY } from '../analysis/compare';
import type { AlignmentClass } from '../analysis/compare';
import type { StudioState } from '../state/studio';
import { categoryMeta, statusMeta } from '../state/meta';
import { EvidenceList } from '../components/EvidenceList';
import { KeyVal, SectionLabel } from '../components/primitives';

const CLASS_META: Record<AlignmentClass['type'], { label: string; icon: typeof CircleCheck; cls: string; hint: string }> = {
  exact: {
    label: 'EXACT', icon: CircleCheck,
    cls: 'border-teal-accent/50 bg-teal-accent/10 text-teal-accent',
    hint: 'same kind and tool, identical compared-field values',
  },
  proposed: {
    label: 'PROPOSED', icon: HelpCircle,
    cls: 'border-blue-accent/50 bg-blue-accent/10 text-blue-accent',
    hint: 'same kind and tool, fields differ — a candidate correspondence, not a verified match',
  },
  'unmatched-a': {
    label: 'UNMATCHED A', icon: CircleDashed,
    cls: 'border-amber-accent/50 bg-amber-accent/10 text-amber-accent',
    hint: 'no counterpart proposed in trajectory B',
  },
  'unmatched-b': {
    label: 'UNMATCHED B', icon: CircleDashed,
    cls: 'border-amber-accent/50 bg-amber-accent/10 text-amber-accent',
    hint: 'no counterpart proposed in trajectory A',
  },
};

const COMPARE_FIELDS = ['tool', 'path', 'cmd'] as const;

export function CompareWorkspace({ studio }: { studio: StudioState }) {
  const sessionA = studio.compareSessionA;
  const sessionB = studio.compareSessionB;
  const alignment = useMemo(() => alignTrajectories(sessionA.events, sessionB.events), [sessionA, sessionB]);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [showMethodology, setShowMethodology] = useState(false);

  const counts = alignment.reduce<Record<string, number>>((acc, a) => {
    acc[a.type] = (acc[a.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-3 border-b border-ink-700/70 bg-ink-900/60 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <SessionPicker
            label="Trajectory A"
            sessions={studio.sessions}
            value={sessionA.id}
            onChange={studio.setCompareA}
          />
          <span aria-hidden className="font-mono text-2xs text-ink-500">against</span>
          <SessionPicker
            label="Trajectory B"
            sessions={studio.sessions}
            value={sessionB.id}
            onChange={studio.setCompareB}
          />
          <button
            onClick={() => setShowMethodology((v) => !v)}
            aria-expanded={showMethodology}
            className="ml-auto flex items-center gap-1.5 rounded-[4px] border border-ink-600/70 bg-ink-850 px-2.5 py-1.5 font-mono text-2xs uppercase tracking-widest text-ink-300 transition-colors hover:border-teal-accent/40 hover:text-ink-100"
          >
            <AlignLeft className="h-3.5 w-3.5" aria-hidden />
            methodology
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(CLASS_META) as AlignmentClass['type'][]).map((t) => {
            const m = CLASS_META[t];
            return (
              <span key={t} title={m.hint} className={`inline-flex items-center gap-1.5 rounded-[3px] border px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-widest ${m.cls}`}>
                <m.icon className="h-3 w-3" aria-hidden />
                {m.label} · {counts[t] ?? 0}
              </span>
            );
          })}
          <span className="ml-auto font-mono text-2xs text-ink-500">
            {sessionA.events.length} events vs {sessionB.events.length} events
          </span>
        </div>
      </div>

      {showMethodology && <MethodologyPanel />}

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="space-y-1.5">
          {alignment.map((row, i) => (
            <AlignmentRow
              key={i}
              row={row}
              open={openIdx === i}
              onToggle={() => setOpenIdx(openIdx === i ? null : i)}
            />
          ))}
          {alignment.length === 0 && (
            <div className="py-10 text-center font-mono text-2xs text-ink-500">nothing to align</div>
          )}
        </div>
      </div>
    </div>
  );
}

function SessionPicker({ label, sessions, value, onChange }: {
  label: string;
  sessions: StudioState['sessions'];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="font-mono text-2xs uppercase tracking-widest text-ink-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="max-w-[280px] rounded-[4px] border border-ink-600/70 bg-ink-850 px-2 py-1 font-mono text-2xs text-ink-100 focus:border-teal-accent/50 focus:outline-none"
      >
        {sessions.map((s) => (
          <option key={s.id} value={s.id}>{s.id} — {s.label}</option>
        ))}
      </select>
    </label>
  );
}

function MethodologyPanel() {
  return (
    <div className="shrink-0 border-b border-ink-700/70 bg-ink-900/80 px-4 py-3">
      <SectionLabel>Alignment methodology — deterministic, reproducible</SectionLabel>
      <div className="mt-2 space-y-1.5">
        {ALIGNMENT_METHODOLOGY.phases.map((p) => (
          <div key={p.name} className="rounded-[4px] border border-ink-700/60 bg-ink-850 p-2.5">
            <div className="font-mono text-2xs font-semibold uppercase tracking-widest text-teal-accent">{p.name}</div>
            <p className="mt-1 text-2xs leading-relaxed text-ink-300">{p.rule}</p>
          </div>
        ))}
      </div>
      <div className="mt-2.5 rounded-[4px] border border-amber-accent/30 bg-amber-accent/5 p-2.5">
        <div className="font-mono text-2xs font-semibold uppercase tracking-widest text-amber-accent">caveats</div>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          {ALIGNMENT_METHODOLOGY.caveats.map((c, i) => (
            <li key={i} className="text-2xs leading-relaxed text-ink-300">{c}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function AlignmentRow({ row, open, onToggle }: {
  row: AlignmentClass;
  open: boolean;
  onToggle: () => void;
}) {
  const meta = CLASS_META[row.type];
  const a = row.type === 'unmatched-b' ? null : row.a;
  const b = row.type === 'unmatched-a' ? null : row.b;
  const pair = row.type === 'exact' || row.type === 'proposed' ? row : null;

  return (
    <div className={`overflow-hidden rounded-[4px] border bg-ink-900/70 ${
      row.type === 'exact' ? 'border-teal-accent/25' : row.type === 'proposed' ? 'border-blue-accent/25' : 'border-amber-accent/25'
    }`}>
      <button onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-ink-850">
        {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-500" aria-hidden /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-500" aria-hidden />}
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-[3px] border px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-widest ${meta.cls}`}>
          <meta.icon className="h-3 w-3" aria-hidden />
          {meta.label}
        </span>
        <span className="shrink-0 font-mono text-2xs text-ink-500">
          {a ? `A·${a.seq}` : '—'} ↔ {b ? `B·${b.seq}` : '—'}
        </span>
        <span className="truncate text-xs text-ink-200">
          {a?.title ?? b!.title}
          {a && b && a.kind !== b.kind && (
            <span className="ml-2 font-mono text-[10px] text-red-accent">kind: {a.kind} vs {b.kind}</span>
          )}
        </span>
      </button>
      {open && (
        <div className="grid gap-3 border-t border-ink-700/50 p-3 md:grid-cols-2">
          <PairSide label="Trajectory A" event={a} />
          <PairSide label="Trajectory B" event={b} />
          {pair && (
            <div className="md:col-span-2">
              <SectionLabel>Compared fields</SectionLabel>
              <dl className="mt-1.5 space-y-1">
                {COMPARE_FIELDS.map((f) => {
                  const va = fieldOf(a, f);
                  const vb = fieldOf(b, f);
                  const same = va === vb;
                  return (
                    <KeyVal key={f} k={f} v={
                      <span className="font-mono text-2xs">
                        <span className={same ? 'text-ink-300' : 'text-amber-accent'}>{va ?? '—'}</span>
                        <span className="mx-1.5 text-ink-600">{same ? '=' : '≠'}</span>
                        <span className={same ? 'text-ink-300' : 'text-amber-accent'}>{vb ?? '—'}</span>
                      </span>
                    } />
                  );
                })}
              </dl>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function fieldOf(e: TrajectoryEvent | null, field: string): string | null {
  if (!e) return null;
  return e.fields.find((x) => x.key === field)?.value ?? null;
}

function PairSide({ label, event }: { label: string; event: TrajectoryEvent | null }) {
  if (!event) {
    return (
      <div className="rounded-[4px] border border-ink-700/50 bg-ink-850 p-3">
        <div className="font-mono text-2xs uppercase tracking-widest text-ink-400">{label}</div>
        <p className="mt-1.5 font-mono text-2xs text-ink-500">no corresponding event</p>
      </div>
    );
  }
  const cm = categoryMeta[event.category];
  const sm = statusMeta[event.status];
  return (
    <div className="rounded-[4px] border border-ink-700/50 bg-ink-850 p-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-2xs uppercase tracking-widest text-ink-400">{label} · seq {event.seq}</span>
        <span className={`rounded-[3px] border px-1 py-0.5 font-mono text-[9px] tracking-widest ${cm.border} ${cm.bg} ${cm.text}`}>{cm.label}</span>
        <span className={`inline-flex items-center gap-1 font-mono text-2xs ${sm.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${sm.dot}`} aria-hidden />
          {sm.label}
        </span>
      </div>
      <div className="mt-1 text-xs font-medium text-ink-100">{event.title}</div>
      <p className="mt-0.5 text-2xs leading-relaxed text-ink-300">{event.summary}</p>
      <div className="mt-2">
        <EvidenceList items={event.evidence} />
      </div>
    </div>
  );
}
