import { describe, it, expect } from 'vitest';
import { sessions } from '@/data/fixtures';
import { alignTrajectories } from '@/analysis/compare';
import { buildLinks, classCounts, compareFields, differencesOf, linkIndexByEvent } from '../compare';
import type { TrajectoryEvent } from '@/domain/types';

const get = (id: string) => sessions.find((s) => s.id === id)!;
const A = get('run-3f92c1');
const C = get('run-6c07e4');

describe('links over an alignment', () => {
  const links = buildLinks(alignTrajectories(A.events, C.events));

  it('every event of both trajectories sits on exactly one link', () => {
    const idx = linkIndexByEvent(links);
    for (const e of [...A.events, ...C.events]) expect(idx.has(e.id), e.id).toBe(true);
    const total = links.reduce((n, l) => n + (l.a ? 1 : 0) + (l.b ? 1 : 0), 0);
    expect(total).toBe(A.events.length + C.events.length);
  });

  it('class counts add up to the number of links, and unmatched links carry one side only', () => {
    const c = classCounts(links);
    expect(c.exact + c.proposed + c['unmatched-a'] + c['unmatched-b']).toBe(links.length);
    for (const l of links) {
      if (l.cls === 'unmatched-a') expect(l.a !== null && l.b === null).toBe(true);
      if (l.cls === 'unmatched-b') expect(l.a === null && l.b !== null).toBe(true);
      if (l.cls === 'exact' || l.cls === 'proposed') expect(l.a !== null && l.b !== null).toBe(true);
    }
  });

  it('an exact match agrees on every compared field it records; it may still differ elsewhere, and says so', () => {
    for (const l of links.filter((x) => x.cls === 'exact')) {
      expect(compareFields(l.a, l.b).every((f) => f.same)).toBe(true);
      expect(l.differences.every((d) => d.aspect !== 'field')).toBe(true);
    }
  });

  it('a link never reports a difference that is not in the records', () => {
    for (const l of links) {
      for (const d of l.differences) {
        if (d.aspect === 'status') { expect(l.a!.status).toBe(d.a); expect(l.b!.status).toBe(d.b); }
        if (d.aspect === 'field') expect(d.a === d.b).toBe(false);
      }
    }
  });

  it('is deterministic', () => {
    expect(buildLinks(alignTrajectories(A.events, C.events))).toEqual(links);
  });
});

describe('differencesOf', () => {
  const base = A.events.find((e) => e.tool)!;
  const clone = (over: Partial<TrajectoryEvent>): TrajectoryEvent => ({ ...base, ...over });

  it('is empty for identical records, and for a missing side', () => {
    expect(differencesOf(base, clone({}))).toEqual([]);
    expect(differencesOf(base, null)).toEqual([]);
    expect(differencesOf(null, base)).toEqual([]);
  });

  it('reports a status difference and a strongest-evidence difference', () => {
    expect(differencesOf(base, clone({ status: 'error' })).map((d) => d.aspect)).toEqual(['status']);
    const none = differencesOf(base, clone({ evidence: [] }));
    expect(none.find((d) => d.aspect === 'evidence')?.b).toBe('none');
  });

  it('does not count a field that neither side recorded as compared, and does not call an absent value equal to a present one', () => {
    const noFields = clone({ fields: [] });
    expect(compareFields(noFields, noFields).every((f) => !f.compared && f.same)).toBe(true);
    expect(differencesOf(base, noFields).some((d) => d.aspect === 'field' && d.b === 'not recorded')).toBe(base.fields.some((f) => ['tool', 'path', 'cmd'].includes(f.key)));
  });
});
