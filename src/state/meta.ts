import type { EvidenceKind, EventCategory, EventStatus, CapabilityStatus, SourceCondition, SessionState, InterventionStage } from '../domain/types';

// ─── Provenance ──────────────────────────────────────────────────────────────

export const evidenceMeta: Record<EvidenceKind, { label: string; full: string; desc: string; text: string; border: string; bg: string; glyph: string }> = {
  OBS: { label: 'OBS', full: 'Observed', desc: 'Recorded directly by the observation layer.', text: 'text-teal-accent', border: 'border-teal-accent/40', bg: 'bg-teal-accent/10', glyph: '◉' },
  REP: { label: 'REP', full: 'Reported', desc: 'Stated by a source; not independently confirmed.', text: 'text-blue-accent', border: 'border-blue-accent/40', bg: 'bg-blue-accent/10', glyph: '◔' },
  DER: { label: 'DER', full: 'Derived', desc: 'Computed through a declared derivation process.', text: 'text-amber-accent', border: 'border-amber-accent/40', bg: 'bg-amber-accent/10', glyph: '∆' },
  NA: { label: 'N/A', full: 'Unavailable', desc: 'Not recorded or not available; a reason is stated.', text: 'text-ink-400', border: 'border-ink-500/50', bg: 'bg-ink-700/50', glyph: '∅' },
};

// ─── Events ──────────────────────────────────────────────────────────────────

export const categoryMeta: Record<EventCategory, { label: string; dot: string; text: string; bg: string; border: string }> = {
  lifecycle: { label: 'LIFECYCLE', dot: 'bg-ink-300', text: 'text-ink-200', bg: 'bg-ink-700/40', border: 'border-ink-500/40' },
  model: { label: 'MODEL', dot: 'bg-blue-accent', text: 'text-blue-accent', bg: 'bg-blue-accent/8', border: 'border-blue-accent/25' },
  tool: { label: 'TOOL', dot: 'bg-teal-accent', text: 'text-teal-accent', bg: 'bg-teal-accent/8', border: 'border-teal-accent/25' },
  context: { label: 'CONTEXT', dot: 'bg-amber-accent', text: 'text-amber-accent', bg: 'bg-amber-accent/8', border: 'border-amber-accent/25' },
  verification: { label: 'VERIFY', dot: 'bg-violet-400', text: 'text-violet-300', bg: 'bg-violet-400/8', border: 'border-violet-400/25' },
  intervention: { label: 'INTERVENE', dot: 'bg-red-accent', text: 'text-red-accent', bg: 'bg-red-accent/8', border: 'border-red-accent/25' },
};

export const statusMeta: Record<EventStatus, { label: string; dot: string; text: string }> = {
  ok: { label: 'ok', dot: 'bg-teal-accent', text: 'text-teal-accent' },
  error: { label: 'error', dot: 'bg-red-accent', text: 'text-red-accent' },
  partial: { label: 'partial', dot: 'bg-amber-accent', text: 'text-amber-accent' },
};

// ─── Capabilities ────────────────────────────────────────────────────────────

export const capabilityMeta: Record<CapabilityStatus, { label: string; text: string; glyph: string; desc: string }> = {
  admitted: { label: 'ADMITTED', text: 'text-teal-accent', glyph: '●', desc: 'Declared and exercised with recorded results.' },
  'partially-admitted': { label: 'PARTIAL', text: 'text-amber-accent', glyph: '◐', desc: 'Admitted with recorded limitations or gaps.' },
  unavailable: { label: 'UNAVAILABLE', text: 'text-ink-400', glyph: '○', desc: 'Not granted or not mounted — distinct from inactive.' },
  mismatched: { label: 'MISMATCH', text: 'text-red-accent', glyph: '▲', desc: 'Runtime declaration conflicts with harness policy.' },
  unverified: { label: 'UNVERIFIED', text: 'text-blue-accent', glyph: '◇', desc: 'Declared, never exercised; no observation either way.' },
};

// ─── Sources ─────────────────────────────────────────────────────────────────

export const sourceMeta: Record<SourceCondition, { label: string; text: string; border: string; bg: string; glyph: string }> = {
  readable: { label: 'READABLE', text: 'text-teal-accent', border: 'border-teal-accent/35', bg: 'bg-teal-accent/8', glyph: '●' },
  empty: { label: 'EMPTY', text: 'text-ink-300', border: 'border-ink-500/40', bg: 'bg-ink-700/40', glyph: '○' },
  absent: { label: 'ABSENT', text: 'text-ink-400', border: 'border-ink-500/40', bg: 'bg-ink-700/40', glyph: '—' },
  degraded: { label: 'DEGRADED', text: 'text-amber-accent', border: 'border-amber-accent/35', bg: 'bg-amber-accent/8', glyph: '◐' },
  unopenable: { label: 'UNOPENABLE', text: 'text-red-accent', border: 'border-red-accent/35', bg: 'bg-red-accent/8', glyph: '✕' },
};

// ─── Sessions ────────────────────────────────────────────────────────────────

export const sessionStateMeta: Record<SessionState, { label: string; text: string; border: string; bg: string }> = {
  completed: { label: 'COMPLETED', text: 'text-teal-accent', border: 'border-teal-accent/40', bg: 'bg-teal-accent/8' },
  'divergent-terminated': { label: 'DIVERGENT · TERMINATED', text: 'text-red-accent', border: 'border-red-accent/40', bg: 'bg-red-accent/8' },
  'incomplete-evidence': { label: 'EVIDENCE INCOMPLETE', text: 'text-amber-accent', border: 'border-amber-accent/40', bg: 'bg-amber-accent/8' },
};

// ─── Interventions ───────────────────────────────────────────────────────────

export const interventionStageMeta: Record<InterventionStage, { label: string; text: string; bg: string; border: string }> = {
  proposed: { label: 'PROPOSED', text: 'text-ink-200', bg: 'bg-ink-700/50', border: 'border-ink-500/50' },
  authorised: { label: 'AUTHORISED', text: 'text-blue-accent', bg: 'bg-blue-accent/10', border: 'border-blue-accent/40' },
  accepted: { label: 'ACCEPTED', text: 'text-amber-accent', bg: 'bg-amber-accent/10', border: 'border-amber-accent/40' },
  consumed: { label: 'CONSUMED', text: 'text-teal-accent', bg: 'bg-teal-accent/10', border: 'border-teal-accent/40' },
  expired: { label: 'EXPIRED UNCONSUMED', text: 'text-ink-400', bg: 'bg-ink-700/50', border: 'border-ink-500/50' },
};
