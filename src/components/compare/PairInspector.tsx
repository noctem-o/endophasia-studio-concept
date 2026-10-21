import { ExternalLink, X } from 'lucide-react';
import type { Session, TrajectoryEvent } from '../../domain/types';
import { ALIGNMENT_METHODOLOGY } from '../../analysis/compare';
import { bestEvidence, categoryMeta } from '../../state/meta';
import type { MapLink } from '../../state/compare';
import { compareFields } from '../../state/compare';
import { Button, IconButton } from '../../ui/controls';
import { Callout, DefList, Def, Section } from '../../ui/layout';
import { ProvTag, StatusMark } from '../../ui/marks';
import { EvidenceList } from '../EvidenceList';
import { CLASS_LABEL, CLASS_MEANING } from './classMeta';

/** What each class does NOT establish. The comparison must never imply a stronger claim than the method makes. */
const NOT_ESTABLISHED: Record<MapLink['cls'], string> = {
  exact: 'It does not say the two events had the same content, cause or effect: only that kind, tool and the compared fields agree.',
  proposed: 'Equivalence is not established. The pairing is by order among events of the same kind and tool, so it can be wrong.',
  'unmatched-a': 'This record may be changed, missing or additional. The record alone does not say which, and it is not an error.',
  'unmatched-b': 'This record may be changed, missing or additional. The record alone does not say which, and it is not an error.',
};

function ClassTag({ cls }: { cls: MapLink['cls'] }) {
  const base = 'inline-flex h-5 items-center gap-1.5 rounded-tag border px-1.5 font-mono text-2xs font-semibold tracking-wider';
  if (cls === 'exact') return <span className={`${base} border-line-strong bg-surface-3 text-fg-1`}><svg width="14" height="6" aria-hidden><path d="M0 3h14" className="stroke-fg-2" strokeWidth="1.6" /></svg>{CLASS_LABEL[cls]}</span>;
  if (cls === 'proposed') return <span className={`${base} border-der/50 text-der`}><svg width="14" height="6" aria-hidden><path d="M0 3h14" className="stroke-der" strokeWidth="1.6" strokeDasharray="4 2.5" /></svg>{CLASS_LABEL[cls]}</span>;
  return <span className={`${base} border-dashed border-line-strong text-fg-2`}><svg width="14" height="8" aria-hidden><circle cx="10" cy="4" r="3" className="fill-surface-0 stroke-fg-3" strokeWidth="1.2" /><path d="M0 4h6" className="stroke-fg-4" strokeWidth="1.4" strokeDasharray="2 2" /></svg>{CLASS_LABEL[cls]}</span>;
}

/** Shown before anything is selected: the method, in the interface, so the alignment's meaning is never implicit. */
export function MethodologyBrief() {
  return (
    <div className="h-full min-h-0 space-y-4 overflow-y-auto scrollbar-thin px-4 py-4">
      <header>
        <div className="eyebrow">Method</div>
        <h2 className="mt-1 font-serif text-xl leading-snug text-fg-1">How these are lined up</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-fg-3">Deterministic and reproducible: the same two trajectories always give the same links. Nothing is inferred from content, timing or meaning.</p>
      </header>
      <Section title="Phases">
        <ol className="space-y-2">
          {ALIGNMENT_METHODOLOGY.phases.map((p) => (
            <li key={p.name} className="rounded-ctl border border-line bg-surface-2 p-2.5">
              <div className="text-xs font-medium text-fg-1">{p.name}</div>
              <p className="mt-1 text-2xs leading-relaxed text-fg-3">{p.rule}</p>
            </li>
          ))}
        </ol>
      </Section>
      <Callout tone="attn" title="Read with these caveats">
        <ul className="list-disc space-y-1 pl-4">{ALIGNMENT_METHODOLOGY.caveats.map((c, i) => <li key={i}>{c}</li>)}</ul>
      </Callout>
      <p className="rounded-ctl border border-dashed border-line-strong px-3 py-2.5 text-xs leading-relaxed text-fg-3">Select a link, or an event on either side, to see exactly what was compared.</p>
    </div>
  );
}

export function PairInspector({ link, sessionA, sessionB, onClose, onOpenEvent }: {
  link: MapLink;
  sessionA: Session;
  sessionB: Session;
  onClose: () => void;
  onOpenEvent: (eventId: string) => void;
}) {
  const fields = compareFields(link.a, link.b);
  const anyCompared = fields.some((f) => f.compared);
  const paired = link.a && link.b;
  const title = paired ? `A·${link.a!.seq} ↔ B·${link.b!.seq}` : link.a ? `A·${link.a.seq} ↔ —` : `— ↔ B·${link.b!.seq}`;
  const others = link.differences.filter((d) => d.aspect !== 'field');

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-4">
        <span className="eyebrow">Link</span>
        <span className="font-mono text-2xs text-fg-2">{title}</span>
        <IconButton label="Close link" onClick={onClose} className="ml-auto"><X className="h-3.5 w-3.5" aria-hidden /></IconButton>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto scrollbar-thin px-4 py-4">
        <header>
          <ClassTag cls={link.cls} />
          <p className="mt-2 text-xs leading-relaxed text-fg-2">{CLASS_MEANING[link.cls]}</p>
          <p className="mt-1 text-2xs leading-relaxed text-fg-3">{NOT_ESTABLISHED[link.cls]}</p>
        </header>

        {paired && (
          <Section title="Compared fields" note="tool · path · cmd">
            {anyCompared ? (
              <ul className="overflow-hidden rounded-ctl border border-line">
                {fields.map((f) => (
                  <li key={f.field} className="border-b border-line-subtle px-2.5 py-2 last:border-b-0">
                    <div className="flex items-center gap-2 font-mono text-2xs">
                      <span className="text-fg-3">{f.field}</span>
                      <span className={`ml-auto ${!f.compared ? 'text-fg-4' : f.same ? 'text-fg-3' : 'text-attn'}`}>{!f.compared ? 'not recorded on either side' : f.same ? '= same' : '≠ differs'}</span>
                    </div>
                    {f.compared && (f.same ? (
                      <div className="mt-1 break-all font-mono text-2xs text-fg-2">{f.a}</div>
                    ) : (
                      <div className="mt-1 space-y-0.5 font-mono text-2xs">
                        <div className="flex gap-2"><span className="w-3 shrink-0 text-fg-3">A</span><span className="min-w-0 break-all text-fg-1">{f.a ?? <span className="text-fg-3">not recorded</span>}</span></div>
                        <div className="flex gap-2"><span className="w-3 shrink-0 text-fg-3">B</span><span className="min-w-0 break-all text-fg-1">{f.b ?? <span className="text-fg-3">not recorded</span>}</span></div>
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-ctl border border-dashed border-line-strong px-3 py-2 text-xs leading-relaxed text-fg-3">Neither event records a compared field, so only kind and tool were available to compare. That is why this pair can be proposed but never exact.</p>
            )}
            {others.length > 0 && (
              <div className="mt-2.5">
                <div className="eyebrow mb-1">Also differs across this link</div>
                <DefList>{others.map((d) => <Def key={d.aspect} k={d.label}>{d.a} <span className="text-fg-3">vs</span> {d.b}</Def>)}</DefList>
              </div>
            )}
          </Section>
        )}

        <EventCard label="Trajectory A" session={sessionA} event={link.a} onOpen={onOpenEvent} />
        <EventCard label="Trajectory B" session={sessionB} event={link.b} onOpen={onOpenEvent} />
      </div>
    </div>
  );
}

function EventCard({ label, session, event, onOpen }: { label: string; session: Session; event: TrajectoryEvent | null; onOpen: (id: string) => void }) {
  if (!event) {
    return (
      <Section title={label}>
        <p className="rounded-ctl border border-dashed border-line-strong px-3 py-2.5 font-mono text-2xs text-fg-3">no corresponding event proposed</p>
      </Section>
    );
  }
  const Icon = categoryMeta[event.category].icon;
  const best = bestEvidence(event.evidence);
  return (
    <Section title={`${label} · seq ${event.seq}`} note={session.id}>
      <div className="rounded-ctl border border-line bg-surface-2 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-fg-3" aria-hidden />
          <span className="text-xs font-medium text-fg-1">{event.title}</span>
          {best && <ProvTag kind={best} />}
          <StatusMark status={event.status} />
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-fg-3">{event.summary}</p>
        <div className="mt-2.5"><Button onClick={() => onOpen(event.id)} leading={<ExternalLink className="h-3 w-3" aria-hidden />}>open in Observe →</Button></div>
      </div>
      <Section title="Evidence" collapsible defaultOpen={false} className="mt-2" note={`${event.evidence.length}`}>
        <EvidenceList items={event.evidence} sources={session.sources} />
      </Section>
    </Section>
  );
}
