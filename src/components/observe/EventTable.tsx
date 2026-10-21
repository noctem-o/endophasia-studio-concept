import { useCallback, useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { Link2 } from 'lucide-react';
import type { TrajectoryEvent } from '../../domain/types';
import { categoryMeta } from '../../state/meta';
import { formatOffset } from '../../state/observe';
import { ProvStack, StatusMark } from '../../ui/marks';
import { Badge, EmptyState } from '../../ui/layout';

const uniqueKinds = (e: TrajectoryEvent) => [...new Set(e.evidence.map((x) => x.kind))];

/**
 * The detail view of the trajectory: every event, in storage order. It is a grid with one tab stop (the selected row, or the
 * first), arrow/Home/End movement, and Enter/Space to select. `onWindow` reports which events are scrolled into view, so the
 * overview above can bracket the same stretch of the trajectory.
 */
export function EventTable({ events, selectedId, hoveredId, onSelect, onHover, onWindow, emptyHint }: {
  events: TrajectoryEvent[];
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onWindow: (range: [number, number] | null) => void;
  emptyHint?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());

  const reportWindow = useCallback(() => {
    const box = scrollRef.current;
    if (!box || events.length === 0) { onWindow(null); return; }
    const area = box.getBoundingClientRect();
    const head = box.querySelector('thead')?.getBoundingClientRect().height ?? 0;
    let first: number | null = null;
    let last: number | null = null;
    for (const e of events) {
      const row = rowRefs.current.get(e.id);
      if (!row) continue;
      // Geometry from bounding rects, not offsetTop: a <tr>'s offsetParent is not the scroll box.
      const r = row.getBoundingClientRect();
      if (r.bottom > area.top + head && r.top < area.bottom) {
        if (first === null) first = e.seq;
        last = e.seq;
      }
    }
    onWindow(first === null || last === null ? null : [first, last]);
  }, [events, onWindow]);

  useEffect(() => {
    const id = requestAnimationFrame(reportWindow);
    return () => cancelAnimationFrame(id);
  }, [reportWindow]);

  useEffect(() => {
    const box = scrollRef.current;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(reportWindow);
    ro.observe(box);
    return () => ro.disconnect();
  }, [reportWindow]);

  // Keep the selection in view, whichever surface moved it.
  useEffect(() => {
    if (selectedId) rowRefs.current.get(selectedId)?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedId]);

  const tabStop = events.find((e) => e.id === selectedId)?.id ?? events[0]?.id;

  const onKeyDown = (e: KeyboardEvent<HTMLTableSectionElement>) => {
    // Arrow keys move from the row that has focus (a keyboard user who just tabbed in has focus on the first row, selection on none).
    const focusedRow = (e.target as HTMLElement).closest('tr');
    const focusedIndex = focusedRow ? events.findIndex((x) => rowRefs.current.get(x.id) === focusedRow) : -1;
    const i = focusedIndex >= 0 ? focusedIndex : events.findIndex((x) => x.id === selectedId);
    const move = (to: number) => {
      const target = events[Math.max(0, Math.min(events.length - 1, to))];
      if (!target) return;
      e.preventDefault();
      onSelect(target.id);
      requestAnimationFrame(() => rowRefs.current.get(target.id)?.focus());
    };
    if (e.key === 'ArrowDown') move(i + 1);
    else if (e.key === 'ArrowUp') move(i < 0 ? 0 : i - 1);
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(events.length - 1);
  };

  return (
    <div ref={scrollRef} onScroll={reportWindow} className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
      <table role="grid" aria-label="Events in storage order" aria-rowcount={events.length + 1} className="w-full text-left text-xs">
        <thead className="sticky top-0 z-10 bg-surface-1 shadow-hairline">
          <tr role="row" className="eyebrow">
            <th role="columnheader" scope="col" className="w-[52px] py-2 pl-4 pr-2 text-right font-medium">seq</th>
            <th role="columnheader" scope="col" className="hidden w-[76px] px-2 py-2 font-medium sm:table-cell">offset</th>
            <th role="columnheader" scope="col" className="px-2 py-2 font-medium">event</th>
            <th role="columnheader" scope="col" className="hidden w-[128px] px-2 py-2 font-medium md:table-cell">category</th>
            <th role="columnheader" scope="col" className="w-[72px] px-2 py-2 font-medium">evidence</th>
            <th role="columnheader" scope="col" className="w-[76px] px-2 py-2 font-medium">status</th>
            <th role="columnheader" scope="col" className="hidden px-2 py-2 font-medium xl:table-cell">summary</th>
            <th role="columnheader" scope="col" className="w-[44px] py-2 pl-2 pr-4 text-right font-medium"><span className="sr-only">relations</span></th>
          </tr>
        </thead>
        <tbody onKeyDown={onKeyDown}>
          {events.map((e) => {
            const cm = categoryMeta[e.category];
            const Icon = cm.icon;
            const selected = e.id === selectedId;
            const hovered = e.id === hoveredId;
            const refs = e.refs?.length ?? 0;
            return (
              <tr
                key={e.id}
                ref={(el) => { if (el) rowRefs.current.set(e.id, el); else rowRefs.current.delete(e.id); }}
                role="row"
                aria-selected={selected}
                tabIndex={e.id === tabStop ? 0 : -1}
                data-seq={e.seq}
                onClick={() => onSelect(e.id)}
                onFocus={() => onHover(e.id)}
                onBlur={() => onHover(null)}
                onMouseEnter={() => onHover(e.id)}
                onMouseLeave={() => onHover(null)}
                onKeyDown={(ev) => { if ((ev.key === 'Enter' || ev.key === ' ') && ev.target === ev.currentTarget) { ev.preventDefault(); onSelect(e.id); } }}
                className={`group relative h-8 cursor-pointer border-b border-line-subtle outline-offset-[-2px] transition-colors duration-75 ${selected ? 'bg-surface-3' : hovered ? 'bg-surface-2' : ''}`}
              >
                <td role="gridcell" className="relative py-1 pl-4 pr-2 text-right font-mono text-2xs text-fg-3 tnum">
                  {selected && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-select" />}
                  {e.seq}
                </td>
                <td role="gridcell" className="hidden px-2 py-1 font-mono text-2xs text-fg-3 tnum sm:table-cell">{formatOffset(e.offsetMs)}</td>
                <td role="gridcell" className="max-w-0 px-2 py-1">
                  <div className="flex items-center gap-2">
                    <span className={`truncate font-medium ${selected ? 'text-fg-1' : 'text-fg-1'}`}>{e.title}</span>
                    {e.tool && !e.title.includes(e.tool) && <Badge className="shrink-0">{e.tool}</Badge>}
                  </div>
                </td>
                <td role="gridcell" className="hidden px-2 py-1 md:table-cell">
                  <span className="inline-flex items-center gap-1.5 font-mono text-2xs text-fg-2">
                    <Icon className="h-3 w-3 text-fg-3" aria-hidden />
                    {cm.name}
                  </span>
                </td>
                <td role="gridcell" className="px-2 py-1"><ProvStack kinds={uniqueKinds(e)} /></td>
                <td role="gridcell" className="px-2 py-1"><StatusMark status={e.status} /></td>
                <td role="gridcell" className="hidden max-w-0 px-2 py-1 text-fg-3 xl:table-cell"><div className="truncate">{e.summary}</div></td>
                <td role="gridcell" className="py-1 pl-2 pr-4 text-right">
                  {refs > 0 && (
                    <span className="inline-flex items-center gap-0.5 font-mono text-2xs text-fg-3" title={`Recorded relations: ${(e.refs ?? []).map((r) => r.relation).join(', ')}`}>
                      <Link2 className="h-3 w-3" aria-hidden />{refs}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {events.length === 0 && <EmptyState title="No events match" hint={emptyHint ?? 'Nothing is hidden by accident: loosen the filters, or reset them.'} className="py-16" />}
    </div>
  );
}
