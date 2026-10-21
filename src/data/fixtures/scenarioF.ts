import { mkEvent, obs, rep, der, na, SRC, sourcesComplete, capabilitiesStandard } from './shared';
import type { Intervention, RuntimeIdentity, Session, Source, TrajectoryEvent } from '../../domain/types';

// ─── Scenario F: authorised interventions (STEER + QUEUE) ────────────────────

const fRuntime: RuntimeIdentity = {
  agent: 'meridian-coder',
  runtime: 'endophasia-runtime',
  runtimeVersion: '0.4.2',
  harness: 'cli-harness/1.1.0',
  fingerprint: 'a3f1-9c42-e8b7-2d60',
  recordedAt: 'recorded 2026-10-19 09:14:02 UTC',
  config: [
    { key: 'network_policy', value: 'allowlist (0 hosts)' },
    { key: 'sandbox', value: 'on' },
    { key: 'persistence', value: 'none' },
    { key: 'usage_ledger', value: 'enabled' },
    { key: 'intervention_ledger', value: 'enabled' },
  ],
};

const fEvents: TrajectoryEvent[] = [
  mkEvent('f-01', {
    seq: 1, offsetMs: 0, category: 'lifecycle', producer: 'harness', kind: 'session.attach',
    title: 'Session attached',
    summary: 'Harness attached with the intervention ledger enabled. Task: add rate limiting to the public API route.',
    fields: [
      { key: 'session_id', value: 'run-1f4c88' },
      { key: 'workspace', value: '/workspace/billing-service' },
      { key: 'intervention_ledger', value: 'enabled' },
    ],
    evidence: [
      obs('Attachment', 'Attachment event recorded.', SRC.eventLog),
      rep('Runtime identity', 'Identity as declared at handshake.', SRC.runtimeRegistry),
    ],
  }),
  mkEvent('f-02', {
    seq: 2, offsetMs: 2100, category: 'model', producer: 'agent', kind: 'model.request',
    title: 'Model request 1 — plan',
    summary: 'Agent plans to add a fixed-window limiter to the API route with tests.',
    fields: [{ key: 'request', value: 'req-001' }],
    evidence: [
      rep('Request record', 'Recorded via the harness transport.', SRC.eventLog),
      obs('Usage row', 'Ledger row present.', SRC.usageLedger),
    ],
    usage: { present: true, promptTokens: 10420, completionTokens: 486, cacheReadTokens: 0 },
  }),
  mkEvent('f-03', {
    seq: 3, offsetMs: 4400, category: 'intervention', producer: 'operator', kind: 'intervention.step',
    title: 'STEER intervention — proposed',
    summary: 'Operator proposed a STEER directive: prefer the sliding-window algorithm already used elsewhere in the codebase. Proposal recorded; no authorisation yet.',
    fields: [
      { key: 'intervention', value: 'STEER int-s1' },
      { key: 'stage', value: 'proposed' },
      { key: 'directive', value: 'prefer sliding-window algorithm' },
    ],
    evidence: [
      obs('Proposal record', 'Proposal recorded in the intervention ledger before authorisation.', SRC.interventionLedger),
    ],
  }),
  mkEvent('f-04', {
    seq: 4, offsetMs: 4900, category: 'intervention', producer: 'operator', kind: 'intervention.step',
    title: 'STEER intervention — authorised',
    summary: 'Operator token o-77 authorised the directive, scoped to this session. Authorisation recorded. No agent behaviour has changed yet: acceptance is not execution.',
    fields: [
      { key: 'intervention', value: 'STEER int-s1' },
      { key: 'stage', value: 'authorised' },
      { key: 'authorisation', value: 'granted (operator token o-77)' },
      { key: 'scope', value: 'this session only' },
    ],
    evidence: [
      obs('Authorisation record', 'Authorisation step recorded as a separate event.', SRC.interventionLedger),
      rep('Authorisation', 'Operator token o-77 as presented to the harness.', SRC.harnessRegistry),
    ],
  }),
  mkEvent('f-05', {
    seq: 5, offsetMs: 6300, category: 'intervention', producer: 'harness', kind: 'intervention.step',
    title: 'STEER intervention — accepted',
    summary: 'The harness recorded delivery of the directive to the agent, and the next model request reflects the constraint. Acceptance is recorded delivery, not evidence of the intended effect.',
    fields: [
      { key: 'intervention', value: 'STEER int-s1' },
      { key: 'stage', value: 'accepted' },
      { key: 'delivery', value: 'recorded in request context' },
    ],
    evidence: [
      obs('Acceptance record', 'Acceptance event recorded by the harness.', SRC.interventionLedger),
    ],
  }),
  mkEvent('f-06', {
    seq: 6, offsetMs: 8100, category: 'model', producer: 'agent', kind: 'model.request',
    title: 'Model request 2 — revised plan',
    summary: 'Agent\'s revised plan references the sliding-window algorithm. Consistent with the directive; the record shows sequence, not causation.',
    fields: [{ key: 'request', value: 'req-002' }],
    refs: [{ target: 'f-05', relation: 'follows_intervention' }],
    evidence: [
      rep('Request record', 'Recorded via the harness transport.', SRC.eventLog),
      obs('Usage row', 'Ledger row present.', SRC.usageLedger),
    ],
    structured: {
      key: 'plan_outline',
      value: ['read src/api/ratelimit/sliding_window.ts', 'apply to public route', 'add tests', 'run suite'],
    },
    usage: { present: true, promptTokens: 12890, completionTokens: 502, cacheReadTokens: 10420 },
  }),
  mkEvent('f-07', {
    seq: 7, offsetMs: 10600, category: 'tool', producer: 'agent', kind: 'tool.call', tool: 'fs.read',
    title: 'Tool call: fs.read',
    summary: 'Read src/api/ratelimit/sliding_window.ts (64 lines).',
    fields: [
      { key: 'tool', value: 'fs.read' },
      { key: 'path', value: 'src/api/ratelimit/sliding_window.ts' },
      { key: 'exit', value: 'ok' },
    ],
    evidence: [
      obs('Call record', 'Tool call event recorded.', SRC.eventLog),
      obs('Result record', 'Tool result recorded.', SRC.eventLog),
    ],
  }),
  mkEvent('f-08', {
    seq: 8, offsetMs: 12800, category: 'tool', producer: 'agent', kind: 'tool.call', tool: 'fs.write',
    title: 'Tool call: fs.write',
    summary: 'Applied the sliding-window limiter to the public route (3 hunks).',
    fields: [
      { key: 'tool', value: 'fs.write' },
      { key: 'path', value: 'src/api/public/route.ts' },
      { key: 'exit', value: 'ok' },
    ],
    evidence: [obs('Call record', 'Write event recorded with a diff digest.', SRC.eventLog)],
  }),
  mkEvent('f-09', {
    seq: 9, offsetMs: 15200, category: 'intervention', producer: 'operator', kind: 'intervention.step',
    title: 'QUEUE intervention — proposed and authorised',
    summary: 'Operator proposed a QUEUE item (add pagination to the admin export) and authorised it for this session. It enters the queue; delivery is not guaranteed within the session.',
    fields: [
      { key: 'intervention', value: 'QUEUE int-q1' },
      { key: 'stage', value: 'authorised' },
      { key: 'queued_item', value: 'add pagination to admin export' },
      { key: 'authorisation', value: 'granted (operator token o-77)' },
    ],
    evidence: [
      obs('Queue record', 'Queue authorisation recorded in the intervention ledger.', SRC.interventionLedger),
    ],
  }),
  mkEvent('f-10', {
    seq: 10, offsetMs: 17600, category: 'tool', producer: 'agent', kind: 'tool.call', tool: 'shell.exec',
    title: 'Tool call: shell.exec — tests pass',
    summary: 'Ran the rate-limit tests: 18 passed, 0 failed. Exit code 0.',
    fields: [
      { key: 'tool', value: 'shell.exec' },
      { key: 'cmd', value: 'npm test -- ratelimit' },
      { key: 'exit', value: '0' },
    ],
    evidence: [
      obs('Call record', 'Command invocation recorded.', SRC.eventLog),
      obs('Result record', 'Exit code 0; output captured (641 bytes).', SRC.eventLog),
    ],
  }),
  mkEvent('f-11', {
    seq: 11, offsetMs: 19000, category: 'intervention', producer: 'harness', kind: 'intervention.step',
    title: 'QUEUE intervention — expired unconsumed',
    summary: 'The session completed with the queue item still pending: the harness recorded it as expired-unconsumed. Acceptance of the queue item never occurred, and its intended work was not performed.',
    fields: [
      { key: 'intervention', value: 'QUEUE int-q1' },
      { key: 'stage', value: 'expired' },
      { key: 'consumed', value: 'false' },
    ],
    evidence: [
      obs('Expiry record', 'Expiry recorded in the intervention ledger at session close.', SRC.interventionLedger),
      na('Consumption record', 'The queue item was never delivered to the agent.'),
    ],
  }),
  mkEvent('f-12', {
    seq: 12, offsetMs: 20400, category: 'verification', producer: 'harness', kind: 'verify.digest',
    title: 'Post-write verification',
    summary: 'Harness digest check over the modified route. Match.',
    fields: [
      { key: 'method', value: 'digest-compare' },
      { key: 'match', value: 'true' },
    ],
    evidence: [
      obs('Verification', 'Verification event recorded.', SRC.eventLog),
      der('Digest match', 'diff_sha256 equal before/after', 'SHA-256 of the written file compared with the write-time digest.', SRC.eventLog),
    ],
  }),
  mkEvent('f-13', {
    seq: 13, offsetMs: 22600, category: 'lifecycle', producer: 'harness', kind: 'session.complete',
    title: 'Session completed',
    summary: 'Task completed. One STEER intervention consumed; one QUEUE intervention expired unconsumed. Acceptance and consumption are recorded as distinct steps.',
    fields: [
      { key: 'outcome', value: 'completed' },
      { key: 'interventions_consumed', value: '1 (STEER int-s1)' },
      { key: 'interventions_expired', value: '1 (QUEUE int-q1)' },
    ],
    evidence: [obs('Completion', 'Lifecycle completion event recorded.', SRC.eventLog)],
    structured: {
      key: 'final_state',
      value: { outcome: 'completed', files_changed: 1, tests_run: 18, wall_ms: 22600 },
    },
  }),
];

const fInterventions: Intervention[] = [
  {
    id: 'int-s1',
    kind: 'STEER',
    intent: 'Prefer the sliding-window rate-limit algorithm already used elsewhere in the codebase.',
    authorisation: 'operator token o-77, granted 2026-10-19 09:14:06 UTC',
    scope: 'this session only',
    steps: [
      { stage: 'proposed', eventSeq: 3, note: 'Proposed by operator o-77.' },
      { stage: 'authorised', eventSeq: 4, note: 'Authorised with the same operator token; separate recorded step.' },
      { stage: 'accepted', eventSeq: 5, note: 'Delivery recorded by the harness; the next request (seq 6) reflects the constraint.' },
      { stage: 'consumed', eventSeq: 5, note: 'Consumption recorded against the intervention record; the patch at seq 8 is consistent with the directive but the record shows sequence, not causation.' },
    ],
  },
  {
    id: 'int-q1',
    kind: 'QUEUE',
    intent: 'Add pagination to the admin export endpoint.',
    authorisation: 'operator token o-77, granted 2026-10-19 09:14:14 UTC',
    scope: 'this session only',
    steps: [
      { stage: 'proposed', eventSeq: 9, note: 'Proposed and authorised in the same event.' },
      { stage: 'expired', eventSeq: 11, note: 'Expired unconsumed at session close.' },
    ],
  },
];

const fUsageRows = fEvents.filter((e) => e.usage?.present).length;

const fSources: Source[] = sourcesComplete.map((s) => {
  if (s.id === SRC.eventLog) return { ...s, records: fEvents.length };
  if (s.id === SRC.usageLedger) return { ...s, records: fUsageRows };
  if (s.id === SRC.interventionLedger)
    return {
      id: SRC.interventionLedger,
      name: 'Intervention ledger',
      kind: 'intervention records',
      condition: 'readable',
      note: 'Proposal, authorisation, acceptance, consumption and expiry recorded as separate events.',
      records: 6,
    };
  return s;
});

export const scenarioF: Session = {
  id: 'run-1f4c88',
  label: 'Rate limiter — authorised interventions',
  scenario: 'Scenario F — authorised interventions',
  taskId: 'Add rate limiting to the public API route',
  state: 'completed',
  outcome: 'Task completed. STEER consumed; QUEUE expired unconsumed. Each lifecycle step recorded separately.',
  startedAt: '2026-10-19 09:14:02 UTC',
  durationMs: 22600,
  runtime: fRuntime,
  capabilities: capabilitiesStandard,
  sources: fSources,
  events: fEvents,
  interventions: fInterventions,
};
