import type { RuntimeIdentity } from '@/data/types';

export function RuntimePanel({ runtime, sessionLabel, taskId, state, durationMs }: {
  runtime: RuntimeIdentity;
  sessionLabel: string;
  taskId: string;
  state: 'completed' | 'failed' | 'incomplete-evidence';
  durationMs: number;
}) {
  const stateMeta = {
    completed: { label: 'COMPLETED', cls: 'text-teal-accent border-teal-accent/40 bg-teal-accent/8' },
    failed: { label: 'DIVERGENT / TERMINATED', cls: 'text-red-accent border-red-accent/40 bg-red-accent/8' },
    'incomplete-evidence': { label: 'EVIDENCE INCOMPLETE', cls: 'text-amber-accent border-amber-accent/40 bg-amber-accent/8' },
  }[state];

  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[13px] font-semibold text-ink-50">{sessionLabel}</h3>
          <p className="mt-0.5 line-clamp-2 text-2xs leading-snug text-ink-300">{taskId}</p>
        </div>
        <span className={`shrink-0 rounded-[3px] border px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-widest ${stateMeta.cls}`}>
          {stateMeta.label}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-mono text-2xs">
        {[
          ['agent', runtime.agent],
          ['runtime', `${runtime.runtime} ${runtime.runtimeVersion}`],
          ['harness', runtime.harness],
          ['fingerprint', runtime.fingerprint],
          ['recorded', runtime.recordedAt.replace('recorded ', '')],
          ['duration', `${(durationMs / 1000).toFixed(1)} s`],
        ].map(([k, v]) => (
          <div key={k} className="col-span-2 grid grid-cols-[84px_1fr] items-baseline gap-3">
            <dt className="text-ink-400">{k}</dt>
            <dd className="truncate text-ink-100 tnum">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-3 border-t border-ink-800 pt-2.5">
        <div className="font-mono text-[9px] uppercase tracking-widest text-ink-400">Configuration</div>
        <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1">
          {runtime.config.map((c) => (
            <div key={c.key} className="min-w-0">
              <dt className="truncate font-mono text-[10px] text-ink-400">{c.key}</dt>
              <dd className="truncate font-mono text-2xs text-ink-200">{c.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
