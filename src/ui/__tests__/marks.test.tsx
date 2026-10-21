// @vitest-environment jsdom
// Shape families. Provenance is circles and a diamond; capability status and source condition are squares (and a triangle for a
// mismatch). They share rows and screens, so a filled disc must mean OBSERVED and nothing else, and a half disc REPORTED.
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { CapabilityGlyph, ProvGlyph, SourceGlyph } from '../marks';
import type { CapabilityStatus, EvidenceKind, SourceCondition } from '../../domain/types';

afterEach(cleanup);
const CAPS: CapabilityStatus[] = ['admitted', 'partially-admitted', 'unverified', 'mismatched', 'unavailable'];
const SOURCES: SourceCondition[] = ['readable', 'empty', 'absent', 'degraded', 'unopenable'];
const PROV: EvidenceKind[] = ['OBS', 'REP', 'DER', 'NA'];

describe('capability and source marks are never drawn in the provenance family', () => {
  it.each(CAPS)('capability %s has no circle', (status) => {
    const { container } = render(<CapabilityGlyph status={status} />);
    expect(container.querySelector('circle')).toBeNull();
  });
  it.each(SOURCES)('source %s has no circle', (c) => {
    const { container } = render(<SourceGlyph condition={c} />);
    expect(container.querySelector('circle')).toBeNull();
  });
  it('and every provenance class is a circle or the diamond, so the two families cannot be confused', () => {
    for (const k of PROV) {
      const { container, unmount } = render(<ProvGlyph kind={k} />);
      const hasCircle = container.querySelector('circle') !== null;
      const hasDiamond = container.querySelector('path[d^="M6 1 11 6"]') !== null;
      expect(hasCircle || hasDiamond, k).toBe(true);
      unmount();
    }
  });
  it('the shapes within each family are pairwise different', () => {
    const sig = (n: Element) => n.innerHTML.replace(/<title>.*?<\/title>/, '');
    const caps = CAPS.map((s) => sig(render(<CapabilityGlyph status={s} />).container.firstElementChild!));
    expect(new Set(caps).size).toBe(CAPS.length);
    const prov = PROV.map((k) => sig(render(<ProvGlyph kind={k} />).container.firstElementChild!));
    expect(new Set(prov).size).toBe(PROV.length);
  });
});
