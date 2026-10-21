import { useState } from 'react';
import type { EvolveCorpus, Execution, LineageEdge, LineageRelation } from '../../domain/evolve';
import { RELATION_META } from './shared';

/**
 * Lineage canvas: a layered SVG graph of executions and their typed relations.
 * Every node and edge renders from the corpus records; nothing is drawn that a
 * record does not assert. Nodes whose trajectory is not in the observation
 * registry show an explicit gap instead of a session link.
 */

const RELATION_STYLE: Record<LineageRelation, { stroke: string; dash?: string }> = {
  forked_from: { stroke: '#2DD4BF' },
  replay_of: { stroke: '#60A5FA', dash: '4 3' },
  candidate_of: { stroke: '#F5B94B' },
  evaluated_against: { stroke: '#A78BFA' },
  continuation_of: { stroke: '#7C8CA5' },
  simulated_branch: { stroke: '#F87171', dash: '2 3' },
};

interface LayoutNode {
  exec: Execution;
  x: number;
  y: number;
  col: number;
}

const NODE_W = 178;
const NODE_H = 46;
const COL_GAP = 250;
const ROW_GAP = 62;

/** Simple layered layout: roots (no incoming edges) in column 0, children one column right. */
function layout(corpus: EvolveCorpus): { nodes: LayoutNode[]; edges: LineageEdge[]; width: number; height: number } {
  const byId = new Map(corpus.executions.map((e) => [e.id, e]));
  const incoming = new Map<string, number>();
  for (const e of corpus.edges) {
    if (byId.has(e.from) && byId.has(e.to)) {
      incoming.set(e.from, (incoming.get(e.from) ?? 0) + 1);
    }
  }

  // depth = longest path from a root
  const depth = new Map<string, number>();
  const visit = (id: string, stack: Set<string>): number => {
    if (depth.has(id)) return depth.get(id)!;
    if (stack.has(id)) return 0;
    stack.add(id);
    const parents = corpus.edges.filter((e) => e.from === id).map((e) => e.to);
    const d = parents.length === 0 ? 0 : 1 + Math.max(...parents.map((p) => (byId.has(p) ? visit(p, stack) : 0)));
    stack.delete(id);
    depth.set(id, d);
    return d;
  };
  for (const e of corpus.executions) visit(e.id, new Set());

  const cols = new Map<number, string[]>();
  for (const e of corpus.executions) {
    const d = depth.get(e.id) ?? 0;
    if (!cols.has(d)) cols.set(d, []);
    cols.get(d)!.push(e.id);
  }

  const nodes: LayoutNode[] = [];
  let maxRows = 0;
  for (const [d, ids] of [...cols.entries()].sort((a, b) => a[0] - b[0])) {
    ids.sort((a, b) => a.localeCompare(b));
    maxRows = Math.max(maxRows, ids.length);
    ids.forEach((id, i) => {
      nodes.push({ exec: byId.get(id)!, x: 20 + d * COL_GAP, y: 20 + i * ROW_GAP, col: d });
    });
  }

  const width = 20 + ((Math.max(...[...cols.keys()], 0)) + 1) * COL_GAP;
  const height = 20 + maxRows * ROW_GAP;
  return { nodes, edges: corpus.edges, width, height };
}

const ROLE_STYLE: Record<Execution['role'], { ring: string; tag: string; tagCls: string }> = {
  baseline: { ring: 'stroke-teal-accent/60', tag: 'BASELINE', tagCls: 'fill-teal-accent' },
  reference: { ring: 'stroke-ink-500/60', tag: 'REFERENCE', tagCls: 'fill-ink-400' },
  continuation: { ring: 'stroke-blue-accent/50', tag: 'CONTINUATION', tagCls: 'fill-blue-accent' },
  'candidate-run': { ring: 'stroke-amber-accent/50', tag: 'CANDIDATE RUN', tagCls: 'fill-amber-accent' },
  trial: { ring: 'stroke-amber-accent/40', tag: 'TRIAL', tagCls: 'fill-amber-accent' },
};

export function LineageCanvas({ corpus, selectedId, onSelect }: {
  corpus: EvolveCorpus;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { nodes, edges, width, height } = layout(corpus);
  const nodeById = new Map(nodes.map((n) => [n.exec.id, n]));
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);

  const onEdgeEnter = (id: string) => setHoverEdge(id);
  const onEdgeLeave = () => setHoverEdge(null);

  return (
    <div className="relative h-full overflow-auto bg-ink-950">
      <svg width={width} height={height} className="min-w-full" role="img" aria-label="Execution lineage graph">
        <defs>
          <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L8,4 L0,8" fill="none" className="stroke-ink-500" strokeWidth="1.4" />
          </marker>
        </defs>

        {edges.map((edge) => {
          const a = nodeById.get(edge.from);
          const b = nodeById.get(edge.to);
          if (!a || !b) return null;
          const meta = RELATION_STYLE[edge.relation as LineageRelation];
          const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2;
          const x2 = b.x, y2 = b.y + NODE_H / 2;
          const mx = (x1 + x2) / 2;
          const active = hoverEdge === edge.id;
          const stroke = active ? '#EDF1F6' : meta.stroke;
          return (
            <path
              key={edge.id}
              d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2 - 4} ${y2}`}
              fill="none"
              stroke={stroke}
              strokeWidth={active ? 2 : 1.4}
              strokeDasharray={meta.dash}
              markerEnd="url(#arrow)"
              opacity={active ? 1 : 0.7}
              onMouseEnter={() => onEdgeEnter(edge.id)}
              onMouseLeave={onEdgeLeave}
            />
          );
        })}

        {nodes.map(({ exec, x, y }) => {
          const style = ROLE_STYLE[exec.role];
          const selected = exec.id === selectedId;
          const hasSession = Boolean(exec.sessionId);
          return (
            <g
              key={exec.id}
              transform={`translate(${x}, ${y})`}
              onClick={() => onSelect(exec.id)}
              className="cursor-pointer"
              role="button"
              aria-label={exec.label}
            >
              <rect
                width={NODE_W} height={NODE_H} rx={5}
                className={selected ? 'fill-ink-750' : 'fill-ink-900'}
                stroke={selected ? '#2DD4BF' : undefined}
                strokeWidth={selected ? 1.5 : 0}
              />
              <rect width={NODE_W} height={NODE_H} rx={5} className={style.ring} fill="none" strokeWidth={1} />
              <text x={10} y={17} className={style.tagCls} fontSize="8" fontFamily="IBM Plex Mono, monospace" letterSpacing="1.2">
                {style.tag}
              </text>
              <text x={10} y={31} fontSize="10.5" className="fill-ink-100" fontFamily="Inter, sans-serif">
                {exec.label.length > 26 ? exec.label.slice(0, 25) + '\u2026' : exec.label}
              </text>
              <text x={10} y={41} fontSize="8" fontFamily="IBM Plex Mono, monospace" className="fill-ink-400">
                {hasSession ? exec.sessionId : 'trajectory not in registry'}
              </text>
              {!hasSession && (
                <circle cx={NODE_W - 12} cy={12} r={4} className="fill-amber-accent/30 stroke-amber-accent" strokeWidth="1" strokeDasharray="2 2" />
              )}
            </g>
          );
        })}
      </svg>

      <div className="pointer-events-none absolute bottom-3 left-3 rounded-[4px] border border-ink-700/70 bg-ink-900/90 px-2.5 py-1.5">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {(Object.keys(RELATION_META) as LineageRelation[]).map((r) => (
            <span key={r} className="inline-flex items-center gap-1.5 font-mono text-[9px] tracking-wider text-ink-300">
              <span className={`h-1.5 w-1.5 rounded-full ${RELATION_META[r].dot}`} aria-hidden />
              {RELATION_META[r].label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 font-mono text-[9px] tracking-wider text-amber-accent/80">
            <span className="h-2 w-2 rounded-full border border-dashed border-amber-accent" aria-hidden />
            no recorded trajectory — explicit gap
          </span>
        </div>
      </div>
    </div>
  );
}
