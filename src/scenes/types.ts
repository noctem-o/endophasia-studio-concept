import type { ExecutionRole, LineageRelation } from '@/domain/evolve';

/**
 * LineageScene — a versioned, renderer-independent description of the EVOLVE
 * lineage. A scene is data, never code: renderers receive a scene and draw it,
 * and no renderer may inject markup, scripts or markup-bearing strings into
 * the document. Scientific meaning (identity, provenance, relations, missing
 * information) lives in the scene; only presentation lives in the renderer.
 */

export const LINEAGE_SCENE_SCHEMA_VERSION = 1 as const;

/** Where a node's content provably comes from. OBS/REP/DER/N-A, made explicit. */
export type SceneProvenance = 'observed' | 'replayed' | 'derived' | 'not-applicable';

export type SceneNodeClassification =
  | 'baseline'
  | 'trial'
  | 'continuation'
  | 'replay'
  | 'simulated-projection';

export interface SceneNode {
  /** Stable identity: the corpus execution id. Scenes never rename records. */
  id: string;
  label: string;
  role: ExecutionRole;
  classification: SceneNodeClassification;
  provenance: SceneProvenance;
  /** Why this provenance was assigned; rendered alongside the node, never hidden. */
  provenanceReason: string;
  /** Session in the observation registry, when the trajectory was actually recorded. */
  sessionId: string | null;
  outcome: string;
  startedAt: string | null;
  /** Arm and candidate memberships, as data for filtering — not for styling. */
  armIds: string[];
  candidateIds: string[];
  /** Declared coordinate bookkeeping: missing information stays visible. */
  coordinates: { declared: number; recorded: number; unavailable: number };
}

export interface SceneEdge {
  id: string;
  from: string;
  to: string;
  relation: LineageRelation;
}

/**
 * Layout coordinates computed by a declared, deterministic algorithm.
 * Layout is presentation only: a different layout must never change what a
 * scene means, and a layout position is never an experimental result.
 */
export interface SceneLayout {
  algorithm: 'layered-longest-path-v1';
  deterministic: true;
  /** Node id → column position, row position and graph depth (root = 0). */
  positions: Record<string, { column: number; row: number; depth: number }>;
}

export interface SceneEncoding {
  nodeWidth: number;
  nodeHeight: number;
  columnGap: number;
  rowGap: number;
}

/** Explicit missing-information markers, so absence is never rendered as zero. */
export interface SceneMissing {
  /** Nodes with no recorded trajectory in the observation registry. */
  sessionlessNodeIds: string[];
  /** Nodes whose outcome is a projection description, not a measured result. */
  nonResultNodeIds: string[];
}

export interface LineageScene {
  kind: 'lineage-scene';
  schemaVersion: typeof LINEAGE_SCENE_SCHEMA_VERSION;
  /** Stable identity of the scene document itself. */
  sceneId: string;
  /** FNV-1a digest over the canonical scene content, for integrity checks. */
  contentDigest: string;
  nodes: SceneNode[];
  edges: SceneEdge[];
  /** Execution ids with no parent (graph roots), in stable order. */
  roots: string[];
  layout: SceneLayout;
  encoding: SceneEncoding;
  missing: SceneMissing;
}

export interface SceneIssue {
  severity: 'error' | 'warning';
  message: string;
}

export interface SceneBuildResult {
  scene: LineageScene | null;
  issues: SceneIssue[];
}
