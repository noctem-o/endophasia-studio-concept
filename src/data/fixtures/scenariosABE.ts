import { mkEvent, obs, rep, der, na, SRC, runtimeStandard, sourcesComplete, capabilitiesStandard } from './shared';
import type { Capability, Session, Source, TrajectoryEvent } from '../../domain/types';

// ─── Scenario A: successful deterministic run ────────────────────────────────

const events: TrajectoryEvent[] = [
  mkEvent('a-01', {
    seq: 1, offsetMs: 0, category: 'lifecycle', producer: 'harness', kind: 'session.attach',
    title: 'Session attached',
    summary: 'Harness attached to runtime and began recording. Runtime identity and fingerprint recorded.',
    fields: [
      { key: 'session_id', value: 'run-3f92c1' },
      { key: 'workspace', value: '/workspace/billing-service' },
      { key: 'recording', value: 'enabled' },
    ],
    evidence: [
      obs('Attachment', 'Attachment event recorded by harness.', SRC.eventLog),
      rep('Runtime identity', 'Identity as declared by the runtime at handshake.', SRC.runtimeRegistry),
      der('Fingerprint', 'a3f1-9c42-e8b7-2d60', 'SHA-256 over the recorded runtime manifest, truncated to hex groups.', SRC.runtimeRegistry),
    ],
    structured: {
      key: 'runtime_identity',
      value: {
        agent: 'meridian-coder',
        runtime: 'endophasia-runtime/0.4.2',
        harness: 'cli-harness/1.1.0',
        workspace: '/workspace/billing-service',
        manifest_sha256: 'a3f19c42e8b72d60c1f5e4a896b3d2f7',
      },
    },
  }),
  mkEvent('a-02', {
    seq: 2, offsetMs: 400, category: 'lifecycle', producer: 'registry', kind: 'capability.registry_read',
    title: 'Capability registry read',
    summary: 'Runtime manifest read. 10 capability records written: 5 admitted, 1 partially admitted, 2 unavailable, 1 mismatched, 1 unverified.',
    fields: [
      { key: 'records', value: '10' },
      { key: 'mismatches', value: '1 (network.fetch)' },
    ],
    evidence: [
      obs('Registry read', 'Capability registry opened and read without error.', SRC.capabilityRegistry),
      rep('Manifest contents', 'Capabilities as listed by the runtime manifest.', SRC.capabilityRegistry),
    ],
  }),
  mkEvent('a-03', {
    seq: 3, offsetMs: 2100, category: 'context', producer: 'harness', kind: 'context.assemble',
    title: 'Initial context assembled',
    summary: 'System prompt, workspace inventory and task brief assembled.',
    fields: [
      { key: 'tokens_est', value: '11,482' },
      { key: 'window_reported', value: '200,000' },
    ],
    evidence: [
      der('Token estimate', '11,482', 'Tokeniser count over assembled prompt parts; approximation, not provider accounting.', SRC.usageLedger),
      rep('Window size', '200,000 tokens as reported by the harness.', SRC.harnessRegistry),
    ],
  }),
  mkEvent('a-04', {
    seq: 4, offsetMs: 3800, category: 'model', producer: 'agent', kind: 'model.request',
    title: 'Model request 1 — plan',
    summary: 'Agent interprets the task and proposes reading the invoice module before modifying it.',
    fields: [{ key: 'request', value: 'req-001' }],
    evidence: [
      rep('Request record', 'Request/response pair as reported by the harness transport.', SRC.eventLog),
      obs('Usage row', 'Token accounting row written to the ledger.', SRC.usageLedger),
    ],
    structured: {
      key: 'plan_outline',
      value: ['read src/invoice/proration.ts', 'read tests/proration.spec.ts', 'apply rounding fix', 'run test suite'],
    },
    usage: { present: true, promptTokens: 11482, completionTokens: 612, cacheReadTokens: 0 },
  }),
  mkEvent('a-05', {
    seq: 5, offsetMs: 6200, category: 'tool', producer: 'agent', kind: 'tool.call', tool: 'fs.read',
    title: 'Tool call: fs.read',
    summary: 'Read src/invoice/proration.ts (212 lines).',
    fields: [
      { key: 'tool', value: 'fs.read' },
      { key: 'path', value: 'src/invoice/proration.ts' },
      { key: 'exit', value: 'ok' },
    ],
    evidence: [
      obs('Call record', 'Tool call event with arguments hash recorded.', SRC.eventLog),
      obs('Result record', 'Tool result recorded; 212 lines returned.', SRC.eventLog),
    ],
    structured: {
      key: 'call_record',
      value: {
        tool: 'fs.read',
        arguments: { path: 'src/invoice/proration.ts' },
        result: { bytes: 4813, lines: 212, truncated: false },
      },
    },
  }),
  mkEvent('a-06', {
    seq: 6, offsetMs: 8000, category: 'tool', producer: 'agent', kind: 'tool.call', tool: 'fs.read',
    title: 'Tool call: fs.read',
    summary: 'Read tests/proration.spec.ts (96 lines).',
    fields: [
      { key: 'tool', value: 'fs.read' },
      { key: 'path', value: 'tests/proration.spec.ts' },
      { key: 'exit', value: 'ok' },
    ],
    evidence: [
      obs('Call record', 'Tool call event recorded.', SRC.eventLog),
      obs('Result record', 'Tool result recorded.', SRC.eventLog),
    ],
  }),
  mkEvent('a-07', {
    seq: 7, offsetMs: 11400, category: 'model', producer: 'agent', kind: 'model.request',
    title: 'Model request 2 — diagnosis',
    summary: 'Agent identifies the rounding error at the month-boundary proration case and drafts a patch.',
    fields: [{ key: 'request', value: 'req-002' }],
    evidence: [
      rep('Request record', 'Recorded via the harness transport.', SRC.eventLog),
      obs('Usage row', 'Ledger row present.', SRC.usageLedger),
    ],
    usage: { present: true, promptTokens: 14207, completionTokens: 488, cacheReadTokens: 11032 },
  }),
  mkEvent('a-08', {
    seq: 8, offsetMs: 13100, category: 'tool', producer: 'agent', kind: 'tool.call', tool: 'fs.write',
    title: 'Tool call: fs.write',
    summary: 'Patch applied to src/invoice/proration.ts (3 hunks).',
    fields: [
      { key: 'tool', value: 'fs.write' },
      { key: 'path', value: 'src/invoice/proration.ts' },
      { key: 'exit', value: 'ok' },
    ],
    evidence: [obs('Call record', 'Write event recorded with a diff digest.', SRC.eventLog)],
    structured: {
      key: 'diff_summary',
      value: { hunks: 3, insertions: 9, deletions: 4, diff_sha256: '5d2a…f0b1' },
    },
  }),
  mkEvent('a-09', {
    seq: 9, offsetMs: 15900, category: 'tool', producer: 'agent', kind: 'tool.call', tool: 'shell.exec',
    title: 'Tool call: shell.exec — tests pass',
    summary: 'Ran the test suite: 41 passed, 0 failed, 2 skipped. Exit code 0.',
    fields: [
      { key: 'tool', value: 'shell.exec' },
      { key: 'cmd', value: 'npm test -- proration' },
      { key: 'exit', value: '0' },
    ],
    evidence: [
      obs('Call record', 'Command invocation recorded.', SRC.eventLog),
      obs('Result record', 'Exit code 0; output captured (1,204 bytes).', SRC.eventLog),
    ],
  }),
  mkEvent('a-10', {
    seq: 10, offsetMs: 17200, category: 'verification', producer: 'harness', kind: 'verify.digest',
    title: 'Post-write verification',
    summary: 'Harness re-read the patched file and compared it against the diff digest recorded at write time. Match.',
    fields: [
      { key: 'method', value: 'digest-compare' },
      { key: 'match', value: 'true' },
    ],
    evidence: [
      obs('Verification', 'Verification event recorded by the harness.', SRC.eventLog),
      der('Digest match', 'diff_sha256 equal before/after', 'SHA-256 of the written file compared with the digest recorded at write time.', SRC.eventLog),
    ],
  }),
  mkEvent('a-11', {
    seq: 11, offsetMs: 19500, category: 'context', producer: 'harness', kind: 'context.status',
    title: 'Context window status',
    summary: '24,318 tokens in window. No compaction required.',
    fields: [{ key: 'tokens_est', value: '24,318' }],
    evidence: [
      der('Token estimate', '24,318', 'Tokeniser count over current window contents.', SRC.usageLedger),
    ],
  }),
  mkEvent('a-12', {
    seq: 12, offsetMs: 22000, category: 'model', producer: 'agent', kind: 'model.request',
    title: 'Model request 3 — conclusion',
    summary: 'Agent reviews test output and concludes the task; drafts a completion summary.',
    fields: [{ key: 'request', value: 'req-003' }],
    evidence: [
      rep('Request record', 'Recorded via the harness transport.', SRC.eventLog),
      obs('Usage row', 'Ledger row present.', SRC.usageLedger),
    ],
    usage: { present: true, promptTokens: 24318, completionTokens: 356, cacheReadTokens: 13984 },
  }),
  mkEvent('a-13', {
    seq: 13, offsetMs: 24600, category: 'lifecycle', producer: 'harness', kind: 'session.complete',
    title: 'Session completed',
    summary: 'Agent signalled completion. Harness finalised recording. Journal closed cleanly.',
    fields: [
      { key: 'outcome', value: 'completed' },
      { key: 'journal', value: 'closed' },
    ],
    evidence: [obs('Completion', 'Lifecycle completion event recorded.', SRC.eventLog)],
    structured: {
      key: 'final_state',
      value: { outcome: 'completed', files_changed: 1, tests_run: 43, wall_ms: 24600 },
    },
  }),
];

const usageRows = events.filter((e) => e.usage?.present).length;

const sources: Source[] = sourcesComplete.map((s) =>
  s.id === SRC.eventLog
    ? { ...s, records: events.length }
    : s.id === SRC.usageLedger
      ? { ...s, records: usageRows }
      : s,
);

export const scenarioA: Session = {
  id: 'run-3f92c1',
  label: 'Invoice proration rounding fix',
  scenario: 'Scenario A — successful deterministic run',
  taskId: 'Fix rounding error in monthly proration calculation',
  state: 'completed',
  outcome: 'Task completed; verification passed; evidence complete.',
  startedAt: '2026-10-19 09:14:02 UTC',
  durationMs: 24600,
  runtime: runtimeStandard,
  capabilities: capabilitiesStandard,
  sources,
  events,
  interventions: [],
};

// ─── Scenario B: tool failure and recovery ───────────────────────────────────

const bEvents: TrajectoryEvent[] = [
  mkEvent('b-01', {
    seq: 1, offsetMs: 0, category: 'lifecycle', producer: 'harness', kind: 'session.attach',
    title: 'Session attached',
    summary: 'Harness attached to the runtime in the same workspace. Recording began.',
    fields: [
      { key: 'session_id', value: 'run-2b7e90' },
      { key: 'workspace', value: '/workspace/billing-service' },
    ],
    evidence: [
      obs('Attachment', 'Attachment event recorded by harness.', SRC.eventLog),
      rep('Runtime identity', 'Identity as declared at handshake.', SRC.runtimeRegistry),
      der('Fingerprint', 'a3f1-9c42-e8b7-2d60', 'SHA-256 over the recorded runtime manifest, truncated.', SRC.runtimeRegistry),
    ],
  }),
  mkEvent('b-02', {
    seq: 2, offsetMs: 1900, category: 'context', producer: 'harness', kind: 'context.assemble',
    title: 'Initial context assembled',
    summary: 'Task brief: migrate the legacy CSV export endpoint to the new streaming writer.',
    fields: [{ key: 'tokens_est', value: '9,940' }],
    evidence: [
      der('Token estimate', '9,940', 'Tokeniser count over assembled prompt parts.', SRC.usageLedger),
    ],
  }),
  mkEvent('b-03', {
    seq: 3, offsetMs: 3400, category: 'model', producer: 'agent', kind: 'model.request',
    title: 'Model request 1 — plan',
    summary: 'Agent plans to read the existing export module, replace it, and run the export tests.',
    fields: [{ key: 'request', value: 'req-001' }],
    evidence: [
      rep('Request record', 'Recorded via the harness transport.', SRC.eventLog),
      obs('Usage row', 'Ledger row present.', SRC.usageLedger),
    ],
    usage: { present: true, promptTokens: 9940, completionTokens: 577, cacheReadTokens: 0 },
  }),
  mkEvent('b-04', {
    seq: 4, offsetMs: 5900, category: 'tool', producer: 'agent', kind: 'tool.call', tool: 'fs.read',
    title: 'Tool call: fs.read',
    summary: 'Read src/export/csv.ts (154 lines).',
    fields: [
      { key: 'tool', value: 'fs.read' },
      { key: 'path', value: 'src/export/csv.ts' },
      { key: 'exit', value: 'ok' },
    ],
    evidence: [
      obs('Call record', 'Tool call event recorded.', SRC.eventLog),
      obs('Result record', 'Tool result recorded.', SRC.eventLog),
    ],
  }),
  mkEvent('b-05', {
    seq: 5, offsetMs: 8200, category: 'tool', producer: 'agent', kind: 'tool.call', tool: 'fs.write',
    title: 'Tool call: fs.write',
    summary: 'Replaced the export implementation with the streaming writer (4 hunks).',
    fields: [
      { key: 'tool', value: 'fs.write' },
      { key: 'path', value: 'src/export/csv.ts' },
      { key: 'exit', value: 'ok' },
    ],
    evidence: [obs('Call record', 'Write event recorded with a diff digest.', SRC.eventLog)],
  }),
  mkEvent('b-06', {
    seq: 6, offsetMs: 11400, category: 'tool', producer: 'agent', kind: 'tool.call', tool: 'shell.exec',
    status: 'error',
    title: 'Tool call: shell.exec — failed',
    summary: 'Ran the export tests: 12 failed with a missing-module error. Exit code 1. The streaming writer import path was wrong.',
    fields: [
      { key: 'tool', value: 'shell.exec' },
      { key: 'cmd', value: 'npm test -- export' },
      { key: 'exit', value: '1' },
    ],
    evidence: [
      obs('Call record', 'Command invocation recorded.', SRC.eventLog),
      obs('Result record', 'Exit code 1; failure output captured (3,411 bytes).', SRC.eventLog),
    ],
    structured: {
      key: 'failure_excerpt',
      value: {
        error: 'Cannot find module ../streaming/writer',
        failing: 12,
        first_line: 'FAIL src/export/csv.spec.ts',
      },
    },
  }),
  mkEvent('b-07', {
    seq: 7, offsetMs: 13600, category: 'model', producer: 'agent', kind: 'model.request',
    title: 'Model request 2 — diagnose failure',
    summary: 'Agent reads the failure output and identifies the wrong import path in the new module.',
    fields: [{ key: 'request', value: 'req-002' }],
    refs: [{ target: 'b-06', relation: 'responds_to' }],
    evidence: [
      rep('Request record', 'Recorded via the harness transport.', SRC.eventLog),
      obs('Usage row', 'Ledger row present.', SRC.usageLedger),
    ],
    structured: {
      key: 'diagnosis',
      value: {
        hypothesis: 'import path ../streaming/writer does not exist; correct path is ../io/streaming/writer',
        basis: 'recorded failure output (seq 6)',
      },
    },
    usage: { present: true, promptTokens: 15210, completionTokens: 402, cacheReadTokens: 9880 },
  }),
  mkEvent('b-08', {
    seq: 8, offsetMs: 15400, category: 'tool', producer: 'agent', kind: 'tool.call', tool: 'fs.read',
    title: 'Tool call: fs.read',
    summary: 'Read src/io/streaming/writer.ts (88 lines) to confirm the module path before patching.',
    fields: [
      { key: 'tool', value: 'fs.read' },
      { key: 'path', value: 'src/io/streaming/writer.ts' },
      { key: 'exit', value: 'ok' },
    ],
    refs: [{ target: 'b-06', relation: 'follows_from' }],
    evidence: [
      obs('Call record', 'Tool call event recorded.', SRC.eventLog),
      obs('Result record', 'Tool result recorded.', SRC.eventLog),
    ],
  }),
  mkEvent('b-09', {
    seq: 9, offsetMs: 17200, category: 'tool', producer: 'agent', kind: 'tool.call', tool: 'fs.write',
    title: 'Tool call: fs.write — corrective patch',
    summary: 'Corrected the import path (1 hunk).',
    fields: [
      { key: 'tool', value: 'fs.write' },
      { key: 'path', value: 'src/export/csv.ts' },
      { key: 'exit', value: 'ok' },
    ],
    refs: [{ target: 'b-06', relation: 'recovery_for' }],
    evidence: [obs('Call record', 'Write event recorded with a diff digest.', SRC.eventLog)],
  }),
  mkEvent('b-10', {
    seq: 10, offsetMs: 19300, category: 'tool', producer: 'agent', kind: 'tool.call', tool: 'shell.exec',
    title: 'Tool call: shell.exec — tests pass',
    summary: 'Re-ran the export tests: 34 passed, 0 failed. Exit code 0.',
    fields: [
      { key: 'tool', value: 'shell.exec' },
      { key: 'cmd', value: 'npm test -- export' },
      { key: 'exit', value: '0' },
    ],
    refs: [{ target: 'b-06', relation: 'retries' }],
    evidence: [
      obs('Call record', 'Command invocation recorded.', SRC.eventLog),
      obs('Result record', 'Exit code 0; output captured (892 bytes).', SRC.eventLog),
    ],
  }),
  mkEvent('b-11', {
    seq: 11, offsetMs: 20400, category: 'verification', producer: 'harness', kind: 'verify.digest',
    title: 'Post-write verification',
    summary: 'Harness digest check over the corrected file. Match.',
    fields: [
      { key: 'method', value: 'digest-compare' },
      { key: 'match', value: 'true' },
    ],
    evidence: [
      obs('Verification', 'Verification event recorded.', SRC.eventLog),
      der('Digest match', 'diff_sha256 equal before/after', 'SHA-256 of the written file compared with the write-time digest.', SRC.eventLog),
    ],
  }),
  mkEvent('b-12', {
    seq: 12, offsetMs: 22800, category: 'lifecycle', producer: 'harness', kind: 'session.complete',
    title: 'Session completed',
    summary: 'Agent signalled completion after recovery. Journal closed cleanly.',
    fields: [
      { key: 'outcome', value: 'completed' },
      { key: 'journal', value: 'closed' },
    ],
    evidence: [obs('Completion', 'Lifecycle completion event recorded.', SRC.eventLog)],
    structured: {
      key: 'final_state',
      value: { outcome: 'completed', files_changed: 1, retries: 1, tests_run: 34, wall_ms: 22800 },
    },
  }),
];

const bUsageRows = bEvents.filter((e) => e.usage?.present).length;

export const scenarioB: Session = {
  id: 'run-2b7e90',
  label: 'CSV export migration — tool failure and recovery',
  scenario: 'Scenario B — tool failure and recovery',
  taskId: 'Migrate legacy CSV export endpoint to the streaming writer',
  state: 'completed',
  outcome: 'Task completed after one failed tool call and a recorded recovery path.',
  startedAt: '2026-10-19 09:14:02 UTC',
  durationMs: 22800,
  runtime: runtimeStandard,
  capabilities: capabilitiesStandard,
  sources: sourcesComplete.map((s) =>
    s.id === SRC.eventLog
      ? { ...s, records: bEvents.length }
      : s.id === SRC.usageLedger
        ? { ...s, records: bUsageRows }
        : s,
  ),
  events: bEvents,
  interventions: [],
};

// ─── Scenario E: capability mismatch under a permissive harness ──────────────

export const scenarioE: Session = {
  id: 'run-5aa1d3',
  label: 'Config diff experiment — permissive network policy',
  scenario: 'Scenario E — capability mismatch resolved by configuration',
  taskId: 'Document the environment differences between attachments (no code changes requested)',
  state: 'completed',
  outcome: 'Task completed. Same runtime, different harness network policy: the mismatched capability becomes admitted.',
  startedAt: '2026-10-19 09:14:02 UTC',
  durationMs: 8400,
  runtime: {
    ...runtimeStandard,
    config: runtimeStandard.config.map((c) =>
      c.key === 'network_policy' ? { key: c.key, value: 'allowlist (12 hosts)' } : c,
    ),
  },
  capabilities: capabilitiesStandard.map((c) =>
    c.id === 'cap.network.fetch'
      ? {
          ...c,
          status: 'admitted' as Capability['status'],
          declared: 'Fetch HTTP resources from an allowlist.',
          observed: 'Runtime declared a 12-host allowlist; harness policy admits the same 12 hosts. No fetch performed in this run.',
          restrictions: ['Allowlist: 12 hosts'],
          evidence: [
            rep('Declared', 'Runtime allowlist: 12 hosts.', SRC.runtimeRegistry),
            rep('Policy', 'Harness network policy: 12 hosts (matches the runtime declaration).', SRC.harnessRegistry),
            na('Exercise record', 'No fetch performed during this short documentation run.'),
          ],
        }
      : c,
  ),
  sources: sourcesComplete.map((s) =>
    s.id === SRC.eventLog ? { ...s, records: 4 } : s.id === SRC.usageLedger ? { ...s, records: 1 } : s,
  ),
  events: [
    mkEvent('e2-01', {
      seq: 1, offsetMs: 0, category: 'lifecycle', producer: 'harness', kind: 'session.attach',
      title: 'Session attached',
      summary: 'Harness attached with a permissive network policy. Capability admission differs from the standard attachment.',
      fields: [
        { key: 'session_id', value: 'run-5aa1d3' },
        { key: 'network_policy', value: 'allowlist (12 hosts)' },
      ],
      evidence: [
        obs('Attachment', 'Attachment event recorded.', SRC.eventLog),
        rep('Network policy', 'Harness network policy: 12 hosts.', SRC.harnessRegistry),
      ],
    }),
    mkEvent('e2-02', {
      seq: 2, offsetMs: 300, category: 'lifecycle', producer: 'registry', kind: 'capability.registry_read',
      title: 'Capability registry read',
      summary: 'network.fetch admitted without mismatch: runtime and harness allowlists agree at 12 hosts.',
      fields: [
        { key: 'records', value: '10' },
        { key: 'mismatches', value: '0' },
      ],
      evidence: [
        obs('Registry read', 'Capability registry opened and read.', SRC.capabilityRegistry),
      ],
    }),
    mkEvent('e2-03', {
      seq: 3, offsetMs: 1200, category: 'model', producer: 'agent', kind: 'model.request',
      title: 'Model request 1 — documentation pass',
      summary: 'Agent drafts the environment-difference summary; no network access attempted.',
      fields: [{ key: 'request', value: 'req-001' }],
      evidence: [
        rep('Request record', 'Recorded via the harness transport.', SRC.eventLog),
        obs('Usage row', 'Ledger row present.', SRC.usageLedger),
      ],
      usage: { present: true, promptTokens: 8120, completionTokens: 940, cacheReadTokens: 0 },
    }),
    mkEvent('e2-04', {
      seq: 4, offsetMs: 8400, category: 'lifecycle', producer: 'harness', kind: 'session.complete',
      title: 'Session completed',
      summary: 'Short documentation run completed. network.fetch was admitted but never exercised: admission is not proof of function.',
      fields: [
        { key: 'outcome', value: 'completed' },
        { key: 'network_fetch_calls', value: '0' },
      ],
      evidence: [
        obs('Completion', 'Lifecycle completion event recorded.', SRC.eventLog),
        na('Exercise record for network.fetch', 'Capability admitted but never invoked in this run.'),
      ],
    }),
  ],
  interventions: [],
};
