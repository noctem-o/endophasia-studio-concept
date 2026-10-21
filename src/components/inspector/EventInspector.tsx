import { useEffect, useMemo } from 'react';
import { Link2 } from 'lucide-react';
import type { Session, TrajectoryEvent } from '../../domain/types';
import { categoryMeta, interventionStageMeta } from '../../state/meta';
import { EvidenceList } from '../EvidenceList';
import { JsonTree } from '../JsonTree';
import { EvidenceBadge, KeyVal, NotRecorded, SectionLabel, StatusChip } from '../primitives';

export function EventInspector({ session, event, onNavigateRef }: {
  session: Session;
  event: TrajectoryEvent;
  onNavigateRef: (eventId: string) => void;
}) {
  const idx = useMemo(() => session.events.findIndex((x) => x.id === event.id), [session, event.id]);
  const prev = idx > 0 ? session.events[idx - 1] : null;
  const next = idx >= 0 && idx < session.events.length - 1 ? session.events[idx + 1] : null;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.key === 'ArrowDown' || e.key === 'j') && next) {
        e.preventDefault();
        onNavigateRef(next.id);
      } else if ((e.key === 'ArrowUp' || e.key === 'k') && prev) {
        e.preventDefault();
        onNavigateRef(prev.id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [prev, next, onNavigateRef]);

  const cm = categoryMeta[event.category];
  const related = (event.refs ?? [])
    .map((r) => ({ ref: r, target: session.events.find((e) => e.id === r.target) }))
    .filter((x): x is { ref: typeof x.ref; target: TrajectoryEvent } => x.target !== undefined);
  const dangling = (event.refs ?? []).filter((r) => !session.events.some((e) => e.id === r.target));

  return (
    <div className="space-y-5 p-4">
      <div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-2xs text-ink-500">seq {event.seq}</span>
          <h2 className="text-sm font-semibold text-ink-50">{event.title}</h2>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className={`rounded-[3px] border px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-widest ${cm.border} ${cm.bg} ${cm.text}`}>
            {cm.label}
          </span>
          <StatusChip status={event.status} />
          <span className="rounded-[3px] border border-ink-600 bg-ink-800 px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-widest text-ink-300">
            {event.kind}
          </span>
          {event.tool && (
            <span className="rounded-[3px] border border-ink-600 bg-ink-800 px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-widest text-ink-300">
              {event.tool}
            </span>
          )}
        </div>
        <div className="mt-1.5 font-mono text-2xs text-ink-500">producer: {event.producer}</div>
      </div>

      <section>
        <SectionLabel>Summary</SectionLabel>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-200">{event.summary}</p>
      </section>

      {event.fields.length > 0 && (
        <section>
          <SectionLabel>Fields</SectionLabel>
          <dl className="mt-1.5 space-y-1">
            {event.fields.map((f) => (
              <KeyVal key={f.key} k={f.key} v={f.value} provenance={f.provenance} />
            ))}
          </dl>
        </section>
      )}

      <section>
        <SectionLabel>Usage accounting</SectionLabel>
        <dl className="mt-1.5 space-y-1">
          {event.usage ? (
            event.usage.present ? (
              <>
                <KeyVal k="prompt tokens" v={event.usage.promptTokens.toLocaleString()} />
                <KeyVal k="completion tokens" v={event.usage.completionTokens.toLocaleString()} />
                {event.usage.cacheReadTokens !== undefined && (
                  <KeyVal k="cache read" v={`${event.usage.cacheReadTokens.toLocaleString()} tok`} />
                )}
                <KeyVal k="total" v={(event.usage.promptTokens + event.usage.completionTokens).toLocaleString()} />
              </>
            ) : (
              <KeyVal k="usage" v={<NotRecorded what={event.usage.reason} />} />
            )
          ) : (
            <KeyVal k="usage" v="no usage row on this record" />
          )}
        </dl>
      </section>

      <section>
        <SectionLabel>Evidence ({event.evidence.length})</SectionLabel>
        <div className="mt-1.5">
          <EvidenceList items={event.evidence} />
        </div>
      </section>

      {event.structured && (
        <section>
          <SectionLabel>{event.structured.key.replace(/_/g, ' ')}</SectionLabel>
          <div className="mt-1.5">
            <JsonTree value={event.structured.value} />
          </div>
        </section>
      )}

      <section>
        <SectionLabel>Relations</SectionLabel>
        {(event.refs?.length ?? 0) === 0 ? (
          <p className="mt-1.5 font-mono text-2xs text-ink-500">no recorded relations</p>
        ) : (
          <ul className="mt-1.5 space-y-1">
            {related.map(({ ref, target }) => (
              <li key={`${ref.target}-${ref.relation}`}>
                <button
                  onClick={() => onNavigateRef(ref.target)}
                  className="group flex w-full items-center gap-2 rounded-[4px] border border-ink-700/60 bg-ink-850 px-2 py-1.5 text-left transition-colors hover:border-teal-accent/40"
                >
                  <Link2 className="h-3 w-3 shrink-0 text-ink-500 group-hover:text-teal-accent" aria-hidden />
                  <span className="font-mono text-2xs text-teal-accent">{ref.relation}</span>
                  <span className="truncate text-2xs text-ink-200">→ {target.title}</span>
                </button>
              </li>
            ))}
            {dangling.map((r) => (
              <li key={r.target} className="rounded-[4px] border border-red-accent/40 bg-red-accent/10 px-2 py-1.5 font-mono text-2xs text-red-accent">
                dangling ref: {r.target} ({r.relation})
              </li>
            ))}
          </ul>
        )}
      </section>

      {event.category === 'intervention' && <InterventionPanel session={session} event={event} />}

      <section>
        <SectionLabel>Record timing</SectionLabel>
        <dl className="mt-1.5 space-y-1">
          <KeyVal k="timestamp" v={event.at} />
          <KeyVal k="offset" v={`+${(event.offsetMs / 1000).toFixed(1)}s`} />
        </dl>
      </section>
    </div>
  );
}

function InterventionPanel({ session, event }: { session: Session; event: TrajectoryEvent }) {
  const marker = event.fields.find((f) => f.key === 'intervention')?.value ?? '';
  const id = marker.includes(' ') ? marker.split(' ')[1] : marker;
  const intervention = session.interventions.find((i) => i.id === id || marker.includes(i.id));
  if (!intervention) return null;

  return (
    <section>
      <SectionLabel>Intervention record — {intervention.kind} {intervention.id}</SectionLabel>
      <div className="mt-1.5 space-y-2 rounded-[4px] border border-red-accent/25 bg-red-accent/5 p-2.5">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-ink-400">intent</div>
          <p className="mt-0.5 text-2xs leading-relaxed text-ink-200">{intervention.intent}</p>
        </div>
        <KeyVal k="authorisation" v={intervention.authorisation} />
        <KeyVal k="scope" v={intervention.scope} />
        <div>
          <div className="font-mono text-2xs uppercase tracking-widest text-ink-500">lifecycle steps</div>
          <ol className="mt-1 space-y-1.5">
            {intervention.steps.map((s, i) => {
              const stm = interventionStageMeta[s.stage];
              const stepEvent = session.events.find((e) => e.seq === s.eventSeq);
              return (
                <li key={i} className="flex flex-wrap items-center gap-1.5 font-mono text-2xs">
                  <span className={`rounded-[3px] border px-1.5 py-0.5 font-semibold tracking-widest ${stm.text} ${stm.border} ${stm.bg}`}>
                    {stm.label}
                  </span>
                  <span className="text-ink-400">@seq {s.eventSeq}</span>
                  <span className="basis-full text-ink-300">{s.note}</span>
                  {stepEvent?.evidence.map((ev, j) => (
                    <EvidenceBadge key={j} kind={ev.kind} small withGlyph title={ev.label} />
                  ))}
                </li>
              );
            })}
          </ol>
        </div>
        <p className="border-t border-red-accent/20 pt-1.5 font-mono text-[10px] leading-relaxed text-ink-400">
          acceptance ≠ execution: each stage is a separately recorded event; sequence is not causation.
        </p>
      </div>
    </section>
  );
}
