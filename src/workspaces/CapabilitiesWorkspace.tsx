import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { Capability, Session, Source } from '../domain/types';
import type { StudioState } from '../state/studio';
import { capabilityMeta, sourceMeta } from '../state/meta';
import { CapabilityGlyph, KeyVal, SectionLabel, SourceConditionChip } from '../components/primitives';
import { EvidenceList } from '../components/EvidenceList';

export function CapabilitiesWorkspace({ studio }: { studio: StudioState }) {
  const session = studio.session;
  const selected = studio.selectedCapability ?? session.capabilities[0] ?? null;

  return (
    <div className="flex h-full min-h-0">
      <div className="w-60 shrink-0 overflow-y-auto border-r border-ink-700/70 bg-ink-900/60 p-3">
        <SectionLabel>Declared capabilities</SectionLabel>
        <div className="mt-2 space-y-1.5">
          {session.capabilities.map((cap) => {
            const meta = capabilityMeta[cap.status];
            const active = cap.id === selected?.id;
            return (
              <button
                key={cap.id}
                onClick={() => studio.setCapabilityId(cap.id)}
                aria-pressed={active}
                className={`w-full rounded-[4px] border px-2.5 py-2 text-left transition-colors ${
                  active ? 'border-teal-accent/50 bg-teal-accent/10' : 'border-ink-700/60 bg-ink-850 hover:border-ink-500'
                }`}
              >
                <div className="flex items-center gap-2">
                  <CapabilityGlyph status={cap.status} className="font-mono text-xs" />
                  <span className="truncate font-mono text-xs text-ink-100">{cap.name}</span>
                </div>
                <div className={`mt-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest ${meta.text}`}>
                  {meta.label}
                </div>
              </button>
            );
          })}
          {session.capabilities.length === 0 && (
            <p className="px-1 font-mono text-2xs text-ink-500">no capabilities declared</p>
          )}
        </div>

        <div className="mt-4">
          <SectionLabel>Sources</SectionLabel>
          <ul className="mt-2 space-y-1.5">
            {session.sources.map((s) => (
              <SourceRow key={s.id} source={s} />
            ))}
          </ul>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {selected ? (
          <CapabilityDetail session={session} capability={selected} onInspect={studio.inspectEventOf} />
        ) : (
          <div className="flex h-full items-center justify-center font-mono text-2xs text-ink-500">
            select a capability
          </div>
        )}
      </div>
    </div>
  );
}

function SourceRow({ source }: { source: Source }) {
  const [open, setOpen] = useState(false);
  const m = sourceMeta[source.condition];
  return (
    <li>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full rounded-[4px] border border-ink-700/60 bg-ink-850 px-2 py-1.5 text-left transition-colors hover:border-ink-500"
      >
        <div className="flex items-center gap-2">
          <span aria-hidden className={`font-mono text-[10px] ${m.text}`}>{m.glyph}</span>
          <span className="min-w-0 flex-1 truncate font-mono text-2xs text-ink-100">{source.name}</span>
          {source.records !== undefined && (
            <span className="font-mono text-[10px] text-ink-500">{source.records} rec</span>
          )}
        </div>
        {open && (
          <div className="mt-1.5 space-y-1 border-t border-ink-700/60 pt-1.5">
            <div className="font-mono text-[10px] text-ink-400">{source.id} · {source.kind}</div>
            <SourceConditionChip condition={source.condition} />
            <p className="text-2xs leading-relaxed text-ink-300">{source.note}</p>
          </div>
        )}
      </button>
    </li>
  );
}

function CapabilityDetail({ session, capability, onInspect }: {
  session: Session;
  capability: Capability;
  onInspect: (eventId: string) => void;
}) {
  const meta = capabilityMeta[capability.status];
  const usage = session.events.filter(
    (e) => e.tool === capability.name || e.kind === capability.name,
  );

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-teal-accent" aria-hidden />
          <h2 className="font-mono text-sm font-semibold text-ink-50">{capability.name}</h2>
          <span className={`rounded-[3px] border px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-widest ${meta.text} border-current/40 bg-current/10`}>
            {meta.label}
          </span>
        </div>
        <p className="mt-1.5 font-mono text-2xs leading-relaxed text-ink-400">{meta.desc}</p>
      </div>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-[4px] border border-ink-700/60 bg-ink-850 p-3">
          <div className="font-mono text-2xs font-semibold uppercase tracking-widest text-blue-accent">declared</div>
          <p className="mt-1 text-2xs leading-relaxed text-ink-200">{capability.declared}</p>
        </div>
        <div className="rounded-[4px] border border-ink-700/60 bg-ink-850 p-3">
          <div className="font-mono text-2xs font-semibold uppercase tracking-widest text-teal-accent">observed</div>
          <p className="mt-1 text-2xs leading-relaxed text-ink-200">{capability.observed}</p>
        </div>
      </section>

      {capability.restrictions.length > 0 && (
        <section>
          <SectionLabel>Restrictions</SectionLabel>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
            {capability.restrictions.map((r, i) => (
              <li key={i} className="text-2xs text-ink-300">{r}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionLabel>Evidence ({capability.evidence.length})</SectionLabel>
        <div className="mt-1.5">
          <EvidenceList items={capability.evidence} />
        </div>
      </section>

      <section>
        <SectionLabel>Exercised in this session</SectionLabel>
        {usage.length === 0 ? (
          <p className="mt-1.5 font-mono text-2xs text-ink-500">
            no events in this session record use of this capability
          </p>
        ) : (
          <ul className="mt-1.5 space-y-1">
            {usage.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => onInspect(e.id)}
                  className="flex w-full items-center gap-2 rounded-[4px] border border-ink-700/60 bg-ink-850 px-2.5 py-1.5 text-left transition-colors hover:border-teal-accent/40"
                >
                  <span className="font-mono text-2xs text-ink-500">seq {e.seq}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-ink-100">{e.title}</span>
                  <KeyValInline status={e.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionLabel>Session context</SectionLabel>
        <dl className="mt-1.5 space-y-1">
          <KeyVal k="session" v={`${session.id} — ${session.label}`} />
          <KeyVal k="task" v={session.taskId} mono={false} />
          <KeyVal k="runtime" v={`${session.runtime.runtime} ${session.runtime.runtimeVersion}`} />
          <KeyVal k="harness" v={session.runtime.harness} />
          {session.runtime.config.map((c) => (
            <KeyVal key={c.key} k={c.key} v={c.degraded ? `${c.value} (degraded)` : c.value} />
          ))}
        </dl>
      </section>
    </div>
  );
}

function KeyValInline({ status }: { status: 'ok' | 'error' | 'partial' }) {
  const m = { ok: 'text-teal-accent', error: 'text-red-accent', partial: 'text-amber-accent' }[status];
  return <span className={`shrink-0 font-mono text-2xs ${m}`}>{status}</span>;
}
