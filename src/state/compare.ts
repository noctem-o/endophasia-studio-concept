import type { TrajectoryEvent } from '../domain/types';
import type { AlignmentClass } from '../analysis/compare';
import { bestEvidence, evidenceMeta } from './meta';

/** The fields the alignment methodology compares. Anything else is not compared, and nothing here pretends otherwise. */
export const COMPARED_FIELDS = ['tool', 'path', 'cmd'] as const;

export type LinkClass = AlignmentClass['type'];

export interface FieldComparison {
  field: (typeof COMPARED_FIELDS)[number];
  a: string | null;
  b: string | null;
  /** True when both sides record the same value, or neither records one. */
  same: boolean;
  /** True when at least one side recorded a value: a field nobody recorded was not compared at all. */
  compared: boolean;
}

export interface Difference {
  aspect: 'status' | 'evidence' | 'field';
  label: string;
  a: string;
  b: string;
}

export interface MapLink {
  /** Index in the alignment, stable for a given pair of sessions. */
  index: number;
  cls: LinkClass;
  a: TrajectoryEvent | null;
  b: TrajectoryEvent | null;
  differences: Difference[];
}

const fieldOf = (e: TrajectoryEvent | null, key: string): string | null => (e ? (e.fields.find((x) => x.key === key)?.value ?? null) : null);

export function compareFields(a: TrajectoryEvent | null, b: TrajectoryEvent | null): FieldComparison[] {
  return COMPARED_FIELDS.map((field) => {
    const va = fieldOf(a, field);
    const vb = fieldOf(b, field);
    return { field, a: va, b: vb, same: va === vb, compared: va !== null || vb !== null };
  });
}

/**
 * What genuinely differs across a link, as recorded: status, strongest evidence class, and any compared field. Nothing is
 * scored or weighted, and an exact link is allowed to have differences (an exact match says only that the compared fields agree).
 * Kind never differs on a link (alignment pairs only the same kind).
 */
export function differencesOf(a: TrajectoryEvent | null, b: TrajectoryEvent | null): Difference[] {
  if (!a || !b) return [];
  const out: Difference[] = [];
  if (a.status !== b.status) out.push({ aspect: 'status', label: 'status', a: a.status, b: b.status });
  const ea = bestEvidence(a.evidence);
  const eb = bestEvidence(b.evidence);
  if (ea !== eb) out.push({ aspect: 'evidence', label: 'strongest evidence', a: ea ? evidenceMeta[ea].label : 'none', b: eb ? evidenceMeta[eb].label : 'none' });
  for (const f of compareFields(a, b)) if (f.compared && !f.same) out.push({ aspect: 'field', label: f.field, a: f.a ?? 'not recorded', b: f.b ?? 'not recorded' });
  return out;
}

export function buildLinks(alignment: AlignmentClass[]): MapLink[] {
  return alignment.map((row, index) => {
    const a = row.type === 'unmatched-b' ? null : row.a;
    const b = row.type === 'unmatched-a' ? null : row.b;
    return { index, cls: row.type, a, b, differences: differencesOf(a, b) };
  });
}

export function classCounts(links: readonly MapLink[]): Record<LinkClass, number> {
  const c: Record<LinkClass, number> = { exact: 0, proposed: 0, 'unmatched-a': 0, 'unmatched-b': 0 };
  for (const l of links) c[l.cls]++;
  return c;
}

/** The link each event belongs to, by event id (an event is in exactly one alignment row). */
export function linkIndexByEvent(links: readonly MapLink[]): Map<string, MapLink> {
  const m = new Map<string, MapLink>();
  for (const l of links) {
    if (l.a) m.set(l.a.id, l);
    if (l.b) m.set(l.b.id, l);
  }
  return m;
}
