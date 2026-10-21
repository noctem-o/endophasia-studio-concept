import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { Session, TrajectoryEvent } from '../../domain/types';
import { bestEvidence, categoryMeta, sessionStateMeta } from '../../state/meta';
import type { LinkClass, MapLink } from '../../state/compare';
import { linkIndexByEvent } from '../../state/compare';
import { CLASS_LABEL, CLASS_MEANING } from './classMeta';
import { ProvGlyph, StatusMark } from '../../ui/marks';

const ROW = 38;
const GUTTER = 132;

const linkPath = (ya: number, yb: number) => {
  const mid = GUTTER / 2;
  return `M0 ${ya} C${mid} ${ya}, ${mid} ${yb}, ${GUTTER} ${yb}`;
};

/**
 * The two trajectories side by side, each in its OWN storage order, with the alignment drawn between them.
 *   exact       solid ivory link
 *   proposed    dashed violet link (a derived hypothesis, never the look of an exact match)
 *   unmatched   an open stub that goes nowhere: there is no link to draw
 * A marker on a link says that something recorded differs across it (status, evidence class, a compared field). There is no
 * score and no ranking, and a link crossing another is shown as it is.
 */
export function CorrespondenceMap({ a, b, links, selectedIndex, hoverIndex, focusClass, onSelect, onHover }: {
  a: Session;
  b: Session;
  links: MapLink[];
  selectedIndex: number | null;
  hoverIndex: number | null;
  focusClass: LinkClass | null;
  onSelect: (index: number) => void;
  onHover: (index: number | null) => void;
}) {
  const byEvent = linkIndexByEvent(links);
  const rows = Math.max(a.events.length, b.events.length);
  const yOf = (i: number) => i * ROW + ROW / 2;
  const indexOfA = new Map(a.events.map((e, i) => [e.id, i]));
  const indexOfB = new Map(b.events.map((e, i) => [e.id, i]));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_132px_minmax(0,1fr)] gap-0 px-4 pb-6 pt-2" onMouseLeave={() => onHover(null)}>
      <ColumnHeader session={a} side="A" />
      <div />
      <ColumnHeader session={b} side="B" />

      <Column session={a} side="A" byEvent={byEvent} selectedIndex={selectedIndex} hoverIndex={hoverIndex} focusClass={focusClass} onSelect={onSelect} onHover={onHover} />

      <svg width={GUTTER} height={rows * ROW} viewBox={`0 0 ${GUTTER} ${rows * ROW}`} role="img" aria-label={`Links between trajectory A and trajectory B: ${links.filter((l) => l.a && l.b).length} paired, ${links.filter((l) => !l.a || !l.b).length} unmatched.`} className="block">
        {links.map((l) => {
          const dim = focusClass !== null && l.cls !== focusClass;
          const sel = l.index === selectedIndex;
          const hov = l.index === hoverIndex;
          const common = { opacity: dim ? 0.12 : 1 };
          if (l.a && l.b) {
            const d = linkPath(yOf(indexOfA.get(l.a.id)!), yOf(indexOfB.get(l.b.id)!));
            const ya = yOf(indexOfA.get(l.a.id)!);
            const yb = yOf(indexOfB.get(l.b.id)!);
            return (
              <g key={l.index} {...common}>
                <path d={d} fill="none" strokeWidth={sel ? 2.6 : hov ? 2.2 : 1.6} strokeLinecap="round" className={sel ? 'stroke-select' : l.cls === 'exact' ? 'stroke-fg-2' : 'stroke-der'} strokeDasharray={l.cls === 'proposed' ? '5 3.5' : undefined} />
                {l.differences.length > 0 && (
                  <g transform={`translate(${GUTTER / 2} ${(ya + yb) / 2})`}>
                    <path d="M0 -5 5 0 0 5 -5 0z" className="fill-surface-0 stroke-attn" strokeWidth={1.4} />
                    <title>{`Differs across this link: ${l.differences.map((x) => x.label).join(', ')}`}</title>
                  </g>
                )}
                <path d={d} fill="none" stroke="transparent" strokeWidth={14} className="cursor-pointer" onClick={() => onSelect(l.index)} onMouseEnter={() => onHover(l.index)} />
              </g>
            );
          }
          // An unmatched event: an open stub from its own side, ending in a hollow cap. Nothing connects to the other side.
          const fromA = !!l.a;
          const y = yOf(fromA ? indexOfA.get(l.a!.id)! : indexOfB.get(l.b!.id)!);
          const x0 = fromA ? 0 : GUTTER;
          const x1 = fromA ? 30 : GUTTER - 30;
          return (
            <g key={l.index} {...common}>
              <path d={`M${x0} ${y}H${x1}`} fill="none" strokeWidth={sel ? 2.4 : 1.4} strokeLinecap="round" className={sel ? 'stroke-select' : 'stroke-fg-4'} strokeDasharray="2 3" />
              <circle cx={x1} cy={y} r={3.6} className={sel ? 'fill-surface-0 stroke-select' : 'fill-surface-0 stroke-fg-3'} strokeWidth={1.3} />
              <rect x={fromA ? 0 : GUTTER - 44} y={y - ROW / 2 + 2} width={44} height={ROW - 4} fill="transparent" className="cursor-pointer" onClick={() => onSelect(l.index)} onMouseEnter={() => onHover(l.index)}><title>{CLASS_MEANING[l.cls]}</title></rect>
            </g>
          );
        })}
      </svg>

      <Column session={b} side="B" byEvent={byEvent} selectedIndex={selectedIndex} hoverIndex={hoverIndex} focusClass={focusClass} onSelect={onSelect} onHover={onHover} />
    </div>
  );
}

function ColumnHeader({ session, side }: { session: Session; side: 'A' | 'B' }) {
  const st = sessionStateMeta[session.state];
  return (
    <div className="mb-2 min-w-0 rounded-panel border border-line bg-surface-1 px-3 py-2.5 shadow-inset">
      <div className="flex items-center gap-2">
        <span className="grid h-5 w-5 place-items-center rounded-tag border border-line-strong font-mono text-2xs font-semibold text-fg-1">{side}</span>
        <span className="font-mono text-xs font-medium text-fg-1">{session.id}</span>
        <span className={`ml-auto rounded-tag border px-1.5 font-mono text-2xs tracking-wider ${st.text} ${st.border} ${st.bg}`}>{st.label}</span>
      </div>
      <div className="mt-1 truncate text-xs text-fg-2">{session.label}</div>
      <div className="mt-0.5 font-mono text-2xs text-fg-3 tnum">{session.events.length} events · {(session.durationMs / 1000).toFixed(1)} s</div>
    </div>
  );
}

function Column({ session, side, byEvent, selectedIndex, hoverIndex, focusClass, onSelect, onHover }: {
  session: Session;
  side: 'A' | 'B';
  byEvent: Map<string, MapLink>;
  selectedIndex: number | null;
  hoverIndex: number | null;
  focusClass: LinkClass | null;
  onSelect: (index: number) => void;
  onHover: (index: number | null) => void;
}) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const events = session.events;
  const selectedEvent = events.find((e) => byEvent.get(e.id)?.index === selectedIndex);
  const tabStop = (selectedEvent ?? events[0])?.id;

  const onKeyDown = (ev: KeyboardEvent<HTMLUListElement>) => {
    const i = events.findIndex((e) => refs.current.get(e.id) === document.activeElement);
    if (i < 0) return;
    const to = ev.key === 'ArrowDown' ? i + 1 : ev.key === 'ArrowUp' ? i - 1 : ev.key === 'Home' ? 0 : ev.key === 'End' ? events.length - 1 : null;
    if (to === null) return;
    ev.preventDefault();
    const next = events[Math.max(0, Math.min(events.length - 1, to))];
    refs.current.get(next.id)?.focus();
    const l = byEvent.get(next.id);
    if (l) onSelect(l.index);
  };

  return (
    <ul aria-label={`Trajectory ${side}: ${session.id}`} onKeyDown={onKeyDown} className="min-w-0">
      {events.map((e) => {
        const link = byEvent.get(e.id);
        return (
          <EventCell
            key={e.id}
            event={e}
            link={link}
            side={side}
            selected={link?.index === selectedIndex}
            hovered={link?.index === hoverIndex}
            dim={focusClass !== null && link?.cls !== focusClass}
            tabStop={e.id === tabStop}
            setRef={(el) => { if (el) refs.current.set(e.id, el); else refs.current.delete(e.id); }}
            onSelect={() => link && onSelect(link.index)}
            onHover={(on) => onHover(on && link ? link.index : null)}
          />
        );
      })}
    </ul>
  );
}

function EventCell({ event, link, side, selected, hovered, dim, tabStop, setRef, onSelect, onHover }: {
  event: TrajectoryEvent;
  link: MapLink | undefined;
  side: 'A' | 'B';
  selected: boolean;
  hovered: boolean;
  dim: boolean;
  tabStop: boolean;
  setRef: (el: HTMLButtonElement | null) => void;
  onSelect: () => void;
  onHover: (on: boolean) => void;
}) {
  const Icon = categoryMeta[event.category].icon;
  const best = bestEvidence(event.evidence);
  const cls = link?.cls;
  const unmatched = cls === 'unmatched-a' || cls === 'unmatched-b';
  const partner = link && link.a && link.b ? (side === 'A' ? link.b : link.a) : null;
  return (
    <li style={{ height: ROW }} className={dim ? 'opacity-25 transition-opacity duration-100' : 'transition-opacity duration-100'}>
      <button
        type="button"
        ref={setRef}
        tabIndex={tabStop ? 0 : -1}
        aria-pressed={selected}
        aria-label={`Trajectory ${side}, event ${event.seq}: ${event.title}. ${cls ? `${CLASS_LABEL[cls].toLowerCase()}${partner ? `, paired with ${side === 'A' ? 'B' : 'A'} event ${partner.seq}` : ''}` : ''}`}
        onClick={onSelect}
        onMouseEnter={() => onHover(true)}
        onFocus={() => onHover(true)}
        onBlur={() => onHover(false)}
        className={`relative flex h-[34px] w-full items-center gap-2 rounded-ctl border px-2.5 text-left transition-colors duration-100 ${
          selected ? 'border-line-strong bg-surface-3' : hovered ? 'border-line-strong bg-surface-2' : unmatched ? 'border-dashed border-line bg-transparent' : 'border-line bg-surface-1 hover:border-line-strong'
        }`}
      >
        {selected && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 rounded-l-ctl bg-select" />}
        <span className="w-6 shrink-0 text-right font-mono text-2xs text-fg-3 tnum">{event.seq}</span>
        <Icon className="h-3 w-3 shrink-0 text-fg-3" aria-hidden />
        <span className={`min-w-0 flex-1 truncate text-xs ${unmatched ? 'text-fg-2' : 'text-fg-1'}`}>{event.title}</span>
        {best && <ProvGlyph kind={best} size={11} />}
        <StatusMark status={event.status} />
      </button>
    </li>
  );
}
