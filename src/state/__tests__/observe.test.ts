import { describe, it, expect } from 'vitest';
import { sessions } from '@/data/fixtures';
import type { EventCategory, EventStatus, EvidenceKind, TrajectoryEvent } from '@/domain/types';
import {
  categoryCounts, evidenceMix, filterEvents, filtersActive, formatOffset, matchesFilters, NO_FILTERS, referencedBy, stepVisible,
} from '../observe';
import { bestEvidence, evidenceMeta } from '../meta';

const withFilters = (over: Partial<{ query: string; categories: EventCategory[]; statuses: EventStatus[]; evidence: EvidenceKind[] }>) => ({
  query: over.query ?? '',
  categories: new Set(over.categories ?? []),
  statuses: new Set(over.statuses ?? []),
  evidence: new Set(over.evidence ?? []),
});

describe('stepVisible: j/k walk only the events being shown', () => {
  const events = sessions[0].events;

  it('moves within the visible list, in storage order', () => {
    expect(stepVisible(events, events[2].id, 1)?.id).toBe(events[3].id);
    expect(stepVisible(events, events[2].id, -1)?.id).toBe(events[1].id);
  });

  it('never lands on an event the filters hide', () => {
    const tools = filterEvents(sessions[0], withFilters({ categories: ['tool'] }));
    expect(tools.length).toBeGreaterThan(1);
    const next = stepVisible(tools, tools[0].id, 1);
    expect(next?.id).toBe(tools[1].id);
    expect(next?.category).toBe('tool');
    // Stepping from a selection that the filters now hide enters the visible list at its end, never in the hidden gap.
    const hidden = events.find((e) => e.category !== 'tool')!;
    expect(stepVisible(tools, hidden.id, 1)?.id).toBe(tools[0].id);
    expect(stepVisible(tools, hidden.id, -1)?.id).toBe(tools[tools.length - 1].id);
  });

  it('stops at the ends instead of wrapping', () => {
    expect(stepVisible(events, events[0].id, -1)).toBeNull();
    expect(stepVisible(events, events[events.length - 1].id, 1)).toBeNull();
  });

  it('with nothing selected, forward enters at the start and back at the end', () => {
    expect(stepVisible(events, null, 1)?.id).toBe(events[0].id);
    expect(stepVisible(events, null, -1)?.id).toBe(events[events.length - 1].id);
  });

  it('is null for an empty list', () => {
    expect(stepVisible([], null, 1)).toBeNull();
    expect(stepVisible([], 'x', -1)).toBeNull();
  });
});

describe('filters', () => {
  it('default to inactive and match everything', () => {
    expect(filtersActive(NO_FILTERS)).toBe(false);
    for (const s of sessions) expect(filterEvents(s, NO_FILTERS)).toHaveLength(s.events.length);
  });

  it('match an event by its strongest evidence class, and an event with no evidence matches none of the classes', () => {
    for (const s of sessions) {
      for (const e of s.events) {
        const best = bestEvidence(e.evidence);
        for (const k of ['OBS', 'REP', 'DER', 'NA'] as const) {
          expect(matchesFilters(e, withFilters({ evidence: [k] }))).toBe(best === k);
        }
      }
    }
    const bare = { ...sessions[0].events[0], evidence: [] } as TrajectoryEvent;
    expect(matchesFilters(bare, withFilters({ evidence: ['OBS', 'REP', 'DER', 'NA'] }))).toBe(false);
  });

  it('search covers title, kind, tool, summary and field values, ignoring case', () => {
    const e = sessions[0].events.find((x) => x.tool)!;
    expect(matchesFilters(e, withFilters({ query: e.tool!.toUpperCase() }))).toBe(true);
    expect(matchesFilters(e, withFilters({ query: 'zzz-not-present-anywhere' }))).toBe(false);
  });

  it('combine with AND across groups and OR within one', () => {
    const s = sessions[1];
    const errorsOrPartial = filterEvents(s, withFilters({ statuses: ['error', 'partial'] }));
    expect(errorsOrPartial.every((e) => e.status !== 'ok')).toBe(true);
    const toolErrors = filterEvents(s, withFilters({ statuses: ['error'], categories: ['tool'] }));
    expect(toolErrors.every((e) => e.status === 'error' && e.category === 'tool')).toBe(true);
  });
});

describe('tallies are tallies of real records', () => {
  it('evidence mix and category counts sum to the number of events, and missing evidence is counted apart', () => {
    for (const s of sessions) {
      const mix = evidenceMix(s.events);
      const total = (Object.values(mix.counts) as number[]).reduce((a, b) => a + b, 0) + mix.none;
      expect(total).toBe(s.events.length);
      expect((Object.values(categoryCounts(s.events)) as number[]).reduce((a, b) => a + b, 0)).toBe(s.events.length);
    }
    const noEvidence = { ...sessions[0].events[0], evidence: [] } as TrajectoryEvent;
    expect(evidenceMix([noEvidence])).toEqual({ counts: { OBS: 0, REP: 0, DER: 0, NA: 0 }, none: 1 });
  });

  it('referencedBy is exactly the reverse of the recorded refs', () => {
    const s = sessions[1];
    const forward = s.events.flatMap((e) => (e.refs ?? []).map((r) => `${e.id}>${r.target}:${r.relation}`));
    const backward = s.events.flatMap((e) => referencedBy(s, e.id).map((x) => `${x.from.id}>${e.id}:${x.relation}`));
    expect(backward.sort()).toEqual(forward.filter((f) => s.events.some((e) => f.includes(`>${e.id}:`))).sort());
  });
});

describe('formatOffset', () => {
  it('shows recorded offsets as written, in seconds then minutes', () => {
    expect(formatOffset(0)).toBe('+0.0s');
    expect(formatOffset(11400)).toBe('+11.4s');
    expect(formatOffset(62000)).toBe('+1m02s');
  });
});

describe('evidence order', () => {
  it('ranks observed above reported above derived above unavailable', () => {
    const r = (k: EvidenceKind) => evidenceMeta[k].rank;
    expect(r('OBS')).toBeGreaterThan(r('REP'));
    expect(r('REP')).toBeGreaterThan(r('DER'));
    expect(r('DER')).toBeGreaterThan(r('NA'));
  });
});
