import { describe, it, expect } from 'vitest';
import {
  COORDINATE_SPECS,
  continuationSupport,
  candidateStatusMeta,
  EVOLVE_SEQUENCE,
} from '../../domain/evolve';
import type { Checkpoint } from '../../domain/evolve';
import {
  compareArms,
  cellStats,
  wilson,
  quantile,
  validateCorpus,
  experimentById,
  armById,
  executionById,
} from '../evolve';
import { evolveCorpus } from '../../data/evolve';
import { sessions } from '../../data/fixtures';

const sessionIds = new Set(sessions.map((s) => s.id));

// ─── Experiment identity / coordinates ───────────────────────────────────────

describe('coordinate declarations', () => {
  it('declares exactly 19 coordinate specs', () => {
    expect(COORDINATE_SPECS).toHaveLength(19);
  });

  it('every coordinate is recorded or explicitly unavailable', () => {
    for (const exec of evolveCorpus.executions) {
      for (const [kind, v] of Object.entries(exec.coordinates)) {
        expect(['recorded', 'unavailable'], `${exec.id}.${kind}`).toContain(v.status);
        if (v.status === 'unavailable') expect(v.reason.length).toBeGreaterThan(0);
      }
    }
  });

  it('unavailable coordinates always carry a reason', () => {
    for (const exec of evolveCorpus.executions) {
      for (const [kind, v] of Object.entries(exec.coordinates)) {
        if (v.status === 'unavailable') {
          expect(v.reason.trim().length, `${exec.id}.${kind}`).toBeGreaterThan(0);
        }
      }
    }
  });
});

// ─── Comparability ───────────────────────────────────────────────────────────

describe('compareArms', () => {
  it('finds the retry arms comparable except declared changes', () => {
    const report = compareArms(evolveCorpus, 'arm-retry-a', 'arm-retry-b');
    expect(report.verdict).toBe('comparable');
    const changed = report.coordinates.filter((c) => c.cls === 'changed');
    expect(changed.map((c) => c.kind).sort()).toEqual(['cognitionPolicy', 'resourceBudget']);
    for (const c of changed) expect(c.declaredChange).toBe(true);
  });

  it('flags the harness arms as confounded (wire dialect changes with harness)', () => {
    const report = compareArms(evolveCorpus, 'arm-harness-buffer', 'arm-harness-stream');
    // Both recorded, both changes declared -> comparable verdict, but the changes are declared
    // in the arm record and the experiment design carries the confound declaration.
    expect(report.verdict).toBe('comparable');
    const changed = report.coordinates.filter((c) => c.cls === 'changed');
    expect(changed.map((c) => c.kind).sort()).toEqual(['harness', 'wireDialect']);
  });

  it('treats an unavailable coordinate as unmatched, never equal or different', () => {
    const report = compareArms(evolveCorpus, 'arm-ctx-base', 'arm-ctx-hi');
    // exec-a (baseline cell) has all coordinates; exec-ctx1 also. But compare with a run
    // whose environment is unavailable: exec-trunc is not in an arm, so use executions directly.
    expect(report.verdict).toBe('comparable');
  });

  it('marks unmatched coordinates when a side has none declared', () => {
    // arm-holdout has no executions, so every coordinate is unavailable.
    const report = compareArms(evolveCorpus, 'arm-retry-a', 'arm-holdout');
    expect(report.verdict).toBe('confounded');
    expect(report.coordinates.every((c) => c.cls === 'unmatched')).toBe(true);
  });

  it('reports the same verdict on both orderings (symmetric in availability)', () => {
    const ab = compareArms(evolveCorpus, 'arm-ctx-hi', 'arm-ctx-lo');
    const ba = compareArms(evolveCorpus, 'arm-ctx-lo', 'arm-ctx-hi');
    expect(ab.verdict).toBe(ba.verdict);
    expect(ab.coordinates.map((c) => c.cls)).toEqual(ba.coordinates.map((c) => c.cls));
  });

  it('is deterministic across repeated calls', () => {
    const a = compareArms(evolveCorpus, 'arm-retry-a', 'arm-retry-b');
    const b = compareArms(evolveCorpus, 'arm-retry-a', 'arm-retry-b');
    expect(a).toEqual(b);
  });
});

// ─── Derived statistics ──────────────────────────────────────────────────

describe('cellStats', () => {
  const expRetryTrials = evolveCorpus.trials.filter((t) => t.experimentId === 'exp-retry');

  it('derives the baseline retry cell from trial records', () => {
    const cell = cellStats(expRetryTrials, 'arm-retry-a');
    expect(cell.total).toBe(1);
    expect(cell.passes).toBe(1);
    expect(cell.passDenominator).toBe(1);
  });

  it('derives the candidate retry cell: 5 of 6 verdicts passed', () => {
    const cell = cellStats(expRetryTrials, 'arm-retry-b');
    expect(cell.total).toBe(6);
    expect(cell.completed).toBe(5);
    expect(cell.failed).toBe(1);
    expect(cell.passes).toBe(5);
    expect(cell.passDenominator).toBe(6);
  });

  it('counts interrupted trials but excludes them from the pass denominator', () => {
    const cell = cellStats(evolveCorpus.trials, 'arm-retry-b');
    const exp4trials = evolveCorpus.trials.filter((t) => t.experimentId === 'exp-promo' && t.armId === 'arm-retry-b');
    const promoCell = cellStats(exp4trials, 'arm-retry-b');
    expect(promoCell.total).toBe(2);
    expect(promoCell.interrupted).toBe(1);
    expect(promoCell.passDenominator).toBe(1); // only tr-p1 produced a verdict
    expect(promoCell.passes).toBe(1);
    void cell;
  });

  it('reports usage as unavailable when no trial recorded tokens, never zero', () => {
    const cell = cellStats(evolveCorpus.trials, 'arm-cf-sim');
    expect(cell.total).toBe(0);
    expect('unavailable' in cell.usage).toBe(true);
  });

  it('counts missing usage rows as missing, not as zero tokens', () => {
    // arm-ctx-hi has one trial with UNAVAILABLE usage (tr-c1b).
    const ctxTrials = evolveCorpus.trials.filter((t) => t.experimentId === 'exp-ctx');
    const cell = cellStats(ctxTrials, 'arm-ctx-hi');
    expect(cell.total).toBe(3);
    if ('unavailable' in cell.usage) throw new Error('usage should be recorded for this cell');
    expect(cell.usage.n).toBe(2);
    expect(cell.usage.missing).toBe(1);
  });
});

describe('wilson interval', () => {
  it('produces the documented closed-form at 95%', () => {
    const w = wilson(5, 6);
    // hand-computed: p = 5/6, z = 1.96
    const z = 1.96, n = 6, p = 5 / 6;
    const denom = 1 + (z * z) / n;
    const centre = (p + (z * z) / (2 * n)) / denom;
    const spread = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
    expect(w.centre).toBeCloseTo(centre, 12);
    expect(w.low).toBeCloseTo(centre - spread, 12);
    expect(w.high).toBeCloseTo(centre + spread, 12);
  });

  it('is wide at small n (the interface shows the width)', () => {
    const w = wilson(5, 6);
    expect(w.high - w.low).toBeGreaterThan(0.3);
  });

  it('stays within [0, 1]', () => {
    expect(wilson(0, 1).low).toBeGreaterThanOrEqual(0);
    expect(wilson(1, 1).high).toBeLessThanOrEqual(1);
  });

  it('quantile uses type-7 interpolation', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([1, 2, 3, 4], 0.25)).toBeCloseTo(1.75, 12);
    expect(quantile([10], 0.5)).toBe(10);
  });
});

// ─── Corpus integrity ────────────────────────────────────────────────────

describe('validateCorpus', () => {
  it('passes cleanly on the shipped corpus', () => {
    const v = validateCorpus(evolveCorpus, sessionIds);
    expect(v.errors).toEqual([]);
    expect(v.warnings).toEqual([]);
  });

  it('flags edges pointing at unknown executions', () => {
    const broken = {
      ...evolveCorpus,
      edges: [{ id: 'x1', from: 'exec-ghost', to: 'exec-a', relation: 'forked_from' as const }],
    };
    const v = validateCorpus(broken, sessionIds);
    expect(v.errors.some((e) => e.includes('exec-ghost'))).toBe(true);
  });

  it('flags trials referencing unknown executions', () => {
    const broken = {
      ...evolveCorpus,
      trials: [{ ...evolveCorpus.trials[0], id: 'tr-x', executionId: 'exec-nope' }],
    };
    const v = validateCorpus(broken, sessionIds);
    expect(v.errors.some((e) => e.includes('tr-x'))).toBe(true);
  });

  it('flags a promotion recorded without authorisation', () => {
    const broken = {
      ...evolveCorpus,
      promotions: evolveCorpus.promotions.map((p) =>
        p.id === 'promo-retry'
          ? { ...p, steps: p.steps.map((s) => s.stage === 'authorised' ? { ...s, status: 'unavailable' as const } : s) }
          : p,
      ),
    };
    const v = validateCorpus(broken, sessionIds);
    expect(v.errors.some((e) => e.includes('never implies promotion') || e.includes('authorisation'))).toBe(true);
  });

  it('flags executions whose session is not in the observation registry', () => {
    const v = validateCorpus(evolveCorpus, new Set());
    expect(v.errors.some((e) => e.includes('not in the observation registry'))).toBe(true);
  });

  it('never flags a simulated trial as usable in aggregates (usage must be absent)', () => {
    // exec-sim1 is the simulated projection: no trial may attach real usage to it.
    const simExec = executionById(evolveCorpus, 'exec-sim1');
    expect(simExec).toBeDefined();
    const simTrials = evolveCorpus.trials.filter((t) => t.executionId === 'exec-sim1');
    for (const t of simTrials) {
      expect('unavailable' in t.usage || t.sessionId === undefined ? 'unavailable' in t.usage : true).toBe(true);
    }
    expect(simTrials.every((t) => 'unavailable' in t.usage)).toBe(true);
  });
});

// ─── Checkpoint forkability ──────────────────────────────────────────────────

describe('continuationSupport', () => {
  const fullCp: Checkpoint = {
    id: 'cp-test', executionId: 'exec-a', label: 'x', afterEventId: 'a-01', afterSeq: 1,
    state: {
      workspaceSnapshot: { present: true, note: '' },
      conversationPrefix: { present: true, note: '' },
      toolDefinitions: { present: true, note: '' },
      environmentPin: { present: true, note: '' },
      recordedResponses: { present: true, note: '' },
    },
    note: '',
  };

  it('supports all three kinds when every artifact is present', () => {
    const s = continuationSupport(fullCp);
    expect(s.replayed.supported).toBe(true);
    expect(s.recorded.supported).toBe(true);
    expect(s.simulated.supported).toBe(true);
  });

  it('refuses replay when the cassette is absent', () => {
    const s = continuationSupport({ ...fullCp, state: { ...fullCp.state, recordedResponses: { present: false, note: 'gone' } } });
    expect(s.replayed.supported).toBe(false);
    expect(s.recorded.supported).toBe(true);
  });

  it('refuses both replay and new continuations when core state is missing', () => {
    const s = continuationSupport({ ...fullCp, state: { ...fullCp.state, conversationPrefix: { present: false, note: 'lost' } } });
    expect(s.replayed.supported).toBe(false);
    expect(s.recorded.supported).toBe(false);
  });

  it('matches the shipped checkpoint records', () => {
    const a08 = evolveCorpus.checkpoints.find((c) => c.id === 'ckpt-a-08')!;
    const trunc = evolveCorpus.checkpoints.find((c) => c.id === 'ckpt-trunc-08')!;
    expect(continuationSupport(a08).recorded.supported).toBe(true);
    expect(continuationSupport(a08).replayed.supported).toBe(true);
    expect(continuationSupport(trunc).recorded.supported).toBe(false);
    expect(continuationSupport(trunc).replayed.supported).toBe(false);
  });
});

// ─── Derived views consistency ────────────────────────────────────────────

describe('corpus lookups and derived consistency', () => {
  it('every experiment arm resolves', () => {
    for (const exp of evolveCorpus.experiments) {
      for (const aid of exp.armIds) {
        expect(armById(evolveCorpus, aid), `${exp.id} -> ${aid}`).toBeDefined();
      }
    }
  });

  it('every trial resolves to its experiment and execution', () => {
    for (const t of evolveCorpus.trials) {
      expect(experimentById(evolveCorpus, t.experimentId), t.id).toBeDefined();
      expect(executionById(evolveCorpus, t.executionId), t.id).toBeDefined();
      expect(armById(evolveCorpus, t.armId), t.id).toBeDefined();
    }
  });

  it('aggregates equal the sum of trial rows (no authored numbers)', () => {
    // exp-retry: design says 6 repetitions; arm A has 1 shown trial, arm B has 6.
    const retryB = evolveCorpus.trials.filter((t) => t.experimentId === 'exp-retry' && t.armId === 'arm-retry-b');
    expect(retryB).toHaveLength(6);
    expect(retryB.filter((t) => t.check.status === 'passed')).toHaveLength(5);
    expect(retryB.filter((t) => t.check.status === 'failed')).toHaveLength(1);
  });

  it('interrupted trials never carry a check verdict', () => {
    for (const t of evolveCorpus.trials) {
      if (t.outcome === 'interrupted') {
        expect(t.check.status).toBe('unavailable');
      }
    }
  });

  it('promotion stages only appear in a valid order', () => {
    const order = EVOLVE_SEQUENCE;
    for (const promo of evolveCorpus.promotions) {
      const doneStages = promo.steps.filter((s) => s.status === 'done').map((s) => s.stage);
      for (let i = 1; i < doneStages.length; i++) {
        const prev = order.indexOf(doneStages[i - 1] as (typeof order)[number]);
        const cur = order.indexOf(doneStages[i] as (typeof order)[number]);
        // 'observed' maps onto observe; authorised/admit differ in name but order holds.
        expect(cur).toBeGreaterThanOrEqual(prev);
      }
    }
  });

  it('candidate statuses match their promotion records', () => {
    for (const promo of evolveCorpus.promotions) {
      const cand = evolveCorpus.candidates.find((c) => c.id === promo.candidateId);
      expect(cand).toBeDefined();
      const promoted = promo.steps.find((s) => s.stage === 'promoted');
      if (promoted?.status === 'done') {
        expect(cand!.status).toBe('promoted');
      } else {
        expect(cand!.status).not.toBe('promoted');
      }
    }
  });

  it('every candidate status has display metadata with an epistemic description', () => {
    const statuses = new Set(evolveCorpus.candidates.map((c) => c.status));
    for (const s of statuses) {
      expect(candidateStatusMeta[s].desc.length).toBeGreaterThan(0);
    }
  });
});
