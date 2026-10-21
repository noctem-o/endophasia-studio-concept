import { ArrowRight, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { Session, TrajectoryEvent } from '../../domain/types';
import { bestEvidence, categoryMeta, interventionStageMeta } from '../../state/meta';
import { formatOffset, referencedBy } from '../../state/observe';
import { EvidenceList } from '../EvidenceList';
import { JsonTree } from '../JsonTree';
import { IconButton } from '../../ui/controls';
import { Badge, Def, DefList, NotRecorded, Section } from '../../ui/layout';
import { ProvMark, ProvTag, StatusMark } from '../../ui/marks';

/**
 * One event, taken apart. Evidence leads, because provenance is the point of the instrument; then what the record says about
 * itself (fields, usage), then how it is related to its neighbours, then (for interventions) its separately-recorded lifecycle.
 */
export function EventInspector({ session, event, position, onStep, onNavigate, onClose }: {
  session: Session;
  event: TrajectoryEvent;
  /** Place among the events currently shown (the filtered list), not among all of them. */
  position: { index: number; total: number };
  onStep: (delta: 1 | -1) => void;
  onNavigate: (eventId: string) => void;
  onClose: () => void;
}) {
  const cm = categoryMeta[event.category];
  const Icon = cm.icon;
  const best = bestEvidence(event.evidence);
  const outgoing = (event.refs ?? []).map((r) => ({ ref: r, target: session.events.find((e) => e.id === r.target) }));
  const incoming = referencedBy(session, event.id);

  const where = (other: TrajectoryEvent) => {
    const d = other.seq - event.seq;
    return d === 0 ? 'this event' : `${Math.abs(d)} ${Math.abs(d) === 1 ? 'event' : 'events'} ${d > 0 ? 'later' : 'earlier'}`;
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-line px-3">
        <span className="eyebrow">Event</span>
        <span className="ml-1 font-mono text-2xs text-fg-2 tnum">{position.index + 1} / {position.total}</span>
        <span className="ml-auto flex items-center gap-1">
          <IconButton label="Previous event (k)" onClick={() => onStep(-1)}><ChevronLeft className="h-3.5 w-3.5" aria-hidden /></IconButton>
          <IconButton label="Next event (j)" onClick={() => onStep(1)}><ChevronRight className="h-3.5 w-3.5" aria-hidden /></IconButton>
          <IconButton label="Close inspector" onClick={onClose} className="lg:hidden"><X className="h-3.5 w-3.5" aria-hidden /></IconButton>
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto scrollbar-thin px-4 py-4">
        <header>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-2xs text-fg-3">
            <span>seq {event.seq}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1 text-fg-2"><Icon className="h-3 w-3" aria-hidden />{cm.name}</span>
            <span aria-hidden>·</span>
            <span>{event.kind}</span>
            {event.tool && <Badge>{event.tool}</Badge>}
          </div>
          <h2 className="mt-1.5 text-lg font-medium leading-snug text-fg-1">{event.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {best ? <ProvTag kind={best} title={`Strongest evidence on this record: ${best}`} /> : <span className="font-mono text-2xs text-fg-3">no evidence items</span>}
            <span className="font-mono text-2xs text-fg-3">{event.evidence.length} evidence {event.evidence.length === 1 ? 'item' : 'items'}</span>
            <span className="inline-flex items-center gap-1.5 font-mono text-2xs text-fg-3">status <StatusMark status={event.status} showOk /></span>
          </div>
          <p className="mt-2.5 text-sm leading-relaxed text-fg-2">{event.summary}</p>
        </header>

        <Section title="Evidence" note={`${event.evidence.length}`}>
          <EvidenceList items={event.evidence} sources={session.sources} />
        </Section>

        {event.fields.length > 0 && (
          <Section title="Fields" note={`${event.fields.length}`}>
            <DefList>
              {event.fields.map((f) => <Def key={f.key} k={f.key} prov={f.provenance}>{f.value}</Def>)}
            </DefList>
          </Section>
        )}

        <Section title="Usage accounting">
          {event.usage ? (
            event.usage.present ? (
              <DefList>
                <Def k="prompt">{event.usage.promptTokens.toLocaleString()} tok</Def>
                <Def k="completion">{event.usage.completionTokens.toLocaleString()} tok</Def>
                {event.usage.cacheReadTokens !== undefined && <Def k="cache read">{event.usage.cacheReadTokens.toLocaleString()} tok</Def>}
                <Def k="total">{(event.usage.promptTokens + event.usage.completionTokens).toLocaleString()} tok</Def>
              </DefList>
            ) : (
              <div className="space-y-1.5">
                <NotRecorded what="usage" reason={event.usage.reason} />
                <p className="text-2xs leading-relaxed text-fg-3">A missing measurement is shown as missing. It is not counted as zero in any total.</p>
              </div>
            )
          ) : (
            <p className="font-mono text-2xs text-fg-3">no usage row on this record</p>
          )}
        </Section>

        {event.structured && (
          <Section title={event.structured.key.replace(/_/g, ' ')} collapsible defaultOpen={false}>
            <JsonTree value={event.structured.value} />
          </Section>
        )}

        <Section title="Relations" note="recorded, not inferred">
          {outgoing.length === 0 && incoming.length === 0 ? (
            <p className="font-mono text-2xs text-fg-3">no recorded relations</p>
          ) : (
            <ul className="space-y-1">
              {outgoing.map(({ ref, target }) =>
                target ? (
                  <li key={`o-${ref.target}-${ref.relation}`}>
                    <RelationRow direction="out" relation={ref.relation} other={target} where={where(target)} onClick={() => onNavigate(target.id)} />
                  </li>
                ) : (
                  <li key={`d-${ref.target}`} className="rounded-ctl border border-fault/40 bg-fault/10 px-2.5 py-1.5 font-mono text-2xs text-fault">
                    dangling reference: {ref.target} ({ref.relation}) — no such event in this session
                  </li>
                ),
              )}
              {incoming.map(({ from, relation }) => (
                <li key={`i-${from.id}-${relation}`}>
                  <RelationRow direction="in" relation={relation} other={from} where={where(from)} onClick={() => onNavigate(from.id)} />
                </li>
              ))}
            </ul>
          )}
          {(outgoing.length > 0 || incoming.length > 0) && <p className="mt-2 text-2xs leading-relaxed text-fg-3">A relation is a recorded link between two events. Sequence is not causation.</p>}
        </Section>

        {event.category === 'intervention' && <InterventionLifecycle session={session} event={event} onNavigate={onNavigate} />}

        <Section title="Record timing">
          <DefList>
            <Def k="timestamp">{event.at}</Def>
            <Def k="offset">{formatOffset(event.offsetMs)}</Def>
            <Def k="producer">{event.producer}</Def>
          </DefList>
        </Section>
      </div>
    </div>
  );
}

function RelationRow({ direction, relation, other, where, onClick }: {
  direction: 'in' | 'out';
  relation: string;
  other: TrajectoryEvent;
  where: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="group flex w-full items-center gap-2 rounded-ctl border border-line bg-surface-2 px-2.5 py-1.5 text-left transition-colors duration-100 hover:border-line-strong hover:bg-surface-3">
      <span className="w-[74px] shrink-0 font-mono text-2xs text-fg-3">{direction === 'out' ? 'this →' : '← from'}</span>
      <span className="shrink-0 font-mono text-2xs font-medium text-fg-1">{relation}</span>
      <ArrowRight className="h-3 w-3 shrink-0 text-fg-4" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-xs text-fg-1">{other.title}</span>
      <span className="shrink-0 font-mono text-2xs text-fg-3">seq {other.seq} · {where}</span>
    </button>
  );
}

function InterventionLifecycle({ session, event, onNavigate }: { session: Session; event: TrajectoryEvent; onNavigate: (id: string) => void }) {
  const marker = event.fields.find((f) => f.key === 'intervention')?.value ?? '';
  const id = marker.includes(' ') ? marker.split(' ')[1] : marker;
  const intervention = session.interventions.find((i) => i.id === id || marker.includes(i.id));
  if (!intervention) return null;

  return (
    <Section title={`Intervention ${intervention.id}`} note={intervention.kind}>
      <div className="space-y-3 rounded-ctl border border-line bg-surface-2 p-3">
        <div>
          <div className="eyebrow">intent</div>
          <p className="mt-1 text-xs leading-relaxed text-fg-2">{intervention.intent}</p>
        </div>
        <DefList>
          <Def k="authorisation" mono={false}>{intervention.authorisation}</Def>
          <Def k="scope" mono={false}>{intervention.scope}</Def>
        </DefList>
        <div>
          <div className="eyebrow mb-1.5">lifecycle — each step a separate recorded event</div>
          <ol className="relative space-y-2.5 pl-4">
            <span aria-hidden className="absolute bottom-1 left-[3px] top-1 w-px bg-line-strong" />
            {intervention.steps.map((s, i) => {
              const sm = interventionStageMeta[s.stage];
              const stepEvent = session.events.find((e) => e.seq === s.eventSeq);
              const sbest = stepEvent ? bestEvidence(stepEvent.evidence) : null;
              return (
                <li key={i} className="relative">
                  <span aria-hidden className="absolute -left-[16px] top-1.5 h-[7px] w-[7px] rounded-full border border-line-strong bg-surface-3" />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-tag border px-1.5 font-mono text-2xs font-medium tracking-wider ${sm.text} ${sm.border} ${sm.bg}`}>{sm.label}</span>
                    {stepEvent ? (
                      <button type="button" onClick={() => onNavigate(stepEvent.id)} className="font-mono text-2xs text-fg-2 underline decoration-line-strong underline-offset-2 hover:text-fg-1">at seq {s.eventSeq}</button>
                    ) : (
                      <span className="font-mono text-2xs text-fg-3">at seq {s.eventSeq}</span>
                    )}
                    {sbest && <ProvMark kind={sbest} />}
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-fg-3">{s.note}</p>
                </li>
              );
            })}
          </ol>
        </div>
        <p className="border-t border-line-subtle pt-2 text-2xs leading-relaxed text-fg-3">Acceptance is not execution. Each stage is its own record; sequence is not causation.</p>
      </div>
    </Section>
  );
}
