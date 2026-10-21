import type {
  Candidate,
  Experiment,
  ExperimentArm,
  PromotionRecord,
  Trial,
} from '../../domain/evolve';

// ─── Candidates ──────────────────────────────────────────────────────────────

export const candidates: Candidate[] = [
  {
    id: 'cand-retry',
    label: 'Loop-until-pass retry policy',
    change: {
      target: 'cognition-policy',
      summary: 'Replace single-retry with loop-until-pass (max 3) on test failures, so the agent keeps attempting boundary fixes.',
      artifactId: 'policy:retry-loop-v2',
    },
    status: 'promoted',
    baselineExecutionId: 'exec-a',
    executionIds: ['exec-r1', 'exec-r2'],
    proposedAt: '2026-10-19 10:41:00 UTC',
    note: 'Rose from the divergent continuation (exec-c): the operator intervention there suggested a policy-level retry change. Promoted only after the holdout completed and an authority decision was recorded.',
  },
  {
    id: 'cand-compact',
    label: 'Adaptive compaction threshold',
    change: {
      target: 'context-management',
      summary: 'Compact the conversation prefix when estimated tokens exceed a threshold (70% vs 40%), instead of a fixed schedule.',
      artifactId: 'policy:compact-threshold-v1',
    },
    status: 'evaluated',
    baselineExecutionId: 'exec-a',
    executionIds: ['exec-ctx1', 'exec-ctx2'],
    proposedAt: '2026-10-19 12:58:00 UTC',
    note: 'Evaluated; comparison showed a cost/outcome trade-off and one arm with missing usage rows. In review, not authorised.',
  },
  {
    id: 'cand-stream',
    label: 'Streaming harness relay',
    change: {
      target: 'harness',
      summary: 'Enable the streaming relay so responses arrive incrementally. A harness-sensitivity probe, not an improvement claim.',
      artifactId: 'harness:streaming-relay-v1',
    },
    status: 'withdrawn',
    baselineExecutionId: 'exec-a',
    executionIds: ['exec-h1'],
    proposedAt: '2026-10-19 15:12:00 UTC',
    note: 'Withdrawn: the study measured harness sensitivity; the wire dialect difference makes direct outcome comparison confounded, which the withdraw note records.',
  },
  {
    id: 'cand-plan',
    label: 'Sliding-window planner prompt',
    change: {
      target: 'prompt',
      summary: 'Prefer the sliding-window algorithm in the planning prompt, mirroring the STEER directive from scenario F.',
      artifactId: 'prompt:plan-sliding-window-v1',
    },
    status: 'proposed',
    baselineExecutionId: 'exec-a',
    executionIds: [],
    proposedAt: '2026-10-19 17:30:00 UTC',
    note: 'Proposed from the observed STEER acceptance in run-1f4c88. A proposal only: no experiment defined, nothing evaluated, nothing authorised.',
  },
];

// ─── Experiment arms ─────────────────────────────────────────────────────────

export const arms: ExperimentArm[] = [
  // Experiment 1: retry policy
  {
    id: 'arm-retry-a',
    label: 'A — baseline (single retry)',
    kind: 'baseline',
    executionIds: ['exec-a'],
    changedCoordinates: [],
    intent: 'Reference behaviour under the existing single-retry policy.',
  },
  {
    id: 'arm-retry-b',
    label: 'B — loop-until-pass (max 3)',
    kind: 'candidate',
    candidateId: 'cand-retry',
    executionIds: ['exec-r1', 'exec-r2'],
    changedCoordinates: ['cognitionPolicy', 'resourceBudget'],
    intent: 'Measure whether bounded looping recovers boundary-case failures at acceptable cost.',
  },
  // Experiment 2: context management
  {
    id: 'arm-ctx-base',
    label: 'A — baseline (fixed schedule)',
    kind: 'baseline',
    executionIds: ['exec-a'],
    changedCoordinates: [],
    intent: 'Reference behaviour under the fixed compaction schedule.',
  },
  {
    id: 'arm-ctx-hi',
    label: 'C1 — compaction at 70%',
    kind: 'candidate',
    candidateId: 'cand-compact',
    executionIds: ['exec-ctx1'],
    changedCoordinates: ['cognitionPolicy'],
    intent: 'Keep more history: fewer compactions, larger prompts.',
  },
  {
    id: 'arm-ctx-lo',
    label: 'C2 — compaction at 40%',
    kind: 'candidate',
    candidateId: 'cand-compact',
    executionIds: ['exec-ctx2'],
    changedCoordinates: ['cognitionPolicy'],
    intent: 'Compact earlier: smaller prompts, more compaction events.',
  },
  // Experiment 3: harness sensitivity
  {
    id: 'arm-harness-buffer',
    label: 'H0 — buffered relay (control)',
    kind: 'control',
    executionIds: ['exec-h2'],
    changedCoordinates: [],
    intent: 'Control: byte-identical configuration to the baseline where possible.',
  },
  {
    id: 'arm-harness-stream',
    label: 'H1 — streaming relay',
    kind: 'confounded',
    executionIds: ['exec-h1'],
    changedCoordinates: ['harness', 'wireDialect'],
    intent: 'Measure harness sensitivity: same model and tasks, different relay. Wire dialect changes with the harness, which the design declares as a confound rather than hiding.',
  },
  // Experiment 4: promotion gate (holdout block)
  {
    id: 'arm-holdout',
    label: 'Holdout — sealed tasks 4–5',
    kind: 'control',
    executionIds: [],
    changedCoordinates: [],
    intent: 'The promotion holdout: never given to any selection policy, so a promotion can be checked against data the search never saw.',
  },
  // Experiment 5: counterfactual continuations
  {
    id: 'arm-cf-replay',
    label: 'R — cassette replay',
    kind: 'control',
    executionIds: ['exec-replay1'],
    changedCoordinates: [],
    intent: 'Establish what control flow reproduces when model responses are held fixed.',
  },
  {
    id: 'arm-cf-sim',
    label: 'S — simulated projection',
    kind: 'confounded',
    executionIds: ['exec-sim1'],
    changedCoordinates: ['cognitionPolicy', 'environment'],
    intent: 'Explore a declared deterministic projection from the checkpoint. Labelled simulated; never compared as an execution result.',
  },
];

// ─── Experiments ─────────────────────────────────────────────────────────────

export const experiments: Experiment[] = [
  {
    id: 'exp-retry',
    label: 'Experiment 1 — retry strategy',
    question: 'Does a bounded loop-until-pass policy recover boundary-case test failures without blowing the resource budget?',
    design: {
      controlled: ['model', 'checkpoint', 'harness', 'tool surface', 'environment', 'task set', 'evaluator'],
      confounds: [
        'Retry policy itself widens the resource budget: arm B is allowed more attempts by design. The budget coordinate is changed intentionally, so cost comparisons are part of the question, not a confound.',
      ],
      holdoutUsed: true,
      holdoutSealed: true,
    },
    seed: 31415,
    repetitions: 6,
    armIds: ['arm-retry-a', 'arm-retry-b'],
    startedAt: '2026-10-19 11:00:00 UTC',
    status: 'complete',
    note: 'Six trials per cell over the proration task family. Arm B improves recovery but pays for it in tokens; see the results panel.',
  },
  {
    id: 'exp-ctx',
    label: 'Experiment 2 — context management',
    question: 'Do compaction thresholds change outcomes, and what do they cost in tokens and compaction events?',
    design: {
      controlled: ['model', 'checkpoint', 'harness', 'tool surface', 'environment', 'task set', 'evaluator'],
      confounds: [
        'One arm-C trial hit the degraded usage ledger interval; its token rows are missing (UNAVAILABLE), so its cost figures are absent rather than zero.',
      ],
      holdoutUsed: false,
      holdoutSealed: false,
    },
    seed: 27182,
    repetitions: 6,
    armIds: ['arm-ctx-base', 'arm-ctx-hi', 'arm-ctx-lo'],
    startedAt: '2026-10-19 13:15:00 UTC',
    status: 'degraded',
    note: 'Two of six trials in arm C1 have UNAVAILABLE usage. The comparison reports the denominator honestly.',
  },
  {
    id: 'exp-harness',
    label: 'Experiment 3 — harness sensitivity',
    question: 'How much of run-to-run variation is the harness rather than the model? (A measurement study, not an improvement.)',
    design: {
      controlled: ['model', 'checkpoint', 'tool surface', 'environment', 'task set', 'evaluator'],
      confounds: [
        'Wire dialect necessarily changes with the streaming relay (stream: true). Outcome scores across arms are confounded by design and the interface says so.',
      ],
      holdoutUsed: false,
      holdoutSealed: false,
    },
    seed: 16180,
    repetitions: 4,
    armIds: ['arm-harness-buffer', 'arm-harness-stream'],
    startedAt: '2026-10-19 15:35:00 UTC',
    status: 'complete',
    note: 'The harness-as-blocking-factor design: within-arm comparisons are valid; cross-arm generalisation is flagged.',
  },
  {
    id: 'exp-promo',
    label: 'Experiment 4 — promotion gate (cand-retry)',
    question: 'Does the promoted candidate hold on data the selection never saw, and is the authority decision recorded?',
    design: {
      controlled: ['model', 'checkpoint', 'harness', 'tool surface', 'environment', 'evaluator'],
      confounds: [],
      holdoutUsed: true,
      holdoutSealed: true,
    },
    seed: 99991,
    repetitions: 3,
    armIds: ['arm-retry-a', 'arm-retry-b', 'arm-holdout'],
    startedAt: '2026-10-19 18:05:00 UTC',
    status: 'interrupted',
    note: 'The holdout cell was interrupted after 1 of 3 trials (environment failure — not a task failure). The promotion record shows the gap.',
  },
  {
    id: 'exp-cf',
    label: 'Experiment 5 — counterfactual continuations',
    question: 'From one recorded checkpoint, what do a replay, a new execution and a declared simulation each establish?',
    design: {
      controlled: ['conversation prefix', 'workspace snapshot', 'tool definitions', 'environment pin'],
      confounds: [
        'The simulated branch consumed recorded state only; its environment beyond the prefix is not established. It is excluded from all outcome aggregates.',
      ],
      holdoutUsed: false,
      holdoutSealed: false,
    },
    seed: 57721,
    repetitions: 1,
    armIds: ['arm-cf-replay', 'arm-cf-sim'],
    checkpointId: 'ckpt-a-08',
    startedAt: '2026-10-19 16:00:00 UTC',
    status: 'complete',
    note: 'Three continuation kinds from ckpt-a-08, kept apart: replayed (cassette), recorded (exec-a itself), simulated (projection).',
  },
];

// ─── Trials ──────────────────────────────────────────────────────────────
//
// Aggregate views derive from these records; no dashboard number is authored
// independently. Cells are small and the interface says so.

const t = (
  id: string,
  executionId: string,
  armId: string,
  experimentId: string,
  taskId: string,
  index: number,
  outcome: Trial['outcome'],
  check: Trial['check'],
  evaluator: Trial['evaluator'],
  usage: Trial['usage'],
  wallMs: Trial['wallMs'],
  sessionId?: string,
  note?: string,
): Trial => ({ id, executionId, armId, experimentId, taskId, index, outcome, check, evaluator, usage, wallMs, sessionId, note });

export const trials: Trial[] = [
  // Experiment 1 — arm A (baseline cell): the recorded reference + derived sibling trials marked as such.
  t('tr-a1', 'exec-a', 'arm-retry-a', 'exp-retry', 'proration-boundary', 1, 'completed', { status: 'passed' }, { status: 'passed' }, { promptTokens: 50007, completionTokens: 1456 }, 24600, 'run-3f92c1'),
  // Arm B trials — loop-until-pass.
  t('tr-b1', 'exec-r1', 'arm-retry-b', 'exp-retry', 'proration-boundary', 1, 'completed', { status: 'passed' }, { status: 'passed' }, { promptTokens: 62140, completionTokens: 2410 }, 28900, undefined, 'Recovered the boundary case on attempt 2.'),
  t('tr-b2', 'exec-r2', 'arm-retry-b', 'exp-retry', 'proration-boundary', 2, 'completed', { status: 'passed' }, { status: 'passed' }, { promptTokens: 59880, completionTokens: 2188 }, 31400),
  t('tr-b3', 'exec-r1', 'arm-retry-b', 'exp-retry', 'proration-negative', 3, 'completed', { status: 'passed' }, { status: 'passed' }, { promptTokens: 54110, completionTokens: 1902 }, 27100),
  t('tr-b4', 'exec-r2', 'arm-retry-b', 'exp-retry', 'proration-negative', 4, 'failed', { status: 'failed' }, { status: 'passed' }, { promptTokens: 66220, completionTokens: 2764 }, 35800, undefined, 'Exhausted the 3-attempt loop on the negative-amount clamp.'),
  t('tr-b5', 'exec-r1', 'arm-retry-b', 'exp-retry', 'proration-rounding', 5, 'completed', { status: 'passed' }, { status: 'passed' }, { promptTokens: 57330, completionTokens: 2044 }, 29350),
  t('tr-b6', 'exec-r2', 'arm-retry-b', 'exp-retry', 'proration-rounding', 6, 'completed', { status: 'passed' }, { status: 'passed' }, { promptTokens: 55910, completionTokens: 1971 }, 28620),
  // Experiment 2 — arms.
  t('tr-c0', 'exec-a', 'arm-ctx-base', 'exp-ctx', 'proration-boundary', 1, 'completed', { status: 'passed' }, { status: 'passed' }, { promptTokens: 50007, completionTokens: 1456 }, 24600, 'run-3f92c1'),
  t('tr-c1a', 'exec-ctx1', 'arm-ctx-hi', 'exp-ctx', 'proration-boundary', 1, 'completed', { status: 'passed' }, { status: 'passed' }, { promptTokens: 64010, completionTokens: 1602 }, 26100),
  t('tr-c1b', 'exec-ctx1', 'arm-ctx-hi', 'exp-ctx', 'proration-negative', 2, 'completed', { status: 'passed' }, { status: 'passed' }, { unavailable: true, reason: 'Degraded usage ledger interval; no row written for this request.' }, 25500, undefined, 'Token totals unverifiable for this trial.'),
  t('tr-c1c', 'exec-ctx1', 'arm-ctx-hi', 'exp-ctx', 'proration-rounding', 3, 'completed', { status: 'passed' }, { status: 'passed' }, { promptTokens: 61890, completionTokens: 1544 }, 26800),
  t('tr-c2a', 'exec-ctx2', 'arm-ctx-lo', 'exp-ctx', 'proration-boundary', 1, 'completed', { status: 'passed' }, { status: 'passed' }, { promptTokens: 38240, completionTokens: 1388 }, 24700),
  t('tr-c2b', 'exec-ctx2', 'arm-ctx-lo', 'exp-ctx', 'proration-negative', 2, 'completed', { status: 'passed' }, { status: 'passed' }, { promptTokens: 36990, completionTokens: 1301 }, 23900),
  t('tr-c2c', 'exec-ctx2', 'arm-ctx-lo', 'exp-ctx', 'proration-rounding', 3, 'interrupted', { status: 'unavailable', reason: 'Trial interrupted; the success check never ran.' }, { status: 'unavailable', reason: 'Evaluator did not run.' }, { promptTokens: 30110, completionTokens: 902 }, 12000, undefined, 'Interrupted mid-run; kept but never counted in pass-rate denominators beyond outcome counts.'),
  // Experiment 3 — harness arms.
  t('tr-h0a', 'exec-h2', 'arm-harness-buffer', 'exp-harness', 'proration-boundary', 1, 'completed', { status: 'passed' }, { status: 'passed' }, { promptTokens: 50220, completionTokens: 1470 }, 25050),
  t('tr-h0b', 'exec-h2', 'arm-harness-buffer', 'exp-harness', 'proration-rounding', 2, 'completed', { status: 'passed' }, { status: 'passed' }, { promptTokens: 49870, completionTokens: 1432 }, 24980),
  t('tr-h1a', 'exec-h1', 'arm-harness-stream', 'exp-harness', 'proration-boundary', 1, 'completed', { status: 'passed' }, { status: 'passed' }, { promptTokens: 50780, completionTokens: 1501 }, 25200),
  t('tr-h1b', 'exec-h1', 'arm-harness-stream', 'exp-harness', 'proration-rounding', 2, 'failed', { status: 'failed' }, { status: 'passed' }, { promptTokens: 51340, completionTokens: 1622 }, 27600, undefined, 'Same model, different relay: one boundary failure. Within-block difference; cross-arm generalisation flagged.'),
  // Experiment 4 — holdout cell: interrupted.
  t('tr-p1', 'exec-r1', 'arm-retry-b', 'exp-promo', 'holdout-task-4', 1, 'completed', { status: 'passed' }, { status: 'passed' }, { promptTokens: 60110, completionTokens: 2255 }, 30200, undefined, 'Holdout task 4, trial 1.'),
  t('tr-p2', 'exec-r1', 'arm-retry-b', 'exp-promo', 'holdout-task-4', 2, 'interrupted', { status: 'unavailable', reason: 'Environment failure before the check; not a task failure.' }, { status: 'unavailable', reason: 'Evaluator did not run.' }, { unavailable: true, reason: 'No usage row: the environment failed before the request completed.' }, 0, undefined, 'Environment failure — recorded as UNAVAILABLE, never as a reward of 0.'),
  // Experiment 5 — continuations.
  t('tr-cf-r', 'exec-replay1', 'arm-cf-replay', 'exp-cf', 'proration-prefix', 1, 'completed', { status: 'passed', reason: 'Cassette verified: zero misses through exchange 4.' }, { status: 'unavailable', reason: 'Replay holds model responses fixed; the evaluator is not meaningful here.' }, { promptTokens: 50007, completionTokens: 1456 }, 13100, 'run-3f92c1', 'Usage equals the recording\u2019s, because responses come from the cassette.'),
];

// ─── Promotion records ───────────────────────────────────────────────────────

export const promotions: PromotionRecord[] = [
  {
    id: 'promo-retry',
    candidateId: 'cand-retry',
    steps: [
      { stage: 'observed', status: 'done', recordId: 'exec-c', note: 'Divergent continuation observed under an authorised retry intervention; the record shows sequencing, not causation.' },
      { stage: 'proposed', status: 'done', recordId: 'cand-retry', note: 'Candidate proposed from the observation. A proposal is not permission.' },
      { stage: 'isolated', status: 'done', recordId: 'exp-retry', note: 'Experiment 1 defined with controlled coordinates; budget change declared intentional.' },
      { stage: 'evaluated', status: 'done', recordId: 'exp-retry', note: '6 trials per cell; arm B recovered 5 of 6 boundary-family tasks (5/6, Wilson interval wide at n=6).' },
      { stage: 'compared', status: 'done', recordId: 'exp-retry', note: 'Coordinates matched arm-by-arm; the intentional budget change surfaced as part of the question.' },
      { stage: 'reviewed', status: 'done', recordId: 'exp-retry', note: 'Human review confirmed the comparison validity and noted the small n.' },
      { stage: 'authorised', status: 'done', recordId: 'exp-promo', authority: 'operator token o-77 (session-scoped)', note: 'Authority decision recorded against the exact candidate record. Authorisation is not promotion.' },
      { stage: 'promoted', status: 'done', recordId: 'exp-promo', note: 'Holdout task 4 trial 1 passed. The promotion decision was recorded after the holdout check, citing its single completed trial.' },
    ],
    authorisation: { authority: 'operator token o-77', note: 'Bound to the candidate digest at promotion time; the holdout cell was incomplete (1 of 3 trials). The promotion note records this.' },
    outcome: 'Promoted with a recorded caveat: the holdout cell was interrupted at 1 of 3 trials.',
  },
  {
    id: 'promo-compact',
    candidateId: 'cand-compact',
    steps: [
      { stage: 'observed', status: 'done', recordId: 'exec-a', note: 'Fixed-schedule compaction observed in the baseline.' },
      { stage: 'proposed', status: 'done', recordId: 'cand-compact', note: 'Threshold policy proposed.' },
      { stage: 'isolated', status: 'done', recordId: 'exp-ctx', note: 'Two thresholds defined as separate arms.' },
      { stage: 'evaluated', status: 'done', recordId: 'exp-ctx', note: 'Trials ran; one arm carries UNAVAILABLE usage rows (degraded ledger).' },
      { stage: 'compared', status: 'done', recordId: 'exp-ctx', note: 'Cost/outcome trade-off visible; denominators reported with missing rows excluded, not zeroed.' },
      { stage: 'reviewed', status: 'done', recordId: 'exp-ctx', note: 'Review pending the degraded-ledger question: are the missing rows recoverable from the provider?' },
      { stage: 'authorised', status: 'unavailable', note: 'No authority decision recorded. Evaluation success does not imply permission.' },
      { stage: 'promoted', status: 'unavailable', note: 'Blocked: no authorisation exists. The candidate stays in review.' },
    ],
    outcome: 'Blocked at review: awaiting a decision on the degraded usage evidence. Nothing is authorised.',
  },
];
