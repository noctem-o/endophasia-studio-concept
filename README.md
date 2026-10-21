# Endophasia — Concept

An interactive design exploration of a **research workstation for observing AI coding-agent behaviour** — an instrument for recording, inspecting, and comparing agent trajectories with explicit evidence provenance, rather than a product mock.

> **All data in this prototype is synthetic demonstration data.** Nothing is connected to a real runtime. Every session, event, capability, and source is a fixture authored to exercise the interface's epistemic rules.

## What it does

Endophasia is organised as four workspaces over a shared session registry. Keys `1`–`4` switch between them and `?` lists every shortcut.

### Observe

One recorded session, from overview to evidence:

- **Trajectory overview** — a swimlane map: one lane per event category, storage order (or recorded time) along x. Each marker's *shape* is the strongest evidence class behind the event (● observed, ◐ reported, ◆ derived, ◌ not recorded); a red ring marks an error, an amber broken ring a partial result, a dashed ring an intervention. Filters dim events rather than deleting them, so a filtered trajectory is always read in context. A bracket shows which part of the trajectory the table below is showing, and the selected event's recorded relations are drawn as arcs.
- **Event table** — the same events in storage order. Status is shown only when it deviates; hovering a row lights its marker, and the grid is keyboard-operable (arrows, Home/End, Enter). `j`/`k` step through the events *being shown*, never one a filter hides.
- **Inspector** — leads with evidence: each item resolves its source against the session's own source ledger (name, kind, recorded condition), and a derived item shows its declared process. Then fields, usage accounting (missing is shown as missing, never zero), a structured record, relations in both directions, and — for intervention records — the lifecycle with each step as a separate recorded event. Before anything is selected it shows a **session brief**: identity, evidence mix (a tally, not a score), deviations, and source health.
- **Filters** — by category, status, best-evidence class, and free text, with a count beside every option.

### Compare

Two trajectories side by side, each in its own storage order, with the alignment drawn between them. The method is deterministic and shown in the interface (it is the inspector's resting state):

- **Exact** (solid link) — same event kind and tool, identical compared-field values (`tool`, `path`, `cmd`). It says nothing about content, cause or effect.
- **Proposed** (dashed link) — same kind and tool, paired greedily in storage order. A hypothesis for inspection, not a verified pairing. An event that records no compared field can be proposed but never exact, and the inspector says so.
- **Unmatched** (an open stub going nowhere) — no counterpart proposed. Not an error: the record does not say whether it is changed, missing or additional.

A marker on a link says something recorded differs across it (status, evidence class, a compared field). There is no score and no ranking.

### Capabilities

What the runtime declared against what the record shows:

- **Matrix** — declared and observed side by side. A "declared" or "observed" mark is drawn only when evidence of that class backs it: a capability never exercised shows a reported mark and a hatched, empty observed cell. Where each capability was exercised is plotted along the trajectory. "Unavailable" stays distinct from "inactive"; "admitted but never exercised" is *unverified*, not functional.
- **Source ledger** — the independent sources behind the records, each with its recorded condition (readable, empty, absent, degraded, unopenable). Selecting one dims the capabilities whose evidence does not cite it.
- **Inspector** — declared and observed statements with the evidence behind each, restrictions, the events that exercised the capability (linked back to Observe), and session context.

### Evolve — the Counterfactual Laboratory

An experiment-programme surface over the observation registry, derived from typed records and never from authored dashboard numbers. One lab, four sections, and a record inspector for each:

- **Lineage** — a layered graph of execution records connected only by typed relations (forked from, replay of, candidate of, evaluated against, continuation of, simulated branch). Selecting a node shows its record beside the graph (the graph stays put); executions whose trajectory is not in the observation registry render an explicit gap marker. The graph's key doubles as the relation filter. Recorded run, replay, trial and simulation are drawn as four visibly different things.
- **Experiments** — arm cards on one shared 0–100% axis. The bar is the 95% Wilson interval; the tick is the *observed* fraction (passes / denominator, not the interval's centre); the denominator is always printed. An unavailable check enters neither side of the denominator, and a missing result is hatched, never an empty bar. A projection arm (anchored only by simulated branches) has no pass rate and is drawn as such. The **comparability inspector** classifies each of the 19 declared coordinates as matched, changed (declared or not), or unmatched, refuses a verdict when the arms are not fully comparable, and says when there is no outcome to compare.
- **Candidates** — promotion as eight *separate* gates, with deliberate gaps (not a pipeline): observed → proposed → isolated → evaluated → compared → reviewed → authorised → promoted. "No record" is distinct from "unavailable" and from "failed". A record-level diff against any other candidate.
- **Checkpoints** — each carries five recorded artifacts, and **forkability is derived** from what is present, never asserted: a checkpoint missing its conversation prefix cannot support a new continuation, and the interface says why.
- **Continuation kinds kept apart** — replayed (recorded responses held fixed; says nothing about the model), recorded (a genuinely new run), simulated (a projection, never a real result, excluded from all aggregates and carrying no usage).

## The epistemic rules

These are enforced in the domain types and validated by the test suite:

1. **Missing ≠ zero.** Token usage is either present with counts, or explicitly not-present with a stated reason. A zero is never used to stand in for an absent measurement.
2. **Unavailable ≠ inactive.** A capability that isn't granted is not the same as one that wasn't used. Admission without exercise is recorded as unverified.
3. **No invented confidence.** The interface never displays a numeric confidence score that the underlying record does not contain.
4. **No model-internals claims.** Records describe what was observed and reported, not why the model behaved as it did. Sequencing is not causation — the intervention records state this explicitly.
5. **Provenance on every claim.** Each evidence item carries a class (OBS / REP / DER / N-A) and, where applicable, the identifier of the independent source it came from.

## Synthetic scenarios

| Session | Scenario | Demonstrates |
|---|---|---|
| `run-3f92c1` | A — successful run | A complete, clean trajectory with full evidence and usage accounting. |
| `run-2b7e90` | B — tool failure and recovery | An error, a diagnosis, a corrective patch, and a passing retry — with explicit `responds_to` / `recovery_for` / `retries` relations. |
| `run-6c07e4` | C — trajectory divergence | The same task as A, sharing its recorded prefix, then diverging to a divergent-terminated outcome under an authorised intervention. |
| `run-8d41aa` | D — evidence degradation | A degraded usage ledger (missing ≠ zero), a truncated journal, and a session whose end is simply not recorded. |
| `run-5aa1d3` | E — capability mismatch | The same runtime under a different harness policy: the mismatched network capability becomes admitted — and remains unexercised. |
| `run-1f4c88` | F — authorised interventions | STEER and QUEUE interventions whose propose / authorise / accept / consume / expire steps are each separate recorded events. Acceptance is not execution. |

## Architecture

```
src/
  design/tokens.json     The single source of colour, read by both Tailwind
                         and the canvas/WebGL palette
  ui/                    Design system: marks (provenance shapes, status,
                         capability and source glyphs), controls, layout,
                         viz (Wilson interval bar, provenance mix)
  domain/types.ts        Canonical contracts: evidence, usage presence,
                         events, interventions, sessions
  domain/evolve.ts       EVOLVE contracts: coordinates, lineage, checkpoints,
                         candidates, experiments, trials, promotion records
  data/fixtures/         Six synthetic observation scenarios + builders
  data/evolve/           Synthetic experiment programme
  analysis/compare.ts    Deterministic alignment, session statistics,
                         fixture validation
  analysis/evolve.ts     Comparability inspection, lineage validation,
                         Wilson intervals, cell statistics
  state/                 Workspace state, semantic metadata (meta.ts),
                         and the pure logic behind each workspace
                         (observe, compare, capabilities)
  scenes/                Lineage scene contracts, interaction model,
                         explorer, and the replaceable renderers
  components/            App shell, session switcher, and per-workspace
                         components (observe/, compare/, capabilities/, evolve/)
  workspaces/            Observe / Compare / Capabilities (Evolve lives in
                         components/evolve)
e2e/                     Playwright browser suite (see Verification)
.github/workflows/       CI
```

The fixture layer is deliberately separated from the domain types: a future implementation replaces the fixtures with a loader over validated observation projections, and the `Session` shape is the contract.

### Verification

```bash
npm ci                 # the lockfile is committed; Node ^22.22.2 (see .nvmrc and package.json "engines")
npm run typecheck      # tsc --noEmit for the app and for e2e/
npm run lint           # eslint: no errors, no warnings
npm test               # 312 tests, 18 files (see below)
npm run build          # production build
npm run audit:classes  # after a build: fails if a colour/shadow utility used in
                       # src/ generated no CSS (Tailwind drops unknown classes silently)
npm run test:e2e       # builds, serves it with `vite preview`, and runs the Playwright
                       # browser suite in Chromium at DPR 1 and DPR 2
```

`.github/workflows/ci.yml` runs all of these on every pull request and push to `main`: one job for the first six, one for the
browser suite (with `E2E_REQUIRE_WEBGL=1`, so the job fails rather than skipping the WebGL tests if WebGL2 cannot initialise).

The Vitest suite checks the epistemic rules directly: every session passes structural validation, no session presents missing usage as present, alignment is deterministic (exact matches are never conflated with proposed correspondences, and different event kinds are never paired), checkpoint forkability and comparability verdicts are derived, and the Wilson tick lies inside its interval for every arm cell. It also pins the design system: every informational colour clears a 4.5:1 contrast floor, the lineage relation and execution-kind colours stay perceptually distinguishable (OKLab ΔE ≥ 0.08), the renderer palette and Tailwind read the same tokens, and a simulated projection can never share a node style with a trial or a baseline. Application-level tests drive the real app: workspace keys, the synthetic marker in every workspace, `j`/`k` over a filtered list, and what the Compare and Capabilities inspectors decline to claim. The measurement harness is held to the same standard: scene construction is timed only when the operation provably builds the displayed scene, and a pass's figures are discarded when the renderer or scene changes. Interaction rules are pinned exactly (a text filter keeps its matches and their one-hop neighbours, nothing more), and a scene switch cannot leave a stale selection or focus behind.

The browser suite (`e2e/`) asserts what a jsdom test cannot: that the SVG backend really attaches and draws one group per node and one path per edge; that clicking the centre of each node selects exactly that node (hit-testing agrees with the drawing); that pan, zoom and fit move the camera; that the filter (to the exact node set) and relation toggles change what is drawn, in both backends; that switching renderer keeps the selection and puts the same node in the same place; that WebGL2, where it initialises, really renders (judged from a composited screenshot, never a post-present buffer readback) and recovers from a lost context; that every workspace fits at 1280×800, 1440×900, 1920×1080 and 1024×768; and that the narrow-screen inspector is a real modal (focus in, Tab trapped, page inert, Escape and focus return). Every test also fails on any console error, failed request, or request that leaves the origin. The SVG tests pass with or without WebGL2. On failure it keeps screenshots and traces.

## Design decisions

- **Colour is spent on one thing, and the rest is form.** Hue names *provenance* — observed teal, reported blue, derived violet, unavailable slate — plus *attention* (amber: degraded, partial, differs) and *fault* (red: error, mismatch). Two further hues are used for structure in the lineage graph only: sage for replay, and violet for simulated (which the scene marks derived). Selection is neutral ivory, so choosing something never changes what it looks like; "ok" is not coloured, because health is the default and deviation is what is marked. Category is carried by position (a swimlane) and a neutral icon. Texture carries epistemic status: solid is recorded, dashed is proposed, hatched is simulated or synthetic, hollow is unavailable. Every provenance class is also a *shape*, so it survives colour-vision deficiency and tiny sizes. See [`docs/design-direction.md`](docs/design-direction.md).
- **Demonstration data is labelled everywhere.** A hatched `SYNTHETIC DATA` tag is in the header of every workspace, the lab adds `SYNTHETIC PROGRAMME`, and the stress-test scenes add `SYNTHETIC FIXTURE`; the status bar repeats that nothing is connected to a runtime.
- **Alignment is shown, not hidden.** The comparison method is the Compare inspector's resting state, and a link says what it does not establish.
- **Sequence is not causation.** Wherever the record could imply a causal claim (interventions, retries, recoveries, relations), the interface says explicitly that the record shows ordering, not cause.

## Limitations

- All data is synthetic and hand-authored; nothing is ingested from a real runtime.
- The EVOLVE corpus is a demonstration programme: cells are small (1–6 trials), the intervals are wide, and the interface shows them wide.
- The alignment model compares recorded kinds, tools, and a small set of compared fields only — no semantic analysis of request or response content.
- The interface is read-only by design: this is an observation surface, not an intervention surface.
- Session validation covers structural consistency, not semantic plausibility of the fixture content.
- WebGL was verified only under a software rasteriser (SwiftShader) in headless Chromium, locally and in CI, never on a physical GPU: that is correctness evidence, not a performance measurement. The diagnostics panel reports CPU time on the main thread only; GPU execution and frame-present latency are never measured. The WebGL backend draws edges solid, so there a relation is told apart by colour alone; the key, the toggles and the inspector name each one. The WebGL node shader draws a thicker border on the left and right than on the top and bottom; that is unchanged (shader work is out of scope).
- The SVG backend rebuilds its whole scene on every selection change (unchanged; its cost is what the diagnostics panel measures).
