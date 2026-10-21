# Endophasia Studio — Concept Exploration

An interactive design exploration of **Endophasia Studio**, an observation instrument for studying AI coding-agent behaviour.

> **This is a design prototype built entirely on synthetic demonstration data.** It is not connected to any real runtime, agent, or observation backend. Nothing here implies observed behaviour of a real system.

## What this explores

The prototype investigates what a high-quality observation workspace for the [Endophasia](https://github.com/noctem-o/endophasia) project could look and feel like — a fusion of scientific instrumentation, observability tooling, and research laboratory interface.

Key design questions being explored:

- How should **capability admission states** (admitted / partially admitted / unavailable / mismatched / unverified) be presented without collapsing them into a single meaningless "health" signal?
- How can **evidence provenance** (OBS / REP / DER / N/A) be made immediately legible at every level of inspection?
- How should a **source integrity** view report conditions (readable / degraded / absent) per source, without inventing an aggregate score?
- What does a **trajectory comparison / divergence** preview look like when it is grounded strictly in recorded events and clear provenance?

## What's inside

- **Observation workspace** — three-panel layout (runtime identity + capabilities, event trajectory, evidence inspector)
- **Three demonstration sessions** — a clean completed run, a divergent/terminated run, and a run with incomplete evidence (journal truncation, degraded usage ledger)
- **Working interactions** — session switching, trajectory filtering/search, event and capability inspection, structured-data expansion
- **Concept preview** — a clearly-labelled trajectory divergence comparison, explicitly scoped to recorded events only (no claims about private reasoning or model internals)

## Running locally

```bash
npm install
npm run dev
```

Then open the printed local URL. The app is fully client-side; there is no backend.

## Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- lucide-react (icons)

## Relationship to the real project

This prototype does **not** reflect current Endophasia Studio behaviour or capabilities. It is an exploration of future interface directions, informed by the project's stated design principles: separating observation from interpretation, evidence from conclusions, and proposals from permission.

Mock data lives in `src/data/` and is structured so a real implementation could swap the mock access layer for actual observation projections without changing the interface components.

## License

TBD — see the main [endophasia](https://github.com/noctem-o/endophasia) repository for project context.
