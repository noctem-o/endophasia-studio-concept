# Endophasia — design direction

## Thesis

Endophasia is an instrument for deciding **how much a record can be trusted**. The interface's job is to make the epistemic status
of every mark legible before its content is. The prototype did not do this: one hue meant five unrelated things (teal was *observed
evidence*, an *ok* status, the *tool* category, an *admitted* capability, an *exact* match and the *selection* accent), so colour
could not be trusted as a signal.

Direction: **a quiet specimen-cabinet instrument.** Warm graphite surfaces, ivory type, mono for identifiers and recorded values,
and a serif voice used sparingly — the wordmark, session and dossier titles, the lab title — in the register of a lab notebook.
Colour is a scarce resource.

## The epistemic grammar (shared by every workspace)

| Channel | Carries | Never carries |
| --- | --- | --- |
| **Hue: provenance** | OBS teal, REP blue, DER violet, N/A slate | category, selection, "ok", identity |
| **Hue: attention / fault** | amber = degraded, partial, differs; red = error, mismatch, rejection | success |
| **Hue: structure (lineage graph only)** | sage = replay; violet = simulated projection (the scene marks it derived); neutral greys for the other relations | evidence |
| **Texture** | solid = recorded, dashed = proposed, hatched = simulated or synthetic, hollow = unavailable | meaning that hue already says |
| **Shape** | every provenance class has its own: ● ◐ ◆ ◌ | |
| **Position** | category (swimlanes), storage order, side (A / B) | |
| **Ivory (neutral)** | selection and focus — never a hue, so selecting something never changes what it looks like | |

"Only provenance gets hue" is therefore not literally true, and this table says what is. Consequences:

- "ok" is not coloured: health is the default, and deviation is what is marked.
- A proposed correspondence is a dashed link, **not** a provenance colour: exact and proposed are outputs of the same declared
  method, so painting one violet would assert a provenance difference the method does not make. The three link kinds differ by form.
- A simulated projection is hatched and hollow, never the weight or colour of a trial.
- `SYNTHETIC DATA` is a hatched neutral tag — texture, not an evidence hue.
- A "declared" or "observed" mark is drawn only when evidence of that class backs it.
- Pass rates are intervals with the denominator beside them; a missing result is hatched, never an empty bar.

## Constraints from the renderers

The default lineage backend is WebGL. Its per-node channels are a fill, a stroke and a selected flag, and it draws every edge
solid, so the lineage encoding was designed from WebGL outward: node paint is one pure function (`nodePaint`) used by both
backends, hollow means a see-through fill, and relations differ by colour (held to a perceptual floor, OKLab ΔE ≥ 0.08), with dashes
as an SVG-only extra. Neither backend's resource management, coordinate transforms or measurement code was changed.

## Structure

- **Shell** — brand mark, workspace buttons with `1`–`4`, a read-only lock, the hatched `SYNTHETIC DATA` tag, a keyboard sheet, and a
  status bar that names the selection.
- **Observe** — a swimlane overview above a detail table, linked both ways; filters dim in the overview and hide in the table; the
  inspector leads with evidence and opens on a session brief.
- **Compare** — a correspondence map in each trajectory's own order; the method is the inspector's resting state.
- **Capabilities** — a matrix of declared against observed, with a source ledger that filters it.
- **Evolve** — one lab (Lineage, Experiments, Candidates, Checkpoints); selecting never leaves the graph; promotion is eight
  separate gates, not a pipeline.

## Known limits

- The WebGL node shader draws a thicker border at the left and right than at the top and bottom (`ring` is a fraction of the node
  size). It is unchanged: shader work was out of scope.
- WebGL was verified only under a software rasteriser. Under tritanopia the WebGL relation lines are weak (evaluated-against and
  replay are both pale cyan-greens); the key, the toggles and the inspector name each relation.
- Below 1024px the inspectors are drawers; the overview and the Compare map are designed for desktop and laptop widths.
- The lineage layout (layered longest-path) is the scene's declared algorithm and is unchanged, so long edges still cross.
