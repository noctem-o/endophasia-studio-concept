import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LineageScene } from './types';
import type { Viewport } from './renderers/types';
import { createRenderer, isBackendAvailable, type BackendId } from './renderers';
import type { LineageRenderer } from './renderers/types';
import { measureFps, measureRenderer, type MeasurementBlock } from './renderers/measure';
import {
  clampScale, filteredVisibleNodes, fitViewport, focusSetOf, initialInteraction, lodTier,
  LOD_THRESHOLDS, navOrder, type InteractionState,
} from './interaction';
import { RAW, RELATION_STYLE_HEX, CLASSIFICATION_TAG, PROVENANCE_BADGE } from './renderers/palette';
import { makeHeatmapPoc, HeatmapPocView } from './heatmapPoc';
import type { LineageRelation } from '@/domain/evolve';

/**
 * LineageExplorer — renderer-independent graph explorer.
 * Owns viewport/selection/filter/focus as React state; the renderer is a
 * replaceable view. Backend switches rebuild the renderer and push the exact
 * same state back in, so selection and camera survive the swap.
 */

const ALL_RELATIONS: LineageRelation[] = ['forked_from', 'replay_of', 'candidate_of', 'evaluated_against', 'continuation_of', 'simulated_branch'];

const RELATION_LABEL: Record<LineageRelation, string> = {
  forked_from: 'forked from',
  replay_of: 'replay of',
  candidate_of: 'candidate of',
  evaluated_against: 'evaluated against',
  continuation_of: 'continuation of',
  simulated_branch: 'simulated branch',
};

export interface ExplorerSceneEntry {
  id: string;
  label: string;
  scene: LineageScene;
  synthetic: boolean;
}

interface Props {
  scenes: ExplorerSceneEntry[];
  initialSceneId?: string;
  initialSelection?: string | null;
  onOpenNode?: (id: string) => void;
}

export function LineageExplorer({ scenes, initialSceneId, initialSelection = null, onOpenNode }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<LineageRenderer | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; vp: Viewport } | null>(null);
  const viewSizeRef = useRef({ w: 800, h: 600 });

  const [backend, setBackend] = useState<BackendId>(() => (isBackendAvailable('webgl2-instanced') ? 'webgl2-instanced' : 'svg-dom'));
  const [backendIssue, setBackendIssue] = useState<string | null>(null);
  const [sceneId, setSceneId] = useState(initialSceneId ?? scenes[0]?.id ?? '');
  const [interaction, setInteraction] = useState<InteractionState>(() => ({ ...initialInteraction(), selection: initialSelection }));
  const [backendDetails, setBackendDetails] = useState('');
  const [measurements, setMeasurements] = useState<MeasurementBlock[]>([]);
  const [fps, setFps] = useState<{ median: number; min: number } | null | 'unmeasured'>('unmeasured');
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const scene = useMemo(() => scenes.find((s) => s.id === sceneId) ?? scenes[0], [scenes, sceneId]);
  const heatmapScene = useMemo(() => makeHeatmapPoc(), []);
  const visible = useMemo(() => (scene ? filteredVisibleNodes(scene.scene, interaction) : new Set<string>()), [scene, interaction]);
  const lod = lodTier(interaction.viewport.scale);

  // ── Renderer lifecycle: create on backend change, push state in ──────────
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !scene) return;
    const { renderer, issues } = createRenderer(backend);
    setBackendIssue(issues.length > 0 ? issues.join('; ') : null);
    if (!renderer) return;

    rendererRef.current = renderer;
    renderer.mount(host, {
      onNodeClick: (id) => {
        setInteraction((s) => ({ ...s, selection: id }));
        if (id) onOpenNodeRef.current?.(id);
      },
    });
    renderer.setScene(scene.scene);
    renderer.setViewport(interaction.viewport);
    renderer.setSelection(interaction.selection);
    renderer.setHighlight(interaction.focus);
    setBackendDetails(renderer.info.details);

    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
    // Interaction state is pushed via separate effects; only recreate on backend/scene change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, sceneId]);

  useEffect(() => { rendererRef.current?.setViewport(interaction.viewport); }, [interaction.viewport]);
  useEffect(() => { rendererRef.current?.setSelection(interaction.selection); }, [interaction.selection]);
  useEffect(() => { rendererRef.current?.setHighlight(interaction.focus); }, [interaction.focus]);
  useEffect(() => { if (scene) rendererRef.current?.setScene(scene.scene); }, [scene]);

  // ── Resize handling ───────────────────────────────────────────────────────
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const ro = new ResizeObserver(() => {
      const r = host.getBoundingClientRect();
      viewSizeRef.current = { w: Math.max(1, r.width), h: Math.max(1, r.height) };
      rendererRef.current?.resize(viewSizeRef.current.w, viewSizeRef.current.h);
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  // ── Pan (drag) + wheel zoom on the host ──────────────────────────────
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const down = (e: MouseEvent) => {
      dragRef.current = { startX: e.clientX, startY: e.clientY, vp: interactionRef.current.viewport };
    };
    const move = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      setInteraction((s) => ({
        ...s,
        viewport: { ...s.viewport, x: d.vp.x + (e.clientX - d.startX), y: d.vp.y + (e.clientY - d.startY) },
      }));
    };
    const up = () => { dragRef.current = null; };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = host.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setInteraction((s) => {
        const factor = Math.exp(-e.deltaY * 0.0015);
        const scale = clampScale(s.viewport.scale * factor);
        const k = scale / s.viewport.scale;
        return { ...s, viewport: { scale, x: mx - (mx - s.viewport.x) * k, y: my - (my - s.viewport.y) * k } };
      });
    };
    host.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    host.addEventListener('wheel', wheel, { passive: false });
    return () => {
      host.removeEventListener('mousedown', down);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      host.removeEventListener('wheel', wheel);
    };
  }, []);

  const interactionRef = useRef(interaction);
  interactionRef.current = interaction;
  const onOpenNodeRef = useRef(onOpenNode);
  onOpenNodeRef.current = onOpenNode;

  // ── Keyboard navigation ──────────────────────────────────────
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!scene) return;
    const order = navOrder(scene.scene);
    const idx = interaction.selection ? order.indexOf(interaction.selection) : -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = order[Math.min(order.length - 1, idx + 1)];
      if (next) setInteraction((s) => ({ ...s, selection: next }));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = order[Math.max(0, idx - 1)];
      if (prev) setInteraction((s) => ({ ...s, selection: prev }));
    } else if (e.key === 'f' && interaction.selection) {
      setInteraction((s) => ({ ...s, focus: s.focus ? null : focusSetOf(scene.scene, s.selection!) }));
    } else if (e.key === '0') {
      if (scene) setInteraction((s) => ({ ...s, viewport: fitViewport(scene.scene, viewSizeRef.current.w, viewSizeRef.current.h) }));
    }
  }, [scene, interaction.selection]);

  const fitToScene = useCallback(() => {
    if (!scene) return;
    setInteraction((s) => ({ ...s, viewport: fitViewport(scene.scene, viewSizeRef.current.w, viewSizeRef.current.h) }));
  }, [scene]);

  const centerOn = useCallback((nodeId: string) => {
    if (!scene) return;
    const p = scene.scene.layout.positions[nodeId];
    if (!p) return;
    const { w, h } = viewSizeRef.current;
    const enc = scene.scene.encoding;
    const wx = 20 + p.column * enc.columnGap + enc.nodeWidth / 2;
    const wy = 20 + p.row * enc.rowGap + enc.nodeHeight / 2;
    setInteraction((s) => ({ ...s, viewport: { ...s.viewport, x: w / 2 - wx * s.viewport.scale, y: h / 2 - wy * s.viewport.scale } }));
  }, [scene]);

  useEffect(() => {
    if (interaction.selection) centerOn(interaction.selection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId]);

  const switchBackend = (id: BackendId) => {
    const avail = isBackendAvailable(id);
    if (!avail) {
      setBackendIssue(`${id} is not available in this browser; renderer unchanged`);
      return;
    }
    setBackend(id);
  };

  const runMeasurements = async () => {
    if (!scene) return;
    const blocks: MeasurementBlock[] = [];
    for (const entry of scenes) {
      const s = entry.scene;
      const renderer = createRenderer(backend).renderer;
      if (!renderer) continue;
      const host = document.createElement('div');
      host.style.width = '800px';
      host.style.height = '600px';
      host.style.position = 'absolute';
      host.style.opacity = '0';
      host.style.pointerEvents = 'none';
      document.body.appendChild(host);
      renderer.mount(host, { onNodeClick: () => {} });
      renderer.resize(800, 600);
      const block = measureRenderer(backend, s, {
        buildScene: () => { void s.nodes.length; },
        pushScene: () => renderer.setScene(s),
        pushViewport: () => renderer.setViewport({ x: 0, y: 0, scale: 0.9 }),
      });
      renderer.destroy();
      host.remove();
      blocks.push(block);
    }
    setMeasurements(blocks);
    const live = rendererRef.current;
    if (live) {
      const r = await measureFps(() => live.setViewport({ ...interactionRef.current.viewport, x: (interactionRef.current.viewport.x ?? 0) + 0.5 }));
      setFps(r ?? null);
    } else {
      setFps(null);
    }
  };

  if (!scene) return <div className="p-4 text-xs text-ink-400">no scene available</div>;

  const selectedNode = scene.scene.nodes.find((n) => n.id === interaction.selection) ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="lineage-explorer">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-ink-700/70 bg-ink-900/60 px-3 py-2">
        <select
          value={sceneId}
          onChange={(e) => { setSceneId(e.target.value); }}
          aria-label="Scene"
          className="rounded-[4px] border border-ink-600/70 bg-ink-850 px-2 py-1 font-mono text-2xs text-ink-100"
        >
          {scenes.map((s) => (
            <option key={s.id} value={s.id}>{s.label}{s.synthetic ? ' (synthetic)' : ''}</option>
          ))}
        </select>

        <select
          value={backend}
          onChange={(e) => switchBackend(e.target.value as BackendId)}
          aria-label="Renderer backend"
          className="rounded-[4px] border border-ink-600/70 bg-ink-850 px-2 py-1 font-mono text-2xs text-ink-100"
        >
          <option value="webgl2-instanced">WebGL2 instanced</option>
          <option value="svg-dom">SVG (DOM)</option>
        </select>

        <input
          value={interaction.query}
          onChange={(e) => setInteraction((s) => ({ ...s, query: e.target.value }))}
          placeholder="filter by label or id…"
          aria-label="Filter nodes"
          className="w-44 rounded-[4px] border border-ink-600/70 bg-ink-850 px-2 py-1 font-mono text-2xs text-ink-100 placeholder:text-ink-500"
        />

        <div className="flex items-center gap-1">
          {ALL_RELATIONS.map((r) => {
            const hidden = interaction.hiddenRelations.has(r);
            return (
              <button
                key={r}
                onClick={() => setInteraction((s) => {
                  const next = new Set(s.hiddenRelations);
                  if (next.has(r)) next.delete(r); else next.add(r);
                  return { ...s, hiddenRelations: next };
                })}
                aria-pressed={!hidden}
                title={RELATION_LABEL[r]}
                className={`rounded-[3px] border px-1.5 py-0.5 font-mono text-[9px] tracking-wider transition-opacity ${hidden ? 'border-ink-700/50 text-ink-600 opacity-40' : 'border-ink-600/60 text-ink-300'}`}
              >
                <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{ background: RELATION_STYLE_HEX[r].stroke }} aria-hidden />
                {RELATION_LABEL[r]}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => {
            if (interaction.selection && scene) {
              const id = interaction.selection;
              setInteraction((s) => ({ ...s, focus: s.focus ? null : focusSetOf(scene.scene, id) }));
            }
          }}
          disabled={!interaction.selection}
          className={`rounded-[4px] border px-2 py-1 font-mono text-2xs transition-colors disabled:opacity-40 ${interaction.focus ? 'border-teal-accent/60 bg-teal-accent/10 text-teal-accent' : 'border-ink-600/70 bg-ink-850 text-ink-300 hover:text-ink-100'}`}
        >
          focus lineage (f)
        </button>
        <button onClick={fitToScene} className="rounded-[4px] border border-ink-600/70 bg-ink-850 px-2 py-1 font-mono text-2xs text-ink-300 hover:text-ink-100">
          fit (0)
        </button>
        <button
          onClick={() => setShowDiagnostics((v) => !v)}
          className={`rounded-[4px] border px-2 py-1 font-mono text-2xs ${showDiagnostics ? 'border-teal-accent/50 text-teal-accent' : 'border-ink-600/70 bg-ink-850 text-ink-300 hover:text-ink-100'}`}
        >
          diagnostics
        </button>

        <span className="ml-auto font-mono text-2xs text-ink-400">
          {visible.size}/{scene.scene.nodes.length} nodes · LOD {lod} · {Math.round(interaction.viewport.scale * 100)}%
        </span>
      </div>

      {backendIssue && (
        <p className="shrink-0 border-b border-amber-accent/30 bg-amber-accent/5 px-3 py-1 font-mono text-2xs text-amber-accent">{backendIssue}</p>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Graph viewport */}
        <div
          ref={hostRef}
          tabIndex={0}
          onKeyDown={onKeyDown}
          role="application"
          aria-label="Lineage graph viewport — drag to pan, scroll to zoom, arrow keys to move selection"
          className="relative min-h-0 flex-1 cursor-grab overflow-hidden bg-ink-950 outline-none focus:ring-1 focus:ring-teal-accent/40"
        >
          {/* DOM text overlay (WebGL backend draws shapes only) */}
          <div ref={overlayRef} className="pointer-events-none absolute inset-0">
            {backend === 'webgl2-instanced' && lod !== 'dots' && visible.size <= 2000 && scene.scene.nodes
              .filter((n) => visible.has(n.id) && scene.scene.layout.positions[n.id])
              .map((n) => {
                const p = scene.scene.layout.positions[n.id];
                const enc = scene.scene.encoding;
                const sx = (20 + p.column * enc.columnGap) * interaction.viewport.scale + interaction.viewport.x;
                const sy = (20 + p.row * enc.rowGap) * interaction.viewport.scale + interaction.viewport.y;
                if (sx < -220 || sy < -60 || sx > viewSizeRef.current.w + 40 || sy > viewSizeRef.current.h + 40) return null;
                const dim = interaction.focus && !interaction.focus.has(n.id);
                return (
                  <div key={n.id} className="absolute" style={{ left: sx + 10 * interaction.viewport.scale, top: sy + 6 * interaction.viewport.scale, opacity: dim ? 0.15 : 1 }}>
                    <div className="font-mono text-[8px] tracking-wider" style={{ color: CLASSIFICATION_TAG[n.classification].color }}>
                      {CLASSIFICATION_TAG[n.classification].label} · {PROVENANCE_BADGE[n.provenance].label}
                    </div>
                    {lod === 'full' && (
                      <div className="max-w-[170px] truncate text-[10.5px]" style={{ color: RAW.fg1 }}>{n.label}</div>
                    )}
                    {lod === 'full' && (
                      <div className="font-mono text-[8px]" style={{ color: RAW.fg3 }}>{n.sessionId ?? 'trajectory not in registry'}</div>
                    )}
                  </div>
                );
              })}
          </div>

          {selectedNode && (
            <div className="absolute bottom-3 left-3 max-w-sm rounded-[4px] border border-ink-700/70 bg-ink-900/95 p-2.5">
              <div className="flex items-center gap-2 font-mono text-2xs">
                <span style={{ color: CLASSIFICATION_TAG[selectedNode.classification].color }}>{CLASSIFICATION_TAG[selectedNode.classification].label}</span>
                <span style={{ color: PROVENANCE_BADGE[selectedNode.provenance].color }}>{PROVENANCE_BADGE[selectedNode.provenance].label}</span>
                <span className="text-ink-500">{selectedNode.id}</span>
              </div>
              <p className="mt-1 text-xs text-ink-100">{selectedNode.label}</p>
              <p className="mt-1 text-2xs leading-relaxed text-ink-400">{selectedNode.provenanceReason}</p>
              <p className="mt-1 font-mono text-2xs text-ink-500">
                coordinates: {selectedNode.coordinates.recorded} recorded / {selectedNode.coordinates.unavailable} unavailable
              </p>
            </div>
          )}
        </div>

        {/* Diagnostics side panel */}
        {showDiagnostics && (
          <aside aria-label="Rendering diagnostics" className="w-[340px] shrink-0 space-y-3 overflow-y-auto border-l border-ink-700/70 bg-ink-900 p-3">
            <h2 className="font-mono text-2xs uppercase tracking-widest text-ink-300">diagnostics — measured values only</h2>
            <dl className="space-y-1 font-mono text-2xs">
              <Row k="backend" v={backend} />
              <Row k="scene id" v={scene.scene.sceneId} />
              <Row k="schema version" v={`v${scene.scene.schemaVersion}`} />
              <Row k="nodes / edges" v={`${scene.scene.nodes.length} / ${scene.scene.edges.length}`} />
              <Row k="nodes visible (filter)" v={String(visible.size)} />
              <Row k="lod tier" v={`${lod} (full ≥ ${LOD_THRESHOLDS.full}, labels ≥ ${LOD_THRESHOLDS.labels})`} />
              <Row k="device pixel ratio" v={String(window.devicePixelRatio || 1)} />
              <Row k="backend details" v={backendDetails || 'not reported'} />
              <Row k="rAF cadence" v={fps === 'unmeasured' ? 'unmeasured — run a probe' : fps ? `${fps.median.toFixed(1)} median / ${fps.min.toFixed(1)} worst (rAF interval, not GPU time)` : 'unavailable (no rAF loop)'} />
            </dl>

            <button onClick={runMeasurements} className="w-full rounded-[4px] border border-teal-accent/40 bg-teal-accent/10 px-2 py-1.5 font-mono text-2xs text-teal-accent hover:bg-teal-accent/15">
              run measurement pass on all scenes ({backend})
            </button>

            {measurements.length === 0 ? (
              <p className="text-2xs leading-relaxed text-ink-500">
                no measurements recorded yet. Figures appear here only after a measurement pass — nothing is estimated, carried over, or invented.
              </p>
            ) : (
              <div className="space-y-2">
                {measurements.map((m) => (
                  <div key={`${m.backendId}-${m.nodeCount}`} className="rounded-[4px] border border-ink-700/50 bg-ink-850 p-2">
                    <div className="font-mono text-2xs text-ink-200">{m.nodeCount} nodes · {m.edgeCount} edges</div>
                    {m.timings.map((t) => (
                      <div key={t.kind} className="mt-1 font-mono text-2xs text-ink-400">
                        {t.kind}: <span className="text-ink-100">{t.medianMs.toFixed(2)} ms</span>
                        <span className="text-ink-600"> [{t.minMs.toFixed(2)}–{t.maxMs.toFixed(2)}, n={t.runs}]</span>
                      </div>
                    ))}
                    {m.unmeasured.map((u) => (
                      <div key={u.kind} className="mt-0.5 font-mono text-2xs text-ink-600">{u.kind}: unmeasured — {u.reason}</div>
                    ))}
                  </div>
                ))}
                <p className="text-2xs leading-relaxed text-ink-500">
                  medians over 7 timed runs after 3 warm-up runs, performance.now(). These are main-thread CPU submission costs — they do not include GPU execution time, which the main thread cannot observe. Runs are in-page and untuned; treat small differences as noise.
                </p>
              </div>
            )}

            <h3 className="border-t border-ink-700/70 pt-3 font-mono text-2xs uppercase tracking-widest text-ink-300">scene PoC — heatmap</h3>
            <HeatmapPocView scene={heatmapScene} />
          </aside>
        )}
      </div>

      {/* Legend */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-ink-700/70 bg-ink-900/60 px-3 py-1.5">
        {ALL_RELATIONS.map((r) => (
          <span key={r} className="inline-flex items-center gap-1.5 font-mono text-[9px] tracking-wider text-ink-300">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: RELATION_STYLE_HEX[r].stroke }} aria-hidden />
            {RELATION_LABEL[r]}
          </span>
        ))}
        <span className="ml-auto inline-flex items-center gap-2 font-mono text-[9px] text-ink-500">
          {(Object.keys(PROVENANCE_BADGE) as (keyof typeof PROVENANCE_BADGE)[]).map((p) => (
            <span key={p} style={{ color: PROVENANCE_BADGE[p].color }}>{PROVENANCE_BADGE[p].label}</span>
          ))}
          <span>evidence provenance: OBS observed / REP reported / DER derived / N/A not-applicable — replay status is a continuation kind, not provenance</span>
        </span>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[130px_1fr] items-baseline gap-2">
      <dt className="text-ink-500">{k}</dt>
      <dd className="min-w-0 break-words text-ink-200">{v}</dd>
    </div>
  );
}
