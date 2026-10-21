import type { LineageRelation } from '@/domain/evolve';
import tokens from '@/design/tokens.json';
import type { SceneNodeClassification, SceneProvenance } from '../types';

/**
 * Raw hex for programmatic renderers (canvas/WebGL cannot read Tailwind classes).
 * Every value is read from src/design/tokens.json, the same file Tailwind reads, so the two cannot drift.
 *
 * Grammar (docs/design-direction.md): hue names provenance (OBS/REP/DER/N-A), attention and fault; selection is neutral ivory;
 * structure (relations, continuation kinds) is drawn from neutrals plus two hues that no evidence class uses.
 */

export const RAW = {
  canvas: tokens.surface['0'],
  panel: tokens.surface['1'],
  raised: tokens.surface['2'],
  hover: tokens.surface['3'],
  line: tokens.line.DEFAULT,
  lineStrong: tokens.line.strong,
  fg1: tokens.fg['1'],
  fg2: tokens.fg['2'],
  fg3: tokens.fg['3'],
  select: tokens.select,
  obs: tokens.provenance.OBS,
  rep: tokens.provenance.REP,
  der: tokens.provenance.DER,
  na: tokens.provenance.NA,
  attention: tokens.attention,
  fault: tokens.fault,
} as const;

/** Relation line style. `dash` is honoured by the SVG backend only; the WebGL backend draws every edge solid, so a relation must
 *  also differ by hue/lightness (see the tests) and is never identified by its dash alone. */
export const RELATION_STYLE_HEX: Record<LineageRelation, { stroke: string; dash?: [number, number] }> = {
  forked_from: { stroke: tokens.relation.forked_from },
  replay_of: { stroke: tokens.relation.replay_of, dash: [5, 3] },
  candidate_of: { stroke: tokens.relation.candidate_of },
  evaluated_against: { stroke: tokens.relation.evaluated_against, dash: [1.5, 3] },
  continuation_of: { stroke: tokens.relation.continuation_of },
  simulated_branch: { stroke: tokens.relation.simulated_branch, dash: [2, 3] },
};

export const CLASSIFICATION_TAG: Record<SceneNodeClassification, { label: string; color: string }> = {
  baseline: { label: 'BASELINE', color: tokens.classification.baseline },
  trial: { label: 'TRIAL', color: tokens.classification.trial },
  continuation: { label: 'CONTINUATION', color: tokens.classification.continuation },
  replay: { label: 'REPLAY', color: tokens.classification.replay },
  'simulated-projection': { label: 'SIMULATED', color: tokens.classification['simulated-projection'] },
};

export const PROVENANCE_BADGE: Record<SceneProvenance, { label: string; color: string; glyph: 'disc' | 'half' | 'diamond' | 'ring' }> = {
  observed: { label: 'OBS', color: tokens.provenance.OBS, glyph: 'disc' },
  reported: { label: 'REP', color: tokens.provenance.REP, glyph: 'half' },
  derived: { label: 'DER', color: tokens.provenance.DER, glyph: 'diamond' },
  'not-applicable': { label: 'N/A', color: tokens.provenance.NA, glyph: 'ring' },
};

export interface NodePaint {
  fill: { hex: string; alpha: number };
  stroke: { hex: string; alpha: number };
  /** A simulated projection is drawn hollow (see-through) so it can never be mistaken for a recorded run. */
  hollow: boolean;
}

/**
 * The single place that decides how a node is painted. Both backends call it, so selection and the epistemic distinctions
 * (recorded vs replay vs continuation vs simulated) cannot diverge between SVG and WebGL.
 */
export function nodePaint(classification: SceneNodeClassification, state: { selected: boolean; dimmed: boolean }): NodePaint {
  const k = state.dimmed ? 0.15 : 1;
  const hollow = classification === 'simulated-projection';
  if (state.selected) {
    return {
      fill: { hex: RAW.hover, alpha: (hollow ? 0.55 : 1) * k },
      stroke: { hex: RAW.select, alpha: k },
      hollow,
    };
  }
  const tint = CLASSIFICATION_TAG[classification].color;
  return {
    fill: hollow ? { hex: tint, alpha: 0.07 * k } : { hex: RAW.raised, alpha: k },
    stroke: { hex: tint, alpha: (hollow ? 0.85 : 0.55) * k },
    hollow,
  };
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function hexToRgba(hex: string, alpha: number): [number, number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  return [r / 255, g / 255, b / 255, alpha];
}
