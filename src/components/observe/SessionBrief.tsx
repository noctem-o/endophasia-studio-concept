import type { Session, TrajectoryEvent, SourceCondition } from '../../domain/types';
import { categoryMeta, sessionStateMeta } from '../../state/meta';
import { evidenceMix, formatOffset } from '../../state/observe';
import { Kbd } from '../../ui/controls';
import { Def, DefList, Section } from '../../ui/layout';
import { SourceGlyph, SourceConditionTag, StatusMark } from '../../ui/marks';
import { ProvenanceMix } from '../../ui/viz';

/** What the inspector shows before anything is selected: the session as a whole, and where to look first. All of it is a tally or a
 *  lookup of real records; nothing here is scored. */
export function SessionBrief({ session, onSelect }: { session: Session; onSelect: (id: string) => void }) {
  const st = sessionStateMeta[session.state];
  const mix = evidenceMix(session.events);
  const deviations = session.events.filter((e) => e.status !== 'ok');
  const worrying = session.sources.filter((s) => s.condition !== 'readable');
  const degradedSources = session.sources.filter((s: { condition: SourceCondition }) => s.condition === 'degraded');
  const minutes = session.durationMs / 1000;

  return (
    <div className="h-full min-h-0 space-y-4 overflow-y-auto scrollbar-thin px-4 py-4">
      <header>
        <div className="eyebrow">Session</div>
        <h2 className="mt-1 font-serif text-xl leading-snug text-fg-1">{session.label}</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-fg-3">{session.scenario}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className={`rounded-tag border px-1.5 font-mono text-2xs font-medium tracking-wider ${st.text} ${st.border} ${st.bg}`}>{st.label}</span>
          <span className="text-xs text-fg-2">{session.outcome}</span>
        </div>
      </header>

      <Section title="Identity">
        <DefList>
          <Def k="session">{session.id}</Def>
          <Def k="task" mono={false}>{session.taskId}</Def>
          <Def k="started">{session.startedAt}</Def>
          <Def k="duration">{minutes < 60 ? `${minutes.toFixed(1)} s` : formatOffset(session.durationMs).replace('+', '')}</Def>
          <Def k="runtime">{session.runtime.runtime} {session.runtime.runtimeVersion}</Def>
          <Def k="harness">{session.runtime.harness}</Def>
          <Def k="fingerprint"><span title={session.runtime.fingerprint}>{session.runtime.fingerprint.length > 22 ? `${session.runtime.fingerprint.slice(0, 22)}…` : session.runtime.fingerprint}</span></Def>
        </DefList>
      </Section>

      <Section title="Evidence mix" note="events by strongest class">
        <ProvenanceMix counts={mix.counts} total={session.events.length} />
        {mix.none > 0 && <p className="mt-1.5 font-mono text-2xs text-fg-3">{mix.none} {mix.none === 1 ? 'event carries' : 'events carry'} no evidence items.</p>}
        <p className="mt-1.5 text-2xs leading-relaxed text-fg-3">A tally of this session’s records. It is not a quality score.</p>
      </Section>

      <Section title="Deviations" note={`${deviations.length}`}>
        {deviations.length === 0 ? (
          <p className="font-mono text-2xs text-fg-3">every event completed with status ok</p>
        ) : (
          <ul className="space-y-1">
            {deviations.map((e) => <DeviationRow key={e.id} event={e} onSelect={onSelect} />)}
          </ul>
        )}
      </Section>

      <Section title="Sources" note={worrying.length === 0 ? 'all readable' : `${worrying.length} not readable`}>
        {degradedSources.length > 0 && (
          <div className="mb-2 space-y-1.5">
            {degradedSources.map((s) => (
              <div key={s.id} className="rounded-ctl border border-attn/40 bg-attn/10 px-3 py-2">
                <div className="flex items-center gap-2 font-mono text-2xs font-medium uppercase tracking-[0.12em] text-attn">
                  source degraded — {s.name}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-fg-2">{s.note}</p>
              </div>
            ))}
          </div>
        )}
        <ul className="space-y-1">
          {session.sources.map((s) => (
            <li key={s.id} className={`flex items-center gap-2 text-xs ${s.condition === 'unopenable' ? 'text-fault' : 'text-fg-2'}`} title={s.note}>
              <SourceGlyph condition={s.condition} size={11} />
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              <SourceConditionTag condition={s.condition} />
            </li>
          ))}
        </ul>
      </Section>

      <p className="rounded-ctl border border-dashed border-line-strong px-3 py-2.5 text-xs leading-relaxed text-fg-3">
        Select an event in the overview or the table to see its evidence. <Kbd>j</Kbd> <Kbd>k</Kbd> step through the events you are looking at; <Kbd>Esc</Kbd> returns here.
      </p>
    </div>
  );
}

function DeviationRow({ event, onSelect }: { event: TrajectoryEvent; onSelect: (id: string) => void }) {
  const Icon = categoryMeta[event.category].icon;
  return (
    <li>
      <button type="button" onClick={() => onSelect(event.id)} className="flex w-full items-center gap-2 rounded-ctl border border-line bg-surface-2 px-2.5 py-1.5 text-left transition-colors duration-100 hover:border-line-strong hover:bg-surface-3">
        <span className="w-8 shrink-0 font-mono text-2xs text-fg-3 tnum">{event.seq}</span>
        <Icon className="h-3 w-3 shrink-0 text-fg-3" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-xs text-fg-1">{event.title}</span>
        <StatusMark status={event.status} />
      </button>
    </li>
  );
}
