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
  returns per state before the normal layout renders.
- `src/components/observe/ProjectionNotice.tsx` — partial-unsupported banner and
  re-export of the full-unsupported state.
- `src/components/observe/SessionBrief.tsx` — degraded-source callout, condition tags.
- `src/__tests__/states.test.tsx` — behaviour tests for every state (10 tests).
- `scripts/observe-shots.mjs` — screenshot harness (see caveat below).

## Screenshots

`docs/screenshots/observe-handoff/` holds desktop (1440×900) and narrow (420×800)
captures of three Observe states:

- `01-observe-brief` — session brief, populated observation
- `02-observe-event` — event selected, inspector open
- `03-observe-degraded` — scenario D (evidence degradation): error/partial statuses,
  deviations list, and the degraded-source callout

Caveat: the harness script was written for Playwright's own preview-server flow, which
this sandbox cannot run (`vite` as a long-lived server is blocked). The captures above
were taken from the production build served by a static file server, so they show the
real built app; the script itself has not been exercised end-to-end and may need its
server-start step adjusted before CI use. In this pass the PNGs also live only in the
working workspace: the available push tooling commits UTF-8 text only, so binary
screenshot files could not be committed to the branch — re-capture with the harness or
copy the PNGs in when the branch lands on a machine with git access.

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
