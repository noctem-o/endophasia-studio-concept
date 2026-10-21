export type EvidenceKind = 'OBS' | 'REP' | 'DER' | 'NA';

export interface EvidenceItem {
  kind: EvidenceKind;
  label: string;
  detail: string;
  /** For DER: the declared derivation process. */
  process?: string;
  /** For NA: why the evidence is unavailable. */
  reason?: string;
  sourceId?: string;
}

export interface SourceRef {
  fields: string[];
}

export interface Source {
  id: string;
  name: string;
  kind: string;
  /** Readable | Empty | Absent | Degraded | Unopenable */
  condition: 'readable' | 'empty' | 'absent' | 'degraded' | 'unopenable';
  note: string;
  records?: number;
}

export interface RuntimeIdentity {
  agent: string;
  runtime: string;
  runtimeVersion: string;
  harness: string;
  fingerprint: string;
  recordedAt: string;
  config: { key: string; value: string }[];
}

export type CapabilityStatus =
  | 'admitted'
  | 'partially-admitted'
  | 'unavailable'
  | 'mismatched'
  | 'unverified';

export interface Capability {
  id: string;
  name: string;
  status: CapabilityStatus;
  /** Short summary of what the runtime declared vs what was observed. */
  declared: string;
  observed: string;
  restrictions: string[];
  evidence: EvidenceItem[];
}

export type EventCategory =
  | 'lifecycle'
  | 'model'
  | 'tool'
  | 'context'
  | 'verification'
  | 'intervention';

export type EventStatus = 'ok' | 'error' | 'partial' | 'pending';

export interface TrajectoryEvent {
  id: string;
  seq: number;
  /** Recorded wall-clock timestamp. */
  at: string;
  offsetMs: number;
  category: EventCategory;
  producer: string;
  status: EventStatus;
  title: string;
  summary: string;
  fields: { key: string; value: string; mono?: boolean }[];
  evidence: EvidenceItem[];
  structured?: StructuredBlock;
  usage?: { promptTokens: number; completionTokens: number; cacheReadTokens?: number };
}

export interface StructuredBlock {
  key: string;
  value: StructuredValue;
}

export type StructuredValue =
  | string
  | number
  | boolean
  | null
  | StructuredValue[]
  | { [k: string]: StructuredValue };

export interface Session {
  id: string;
  label: string;
  taskId: string;
  state: 'completed' | 'failed' | 'incomplete-evidence';
  startedAt: string;
  durationMs: number;
  runtime: RuntimeIdentity;
  capabilities: Capability[];
  sources: Source[];
  events: TrajectoryEvent[];
  /** Optional: id of a base session this one diverged from, with divergence point. */
  divergence?: { fromSessionId: string; atEventSeq: number; note: string };
}
