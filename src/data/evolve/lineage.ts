import type {
  Checkpoint,
  Execution,
  LineageEdge,
  CoordinateKind,
  CoordinateValue,
} from '../../domain/evolve';

// ─── Coordinate helpers ─────────────────────────────────────────────────────

export const rec = (value: string): CoordinateValue<string> => ({ status: 'recorded', value });
export const unav = (reason: string): CoordinateValue<string> => ({ status: 'unavailable', reason });

/** Base coordinates shared by most executions in this corpus. */
export function baseCoordinates(over: Partial<Record<CoordinateKind, CoordinateValue<string>>> = {}): Partial<Record<CoordinateKind, CoordinateValue<string>>> {
  return {
    model: rec('qwen3.8-27b (local, bf16)'),
    checkpoint: rec('weights digest wf3a9c…8b72'),
    quantisation: rec('bf16'),
    harness: rec('pi / cli-harness 1.1.0'),
    harnessVersion: rec('1.1.0'),
    invocationMode: rec('rpc, single session'),
    toolSurface: rec('fs.read, fs.write, shell.exec, search.grep (fixed order)'),
    wireDialect: rec('openai.chat-completions'),
    cognitionPolicy: rec('none (harness default)'),
    samplingPolicy: rec('temperature absent — server defaults UNAVAILABLE'),
    resourceBudget: rec('output tokens: 4,096 / step timeout 30s'),
    environment: rec('pinned: TZ, LANG, LC_ALL, NODE_OPTIONS; file times fixed'),
    taskSet: rec('billing-service suite (5 tasks)'),
    evaluator: rec('success-check (exit code) + lifecycle grader'),
    evaluatorVersion: rec('grader-v3 / check-argv-v2'),
    seed: rec('ordering seed 31415 (recorded)'),
    repetitions: rec('6 per cell (planned)'),
    harnessSurface: rec('pi / cli-harness 1.1.0 — stock instructions and tool set'),
    holdout: rec('tasks 4–5 sealed from selection'),
    ...over,
  };
}

// ─── Executions ───────────────────────────────────────────────────────────
//
// The corpus is rooted in two recorded observation sessions (scenario A and B
// from the Observe registry) and grows an experiment programme around them.

export const executions: Execution[] = [
  {
    id: 'exec-a',
    label: 'Baseline reference — proration fix',
    role: 'baseline',
    sessionId: 'run-3f92c1',
    coordinates: baseCoordinates(),
    outcome: 'completed; verification passed; evidence complete',
    startedAt: '2026-10-19 09:14:02 UTC',
    durationMs: 24600,
    note: 'The reference execution for the proration task. Its trajectory is inspectable in Observe.',
  },
  {
    id: 'exec-b',
    label: 'Reference — CSV export migration (recovered)',
    role: 'reference',
    sessionId: 'run-2b7e90',
    coordinates: baseCoordinates({ taskSet: rec('billing-service suite (export tasks)') }),
    outcome: 'completed after one failed tool call and a recorded recovery',
    startedAt: '2026-10-19 09:14:02 UTC',
    durationMs: 22800,
    note: 'Independent reference run; demonstrates recovery relations. Not part of an experiment.',
  },
  {
    id: 'exec-c',
    label: 'Divergent continuation — retry policy authorised',
    role: 'continuation',
    sessionId: 'run-6c07e4',
    coordinates: baseCoordinates({
      resourceBudget: rec('output tokens: 4,096 / retry policy: loop-until-pass (intervention int-1)'),
    }),
    outcome: 'divergent-terminated under the authorised retry policy',
    startedAt: '2026-10-19 09:14:02 UTC',
    durationMs: 31500,
    note: 'Forked from the proration baseline after seq 8, with a recorded operator intervention. Sequencing shows authorise → revise → still failing; the record does not establish the intervention caused the outcome.',
  },
  {
    id: 'exec-trunc',
    label: 'Truncated run — webhook retry fix',
    role: 'reference',
    sessionId: 'run-8d41aa',
    coordinates: baseCoordinates({
      taskSet: rec('billing-service suite (webhook tasks)'),
      environment: unav('recording interrupted before the environment record completed'),
      resourceBudget: unav('journal truncation at seq 8; budget after that point not recorded'),
    }),
    outcome: 'incomplete evidence; final state unknown',
    startedAt: '2026-10-19 09:14:02 UTC',
    durationMs: 23700,
    note: 'Kept in the registry to exercise degraded-evidence handling in lineage views.',
  },
  {
    id: 'exec-perm',
    label: 'Reference — permissive network harness',
    role: 'reference',
    sessionId: 'run-5aa1d3',
    coordinates: baseCoordinates({
      harnessSurface: rec('network policy: allowlist (12 hosts)'),
    }),
    outcome: 'completed; network.fetch admitted but never exercised',
    startedAt: '2026-10-19 09:14:02 UTC',
    durationMs: 8400,
    note: 'Same model behind a different harness policy — the harness-sensitivity hypothesis made concrete.',
  },
  // ── Experiment 1: retry policy arms (forks of exec-a) ──
  {
    id: 'exec-r1',
    label: 'Arm B1 — loop-until-pass retry policy',
    role: 'trial',
    armId: 'arm-retry-b',
    coordinates: baseCoordinates({
      resourceBudget: rec('output tokens: 4,096 / retry policy: loop-until-pass (max 3)'),
      cognitionPolicy: rec('none (candidate policy: retry-loop-v2)'),
    }),
    outcome: 'see trials',
    startedAt: '2026-10-19 11:02:10 UTC',
    durationMs: 28900,
    note: 'Candidate execution under candidate cand-retry. One of 6 trials in its cell.',
  },
  {
    id: 'exec-r2',
    label: 'Arm B2 — loop-until-pass retry policy (replicate)',
    role: 'trial',
    armId: 'arm-retry-b',
    coordinates: baseCoordinates({
      resourceBudget: rec('output tokens: 4,096 / retry policy: loop-until-pass (max 3)'),
      cognitionPolicy: rec('none (candidate policy: retry-loop-v2)'),
    }),
    outcome: 'see trials',
    startedAt: '2026-10-19 11:04:48 UTC',
    durationMs: 31400,
    note: 'Second replicate under the candidate arm.',
  },
  // ── Experiment 2: context management ──
  {
    id: 'exec-ctx1',
    label: 'Arm C1 — compaction threshold 70%',
    role: 'trial',
    armId: 'arm-ctx-hi',
    coordinates: baseCoordinates({
      cognitionPolicy: rec('work (candidate context policy: compact-70)'),
    }),
    outcome: 'see trials',
    startedAt: '2026-10-19 13:20:00 UTC',
    durationMs: 26100,
    note: 'Higher compaction threshold: keeps more history before compacting.',
  },
  {
    id: 'exec-ctx2',
    label: 'Arm C2 — compaction threshold 40%',
    role: 'trial',
    armId: 'arm-ctx-lo',
    coordinates: baseCoordinates({
      cognitionPolicy: rec('work (candidate context policy: compact-40)'),
    }),
    outcome: 'see trials',
    startedAt: '2026-10-19 13:23:31 UTC',
    durationMs: 24700,
    note: 'Lower threshold: compacts earlier, smaller prompts.',
  },
  // ── Experiment 3: harness sensitivity (no candidate) ──
  {
    id: 'exec-h1',
    label: 'Harness H1 — streaming relay enabled',
    role: 'trial',
    armId: 'arm-harness-stream',
    coordinates: baseCoordinates({
      harness: rec('pi / cli-harness 1.1.0 (streaming relay)'),
      wireDialect: rec('openai.chat-completions (stream: true)'),
    }),
    outcome: 'see trials',
    startedAt: '2026-10-19 15:40:12 UTC',
    durationMs: 25200,
    note: 'Same model and tasks behind a relay that streams. Designed to measure harness sensitivity, not to improve anything.',
  },
  {
    id: 'exec-h2',
    label: 'Harness H2 — buffered relay (baseline equivalent)',
    role: 'trial',
    armId: 'arm-harness-buffer',
    coordinates: baseCoordinates(),
    outcome: 'see trials',
    startedAt: '2026-10-19 15:43:07 UTC',
    durationMs: 25050,
    note: 'Control arm, byte-identical configuration to the proration baseline where possible.',
  },
  // ── Experiment 5: counterfactual continuations from ckpt-a-08 ──
  {
    id: 'exec-sim1',
    label: 'Simulated branch — sliding-window policy (projection)',
    role: 'continuation',
    coordinates: baseCoordinates({
      cognitionPolicy: rec('simulated projection over ckpt-a-08 (sliding-window planner)'),
      environment: unav('simulation consumed recorded state only; environment beyond the prefix not established'),
    }),
    outcome: 'projection completed; not an execution result',
    startedAt: '2026-10-19 16:05:00 UTC',
    durationMs: 0,
    note: 'A projection over the checkpoint prefix produced by a declared deterministic transform. Never presented as a real execution; carries no usage rows.',
  },
  {
    id: 'exec-replay1',
    label: 'Replay of exec-a prefix (cassette)',
    role: 'continuation',
    sessionId: 'run-3f92c1',
    coordinates: baseCoordinates({
      samplingPolicy: unav('replay serves recorded responses; sampling fields not re-issued'),
    }),
    outcome: 'replay matched through seq 8; cassette verified',
    startedAt: '2026-10-19 16:12:00 UTC',
    durationMs: 13100,
    note: 'Recorded model responses held fixed. Establishes what control flow reproduces — says nothing about the model.',
  },
];

// ─── Checkpoints ─────────────────────────────────────────────────────────────

export const checkpoints: Checkpoint[] = [
  {
    id: 'ckpt-a-08',
    executionId: 'exec-a',
    label: 'After patch applied (seq 8)',
    afterEventId: 'a-08',
    afterSeq: 8,
    state: {
      workspaceSnapshot: { present: true, note: 'Full workspace snapshot recorded with the write digest at seq 8.' },
      conversationPrefix: { present: true, note: 'Conversation prefix through exchange 3, byte-faithful via the recording proxy.' },
      toolDefinitions: { present: true, note: 'Tool definitions digested on the wire; order preserved.' },
      environmentPin: { present: true, note: 'Pinned environment record present (TZ, LANG, LC_ALL, NODE_OPTIONS, file times).' },
      recordedResponses: { present: true, note: 'Model responses recorded as a cassette for replay.' },
    },
    note: 'The divergence point between the baseline (A) and the divergent continuation (C). Fully forkable.',
  },
  {
    id: 'ckpt-a-11',
    executionId: 'exec-a',
    label: 'Before final request (seq 11)',
    afterEventId: 'a-11',
    afterSeq: 11,
    state: {
      workspaceSnapshot: { present: true, note: 'Snapshot recorded with the verification digest at seq 10.' },
      conversationPrefix: { present: true, note: 'Prefix through exchange 4.' },
      toolDefinitions: { present: true, note: 'Tool definitions digested on the wire.' },
      environmentPin: { present: true, note: 'Pinned environment record present.' },
      recordedResponses: { present: true, note: 'Responses for exchanges 1–4 recorded.' },
    },
    note: 'Late checkpoint: continuations from here vary only the conclusion request.',
  },
  {
    id: 'ckpt-trunc-08',
    executionId: 'exec-trunc',
    label: 'Journal truncation point (seq 8)',
    afterEventId: 'd-08',
    afterSeq: 8,
    state: {
      workspaceSnapshot: { present: true, note: 'Snapshot present up to the truncation marker.' },
      conversationPrefix: { present: false, note: 'Request bodies after the truncation marker were not recovered.' },
      toolDefinitions: { present: true, note: 'Tool definitions recorded before truncation.' },
      environmentPin: { present: false, note: 'Environment record incomplete: the degraded ledger interval began before it was written.' },
      recordedResponses: { present: false, note: 'No cassette: responses after seq 8 were never written.' },
    },
    note: 'Not forkable for replay or new continuations: the conversation prefix is missing. The interface says so rather than offering a fork.',
  },
];

// ─── Lineage edges ───────────────────────────────────────────────────────────

export const edges: LineageEdge[] = [
  { id: 'e1', from: 'exec-c', to: 'exec-a', relation: 'forked_from', note: 'Forked at ckpt-a-08; divergent outcome recorded.' },
  { id: 'e2', from: 'exec-replay1', to: 'exec-a', relation: 'replay_of', note: 'Cassette replay of the recorded prefix.' },
  { id: 'e3', from: 'exec-r1', to: 'exec-a', relation: 'candidate_of', note: 'Trial execution under candidate cand-retry, arm B.' },
  { id: 'e4', from: 'exec-r2', to: 'exec-a', relation: 'candidate_of', note: 'Trial execution under candidate cand-retry, arm B (replicate 2).' },
  { id: 'e5', from: 'exec-ctx1', to: 'exec-a', relation: 'candidate_of', note: 'Trial execution under candidate cand-compact, arm C1.' },
  { id: 'e6', from: 'exec-ctx2', to: 'exec-a', relation: 'candidate_of', note: 'Trial execution under candidate cand-compact, arm C2.' },
  { id: 'e7', from: 'exec-h1', to: 'exec-a', relation: 'evaluated_against', note: 'Harness-sensitivity arm, compared against the baseline configuration.' },
  { id: 'e8', from: 'exec-h2', to: 'exec-a', relation: 'evaluated_against', note: 'Harness control arm.' },
  { id: 'e9', from: 'exec-sim1', to: 'exec-a', relation: 'simulated_branch', note: 'Projection from ckpt-a-08. Not an execution; carries no usage rows.' },
];
