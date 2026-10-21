import type { EventCategory, EventStatus, EvidenceKind, Session, TrajectoryEvent } from '../domain/types';
import { bestEvidence } from './meta';

export interface EventFilters {
  query: string;
  categories: ReadonlySet<EventCategory>;
  statuses: ReadonlySet<EventStatus>;
  /** Matches an event by its strongest evidence class. An event with no evidence items matches none of them. */
  evidence: ReadonlySet<EvidenceKind>;
}

export const NO_FILTERS: EventFilters = { query: '', categories: new Set(), statuses: new Set(), evidence: new Set() };

export function filtersActive(f: EventFilters): boolean {
  return f.query.trim() !== '' || f.categories.size > 0 || f.statuses.size > 0 || f.evidence.size > 0;
}

export function matchesFilters(e: TrajectoryEvent, f: EventFilters): boolean {
  if (f.categories.size && !f.categories.has(e.category)) return false;
  if (f.statuses.size && !f.statuses.has(e.status)) return false;
  if (f.evidence.size) {
    const best = bestEvidence(e.evidence);
    if (best === null || !f.evidence.has(best)) return false;
  }
  const q = f.query.trim().toLowerCase();
  if (q) {
    const hay = [e.title, e.kind, e.tool ?? '', e.summary, ...e.fields.map((x) => x.value)].join(' ').toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

export function filterEvents(session: Session, f: EventFilters): TrajectoryEvent[] {
  return session.events.filter((e) => matchesFilters(e, f));
}

/**
 * The neighbour of `currentId` within `visible` (the filtered list the user is actually looking at), `delta` steps away.
 * With nothing selected, +1 yields the first visible event and -1 the last. Returns null when `visible` is empty or the step
 * would leave the list — it never lands on an event the filters are hiding.
 */
export function stepVisible(visible: readonly TrajectoryEvent[], currentId: string | null, delta: 1 | -1): TrajectoryEvent | null {
  if (visible.length === 0) return null;
  const at = currentId === null ? -1 : visible.findIndex((e) => e.id === currentId);
  if (at === -1) return delta === 1 ? visible[0] : visible[visible.length - 1];
  const next = at + delta;
  return next < 0 || next >= visible.length ? null : visible[next];
}

/** Events tallied by their strongest evidence class. A tally of real records, not a score. `none` counts events with no evidence items. */
export function evidenceMix(events: readonly TrajectoryEvent[]): { counts: Record<EvidenceKind, number>; none: number } {
  const counts: Record<EvidenceKind, number> = { OBS: 0, REP: 0, DER: 0, NA: 0 };
  let none = 0;
  for (const e of events) {
    const best = bestEvidence(e.evidence);
    if (best === null) none++;
    else counts[best]++;
  }
  return { counts, none };
}

export function categoryCounts(events: readonly TrajectoryEvent[]): Record<EventCategory, number> {
  const out: Record<EventCategory, number> = { lifecycle: 0, context: 0, model: 0, tool: 0, verification: 0, intervention: 0 };
  for (const e of events) out[e.category]++;
  return out;
}

/** Events that other events point at through recorded `refs`, i.e. the reverse of an event's own relations. */
export function referencedBy(session: Session, eventId: string): { from: TrajectoryEvent; relation: string }[] {
  const out: { from: TrajectoryEvent; relation: string }[] = [];
  for (const e of session.events) for (const r of e.refs ?? []) if (r.target === eventId) out.push({ from: e, relation: r.relation });
  return out;
}

/** "+12.3s" / "+1m02s": recorded offset from session start, as written down — never rounded to look more precise. */
export function formatOffset(ms: number): string {
  const s = ms / 1000;
  if (s < 60) return `+${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `+${m}m${String(Math.floor(s % 60)).padStart(2, '0')}s`;
}
