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
      // teal ramp: low = ink-800, high = teal
      const t = Math.round(v * 255);
      const bg = `rgba(45, 212, 191, ${(v * 0.85 + 0.05).toFixed(2)})`;
      return { key: `${r}-${c}`, r, c, v, bg, text: t > 140 ? '#0A0E12' : '#D3DBE6' };
    });
  }, [scene]);

  return (
    <div>
      <div className="grid gap-px" style={{ gridTemplateColumns: `64px repeat(${scene.columns}, minmax(0, 1fr))` }}>
        <div />
        {scene.columnLabels.map((cl) => (
          <div key={cl} className="pb-1 text-center font-mono text-[8px] text-ink-500">{cl}</div>
        ))}
        {cells.map((cell) => (
          <div key={cell.key} className="contents">
            {cell.c === 0 && (
              <div className="pr-1 text-right font-mono text-[8px] leading-5 text-ink-500">{scene.rowLabels[cell.r]}</div>
            )}
            <div
              className="flex h-5 items-center justify-center font-mono text-[7px]"
              style={{ background: cell.bg, color: cell.text }}
              title={`row ${cell.r + 1}, col ${cell.c + 1}: ${cell.v.toFixed(3)} (synthetic)`}
            >
              {cell.v.toFixed(2)}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-2xs leading-relaxed text-ink-500">
        proof-of-concept only: values are digest-derived synthetic fixtures, not measured data. Demonstrates scene → color-grid projection for future OBSERVE/DREAM scenes.
      </p>
    </div>
  );
}
