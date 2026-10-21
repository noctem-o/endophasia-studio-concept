// @vitest-environment jsdom
// A projection arm must never land on a results axis, in ANY view. The Experiments view guards this (ProjectionCard); the Candidates
// evaluation card must too. The shipped corpus has no candidate-linked projection arm, so this builds one.
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { evolveCorpus } from '@/data/evolve';
import type { EvolveCorpus } from '@/domain/evolve';
import { CandidatesSection } from '../CandidatesSection';

afterEach(cleanup);

describe('the Candidates evaluation card and a projection arm', () => {
  it('draws no pass-rate bar for a projection arm that a candidate is linked to, and says it has no pass rate', () => {
    const corpus: EvolveCorpus = {
      ...evolveCorpus,
      arms: evolveCorpus.arms.map((a) => (a.id === 'arm-cf-sim' ? { ...a, candidateId: 'cand-retry' } : a)),
    };
    const { container } = render(<CandidatesSection corpus={corpus} candidateId="cand-retry" onSelect={() => {}} onOpenExecution={() => {}} onOpenExperiment={() => {}} />);
    const card = [...container.querySelectorAll('div.rounded-panel')].find((d) => d.textContent?.includes('Experiment 5'))!;
    expect(card).toBeTruthy();
    expect(card.textContent).toContain('A projection has no pass rate');
    // No interval bar for the projection arm, and no "no verdicts" sentence that would imply results could arrive.
    expect(card.textContent).not.toMatch(/no verdicts/);
    expect(card.querySelectorAll('[role="img"][aria-label*="Wilson"], [role="img"][aria-label^="no pass/fail"]').length).toBeLessThanOrEqual(1); // the replay arm's bar only
  });
});
