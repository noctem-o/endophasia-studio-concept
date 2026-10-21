import type { ReactNode } from 'react';
import type { CapabilityStatus, EvidenceKind, EventStatus, SourceCondition } from '../domain/types';
import { capabilityMeta, evidenceMeta, sourceMeta, statusMeta } from '../state/meta';

/**
 * Marks. Every mark carries its meaning in SHAPE first and hue second, so provenance survives colour-vision deficiency, tiny
 * sizes (the trajectory overview) and monochrome printing:
 *
 *   OBS  ●  filled disc            observed directly
 *   REP  ◐  half-filled disc       reported by a source, not independently confirmed
 *   DER  ◆  diamond                computed through a declared process
 *   N/A  ◌  dashed ring            not recorded — and drawn hollow so absence never looks like a value
 */

const PROV_TITLE = (kind: EvidenceKind) => `${evidenceMeta[kind].full} — ${evidenceMeta[kind].desc}`;

export function ProvGlyph({ kind, size = 12, className = '' }: { kind: EvidenceKind; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden className={`shrink-0 ${evidenceMeta[kind].text} ${className}`}>
      {kind === 'OBS' && <circle cx="6" cy="6" r="4.4" fill="currentColor" />}
      {kind === 'REP' && (
        <>
          <circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M6 2a4 4 0 0 0 0 8z" fill="currentColor" />
        </>
      )}
      {kind === 'DER' && <path d="M6 1 11 6 6 11 1 6z" fill="currentColor" />}
      {kind === 'NA' && <circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2 1.7" />}
    </svg>
  );
}

/** Glyph plus (optionally) its three-letter label, no box: for dense rows and running text. */
export function ProvMark({ kind, label = true, size = 12, title }: { kind: EvidenceKind; label?: boolean; size?: number; title?: string }) {
  const m = evidenceMeta[kind];
  return (
    <span title={title ?? PROV_TITLE(kind)} className={`inline-flex items-center gap-1 ${m.text}`}>
      <ProvGlyph kind={kind} size={size} />
      {label ? <span className="font-mono text-2xs font-medium tracking-wider">{m.label}</span> : <span className="sr-only">{m.full}</span>}
    </span>
  );
}

/** The bordered form, for places where a class is a statement about a record (evidence rows, inspector headers). */
export function ProvTag({ kind, title }: { kind: EvidenceKind; title?: string }) {
  const m = evidenceMeta[kind];
  return (
    <span title={title ?? PROV_TITLE(kind)} className={`inline-flex h-5 items-center gap-1 rounded-tag border px-1.5 ${m.text} ${m.border} ${m.bg}`}>
      <ProvGlyph kind={kind} size={10} />
      <span className="font-mono text-2xs font-medium tracking-wider">{m.label}</span>
    </span>
  );
}

/** Several classes at once (an event's evidence items), strongest first. */
export function ProvStack({ kinds }: { kinds: EvidenceKind[] }) {
  if (kinds.length === 0) return <span className="font-mono text-2xs text-fg-3" title="No evidence items on this record">—</span>;
  return (
    <span className="inline-flex items-center gap-1" role="img" aria-label={kinds.map((k) => evidenceMeta[k].full).join(', ')}>
      {kinds.map((k, i) => (
        <span key={i} title={PROV_TITLE(k)}>
          <ProvGlyph kind={k} size={11} />
        </span>
      ))}
    </span>
  );
}

// ─── Status ──────────────────────────────────────────────────────────────────

/** Health is the default and is not coloured. A deviation (error, partial) is marked with both a shape and its hue. */
export function StatusMark({ status, showOk = false }: { status: EventStatus; showOk?: boolean }) {
  const m = statusMeta[status];
  if (!m.marked) {
    return showOk ? <span className="font-mono text-2xs text-fg-3">ok</span> : <span className="sr-only">ok</span>;
  }
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-2xs font-medium ${m.text}`}>
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
        {status === 'error' ? (
          <path d="M2 2 8 8M8 2 2 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        ) : (
          <>
            <circle cx="5" cy="5" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <path d="M5 1.4a3.6 3.6 0 0 1 0 7.2z" fill="currentColor" />
          </>
        )}
      </svg>
      {m.label}
    </span>
  );
}

// ─── Capabilities and sources ────────────────────────────────────────────────

export function CapabilityGlyph({ status, size = 12, className = '' }: { status: CapabilityStatus; size?: number; className?: string }) {
  const m = capabilityMeta[status];
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" role="img" aria-label={m.label} className={`shrink-0 ${m.text} ${className}`}>
      <title>{`${m.label} — ${m.desc}`}</title>
      {status === 'admitted' && <circle cx="6" cy="6" r="4.4" fill="currentColor" />}
      {status === 'partially-admitted' && (
        <>
          <circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M6 2a4 4 0 0 1 0 8z" fill="currentColor" />
        </>
      )}
      {status === 'unverified' && <path d="M6 1.6 10.4 6 6 10.4 1.6 6z" fill="none" stroke="currentColor" strokeWidth="1.3" />}
      {status === 'mismatched' && <path d="M6 1.4 11 10.4H1z" fill="currentColor" />}
      {status === 'unavailable' && <circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2 1.7" />}
    </svg>
  );
}

export function SourceGlyph({ condition, size = 12 }: { condition: SourceCondition; size?: number }) {
  const m = sourceMeta[condition];
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" role="img" aria-label={m.label} className={`shrink-0 ${m.text}`}>
      <title>{`${m.label} — ${m.desc}`}</title>
      {condition === 'readable' && <circle cx="6" cy="6" r="4.4" fill="currentColor" />}
      {condition === 'empty' && <circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" strokeWidth="1.4" />}
      {condition === 'absent' && <path d="M2 6h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}
      {condition === 'degraded' && (
        <>
          <circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M6 2a4 4 0 0 0 0 8z" fill="currentColor" />
        </>
      )}
      {condition === 'unopenable' && <path d="M2.6 2.6 9.4 9.4M9.4 2.6 2.6 9.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}
    </svg>
  );
}

export function SourceConditionTag({ condition }: { condition: SourceCondition }) {
  const m = sourceMeta[condition];
  return (
    <span title={m.desc} className={`inline-flex h-5 items-center gap-1.5 rounded-tag border px-1.5 font-mono text-2xs font-medium tracking-wider ${m.text} ${m.border} ${m.bg}`}>
      <SourceGlyph condition={condition} size={10} />
      {m.label}
    </span>
  );
}

// ─── Identity marks ──────────────────────────────────────────────────────────

const LOGO_OUTER = 'M6.45 4.00 Q6.45 2.00 8.28 2.82 L15.72 6.15 Q17.55 6.97 17.53 8.97 L17.45 19.98 Q17.43 21.98 15.56 21.29 L8.33 18.60 Q6.45 17.91 6.45 15.91Z';
const LOGO_INNER = 'M8.12 10.48 Q8.12 8.98 9.48 8.36 L12.57 6.96 Q13.94 6.35 14.02 7.84 L14.55 17.19 Q14.64 18.68 13.25 18.12 L9.51 16.61 Q8.12 16.05 8.12 14.55Z';

/**
 * The mark: two asymmetric, nested forms that leave an open frame around a small area of negative space. Observation, introspection,
 * and the boundary between what is visible and what stays hidden. It is deliberately an independent symbol, not an illustration
 * (and carries no evidence colour). Drawn as fine line art in the ivory ink; the inner form is a touch heavier so it holds at 24px.
 */
export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeLinejoin="round" strokeLinecap="round" className="shrink-0 text-fg-1">
      <path d={LOGO_OUTER} strokeWidth="0.95" />
      <path d={LOGO_INNER} strokeWidth="1.2" />
    </svg>
  );
}

/** Persistent and unmistakable. Hatched neutral — texture, not an evidence hue — so it can never be read as a provenance class. */
export function SyntheticTag({ children = 'SYNTHETIC DATA', title }: { children?: ReactNode; title?: string }) {
  return (
    <span
      title={title ?? 'Every record shown is a fixture authored to exercise the interface. Nothing is connected to a runtime.'}
      className="hatch inline-flex h-6 items-center rounded-tag border border-line-strong bg-surface-1 px-2 font-mono text-2xs font-semibold tracking-[0.14em] text-fg-1"
    >
      {children}
    </span>
  );
}
