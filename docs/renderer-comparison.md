# Renderer comparison — what was measured, prototyped, and not verified

Phase IV brief requires an honest comparison of SVG, Sigma.js+Graphology,
PixiJS, and Three.js/WebGPU at 100 / 1,000 / 10,000 nodes. This document
separates three claim strengths. **Nothing here is invented.**

## 1. Actually measured in this repo (you can reproduce it)

The in-app diagnostics panel ("run measurement pass on all scenes") measures,
per backend and per scene (recorded lineage, 100, 1,000, 10,000 synthetic
nodes):

- scene build time (corpus → scene)
- scene upload time (`renderer.setScene`)
- viewport apply time (`renderer.setViewport`)

Protocol: 3 untimed warm-up runs, then 7 timed runs; median, min and max
reported. FPS is measured only from a real rAF loop, and only when one was
run — and it is reported as **rAF callback cadence**, which is neither GPU
frame time nor frame-present latency (the main thread cannot observe either;
see the diagnostics panel's unmeasured list for the reasons). Figures differ
per machine and per session — the app shows the values measured on **your**
machine at **that** moment; this doc deliberately does not quote numbers
captured on one machine as if they were general truths.

Structural facts measured by construction (not benchmarked):

- SVG backend creates one DOM element per graph element (nodes + edges +
  per-node text elements), so element count scales linearly with the scene.
- WebGL2 backend issues exactly two draw calls per frame regardless of scene
  size (instanced quads + line buffer), plus a DOM text overlay whose element
  count is culled to the viewport.

## 2. Prototyped / implemented here, not benchmarked

- **SVG (DOM)** — fully implemented (`svgRenderer.ts`). Semantics are the
  reference implementation. Its scaling limits (DOM element count, per-element
  style resolution) are well known but were **not quantified here**; the
  diagnostics panel measures whatever your browser actually does.
- **WebGL2 (instanced, hand-rolled)** — fully implemented
  (`webglRenderer.ts`). Chosen over pulling in a library because the scene
  needs only colored quads + lines + an external text overlay, and a ~150-line
  renderer keeps the entire pipeline auditable and dependency-free.

## 3. Evaluated from official documentation, NOT benchmarked here

These libraries were assessed but **not integrated and not measured**. Any
performance claim about them would be borrowed, so none is made.

| Option | What the official docs say | Why it was not adopted for this phase |
| --- | --- | --- |
| **Sigma.js + Graphology** | WebGL-based graph renderer aimed at large graphs; v3 focused on performance; Graphology provides the graph model. | Expects to own the graph model and layout; our architecture requires the renderer to be a disposable view of a scene document, with layout declared in the scene. Adapter cost would be real but is unmeasured. A strong candidate for a future phase; integration would need its own honest benchmark. |
| **PixiJS v8** | Single `pixi.js` package; WebGL/WebGPU with automatic Canvas fallback; batched 2D rendering. | Excellent fit for generic 2D scenes, but the batcher's behavior with our per-node color updates and text overlay would need measurement to compare honestly against the hand-rolled path. Adding a large dependency for two draw calls was judged not justified **without** measured benefit — and measuring it fairly is exactly the future work this doc flags. |
| **Three.js / WebGPU** | General 3D scene-graph engine; WebGPU support via newer releases. | 3D scene-graph overhead for an inherently 2D layered graph; WebGPU availability is still not universal in target browsers. Not integrated. |

## 4. Explicitly unmeasured (do not infer these from anything above)

- GPU frame time under continuous interaction for either backend.
- Memory footprint of any backend.
- Text overlay cost at scale (it is culled, but the culling cost itself was
  not separated out).
- Sigma.js / PixiJS / Three.js performance on this scene model — no version of
  these numbers exists in this project.

## 5. How to extend the comparison honestly

1. Implement the candidate as another `LineageRenderer` behind the existing
   adapter (the contract is small: mount, setScene, setViewport,
   setSelection, setHighlight, resize, hitTest, destroy).
2. It automatically joins the diagnostics measurement pass and the stress
   scenes.
3. Record results as measured values with the protocol, or as unmeasured with
   a reason. Never as claims.
