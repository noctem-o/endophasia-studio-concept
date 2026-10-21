import { mkEvent, obs, rep, der, na, SRC, runtimeStandard, sourcesComplete, capabilitiesStandard } from './shared';
import type { Intervention, Session, TrajectoryEvent } from '../../domain/types';
import { scenarioA } from './scenariosABE';

// ─── Scenario C: trajectory divergence (built by copying A's shared prefix) ──

const sharedPrefix: TrajectoryEvent[] = scenarioA.events
  .filter((e) => e.seq <= 8)
  .map((e) => ({
    ...e,
    id: e.id.replace('a-', 'c-'),
  }));

const cEvents: TrajectoryEvent[] = [
  ...sharedPrefix,
  mkEvent('c-09', {
    seq: 9, offsetMs: 15900, category: 'tool', producer: 'agent', kind: 'tool.call', tool: 'shell.exec',
    status: 'error',
    title: 'Tool call: shell.exec — failed',
    summary: 'Ran the test suite: 39 passed, 2 failed, 0 skipped. Exit code 1. The boundary-case tests still fail.',
    fields: [
      { key: 'tool', value: 'shell.exec' },
      { key: 'cmd', value: 'npm test -- proration' },
      { key: 'exit', value: '1' },
    ],
    evidence: [
      obs('Call record', 'Command invocation recorded.', SRC.eventLog),
      obs('Result record', 'Exit code 1; failure output captured (2,204 bytes).', SRC.eventLog),
    ],
    structured: {
      key: 'failing_tests',
      value: [
        { name: 'proration.spec.ts > rounds half up at boundary', status: 'failed' },
        { name: 'proration.spec.ts > negative amounts clamp', status: 'failed' },
      ],
    },
  }),
  mkEvent('c-10', {
    seq: 10, offsetMs: 19800, category: 'intervention', producer: 'operator', kind: 'intervention.step',
    title: 'Operator intervention — retry policy authorised',
    summary: 'Operator authorised a retry-policy change: once → loop-until-pass, this session only. Authorisation recorded; effect not yet observed.',
    fields: [
      { key: 'authorisation', value: 'granted (operator token o-77)' },
      { key: 'scope', value: 'this session only' },
    ],
    evidence: [
      obs('Intervention record', 'Intervention event with authorisation reference recorded.', SRC.interventionLedger),
      rep('Authorisation', 'Operator token o-77 as presented to the harness.', SRC.harnessRegistry),
    ],
  }),
  mkEvent('c-11', {
    seq: 11, offsetMs: 22400, category: 'model', producer: 'agent', kind: 'model.request',
    title: 'Model request 4 — revise patch',
    summary: 'Agent revises the patch under the loop-until-pass policy; second attempt.',
    fields: [{ key: 'request', value: 'req-004' }],
    evidence: [
      rep('Request record', 'Recorded via the harness transport.', SRC.eventLog),
      obs('Usage row', 'Ledger row present.', SRC.usageLedger),
    ],
    usage: { present: true, promptTokens: 27564, completionTokens: 741, cacheReadTokens: 15230 },
  }),
  mkEvent('c-12', {
    seq: 12, offsetMs: 25900, category: 'tool', producer: 'agent', kind: 'tool.call', tool: 'fs.write',
    title: 'Tool call: fs.write — second attempt',
    summary: 'Second patch attempt applied (2 hunks).',
    fields: [
      { key: 'tool', value: 'fs.write' },
      { key: 'path', value: 'src/invoice/proration.ts' },
      { key: 'exit', value: 'ok' },
    ],
    evidence: [obs('Call record', 'Write event recorded.', SRC.eventLog)],
  }),
  mkEvent('c-13', {
    seq: 13, offsetMs: 28300, category: 'tool', producer: 'agent', kind: 'tool.call', tool: 'shell.exec',
    status: 'error',
    title: 'Tool call: shell.exec — still failing',
    summary: 'Test suite still failing: 38 passed, 3 failed. Divergence from the reference outcome widens.',
    fields: [
      { key: 'tool', value: 'shell.exec' },
      { key: 'exit', value: '1' },
    ],
    evidence: [
      obs('Call record', 'Command invocation recorded.', SRC.eventLog),
      obs('Result record', 'Exit code 1.', SRC.eventLog),
    ],
  }),
  mkEvent('c-14', {
    seq: 14, offsetMs: 31500, category: 'lifecycle', producer: 'harness', kind: 'session.terminate',
    status: 'error',
    title: 'Session terminated — divergent outcome',
    summary: 'Harness budget exhausted under the retry policy. Session terminated with a recorded divergent outcome. Whether the intervention caused any change is not established by this record.',
    fields: [
      { key: 'outcome', value: 'divergent/terminated' },
      { key: 'journal', value: 'closed' },
    ],
    evidence: [
      obs('Termination', 'Lifecycle termination event recorded.', SRC.eventLog),
      na('Causal link to intervention', 'The record shows sequencing (authorise → revise → still failing), not causation.'),
    ],
    structured: {
      key: 'final_state',
      value: { outcome: 'divergent', retries: 1, files_changed: 1, tests_run: 46, wall_ms: 31500 },
    },
  }),
];

const cUsageRows = cEvents.filter((e) => e.usage?.present).length;

const cIntervention: Intervention = {
  id: 'int-1',
  kind: 'STEER',
  intent: 'Change retry policy to loop-until-pass so the agent keeps attempting the fix.',
  authorisation: 'operator token o-77, granted 2026-10-19 09:14:21 UTC',
  scope: 'this session only',
  steps: [
    { stage: 'proposed', eventSeq: 10, note: 'Proposed by operator o-77.' },
    { stage: 'authorised', eventSeq: 10, note: 'Authorisation recorded in the same intervention event.' },
    { stage: 'accepted', eventSeq: 10, note: 'Acceptance recorded in the intervention event; the subsequent request (seq 11) reflects the new policy.' },
    { stage: 'consumed', eventSeq: 10, note: 'Consumption recorded against the intervention record itself; the subsequent failing run (seq 13) does not establish the intervention caused any change.' },
  ],
};

export const scenarioC: Session = {
  id: 'run-6c07e4',
  label: 'Invoice proration — divergent outcome',
  scenario: 'Scenario C — trajectory divergence',
  taskId: 'Fix rounding error in monthly proration calculation',
  state: 'divergent-terminated',
  outcome: 'Terminated under retry policy; test suite still failing. Reference run (A) completed the same task.',
  startedAt: '2026-10-19 09:14:02 UTC',
  durationMs: 31500,
  runtime: runtimeStandard,
  capabilities: capabilitiesStandard,
  sources: sourcesComplete.map((s) =>
    s.id === SRC.eventLog
      ? { ...s, records: cEvents.length }
      : s.id === SRC.usageLedger
        ? { ...s, records: cUsageRows }
        : s,
  ),
  events: cEvents,
  interventions: [cIntervention],
};

// ─── Scenario D: evidence degradation (interrupted recording) ────────────────

const dEvents: TrajectoryEvent[] = [
  mkEvent('d-01', {
    seq: 1, offsetMs: 0, category: 'lifecycle', producer: 'harness', kind: 'session.attach',
    title: 'Session attached',
    summary: 'Harness attached to the runtime for a payment-webhook task. Usage ledger already degraded at attachment.',
    fields: [
      { key: 'session_id', value: 'run-8d41aa' },
      { key: 'workspace', value: '/workspace/billing-service' },
      { key: 'usage_ledger', value: 'degraded' },
    ],
    evidence: [
      obs('Attachment', 'Attachment event recorded.', SRC.eventLog),
      rep('Runtime identity', 'Identity as declared at handshake.', SRC.runtimeRegistry),
      der('Fingerprint', 'a3f1-9c42-e8b7-2d60', 'SHA-256 over the recorded runtime manifest, truncated.', SRC.runtimeRegistry),
    ],
  }),
  mkEvent('d-02', {
    seq: 2, offsetMs: 1900, category: 'model', producer: 'agent', kind: 'model.request',
    title: 'Model request 1',
    summary: 'Task interpretation. Agent plans to inspect the failing payment webhook handler.',
    fields: [{ key: 'request', value: 'req-001' }],
    evidence: [
      rep('Request record', 'Recorded via the harness transport.', SRC.eventLog),
      na('Usage row', 'Ledger degraded for this interval; row not written.'),
    ],
    usage: { present: false, reason: 'Usage ledger degraded at this interval; no row written.' },
  }),
  mkEvent('d-03', {
    seq: 3, offsetMs: 4000, category: 'tool', producer: 'agent', kind: 'tool.call', tool: 'fs.read',
    title: 'Tool call: fs.read',
    summary: 'Read src/webhooks/payment.ts (188 lines).',
    fields: [
      { key: 'tool', value: 'fs.read' },
      { key: 'path', value: 'src/webhooks/payment.ts' },
      { key: 'exit', value: 'ok' },
    ],
    evidence: [
      obs('Call record', 'Tool call event recorded.', SRC.eventLog),
      obs('Result record', 'Tool result recorded.', SRC.eventLog),
    ],
  }),
  mkEvent('d-04', {
    seq: 4, offsetMs: 6800, category: 'model', producer: 'agent', kind: 'model.request',
    title: 'Model request 2',
    summary: 'Agent hypothesises a missing signature check on the retry path.',
    fields: [{ key: 'request', value: 'req-002' }],
    evidence: [
      rep('Request record', 'Recorded via the harness transport.', SRC.eventLog),
      obs('Usage row', 'Ledger row present for this request.', SRC.usageLedger),
    ],
    usage: { present: true, promptTokens: 13911, completionTokens: 622, cacheReadTokens: 10876 },
  }),
  mkEvent('d-05', {
    seq: 5, offsetMs: 9100, category: 'tool', producer: 'agent', kind: 'tool.call', tool: 'fs.write',
    title: 'Tool call: fs.write',
    summary: 'Patch adds an HMAC check to the retry path (2 hunks).',
    fields: [
      { key: 'tool', value: 'fs.write' },
      { key: 'path', value: 'src/webhooks/payment.ts' },
      { key: 'exit', value: 'ok' },
    ],
    evidence: [obs('Call record', 'Write event recorded.', SRC.eventLog)],
  }),
  mkEvent('d-06', {
    seq: 6, offsetMs: 11500, category: 'model', producer: 'agent', kind: 'model.request',
    title: 'Model request 3',
    summary: 'Agent requests a test run.',
    fields: [{ key: 'request', value: 'req-003' }],
    evidence: [
      rep('Request record', 'Recorded via the harness transport.', SRC.eventLog),
      na('Usage row', 'Ledger degraded; row not written.'),
    ],
    usage: { present: false, reason: 'Usage ledger degraded at this interval; no row written.' },
  }),
  mkEvent('d-07', {
    seq: 7, offsetMs: 13000, category: 'tool', producer: 'agent', kind: 'tool.call', tool: 'shell.exec',
    status: 'error',
    title: 'Tool call: shell.exec — failed',
    summary: 'Ran the test suite: 39 passed, 2 failed, 0 skipped. Exit code 1.',
    fields: [
      { key: 'tool', value: 'shell.exec' },
      { key: 'cmd', value: 'npm test' },
      { key: 'exit', value: '1' },
    ],
    evidence: [
      obs('Call record', 'Command invocation recorded.', SRC.eventLog),
      obs('Result record', 'Exit code 1; output captured (2,881 bytes).', SRC.eventLog),
    ],
  }),
  mkEvent('d-08', {
    seq: 8, offsetMs: 16400, category: 'model', producer: 'agent', kind: 'model.request',
    status: 'partial',
    title: 'Model request 4 — partially recorded',
    summary: 'Agent requested a larger context to diagnose the failure. The journal wrote a truncation marker at this offset: request headers only; the response body was not recovered.',
    fields: [
      { key: 'request', value: 'req-004' },
      { key: 'journal', value: 'truncation marker at this record' },
    ],
    evidence: [
      rep('Request record', 'Partial: request headers only; body not captured.', SRC.eventLog),
      na('Response payload', 'Journal truncation marker at this offset; body not recovered.'),
      na('Usage row', 'Ledger degraded; row not written.'),
    ],
    usage: { present: false, reason: 'No usage row written for this request.' },
  }),
  mkEvent('d-09', {
    seq: 9, offsetMs: 19900, category: 'tool', producer: 'agent', kind: 'tool.call', tool: 'fs.read',
    title: 'Tool call: fs.read',
    summary: 'Read src/webhooks/retry.ts (74 lines).',
    fields: [
      { key: 'tool', value: 'fs.read' },
      { key: 'path', value: 'src/webhooks/retry.ts' },
      { key: 'exit', value: 'ok' },
    ],
    evidence: [
      obs('Call record', 'Tool call event recorded.', SRC.eventLog),
      obs('Result record', 'Tool result recorded.', SRC.eventLog),
    ],
  }),
  mkEvent('d-10', {
    seq: 10, offsetMs: 23700, category: 'model', producer: 'agent', kind: 'model.request',
    title: 'Model request 5 — final recorded request',
    summary: 'Agent proposes a second patch. Recording ends here without a completion event.',
    fields: [{ key: 'request', value: 'req-005' }],
    evidence: [
      rep('Request record', 'Recorded via the harness transport.', SRC.eventLog),
      na('Usage row', 'Ledger degraded; row not written.'),
      na('Completion record', 'No completion event in the journal; the session end is not recorded.'),
    ],
    usage: { present: false, reason: 'No usage row written for this request.' },
  }),
  mkEvent('d-11', {
    seq: 11, offsetMs: 23700, category: 'lifecycle', producer: 'observer', kind: 'journal.end',
    status: 'partial',
    title: 'Recording ended — no completion event',
    summary: 'The journal ends without a recorded completion or failure. The final agent state is unknown.',
    fields: [
      { key: 'outcome', value: 'not recorded' },
      { key: 'journal', value: 'ends mid-session' },
    ],
    evidence: [
      obs('Journal end', 'Last record at offset 23,700 ms.', SRC.eventLog),
      na('Completion', 'No lifecycle end event was written.'),
    ],
  }),
];

const dUsageRows = dEvents.filter((e) => e.usage?.present).length;

export const scenarioD: Session = {
  id: 'run-8d41aa',
  label: 'Webhook retry fix — evidence gaps',
  scenario: 'Scenario D — evidence degradation',
  taskId: 'Add signature verification to the payment webhook retry path',
  state: 'incomplete-evidence',
  outcome: 'Recording interrupted; usage ledger degraded; journal truncated; final state unknown.',
  startedAt: '2026-10-19 09:14:02 UTC',
  durationMs: 23700,
  runtime: {
    ...runtimeStandard,
    config: runtimeStandard.config.map((c) =>
      c.key === 'usage_ledger' ? { key: c.key, value: 'enabled (degraded)', degraded: true } : c,
    ),
  },
  capabilities: capabilitiesStandard.map((c) =>
    c.id === 'cap.model.request'
      ? {
          ...c,
          status: 'partially-admitted' as const,
          observed: '5 model requests recorded; usage rows missing for 3. Token totals unverifiable for those requests.',
          restrictions: [...c.restrictions, 'Usage accounting incomplete'],
          evidence: [
            ...c.evidence,
            na('Usage rows (req-001, req-003, req-004, req-005)', 'Ledger degraded; rows not written.'),
          ],
        }
      : c,
  ),
  sources: sourcesComplete.map((s) => {
    if (s.id === SRC.eventLog) return { ...s, records: dEvents.length };
    if (s.id === SRC.usageLedger)
      return {
        ...s,
        condition: 'degraded' as const,
        note: 'Ledger partially written: usage rows present for 1 of 5 model requests.',
        records: dUsageRows,
      };
    return s;
  }),
  events: dEvents,
  interventions: [],
};
