import { AlertTriangle, CircleSlash, Database, Loader2, Puzzle } from 'lucide-react';
import { Callout, EmptyState } from './layout';

/**
 * Presentation states shared by every workspace, built so a production data layer can drop in behind the same contracts the
 * fixtures use today. Design rules these components enforce (docs/design-direction.md):
 * - an empty result is explained, never styled as failure;
 * - loading, failure and empty look different at a glance;
 * - missing information is stated with its reason — never zero, never blank;
 * - a compatibility limit is identified as such; the data is never guessed at.
 * All are static compositions (no data fetching): the workspace owns its state machine and renders one of these.
 */

// ─── Empty store ─────────────────────────────────────────────────────────────

/** A store with no recorded sessions: the instrument at rest, not an error. */
export function EmptyStoreState({ onHintAction, hintActionLabel }: { onHintAction?: () => void; hintActionLabel?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 py-12 text-center">
      <Database className="h-5 w-5 text-fg-4" aria-hidden />
      <div className="eyebrow">No recorded sessions</div>
      <p className="max-w-[360px] text-xs leading-relaxed text-fg-3">
        This store holds no observation records yet. Record a session from a connected runtime and it will appear here — until
        then there is nothing to inspect, and that is the expected state, not a failure.
      </p>
      {onHintAction && hintActionLabel && (
        <button type="button" onClick={onHintAction} className="rounded-ctl border border-line bg-surface-2 px-3 py-1.5 font-mono text-2xs text-fg-2 transition-colors duration-100 hover:border-line-strong hover:text-fg-1">
          {hintActionLabel}
        </button>
      )}
    </div>
  );
}

// ─── Loading ─────────────────────────────────────────────────────────────────

/** Data requested and in flight. Deliberately distinct from empty (no store icon, no explanation) and from failure (no red). */
export function LoadingState({ what = 'sessions' }: { what?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 py-12 text-center" role="status" aria-live="polite">
      <Loader2 className="h-4 w-4 animate-spin text-fg-3 motion-reduce:animate-none" aria-hidden />
      <div className="eyebrow">Loading {what}</div>
      <p className="max-w-[320px] text-xs leading-relaxed text-fg-3">Reading from the store. This will resolve on its own; no action is needed.</p>
    </div>
  );
}

// ─── Request failure ─────────────────────────────────────────────────────────

/** The store could not be read. Distinct from empty: it says what failed and offers retry. */
export function LoadFailureState({ what = 'sessions', detail, onRetry }: { what?: string; detail?: string; onRetry?: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 py-12 text-center">
      <AlertTriangle className="h-5 w-5 text-attn" aria-hidden />
      <div className="eyebrow">Could not load {what}</div>
      <p className="max-w-[360px] text-xs leading-relaxed text-fg-3">
        The store did not answer. {detail ? detail + ' ' : ''}Nothing below this point is fabricated to fill the gap.
      </p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="rounded-ctl border border-line bg-surface-2 px-3 py-1.5 font-mono text-2xs text-fg-2 transition-colors duration-100 hover:border-line-strong hover:text-fg-1">
          Try again
          <span className="sr-only"> loading {what}</span>
        </button>
      )}
    </div>
  );
}

// ─── Unsupported projection version ─────────────────────────────────────────

/** A record whose projection version this build cannot read. The limitation is named; the data is never guessed at. */
export function UnsupportedProjectionState({ version, supported }: { version: string; supported: readonly string[] }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 py-12 text-center">
      <Puzzle className="h-5 w-5 text-fg-4" aria-hidden />
      <div className="eyebrow">Projection not readable here</div>
      <p className="max-w-[380px] text-xs leading-relaxed text-fg-3">
        This record was written by projection <span className="font-mono text-fg-2">{version}</span>. This build reads
        {' '}
        {supported.length === 0 ? 'no projections' : supported.map((v, i) => (
          <span key={v}>
            {i > 0 && (i === supported.length - 1 ? ' and ' : ', ')}
            <span className="font-mono text-fg-2">{v}</span>
          </span>
        ))}
        . It is a compatibility limit of this viewer, not a problem with the record — nothing is inferred to fill the gap.
      </p>
    </div>
  );
}

// ─── Unavailable evidence ────────────────────────────────────────────────────

/**
 * Evidence that exists as a fact but whose content is not shown: withheld payloads, sources that cannot be opened, unsupported
 * details. The reason leads; the shape (hatched neutral) says the content is absent, not zero.
 */
export function WithheldEvidence({ what, reason }: { what: string; reason: string }) {
  return (
    <div className="rounded-ctl border border-line bg-surface-1 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="hatch-faint inline-block h-2.5 w-4 rounded-tag border border-line" aria-hidden />
        <span className="font-mono text-2xs font-medium tracking-wider text-fg-2">{what}</span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-fg-3">{reason}</p>
    </div>
  );
}

/** A degraded source: prominent (attention hue) and restrained (no alarm, explanation attached). */
export function DegradedSourceCallout({ name, detail }: { name: string; detail: string }) {
  return (
    <Callout tone="attn" title={`source degraded — ${name}`}>
      {detail}
    </Callout>
  );
}

/** An unsupported detail whose shape/kind this build cannot render — rendered as a named gap, never skipped silently. */
export function UnsupportedDetail({ kind, hint }: { kind: string; hint?: string }) {
  return (
    <div className="flex items-start gap-2 rounded-ctl border border-dashed border-line-strong bg-surface-1 px-3 py-2.5">
      <CircleSlash className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-4" aria-hidden />
      <p className="text-xs leading-relaxed text-fg-3">
        Detail of kind <span className="font-mono text-fg-2">{kind}</span> is not rendered by this build. {hint ?? 'Its content is left exactly as recorded; nothing is inferred from it.'}
      </p>
    </div>
  );
}

export { EmptyState };
