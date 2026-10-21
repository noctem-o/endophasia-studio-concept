import type { LucideIcon } from 'lucide-react';
import { Hand, Layers, MessageSquare, Power, ShieldCheck, Wrench } from 'lucide-react';
import type { EvidenceKind, EventCategory, EventStatus, CapabilityStatus, SourceCondition, SessionState, InterventionStage } from '../domain/types';

/**
 * The semantic vocabulary of the interface. Colour grammar (docs/design-direction.md):
 *   hue        → provenance (OBS teal, REP blue, DER violet, N/A slate), attention (amber) and fault (red) — nothing else
 *   texture    → epistemic status (solid = recorded, dashed = proposed/derived, hatched = simulated/synthetic, hollow = unavailable)
 *   position   → category, storage order, side
 *   ivory      → selection and focus
 * Class strings are written out in full so Tailwind can see them.
 */

// COMPAT: `glyph`, `dot` and the neutral category colours exist only for screens not yet converted; they are removed with the last one.

// ─── Provenance ──────────────────────────────────────────────────────────────

export const evidenceMeta: Record<EvidenceKind, { label: string; full: string; desc: string; text: string; border: string; bg: string; fill: string; rank: number; glyph: string }> = {
  OBS: { label: 'OBS', full: 'Observed', desc: 'Recorded directly by the observation layer.', text: 'text-obs', border: 'border-obs/40', bg: 'bg-obs/10', fill: 'bg-obs', rank: 3, glyph: '◉' },
  REP: { label: 'REP', full: 'Reported', desc: 'Stated by a source; not independently confirmed.', text: 'text-rep', border: 'border-rep/40', bg: 'bg-rep/10', fill: 'bg-rep', rank: 2, glyph: '◔' },
  DER: { label: 'DER', full: 'Derived', desc: 'Computed through a declared derivation process.', text: 'text-der', border: 'border-der/40', bg: 'bg-der/10', fill: 'bg-der', rank: 1, glyph: '∆' },
  NA: { label: 'N/A', full: 'Unavailable', desc: 'Not recorded or not available; a reason is stated.', text: 'text-na', border: 'border-na/40', bg: 'bg-na/10', fill: 'bg-na', rank: 0, glyph: '∅' },
};

export const EVIDENCE_ORDER: EvidenceKind[] = ['OBS', 'REP', 'DER', 'NA'];

/** The strongest class among an event's evidence items, or null when it carries none. Order: OBS > REP > DER > N/A. */
export function bestEvidence(items: { kind: EvidenceKind }[]): EvidenceKind | null {
  let best: EvidenceKind | null = null;
  for (const item of items) if (best === null || evidenceMeta[item.kind].rank > evidenceMeta[best].rank) best = item.kind;
  return best;
}

// ─── Events ──────────────────────────────────────────────────────────────────

/** Category is carried by position (a swimlane) and a neutral icon, never by hue. */
export const categoryMeta: Record<EventCategory, { label: string; name: string; icon: LucideIcon; lane: number; dot: string; text: string; bg: string; border: string }> = {
  lifecycle: { label: 'LIFECYCLE', name: 'Lifecycle', icon: Power, lane: 0, dot: 'bg-fg-3', text: 'text-fg-2', bg: 'bg-surface-3', border: 'border-line-strong' },
  context: { label: 'CONTEXT', name: 'Context', icon: Layers, lane: 1, dot: 'bg-fg-3', text: 'text-fg-2', bg: 'bg-surface-3', border: 'border-line-strong' },
  model: { label: 'MODEL', name: 'Model', icon: MessageSquare, lane: 2, dot: 'bg-fg-3', text: 'text-fg-2', bg: 'bg-surface-3', border: 'border-line-strong' },
  tool: { label: 'TOOL', name: 'Tool', icon: Wrench, lane: 3, dot: 'bg-fg-3', text: 'text-fg-2', bg: 'bg-surface-3', border: 'border-line-strong' },
  verification: { label: 'VERIFY', name: 'Verification', icon: ShieldCheck, lane: 4, dot: 'bg-fg-3', text: 'text-fg-2', bg: 'bg-surface-3', border: 'border-line-strong' },
  intervention: { label: 'INTERVENE', name: 'Intervention', icon: Hand, lane: 5, dot: 'bg-fg-3', text: 'text-fg-2', bg: 'bg-surface-3', border: 'border-line-strong' },
};

export const CATEGORY_ORDER: EventCategory[] = ['lifecycle', 'context', 'model', 'tool', 'verification', 'intervention'];

/** Health is the default and is not coloured; only deviations are marked. */
export const statusMeta: Record<EventStatus, { label: string; text: string; border: string; bg: string; marked: boolean; dot: string }> = {
  ok: { label: 'ok', text: 'text-fg-3', border: 'border-line', bg: 'bg-transparent', marked: false, dot: 'bg-fg-4' },
  error: { label: 'error', text: 'text-fault', border: 'border-fault/50', bg: 'bg-fault/10', marked: true, dot: 'bg-fault' },
  partial: { label: 'partial', text: 'text-attn', border: 'border-attn/50', bg: 'bg-attn/10', marked: true, dot: 'bg-attn' },
};

// ─── Capabilities ────────────────────────────────────────────────────────────

/** Shape carries the status; hue appears only where something needs attention (partial) or is wrong (mismatch). */
export const capabilityMeta: Record<CapabilityStatus, { label: string; text: string; border: string; bg: string; desc: string; order: number; glyph: string }> = {
  admitted: { label: 'ADMITTED', text: 'text-fg-1', border: 'border-line-strong', bg: 'bg-surface-3', desc: 'Declared and exercised with recorded results.', order: 0, glyph: '●' },
  'partially-admitted': { label: 'PARTIAL', text: 'text-attn', border: 'border-attn/50', bg: 'bg-attn/10', desc: 'Admitted with recorded limitations or gaps.', order: 1, glyph: '◐' },
  unverified: { label: 'UNVERIFIED', text: 'text-fg-2', border: 'border-line-strong', bg: 'bg-transparent', desc: 'Declared, never exercised; no observation either way.', order: 2, glyph: '◇' },
  mismatched: { label: 'MISMATCH', text: 'text-fault', border: 'border-fault/50', bg: 'bg-fault/10', desc: 'Runtime declaration conflicts with harness policy.', order: 3, glyph: '▲' },
  unavailable: { label: 'UNAVAILABLE', text: 'text-fg-3', border: 'border-line', bg: 'bg-transparent', desc: 'Not granted or not mounted — distinct from inactive.', order: 4, glyph: '○' },
};

// ─── Sources ─────────────────────────────────────────────────────────────────

export const sourceMeta: Record<SourceCondition, { label: string; text: string; border: string; bg: string; desc: string; glyph: string }> = {
  readable: { label: 'READABLE', text: 'text-fg-1', border: 'border-line-strong', bg: 'bg-surface-3', desc: 'Opened and read in full.', glyph: '●' },
  empty: { label: 'EMPTY', text: 'text-fg-2', border: 'border-line-strong', bg: 'bg-transparent', desc: 'Opened; contains no records.', glyph: '○' },
  absent: { label: 'ABSENT', text: 'text-fg-3', border: 'border-line', bg: 'bg-transparent', desc: 'Does not exist.', glyph: '—' },
  degraded: { label: 'DEGRADED', text: 'text-attn', border: 'border-attn/50', bg: 'bg-attn/10', desc: 'Readable in part; some records are lost or unreliable.', glyph: '◐' },
  unopenable: { label: 'UNOPENABLE', text: 'text-fault', border: 'border-fault/50', bg: 'bg-fault/10', desc: 'Exists but could not be opened.', glyph: '✕' },
};

// ─── Sessions ────────────────────────────────────────────────────────────────

export const sessionStateMeta: Record<SessionState, { label: string; text: string; border: string; bg: string }> = {
  completed: { label: 'COMPLETED', text: 'text-fg-1', border: 'border-line-strong', bg: 'bg-surface-3' },
  'divergent-terminated': { label: 'DIVERGENT · TERMINATED', text: 'text-fault', border: 'border-fault/50', bg: 'bg-fault/10' },
  'incomplete-evidence': { label: 'EVIDENCE INCOMPLETE', text: 'text-attn', border: 'border-attn/50', bg: 'bg-attn/10' },
};

// ─── Interventions ───────────────────────────────────────────────────────────

/** Stages are separate recorded events; none of them is coloured as success. */
export const interventionStageMeta: Record<InterventionStage, { label: string; text: string; bg: string; border: string }> = {
  proposed: { label: 'PROPOSED', text: 'text-fg-2', bg: 'bg-transparent', border: 'border-line-strong' },
  authorised: { label: 'AUTHORISED', text: 'text-fg-1', bg: 'bg-surface-3', border: 'border-line-strong' },
  accepted: { label: 'ACCEPTED', text: 'text-fg-1', bg: 'bg-surface-3', border: 'border-line-strong' },
  consumed: { label: 'CONSUMED', text: 'text-fg-1', bg: 'bg-surface-3', border: 'border-line-strong' },
  expired: { label: 'EXPIRED UNCONSUMED', text: 'text-attn', bg: 'bg-attn/10', border: 'border-attn/50' },
};
