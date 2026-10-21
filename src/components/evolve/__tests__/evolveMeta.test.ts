import { describe, it, expect } from 'vitest';
import { evolveCorpus as corpus } from '@/data/evolve';
import { cellStats } from '@/analysis/evolve';
import { isProjectionArm, outcomeQualification } from '../evolveMeta';

describe('projection arms are derived from the lineage record', () => {
  it('exactly the arm anchored by simulated branches is a projection, and no arm with trials is', () => {
    const projections = corpus.arms.filter((a) => isProjectionArm(corpus, a.id)).map((a) => a.id);
    expect(projections).toEqual(['arm-cf-sim']);
    for (const id of projections) expect(corpus.trials.filter((t) => t.armId === id)).toEqual([]);
  });

  it('a replay arm is not a projection', () => {
    expect(isProjectionArm(corpus, 'arm-cf-replay')).toBe(false);
  });
});

describe('outcome comparison is qualified when there is nothing to compare', () => {
  it('refuses to compare a projection with results, in words', () => {
    const q = outcomeQualification(corpus, corpus.trials, 'arm-cf-replay', 'arm-cf-sim');
    expect(q).toMatch(/projection/);
  });

  it('says so when an arm has no verdicts in the experiment (the promotion experiment’s baseline arm)', () => {
    const exp = corpus.experiments.find((x) => x.id === 'exp-promo')!;
    const trials = corpus.trials.filter((t) => t.experimentId === exp.id);
    const empty = exp.armIds.find((id) => cellStats(trials, id).passDenominator === 0)!;
    const other = exp.armIds.find((id) => id !== empty)!;
    expect(outcomeQualification(corpus, trials, empty, other)).toMatch(/no check verdicts/);
  });

  it('offers a comparison (no qualification) when both arms have verdicts', () => {
    const exp = corpus.experiments.find((x) => x.id === 'exp-retry')!;
    const trials = corpus.trials.filter((t) => t.experimentId === exp.id);
    expect(outcomeQualification(corpus, trials, exp.armIds[0], exp.armIds[1])).toBeNull();
  });
});

describe('the interval bar marks the observed fraction, which always lies inside the Wilson interval', () => {
  it('holds for every arm cell in the corpus', () => {
    for (const exp of corpus.experiments) {
      const trials = corpus.trials.filter((t) => t.experimentId === exp.id);
      for (const armId of exp.armIds) {
        const c = cellStats(trials, armId);
        if ('unavailable' in c.passRate) continue;
        const observed = c.passes / c.passDenominator;
        expect(observed, `${exp.id}/${armId}`).toBeGreaterThanOrEqual(c.passRate.low - 1e-12);
        expect(observed, `${exp.id}/${armId}`).toBeLessThanOrEqual(c.passRate.high + 1e-12);
      }
    }
  });

  it('and the Wilson centre is not the observed fraction (which is why it is not printed as the pass rate)', () => {
    const differing = corpus.experiments.flatMap((exp) => {
      const trials = corpus.trials.filter((t) => t.experimentId === exp.id);
      return exp.armIds.map((id) => cellStats(trials, id)).filter((c) => !('unavailable' in c.passRate) && Math.abs(c.passes / c.passDenominator - c.passRate.centre) > 0.01);
    });
    expect(differing.length).toBeGreaterThan(0);
  });
});
