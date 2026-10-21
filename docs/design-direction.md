# Endophasia Studio — design direction (draft for review)

## Thesis

Endophasia is an instrument for deciding **how much a record can be trusted**. The interface's job is to make the
epistemic status of every mark legible before its content is. Today it does not: one hue means five unrelated things
(teal is *observed evidence*, an *ok* status, the *tool* category, an *admitted* capability, an *exact* match and the
*selection* accent), so colour cannot be trusted as a signal.

Direction: **a quiet specimen-cabinet instrument.** Warm graphite surfaces, ivory type, one serif voice for titles and
captions (the register of a lab notebook / journal figure), mono for identifiers and recorded values. Colour is a
scarce resource that is spent on exactly one thing: **evidence provenance**. Everything else is carried by form.

## The epistemic grammar (shared by every workspace)

| Channel | Carries | Never carries |
| --- | --- | --- |
| **Hue** | Provenance class only: OBS teal, REP blue, DER violet, N/A slate. Plus *attention* (amber = degraded / partial / differs) and *fault* (red = error / mismatch) | category, selection, "ok", identity |
| **Texture** | Epistemic status: **solid = recorded**, dashed = proposed / derived, hatched = simulated or synthetic, hollow = unavailable | meaning that hue already says |
| **Position** | Category (swimlanes), storage order, side (A / B) | |
| **Ivory (neutral)** | Selection and focus — no hue, so selecting something never changes what it appears to be | |

Consequences: "ok" is not coloured (health is the default, deviation is what is marked); a proposed correspondence is a
dashed violet link, never the colour of an exact match; a simulated projection is hatched, never the colour or weight of a
trial result; **SYNTHETIC DATA** is a hatched tag in neutral ivory, not an evidence colour.

## Structure

- **Shell**: one thin chassis. Brand mark (three lanes, echoing the ribbon), workspace tabs with `1`–`4` keys, a persistent
  `read-only` lock and a hatched `SYNTHETIC DATA` tag, and a status bar that always states what is selected and that nothing
  is connected to a runtime.
- **Observe**: the trajectory becomes a swimlane **overview** (lanes by category, storage order on x, provenance on the mark,
  error ring, intervention dashes) sitting directly above the **detail** table, linked both ways, with a scroll window
  bracket showing which part of the trajectory the table is showing. Filters dim, they do not delete: a filtered trajectory
  is still seen in context. The inspector opens on a *session brief*, not an empty state.
- **Compare**: a correspondence map (A | links | B) in each trajectory's own storage order. Exact = solid link, proposed =
  dashed, unmatched = open stub with no link. Differences (status, evidence class, compared fields) are marked on the link
  without any "match score". The methodology is always one click away and the map says what it cannot establish.
- **Capabilities**: a matrix — declared (REP) against observed (OBS) with exercised positions plotted along the trajectory —
  and a source ledger whose conditions filter the matrix through the evidence that cites them.
- **Evolve** (Counterfactual Laboratory): one lab with four sections (Lineage, Experiments, Candidates, Checkpoints) and a
  record inspector. Selecting a node no longer navigates away from the graph. The lineage renderer sits inside the same
  chrome: its toolbar is the legend, nodes use the provenance grammar, and recorded / replay / continuation / simulated are
  four visibly different things. Pass rates are Wilson interval bars with their denominators; missing is hatched, never an
  empty bar. Promotion is a row of separate gates, not a pipeline arrow.

## Out of scope / preserved

All data stays synthetic and labelled; the app stays read-only; scene schemas, renderer adapters, the coordinate
convention, WebGL resource management and the measurement harness are not rewritten (palette constants and node *styling*
only).
