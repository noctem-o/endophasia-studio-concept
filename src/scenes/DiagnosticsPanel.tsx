import type { LineageScene } from './types';
import { MEASUREMENT_DEFINITIONS, type MeasurementBlock } from './renderers/measure';
import type { BackendId } from './renderers';
import { LOD_THRESHOLDS } from './interaction';
import type { LodTier } from './interaction';
import { HeatmapPocView } from './HeatmapPocView';
import type { HeatmapScene } from './heatmapPoc';
import { Button } from '@/ui/controls';

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[132px_minmax(0,1fr)] items-baseline gap-2">
      <dt className="text-fg-3">{k}</dt>
      <dd className="min-w-0 break-words text-fg-1">{v}</dd>
    </div>
  );
}

/** Rendering diagnostics. Only measured values appear here; anything not measured is listed with the reason, never estimated. */
export function DiagnosticsPanel({ backend, scene, visibleCount, lod, backendDetails, fps, measurements, onRun, heatmap }: {
  backend: BackendId;
  scene: LineageScene;
  visibleCount: number;
  lod: LodTier;
  backendDetails: string;
  fps: { median: number; min: number } | null | 'unmeasured';
  measurements: MeasurementBlock[];
  onRun: () => void;
  heatmap: HeatmapScene;
}) {
  return (
    <aside aria-label="Rendering diagnostics" className="w-[340px] shrink-0 space-y-3 overflow-y-auto scrollbar-thin border-l border-line bg-surface-1 p-3">
      <h2 className="eyebrow">Diagnostics — measured values only</h2>
      <dl className="space-y-1 font-mono text-2xs">
        <Row k="backend" v={backend} />
        <Row k="scene id" v={scene.sceneId} />
        <Row k="schema version" v={`v${scene.schemaVersion}`} />
        <Row k="nodes / edges" v={`${scene.nodes.length} / ${scene.edges.length}`} />
        <Row k="nodes visible (filter)" v={String(visibleCount)} />
        <Row k="lod tier" v={`${lod} (full ≥ ${LOD_THRESHOLDS.full}, labels ≥ ${LOD_THRESHOLDS.labels})`} />
        <Row k="device pixel ratio" v={String(window.devicePixelRatio || 1)} />
        <Row k="backend details" v={backendDetails || 'not reported'} />
        <Row k="rAF cadence" v={fps === 'unmeasured' ? 'unmeasured — run a probe' : fps ? `${fps.median.toFixed(1)} median / ${fps.min.toFixed(1)} worst (rAF interval, not GPU time)` : 'unavailable (no rAF loop)'} />
      </dl>

      <Button onClick={onRun} className="w-full justify-center">run measurement pass on all scenes ({backend})</Button>

      {measurements.length === 0 ? (
        <p className="text-2xs leading-relaxed text-fg-3">
          No measurements recorded yet. Figures appear here only after a measurement pass — nothing is estimated, carried over, or invented.
        </p>
      ) : (
        <div className="space-y-2">
          {measurements.map((m) => (
            <div key={`${m.backendId}-${m.nodeCount}`} className="rounded-ctl border border-line bg-surface-2 p-2">
              <div className="font-mono text-2xs text-fg-1">{m.nodeCount} nodes · {m.edgeCount} edges</div>
              {m.timings.map((t) => (
                <div key={t.kind} className="mt-1 font-mono text-2xs text-fg-3">
                  {t.kind}: <span className="text-fg-1 tnum">{t.medianMs.toFixed(2)} ms</span>
                  <span className="text-fg-3 tnum"> [{t.minMs.toFixed(2)}–{t.maxMs.toFixed(2)}, n={t.runs}]</span>
                </div>
              ))}
              {m.unmeasured.map((u) => (
                <div key={u.kind} className="mt-0.5 font-mono text-2xs text-fg-3">{u.kind}: unmeasured — {u.reason}</div>
              ))}
            </div>
          ))}
          <p className="text-2xs leading-relaxed text-fg-3">
            Medians over 7 timed runs after 3 warm-up runs, performance.now(). These are main-thread CPU submission costs — they do not include GPU execution time, which the main thread cannot observe. Runs are in-page and untuned; treat small differences as noise.
          </p>
        </div>
      )}

      <section aria-label="What each figure is" className="border-t border-line pt-3">
        <h3 className="eyebrow">What each figure is</h3>
        <dl className="mt-2 space-y-2">
          {MEASUREMENT_DEFINITIONS.map((d) => (
            <div key={d.prefix}>
              <dt className="font-mono text-2xs text-fg-1">{d.prefix}</dt>
              <dd className="text-2xs leading-relaxed text-fg-3">{d.is} <span className="text-fg-2">It is {d.isNot}</span></dd>
            </div>
          ))}
          <div>
            <dt className="font-mono text-2xs text-fg-1">GPU execution · frame-present latency</dt>
            <dd className="text-2xs leading-relaxed text-fg-3">Never measured. The main thread cannot observe either, and a software-rendered run says nothing about hardware.</dd>
          </div>
        </dl>
      </section>

      <h3 className="border-t border-line pt-3 eyebrow">Scene PoC — heatmap</h3>
      <HeatmapPocView scene={heatmap} />
    </aside>
  );
}
