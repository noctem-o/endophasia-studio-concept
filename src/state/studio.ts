import { useCallback, useMemo, useState } from 'react';
import { sessions, sessionById } from '../data/fixtures';
import type { Session } from '../domain/types';

export type WorkspaceId = 'observe' | 'compare' | 'capabilities' | 'evolve';

export type EvolveView =
  | { kind: 'corpus' }
  | { kind: 'execution'; executionId: string }
  | { kind: 'checkpoint'; checkpointId: string }
  | { kind: 'experiment'; experimentId: string }
  | { kind: 'candidate'; candidateId: string };

export function useStudioState() {
  const [workspace, setWorkspace] = useState<WorkspaceId>('observe');
  const [sessionId, setSessionId] = useState(sessions[0].id);
  const [eventId, setEventId] = useState<string | null>(null);
  const [capabilityId, setCapabilityId] = useState<string | null>(null);
  const [compareA, setCompareA] = useState<string>(sessions[0].id);
  const [compareB, setCompareB] = useState<string>('run-6c07e4');
  const [evolveView, setEvolveView] = useState<EvolveView>({ kind: 'corpus' });

  const session: Session = useMemo(
    () => sessionById(sessionId) ?? sessions[0],
    [sessionId],
  );

  const compareSessionA: Session = useMemo(
    () => sessionById(compareA) ?? sessions[0],
    [compareA],
  );

  const compareSessionB: Session = useMemo(
    () => sessionById(compareB) ?? sessions[0],
    [compareB],
  );

  const selectedEvent = useMemo(
    () => session.events.find((e) => e.id === eventId) ?? null,
    [session, eventId],
  );

  const selectedCapability = useMemo(
    () => session.capabilities.find((c) => c.id === capabilityId) ?? null,
    [session, capabilityId],
  );

  const selectSession = useCallback((id: string) => {
    setSessionId(id);
    setEventId(null);
    setCapabilityId(null);
  }, []);

  /** Jump from another workspace to the observation view of one event. */
  const inspectEventOf = useCallback((id: string) => {
    setWorkspace('observe');
    setEventId(id);
  }, []);

  const openEvolve = useCallback((view: EvolveView) => {
    setWorkspace('evolve');
    setEvolveView(view);
  }, []);

  return {
    // navigation
    workspace, setWorkspace,
    // observation
    session, sessions, selectSession,
    eventId, setEventId, selectedEvent,
    capabilityId, setCapabilityId, selectedCapability,
    // compare
    compareA, setCompareA,
    compareB, setCompareB,
    compareSessionA, compareSessionB,
    // evolve
    evolveView, setEvolveView, openEvolve,
    // cross-workspace
    inspectEventOf,
  };
}

export type StudioState = ReturnType<typeof useStudioState>;
