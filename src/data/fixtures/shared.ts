import type {
  Capability,
  EvidenceItem,
  EventCategory,
  EventField,
  EventStatus,
  Source,
  TrajectoryEvent,
  UsagePresence,
} from '../../domain/types';

// ─── Source ids ──────────────────────────────────────────────────────────────

export const SRC = {
  eventLog: 'src:event-log',
  runtimeRegistry: 'src:runtime-registry',
  harnessRegistry: 'src:harness-registry',
  capabilityRegistry: 'src:capability-registry',
  usageLedger: 'src:usage-ledger',
  interventionLedger: 'src:intervention-ledger',
} as const;

// ─── Evidence constructors ───────────────────────────────────────────────────

export const obs = (label: string, detail: string, sourceId: string): EvidenceItem => ({
  kind: 'OBS', label, detail, sourceId,
});
export const rep = (label: string, detail: string, sourceId: string): EvidenceItem => ({
  kind: 'REP', label, detail, sourceId,
});
export const der = (label: string, detail: string, process: string, sourceId?: string): EvidenceItem => ({
  kind: 'DER', label, detail, process, sourceId,
});
export const na = (label: string, reason: string): EvidenceItem => ({
  kind: 'NA', label, detail: reason, reason,
});

// ─── Event constructor ───────────────────────────────────────────────────────

type EvArgs = {
  seq: number;
  offsetMs: number;
  category: EventCategory;
  producer: string;
  status?: EventStatus;
  kind: string;
  tool?: string;
  title: string;
  summary: string;
  fields?: EventField[];
  evidence: EvidenceItem[];
  structured?: { key: string; value: TrajectoryEvent['structured'] extends undefined ? never : NonNullable<TrajectoryEvent['structured']>['value'] };
  usage?: UsagePresence;
  refs?: { target: string; relation: string }[];
};

export const mkEvent = (
  id: string,
  a: EvArgs,
): TrajectoryEvent => ({
  id,
  seq: a.seq,
  at: offsetToTimestamp(a.offsetMs),
  offsetMs: a.offsetMs,
  category: a.category,
  producer: a.producer,
  status: a.status ?? 'ok',
  kind: a.kind,
  tool: a.tool,
  title: a.title,
  summary: a.summary,
  fields: a.fields ?? [],
  evidence: a.evidence,
  structured: a.structured ? { key: a.structured.key, value: a.structured.value } : undefined,
  usage: a.usage,
  refs: a.refs,
});

const BASE_EPOCH_MS = Date.parse('2026-10-19T09:14:02Z');

export function offsetToTimestamp(offsetMs: number): string {
  return new Date(BASE_EPOCH_MS + offsetMs).toISOString();
}

// ─── Shared source sets ──────────────────────────────────────────────────────

export const sourcesComplete: Source[] = [
  {
    id: SRC.eventLog, name: 'Event log', kind: 'append-only journal',
    condition: 'readable', note: 'Complete journal; all records replayed in storage order.', records: 0, // replaced per-session by builder
  },
  {
    id: SRC.runtimeRegistry, name: 'Runtime registry', kind: 'identity record',
    condition: 'readable', note: 'Runtime identity and fingerprint present and self-consistent.', records: 1,
  },
  {
    id: SRC.harnessRegistry, name: 'Harness registry', kind: 'attachment record',
    condition: 'readable', note: 'Harness declared at attachment; consistent with event log entries.', records: 1,
  },
  {
    id: SRC.capabilityRegistry, name: 'Capability registry', kind: 'admission record',
    condition: 'readable', note: 'Capability admission records present.', records: 10,
  },
  {
    id: SRC.usageLedger, name: 'Usage ledger', kind: 'token accounting',
    condition: 'readable', note: 'Usage rows present for every model request.', records: 0,
  },
];

export const sourcesDegradedLedger: Source[] = sourcesComplete.map((s) =>
  s.id === SRC.usageLedger
    ? { ...s, condition: 'degraded' as const, note: 'Ledger partially written: usage rows missing for some model requests.', records: 4 }
    : s,
);

export const sourcesUnopenableCapability: Source[] = sourcesComplete.map((s) =>
  s.id === SRC.capabilityRegistry
    ? { ...s, condition: 'unopenable' as const, note: 'Registry failed to open at replay: index checksum mismatch. Capability statuses derive from the event log only.', records: undefined }
    : s,
);

// ─── Capability inventory ────────────────────────────────────────────────────

const capEv = (name: string, exercised: string): EvidenceItem[] => [
  rep('Declared', `Runtime declared capability "${name}" at attachment.`, SRC.capabilityRegistry),
  obs('Exercised', exercised, SRC.eventLog),
];

export const capabilitiesStandard: Capability[] = [
  {
    id: 'cap.fs.read', name: 'fs.read', status: 'admitted',
    declared: 'Read files within the workspace root.',
    observed: 'Read operations recorded, all within workspace bounds.',
    restrictions: ['Confined to workspace root'],
    evidence: capEv('fs.read', 'Multiple fs.read operations recorded with results.'),
  },
  {
    id: 'cap.fs.write', name: 'fs.write', status: 'admitted',
    declared: 'Create and modify files within the workspace root.',
    observed: 'Write operations recorded; all paths inside the workspace.',
    restrictions: ['Confined to workspace root'],
    evidence: capEv('fs.write', 'fs.write operations recorded with digests.'),
  },
  {
    id: 'cap.shell.exec', name: 'shell.exec', status: 'admitted',
    declared: 'Execute shell commands in a sandboxed environment.',
    observed: 'Commands recorded, including one non-zero exit.',
    restrictions: ['Sandboxed environment', 'Network egress denied'],
    evidence: capEv('shell.exec', 'shell.exec invocations recorded with exit codes.'),
  },
  {
    id: 'cap.search.grep', name: 'search.grep', status: 'admitted',
    declared: 'Search file contents with regular expressions.',
    observed: 'Search operations recorded.',
    restrictions: [],
    evidence: capEv('search.grep', 'search.grep operations recorded.'),
  },
  {
    id: 'cap.model.request', name: 'model.request', status: 'admitted',
    declared: 'Issue model requests via the configured provider.',
    observed: 'Model requests recorded with usage rows.',
    restrictions: ['Rate-limited by harness policy'],
    evidence: capEv('model.request', 'Model request records with ledger rows.'),
  },
  {
    id: 'cap.context.window', name: 'context.window', status: 'partially-admitted',
    declared: 'Context window of 200,000 tokens.',
    observed: 'Window size is harness-reported (REP). Compaction events observed; per-request token counts are estimates.',
    restrictions: ['Token accounting partly estimated'],
    evidence: [
      rep('Window size', 'Harness reports a 200,000-token context window.', SRC.harnessRegistry),
      obs('Compaction', 'Context compaction events recorded.', SRC.eventLog),
      der('Token counts', 'Estimates from tokeniser counts, not provider accounting.', 'Deterministic tokeniser pass over assembled prompt parts; approximation.', SRC.usageLedger),
    ],
  },
  {
    id: 'cap.subagents.spawn', name: 'subagents.spawn', status: 'unavailable',
    declared: 'Spawn subordinate agent sessions.',
    observed: 'Not exercised. The runtime declares support, but the harness admitted no grant.',
    restrictions: ['No grant admitted by harness'],
    evidence: [
      rep('Declared', 'Runtime lists subagents.spawn as supported.', SRC.runtimeRegistry),
      na('Exercise record', 'No grant in the capability registry; never exercised.'),
    ],
  },
  {
    id: 'cap.network.fetch', name: 'network.fetch', status: 'mismatched',
    declared: 'Fetch HTTP resources from an allowlist.',
    observed: 'Runtime declared a 12-host allowlist; harness policy records 0 hosts. Mismatch recorded at attachment.',
    restrictions: ['Effective allowlist empty per harness policy'],
    evidence: [
      rep('Declared', 'Runtime allowlist: 12 hosts.', SRC.runtimeRegistry),
      rep('Policy', 'Harness network policy: 0 hosts.', SRC.harnessRegistry),
      obs('Mismatch record', 'Attachment event records the capability mismatch.', SRC.eventLog),
    ],
  },
  {
    id: 'cap.artifacts.export', name: 'artifacts.export', status: 'unverified',
    declared: 'Export run artifacts to a recording store.',
    observed: 'Declared but never exercised in this session. Admitted with no observation.',
    restrictions: [],
    evidence: [
      rep('Declared', 'Capability present in the runtime manifest.', SRC.capabilityRegistry),
      na('Exercise record', 'No invocation recorded in the event log.'),
    ],
  },
  {
    id: 'cap.session.persistence', name: 'session.persistence', status: 'unavailable',
    declared: 'Persist session state across restarts.',
    observed: 'Unavailable: the harness did not mount a persistence volume for this run.',
    restrictions: ['No persistence volume mounted'],
    evidence: [
      rep('Policy', 'Harness volume configuration: none.', SRC.harnessRegistry),
      na('Exercise record', 'Capability unavailable for the whole session.'),
    ],
  },
];

/** Scenario E: same inventory but network.fetch flips to admitted under a permissive harness policy. */
export const capabilitiesPermissiveNetwork: Capability[] = capabilitiesStandard.map((c) =>
  c.id === 'cap.network.fetch'
    ? {
        ...c,
        status: 'admitted' as const,
        observed: 'Runtime declared a 12-host allowlist; harness policy admits the same 12 hosts. No fetch performed in this run.',
        restrictions: ['Allowlist: 12 hosts'],
        evidence: [
          rep('Declared', 'Runtime allowlist: 12 hosts.', SRC.runtimeRegistry),
          rep('Policy', 'Harness network policy: 12 hosts (matches runtime declaration).', SRC.harnessRegistry),
        ],
      }
    : c,
);

/** Variant where shell.exec is NOT granted (scenario F-adjacent, stricter harness). */
export const capabilitiesNoShell: Capability[] = capabilitiesStandard.filter(
  (c) => c.id !== 'cap.shell.exec',
).map((c) =>
  c.id === 'cap.fs.write'
    ? {
        ...c,
        status: 'partially-admitted' as const,
        observed: 'Writes recorded. Without shell.exec the agent could not run the test suite; verification relies on harness digest checks only.',
        restrictions: [...c.restrictions, 'No shell.exec grant: in-process verification only'],
        evidence: [
          ...c.evidence,
          rep('Policy', 'Harness denied shell.exec grant for this attachment.', SRC.harnessRegistry),
        ],
      }
    : c,
);

// ─── Shared runtime identity ─────────────────────────────────────────────────

export const runtimeStandard = {
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
};
