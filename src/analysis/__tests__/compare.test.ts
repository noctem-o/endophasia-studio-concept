import { describe, it, expect } from 'vitest';
import { alignTrajectories, sessionStats, validateSession, ALIGNMENT_METHODOLOGY } from '../compare';
import { sessions } from '../../data/fixtures';
import type { TrajectoryEvent } from '../../domain/types';

const byId = (id: string) => {
  const s = sessions.find((x) => x.id === id);
  if (!s) throw new Error(`missing session ${id}`);
  return s;
};

describe('fixture consistency', () => {
  for (const s of sessions) {
    it(`session ${s.id} passes validation`, () => {
      const v = validateSession(s);
      expect(v.errors, v.errors.join('\n')).toEqual([]);
      expect(v.warnings, v.warnings.join('\n')).toEqual([]);
    });

    it(`session ${s.id} has consistent source record counts`, () => {
      const eventLog = s.sources.find((x) => x.id === 'src:event-log');
      if (eventLog?.condition === 'readable') {
        expect(eventLog.records).toBe(s.events.length);
      }
      const ledger = s.sources.find((x) => x.id === 'src:usage-ledger');
      const present = s.events.filter((e) => e.usage?.present).length;
      if (ledger && ledger.condition === 'readable') {
        expect(ledger.records).toBe(present);
      }
      if (ledger && ledger.condition === 'degraded') {
        expect(ledger.records as number).toBeLessThanOrEqual(present + 4);
      }
    });

    it(`session ${s.id} never presents missing usage as zero`, () => {
      for (const e of s.events) {
        if (e.usage && !e.usage.present) {
          expect(e.usage.reason.length).toBeGreaterThan(0);
        }
      }
    });
  }
});

describe('alignment semantics', () => {
  const a = byId('run-3f92c1');
  const c = byId('run-6c07e4');

  it('pairs the shared prefix as exact or proposed matches', () => {
    const result = alignTrajectories(a.events, c.events);
    const exact = result.filter((r) => r.type === 'exact');
    const proposed = result.filter((r) => r.type === 'proposed');
    // Events without compared fields (tool/path/cmd) fall to phase 2 by design.
    expect(exact.length).toBeGreaterThanOrEqual(4);
    expect(exact.length + proposed.length).toBeGreaterThanOrEqual(8);
  });

  it('produces unmatched records on both sides after divergence', () => {
    const result = alignTrajectories(a.events, c.events);
    const unmatchedA = result.filter((r) => r.type === 'unmatched-a');
    const unmatchedB = result.filter((r) => r.type === 'unmatched-b');
    expect(unmatchedA.length).toBeGreaterThan(0);
    expect(unmatchedB.length).toBeGreaterThan(0);
  });

  it('is deterministic — repeated runs produce identical output', () => {
    const r1 = JSON.stringify(alignTrajectories(a.events, c.events));
    const r2 = JSON.stringify(alignTrajectories(a.events, c.events));
    expect(r1).toBe(r2);
  });

  it('never pairs events with different kinds', () => {
    const result = alignTrajectories(a.events, c.events);
    for (const r of result) {
      if (r.type === 'exact' || r.type === 'proposed') {
        expect(r.a.kind).toBe(r.b.kind);
      }
    }
  });

  it('documents its methodology and caveats', () => {
    expect(ALIGNMENT_METHODOLOGY.phases.length).toBeGreaterThanOrEqual(3);
    expect(ALIGNMENT_METHODOLOGY.caveats.length).toBeGreaterThanOrEqual(3);
  });

  it('handles empty trajectories without throwing', () => {
    expect(alignTrajectories([], []).length).toBe(0);
  });

  it('handles asymmetric empty side', () => {
    const ev: TrajectoryEvent[] = a.events.slice(0, 2);
    const r = alignTrajectories(ev, []);
    expect(r.filter((x) => x.type === 'unmatched-a').length).toBe(2);
  });
});

describe('session statistics', () => {
  it('derives counts consistent with the event list', () => {
    for (const s of sessions) {
      const st = sessionStats(s);
      const sum = Object.values(st.byCategory).reduce((x, y) => x + y, 0);
      expect(sum).toBe(s.events.length);
      expect(st.usageRows + st.usageMissing).toBe(s.events.filter((e) => e.usage).length);
    }
  });

  it('scenario B contains a tool error and a recovery', () => {
    const b = byId('run-2b7e90');
    expect(b.events.some((e) => e.status === 'error' && e.tool === 'shell.exec')).toBe(true);
    expect(b.events.some((e) => e.refs?.some((r) => r.relation === 'recovery_for'))).toBe(true);
  });

  it('scenario F records intervention lifecycle stages as separate events', () => {
    const f = byId('run-1f4c88');
    expect(f.interventions.length).toBe(2);
    const steer = f.interventions.find((i) => i.kind === 'STEER');
    expect(steer?.steps.map((s) => s.stage)).toEqual(['proposed', 'authorised', 'accepted', 'consumed']);
    const queue = f.interventions.find((i) => i.kind === 'QUEUE');
    expect(queue?.steps.map((s) => s.stage)).toEqual(['proposed', 'expired']);
  });

  it('scenario D has missing usage rows with reasons', () => {
    const d = byId('run-8d41aa');
    const missing = d.events.filter((e) => e.usage && !e.usage.present);
    expect(missing.length).toBeGreaterThanOrEqual(3);
    for (const e of missing) {
      expect(e.usage && !e.usage.present && e.usage.reason).toBeTruthy();
    }
  });
});
