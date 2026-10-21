import type { ReactNode } from 'react';

/** Three columns: a list of records, a dossier on the selected one, and an inspector. Used by every lab section but the graph. */
export function Split({ list, children, inspector }: { list: ReactNode; children: ReactNode; inspector?: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row">
      {/* Below md the list sits above the dossier (a short scrolling strip) instead of disappearing: it is the only way to pick a record. */}
      <div className="flex max-h-[30vh] w-full shrink-0 flex-col border-b border-line bg-surface-1 md:max-h-none md:w-[272px] md:border-b-0 md:border-r 2xl:w-[300px]">{list}</div>
      <div className="min-w-0 flex-1 overflow-y-auto scrollbar-thin">{children}</div>
      {inspector}
    </div>
  );
}

export function ListPane({ title, count, children, footer }: { title: string; count: number; children: ReactNode; footer?: ReactNode }) {
  return (
    <>
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-4">
        <h2 className="eyebrow">{title}</h2>
        <span className="font-mono text-2xs text-fg-3 tnum">{count}</span>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto scrollbar-thin py-1">{children}</ul>
      {footer}
    </>
  );
}

/** One record in a list. Selection is a lifted surface and an ivory edge: the same convention as every other selected row. */
export function ListItem({ selected, onClick, children, label }: { selected: boolean; onClick: () => void; children: ReactNode; label: string }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={selected ? 'true' : undefined}
        aria-label={label}
        className={`relative block w-full px-4 py-2.5 text-left transition-colors duration-100 ${selected ? 'bg-surface-3' : 'hover:bg-surface-2'}`}
      >
        {selected && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-select" />}
        {children}
      </button>
    </li>
  );
}

export function DossierBody({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[980px] space-y-7 px-6 py-6">{children}</div>;
}

export function DossierHeader({ eyebrow, title, lede, tags }: { eyebrow: ReactNode; title: ReactNode; lede?: ReactNode; tags?: ReactNode }) {
  return (
    <header>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-2xs text-fg-3">{eyebrow}</div>
      <h2 className="mt-1.5 font-serif text-2xl leading-tight text-fg-1">{title}</h2>
      {lede && <p className="mt-2 max-w-[68ch] text-sm leading-relaxed text-fg-2">{lede}</p>}
      {tags && <div className="mt-3 flex flex-wrap items-center gap-2">{tags}</div>}
    </header>
  );
}

/** A titled block in a dossier: bolder than an inspector section, because a dossier is read, not scanned. */
export function Block({ title, note, children, id }: { title: ReactNode; note?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id}>
      <div className="mb-3 border-b border-line pb-2">
        <h3 id={id} className="text-sm font-medium text-fg-1">{title}</h3>
        {note && <p className="mt-0.5 max-w-[78ch] text-2xs leading-snug text-fg-3">{note}</p>}
      </div>
      {children}
    </section>
  );
}
