import type {
  Capability,
  EventCategory,
  EvidenceItem,
  Session,
  Source,
  TrajectoryEvent,
} from './types';

export const categoryColor: Record<
  EventCategory,
  { dot: string; text: string; bg: string; border: string; label: string }
> = {
  lifecycle: {
    dot: 'bg-ink-300',
    text: 'text-ink-200',
    bg: 'bg-ink-700/40',
    border: 'border-ink-500/40',
    label: 'LIFECYCLE',
  },
  model: {
    dot: 'bg-blue-accent',
    text: 'text-blue-accent',
    bg: 'bg-blue-accent/8',
    border: 'border-blue-accent/25',
    label: 'MODEL',
  },
  tool: {
    dot: 'bg-teal-accent',
    text: 'text-teal-accent',
    bg: 'bg-teal-accent/8',
    border: 'border-teal-accent/25',
    label: 'TOOL',
  },
  context: {
    dot: 'bg-amber-accent',
    text: 'text-amber-accent',
    bg: 'bg-amber-accent/8',
    border: 'border-amber-accent/25',
    label: 'CONTEXT',
  },
  verification: {
    dot: 'bg-ink-200',
    text: 'text-ink-100',
    bg: 'bg-ink-200/5',
    border: 'border-ink-400/30',
    label: 'VERIFY',
  },
  intervention: {
    dot: 'bg-red-accent',
    text: 'text-red-accent',
    bg: 'bg-red-accent/8',
    border: 'border-red-accent/25',
    label: 'INTERVEN',
  },
};

const src = {
  eventLog: 'src:event-log',
  runtimeRegistry: 'src:runtime-registry',
  harnessRegistry: 'src:harness-registry',
  capabilityRegistry: 'src:capability-registry',
  usageLedger: 'src:usage-ledger',
} as const;

const obs = (label: string, detail: string, sourceId: string): EvidenceItem => ({
  kind: 'OBS',
  label,
  detail,
  sourceId,
});
const rep = (label: string, detail: string, sourceId: string): EvidenceItem => ({
  kind: 'REP',
  label,
  detail,
  sourceId,
});
const der = (label: string, detail: string, process: string, sourceId?: string): EvidenceItem => ({
  kind: 'DER',
  label,
  detail,
  process,
  sourceId,
});
const na = (label: string, reason: string): EvidenceItem => ({ kind: 'NA', label, detail: reason, reason });

const sourcesReadable: Source[] = [
  {
    id: src.eventLog,
    name: 'Event log',
    kind: 'append-only journal',
    condition: 'readable',
    note: 'Complete journal, 60 records replayed in storage order.',
    records: 60,
  },
  {
    id: src.runtimeRegistry,
    name: 'Runtime registry',
    kind: 'identity record',
    condition: 'readable',
    note: 'Runtime identity and fingerprint present and consistent.',
    records: 1,
  },
  {
    id: src.harnessRegistry,
    name: 'Harness registry',
    kind: 'attachment record',
    condition: 'readable',
    note: 'Harness declared at attachment; matches event log entries.',
    records: 1,
  },
  {
    id: src.capabilityRegistry,
    name: 'Capability registry',
    kind: 'admission record',
    condition: 'readable',
    note: '10 capability records admitted or annotated.',
    records: 10,
  },
  {
    id: src.usageLedger,
    name: 'Usage ledger',
    kind: 'token accounting',
    condition: 'readable',
    note: 'Per-request usage rows present for all model events.',
    records: 14,
  },
];

const capEvidenceAdmitted = (name: string): EvidenceItem[] => [
  rep('Declared', `Runtime declared capability "${name}" at attachment.`, src.capabilityRegistry),
  obs('Exercised', 'Capability exercised during session with recorded result.', src.eventLog),
];

const capabilitiesHealthy: Capability[] = [
  {
    id: 'cap.fs.read',
    name: 'fs.read',
    status: 'admitted',
    declared: 'Read files within the workspace root.',
    observed: '17 read operations recorded, all within workspace bounds.',
    restrictions: ['Confined to workspace root'],
    evidence: capEvidenceAdmitted('fs.read'),
  },
  {
    id: 'cap.fs.write',
    name: 'fs.write',
    status: 'admitted',
    declared: 'Create and modify files within the workspace root.',
    observed: '6 write operations recorded; all paths inside workspace.',
    restrictions: ['Confined to workspace root'],
    evidence: capEvidenceAdmitted('fs.write'),
  },
  {
    id: 'cap.shell.exec',
    name: 'shell.exec',
    status: 'admitted',
    declared: 'Execute shell commands with sandboxed environment.',
    observed: '9 commands recorded; 1 returned non-zero exit (recorded).',
    restrictions: ['Sandboxed environment', 'Network egress denied'],
    evidence: capEvidenceAdmitted('shell.exec'),
  },
  {
    id: 'cap.search',
    name: 'search.grep',
    status: 'admitted',
    declared: 'Search file contents with regular expressions.',
    observed: '5 search operations recorded.',
    restrictions: [],
    evidence: capEvidenceAdmitted('search.grep'),
  },
  {
    id: 'cap.model.request',
    name: 'model.request',
    status: 'admitted',
    declared: 'Issue model requests via configured provider.',
    observed: '14 model requests recorded with usage rows.',
    restrictions: ['Rate-limited by harness policy'],
    evidence: capEvidenceAdmitted('model.request'),
  },
  {
    id: 'cap.context.window',
    name: 'context.window',
    status: 'partially-admitted',
    declared: 'Context window of 200,000 tokens.',
    observed: 'Window size reported by harness (REP). Compaction events observed; exact token counts for 2 of 14 requests not recorded.',
    restrictions: ['Token accounting incomplete for 2 requests'],
    evidence: [
      rep('Declared', 'Harness reports 200k-token context window.', src.harnessRegistry),
      obs('Compaction', '2 context compaction events recorded.', src.eventLog),
      na('Per-request token counts', '2 requests lack usage rows in the ledger.'),
    ],
  },
  {
    id: 'cap.subagents',
    name: 'subagents.spawn',
    status: 'unavailable',
    declared: 'Spawn subordinate agent sessions.',
    observed: 'Not exercised. Runtime declares the capability but the harness admitted no grant for it.',
    restrictions: ['No grant admitted by harness'],
    evidence: [
      rep('Declared', 'Runtime lists subagents.spawn as supported.', src.runtimeRegistry),
      na('Exercise record', 'No grant in capability registry; never exercised.'),
    ],
  },
  {
    id: 'cap.network.fetch',
    name: 'network.fetch',
    status: 'mismatched',
    declared: 'Fetch HTTP resources from an allowlist.',
    observed: 'Runtime declared an allowlist of 12 hosts; harness policy records 0 hosts. Mismatch recorded at attachment.',
    restrictions: ['Effective allowlist empty per harness policy'],
    evidence: [
      rep('Declared', 'Runtime allowlist: 12 hosts.', src.runtimeRegistry),
      rep('Policy', 'Harness network policy: 0 hosts.', src.harnessRegistry),
      obs('Mismatch record', 'Attachment event records capability mismatch.', src.eventLog),
    ],
  },
  {
    id: 'cap.artifacts.export',
    name: 'artifacts.export',
    status: 'unverified',
    declared: 'Export run artifacts to a recording store.',
    observed: 'Declared but never exercised in this session. Admitted with no observation.',
    restrictions: [],
    evidence: [
      rep('Declared', 'Capability present in runtime manifest.', src.capabilityRegistry),
      na('Exercise record', 'No invocation recorded in the event log.'),
    ],
  },
  {
    id: 'cap.persistence',
    name: 'session.persistence',
    status: 'unavailable',
    declared: 'Persist session state across restarts.',
    observed: 'Unavailable: harness did not mount a persistence volume for this run.',
    restrictions: ['No persistence volume mounted'],
    evidence: [
      rep('Policy', 'Harness volume configuration: none.', src.harnessRegistry),
      na('Exercise record', 'Capability unavailable for the whole session.'),
    ],
  },
];

function ev(
  id: string,
  seq: number,
  at: string,
  offsetMs: number,
  category: EventCategory,
  producer: string,
  status: TrajectoryEvent['status'],
  title: string,
  summary: string,
  fields: TrajectoryEvent['fields'],
  evidence: EvidenceItem[],
  structured?: TrajectoryEvent['structured'],
  usage?: TrajectoryEvent['usage'],
): TrajectoryEvent {
  return { id, seq, at, offsetMs, category, producer, status, title, summary, fields, evidence, structured, usage };
}

const baseTime = '2026-10-19T09:14:02';

function t(offsetSec: number): string {
  const d = new Date(baseTime + 'Z');
  d.setSeconds(d.getSeconds() + offsetSec);
  return d.toISOString().replace('Z', '+00:00');
}

const healthyEvents: TrajectoryEvent[] = [
  ev('e-01', 1, t(0), 0, 'lifecycle', 'harness', 'ok', 'Session attached', 'Harness attached to runtime and began recording. Runtime identity recorded with fingerprint.',
    [
      { key: 'session_id', value: 'run-3f92c1', mono: true },
      { key: 'workspace', value: '/workspace/billing-service', mono: true },
      { key: 'recording', value: 'enabled', mono: true },
    ],
    [
      obs('Attachment', 'Attachment event recorded by harness.', src.eventLog),
      rep('Runtime identity', 'Identity as declared by the runtime at handshake.', src.runtimeRegistry),
      der('Fingerprint', 'a3f1-9c42-e8b7-2d60', 'SHA-256 over recorded runtime manifest, truncated to hex groups.', src.runtimeRegistry),
    ],
    {
      key: 'runtime_identity',
      value: {
        agent: 'meridian-coder',
        runtime: 'endophasia-runtime/0.4.2',
        harness: 'cli-harness/1.1.0',
        workspace: '/workspace/billing-service',
        manifest_sha256: 'a3f19c42e8b72d60c1f5e4a896b3d2f7',
      },
    }),
  ev('e-02', 2, t(0.4), 400, 'lifecycle', 'registry', 'ok', 'Capability registry read', 'Runtime manifest read. 10 capability records written: 5 admitted, 1 partially admitted, 2 unavailable, 1 mismatched, 1 unverified.',
    [
      { key: 'records', value: '10', mono: true },
      { key: 'mismatches', value: '1 (network.fetch)', mono: true },
    ],
    [
      obs('Registry read', 'Capability registry opened and read without error.', src.capabilityRegistry),
      rep('Manifest contents', 'Capabilities as listed by the runtime manifest.', src.capabilityRegistry),
    ]),
  ev('e-03', 3, t(2.1), 2100, 'context', 'harness', 'ok', 'Initial context assembled', 'System prompt, workspace inventory and task brief assembled. 11,482 tokens counted against a 200,000-token reported window.',
    [
      { key: 'tokens_est', value: '11,482', mono: true },
      { key: 'window_reported', value: '200,000', mono: true },
    ],
    [
      der('Token estimate', '11,482', 'Tokeniser count over assembled prompt parts; approximation, not provider accounting.', src.usageLedger),
      rep('Window size', '200,000 tokens as reported by harness.', src.harnessRegistry),
    ]),
  ev('e-04', 4, t(3.8), 3800, 'model', 'agent', 'ok', 'Model request 1', 'Task interpretation and plan. Agent proposes reading the invoice module before modifying it.',
    [
      { key: 'request', value: 'req-001', mono: true },
      { key: 'plan_items', value: '4', mono: true },
    ],
    [
      rep('Request record', 'Request/response pair as reported by the harness transport.', src.eventLog),
      obs('Usage row', 'Token accounting row written to ledger.', src.usageLedger),
    ],
    {
      key: 'plan_outline',
      value: [
        'read src/invoice/proration.ts',
        'read tests/proration.spec.ts',
        'apply rounding fix',
        'run test suite',
      ],
    },
    { promptTokens: 11482, completionTokens: 612, cacheReadTokens: 0 }),
  ev('e-05', 5, t(6.2), 6200, 'tool', 'agent', 'ok', 'Tool call: fs.read', 'Read src/invoice/proration.ts (212 lines).',
    [
      { key: 'tool', value: 'fs.read', mono: true },
      { key: 'path', value: 'src/invoice/proration.ts', mono: true },
      { key: 'exit', value: 'ok', mono: true },
    ],
    [
      obs('Call record', 'Tool call event with arguments hash recorded.', src.eventLog),
      obs('Result record', 'Tool result recorded; 212 lines returned.', src.eventLog),
    ],
    {
      key: 'call_record',
      value: {
        tool: 'fs.read',
        arguments: { path: 'src/invoice/proration.ts' },
        result: { bytes: 4813, lines: 212, truncated: false },
      },
    }),
  ev('e-06', 6, t(8.0), 8000, 'tool', 'agent', 'ok', 'Tool call: fs.read', 'Read tests/proration.spec.ts (96 lines).',
    [
      { key: 'tool', value: 'fs.read', mono: true },
      { key: 'path', value: 'tests/proration.spec.ts', mono: true },
      { key: 'exit', value: 'ok', mono: true },
    ],
    [obs('Call record', 'Tool call event recorded.', src.eventLog), obs('Result record', 'Tool result recorded.', src.eventLog)]),
  ev('e-07', 7, t(11.4), 11400, 'model', 'agent', 'ok', 'Model request 2', 'Agent identifies rounding error at month-boundary proration; drafts patch.',
    [{ key: 'request', value: 'req-002', mono: true }],
    [rep('Request record', 'Recorded via harness transport.', src.eventLog), obs('Usage row', 'Ledger row present.', src.usageLedger)],
    undefined,
    { promptTokens: 14207, completionTokens: 488, cacheReadTokens: 11032 }),
  ev('e-08', 8, t(13.1), 13100, 'tool', 'agent', 'ok', 'Tool call: fs.write', 'Patch applied to src/invoice/proration.ts (3 hunks).',
    [
      { key: 'tool', value: 'fs.write', mono: true },
      { key: 'path', value: 'src/invoice/proration.ts', mono: true },
      { key: 'exit', value: 'ok', mono: true },
    ],
    [obs('Call record', 'Write event recorded with diff digest.', src.eventLog)],
    {
      key: 'diff_summary',
      value: { hunks: 3, insertions: 9, deletions: 4, diff_sha256: '5d2a…f0b1' },
    }),
  ev('e-09', 9, t(15.9), 15900, 'tool', 'agent', 'ok', 'Tool call: shell.exec', 'Ran test suite: 41 passed, 0 failed, 2 skipped.',
    [
      { key: 'tool', value: 'shell.exec', mono: true },
      { key: 'cmd', value: 'npm test -- proration', mono: true },
      { key: 'exit', value: '0', mono: true },
    ],
    [obs('Call record', 'Command invocation recorded.', src.eventLog), obs('Result record', 'Exit code 0; output captured (1,204 bytes).', src.eventLog)]),
  ev('e-10', 10, t(17.2), 17200, 'verification', 'harness', 'ok', 'Post-write verification', 'Harness re-read patched file and compared against recorded diff digest. Match.',
    [
      { key: 'method', value: 'digest-compare', mono: true },
      { key: 'match', value: 'true', mono: true },
    ],
    [
      obs('Verification', 'Verification event recorded by harness.', src.eventLog),
      der('Digest match', 'diff_sha256 equal before/after', 'SHA-256 of written file compared with digest recorded at write time.', src.eventLog),
    ]),
  ev('e-11', 11, t(19.5), 19500, 'context', 'harness', 'ok', 'Context window status', '24,318 tokens in window. No compaction required.',
    [{ key: 'tokens_est', value: '24,318', mono: true }],
    [der('Token estimate', '24,318', 'Tokeniser count over current window contents.', src.usageLedger)]),
  ev('e-12', 12, t(22.0), 22000, 'model', 'agent', 'ok', 'Model request 3', 'Agent reviews test output and concludes the task; drafts completion summary.',
    [{ key: 'request', value: 'req-003', mono: true }],
    [rep('Request record', 'Recorded via harness transport.', src.eventLog), obs('Usage row', 'Ledger row present.', src.usageLedger)],
    undefined,
    { promptTokens: 24318, completionTokens: 356, cacheReadTokens: 13984 }),
  ev('e-13', 13, t(24.6), 24600, 'lifecycle', 'harness', 'ok', 'Session completed', 'Agent signalled completion. Harness finalised recording. Journal closed cleanly.',
    [
      { key: 'outcome', value: 'completed', mono: true },
      { key: 'journal', value: 'closed', mono: true },
    ],
    [obs('Completion', 'Lifecycle completion event recorded.', src.eventLog)],
    {
      key: 'final_state',
      value: { outcome: 'completed', files_changed: 1, tests_run: 43, wall_ms: 24600 },
    }),
];

const incompleteSources: Source[] = sourcesReadable.map((s) =>
  s.id === src.usageLedger
    ? { ...s, condition: 'degraded' as const, note: 'Ledger partially written: usage rows missing for 2 of 6 model events.', records: 4 }
    : s,
);

const capabilitiesIncomplete: Capability[] = capabilitiesHealthy.map((c) =>
  c.id === 'cap.model.request'
    ? {
        ...c,
        status: 'partially-admitted' as const,
        observed: '6 model requests recorded; usage rows missing for 2. Token totals unverifiable for those requests.',
        restrictions: [...c.restrictions, 'Usage accounting incomplete'],
        evidence: [
          ...c.evidence,
          na('Usage rows (req-004, req-005)', 'Ledger degraded; rows not written.'),
        ],
      }
    : c,
);

const incompleteEvents: TrajectoryEvent[] = [
  ev('i-01', 1, t(0), 0, 'lifecycle', 'harness', 'ok', 'Session attached', 'Harness attached to runtime and began recording.',
    [
      { key: 'session_id', value: 'run-8d41aa', mono: true },
      { key: 'workspace', value: '/workspace/billing-service', mono: true },
    ],
    [
      obs('Attachment', 'Attachment event recorded.', src.eventLog),
      rep('Runtime identity', 'Identity as declared at handshake.', src.runtimeRegistry),
      der('Fingerprint', 'a3f1-9c42-e8b7-2d60', 'SHA-256 over recorded runtime manifest, truncated.', src.runtimeRegistry),
    ]),
  ev('i-02', 2, t(1.9), 1900, 'model', 'agent', 'ok', 'Model request 1', 'Task interpretation. Agent plans to inspect failing payment webhook handler.',
    [{ key: 'request', value: 'req-001', mono: true }],
    [rep('Request record', 'Recorded via harness transport.', src.eventLog), na('Usage row', 'Ledger degraded for this interval; row not written.')],
    undefined,
    { promptTokens: 10940, completionTokens: 540 }),
  ev('i-03', 3, t(4.0), 4000, 'tool', 'agent', 'ok', 'Tool call: fs.read', 'Read src/webhooks/payment.ts (188 lines).',
    [
      { key: 'tool', value: 'fs.read', mono: true },
      { key: 'path', value: 'src/webhooks/payment.ts', mono: true },
    ],
    [obs('Call record', 'Tool call event recorded.', src.eventLog), obs('Result record', 'Tool result recorded.', src.eventLog)]),
  ev('i-04', 4, t(6.8), 6800, 'model', 'agent', 'ok', 'Model request 2', 'Agent hypothesises missing signature verification on retry path.',
    [{ key: 'request', value: 'req-002', mono: true }],
    [rep('Request record', 'Recorded via harness transport.', src.eventLog), obs('Usage row', 'Ledger row present.', src.usageLedger)],
    undefined,
    { promptTokens: 13911, completionTokens: 622, cacheReadTokens: 10876 }),
  ev('i-05', 5, t(9.1), 9100, 'tool', 'agent', 'ok', 'Tool call: fs.write', 'Patch adds HMAC check to retry path (2 hunks).',
    [
      { key: 'tool', value: 'fs.write', mono: true },
      { key: 'path', value: 'src/webhooks/payment.ts', mono: true },
    ],
    [obs('Call record', 'Write event recorded.', src.eventLog)]),
  ev('i-06', 6, t(11.5), 11500, 'model', 'agent', 'ok', 'Model request 3', 'Agent requests test run.',
    [{ key: 'request', value: 'req-003', mono: true }],
    [rep('Request record', 'Recorded via harness transport.', src.eventLog), na('Usage row', 'Ledger degraded; row not written.')],
    undefined,
    { promptTokens: 17102, completionTokens: 198 }),
  ev('i-07', 7, t(13.0), 13000, 'tool', 'agent', 'ok', 'Tool call: shell.exec', 'Ran test suite: 39 passed, 2 failed, 0 skipped.',
    [
      { key: 'tool', value: 'shell.exec', mono: true },
      { key: 'cmd', value: 'npm test', mono: true },
      { key: 'exit', value: '1', mono: true },
    ],
    [obs('Call record', 'Command invocation recorded.', src.eventLog), obs('Result record', 'Exit code 1; output captured (2,881 bytes).', src.eventLog)]),
  ev('i-08', 8, t(16.4), 16400, 'model', 'agent', 'partial', 'Model request 4', 'Agent requests larger context to diagnose failure. Response partially recorded: harness journal wrote a truncation marker at this point.',
    [
      { key: 'request', value: 'req-004', mono: true },
      { key: 'journal', value: 'truncated (rep-4 marker)', mono: true },
    ],
    [
      rep('Request record', 'Partial: request headers only; body not captured.', src.eventLog),
      na('Response payload', 'Journal truncation marker at this offset; body not recovered.'),
      na('Usage row', 'Ledger degraded; row not written.'),
    ]),
  ev('i-09', 9, t(19.9), 19900, 'tool', 'agent', 'ok', 'Tool call: fs.read', 'Read src/webhooks/retry.ts (74 lines).',
    [
      { key: 'tool', value: 'fs.read', mono: true },
      { key: 'path', value: 'src/webhooks/retry.ts', mono: true },
    ],
    [obs('Call record', 'Tool call event recorded.', src.eventLog), obs('Result record', 'Tool result recorded.', src.eventLog)]),
  ev('i-10', 10, t(23.7), 23700, 'model', 'agent', 'ok', 'Model request 5', 'Agent proposes second patch; session recording ends here without a completion event.',
    [{ key: 'request', value: 'req-005', mono: true }],
    [
      rep('Request record', 'Recorded via harness transport.', src.eventLog),
      na('Usage row', 'Ledger degraded; row not written.'),
      na('Completion record', 'No completion event in journal; session end is not recorded.'),
    ]),
  ev('i-11', 11, t(23.7), 23700, 'lifecycle', 'observer', 'partial', 'Recording ended (no completion event)', 'Journal ends without a recorded completion or failure. Final agent state unknown.',
    [
      { key: 'outcome', value: 'not recorded', mono: true },
      { key: 'journal', value: 'ends mid-session', mono: true },
    ],
    [
      obs('Journal end', 'Last record at offset 23,700 ms.', src.eventLog),
      na('Completion', 'No lifecycle end event was written.'),
    ]),
];

const incompleteSession: Session = {
  id: 'run-8d41aa',
  label: 'Webhook retry fix — evidence gaps',
  taskId: 'Add signature verification to payment webhook retry path',
  state: 'incomplete-evidence',
  startedAt: baseTime.replace('T', ' ') + ' UTC',
  durationMs: 23700,
  runtime: {
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
      { key: 'usage_ledger', value: 'enabled (degraded)' },
    ],
  },
  capabilities: capabilitiesIncomplete,
  sources: incompleteSources,
  events: incompleteEvents,
};

export const healthySession: Session = {
  id: 'run-3f92c1',
  label: 'Invoice proration rounding fix',
  taskId: 'Fix rounding error in monthly proration calculation',
  state: 'completed',
  startedAt: baseTime.replace('T', ' ') + ' UTC',
  durationMs: 24600,
  runtime: {
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
    ],
  },
  capabilities: capabilitiesHealthy,
  sources: sourcesReadable,
  events: healthyEvents,
};

export const divergentSession: Session = {
  id: 'run-6c07e4',
  label: 'Invoice proration — divergent outcome',
  taskId: 'Fix rounding error in monthly proration calculation',
  state: 'failed',
  startedAt: baseTime.replace('T', ' ') + ' UTC',
  durationMs: 31500,
  runtime: healthySession.runtime,
  capabilities: capabilitiesHealthy,
  sources: sourcesReadable,
  events: [
    ...healthyEvents.slice(0, 8),
    ev('d-09', 9, t(15.9), 15900, 'tool', 'agent', 'error', 'Tool call: shell.exec — failed', 'Ran test suite: 39 passed, 2 failed, 0 skipped. Exit code 1.',
      [
        { key: 'tool', value: 'shell.exec', mono: true },
        { key: 'cmd', value: 'npm test -- proration', mono: true },
        { key: 'exit', value: '1', mono: true },
      ],
      [obs('Call record', 'Command invocation recorded.', src.eventLog), obs('Result record', 'Exit code 1; failure output captured (2,204 bytes).', src.eventLog)],
      {
        key: 'failing_tests',
        value: [
          { name: 'proration.spec.ts > rounds half up at boundary', status: 'failed' },
          { name: 'proration.spec.ts > negative amounts clamp', status: 'failed' },
        ],
      }),
    ev('d-10', 10, t(19.8), 19800, 'intervention', 'operator', 'ok', 'Operator intervention: retry policy', 'Explicitly authorised operator intervention recorded: retry policy switched from "once" to "loop until pass" for remaining session.',
      [
        { key: 'authorisation', value: 'granted (operator token o-77)', mono: true },
        { key: 'scope', value: 'this session only', mono: true },
      ],
      [
        obs('Intervention record', 'Intervention event with authorisation reference recorded.', src.eventLog),
        rep('Authorisation', 'Operator token o-77 as presented to the harness.', src.harnessRegistry),
      ]),
    ev('d-11', 11, t(22.4), 22400, 'model', 'agent', 'ok', 'Model request 4', 'Agent revises patch under loop-until-pass policy; second attempt.',
      [{ key: 'request', value: 'req-004', mono: true }],
      [rep('Request record', 'Recorded via harness transport.', src.eventLog), obs('Usage row', 'Ledger row present.', src.usageLedger)],
      undefined,
      { promptTokens: 27564, completionTokens: 741, cacheReadTokens: 15230 }),
    ev('d-12', 12, t(25.9), 25900, 'tool', 'agent', 'ok', 'Tool call: fs.write', 'Second patch attempt applied (2 hunks).',
      [
        { key: 'tool', value: 'fs.write', mono: true },
        { key: 'path', value: 'src/invoice/proration.ts', mono: true },
      ],
      [obs('Call record', 'Write event recorded.', src.eventLog)]),
    ev('d-13', 13, t(28.3), 28300, 'tool', 'agent', 'error', 'Tool call: shell.exec — failed', 'Test suite still failing: 38 passed, 3 failed. Divergence from reference outcome widening.',
      [
        { key: 'tool', value: 'shell.exec', mono: true },
        { key: 'exit', value: '1', mono: true },
      ],
      [obs('Call record', 'Command invocation recorded.', src.eventLog), obs('Result record', 'Exit code 1.', src.eventLog)]),
    ev('d-14', 14, t(31.5), 31500, 'lifecycle', 'harness', 'error', 'Session terminated — divergent outcome', 'Harness budget exhausted under retry policy. Session terminated with recorded divergent outcome; reference run completed at this point in its own timeline.',
      [
        { key: 'outcome', value: 'divergent/terminated', mono: true },
        { key: 'journal', value: 'closed', mono: true },
      ],
      [obs('Termination', 'Lifecycle termination event recorded.', src.eventLog)],
      {
        key: 'final_state',
        value: { outcome: 'divergent', retries: 1, files_changed: 1, tests_run: 46, wall_ms: 31500 },
      }),
  ],
  divergence: {
    fromSessionId: healthySession.id,
    atEventSeq: 9,
    note: 'Runs are identical through event 8 (second fs.write). Reference run passed the test suite at event 9; this run failed it. Everything after that point is divergence.',
  },
};

export const sessions: Session[] = [healthySession, divergentSession, incompleteSession];

export const sessionById = (id: string): Session => sessions.find((s) => s.id === id) ?? sessions[0];

export const evidenceKindMeta: Record<
  EvidenceItem['kind'],
  { label: string; full: string; cls: string; desc: string }
> = {
  OBS: {
    label: 'OBS',
    full: 'Observed',
    cls: 'text-teal-accent border-teal-accent/40 bg-teal-accent/10',
    desc: 'Recorded directly by the observation layer.',
  },
  REP: {
    label: 'REP',
    full: 'Reported',
    cls: 'text-blue-accent border-blue-accent/40 bg-blue-accent/10',
    desc: 'Stated by a source; not independently confirmed.',
  },
  DER: {
    label: 'DER',
    full: 'Derived',
    cls: 'text-amber-accent border-amber-accent/40 bg-amber-accent/10',
    desc: 'Computed through a declared derivation process.',
  },
  NA: {
    label: 'N/A',
    full: 'Unavailable',
    cls: 'text-ink-400 border-ink-500/40 bg-ink-700/40',
    desc: 'Not recorded or not available, with a stated reason.',
  },
};
