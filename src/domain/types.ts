// ─── Evidence & provenance ────────────────────────────────────────────────────

export type EvidenceKind = 'OBS' | 'REP' | 'DER' | 'NA';

export interface EvidenceItem {
  kind: EvidenceKind;
  label: string;
  detail: string;
  /** DER only: the declared derivation process. */
  process?: string;
  /** NA only: why the value is unavailable. */
  reason?: string;
  /** Identifier of the independent source this item came from (see Source.id). */
  sourceId?: string;
}

export type SourceCondition = 'readable' | 'empty' | 'absent' | 'degraded' | 'unopenable';

export interface Source {
  id: string;
  name: string;
  kind: string;
  condition: SourceCondition;
  note: string;
  records?: number;
}

// ─── Runtime & capabilities ──────────────────────────────────────────────────

export interface ConfigEntry {
  key: string;
  value: string;
  /** Marks entries whose recorded value is known to be unreliable. */
  degraded?: boolean;
}

export interface RuntimeIdentity {
  agent: string;
  runtime: string;
  runtimeVersion: string;
  harness: string;
  fingerprint: string;
  recordedAt: string;
  config: ConfigEntry[];
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
  /** What the runtime declared about this capability. */
  declared: string;
  /** What the recorded evidence actually shows. */
  observed: string;
  restrictions: string[];
  evidence: EvidenceItem[];
}

// ─── Trajectory events ───────────────────────────────────────────────────────

export type EventCategory =
  | 'lifecycle'
  | 'model'
  | 'tool'
  | 'context'
  | 'verification'
  | 'intervention';

export type EventStatus = 'ok' | 'error' | 'partial';

export type UsagePresence =
  | { present: true; promptTokens: number; completionTokens: number; cacheReadTokens?: number }
  | { present: false; reason: string };

/** An explicit recorded relationship between two events in the same session. */
export interface EventRef {
  /** Event id this record points to. */
  target: string;
  /** Semantic relationship, e.g. "retry_of", "authorises", "consumes". */
  relation: string;
}

export interface TrajectoryEvent {
  id: string;
  /** 1-based position in recorded storage order. */
  seq: number;
  /** Recorded producer wall-clock timestamp. */
  at: string;
  /** Milliseconds after session start; derived from `at` at load time, never authored independently. */
  offsetMs: number;
  category: EventCategory;
  producer: string;
  status: EventStatus;
  /** Stable event type key, e.g. "session.attach", "tool.call" — used by comparison alignment. */
  kind: string;
  /** Tool name, for tool.* events. */
  tool?: string;
  title: string;
  summary: string;
  fields: EventField[];
  evidence: EvidenceItem[];
  structured?: StructuredBlock;
  usage?: UsagePresence;
  /** Explicit links to other records in this session. */
  refs?: EventRef[];
}

export interface EventField {
  key: string;
  value: string;
  mono?: boolean;
  provenance?: EvidenceKind;
}

// ─── Interventions ───────────────────────────────────────────────────────────

export type InterventionKind = 'STEER' | 'QUEUE';

export type InterventionStage =
  | 'proposed'
  | 'authorised'
  | 'accepted'
  | 'consumed'
  | 'expired';

/** Record of one step in an intervention's recorded lifecycle. Each stage is a separate event. */
export interface InterventionStep {
  stage: InterventionStage;
  eventSeq: number;
  note: string;
}

export interface Intervention {
  id: string;
  kind: InterventionKind;
  /** Short statement of intent — intent is not effect. */
  intent: string;
  authorisation: string;
  scope: string;
  steps: InterventionStep[];
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export type SessionState = 'completed' | 'divergent-terminated' | 'incomplete-evidence';

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
  scenario: string;
  taskId: string;
  state: SessionState;
  outcome: string;
  startedAt: string;
  durationMs: number;
  runtime: RuntimeIdentity;
  capabilities: Capability[];
  sources: Source[];
  events: TrajectoryEvent[];
  interventions: Intervention[];
}
