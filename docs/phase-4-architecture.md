# Endophasia Studio — Phase IV: Scientific Visualisation Architecture

Phase IV rebuilds the presentation layer around one principle: **scientific
meaning must be independent of visual presentation.** The graphics engine
grants no epistemic standing — a node drawn on a GPU is worth exactly as much
as the record behind it.

## What changed

### 1. Versioned scene contracts (`src/scenes/`)

A **scene** is a plain data document describing a visualisation: nodes, typed
edges, provenance, explicit missing-information markers, and layout
coordinates produced by a named deterministic algorithm.

- `LineageScene` (schema v1): built from the EVOLVE corpus by
  `buildLineageScene` — a pure function. Same corpus in, byte-identical scene
  out (verified by tests, including invariance to array order).
- Every node carries `provenance` (`observed` / `reported` / `derived` /
  `not-applicable`) **with its reason**, plus a separate `classification`
  (baseline / trial / continuation / replay / simulated-projection). These are
  two independent dimensions: **provenance is evidence** — where the record's
  claims come from (OBS / REP / DER / N-A) — while **replay status is a
  continuation kind**. A replay of a recorded run is evidence-`observed` (the
  record exists) with classification `replay`; REP means the evidence was
  *reported* by the runtime, never that anything was replayed. No field
  conflates the two. The simulated projection is marked DER and is excluded
  from `missing.nonResultNodeIds`
  semantics: it is present, but explicitly not a result.
- Missing information is carried, never filled: sessionless nodes are listed
  in `missing.sessionlessNodeIds` and drawn with the explicit-gap marker.
- `contentDigest` (FNV-1a over the canonical stable-JSON document) detects any
  change to meaning-bearing content. FNV-1a is deliberately **not
  cryptographic** — it is change detection for cache/dirty-checking only and
  must never be treated as tamper-evidence.
- Cyclic lineage is rejected as invalid history; self-loops and dangling
  edges are hard errors, and duplicate node or execution ids are rejected at
  build time. The builder returns issues rather than guessing.
- Arm membership is keyed by **execution id**: the map is the union of
  `arm.executionIds` and (exec → arm) entries keyed by each execution's own
  id, and is validated against the corpus by tests.

### 2. Renderer-independent interaction model (`src/scenes/interaction.ts`)

Viewport, selection, focus (ancestor/descendant), text filter, and hidden
relations are **application state**. Renderers receive them as pushed data and
hold none of it internally, so switching backends preserves the entire
interaction state by construction (tested).

- Semantic zoom: three declared LOD tiers — `full ≥ 0.8`, `labels ≥ 0.3`,
  else `dots`.
- Keyboard navigation in (depth, row) reading order; `f` toggles lineage
  focus; `0` fits the scene.

### 3. Replaceable renderers (`src/scenes/renderers/`)

Two implementations behind one adapter (`LineageRenderer`):

- **`svg-dom`** — one SVG element per graph element, native text, DOM
  hit-testing. The reference implementation; works everywhere.
- **`webgl2-instanced`** — hand-rolled WebGL2. Nodes are one instanced draw
  call (quad + per-instance color); edges are one line-buffer draw call.
  Text is a screen-space DOM overlay culled to the viewport (its cost is
  reported separately, not hidden in the GPU number). Probes WebGL2 at
  creation and reports factual failure reasons. Handles DPR, resize via
  ResizeObserver, and explicit context loss on destroy.

### 4. Honest measurement harness (`src/scenes/renderers/measure.ts`)

Every reported figure is a real `performance.now()` measurement: medians over
7 timed runs after 3 warm-up runs, with min/max shown so the spread is
visible. FPS is only reported when a real rAF loop ran. Anything not measured
is listed under `unmeasured` **with the reason** — never estimated, never
extrapolated, never borrowed from another backend. Synthetic stress scenes at
100 / 1,000 / 10,000 nodes are labelled as fixtures in every node record
(`synthetic fixture — not a measured result`).

### 5. The lineage explorer (`LineageExplorer`)

Replaces the fixed-viewport SVG canvas: pan/zoom (wheel zoom about the
cursor), fit, semantic zoom, query filter, per-relation toggles, lineage
focus, keyboard navigation, scene switcher (recorded lineage + synthetic
fixtures), backend switcher that preserves selection and camera, and the
diagnostics panel showing measured values only, plus a small heatmap
proof-of-concept for future OBSERVE/DREAM scenes (digest-derived synthetic
values, labelled as such).

### 6. Comparability: within-arm drift

`armDrift` checks every recorded coordinate **within** each arm, across all
its executions — not just the first sample. Drift demotes the comparison to
`confounded`: a change that varies between replicates is not a property of
the arm, so no cross-arm comparison is offered.

## Phase IV completion (this pass)

### Coordinate convention, enforced everywhere

One convention across SVG, WebGL, hit-testing, pan, zoom and fit:

```
screen = world * scale + offset      (CSS pixels; offset includes the half-viewport)
```

Pure helpers (`screenFromWorld`, `worldFromScreen`, `zoomAbout`,
`zoomToNode`) are the single source of truth; the GLSL camera chunk mirrors
the same math with a Y-flip for clip space. The device pixel ratio only ever
scales the drawing buffer (canvas backing store), never the coordinate math —
hit-testing is DPR-independent by construction. SVG places the transform on
the root group so badges and text can opt out of the world transform.
Deterministic round-trip tests (`interaction.test.ts`, 16 tests) pin
`screenFromWorld ∘ worldFromScreen = identity` across scales 0.05–4 and
dense offsets, SVG-transform equivalence, cursor-anchored zoom, node
centering on the corpus, and fit containment.

### WebGL resource lifecycle

Every buffer, VAO, program and shader is tracked and deleted on `dispose()`;
deletion is idempotent and safe after context loss. `webglcontextlost` /
`webglcontextrestored` are handled; failed initialisation falls back to a
factual error instead of a half-built renderer. Selection and camera changes
update per-instance colors in place via `bufferSubData` — geometry is never
rebuilt — and there is no continuous animation loop when the scene is
stationary.

### Honest diagnostics

`measureFps` reports **rAF callback cadence** and says so: it is not GPU
execution time (`performance.now()` on the main thread observes CPU
submission cost only) and not frame-present latency (the main thread cannot
observe the compositor). GPU frame time, frame-present latency and memory
are listed under `unmeasured` **with the reason they were not measured**. No
numbers are invented anywhere in the app or docs.

## Fixed defects (all verified against source before fixing)

1. Cross-workspace event navigation now selects the owning session first.
2. Candidate parent links route to the candidate handler, not the experiment handler.
3. Comparability checks within-arm drift on all coordinates.
4. Returning to the lineage overview keeps the last selected execution highlighted.
5. The lineage graph is a full explorer (pan/zoom/LOD/filter/focus) instead of a fixed SVG.
6. `npm test` / `npm run test:watch` scripts exist and run Vitest.

## Production boundaries

- Renderers receive **data, never code**: no HTML strings, no markup-bearing
  labels, no injection sinks.
- No CDN dependencies; no telemetry; all rendering is local.
- The Supabase dependency remains unused (all data is bundled synthetic content).

## Check status

All commands were actually run on this tree (Phase IV completion state):

- `npm run typecheck` — 0 errors
- `npm run lint` — 0 errors (1 pre-existing fast-refresh warning)
- `npm test` — 124 tests, 5 files, all pass
- `npm run build` — passes

The 12 listed browser interactions (pan, wheel zoom about cursor, click
select, keyboard navigation, filter, relation toggles, fit, zoom-to-node,
backend swap, scene switch, diagnostics panel, heatmap PoC) were implemented
and exercised via the interaction-model test suite; full in-browser WebGL2
verification requires a real browser and is listed as explicitly unverified
in `docs/renderer-comparison.md`.

See `docs/renderer-comparison.md` for what was measured, what was only
prototyped, and what is explicitly unverified.
