import type { Session, TrajectoryEvent } from '../domain/types';

// ─── Alignment semantics ─────────────────────────────────────────────────────
//
// The comparison model is deliberately explicit and deterministic:
//
//   1. Phase A — exact signature match. Events with identical `kind` + `tool`
//      and identical normalised field values are "matched". For this prototype
//      the normalisation is: field map equality on {tool, path, cmd} keys.
//   2. Phase B — signature match. Remaining events with identical `kind` +
//      `tool` are paired greedily in storage order. These are PROPOSED
//      correspondences: same recorded action type, not verified identity.
//   3. Everything left over is UNMATCHED on its side (changed, missing, or
//      additional — the UI must not decide which without further evidence).
//
// No semantic inference, no timestamps-based pairing, no causal claims.

export type AlignmentClass =
  | { type: 'exact'; a: TrajectoryEvent; b: TrajectoryEvent }
  | { type: 'proposed'; a: TrajectoryEvent; b: TrajectoryEvent }
  | { type: 'unmatched-a'; a: TrajectoryEvent }
  | { type: 'unmatched-b'; b: TrajectoryEvent };

export interface AlignmentMethodology {
  phases: { name: string; rule: string }[];
  caveats: string[];
}

export const ALIGNMENT_METHODOLOGY: AlignmentMethodology = {
  phases: [
    {
      name: 'Phase 1 — exact signature',
      rule: 'Same event kind and tool, and identical values for the compared fields (tool, path, cmd). Classified as MATCHED — the same recorded action with the same recorded arguments.',
    },
    {
      name: 'Phase 2 — signature match (proposed)',
      rule: 'Same event kind and tool, paired greedily in storage order. Classified as PROPOSED — a correspondence between similar actions, not a verified identity.',
    },
    {
      name: 'Residual — unmatched',
      rule: 'Records left unpaired on either side. Shown as UNMATCHED: changed, missing, or additional — the record does not distinguish these without further evidence.',
    },
  ],
  caveats: [
    'Alignment uses recorded kinds, tools and compared fields only. It performs no semantic analysis of request or response content.',
    'A PROPOSED correspondence is a hypothesis for inspection, not a verified pairing.',
    'Sequence in storage order is preserved within each phase; no timestamps are used for pairing.',
    'Unmatched records are not labelled as errors — divergence is a description, not a verdict.',
  ],
};

const COMPARE_FIELDS = ['tool', 'path', 'cmd'] as const;

function signatureKey(e: TrajectoryEvent): string {
  return e.tool ? `${e.kind}|${e.tool}` : e.kind;
}

function fieldFingerprint(e: TrajectoryEvent): string {
  const parts = COMPARE_FIELDS.map((f) => {
    const field = e.fields.find((x) => x.key === f);
    return field ? `${f}=${field.value}` : '';
  }).filter(Boolean);
  return parts.join('&');
}

export function alignTrajectories(a: TrajectoryEvent[], b: TrajectoryEvent[]): AlignmentClass[] {
  const result: AlignmentClass[] = [];
  const bPool = new Map<number, TrajectoryEvent>(b.map((e) => [e.seq, e]));

  const takeExact = (ea: TrajectoryEvent): TrajectoryEvent | undefined => {
    const fp = fieldFingerprint(ea);
    if (fp === '') return undefined;
    const match = [...bPool.values()].find(
      (eb) => signatureKey(eb) === signatureKey(ea) && fieldFingerprint(eb) === fp,
    );
    if (match) bPool.delete(match.seq);
    return match;
  };

  // Phase 1 — exact signature.
  const aRest: TrajectoryEvent[] = [];
  for (const ea of a) {
    const match = takeExact(ea);
    if (match) {
      result.push({ type: 'exact', a: ea, b: match });
    } else {
      aRest.push(ea);
    }
  }

  // Phase 2 — proposed (same kind + tool, greedy in storage order).
  const bRemaining = [...bPool.values()].sort((x, y) => x.seq - y.seq);
  const bRestPool = new Map(bRemaining.map((e) => [e.seq, e]));
  for (const ea of aRest) {
    const match = bRemaining.find(
      (eb) => bRestPool.has(eb.seq) && signatureKey(eb) === signatureKey(ea),
    );
    if (match) {
      bRestPool.delete(match.seq);
      result.push({ type: 'proposed', a: ea, b: match });
    } else {
      result.push({ type: 'unmatched-a', a: ea });
    }
  }
  for (const eb of bRestPool.values()) {
    result.push({ type: 'unmatched-b', b: eb });
  }

  return result;
}

// ─── Session-derived statistics ──────────────────────────────────────────────

export interface SessionStats {
  eventCount: number;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  errorCount: number;
  partialCount: number;
  toolCallCount: number;
  modelRequestCount: number;
  usageRows: number;
  usageMissing: number;
  firstOffsetMs: number;
  lastOffsetMs: number;
}

export function sessionStats(s: Session): SessionStats {
  const byCategory: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let usageRows = 0;
  let usageMissing = 0;
  for (const e of s.events) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
    byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
    if (e.usage?.present) usageRows += 1;
    if (e.usage && !e.usage.present) usageMissing += 1;
  }
  return {
    eventCount: s.events.length,
    byCategory,
    byStatus,
    errorCount: byStatus['error'] ?? 0,
    partialCount: byStatus['partial'] ?? 0,
    toolCallCount: s.events.filter((e) => e.kind === 'tool.call').length,
    modelRequestCount: s.events.filter((e) => e.kind === 'model.request').length,
    usageRows,
    usageMissing,
    firstOffsetMs: s.events[0]?.offsetMs ?? 0,
    lastOffsetMs: s.events[s.events.length - 1]?.offsetMs ?? 0,
  };
}

// ─── Validation ──────────────────────────────────────────────────────────────

export interface ValidationResult {
  sessionId: string;
  errors: string[];
  warnings: string[];
}

/**
 * Deterministic consistency checks over a session's fixtures. These enforce
 * the prototype's epistemic rules: storage order, reference integrity, and
 * that missing usage is never presented as present.
 */
export function validateSession(s: Session): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  s.events.forEach((e, i) => {
    if (e.seq !== i + 1) errors.push(`event ${e.id}: seq ${e.seq} out of storage order (expected ${i + 1})`);
    const expectedOffset = Date.parse(e.at) - Date.parse(s.events[0].at);
    if (e.offsetMs !== expectedOffset)
      errors.push(`event ${e.id}: offsetMs ${e.offsetMs} does not match timestamp delta ${expectedOffset}`);
    if (e.usage && e.usage.present && e.usage.promptTokens === 0 && e.usage.completionTokens === 0)
      warnings.push(`event ${e.id}: usage present but all counts zero — check whether this should be NA`);
    for (const ref of e.refs ?? []) {
      const target = s.events.find((t) => t.id === ref.target);
      if (!target) errors.push(`event ${e.id}: refs target ${ref.target} not found in session`);
      else if (target.seq >= e.seq) warnings.push(`event ${e.id}: refs forward to ${ref.target} (seq ${target.seq}) — confirm this is intentional`);
    }
  });

  for (const it of s.interventions) {
    for (const step of it.steps) {
      const ev = s.events.find((e) => e.seq === step.eventSeq);
      if (!ev) errors.push(`intervention ${it.id}: step ${step.stage} references missing event seq ${step.eventSeq}`);
      else if (ev.category !== 'intervention')
        errors.push(`intervention ${it.id}: step ${step.stage} references non-intervention event ${ev.id}`);
    }
  }

  const ledger = s.sources.find((src) => src.id === 'src:usage-ledger');
  if (ledger?.condition === 'degraded' && s.events.some((e) => e.usage?.present) === false)
    warnings.push(`session ${s.id}: ledger degraded but no event carries a present usage row`);

  return { sessionId: s.id, errors, warnings };
}
