import type { Source } from '../../domain/types';

export const ESRC = {
  experimentLedger: 'src:experiment-ledger',
  trialRecords: 'src:trial-records',
  selectionLog: 'src:selection-log',
  promotionLedger: 'src:promotion-ledger',
  evidenceLedger: 'src:evidence-ledger',
  checkpointStore: 'src:checkpoint-store',
} as const;

export const evolveSources: Source[] = [
  {
    id: ESRC.experimentLedger,
    name: 'Experiment ledger',
    kind: 'experiment records',
    condition: 'readable',
    note: 'Experiment identities, arms and declared coordinates. Each coordinate recorded or explicitly UNAVAILABLE.',
    records: 5,
  },
  {
    id: ESRC.trialRecords,
    name: 'Trial records',
    kind: 'per-trial results',
    condition: 'readable',
    note: 'One record per trial: outcome, check, evaluator, usage, timing. Interrupted trials are kept but never silently counted.',
    records: 20,
  },
  {
    id: ESRC.selectionLog,
    name: 'Selection log',
    kind: 'policy decisions',
    condition: 'readable',
    note: 'Deterministic selection-policy decisions over validation evidence. The promotion holdout never appears here.',
    records: 2,
  },
  {
    id: ESRC.promotionLedger,
    name: 'Promotion ledger',
    kind: 'authority decisions',
    condition: 'readable',
    note: 'Promotion stages as separate recorded decisions. Evaluation does not imply promotion; a score never authorises itself.',
    records: 2,
  },
  {
    id: ESRC.evidenceLedger,
    name: 'Evidence ledger',
    kind: 'linked observation records',
    condition: 'degraded',
    note: 'Links from trials to observation sessions. The truncated session (run-8d41aa) links partially; the simulated branch links to no session at all.',
    records: 18,
  },
  {
    id: ESRC.checkpointStore,
    name: 'Checkpoint store',
    kind: 'recorded state bundles',
    condition: 'readable',
    note: 'Checkpoint state bundles with per-artifact presence. Forkability is claimed only when every required artifact is present.',
    records: 3,
  },
];
