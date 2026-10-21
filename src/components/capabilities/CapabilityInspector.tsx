import type { Capability, EvidenceItem, Session } from '../../domain/types';
import { capabilityMeta } from '../../state/meta';
import { backing, exercisedBy } from '../../state/capabilities';
import { Def, DefList, Section } from '../../ui/layout';
import { CapabilityGlyph, ProvGlyph, ProvMark, StatusMark } from '../../ui/marks';
import { EvidenceList } from '../EvidenceList';
import { ExerciseStrip } from './CapabilityMatrix';

function Statement({ title, kind, text, items, emptyNote }: { title: string; kind: 'REP' | 'OBS'; text: string; items: EvidenceItem[]; emptyNote: string }) {
  const backed = items.length > 0;
  return (
    <div className={`rounded-ctl border p-3 ${backed ? 'border-line-strong bg-surface-2' : 'hatch-faint border-dashed border-line bg-surface-1'}`}>
      <div className="flex items-center gap-2">
        <span className="eyebrow">{title}</span>
        <span className="ml-auto">{backed ? <ProvMark kind={kind} /> : <ProvMark kind="NA" label title="No evidence of this class backs the statement" />}</span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-fg-1">{text}</p>
      {!backed && <p className="mt-1.5 font-mono text-2xs leading-relaxed text-fg-3">{emptyNote}</p>}
    </div>
  );
}

export function CapabilityInspector({ session, capability, onInspect }: {
  session: Session;
  capability: Capability;
  onInspect: (eventId: string) => void;
}) {
  const m = capabilityMeta[capability.status];
  const b = backing(capability);
  const used = exercisedBy(session, capability);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-4">
        <span className="eyebrow">Capability</span>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto scrollbar-thin px-4 py-4">
        <header>
          <div className="flex items-center gap-2">
            <CapabilityGlyph status={capability.status} size={14} />
            <h2 className="font-mono text-base font-medium text-fg-1">{capability.name}</h2>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-tag border px-1.5 font-mono text-2xs font-medium tracking-wider ${m.text} ${m.border} ${m.bg}`}>{m.label}</span>
            <span className="text-xs text-fg-3">{m.desc}</span>
          </div>
        </header>

        <Section title="Declared and observed">
          <div className="space-y-2">
            <Statement title="Declared" kind="REP" text={capability.declared} items={b.declared} emptyNote="No reported evidence backs this statement." />
            <Statement title="Observed" kind="OBS" text={capability.observed} items={b.observed} emptyNote="No observed evidence backs this. The capability was not exercised, or the record does not show it; neither is claimed." />
          </div>
          <p className="mt-2 text-2xs leading-relaxed text-fg-3">Declared is what the runtime said. Observed is what the record shows. Admission without exercise is unverified, not functional.</p>
        </Section>

        {capability.restrictions.length > 0 && (
          <Section title="Restrictions" note={`${capability.restrictions.length}`}>
            <ul className="space-y-1">
              {capability.restrictions.map((r, i) => <li key={i} className="flex gap-2 text-xs leading-relaxed text-fg-2"><ProvGlyph kind="REP" size={9} className="mt-1.5" />{r}</li>)}
            </ul>
          </Section>
        )}

        <Section title="Evidence" note={`${capability.evidence.length}`}>
          <EvidenceList items={capability.evidence} sources={session.sources} />
        </Section>

        <Section title="Exercised in this session" note={`${used.length}`}>
          <div className="mb-2"><ExerciseStrip session={session} cap={capability} width={220} /></div>
          {used.length === 0 ? (
            <p className="text-xs leading-relaxed text-fg-3">No event in this session records use of this capability.</p>
          ) : (
            <ul className="space-y-1">
              {used.map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => onInspect(e.id)} className="flex w-full items-center gap-2 rounded-ctl border border-line bg-surface-2 px-2.5 py-1.5 text-left transition-colors duration-100 hover:border-line-strong hover:bg-surface-3">
                    <span className="w-12 shrink-0 whitespace-nowrap font-mono text-2xs text-fg-3 tnum">seq {e.seq}</span>
                    <span className="min-w-0 flex-1 truncate text-xs text-fg-1">{e.title}</span>
                    <StatusMark status={e.status} showOk />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Session context" collapsible defaultOpen={false}>
          <DefList>
            <Def k="session">{session.id}</Def>
            <Def k="task" mono={false}>{session.taskId}</Def>
            <Def k="runtime">{session.runtime.runtime} {session.runtime.runtimeVersion}</Def>
            <Def k="harness">{session.runtime.harness}</Def>
            {session.runtime.config.map((c) => <Def key={c.key} k={c.key}>{c.value}{c.degraded && <span className="ml-2 text-attn">degraded</span>}</Def>)}
          </DefList>
        </Section>
      </div>
    </div>
  );
}
