import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StudioState } from '../state/studio';
import { isPlainShortcut } from '../state/keys';
import { categoryCounts, evidenceMix, filterEvents, matchesFilters, NO_FILTERS, stepVisible } from '../state/observe';
import type { EventFilters } from '../state/observe';
import { InspectorColumn } from '../components/InspectorColumn';
import { SessionSwitcher } from '../components/SessionSwitcher';
import { WorkspaceBar } from '../components/AppShell';
import { TrajectoryOverview } from '../components/observe/TrajectoryOverview';
import type { OverviewAxis } from '../components/observe/TrajectoryOverview';
import { FilterBar } from '../components/observe/FilterBar';
import { EventTable } from '../components/observe/EventTable';
import { EventInspector } from '../components/observe/EventInspector';
import { SessionBrief } from '../components/observe/SessionBrief';

export function ObservationWorkspace({ studio }: { studio: StudioState }) {
  const session = studio.session;
  const [filters, setFilters] = useState<EventFilters>(NO_FILTERS);
  const [axis, setAxis] = useState<OverviewAxis>('order');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [windowSeq, setWindowSeq] = useState<[number, number] | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => filterEvents(session, filters), [session, filters]);
  const matching = useMemo(() => new Set(filtered.map((e) => e.id)), [filtered]);
  const selected = filtered.find((e) => e.id === studio.eventId) ?? null;
  const selectedIndex = selected ? filtered.indexOf(selected) : -1;

  const catCounts = useMemo(() => categoryCounts(session.events), [session]);
  const evCounts = useMemo(() => evidenceMix(session.events).counts, [session]);
  const statusCounts = useMemo(() => {
    const c = { ok: 0, error: 0, partial: 0 };
    for (const e of session.events) c[e.status]++;
    return c;
  }, [session]);

  const { setEventId } = studio;

  /** Select an event. If the filters would hide it, they are reset first: a link must never land on nothing. */
  const select = useCallback((id: string) => {
    const target = session.events.find((e) => e.id === id);
    if (target && !matchesFilters(target, filters)) setFilters(NO_FILTERS);
    setEventId(id);
  }, [session, filters, setEventId]);

  const step = useCallback((delta: 1 | -1) => {
    const next = stepVisible(filtered, selected?.id ?? null, delta);
    if (next) setEventId(next.id);
  }, [filtered, selected, setEventId]);

  // j/k walk the events being shown (never one the filters hide); / focuses search; Esc returns to the session brief.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isPlainShortcut(e)) return;
      if (e.key === 'j') { e.preventDefault(); step(1); }
      else if (e.key === 'k') { e.preventDefault(); step(-1); }
      else if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.key === 'Escape' && studio.eventId) { setEventId(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, studio.eventId, setEventId]);

  // Changing session clears what was being hovered or scrolled to.
  useEffect(() => { setHoveredId(null); setWindowSeq(null); }, [session.id]);

  const minutes = session.durationMs / 1000;

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <WorkspaceBar>
          <SessionSwitcher sessions={studio.sessions} value={session.id} onChange={studio.selectSession} />
          <dl className="hidden items-center gap-x-5 font-mono text-2xs text-fg-3 xl:flex">
            <div className="flex gap-1.5"><dt>duration</dt><dd className="text-fg-2 tnum">{minutes.toFixed(1)} s</dd></div>
            <div className="flex gap-1.5"><dt>runtime</dt><dd className="text-fg-2">{session.runtime.runtime} {session.runtime.runtimeVersion}</dd></div>
            <div className="flex gap-1.5"><dt>harness</dt><dd className="text-fg-2">{session.runtime.harness}</dd></div>
          </dl>
        </WorkspaceBar>

        <TrajectoryOverview
          session={session}
          matching={matching}
          selectedId={selected?.id ?? null}
          hoveredId={hoveredId}
          onSelect={select}
          onHover={setHoveredId}
          windowSeq={windowSeq}
          axis={axis}
          onAxis={setAxis}
        />

        <FilterBar
          filters={filters}
          onChange={setFilters}
          onReset={() => setFilters(NO_FILTERS)}
          shown={filtered.length}
          total={session.events.length}
          categoryCounts={catCounts}
          evidenceCounts={evCounts}
          statusCounts={statusCounts}
          searchRef={searchRef}
        />

        <EventTable
          events={filtered}
          selectedId={selected?.id ?? null}
          hoveredId={hoveredId}
          onSelect={select}
          onHover={setHoveredId}
          onWindow={setWindowSeq}
        />
      </div>

      <InspectorColumn
        label="Event inspector"
        open={selected !== null}
        onClose={() => setEventId(null)}
      >
        {selected ? (
          <EventInspector
            key={selected.id}
            session={session}
            event={selected}
            position={{ index: selectedIndex, total: filtered.length }}
            onStep={step}
            onNavigate={select}
          />
        ) : (
          <SessionBrief session={session} onSelect={select} />
        )}
      </InspectorColumn>
    </div>
  );
}
