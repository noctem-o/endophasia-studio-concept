import { useMemo } from 'react';
import { fnv1a } from './digest';

/**
 * Heatmap proof-of-concept for future OBSERVE/DREAM scenes.
 * Deterministic synthetic values from a stable digest — explicitly NOT
 * measured data. Demonstrates only that a scene of cells can be projected to
 * a color grid with no renderer coupling.
 */

export interface HeatmapScene {
  kind: 'heatmap-scene-poc';
  schemaVersion: 1;
  rows: number;
  columns: number;
  /** Deterministic value in [0,1] per cell, derived from row/col digest. */
  values: number[];
  rowLabels: string[];
  columnLabels: string[];
}

export function makeHeatmapPoc(rows = 8, columns = 12): HeatmapScene {
  const values: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const digest = fnv1a(`poc:${r}:${c}`);
      values.push(parseInt(digest.slice(0, 4), 16) / 0xffff);
    }
  }
  return {
    kind: 'heatmap-scene-poc',
    schemaVersion: 1,
    rows,
    columns,
    values,
    rowLabels: Array.from({ length: rows }, (_, i) => `row-${i + 1}`),
    columnLabels: Array.from({ length: columns }, (_, i) => `col-${i + 1}`),
  };
}

export function HeatmapPocView({ scene }: { scene: HeatmapScene }) {
  const cells = useMemo(() => {
    return scene.values.map((v, i) => {
      const r = Math.floor(i / scene.columns);
      const c = i % scene.columns;
      // A neutral ivory ramp: the values are synthetic, so they take no provenance hue (teal would read as "observed").
      const bg = `rgba(236, 232, 223, ${(v * 0.7 + 0.04).toFixed(2)})`;
      return { key: `${r}-${c}`, r, c, v, bg };
    });
  }, [scene]);

  return (
    <div>
      <div className="hatch-faint grid gap-px rounded-ctl border border-line p-1" style={{ gridTemplateColumns: `56px repeat(${scene.columns}, minmax(0, 1fr))` }}>
        <div />
        {scene.columnLabels.map((cl) => (
          <div key={cl} className="pb-1 text-center font-mono text-[9px] text-fg-3">{cl.replace('col-', '')}</div>
        ))}
        {cells.map((cell) => (
          <div key={cell.key} className="contents">
            {cell.c === 0 && (
              <div className="pr-1.5 text-right font-mono text-2xs leading-5 text-fg-3">{scene.rowLabels[cell.r]}</div>
            )}
            <div
              className="h-5 rounded-[1px]"
              style={{ background: cell.bg }}
              title={`row ${cell.r + 1}, col ${cell.c + 1}: ${cell.v.toFixed(3)} (synthetic)`}
            />
          </div>
        ))}
      </div>
      <p className="mt-2 text-2xs leading-relaxed text-fg-3">
        Proof of concept only: values are digest-derived synthetic fixtures, not measured data (hover a cell for its value). Demonstrates scene → colour-grid projection for future OBSERVE/DREAM scenes.
      </p>
    </div>
  );
}
