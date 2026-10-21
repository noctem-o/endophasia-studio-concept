import { useMemo, useState } from 'react';
import { useCallback, useEffect } from 'react';
import { GitCompareArrows } from 'lucide-react';
import { sessions, sessionById } from '@/data/sessions';
import type { Capability, TrajectoryEvent } from '@/data/types';
import { Header } from '@/components/Header';
import { RuntimePanel } from '@/components/RuntimePanel';
import { CapabilityList, CapabilityDetail } from '@/components/CapabilityPanel';
import { TrajectoryPanel } from '@/components/TrajectoryPanel';
import { EventInspector } from '@/components/EventInspector';
import { SourcesPanel } from '@/components/SourcesPanel';
import { DivergencePreview } from '@/components/DivergencePreview';
import { SectionLabel } from '@/components/primitives';

export default function App() {
  const [sessionId, setSessionId] = useState(sessions[0].id);
  const [eventId, setEventId] = useState<string | null>(null);
  const [capId, setCapId] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<'inspector' | 'sources'>('inspector');
  const [conceptPreview, setConceptPreview] = useState(false);

  const session = useMemo(() => sessionById(sessionId), [sessionId]);

  const selectSession = useCallback((id: string) => {
    setSessionId(id);
    setEventId(null);
    setCapId(null);
  }, []);

  // Reset selection when the session changes.
  useEffect(() => {
    setEventId(null);
    setCapId(null);
  }, [sessionId]);

  const selectedEvent: TrajectoryEvent | null = useMemo(
    () => session.events.find((e) => e.id === eventId) ?? null,
    [session, eventId],
  );

  const selectedCap: Capability | null = useMemo(
    () => session.capabilities.find((c) => c.id === capId) ?? null,
    [session, capId],
  );

  const inspector = selectedEvent
    ? { type: 'event' as const, event: selectedEvent }
    : selectedCap
      ? { type: 'capability' as const }
      : null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-ink-950">
      <Header sessions={sessions} activeId={sessionId} onSelect={selectSession} />

      {conceptPreview ? (
        <DivergencePreview onBack={() => setConceptPreview(false)} />
      ) : (
        <main className="grid min-h-0 flex-1 grid-cols-1 gap-px bg-ink-700/50 lg:grid-cols-[300px_minmax(0,1fr)_400px]">
          <aside className="flex min-h-0 flex-col overflow-y-auto scrollbar-thin bg-ink-900">
            <section aria-label="Runtime identity">
              <SectionLabel>Runtime</SectionLabel>
              <RuntimePanel
                runtime={session.runtime}
                sessionLabel={session.label}
                taskId={session.taskId}
                state={session.state}
                durationMs={session.durationMs}
              />
            </section>
            <section aria-label="Capability inventory" className="flex min-h-0 flex-1 flex-col border-t border-ink-700/60">
              <SectionLabel right={<span className="font-mono text-[10px] text-ink-500">{session.capabilities.length} records</span>}>
                Capability inventory
              </SectionLabel>
              <div className="min-h-0 flex-1">
                <CapabilityList
                  capabilities={session.capabilities}
                  selectedId={capId}
                  onSelect={(c) => {
                    setCapId(c.id);
                    setEventId(null);
                    setRightTab('inspector');
                  }}
                />
              </div>
            </section>
          </aside>

          <section aria-label="Agent trajectory" className="flex min-h-0 flex-col bg-ink-950">
            <SectionLabel
              right={
                <button
                  onClick={() => setConceptPreview(true)}
                  className="flex items-center gap-1.5 rounded-[3px] border border-blue-accent/40 bg-blue-accent/8 px-2 py-0.5 font-mono text-[10px] tracking-wider text-blue-accent transition-colors hover:bg-blue-accent/15"
                >
                  <GitCompareArrows className="h-3 w-3" aria-hidden />
                  CONCEPT PREVIEW
                </button>
              }
            >
              Agent trajectory — {session.id}
            </SectionLabel>
            <div className="min-h-0 flex-1">
              <TrajectoryPanel
                session={session}
                selectedEventId={eventId}
                onSelectEvent={(e) => {
                  setEventId(e.id);
                  setCapId(null);
                  setRightTab('inspector');
                }}
              />
            </div>
          </section>

          <aside className="flex min-h-0 flex-col bg-ink-900">
            <div className="flex items-stretch border-b border-ink-700/60">
              {(
                [
                  ['inspector', 'Evidence inspector'],
                  ['sources', 'Source integrity'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setRightTab(key)}
                  aria-pressed={rightTab === key}
                  className={`flex-1 border-b-2 px-3 py-2 font-mono text-2xs uppercase tracking-widest transition-colors ${
                    rightTab === key
                      ? 'border-teal-accent text-ink-50'
                      : 'border-transparent text-ink-400 hover:text-ink-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
              {rightTab === 'inspector' ? (
                inspector?.type === 'event' ? (
                  <EventInspector event={selectedEvent} />
                ) : inspector?.type === 'capability' && selectedCap ? (
                  <CapabilityDetail cap={selectedCap} />
                ) : (
                  <EventInspector event={null} />
                )
              ) : (
                <SourcesPanel sources={session.sources} />
              )}
            </div>
          </aside>
        </main>
      )}

      <footer className="flex shrink-0 items-center gap-4 border-t border-ink-700/70 bg-ink-900 px-4 py-1.5 font-mono text-[10px] text-ink-500">
        <span>endophasia studio — design exploration</span>
        <span aria-hidden className="h-3 w-px bg-ink-700" />
        <span className="text-amber-accent/80">all data shown is demonstration data; not connected to a real runtime</span>
        <span className="ml-auto hidden md:inline">read-only surface · provenance-first · observation ≠ interpretation</span>
      </footer>
    </div>
  );
}
