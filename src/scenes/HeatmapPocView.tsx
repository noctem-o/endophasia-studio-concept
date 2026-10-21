import { useMemo } from 'react';
import type { HeatmapScene } from './heatmapPoc';

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
