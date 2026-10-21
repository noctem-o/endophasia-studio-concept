import { useEffect, useMemo, useRef, useState } from 'react';
import type { EventCategory, EvidenceKind, Session, TrajectoryEvent } from '../../domain/types';
import { bestEvidence, categoryMeta, CATEGORY_ORDER, evidenceMeta } from '../../state/meta';
import { formatOffset } from '../../state/observe';
import { Segmented } from '../../ui/controls';
import { ProvGlyph } from '../../ui/marks';

export type OverviewAxis = 'order' | 'time';

const LANE_H = 18;
const TOP = 8;
const AXIS_H = 20;
const GUTTER = 118;
const PAD_R = 18;
const H = TOP + CATEGORY_ORDER.length * LANE_H + AXIS_H;

/** One marker, drawn by its strongest evidence class: the shape carries the class, the hue repeats it. */
function Marker({ kind, x, y, dense, dim }: { kind: EvidenceKind | null; x: number; y: number; dense: boolean; dim: boolean }) {
  const cls = kind ? evidenceMeta[kind].text : 'text-fg-4';
  const r = 4;
  return (
    <g className={cls} opacity={dim ? 0.22 : 1}>
      {dense ? (
        <rect x={x - 1} y={y - (LANE_H - 5) / 2} width={2} height={LANE_H - 5} fill="currentColor" rx={0.5} />
      ) : kind === 'OBS' ? (
        <circle cx={x} cy={y} r={r + 0.4} fill="currentColor" />
      ) : kind === 'REP' ? (
        <>
          <circle cx={x} cy={y} r={r} fill="none" stroke="currentColor" strokeWidth={1.3} />
          <path d={`M${x} ${y - r}a${r} ${r} 0 0 0 0 ${2 * r}z`} fill="currentColor" />
        </>
      ) : kind === 'DER' ? (
        <path d={`M${x} ${y - r - 1}l${r + 1} ${r + 1}l${-(r + 1)} ${r + 1}l${-(r + 1)} ${-(r + 1)}z`} fill="currentColor" />
      ) : kind === 'NA' ? (
        <circle cx={x} cy={y} r={r} fill="none" stroke="currentColor" strokeWidth={1.2} strokeDasharray="2 1.6" />
      ) : (
        <rect x={x - 2.5} y={y - 2.5} width={5} height={5} fill="none" stroke="currentColor" strokeWidth={1} />
      )}
    </g>
  );
}

/**
 * The trajectory as an overview map. Rows (lanes) are event categories; columns are STORAGE ORDER by default (recorded time is an
 * explicit alternative). Provenance is the marker's shape, an error is a red ring, a partial result an amber broken ring, an
 * intervention a dashed ring. Events the current filters hide stay on the map, dimmed, so a filtered view is always read in context.
 * The bracket shows which part of the trajectory the detail table below is currently showing.
 */
export function TrajectoryOverview({ session, matching, selectedId, hoveredId, onSelect, onHover, windowSeq, axis, onAxis }: {
  session: Session;
  matching: ReadonlySet<string>;
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  windowSeq: [number, number] | null;
  axis: OverviewAxis;
  onAxis: (a: OverviewAxis) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setWidth(Math.max(320, el.clientWidth)));
    ro.observe(el);
    setWidth(Math.max(320, el.clientWidth));
    return () => ro.disconnect();
  }, []);

  const events = session.events;
  const n = events.length;
  const x0 = GUTTER;
  const x1 = Math.max(x0 + 40, width - PAD_R);
  const maxOffset = n > 0 ? Math.max(...events.map((e) => e.offsetMs)) : 0;
  const useTime = axis === 'time' && maxOffset > 0;

  const xs = useMemo(() => {
    const map = new Map<string, number>();
    events.forEach((e, i) => {
      const f = useTime ? e.offsetMs / maxOffset : n === 1 ? 0.5 : i / (n - 1);
      map.set(e.id, x0 + 6 + f * (x1 - x0 - 12));
    });
    return map;
  }, [events, n, useTime, maxOffset, x0, x1]);

  const sorted = useMemo(() => [...events].sort((a, b) => (xs.get(a.id) ?? 0) - (xs.get(b.id) ?? 0)), [events, xs]);
  const step = n > 1 ? (x1 - x0 - 12) / (n - 1) : 40;
  const dense = !useTime && step < 12;
  const laneY = (c: EventCategory) => TOP + categoryMeta[c].lane * LANE_H + LANE_H / 2;
  const selected = events.find((e) => e.id === selectedId) ?? null;
  const hovered = events.find((e) => e.id === hoveredId) ?? null;

  // Ticks: storage-order numbers, or recorded-time offsets at round intervals.
  const ticks = useMemo(() => {
    if (n === 0) return [] as { x: number; label: string }[];
    if (useTime) {
      const choices = [1000, 2000, 5000, 10000, 15000, 30000, 60000, 120000, 300000];
      const target = maxOffset / Math.max(2, Math.floor((x1 - x0) / 90));
      const every = choices.find((c) => c >= target) ?? choices[choices.length - 1];
      const out: { x: number; label: string }[] = [];
      for (let t = 0; t <= maxOffset; t += every) out.push({ x: x0 + 6 + (t / maxOffset) * (x1 - x0 - 12), label: t === 0 ? '0s' : formatOffset(t).replace('+', '') });
      return out;
    }
    const every = Math.max(1, Math.ceil(36 / Math.max(step, 1)));
    return events.filter((_, i) => i % every === 0 || i === n - 1).map((e) => ({ x: xs.get(e.id) ?? 0, label: String(e.seq) }));
  }, [events, n, useTime, maxOffset, x0, x1, step, xs]);

  const windowRect = useMemo(() => {
    if (!windowSeq) return null;
    const a = events.find((e) => e.seq === windowSeq[0]);
    const b = events.find((e) => e.seq === windowSeq[1]);
    if (!a || !b) return null;
    const half = Math.max(6, step / 2);
    const xa = (xs.get(a.id) ?? 0) - half;
    const xb = (xs.get(b.id) ?? 0) + half;
    return { x: Math.max(x0, Math.min(xa, xb)), w: Math.abs(xb - xa) };
  }, [windowSeq, events, xs, step, x0]);

  // Hit columns are split between DISTINCT x positions. Events recorded at the same instant share an x (time axis), so they share a
  // column and are told apart by lane instead: each owns only its own lane's band of that column.
  const { colBounds, tied } = useMemo(() => {
    const out = new Map<string, [number, number]>();
    const xsDistinct = [...new Set(sorted.map((e) => xs.get(e.id) ?? 0))];
    const count = new Map<number, number>();
    for (const e of sorted) count.set(xs.get(e.id) ?? 0, (count.get(xs.get(e.id) ?? 0) ?? 0) + 1);
    sorted.forEach((e) => {
      const x = xs.get(e.id) ?? 0;
      const k = xsDistinct.indexOf(x);
      const left = k === 0 ? x0 : (x + xsDistinct[k - 1]) / 2;
      const right = k === xsDistinct.length - 1 ? x1 + PAD_R : (x + xsDistinct[k + 1]) / 2;
      out.set(e.id, [left, right]);
    });
    return { colBounds: out, tied: new Set(sorted.filter((e) => (count.get(xs.get(e.id) ?? 0) ?? 0) > 1).map((e) => e.id)) };
  }, [sorted, xs, x0, x1]);

  const tipEvent = hovered ?? null;
  // Lower lanes open the tooltip upward, so it never covers the controls beneath the overview.
  const tipLane = tipEvent ? categoryMeta[tipEvent.category].lane : 0;
  const tipX = tipEvent ? Math.min(Math.max(xs.get(tipEvent.id) ?? 0, GUTTER + 70), width - 90) : 0;
  const bestOf = (e: TrajectoryEvent) => bestEvidence(e.evidence);

  return (
    <section aria-label="Trajectory overview" className="shrink-0 border-b border-line bg-surface-1">
      <div className="flex items-center gap-4 px-4 pt-2.5">
        <h2 className="eyebrow">Trajectory</h2>
        <span className="font-mono text-2xs text-fg-3">{n} events · {useTime ? 'recorded time' : 'storage order'}</span>
        <ul aria-label="Key" className="ml-auto hidden items-center gap-3 font-mono text-2xs text-fg-3 xl:flex">
          {(['OBS', 'REP', 'DER', 'NA'] as const).map((k) => (
            <li key={k} className="inline-flex items-center gap-1"><ProvGlyph kind={k} size={10} />{evidenceMeta[k].label}</li>
          ))}
          <li className="inline-flex items-center gap-1"><svg width="12" height="12" aria-hidden><circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" className="text-fault" strokeWidth="1.5" /></svg>error</li>
          <li className="inline-flex items-center gap-1"><svg width="12" height="12" aria-hidden><circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" className="text-attn" strokeWidth="1.5" strokeDasharray="7 3" /></svg>partial</li>
          <li className="inline-flex items-center gap-1"><svg width="12" height="12" aria-hidden><circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" className="text-fg-2" strokeWidth="1.2" strokeDasharray="1.6 1.6" /></svg>intervention</li>
        </ul>
        <Segmented
          label="Overview x-axis"
          value={axis}
          onChange={onAxis}
          options={[
            { value: 'order', label: 'order', title: 'Storage order: events spaced evenly, in the order they were recorded' },
            { value: 'time', label: 'time', title: 'Recorded time: events placed by their recorded offset from session start' },
          ]}
        />
      </div>

      <div ref={hostRef} className="relative px-0 pb-1.5" onMouseLeave={() => onHover(null)}>
        <svg
          width={width}
          height={H}
          viewBox={`0 0 ${width} ${H}`}
          role="img"
          aria-label={`Trajectory overview of ${n} events by category and ${useTime ? 'recorded time' : 'storage order'}. The table below lists the same events.`}
          className="block"
        >
          {/* lanes */}
          {CATEGORY_ORDER.map((c) => {
            const m = categoryMeta[c];
            const y = TOP + m.lane * LANE_H;
            const empty = !events.some((e) => e.category === c);
            const Icon = m.icon;
            return (
              <g key={c} opacity={empty ? 0.45 : 1}>
                {m.lane % 2 === 0 && <rect x={0} y={y} width={width} height={LANE_H} className="fill-surface-2" fillOpacity={0.5} />}
                <line x1={x0} x2={x1 + 6} y1={y + LANE_H / 2} y2={y + LANE_H / 2} className="stroke-line-subtle" strokeWidth={1} />
                <foreignObject x={16} y={y + 1} width={GUTTER - 20} height={LANE_H - 2}>
                  <div className="flex h-full items-center gap-1.5 font-mono text-2xs text-fg-3">
                    <Icon className="h-3 w-3 shrink-0" aria-hidden />
                    {m.name}
                  </div>
                </foreignObject>
              </g>
            );
          })}

          {/* which rows the detail table is showing */}
          {windowRect && (
            <g aria-hidden>
              <rect x={windowRect.x} y={TOP - 3} width={windowRect.w} height={CATEGORY_ORDER.length * LANE_H + 6} className="fill-select" fillOpacity={0.045} />
              <path d={`M${windowRect.x} ${TOP - 3}h${windowRect.w}M${windowRect.x} ${TOP + CATEGORY_ORDER.length * LANE_H + 3}h${windowRect.w}`} className="stroke-line-strong" strokeWidth={1} />
            </g>
          )}

          {/* the selected event's recorded relations */}
          {selected?.refs?.map((r) => {
            const t = events.find((e) => e.id === r.target);
            if (!t) return null;
            const ax = xs.get(selected.id) ?? 0;
            const bx = xs.get(t.id) ?? 0;
            const ay = laneY(selected.category);
            const by = laneY(t.category);
            const mid = (ax + bx) / 2;
            const lift = Math.min(26, Math.abs(ax - bx) / 4 + 6);
            return (
              <path key={`${r.target}-${r.relation}`} d={`M${ax} ${ay}Q${mid} ${Math.min(ay, by) - lift} ${bx} ${by}`} fill="none" className="stroke-select" strokeOpacity={0.5} strokeWidth={1} strokeDasharray="3 2">
                <title>{`${r.relation} → seq ${t.seq}`}</title>
              </path>
            );
          })}

          {selected && <line x1={xs.get(selected.id)} x2={xs.get(selected.id)} y1={TOP - 2} y2={TOP + CATEGORY_ORDER.length * LANE_H + 2} className="stroke-select" strokeOpacity={0.35} strokeWidth={1} />}

          {/* markers */}
          {events.map((e) => {
            const x = xs.get(e.id) ?? 0;
            const y = laneY(e.category);
            const dim = !matching.has(e.id);
            const isSel = e.id === selectedId;
            return (
              <g key={e.id} data-seq={e.seq}>
                <Marker kind={bestOf(e)} x={x} y={y} dense={dense} dim={dim} />
                {e.status === 'error' && <circle cx={x} cy={y} r={7} fill="none" className="stroke-fault" strokeWidth={1.5} opacity={dim ? 0.3 : 1} />}
                {e.status === 'partial' && <circle cx={x} cy={y} r={7} fill="none" className="stroke-attn" strokeWidth={1.4} strokeDasharray="9 3.5" opacity={dim ? 0.3 : 1} />}
                {e.category === 'intervention' && <circle cx={x} cy={y} r={7.5} fill="none" className="stroke-fg-2" strokeWidth={1.1} strokeDasharray="1.8 1.8" opacity={dim ? 0.3 : 1} />}
                {e.id === hoveredId && !isSel && <circle cx={x} cy={y} r={9} fill="none" className="stroke-fg-2" strokeWidth={1} />}
                {isSel && <circle cx={x} cy={y} r={9.5} fill="none" className="stroke-select" strokeWidth={1.6} />}
              </g>
            );
          })}

          {/* axis */}
          <line x1={x0} x2={x1 + 6} y1={H - AXIS_H + 2} y2={H - AXIS_H + 2} className="stroke-line" strokeWidth={1} />
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={t.x} x2={t.x} y1={H - AXIS_H + 2} y2={H - AXIS_H + 6} className="stroke-line-strong" strokeWidth={1} />
              <text x={t.x} y={H - 4} textAnchor="middle" className="fill-fg-3 font-mono" fontSize={11}>{t.label}</text>
            </g>
          ))}

          {/* hit columns: the whole column of an event is its target */}
          {sorted.map((e) => {
            const [l, r] = colBounds.get(e.id) ?? [0, 0];
            const lane = tied.has(e.id);
            return (
              <rect
                key={e.id}
                data-hit={e.seq}
                x={l}
                y={lane ? TOP + categoryMeta[e.category].lane * LANE_H : 0}
                width={Math.max(2, r - l)}
                height={lane ? LANE_H : H - AXIS_H}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => onHover(e.id)}
                onClick={() => onSelect(e.id)}
              />
            );
          })}
        </svg>

        {tipEvent && (
          <div
            role="tooltip"
            className="pointer-events-none absolute top-1 z-10 w-[220px] -translate-x-1/2 rounded-ctl border border-line-strong bg-surface-2 px-2.5 py-1.5 shadow-pop"
            style={{ left: tipX, top: tipLane >= 3 ? TOP + tipLane * LANE_H - 72 : TOP + tipLane * LANE_H + LANE_H + 4 }}
          >
            <div className="flex items-center gap-2 font-mono text-2xs text-fg-3">
              seq {tipEvent.seq}
              <span className="text-fg-2">{categoryMeta[tipEvent.category].name}</span>
              <span className="ml-auto text-fg-3">{formatOffset(tipEvent.offsetMs)}</span>
            </div>
            <div className="mt-0.5 truncate text-xs text-fg-1">{tipEvent.title}</div>
            <div className="mt-1 flex items-center gap-2 font-mono text-2xs">
              {bestOf(tipEvent) ? <span className={`inline-flex items-center gap-1 ${evidenceMeta[bestOf(tipEvent)!].text}`}><ProvGlyph kind={bestOf(tipEvent)!} size={10} />{evidenceMeta[bestOf(tipEvent)!].label}</span> : <span className="text-fg-3">no evidence items</span>}
              {tipEvent.status !== 'ok' && <span className={tipEvent.status === 'error' ? 'text-fault' : 'text-attn'}>{tipEvent.status}</span>}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
