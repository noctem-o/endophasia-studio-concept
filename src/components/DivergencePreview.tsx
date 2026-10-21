import { useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { categoryColor, healthySession, divergentSession } from '@/data/sessions';
import type { TrajectoryEvent } from '@/data/types';
import { StatusChip } from './primitives';

interface AlignedStep {
  seq: number;
  a?: TrajectoryEvent;
  b?: TrajectoryEvent;
  diverged: boolean;
}

function align(a: TrajectoryEvent[], b: TrajectoryEvent[]): AlignedStep[] {
  const divSeq = 9;
  const n = Math.max(a.length, b.length);
  const steps: AlignedStep[] = [];
  for (let i = 0; i < n; i++) {
    steps.push({
      seq: i + 1,
      a: a[i],
      b: b[i],
      diverged: i + 1 >= divSeq,
    });
  }
  return steps;
}

function MiniEvent({ event, dim }: { event?: TrajectoryEvent; dim?: boolean }) {
  if (!event) {
    return (
      <div className="rounded-[4px] border border-dashed border-ink-700 px-2.5 py-2 font-mono text-[10px] text-ink-500">
        — no aligned record —
      </div>
    );
  }
  const color = categoryColor[event.category];
  return (
    <div
      className={`rounded-[4px] border px-2.5 py-2 ${
        event.status === 'error'
          ? 'border-red-accent/40 bg-red-accent/6'
          : event.status === 'partial'
            ? 'border-amber-accent/40 bg-amber-accent/6'
            : 'border-ink-700/70 bg-ink-850/50'
      } ${dim ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${color.dot}`} aria-hidden />
        <span className="min-w-0 flex-1 truncate text-2xs font-medium text-ink-100">{event.title}</span>
        <span className="shrink-0 font-mono text-[9px] text-ink-500 tnum">{event.offsetMs} ms</span>
        <StatusChip status={event.status} />
      </div>
      <p className="mt-1 truncate text-2xs text-ink-400">{event.summary}</p>
    </div>
  );
}

export function DivergencePreview({ onBack }: { onBack: () => void }) {
  const steps = align(healthySession.events, divergentSession.events);
  const divSeq = divergentSession.divergence?.atEventSeq ?? 9;
  const [onlyDivergence, setOnlyDivergence] = useState(false);

  const shown = onlyDivergence ? steps.filter((s) => s.diverged) : steps;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-ink-700/70 bg-ink-900 px-4 py-2.5">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-[4px] border border-ink-600/70 px-2 py-1 font-mono text-2xs text-ink-300 transition-colors hover:border-ink-500 hover:text-ink-100"
        >
          <ArrowLeftRight className="h-3 w-3" /> Observation workspace
        </button>
        <div>
          <h2 className="text-2xs font-semibold tracking-wide text-ink-50">CONCEPT PREVIEW — Trajectory divergence comparison</h2>
          <p className="font-mono text-[10px] text-ink-400">
            {healthySession.id} (reference) vs {divergentSession.id} — runs share a task; alignment is by record index, not semantics
          </p>
        </div>
        <label className="ml-auto flex cursor-pointer items-center gap-2 font-mono text-2xs text-ink-300">
          <input
            type="checkbox"
            checked={onlyDivergence}
            onChange={(e) => setOnlyDivergence(e.target.checked)}
            className="h-3 w-3 accent-[#2DD4BF]"
          />
          divergence only (seq ≥ {divSeq})
        </label>
      </div>

      <div className="border-b border-amber-accent/30 bg-amber-accent/6 px-4 py-2">
        <p className="text-2xs leading-relaxed text-amber-accent/90">
          <span className="font-mono font-semibold tracking-widest">CONCEPT PREVIEW · </span>
          This comparison mode is a design exploration, not a current Studio capability. It compares
          recorded events only — it does not visualise private reasoning, internal thoughts, or model
          internals. Alignment by storage index is a simplification of any real method.
        </p>
      </div>

      {divergentSession.divergence && (
        <div className="border-b border-ink-700/70 bg-ink-900/60 px-4 py-2.5">
          <p className="text-2xs leading-relaxed text-ink-300">
            <span className="font-mono text-2xs uppercase tracking-widest text-ink-400">Divergence point · </span>
            {divergentSession.divergence.note}
          </p>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin px-4 py-3">
        <div className="grid grid-cols-[48px_1fr_1fr] gap-x-4">
          <div />
          <div className="pb-2 font-mono text-2xs uppercase tracking-widest text-teal-accent">
            {healthySession.id} · reference · completed
          </div>
          <div className="pb-2 font-mono text-2xs uppercase tracking-widest text-red-accent">
            {divergentSession.id} · divergent · terminated
          </div>
          {shown.map((s) => (
            <div key={s.seq} className="col-span-3 grid grid-cols-[48px_1fr_1fr] gap-x-4 pb-1.5">
              <div className="pt-2 text-right font-mono text-2xs text-ink-500 tnum">#{s.seq}</div>
              <div className="relative">
                <MiniEvent event={s.a} dim={!s.diverged} />
              </div>
              <div className="relative">
                <MiniEvent event={s.b} dim={!s.diverged} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
