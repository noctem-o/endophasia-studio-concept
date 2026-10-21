import type { LineageScene } from '../types';

/**
 * Honest measurement harness. Every figure this module produces comes from
 * `performance.now()` around the declared operation, run on the stated scene.
 * Anything not measured is reported as unmeasured — never estimated, never
 * extrapolated, never carried over from another backend.
 *
 * Protocol per measurement:
 * - WARMUP_RUNS untimed runs (compilation, layout, GC settle).
 * - MEASURED_RUNS timed runs; the reported value is the median (robust to a
 *   single GC pause) plus min and max, shown in the UI so the spread is
 *   visible. Nothing is averaged away.
 */

const WARMUP_RUNS = 3;
const MEASURED_RUNS = 7;

export interface Timing {
  kind: string;
  medianMs: number;
  minMs: number;
  maxMs: number;
  runs: number;
}

export interface Unmeasured {
  kind: string;
  reason: string;
}

export interface MeasurementBlock {
  backendId: string;
  nodeCount: number;
  edgeCount: number;
  timings: Timing[];
  unmeasured: Unmeasured[];
  /** Whether FPS was actually measured with requestAnimationFrame on this run. */
  fpsMeasured: boolean;
  fps: { median: number; min: number } | null;
  measuredAt: string;
}

function runTimed(kind: string, op: () => void, warmup: number, runs: number): Timing {
  for (let i = 0; i < warmup; i++) op();
  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    op();
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  return {
    kind,
    medianMs: samples[Math.floor(samples.length / 2)],
    minMs: samples[0],
    maxMs: samples[samples.length - 1],
    runs,
  };
}

export interface SceneBuildOp {
  /** Build the scene from corpus (scene-contract cost). Null when only the
   * built scene is available — the metric is then reported unmeasured with
   * that reason rather than timing a no-op. */
  buildScene: (() => void) | null;
  /** Push a scene + initial viewport into a live renderer (scene upload cost). */
  pushScene: () => void;
  /** Push a viewport change into a live renderer (frame cost proxy). */
  pushViewport: () => void;
}

/**
 * Measure scene-build, scene-upload and viewport-apply costs. Frame rate is
 * measured only when a rAF loop is actually available and actually run —
 * otherwise it is reported unmeasured with the reason. A missing builder is
 * never timed as a no-op: the figure appears under unmeasured instead.
 */
export function measureRenderer(
  backendId: string,
  scene: LineageScene,
  op: SceneBuildOp,
): MeasurementBlock {
  const unmeasured: Unmeasured[] = [
    { kind: 'GPU frame time', reason: 'not measured: performance.now() on the main thread measures CPU submission cost only — it cannot observe GPU execution, and no GPU timer query was used' },
    { kind: 'frame-present latency', reason: 'not measured: rAF callback timing is not the compositor presenting the frame; the main thread cannot observe presentation' },
    { kind: 'memory footprint', reason: 'not measured: performance.memory is non-standard and absent in most browsers' },
    { kind: 'text overlay cost', reason: 'not measured for this block: overlay rendering is driven by the interaction layer, not the scene push' },
  ];

  const timings: Timing[] = [];
  if (op.buildScene) {
    timings.push(runTimed('scene build (corpus → scene)', op.buildScene, WARMUP_RUNS, MEASURED_RUNS));
  } else {
    unmeasured.push({
      kind: 'scene build (corpus → scene)',
      reason: 'not measured: this scene arrived already built and no builder was supplied, so there is no construction operation to time — timing a property lookup would be a fake measurement',
    });
  }
  timings.push(
    runTimed('scene upload (renderer.setScene)', op.pushScene, WARMUP_RUNS, MEASURED_RUNS),
    runTimed('viewport apply (renderer.setViewport)', op.pushViewport, WARMUP_RUNS, MEASURED_RUNS),
  );

  return {
    backendId,
    nodeCount: scene.nodes.length,
    edgeCount: scene.edges.length,
    timings,
    unmeasured,
    fpsMeasured: false,
    fps: null,
    measuredAt: new Date().toISOString(),
  };
}

/**
 * rAF-based FPS probe over a live renderer. Returns null if the loop cannot
 * run. Honesty note: this measures the interval between successive
 * requestAnimationFrame callbacks while the page is driven by the probe
 * itself — an upper-bound proxy for interactive frame rate, NOT the frame's
 * GPU execution time and NOT the compositor's frame-present latency, neither
 * of which the main thread can observe. It is reported as "rAF cadence" for
 * that reason wherever it is displayed.
 */
export function measureFps(step: () => void, frames = 60): Promise<{ median: number; min: number } | null> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== 'function') {
      resolve(null);
      return;
    }
    const deltas: number[] = [];
    let last = performance.now();
    let count = 0;
    const tick = (now: number) => {
      step();
      deltas.push(now - last);
      last = now;
      count++;
      if (count >= frames) {
        deltas.sort((a, b) => a - b);
        const median = deltas[Math.floor(deltas.length / 2)];
        resolve({ median: 1000 / median, min: 1000 / deltas[deltas.length - 1] });
      } else {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  });
}
