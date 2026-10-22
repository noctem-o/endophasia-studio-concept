# Production handoff — Observe workspace

Scope of this pass: the app shell and the Observe workspace, prepared for an eventual
production migration. This document records what is portable as-is, which presentation
states exist, where each lives, and what remains concept-only. Compare, Capabilities and
Evolve are functionally unchanged in this pass.

## What is portable

These files carry no concept-only assumptions and can move to a production app as-is:

- `src/design/tokens.json` — single source of colour, read by the Tailwind config and the
  scene palettes. The token test (`src/design/__tests__/tokens.test.ts`) enforces the
  contrast floor: `fg-4` may only colour icons that sit beside their own explanation
  (the reviewed allowlist in that test).
- `src/ui/marks.tsx` — the glyph family (OBS ●, REP ◐, DER ◆, NA ◌, condition tags,
  `SyntheticTag`). Hue carries provenance only; square glyphs mark capability/source
  status; "ok" is the uncoloured default.
- `src/ui/states.tsx` — the six reusable presentation states described below.
- `src/ui/layout.tsx`, `src/ui/controls.tsx` — shell furniture (header, workspace bar,
  status bar, buttons) with keyboard and focus treatment.
- `src/components/observe/ProjectionNotice.tsx` — the partial-unsupported banner.

The session store seam (`src/state/sessionStore.ts`) is the intended production entry
point: a production app supplies a `SessionLoader` that returns real projections; the
bundled fixture loader is the concept's stand-in and is synchronous, so the demo never
flashes a loading state.

## Presentation states

Six states, all in `src/ui/states.tsx` unless noted:

1. **Populated observation** — the normal Observe workspace
   (`src/workspaces/ObservationWorkspace.tsx`). Unchanged from the baseline design
   apart from the degraded-source callout (below).
2. **Empty store** (`EmptyStoreState`) — the store is reachable and healthy but holds no
   sessions. Presented as an expected state, not a failure; optional action slot.
3. **Unavailable evidence** (`WithheldEvidence`, plus the per-source rows in
   `src/components/observe/SessionBrief.tsx`) — a record exists but this viewer may not
   show it: a hatched swatch, what is withheld, and why. Never a zero and never a guess.
4. **Degraded source** (`DegradedSourceCallout` + `SessionBrief` source rows) — a session
   whose sources partially degraded renders an attention-tone callout naming the source
   and what is missing, above the source list; rows carry labelled condition tags.
5. **Loading and request failure** (`LoadingState`, `LoadFailureState`) — loading is a
   quiet `role="status"` spinner (honours reduced motion); failure names what failed and
   the detail, offers retry, and states plainly that nothing below the notice is
   fabricated to fill the gap. Deliberately distinct from the empty store.
6. **Unsupported projection** (`UnsupportedProjectionState`, plus `ProjectionBanner` in
   `ProjectionNotice.tsx`) — when a record was written by a projection this build does
   not read, the limit is named: the record's version vs the supported list, with the
   statement that nothing is inferred. Partial cases (some sessions readable, some not)
   keep the readable sessions and show the banner; full cases replace the workspace.

## File locations

- `src/state/sessionStore.ts` — loader seam, store state machine
  (`loading | ready | empty | failure | unsupported`, plus a partial-unsupported
  variant of `ready`), selection survival across reloads.
- `src/ui/states.tsx` — the six states as reusable components.
- `src/workspaces/ObservationWorkspace.tsx` — wires the store to the workspace; early
  returns per state before the normal layout renders. NOTE: selection still lives in
  `studio` — see "State ownership: what PR B must resolve" below.
- `src/components/observe/ProjectionNotice.tsx` — partial-unsupported banner and
  re-export of the full-unsupported state.
- `src/components/observe/SessionBrief.tsx` — degraded-source callout, condition tags.
- `src/__tests__/states.test.tsx` — behaviour tests for every state (10 tests).
- `scripts/observe-shots.mjs` — screenshot harness (verified end-to-end; see Screenshots).

## State ownership: what PR B must resolve

`ObservationWorkspace` reads presence from the store seam (`useSessionStore()`: loading, empty, failure, unsupported
projections) but its populated view still selects through the demo shell state: `studio.session` for the session shown and
`studio.eventId` for the selected event. The store keeps its own `selectedId` and the workspace keeps `pickSession` writing to
both (`store.selectSession(id); studio.selectSession(id)`), so today they agree only because every writer remembers to touch both.

This is deliberate for the concept (studio also drives cross-workspace navigation and Compare/Evolve selection), but a
production migration must consolidate it: session and event selection should have ONE owner. The recommendation for PR B:

1. Make `SessionStore` (or its production successor) the single owner of the selected session; drop `studio.session`.
2. Keep event selection (`eventId`) in the workspace-local state OR move it into the store, but not both — the current
   dual-write in `pickSession` is the part most likely to drift.
3. `useSessionStore`'s default loader is the bundled fixtures. A production build passes a real loader; nothing else in the
   store's contract changes (the state machine, selection survival and unsupported-projection handling are already loader-agnostic).

## Screenshots

All six captures were produced by the harness in this repository (see the next section for the exact
command). Each was visually verified against the state it claims to show.

**Commit status: the six PNGs are NOT committed in this branch push.** They were generated and
verified locally in `docs/screenshots/observe-handoff/`, but the only commit/push tooling available in
the environment this pass was written in handles UTF-8 text only and rejected binary image files. The
harness is committed and reproducible, so anyone can regenerate identical captures with the command
below; a maintainer committing the six PNGs from a local run closes the gap.

`docs/screenshots/observe-handoff/` holds desktop (1440×900) and narrow (420×800) captures of three Observe states:

- `01-observe-brief` — session brief, populated observation (`run-3f92c1`, scenario A)
- `02-observe-event` — event selected, inspector open. At narrow width the inspector is the modal drawer, as designed.
- `03-observe-degraded` — scenario D (`run-8d41aa`): error/partial statuses, deviations list, and the degraded-source callout.
  At narrow width the callout is not captured because the session brief (where it renders) is never displayed below the `lg`
  breakpoint — the capture instead shows the correct session selected with its error/partial statuses visible in the table.

### Reproducing the captures

```bash
npm install
npm run build
node scripts/observe-shots.mjs
```

The harness resolves Chromium in this order: `E2E_CHROMIUM_PATH` (the same variable the Playwright config honours), then
Playwright's own bundle, then a system Chromium. Nothing is downloaded at run time. It polls the preview server for real HTTP
readiness (it does not parse server output), waits for fonts and a double animation frame before every capture, injects CSS that
disables transitions and animations, and asserts each state before capturing: that the inspector really opened with an event
title, that the degraded callout is visible (desktop), and that the session switcher really moved to `run-8d41aa` (both widths).
If a required state cannot be reached the harness fails with a named step; the browser and server close on any failure.

### Verification results recorded in this pass

All checks were executed in the environment this document was written in:

- `npm run typecheck` — pass.
- `npm run lint` — pass.
- `npm run audit:classes` — pass.
- `npm run build` — pass.
- Screenshot harness (`node scripts/observe-shots.mjs`) — pass, end to end.
- `npm test` — **pass with a documented environment flake**: all 20 test files and all 330 tests pass
  when each file runs in isolation (verified for the full suite per-file and re-confirmed for the
  files below), but a full parallel run spawns 20 vitest workers in a memory-constrained sandbox and
  intermittently fails a *different* unrelated test each run on the fixed 5-second timeout (observed
  across separate runs: `app.test.tsx > workspace keys`, then `measurement.test.tsx > a measurement
  pass`, then neither). The failures are timeouts under load, not assertion failures, and do not
  reproduce in isolation. This is a sandbox resource limit, not a code change in this pass.
- Playwright e2e (`npm run test:e2e`): **not run.** The environment only provides a system Chromium
  155 with no Playwright browser bundle, and the Playwright config pins its own bundled browser —
  the harness above exists to cover capture verification in exactly this situation.

No check was skipped silently; anything not executed is stated as not run, and nothing was reported
as passing that did not.

### Screenshots not committed

The six PNG captures themselves (see the commit-status note above): they exist in the working tree at
`docs/screenshots/observe-handoff/` and are reproducible from the committed harness, but could not be
pushed through the text-only commit tooling available in this environment. In addition, the optional
empty/unsupported states are reachable through `useSessionStore`'s loader seam but are not captured
by this script.

## Synthetic-data assumptions

- All data in this concept is synthetic and labelled: `SyntheticTag` ("SYNTHETIC DATA")
  in the shell, and "all data is synthetic · nothing is connected to a runtime" in the
  status bar.
- `sessionStore`'s default loader reads `src/data/fixtures.ts` (six sessions, scenarios
  A–F) and reports projection `v1` for each, which is in `SUPPORTED_PROJECTIONS`.
- No state inventures placeholder values: missing numbers are withheld with a reason
  (hatched swatch), never rendered as zero; failure text never backs a fabricated table.

## Accessibility

- Loading uses `role="status"` with `aria-live="polite"`; the spinner is disabled under
  reduced motion (`motion-reduce:animate-none`).
- Retry carries an sr-only suffix so screen readers read a full sentence; the failure
  state explains that nothing below it is fabricated.
- The partial-unsupported banner is `role="status"`.
- Keyboard navigation, focus treatment, and the skip link are unchanged from the
  baseline design; workspace shortcuts (1–4) still work.
- Colour discipline is enforced by test: `fg-4` (below the contrast floor) may only
  colour icons that sit next to their own explanatory sentence (reviewed allowlist in
  `tokens.test.ts`).

## Responsive behaviour and limitations

- Desktop and narrow widths both captured; the workspace collapses to a single column
  below the desktop breakpoint with the event table prioritised.
- Known limitation carried over from the design direction: the event inspector becomes
  a modal below 1024px rather than a side column; the narrow captures show the
  table-first layout, not the modal.
- The 420×800 captures are representative of small laptop / large phone width, not a
  full mobile audit; touch targets were not re-audited in this pass.

## What stays concept-only

- The fixture data and the synchronous default loader — production must supply a real
  `SessionLoader` over the API; nothing else in the store changes.
- `read-only` shell status and the "nothing is connected to a runtime" footer are
  honest labels for the concept, not production copy.
- Compare, Capabilities and Evolve remain demonstration views; this pass deliberately
  did not touch their logic.
- No new dependencies were added; no API, backend, or auth surface was created.
