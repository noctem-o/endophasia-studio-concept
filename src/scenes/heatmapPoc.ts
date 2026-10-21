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
