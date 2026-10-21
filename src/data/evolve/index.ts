import type { EvolveCorpus } from '../../domain/evolve';
import { checkpoints, edges, executions } from './lineage';
import { arms, candidates, experiments, promotions, trials } from './experiments';
import { evolveSources } from './sources';

/**
 * The EVOLVE demonstration corpus. Synthetic, hand-authored, internally
 * consistent, and validated at load by the analysis layer's tests. A future
 * implementation replaces this module with a loader over Endophasia evidence
 * ledgers; the EvolveCorpus shape is the contract.
 */
export const evolveCorpus: EvolveCorpus = {
  checkpoints,
  edges,
  executions,
  candidates,
  experiments,
  arms,
  trials,
  promotions,
  sources: evolveSources,
};

export const EVOLVE_NOTE =
  'All experiments, candidates, trials and promotion records in this laboratory are synthetic demonstration data. Nothing is connected to a real runtime; no experiment was executed and no authority decision was made.';
