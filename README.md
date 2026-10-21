# Endophasia Studio — Concept

An interactive design exploration of a **research workstation for observing AI coding-agent behaviour** — an instrument for recording, inspecting, and comparing agent trajectories with explicit evidence provenance, rather than a product mock.

> **All data in this prototype is synthetic demonstration data.** Nothing is connected to a real runtime. Every session, event, capability, and source is a fixture authored to exercise the interface's epistemic rules.

## What it does

The studio is organised as four workspaces over a shared session registry:

### Observe

A filtered, searchable view of one recorded session:

- **Event table** — storage-ordered records with category, status, and a provenance glyph column showing what class of evidence backs each record (◉ observed, ◔ reported, ∆ derived, ∅ unavailable).
- **Trajectory ribbon** — a compact visual index of the filtered trajectory; interventions render with a dashed border. Click any segment or use ↑↓ / j / k to move through events.
- **Inspector** — full record view: fields, usage accounting, expandable evidence rows (each showing its source, and for derived values the declared derivation process), an expandable raw structured record, explicit relations to other events, and — for intervention records — the intervention's full lifecycle with its separately recorded steps.
- **Filters** — by category, status, best-evidence class, and free text across titles, fields, and summaries.

### Compare

Side-by-side alignment of two trajectories using a **deterministic, displayable methodology** (no hidden heuristics):

- **Phase 1 — exact match**: same event kind and tool, identical compared-field values (`tool`, `path`, `cmd`).
- **Phase 2 — proposed correspondence**: same kind and tool, paired greedily in storage order. These are hypotheses for inspection, not verified pairings.
- **Residual — unmatched**: records left unpaired on either side, shown without a verdict.

Every row can be expanded to show both records' evidence side by side plus a per-field delta. The methodology panel states the phases and their caveats in the interface itself, so the alignment's meaning is never implicit.

### Capabilities

What the runtime declared versus what the record actually shows:

- **Capability inventory** with status glyphs — admitted ●, partially admitted ◐, unavailable ○, mismatched ▲, unverified ◇. "Unavailable" is deliberately distinct from "inactive"; "admitted but never exercised" is shown as unverified, not functional.
- **Declared vs observed** panels per capability, with restrictions and the evidence for each claim.
- **Session usage** — the events that exercised the capability, linked back to the observation view.
- **Source ledger** — the independent sources behind the records (event log, registries, usage ledger), each with its recorded condition: readable, empty, absent, degraded, or unopenable.

### Evolve — the Counterfactual Laboratory

An experiment-programme surface over the observation registry: execution lineage, forkable checkpoints, controlled experiments, candidate evolution, and gated promotion — all derived from typed records, none authored as dashboard numbers.

- **Lineage canvas** — a layered graph of execution records connected only by typed relations (forked from, replay of, candidate of, evaluated against, simulated branch). Executions whose trajectory is not in the observation registry render an explicit gap marker instead of a session link.
- **Checkpoints** — each carries five recorded artifacts (workspace snapshot, conversation prefix, tool definitions, environment pin, response cassette), and **forkability is derived** from what is present, never asserted: a checkpoint missing its conversation prefix simply cannot support a new continuation, and the interface says so rather than offering a fork.
- **Continuation kinds kept apart** — replayed (recorded responses held fixed; says nothing about the model), recorded (a genuinely new run), simulated (a projection, never a real result, excluded from all aggregates and carrying no usage).
- **Experiments** — declared coordinates on every execution: each of the 19 coordinates (model, checkpoint, quantisation, harness, wire dialect, cognition policy, sampling policy, environment, task set, evaluator, seed, repetitions, holdout, …) is recorded or explicitly UNAVAILABLE with a reason. The **comparability inspector** classifies each coordinate as matched, changed (declared manipulation or not), or unmatched, and refuses a verdict when the arms are not fully comparable.
- **Results derived from trial records** — pass rates with denominators and Wilson score intervals at 95% (the width shown, not just the centre), usage medians with missing rows counted as missing and never zeroed. An unavailable check enters neither side of the denominator: a failed evaluator run is not a failed task, and an environment failure is not a reward of 0.
- **Promotion sequence** — observed → proposed → isolated → evaluated → compared → reviewed → authorised → promoted, each stage a separate recorded decision. Evaluation success never implies authorisation; authorisation never implies promotion. The demo corpus includes a candidate blocked at review *after* a good evaluation, and a promotion recorded with its holdout caveat (1 of 3 holdout trials completed).

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
  domain/types.ts        Canonical contracts: evidence, usage presence,
                         events, interventions, sessions
  domain/evolve.ts       EVOLVE contracts: coordinates, lineage, checkpoints,
                         candidates, experiments, trials, promotion records
  data/fixtures/         Six synthetic observation scenarios + builders
  data/evolve/           Synthetic experiment programme: lineage, experiments,
                         trials, promotion records
  analysis/compare.ts    Deterministic alignment, session statistics,
                         fixture validation
  analysis/evolve.ts     Comparability inspection, lineage validation,
                         Wilson intervals, cell statistics
  state/                 Workspace state hook + design-system metadata
  components/            UI kit: primitives, evidence list, JSON tree,
                         trajectory ribbon, event inspector
  components/evolve/     Lineage canvas, checkpoint panel, experiment and
                         candidate views, trial drill-down
  workspaces/            Observe / Compare / Capabilities (Evolve lives in
                         components/evolve)
```

The fixture layer is deliberately separated from the domain types: a future implementation replaces the fixtures with a loader over validated observation projections, and the `Session` shape is the contract.

### Verification

```bash
npm run lint        # eslint, clean
npm run typecheck   # tsc --noEmit, clean
npm test            # 124 tests, 5 files: fixture validation, alignment
                    # semantics, missing-usage invariants, intervention
                    # lifecycles, the EVOLVE suite — coordinate declarations,
                    # comparability verdicts, Wilson-interval math, cell
                    # statistics with honest denominators, corpus referential
                    # integrity, checkpoint forkability, promotion-stage
                    # ordering — plus the Phase IV scene suite: coordinate
                    # round-trips, deterministic scene building, provenance
                    # (evidence) vs classification (continuation kind),
                    # WebGL resource lifecycle, and synthetic stress fixtures
npm run build       # production build
```

The test suite checks the epistemic rules directly: every session passes structural validation (storage order, timestamp-offset consistency, reference integrity, intervention steps pointing at recorded events), no session presents missing usage as present, and alignment is deterministic — the same inputs always produce the same pairing, exact matches are never conflated with proposed correspondences, and different event kinds are never paired.

## Design decisions

- **Provenance-first colour system.** A restrained ink palette carries the structure; the four accent colours (teal, blue, amber, red) map to evidence semantics, so colour always means something.
- **Demonstration data is labelled everywhere.** The header and footer carry a persistent demonstration-data marker; nothing in the interface could be mistaken for a live connection.
- **Alignment is shown, not hidden.** The comparison methodology is part of the interface — phases, rules, and caveats are rendered in the Compare workspace, not buried in documentation.
- **Sequence is not causation.** Wherever the record could imply a causal claim (interventions, retries, recoveries), the interface says explicitly that the record shows ordering, not cause.

## Limitations

- All data is synthetic and hand-authored; nothing is ingested from a real runtime.
- The EVOLVE corpus is a demonstration programme: cells are small (1–6 trials), the intervals are wide, and the interface shows them wide.
- The alignment model compares recorded kinds, tools, and a small set of compared fields only — no semantic analysis of request or response content.
- The interface is read-only by design: this is an observation surface, not an intervention surface.
- Session validation covers structural consistency, not semantic plausibility of the fixture content.
