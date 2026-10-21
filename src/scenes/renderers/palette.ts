import type { LineageRelation } from '@/domain/evolve';
import type { SceneNodeClassification, SceneProvenance } from '../types';

/**
 * Raw palette hex for programmatic renderers (canvas/WebGL cannot read
 * Tailwind classes). Values mirror the Tailwind config exactly.
 */

export const RAW = {
  ink950: '#0A0E12',
  ink900: '#0D1218',
  ink850: '#10161D',
  ink800: '#141B23',
  ink750: '#19212B',
  ink700: '#1F2833',
  ink600: '#2A3542',
  ink500: '#3A4757',
  ink400: '#54637A',
  ink300: '#7C8CA5',
  ink200: '#A7B4C7',
  ink100: '#D3DBE6',
  ink50: '#EDF1F6',
  teal: '#2DD4BF',
  blue: '#60A5FA',
  amber: '#F5B94B',
  red: '#F87171',
} as const;

export const RELATION_STYLE_HEX: Record<LineageRelation, { stroke: string; dash?: [number, number] }> = {
  forked_from: { stroke: RAW.teal },
  replay_of: { stroke: RAW.blue, dash: [4, 3] },
  candidate_of: { stroke: RAW.amber },
  evaluated_against: { stroke: '#A78BFA' },
  continuation_of: { stroke: RAW.ink300 },
  simulated_branch: { stroke: RAW.red, dash: [2, 3] },
};

export const CLASSIFICATION_TAG: Record<SceneNodeClassification, { label: string; color: string }> = {
  baseline: { label: 'BASELINE', color: RAW.teal },
  trial: { label: 'TRIAL', color: RAW.amber },
  continuation: { label: 'CONTINUATION', color: RAW.blue },
  replay: { label: 'REPLAY', color: RAW.blue },
  'simulated-projection': { label: 'SIMULATED', color: RAW.red },
};

export const PROVENANCE_BADGE: Record<SceneProvenance, { label: string; color: string }> = {
  observed: { label: 'OBS', color: RAW.teal },
  replayed: { label: 'REP', color: RAW.blue },
  derived: { label: 'DER', color: RAW.red },
  'not-applicable': { label: 'N/A', color: RAW.ink400 },
};

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function hexToRgba(hex: string, alpha: number): [number, number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  return [r / 255, g / 255, b / 255, alpha];
}
