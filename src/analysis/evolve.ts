import type {
  Candidate,
  Checkpoint,
  CoordinateKind,
  CoordinateValue,
  EvolveCorpus,
  Execution,
  Experiment,
  ExperimentArm,
  Trial,
} from '../domain/evolve';
import { COORDINATE_SPECS, continuationSupport } from '../domain/evolve';

// ─── Comparability inspection ────────────────────────────────────────────────
//
// Two arms are compared coordinate by coordinate. Every coordinate is classified:
//
//   MATCHED      — both recorded, equal values.
//   CHANGED      — both recorded, different values. The caller decides whether
//                  the change is the manipulated variable or a confound; the
//                  arm's changedCoordinates list gives the declared intent.
//   UNMATCHED    — at least one side UNAVAILABLE. A missing coordinate is never
//                  treated as equal or as different: no comparison exists.
//
// Verdicts:
//   comparable   — no unmatched coordinates, no within-arm drift, and every
//                  changed coordinate is in the candidate arm's declared
//                  changedCoordinates.
//   flag-changed — changed coordinates outside the declared manipulation.
//   confounded   — one or more unmatched coordinates, within-arm drift on
//                  either side, or the arm is declared confounded.

export type CoordinateClass = 'matched' | 'changed' | 'unmatched' | 'not-declared';

export interface CoordinateComparison {
  kind: CoordinateKind;
  label: string;
  group: 'identity' | 'execution' | 'measurement';
  why: string;
  cls: CoordinateClass;
  a?: string; // recorded value on side A
  b?: string;
  aUnavailable?: string; // reason
  bUnavailable?: string;
  /** True when this change is one of the candidate arm's declared changes. */
  declaredChange: boolean;
}

export type ComparabilityVerdict = 'comparable' | 'changed-outside-declaration' | 'confounded';

export interface ComparabilityReport {
  aArmId: string;
  bArmId: string;
  coordinates: CoordinateComparison[];
  /** Within-arm coordinate disagreement on either side, when measured. */
  drift: DriftFinding[];
  verdict: ComparabilityVerdict;
  summary: string;
}

function coordValue(c: CoordinateValue<string> | undefined): { recorded?: string; unavailable?: string } {
  if (!c) return { unavailable: 'coordinate not declared on this arm' };
  return c.status === 'recorded' ? { recorded: c.value } : { unavailable: c.reason };
}

export function compareArms(
  corpus: EvolveCorpus,
  aArmId: string,
  bArmId: string,
): ComparabilityReport {
  const execsOf = (armId: string) => {
    const arm = corpus.arms.find((a) => a.id === armId);
    const ids = new Set([...(arm?.executionIds ?? [])]);
    return corpus.executions.filter((e) => ids.has(e.id) || e.armId === armId);
  };
  const aExec = execsOf(aArmId);
  const bExec = execsOf(bArmId);
  const coordinates: CoordinateComparison[] = [];

  for (const spec of COORDINATE_SPECS) {
    const va = firstCoordinate(aExec, spec.kind);
    const vb = firstCoordinate(bExec, spec.kind);
    const a = coordValue(va);
    const b = coordValue(vb);

    let cls: CoordinateClass;
    if (a.recorded !== undefined && b.recorded !== undefined) {
      cls = a.recorded === b.recorded ? 'matched' : 'changed';
    } else {
      cls = 'unmatched';
    }

    const bArm = corpus.arms.find((x) => x.id === bArmId);
    const declaredChange = cls === 'changed' && (bArm?.changedCoordinates.includes(spec.kind) ?? false);

    coordinates.push({
      kind: spec.kind,
      label: spec.label,
      group: spec.group,
      why: spec.why,
      cls,
      a: a.recorded,
      b: b.recorded,
      aUnavailable: a.unavailable,
      bUnavailable: b.unavailable,
      declaredChange,
    });
  }

  const unmatched = coordinates.filter((c) => c.cls === 'unmatched');
  const undeclared = coordinates.filter((c) => c.cls === 'changed' && !c.declaredChange);
  const drift = [...armDrift(corpus, aArmId), ...armDrift(corpus, bArmId)];

  let verdict: ComparabilityVerdict;
  if (unmatched.length > 0) verdict = 'confounded';
  else if (drift.length > 0) verdict = 'confounded';
  else if (undeclared.length > 0) verdict = 'changed-outside-declaration';
  else verdict = 'comparable';

  const summary = verdict === 'comparable'
    ? 'All coordinates matched, except changes the candidate arm declares as its manipulation. Outcome comparison is interpretable, with the trial counts as the bound on precision.'
    : verdict === 'changed-outside-declaration'
      ? `Changed coordinates outside the declared manipulation: ${undeclared.map((c) => c.label).join(', ')}. The difference may not measure what the arm intended.`
      : unmatched.length > 0
        ? `Unmatched coordinates: ${unmatched.map((c) => c.label).join(', ')}. At least one side could not record them — the arms are not fully comparable, and no verdict is offered on relative outcome.`
        : `Within-arm drift: ${drift.map((d) => d.label).join(', ')} varies between replicates inside an arm. The arms do not hold their conditions constant, so no cross-arm comparison is offered.`;

  return { aArmId, bArmId, coordinates, drift, verdict, summary };
}

function firstCoordinate(execs: Execution[], kind: CoordinateKind): CoordinateValue<string> | undefined {
  for (const e of execs) {
    const v = e.coordinates[kind];
    if (v) return v;
  }
  return undefined;
}

/**
 * Within-arm drift: executions sharing an arm must agree on every coordinate
 * they record. Disagreement is a confound even when the arm declares a change —
 * the change must be a property of the arm, not vary between its replicates.
 */
export interface DriftFinding {
  kind: CoordinateKind;
  label: string;
  /** Recorded values observed within the arm, with the executions carrying them. */
  variants: { value: string; executionIds: string[] }[];
}

export function armDrift(corpus: EvolveCorpus, armId: string): DriftFinding[] {
  const arm = corpus.arms.find((a) => a.id === armId);
  if (!arm) return [];
  const ids = new Set(arm.executionIds);
  const execs = corpus.executions.filter((e) => ids.has(e.id) || e.armId === armId);

  const findings: DriftFinding[] = [];
  for (const spec of COORDINATE_SPECS) {
    const byValue = new Map<string, string[]>();
    for (const e of execs) {
      const v = e.coordinates[spec.kind];
      if (v?.status === 'recorded') {
        const list = byValue.get(v.value) ?? [];
        list.push(e.id);
        byValue.set(v.value, list);
      }
    }
    if (byValue.size > 1) {
      findings.push({
        kind: spec.kind,
        label: spec.label,
        variants: [...byValue.entries()].map(([value, executionIds]) => ({ value, executionIds })),
      });
    }
  }
  return findings;
}

// ─── Derived result statistics ───────────────────────────────────────────────
//
// Methodology (documented in the UI alongside every figure):
//
// - Pass rate: successes / denominators over trials whose check status is
//   'passed' or 'failed'. Trials with check UNAVAILABLE never enter either
//   side: a failed evaluator run is not a failed task, and an environment
//   failure is not a reward of 0.
// - Interval: Wilson score interval at 95%. With n this small the interval is
//   wide, and the interface shows the width, not just the centre.
// - Usage: median and IQR (type-7 quartiles) over trials with recorded usage.
//   Trials with UNAVAILABLE usage are counted and reported as missing; they
//   never contribute a zero.

export interface CellStats {
  armId: string;
  total: number;
  completed: number;
  failed: number;
  interrupted: number;
  passDenominator: number;
  passes: number;
  passRate: { centre: number; low: number; high: number } | { unavailable: true; reason: string };
  usage: { medianTokens: number; iqrLow: number; iqrHigh: number; n: number; missing: number } | { unavailable: true; reason: string };
  wallMs: { medianMs: number; iqrLow: number; iqrHigh: number; n: number } | { unavailable: true; reason: string };
}

export function cellStats(trials: Trial[], armId: string): CellStats {
  const cell = trials.filter((t) => t.armId === armId);
  const completed = cell.filter((t) => t.outcome === 'completed').length;
  const failed = cell.filter((t) => t.outcome === 'failed').length;
  const interrupted = cell.filter((t) => t.outcome === 'interrupted').length;

  const judged = cell.filter((t) => t.check.status !== 'unavailable');
  const passes = judged.filter((t) => t.check.status === 'passed').length;

  const passRate = judged.length > 0
    ? wilson(passes, judged.length)
    : { unavailable: true as const, reason: 'no trial produced a check verdict' };

  const usageVals: number[] = [];
  for (const t of cell) {
    if ('unavailable' in t.usage) continue;
    usageVals.push(t.usage.promptTokens + t.usage.completionTokens);
  }
  usageVals.sort((a, b) => a - b);
  const usageMissing = cell.length - usageVals.length;
  const usage = usageVals.length > 0
    ? { medianTokens: quantile(usageVals, 0.5), iqrLow: quantile(usageVals, 0.25), iqrHigh: quantile(usageVals, 0.75), n: usageVals.length, missing: usageMissing }
    : { unavailable: true as const, reason: 'no trial recorded usage' };

  const wallVals = cell
    .filter((t) => typeof t.wallMs === 'number')
    .map((t) => t.wallMs as number)
    .sort((a, b) => a - b);
  const wall = wallVals.length > 0
    ? { medianMs: quantile(wallVals, 0.5), iqrLow: quantile(wallVals, 0.25), iqrHigh: quantile(wallVals, 0.75), n: wallVals.length }
    : { unavailable: true as const, reason: 'no trial recorded wall time' };

  return { armId, total: cell.length, completed, failed, interrupted, passDenominator: judged.length, passes, passRate, usage, wallMs: wall };
}

/** Wilson score interval, 95% (z = 1.96). */
export function wilson(passes: number, n: number): { centre: number; low: number; high: number } {
  const z = 1.96;
  const p = passes / n;
  const denom = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denom;
  const spread = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return { centre, low: Math.max(0, centre - spread), high: Math.min(1, centre + spread) };
}

/** Type-7 quartiles (linear interpolation), matching the report methodology. */
export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base] + (sorted[base + 1] !== undefined ? rest * (sorted[base + 1] - sorted[base]) : 0);
}

// ─── Lineage validation ──────────────────────────────────────────────────────

export interface LineageValidation {
  errors: string[];
  warnings: string[];
}

/**
 * Deterministic integrity checks over the corpus:
 * - edges point at existing executions;
 * - executions with a sessionId point at a session that exists in the
 *   observation registry (checked by the caller injecting the session ids);
 * - arms reference their experiments;
 * - trials reference their arms and executions;
 * - checkpoint forkability claims match the recorded state;
 * - candidate status transitions are coherent with the promotion record.
 */
export function validateCorpus(corpus: EvolveCorpus, sessionIds: Set<string>): LineageValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const execIds = new Set(corpus.executions.map((e) => e.id));
  const armIds = new Set(corpus.arms.map((a) => a.id));
  const candIds = new Set(corpus.candidates.map((c) => c.id));

  for (const edge of corpus.edges) {
    if (!execIds.has(edge.from)) errors.push(`edge ${edge.id}: from ${edge.from} not found`);
    if (!execIds.has(edge.to)) errors.push(`edge ${edge.id}: to ${edge.to} not found`);
    if (edge.from === edge.to) errors.push(`edge ${edge.id}: self-loop`);
  }

  for (const exec of corpus.executions) {
    if (exec.sessionId && !sessionIds.has(exec.sessionId))
      errors.push(`execution ${exec.id}: session ${exec.sessionId} not in the observation registry`);
    if (exec.armId && !armIds.has(exec.armId))
      errors.push(`execution ${exec.id}: arm ${exec.armId} not found`);
    const isDeclaredSimulation = corpus.edges.some((e) => e.from === exec.id && e.relation === 'simulated_branch');
    if (exec.role === 'continuation' && exec.durationMs === 0 && exec.sessionId === undefined && !isDeclaredSimulation) {
      warnings.push(`execution ${exec.id}: no session and no duration — confirm this is a projection, and label it simulated`);
      // A simulated projection must not carry usage claims via trials.
      const simTrials = corpus.trials.filter((t) => t.executionId === exec.id);
      for (const tr of simTrials) {
        if (!('unavailable' in tr.usage))
          warnings.push(`trial ${tr.id}: carries usage on a simulated projection — simulations report no usage`);
      }
    }
  }

  for (const arm of corpus.arms) {
    if (arm.candidateId && !candIds.has(arm.candidateId))
      errors.push(`arm ${arm.id}: candidate ${arm.candidateId} not found`);
    for (const eid of arm.executionIds)
      if (!execIds.has(eid)) errors.push(`arm ${arm.id}: execution ${eid} not found`);
  }

  for (const exp of corpus.experiments) {
    for (const aid of exp.armIds)
      if (!armIds.has(aid)) errors.push(`experiment ${exp.id}: arm ${aid} not found`);
    const cellTrials = corpus.trials.filter((t) => t.experimentId === exp.id);
    for (const tr of cellTrials) {
      if (!armIds.has(tr.armId)) errors.push(`trial ${tr.id}: arm ${tr.armId} not found`);
      if (!execIds.has(tr.executionId)) errors.push(`trial ${tr.id}: execution ${tr.executionId} not found`);
      if (tr.outcome === 'interrupted' && tr.check.status !== 'unavailable')
        warnings.push(`trial ${tr.id}: interrupted but check is judged — an interrupted trial cannot produce a verdict`);
    }
    if (exp.design.holdoutUsed && !exp.design.holdoutSealed)
      errors.push(`experiment ${exp.id}: holdout used but not sealed — the holdout must never be given to selection`);
  }

  for (const cp of corpus.checkpoints) {
    if (!execIds.has(cp.executionId)) errors.push(`checkpoint ${cp.id}: execution ${cp.executionId} not found`);
    const support = continuationSupport(cp);
    const anyCoreMissing = !cp.state.workspaceSnapshot.present || !cp.state.conversationPrefix.present || !cp.state.toolDefinitions.present;
    if (anyCoreMissing && support.recorded.supported)
      errors.push(`checkpoint ${cp.id}: forkable claim contradicts missing recorded state`);
  }

  for (const cand of corpus.candidates) {
    if (!execIds.has(cand.baselineExecutionId))
      errors.push(`candidate ${cand.id}: baseline execution ${cand.baselineExecutionId} not found`);
    for (const eid of cand.executionIds)
      if (!execIds.has(eid)) errors.push(`candidate ${cand.id}: execution ${eid} not found`);
  }

  for (const promo of corpus.promotions) {
    if (!candIds.has(promo.candidateId)) errors.push(`promotion ${promo.id}: candidate ${promo.candidateId} not found`);
    const promoted = promo.steps.find((s) => s.stage === 'promoted');
    const authorised = promo.steps.find((s) => s.stage === 'authorised');
    if (promoted?.status === 'done' && authorised?.status !== 'done')
      errors.push(`promotion ${promo.id}: promoted without a recorded authorisation — evaluation never implies promotion`);
    const cand = corpus.candidates.find((c) => c.id === promo.candidateId);
    if (cand && promoted?.status === 'done' && cand.status !== 'promoted')
      errors.push(`promotion ${promo.id}: promotion recorded but candidate status is ${cand.status}`);
    if (cand && promoted?.status !== 'done' && cand.status === 'promoted')
      errors.push(`candidate ${cand.id}: status promoted without a promotion record`);
  }

  return { errors, warnings };
}

// ─── Derived views ───────────────────────────────────────────────────────────

export function trialsForArm(corpus: EvolveCorpus, armId: string): Trial[] {
  return corpus.trials.filter((t) => t.armId === armId);
}

export function experimentById(corpus: EvolveCorpus, id: string): Experiment | undefined {
  return corpus.experiments.find((x) => x.id === id);
}

export function armById(corpus: EvolveCorpus, id: string): ExperimentArm | undefined {
  return corpus.arms.find((a) => a.id === id);
}

export function executionById(corpus: EvolveCorpus, id: string): Execution | undefined {
  return corpus.executions.find((e) => e.id === id);
}

export function candidateById(corpus: EvolveCorpus, id: string): Candidate | undefined {
  return corpus.candidates.find((c) => c.id === id);
}

export function checkpointById(corpus: EvolveCorpus, id: string): Checkpoint | undefined {
  return corpus.checkpoints.find((c) => c.id === id);
}

export function candidateOf(corpus: EvolveCorpus, candidateId: string): { candidate: Candidate; parent?: Candidate; baseline: Execution } | undefined {
  const candidate = candidateById(corpus, candidateId);
  if (!candidate) return undefined;
  const parent = candidate.parentId ? candidateById(corpus, candidate.parentId) : undefined;
  const baseline = executionById(corpus, candidate.baselineExecutionId);
  if (!baseline) return undefined;
  return { candidate, parent, baseline };
}

/** First-trial divergence between two trials' executions, when both have recorded sessions. */
export function lineageChildren(corpus: EvolveCorpus, executionId: string): { edgeId: string; child: Execution }[] {
  return corpus.edges
    .filter((e) => e.to === executionId)
    .map((e) => {
      const child = executionById(corpus, e.from);
      return child ? { edgeId: e.id, child } : null;
    })
    .filter((x): x is { edgeId: string; child: Execution } => x !== null);
}
