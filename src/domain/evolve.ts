// ─── EVOLVE domain: lineage, experiments, candidates, promotion ─────────────
//
// Contracts for the Counterfactual Laboratory. Every record mirrors the real
// project's rule: each coordinate is either recorded or explicitly UNAVAILABLE.
// Evaluation is never promotion; a candidate's score never authorises itself.

import type { Source } from './types';

// ─── Coordinates ─────────────────────────────────────────────────────────

/** A value the record carries, or an explicit statement that it cannot. */
export type CoordinateValue<V> =
  | { status: 'recorded'; value: V }
  | { status: 'unavailable'; reason: string };

export type CoordinateKind =
  | 'model' | 'checkpoint' | 'quantisation'
  | 'harness' | 'harnessVersion' | 'harnessSurface'
  | 'invocationMode' | 'toolSurface' | 'wireDialect'
  | 'cognitionPolicy' | 'samplingPolicy' | 'resourceBudget'
  | 'environment' | 'taskSet'
  | 'evaluator' | 'evaluatorVersion'
  | 'seed' | 'repetitions'
  | 'holdout';

export interface CoordinateSpec {
  kind: CoordinateKind;
  label: string;
  group: 'identity' | 'execution' | 'measurement';
  /** Short explanation of why this coordinate matters for comparability. */
  why: string;
}

export const COORDINATE_SPECS: CoordinateSpec[] = [
  { kind: 'model', label: 'Model', group: 'identity', why: 'Different models are different experimental subjects.' },
  { kind: 'checkpoint', label: 'Checkpoint / weights', group: 'identity', why: 'For local weights, the weights digest; quantised variants are distinct subjects.' },
  { kind: 'quantisation', label: 'Quantisation', group: 'identity', why: 'A quantised variant is not silently interchangeable with full precision.' },
  { kind: 'harness', label: 'Harness', group: 'execution', why: 'The harness is an experimental variable, not plumbing.' },
  { kind: 'harnessVersion', label: 'Harness version', group: 'execution', why: 'Version drift within one arm is a confound.' },
  { kind: 'harnessSurface', label: 'Effective harness surface', group: 'execution', why: 'What the model actually received: instructions, tools, parameters on the wire.' },
  { kind: 'invocationMode', label: 'Invocation mode', group: 'execution', why: 'How the harness was driven affects the surface.' },
  { kind: 'toolSurface', label: 'Tool surface', group: 'execution', why: 'Tool order has changed behaviour in recorded studies.' },
  { kind: 'wireDialect', label: 'Wire dialect', group: 'execution', why: 'Different request shapes are not comparable.' },
  { kind: 'cognitionPolicy', label: 'Cognition policy', group: 'execution', why: 'WORK / DREAM / none changes exploration behaviour.' },
  { kind: 'samplingPolicy', label: 'Sampling policy', group: 'execution', why: 'Absent sampling fields are not defaults; server defaults are often UNAVAILABLE.' },
  { kind: 'resourceBudget', label: 'Resource budget', group: 'execution', why: 'A budget mismatch is a confound, never mixed silently.' },
  { kind: 'environment', label: 'Environment', group: 'execution', why: 'Unpinned environments let drift confound conditions.' },
  { kind: 'taskSet', label: 'Task set', group: 'measurement', why: 'Scores are only comparable over the same tasks.' },
  { kind: 'evaluator', label: 'Evaluator', group: 'measurement', why: 'Outcomes judged by different graders are not comparable.' },
  { kind: 'evaluatorVersion', label: 'Evaluator version', group: 'measurement', why: 'Evaluator revisions change measurements.' },
  { kind: 'seed', label: 'Seed policy', group: 'measurement', why: 'Recorded ordering seed; null is a recorded draw, not an absence.' },
  { kind: 'repetitions', label: 'Repetitions', group: 'measurement', why: 'Trial counts bound what the intervals can claim.' },
  { kind: 'holdout', label: 'Holdout separation', group: 'measurement', why: 'Selection must never see the promotion holdout.' },
];

// ─── Lineage ────────────────────────────────────────────────────────────────

/** How one execution record relates to another. Each edge is typed. */
export type LineageRelation =
  | 'forked_from'
  | 'replay_of'
  | 'candidate_of'
  | 'evaluated_against'
  | 'continuation_of'
  | 'simulated_branch';

export interface LineageEdge {
  id: string;
  from: string; // execution id
  to: string;   // execution id
  relation: LineageRelation;
  note?: string;
}

/**
 * How a continuation was produced. These are kept apart because they support
 * different claims:
 *  - replayed: the recorded model responses were held fixed (establishes
 *    control-flow reproduction, nothing about the model).
 *  - recorded: a genuinely new execution with new model traffic.
 *  - simulated: a projection, never presented as a real execution result.
 */
export type ContinuationKind = 'replayed' | 'recorded' | 'simulated';

export const continuationMeta: Record<ContinuationKind, { label: string; desc: string }> = {
  replayed: { label: 'REPLAYED', desc: 'Recorded model responses held fixed. Establishes what control flow reproduces — says nothing about the model.' },
  recorded: { label: 'NEW EXECUTION', desc: 'A genuinely new recorded run with its own model traffic.' },
  simulated: { label: 'SIMULATED', desc: 'A projection over recorded data, not an execution. Never presented as a real result.' },
};

/** Recorded state completeness of a checkpoint. Forkability is claimed only when everything needed is present. */
export interface CheckpointState {
  workspaceSnapshot: { present: boolean; note: string };
  conversationPrefix: { present: boolean; note: string };
  toolDefinitions: { present: boolean; note: string };
  environmentPin: { present: boolean; note: string };
  /** The model's responses are needed only for replay, not for a new continuation. */
  recordedResponses: { present: boolean; note: string };
}

export interface Checkpoint {
  id: string;
  /** The execution this checkpoint belongs to. */
  executionId: string;
  label: string;
  /** Position within the parent execution's record. */
  afterEventId: string;
  afterSeq: number;
  state: CheckpointState;
  note: string;
}

/** Whether a checkpoint can support each continuation kind, derived from state. */
export function continuationSupport(cp: Checkpoint): Record<ContinuationKind, { supported: boolean; reason: string }> {
  const missingCore = [
    cp.state.workspaceSnapshot.present ? null : 'workspace snapshot',
    cp.state.conversationPrefix.present ? null : 'conversation prefix',
    cp.state.toolDefinitions.present ? null : 'tool definitions',
  ].filter(Boolean) as string[];

  const base = missingCore.length
    ? { supported: false, reason: `missing recorded state: ${missingCore.join(', ')}` }
    : { supported: true, reason: 'required state recorded' };

  return {
    replayed: cp.state.recordedResponses.present
      ? base
      : { supported: false, reason: base.supported ? 'recorded model responses absent — replay impossible' : base.reason },
    recorded: base,
    simulated: { supported: true, reason: 'simulation requires a declared projection, not recorded state' },
  };
}

// ─── Executions & candidates ─────────────────────────────────────────────────

export type ExecutionRole = 'baseline' | 'continuation' | 'candidate-run' | 'trial' | 'reference';

export interface Execution {
  id: string;
  label: string;
  role: ExecutionRole;
  /** Session id in the observation registry, when the execution has a recorded trajectory. */
  sessionId?: string;
  /** Experiment arm that produced this execution, when any. */
  armId?: string;
  /** Declared coordinates: recorded or explicitly UNAVAILABLE. */
  coordinates: Partial<Record<CoordinateKind, CoordinateValue<string>>>;
  outcome: string;
  startedAt: string;
  durationMs: number;
  note: string;
}

export interface CandidateChange {
  /** What part of the system the change touches. */
  target: 'prompt' | 'cognition-policy' | 'harness' | 'tool-config' | 'context-management' | 'model' | 'resource-policy' | 'memory';
  summary: string;
  /** Digest-style identity of the changed artifact, e.g. "policy:retry-loop-v2". */
  artifactId: string;
}

export type CandidateStatus =
  | 'draft'
  | 'proposed'
  | 'isolated'
  | 'evaluated'
  | 'review'
  | 'authorised'
  | 'promoted'
  | 'rejected'
  | 'withdrawn';

/** The EVOLVE sequence, each link a separate recorded decision. */
export const EVOLVE_SEQUENCE = [
  'observe', 'propose', 'isolate', 'evaluate', 'compare', 'admit', 'promote',
] as const;
export type EvolveStage = (typeof EVOLVE_SEQUENCE)[number];

export const candidateStatusMeta: Record<CandidateStatus, { label: string; desc: string; text: string; border: string; bg: string }> = {
  draft: { label: 'DRAFT', desc: 'Recorded as an idea; no experiment defined.', text: 'text-ink-300', border: 'border-ink-500/50', bg: 'bg-ink-700/40' },
  proposed: { label: 'PROPOSED', desc: 'A proposal exists. A proposal is not permission.', text: 'text-blue-accent', border: 'border-blue-accent/40', bg: 'bg-blue-accent/8' },
  isolated: { label: 'ISOLATED', desc: 'Experiment arms defined; variables controlled where possible.', text: 'text-violet-300', border: 'border-violet-400/40', bg: 'bg-violet-400/8' },
  evaluated: { label: 'EVALUATED', desc: 'Trials ran and were judged. An evaluation result is not a promotion.', text: 'text-amber-accent', border: 'border-amber-accent/40', bg: 'bg-amber-accent/8' },
  review: { label: 'IN REVIEW', desc: 'Under human review; comparisons inspected for validity.', text: 'text-amber-accent', border: 'border-amber-accent/40', bg: 'bg-amber-accent/8' },
  authorised: { label: 'AUTHORISED', desc: 'An authority decision exists, bound to a specific record. Authorisation is recorded, execution still separate.', text: 'text-teal-accent', border: 'border-teal-accent/40', bg: 'bg-teal-accent/8' },
  promoted: { label: 'PROMOTED', desc: 'A recorded promotion decision replaced the baseline reference.', text: 'text-teal-accent', border: 'border-teal-accent/50', bg: 'bg-teal-accent/12' },
  rejected: { label: 'REJECTED', desc: 'A recorded decision not to adopt, with its reason.', text: 'text-red-accent', border: 'border-red-accent/40', bg: 'bg-red-accent/8' },
  withdrawn: { label: 'WITHDRAWN', desc: 'Withdrawn by its proposer before evaluation completed.', text: 'text-ink-400', border: 'border-ink-500/50', bg: 'bg-ink-700/40' },
};

export interface Candidate {
  id: string;
  label: string;
  change: CandidateChange;
  status: CandidateStatus;
  /** The baseline execution this candidate proposes to replace. */
  baselineExecutionId: string;
  /** The parent candidate, when this is a revision. */
  parentId?: string;
  /** Executions run under this candidate. */
  executionIds: string[];
  proposedAt: string;
  note: string;
}

// ─── Experiments ─────────────────────────────────────────────────────────

export type ArmKind = 'baseline' | 'candidate' | 'control' | 'confounded';

export interface ExperimentArm {
  id: string;
  label: string;
  kind: ArmKind;
  /** The candidate this arm evaluates, when any. */
  candidateId?: string;
  /** An execution that anchors this arm (e.g. the baseline reference run). */
  executionIds: string[];
  /** Which coordinates this arm intentionally changes, relative to the baseline arm. */
  changedCoordinates: CoordinateKind[];
  /** What the operator intended to learn. */
  intent: string;
}

export type TrialOutcome = 'completed' | 'failed' | 'interrupted' | 'unclassified';

export interface Trial {
  id: string;
  executionId: string;
  armId: string;
  experimentId: string;
  taskId: string;
  /** 1-based trial index within its cell. */
  index: number;
  outcome: TrialOutcome;
  /** The success check's verdict. UNAVAILABLE when the check never ran or the evaluator failed. */
  check: { status: 'passed' | 'failed' | 'unavailable'; reason?: string };
  /** Evaluator verdict. A failed evaluator run is not automatically a failed task. */
  evaluator: { status: 'passed' | 'failed' | 'unavailable'; reason?: string };
  usage: { promptTokens: number; completionTokens: number } | { unavailable: true; reason: string };
  wallMs: number | { unavailable: true; reason: string };
  sessionId?: string;
  note?: string;
}

export interface Experiment {
  id: string;
  label: string;
  question: string;
  /** What was intentionally held constant, and what could not be. */
  design: {
    controlled: string[];
    confounds: string[];
    holdoutUsed: boolean;
    /** Whether the holdout was kept from any selection policy. */
    holdoutSealed: boolean;
  };
  seed: number | null;
  repetitions: number;
  armIds: string[];
  checkpointId?: string;
  startedAt: string;
  status: 'complete' | 'interrupted' | 'degraded';
  note: string;
}

// ─── Promotion & authority ───────────────────────────────────────────────

export type PromotionStage =
  | 'observed' | 'proposed' | 'isolated' | 'evaluated'
  | 'compared' | 'reviewed' | 'authorised' | 'promoted'
  | 'blocked';

export interface PromotionStep {
  stage: PromotionStage;
  status: 'done' | 'failed' | 'unavailable';
  /** Which recorded artifact carries this step (a candidate, experiment, trial or decision id). */
  recordId?: string;
  /** Who decided, for authority stages. */
  authority?: string;
  note: string;
}

export interface PromotionRecord {
  id: string;
  candidateId: string;
  /** The stages recorded so far, in order. Success at evaluation does not imply the next. */
  steps: PromotionStep[];
  /** The governing authority, when an authorisation exists. */
  authorisation?: { authority: string; note: string };
  outcome: string;
}

// ─── Corpus root ─────────────────────────────────────────────────────

export interface EvolveCorpus {
  checkpoints: Checkpoint[];
  edges: LineageEdge[];
  executions: Execution[];
  candidates: Candidate[];
  experiments: Experiment[];
  arms: ExperimentArm[];
  trials: Trial[];
  promotions: PromotionRecord[];
  sources: Source[];
}
