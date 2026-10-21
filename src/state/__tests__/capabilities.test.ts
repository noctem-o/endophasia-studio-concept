import { describe, it, expect } from 'vitest';
import { sessions } from '@/data/fixtures';
import { backing, citedSources, exercisePositions, exercisedBy } from '../capabilities';

describe('capability matrix derivations', () => {
  it('every evidence item of every capability lands in exactly one backing class', () => {
    for (const s of sessions) for (const c of s.capabilities) {
      const b = backing(c);
      expect(b.declared.length + b.observed.length + b.derived.length + b.unavailable.length).toBe(c.evidence.length);
    }
  });

  it('a capability that was never exercised is not backed by observed evidence in any session where no event used it', () => {
    for (const s of sessions) for (const c of s.capabilities) {
      if (exercisedBy(s, c).length === 0 && c.status === 'unverified') expect(backing(c).observed, `${s.id} ${c.name}`).toEqual([]);
    }
  });

  it('exercised events are exactly those named by tool or kind, and are in storage order', () => {
    for (const s of sessions) for (const c of s.capabilities) {
      const ev = exercisedBy(s, c);
      for (const e of ev) expect(e.tool === c.name || e.kind === c.name).toBe(true);
      expect(ev.map((e) => e.seq)).toEqual([...ev.map((e) => e.seq)].sort((a, b) => a - b));
    }
  });

  it('positions lie within 0..1 and follow storage order', () => {
    const s = sessions[0];
    const cap = s.capabilities.find((c) => exercisedBy(s, c).length > 1)!;
    const pos = exercisePositions(s, exercisedBy(s, cap));
    for (const p of pos) { expect(p).toBeGreaterThanOrEqual(0); expect(p).toBeLessThanOrEqual(1); }
    expect(pos).toEqual([...pos].sort((a, b) => a - b));
  });

  it('cited sources are ids that exist in the session ledger, or are reported as such', () => {
    for (const s of sessions) for (const c of s.capabilities) {
      for (const id of citedSources(c)) expect(s.sources.some((x) => x.id === id), `${s.id}/${c.name} cites ${id}`).toBe(true);
    }
  });
});
