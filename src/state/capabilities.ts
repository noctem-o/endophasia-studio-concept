import type { Capability, EvidenceItem, EvidenceKind, Session, TrajectoryEvent } from '../domain/types';

/** Events of a session that exercised a capability: by tool name or event kind, exactly as the capability is named. */
export function exercisedBy(session: Session, cap: Capability): TrajectoryEvent[] {
  return session.events.filter((e) => e.tool === cap.name || e.kind === cap.name);
}

/**
 * What actually backs the two columns of the matrix. "Declared" is a statement by the runtime, so it is backed by REPORTED
 * evidence; "observed" is backed by OBSERVED evidence. A mark is only drawn when an item of that class exists: a capability that
 * was never exercised has no observed evidence, and the matrix must not colour that cell as if it did.
 */
export function backing(cap: Capability): { declared: EvidenceItem[]; observed: EvidenceItem[]; derived: EvidenceItem[]; unavailable: EvidenceItem[] } {
  const of = (k: EvidenceKind) => cap.evidence.filter((e) => e.kind === k);
  return { declared: of('REP'), observed: of('OBS'), derived: of('DER'), unavailable: of('NA') };
}

/** Source ids a capability's evidence cites. */
export function citedSources(cap: Capability): Set<string> {
  return new Set(cap.evidence.map((e) => e.sourceId).filter((s): s is string => typeof s === 'string'));
}

/** Position of each exercising event along the trajectory, 0..1 by storage order (a single event sits at 0.5). */
export function exercisePositions(session: Session, events: readonly TrajectoryEvent[]): number[] {
  const n = session.events.length;
  return events.map((e) => {
    const i = session.events.findIndex((x) => x.id === e.id);
    return n <= 1 ? 0.5 : i / (n - 1);
  });
}
