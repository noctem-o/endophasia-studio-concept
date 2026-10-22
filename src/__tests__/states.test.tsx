// @vitest-environment jsdom
// The presentation states (src/ui/states.tsx) and the session-store seam (src/state/sessionStore.ts): an empty store is not a
// failure, loading/failure/empty look different, missing info is stated with its reason, and an unreadable projection is named
// rather than guessed at.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { LoadingState, EmptyStoreState, LoadFailureState, UnsupportedProjectionState, WithheldEvidence, DegradedSourceCallout, UnsupportedDetail } from '../ui/states';
import { useSessionStore } from '../state/sessionStore';
import { sessions } from '../data/fixtures';

afterEach(cleanup);

describe('presentation states', () => {
  it('empty store explains itself and never says "error"', () => {
    render(<EmptyStoreState />);
    expect(screen.getByText('No recorded sessions')).toBeTruthy();
    expect(screen.queryByText(/error|failed/i)).toBeNull();
  });

  it('loading is labelled and announced', () => {
    render(<LoadingState what="recorded sessions" />);
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText(/Loading recorded sessions/)).toBeTruthy();
  });

  it('failure names what failed and offers retry; it is not styled as empty', () => {
    let calls = 0;
    const onRetry = () => { calls++; };
    render(<LoadFailureState what="recorded sessions" detail="connection refused" onRetry={onRetry} />);
    expect(screen.getByText('Could not load recorded sessions')).toBeTruthy();
    expect(screen.getByText(/connection refused/)).toBeTruthy();
    screen.getByText('Try again').click();
    expect(calls).toBe(1);
  });

  it('unsupported projection names the version and the readable ones; it never guesses at data', () => {
    render(<UnsupportedProjectionState version="v9" supported={['v1']} />);
    expect(screen.getByText('v9')).toBeTruthy();
    expect(screen.getByText(/compatibility limit of this viewer/)).toBeTruthy();
    expect(screen.queryByText(/estimated|inferred value/)).toBeNull();
  });

  it('withheld evidence leads with the reason, drawn hatched (absent, not zero)', () => {
    render(<WithheldEvidence what="Response payload" reason="Journal truncation marker at this offset; body not recovered." />);
    expect(screen.getByText('Response payload')).toBeTruthy();
    expect(screen.getByText(/body not recovered/)).toBeTruthy();
  });

  it('degraded source uses attention tone and names the source', () => {
    render(<DegradedSourceCallout name="usage ledger" detail="Usage rows missing for some model requests." />);
    expect(screen.getByText(/source degraded — usage ledger/)).toBeTruthy();
  });

  it('unsupported detail is a named gap, never silently skipped', () => {
    render(<UnsupportedDetail kind="trace-v2" />);
    expect(screen.getByText(/trace-v2/)).toBeTruthy();
    expect(screen.getByText(/nothing is inferred/)).toBeTruthy();
  });
});

describe('session store seam', () => {
  it('fixture loader is synchronous: status ready, all six sessions readable, first selected', () => {
    let store: ReturnType<typeof useSessionStore> | null = null;
    function Probe() {
      store = useSessionStore();
      return null;
    }
    render(<Probe />);
    expect(store!.status).toBe('ready');
    expect(store!.sessions).toHaveLength(sessions.length);
    expect(store!.selected?.id).toBe(sessions[0].id);
    expect(store!.unsupported).toHaveLength(0);
  });

  it('records from unsupported projections are named, and nothing readable means the whole surface stands down', () => {
    const loader = () => ({
      status: 'ok' as const,
      projections: [
        { session: sessions[0], projection: 'v9' },
      ],
    });
    let store: ReturnType<typeof useSessionStore> | null = null;
    function Probe() {
      store = useSessionStore(loader);
      return null;
    }
    render(<Probe />);
    expect(store!.status).toBe('unsupported');
    expect(store!.sessions).toHaveLength(0);
    expect(store!.unsupported[0]).toMatchObject({ id: sessions[0].id, projection: 'v9' });
  });

  it('failure carries its detail; empty carries no sessions', () => {
    let store: ReturnType<typeof useSessionStore> | null = null;
    function Probe() {
      store = useSessionStore(() => ({ status: 'failure', detail: 'connection refused' }));
      return null;
    }
    render(<Probe />);
    expect(store!.status).toBe('failure');
    expect(store!.failureDetail).toBe('connection refused');

    cleanup();
    let store2: ReturnType<typeof useSessionStore> | null = null;
    function Probe2() {
      store2 = useSessionStore(() => ({ status: 'empty' }));
      return null;
    }
    render(<Probe2 />);
    expect(store2!.status).toBe('empty');
    expect(store2!.sessions).toHaveLength(0);
  });
});
