import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '../domain/types';
import { sessions as fixtures } from '../data/fixtures';

/**
 * The seam where the demonstration registry is loaded. Today it resolves the bundled synthetic fixtures synchronously; a
 * production build replaces `loadSessions` with a real store reader and keeps the exact same contract:
 *
 *   LoadResult = { status: 'ok', projections: LoadedSession[] }
 *              | { status: 'empty' }
 *              | { status: 'failure', detail?: string }
 *
 * A loader returns a plain value (available immediately) or a Promise (loading is shown until it settles). It never throws:
 * failures are part of the result, so the UI states them rather than crashing.
 *
 * Each LoadedSession names the projection version that wrote it, so a viewer that only understands some versions can say so
 * instead of guessing. The demonstration fixtures all report the version this build reads.
 */

export const SUPPORTED_PROJECTIONS = ['v1'] as const;

export interface LoadedSession {
  session: Session;
  /** The projection version that produced this record, e.g. "v1". */
  projection: string;
}

export type LoadResult =
  | { status: 'ok'; projections: LoadedSession[] }
  | { status: 'empty' }
  | { status: 'failure'; detail?: string };

export type SessionLoader = () => LoadResult | Promise<LoadResult>;

const fixtureLoader: SessionLoader = () => ({
  status: 'ok',
  projections: fixtures.map((session) => ({ session, projection: 'v1' })),
});

export type SessionStoreStatus = 'loading' | 'ready' | 'empty' | 'failure' | 'unsupported';

export interface SessionStore {
  status: SessionStoreStatus;
  /** Sessions this build can read (only when status is 'ready'). */
  sessions: Session[];
  /** Sessions present in the store but written by an unsupported projection version. */
  unsupported: { id: string; label: string; projection: string }[];
  selectedId: string | null;
  selectSession: (id: string) => void;
  selected: Session | null;
  /** Why the load failed, when status is 'failure'. */
  failureDetail?: string;
  retry: () => void;
}

interface Reduced {
  status: SessionStoreStatus;
  supported: LoadedSession[];
  unsupported: { id: string; label: string; projection: string }[];
  failureDetail?: string;
}

const LOADING: Reduced = { status: 'loading', supported: [], unsupported: [] };

function reduce(result: LoadResult): Reduced {
  if (result.status === 'failure') return { status: 'failure', supported: [], unsupported: [], failureDetail: result.detail };
  if (result.status === 'empty' || result.projections.length === 0) return { status: 'empty', supported: [], unsupported: [] };
  const isSupported = (p: LoadedSession) => (SUPPORTED_PROJECTIONS as readonly string[]).includes(p.projection);
  const supported = result.projections.filter(isSupported);
  const unsupported = result.projections.filter((p) => !isSupported(p))
    .map((p) => ({ id: p.session.id, label: p.session.label, projection: p.projection }));
  const status: SessionStoreStatus = supported.length === 0 && unsupported.length > 0 ? 'unsupported' : 'ready';
  return { status, supported, unsupported };
}

/**
 * Runs a loader once per loader identity and reduces its result to the store state machine:
 *   sync loader  → reduced before the first paint (no loading state; works with synchronous consumers and tests)
 *   async loader → loading → ready | empty | failure | unsupported
 * Sessions whose projection version is not supported are kept aside and named, never silently dropped.
 */
export function useSessionStore(loader: SessionLoader = fixtureLoader): SessionStore {
  // A synchronous loader's result is computed eagerly and used for the first render; a promise starts as 'loading' and resolves
  // in the effect below. useMemo keeps one application per loader identity (a new loader function re-applies).
  const first = useMemo(() => loader(), [loader]);
  const [reduced, setReduced] = useState<Reduced>(() => (first instanceof Promise ? LOADING : reduce(first)));
  const [selectedId, setSelectedId] = useState<string | null>(
    () => (first instanceof Promise || first.status !== 'ok' ? null : first.projections.find((p) => (SUPPORTED_PROJECTIONS as readonly string[]).includes(p.projection))?.session.id ?? null),
  );

  useEffect(() => {
    // Async path only: the sync result was already applied above.
    if (!(first instanceof Promise)) return;
    let live = true;
    first.then((result) => { if (live) setReduced(reduce(result)); });
    return () => { live = false; };
  }, [first]);

  const run = useCallback(() => {
    const result = loader();
    if (result instanceof Promise) {
      setReduced(LOADING);
      result.then((r) => { if (runRef.current === loader) setReduced(reduce(r)); });
    } else {
      setReduced(reduce(result));
    }
  }, [loader]);
  const runRef = useRef(loader);
  runRef.current = loader;

  // Selection survival: a selection that still exists in the readable set stands; otherwise the first readable record is shown.
  const sessions = useMemo(() => reduced.supported.map((p) => p.session), [reduced]);
  const selected = (selectedId && sessions.find((s) => s.id === selectedId)) || sessions[0] || null;
  const effectiveSelectedId = selected?.id ?? null;

  return {
    status: reduced.status,
    sessions,
    unsupported: reduced.unsupported,
    selectedId: effectiveSelectedId,
    selectSession: setSelectedId,
    selected,
    failureDetail: reduced.failureDetail,
    retry: run,
  };
}
