import { describe, it, expect } from 'vitest';
import tokens from '../tokens.json';
import tailwind from '../../../tailwind.config.js';
import { CLASSIFICATION_TAG, nodePaint, PROVENANCE_BADGE, RAW, RELATION_STYLE_HEX } from '@/scenes/renderers/palette';
import type { SceneNodeClassification } from '@/scenes/types';

/** WCAG 2.x relative luminance and contrast ratio. */
const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
};
const contrast = (a: string, b: string) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

const surfaces = ['0', '1', '2', '3'] as const;

describe('contrast floor (4.5:1) for everything that carries information', () => {
  const informational: [string, string][] = [
    ['fg-1', tokens.fg['1']], ['fg-2', tokens.fg['2']], ['fg-3', tokens.fg['3']],
    ['OBS', tokens.provenance.OBS], ['REP', tokens.provenance.REP], ['DER', tokens.provenance.DER], ['N/A', tokens.provenance.NA],
    ['attention', tokens.attention], ['fault', tokens.fault], ['select', tokens.select],
  ];
  for (const [name, hex] of informational) {
    for (const s of surfaces) {
      it(`${name} on surface-${s}`, () => {
        expect(contrast(hex, tokens.surface[s])).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it('fg-4 is decorative only: it is allowed to fall below the floor, and is never used for text that carries information', () => {
    expect(contrast(tokens.fg['4'], tokens.surface['1'])).toBeLessThan(4.5);
  });
});

describe('hue is spent on one job', () => {
  it('the four provenance classes are four different colours', () => {
    expect(new Set(Object.values(tokens.provenance)).size).toBe(4);
  });

  it('attention and fault are not provenance colours, and selection is neutral (it is not a provenance hue)', () => {
    const prov = new Set(Object.values(tokens.provenance));
    expect(prov.has(tokens.attention)).toBe(false);
    expect(prov.has(tokens.fault)).toBe(false);
    expect(prov.has(tokens.select)).toBe(false);
    expect(tokens.attention).not.toBe(tokens.fault);
  });

  it('selection is nearly colourless (a warm ivory), so choosing something never changes what it looks like', () => {
    const n = parseInt(tokens.select.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(24);
  });
});

describe('one source of truth', () => {
  it('Tailwind and the renderer palette both read the provenance colours from tokens.json', () => {
    const colors = (tailwind.theme as { extend: { colors: Record<string, string> } }).extend.colors;
    expect(colors.obs).toBe(tokens.provenance.OBS);
    expect(colors.rep).toBe(tokens.provenance.REP);
    expect(colors.der).toBe(tokens.provenance.DER);
    expect(colors.na).toBe(tokens.provenance.NA);
    expect(PROVENANCE_BADGE.observed.color).toBe(colors.obs);
    expect(PROVENANCE_BADGE.reported.color).toBe(colors.rep);
    // The drift this replaces: the renderer palette painted DER red while the UI painted it amber.
    expect(PROVENANCE_BADGE.derived.color).toBe(colors.der);
    expect(PROVENANCE_BADGE['not-applicable'].color).toBe(colors.na);
    expect(RAW.fault).toBe(colors.fault);
  });
});

describe('lineage node styles keep the epistemic kinds visibly apart', () => {
  const kinds = Object.keys(CLASSIFICATION_TAG) as SceneNodeClassification[];
  const sig = (k: SceneNodeClassification, selected = false, dimmed = false) => {
    const p = nodePaint(k, { selected, dimmed });
    return JSON.stringify([p.fill, p.stroke, p.hollow]);
  };

  it('every classification has its own resting style', () => {
    expect(new Set(kinds.map((k) => sig(k))).size).toBe(kinds.length);
  });

  it('a replay is not a continuation (they used to share one blue)', () => {
    expect(CLASSIFICATION_TAG.replay.color).not.toBe(CLASSIFICATION_TAG.continuation.color);
    expect(sig('replay')).not.toBe(sig('continuation'));
  });

  it('a simulated projection is hollow and shares no style with a trial or a baseline', () => {
    expect(nodePaint('simulated-projection', { selected: false, dimmed: false }).hollow).toBe(true);
    for (const k of ['baseline', 'trial', 'continuation', 'replay'] as const) {
      expect(nodePaint(k, { selected: false, dimmed: false }).hollow).toBe(false);
      expect(sig('simulated-projection')).not.toBe(sig(k));
    }
    expect(nodePaint('simulated-projection', { selected: false, dimmed: false }).fill.alpha).toBeLessThan(0.2);
  });

  it('a selected simulated projection stays hollow and tinted: selection must not erase what the node is', () => {
    const sim = nodePaint('simulated-projection', { selected: true, dimmed: false });
    const trial = nodePaint('trial', { selected: true, dimmed: false });
    expect(sim.hollow).toBe(true);
    expect(sim.fill.alpha).toBeLessThan(0.2);
    expect(sim.fill.hex).toBe(CLASSIFICATION_TAG['simulated-projection'].color);
    expect(sim.fill.hex).not.toBe(trial.fill.hex);
    expect(trial.fill.alpha).toBe(1);
  });

  it('selection outlines every classification in the same neutral ivory', () => {
    for (const k of kinds) expect(nodePaint(k, { selected: true, dimmed: false }).stroke.hex).toBe(tokens.select);
  });

  it('dimming lowers opacity and never changes hue', () => {
    for (const k of kinds) {
      const on = nodePaint(k, { selected: false, dimmed: false });
      const off = nodePaint(k, { selected: false, dimmed: true });
      expect(off.stroke.hex).toBe(on.stroke.hex);
      expect(off.stroke.alpha).toBeLessThan(on.stroke.alpha);
    }
  });

  it('the WebGL backend draws edges undashed, so no two relations may share a colour', () => {
    const strokes = Object.values(RELATION_STYLE_HEX).map((r) => r.stroke);
    expect(new Set(strokes).size).toBe(strokes.length);
  });

  it('relations avoid the evidence hues, except the simulated branch, which is a derived projection by definition', () => {
    const prov = new Set(Object.values(tokens.provenance));
    for (const [rel, style] of Object.entries(RELATION_STYLE_HEX)) {
      if (rel === 'simulated_branch') expect(style.stroke).toBe(tokens.provenance.DER);
      else expect(prov.has(style.stroke)).toBe(false);
    }
  });
});

describe('fg-4 is for graphics, never for words', () => {
  // fg-4 is below the 4.5:1 text floor (see above), so it may only colour non-text marks. Each use below was reviewed and is an
  // icon or a drawn shape that has its own text label beside it. A new use fails here until it is reviewed and listed.
  const reviewed: Record<string, number> = {
    'src/components/observe/EventInspector.tsx': 1, // arrow between a relation and its target
    'src/components/evolve/CandidatesSection.tsx': 1, // the dashed ring of a gate with no record (labelled "no record")
    'src/components/evolve/CheckpointsSection.tsx': 1, // the hollow square of an unsupported continuation (labelled)
    'src/components/observe/TrajectoryOverview.tsx': 1, // the marker of an event with no evidence items (shape, tooltip)
  };

  it('is used as text colour only where it was reviewed', () => {
    // Vite reads the sources as raw strings; no Node types needed.
    const sources = import.meta.glob(['/src/**/*.{ts,tsx}', '!/src/**/__tests__/**'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const found: Record<string, number> = {};
    for (const [file, text] of Object.entries(sources)) {
      const n = (text.match(/text-fg-4/g) ?? []).length;
      if (n > 0) found[file.replace(/^\//, '')] = n;
    }
    expect(found).toEqual(reviewed);
  });
});

/** OKLab: a perceptually uniform space, so Euclidean distance approximates how different two colours LOOK. */
const oklab = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = [lin((n >> 16) & 255), lin((n >> 8) & 255), lin(n & 255)];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
};
const deltaE = (a: string, b: string) => Math.hypot(...oklab(a).map((v, i) => v - oklab(b)[i]));
const minPair = (colours: Record<string, string>) => {
  const e = Object.entries(colours);
  let worst = { d: Infinity, pair: '' };
  for (let i = 0; i < e.length; i++) for (let j = i + 1; j < e.length; j++) {
    const d = deltaE(e[i][1], e[j][1]);
    if (d < worst.d) worst = { d, pair: `${e[i][0]} / ${e[j][0]}` };
  }
  return worst;
};

describe('distinguishable, not merely distinct (OKLab ΔE ≥ 0.08)', () => {
  // The WebGL backend draws every edge solid, so there a relation is told apart by colour alone. Six unique hex values can still
  // be near-identical greys; this holds the whole set to a perceptual floor.
  it('the six lineage relations', () => {
    const w = minPair(tokens.relation);
    expect(w.d, w.pair).toBeGreaterThanOrEqual(0.08);
  });

  it('the five execution kinds', () => {
    const w = minPair(tokens.classification);
    expect(w.d, w.pair).toBeGreaterThanOrEqual(0.08);
  });

  it('the hued relations keep clear of the provenance, attention and fault colours they must not be mistaken for', () => {
    const reserved = { ...tokens.provenance, attention: tokens.attention, fault: tokens.fault };
    for (const rel of ['candidate_of', 'evaluated_against', 'replay_of'] as const) {
      for (const [name, hex] of Object.entries(reserved)) {
        if (name === 'NA') continue; // slate grey: neutral relations are meant to sit near it
        expect(deltaE(tokens.relation[rel], hex), `${rel} vs ${name}`).toBeGreaterThanOrEqual(0.07);
      }
    }
  });
});
