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

/** Keeps the result of a timed construction reachable, so an engine cannot discard the work being timed. */
let sink: unknown = null;
export function constructionSink(): unknown { return sink; }

export interface SceneBuildOp {
  /**
   * An operation that CONSTRUCTS the scene being displayed, and returns it. It is only timed if it is shown to do that: it must
   * return a scene whose content digest equals the displayed scene's. A builder that returns nothing, or builds something else,
   * is reported unmeasured with that reason rather than timed — a property lookup or an unrelated build is not a scene-build
   * measurement. Null when the scene arrived already built.
   */
  buildScene: (() => LineageScene | null | void) | null;
  /** What `buildScene` is (corpus → scene, or a synthetic fixture generator). Defaults to a neutral "scene construction". */
  buildLabel?: string;
  /** Push a scene + initial viewport into a live renderer (scene upload cost). */
  pushScene: () => void;
  /** Push a viewport change into a live renderer (frame cost proxy). */
  pushViewport: () => void;
}

/**
 * What each figure is and is not. The UI shows these beside the numbers so that a CPU-side cost is never read as a frame time.
 * Keyed by the timing's `kind` prefix.
 */
export const MEASUREMENT_DEFINITIONS: { prefix: string; is: string; isNot: string }[] = [
  { prefix: 'scene build', is: 'CPU time to construct the scene data from records (pure JavaScript, no renderer involved).', isNot: 'not rendering, and not the cost of laying anything out on screen.' },
  { prefix: 'scene generation', is: 'CPU time to generate a synthetic stress fixture (no records involved).', isNot: 'not a corpus build, and not a result about any real lineage.' },
  { prefix: 'scene upload', is: 'CPU time of renderer.setScene: DOM construction for SVG, buffer upload submission for WebGL.', isNot: 'not GPU execution, and not time to first paint.' },
  { prefix: 'viewport apply', is: 'CPU time of renderer.setViewport (a transform for SVG, a draw submission for WebGL).', isNot: 'not frame time: the GPU may still be working when it returns.' },
  { prefix: 'rAF cadence', is: 'the interval between successive requestAnimationFrame callbacks while the probe drives the viewport.', isNot: 'not GPU frame time, and not the compositor presenting a frame.' },
];

/**
 * Measure scene-build, scene-upload and viewport-apply costs (CPU time on the main thread). Frame rate is measured only when a
 * rAF loop is actually available and actually run. GPU execution and frame-present latency cannot be observed from the main
 * thread and are always listed as unmeasured, with the reason.
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
  // With no declared builder we do not know what kind of construction this would have been, so the label does not presume one.
  const buildKind = op.buildLabel ?? 'scene construction';
  const builder = op.buildScene;
  if (!builder) {
    unmeasured.push({
      kind: buildKind,
      reason: 'not measured: this scene arrived already built and no builder was supplied, so there is no construction operation to time — timing a property lookup would be a fake measurement',
    });
  } else {
    // Prove the operation constructs the displayed scene before timing it.
    const probe = builder();
    if (!probe) {
      unmeasured.push({ kind: buildKind, reason: 'not measured: the supplied operation returned no scene, so it cannot be shown to construct the displayed one — it was not timed' });
    } else if (probe.contentDigest !== scene.contentDigest) {
      unmeasured.push({ kind: buildKind, reason: 'not measured: the supplied operation builds a different scene from the one displayed (content digests differ) — it was not timed' });
    } else {
      timings.push(runTimed(buildKind, () => { sink = builder(); }, WARMUP_RUNS, MEASURED_RUNS));
    }
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
