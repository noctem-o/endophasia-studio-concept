import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import type { EvidenceKind } from '../domain/types';
import { ProvMark } from './marks';

/** A header band: the same height and anatomy on every panel, so panels read as one family. */
export function PanelHeader({ title, eyebrow, actions, className = '' }: { title?: ReactNode; eyebrow?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={`flex min-h-[40px] shrink-0 items-center gap-3 border-b border-line px-4 ${className}`}>
      <div className="min-w-0 flex-1">
        {eyebrow && <div className="eyebrow truncate">{eyebrow}</div>}
        {title && <h2 className="truncate text-sm font-medium text-fg-1">{title}</h2>}
      </div>
      {actions}
    </div>
  );
}

/** An inspector section: a label, an optional right-hand note, an optional disclosure. One anatomy for every inspector. */
export function Section({ title, note, children, collapsible = false, defaultOpen = true, className = '' }: {
  title: ReactNode;
  note?: ReactNode;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const shown = !collapsible || open;
  return (
    <section className={`border-t border-line-subtle pt-3 first:border-t-0 first:pt-0 ${className}`}>
      <div className="mb-2 flex items-center gap-2">
        {collapsible ? (
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={id} className="eyebrow group flex items-center gap-1 hover:text-fg-1">
            <ChevronRight className={`h-3 w-3 transition-transform duration-100 ${open ? 'rotate-90' : ''}`} aria-hidden />
            {title}
          </button>
        ) : (
          <h3 className="eyebrow">{title}</h3>
        )}
        {note && <span className="ml-auto font-mono text-2xs text-fg-3">{note}</span>}
      </div>
      {shown && <div id={id}>{children}</div>}
    </section>
  );
}

/** Label/value rows with one fixed label column, so values align down an entire inspector. */
export function DefList({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <dl className={`grid grid-cols-[112px_minmax(0,1fr)] gap-x-3 gap-y-1.5 ${className}`}>{children}</dl>;
}

export function Def({ k, children, mono = true, prov }: { k: ReactNode; children: ReactNode; mono?: boolean; prov?: EvidenceKind }) {
  return (
    <>
      <dt className="min-w-0 pt-px font-mono text-2xs text-fg-3 [overflow-wrap:anywhere]">{k}</dt>
      <dd className={`min-w-0 break-words text-xs text-fg-1 ${mono ? 'font-mono' : ''}`}>
        {children}
        {prov && <span className="ml-2 align-middle"><ProvMark kind={prov} /></span>}
      </dd>
    </>
  );
}

export function EmptyState({ title, hint, icon, className = '' }: { title: string; hint?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div className={`flex h-full flex-col items-center justify-center gap-2 px-8 py-10 text-center ${className}`}>
      {icon}
      <div className="eyebrow">{title}</div>
      {hint && <p className="max-w-[300px] text-xs leading-relaxed text-fg-3">{hint}</p>}
    </div>
  );
}

/** Missing is never shown as zero or blank: it is said, with its reason. */
export function NotRecorded({ what, reason }: { what?: string; reason?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-2xs text-fg-3" title={reason}>
      <span className="hatch-faint inline-block h-2.5 w-4 rounded-tag border border-line" aria-hidden />
      {what ? `${what} · not recorded` : 'not recorded'}
      {reason && <span className="text-fg-3">— {reason}</span>}
    </span>
  );
}

type Tone = 'neutral' | 'attn' | 'fault';
const callout: Record<Tone, string> = {
  neutral: 'border-line bg-surface-2',
  attn: 'border-attn/40 bg-attn/10',
  fault: 'border-fault/40 bg-fault/10',
};
const calloutTitle: Record<Tone, string> = { neutral: 'text-fg-2', attn: 'text-attn', fault: 'text-fault' };

export function Callout({ tone = 'neutral', title, children, className = '' }: { tone?: Tone; title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-ctl border px-3 py-2.5 ${callout[tone]} ${className}`}>
      {title && <div className={`font-mono text-2xs font-medium uppercase tracking-[0.12em] ${calloutTitle[tone]}`}>{title}</div>}
      <div className={`text-xs leading-relaxed text-fg-2 ${title ? 'mt-1' : ''}`}>{children}</div>
    </div>
  );
}

/** A small neutral label, e.g. a category or a kind. Not for evidence classes (use ProvTag) or deviations (use StatusMark). */
export function Badge({ children, className = '', title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={`inline-flex h-5 items-center gap-1 rounded-tag border border-line bg-surface-2 px-1.5 font-mono text-2xs font-medium tracking-wider text-fg-2 ${className}`}>
      {children}
    </span>
  );
}
