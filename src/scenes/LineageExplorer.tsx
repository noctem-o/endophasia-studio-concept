import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import type { LineageScene, LineageNode, LineageRelation, RelationKind, SceneProvenance } from './types';
import {
  type InteractionState,
  initialInteraction,
  screenFromWorld,
  worldFromScreen,
  zoomAbout,
  zoomToNode,
  fitViewport,
  filteredVisibleNodes,
  focusSetOf,
  ancestryOf,
  navOrder,
  lodTier,
} from './interaction';
import { PROVENANCE_BADGE } from './renderers/palette';
import { SvgRenderer } from './renderers/svgRenderer';
import { WebGLRenderer } from './renderers/webglRenderer';
import { measureFps, describeMeasurements, MEASURE_NOTES, type Measurement } from './renderers/measure';
import { HeatmapPoC } from './renderers/heatmapPoc';
import { Layers, Crosshair, Maximize2, Activity, X, ZoomIn, ZoomOut, Keyboard } from 'lucide-react';

type BackendKind = 'svg' | 'webgl';

interface ExplorerProps {
  scene: LineageScene | null;
  sceneError: string | null;
  backend: BackendKind;
  onBackendChange: (b: BackendKind) => void;
  availableScenes: { id: string; label: string; nodeCount: number; make: () => LineageScene }[];
  activeSceneId: string;
  onActiveSceneChange: (id: string) => void;
}

const RELATION_KINDS: RelationKind[] = ['replay_of', 'simulated_branch', 'derived_from'];

const RELATION_LABELS: Record<RelationKind, string> = {
  replay_of: 'replay of',
  simulated_branch: 'simulated branch',
  derived_from: 'derived from',
};

function provenanceRank(p: SceneProvenance): number {
  switch (p) {
    case 'observed': return 0;
    case 'reported': return 1;
    case 'derived': return 2;
    case 'not-applicable': return 3;
  }
}

export function LineageExplorer({
  scene,
  sceneError,
  backend,
  onBackendChange,
  availableScenes,
  activeSceneId,
  onActiveSceneChange,
}: ExplorerProps) {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const svgHostRef = useRef<HTMLDivElement | null>(null);
  const textOverlayRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const dragStateRef = useRef<{ pointerId: number; lastX: number; lastY: number } | null>(null);

  const [interaction, setInteraction] = useState<InteractionState>(initialInteraction);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [fps, setFps] = useState<Measurement | null>(null);

  const visibleNodes = useMemo(
    () => (scene ? filteredVisibleNodes(scene, interaction) : null),
    [scene, interaction],
  );

  const focusIds = useMemo(
    () => (scene && interaction.selection ? focusSetOf(scene, interaction.selection) : null),
    [scene, interaction.selection],
  );

  const ancestry = useMemo(
    () => (scene && interaction.selection ? ancestryOf(scene, interaction.selection) : null),
    [scene, interaction.selection],
  );

  const navList = useMemo(() => (scene ? navOrder(scene) : []), [scene]);

  const selected = useMemo(
    () => (scene && interaction.selection ? scene.nodes.find((n) => n.id === interaction.selection) ?? null : null),
    [scene, interaction.selection],
  );

  // Re-fit when the scene identity changes (backend swap preserves camera;
  // a scene swap should not strand the user off-canvas).
  const sceneIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (scene && sceneIdRef.current !== activeSceneId) {
      sceneIdRef.current = activeSceneId;
      setInteraction((s) => ({ ...s, viewport: fitViewport(scene, viewportWidth(), viewportHeight()) }));
    }
  }, [scene, activeSceneId]);

  function viewportWidth(): number {
    return canvasHostRef.current?.clientWidth ?? 800;
  }
  function viewportHeight(): number {
    return canvasHostRef.current?.clientHeight ?? 600;
  }

  // WebGL backend lifecycle: the renderer owns GPU resources; selection and
  // camera are pushed in via updateInteraction() — never trigger geometry
  // rebuilds.
  useEffect(() => {
    if (backend !== 'webgl' || !scene || !canvasHostRef.current) return;
    const host = canvasHostRef.current;
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    host.appendChild(canvas);
    try {
      const r = new WebGLRenderer(canvas, scene);
      r.updateInteraction(interaction);
      rendererRef.current = r;
    } catch {
      rendererRef.current = null;
      host.removeChild(canvas);
      return;
    }
    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
      if (canvas.parentElement === host) host.removeChild(canvas);
    };
    // interaction intentionally omitted: pushed via updateInteraction below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, scene]);

  // Push interaction changes into the live renderer without rebuilding geometry.
  useEffect(() => {
    rendererRef.current?.updateInteraction(interaction);
  }, [interaction]);

  // SVG backend renders into a host div; also mirror the transform for the
  // DOM text overlay used with the WebGL backend.
  useEffect(() => {
    if (backend !== 'svg' || !scene || !svgHostRef.current) return;
    const host = svgHostRef.current;
    host.textContent = '';
    const svg = SvgRenderer.render(scene, interaction, {
      width: viewportWidth(),
      height: viewportHeight(),
      onNodeClick: (id) => setInteraction((s) => ({ ...s, selection: s.selection === id ? null : id })),
    });
    host.appendChild(svg);
    return () => {
      host.textContent = '';
    };
  }, [backend, scene, interaction]);

  // DOM text overlay for the WebGL backend: labels live in the DOM (crisp
  // text, accessible), positioned by the same camera convention as the
  // canvas. Culled to viewport and LOD-tiered so the DOM stays small.
  useEffect(() => {
    if (backend !== 'webgl' || !scene || !visibleNodes) return;
    const overlay = textOverlayRef.current;
    if (!overlay) return;
    const tier = lodTier(interaction.viewport.scale);
    if (tier === 'dots') {
      overlay.textContent = '';
      return;
    }
    const vpW = viewportWidth();
    const vpH = viewportHeight();
    const frag = document.createDocumentFragment();
    for (const node of visibleNodes) {
      if (tier === 'labels' && !interaction.selection && !focusIds?.has(node.id)) continue;
      const pos = scene.layout.positions[node.id];
      if (!pos) continue;
      const p = screenFromWorld({ x: pos.x, y: pos.y }, interaction.viewport);
      if (p.x < -120 || p.y < -40 || p.x > vpW + 120 || p.y > vpH + 40) continue;
      const el = document.createElement('div');
      el.className =
        'absolute -translate-y-full text-[10px] leading-none tracking-wide pointer-events-none select-none';
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y - 10}px`;
      const badge = PROVENANCE_BADGE[node.provenance];
      const dim = focusIds && !focusIds.has(node.id);
      el.innerHTML = '';
      const label = document.createElement('span');
      label.textContent = node.label;
      label.style.color = dim ? 'rgba(216,222,228,0.35)' : 'rgba(216,222,228,0.85)';
      const badgeEl = document.createElement('span');
      badgeEl.textContent = ` ${badge.label}`;
      badgeEl.style.color = badge.color;
      el.appendChild(label);
      if (tier === 'full') el.appendChild(badgeEl);
      frag.appendChild(el);
    }
    overlay.textContent = '';
    overlay.appendChild(frag);
  }, [backend, scene, visibleNodes, interaction.viewport, interaction.selection, focusIds]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragStateRef.current = { pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY };
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragStateRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const dx = e.clientX - drag.lastX;
      const dy = e.clientY - drag.lastY;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      setInteraction((s) => ({
        ...s,
        viewport: { ...s.viewport, x: s.viewport.x + dx, y: s.viewport.y + dy },
      }));
    },
    [],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (dragStateRef.current?.pointerId === e.pointerId) dragStateRef.current = null;
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const cursor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setInteraction((s) => ({
      ...s,
      viewport: zoomAbout(s.viewport, cursor, Math.exp(-e.deltaY * 0.0015)),
    }));
  }, []);

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      // Hit-testing happens in CSS-pixel space via worldFromScreen — the same
      // convention the renderers use, so clicks land where the pixels are,
      // independent of devicePixelRatio.
      if (!scene || !visibleNodes) return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const world = worldFromScreen(screen, interaction.viewport);
      const hitRadiusWorld = 14 / interaction.viewport.scale;
      let best: string | null = null;
      let bestDist = Infinity;
      for (const id of visibleNodes) {
        const pos = scene.layout.positions[id];
        if (!pos) continue;
        const dx = pos.x - world.x;
        const dy = pos.y - world.y;
        const d = Math.hypot(dx, dy);
        if (d < hitRadiusWorld && d < bestDist) {
          best = id;
          bestDist = d;
        }
      }
      setInteraction((s) => ({ ...s, selection: best && best !== s.selection ? best : best ? null : s.selection }));
    },
    [scene, visibleNodes, interaction.viewport],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!scene) return;
      if (e.key === 'f' && interaction.selection) {
        setInteraction((s) => ({ ...s, viewport: zoomToNode(scene, s.viewport, s.selection!) }));
      } else if (e.key === '0') {
        setInteraction((s) => ({ ...s, viewport: fitViewport(scene, viewportWidth(), viewportHeight()) }));
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const idx = interaction.selection ? navList.indexOf(interaction.selection) : -1;
        const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
        const next = navList[(idx + delta + navList.length) % navList.length];
        setInteraction((s) => ({ ...s, selection: next ?? null }));
      }
    },
    [scene, interaction.selection, navList],
  );

  const runFps = useCallback(async () => {
    const m = await measureFps(1000);
    setFps(m);
  }, []);

  if (!scene) {
    return (
      <div className="flex h-full items-center justify-center" style={{ background: 'var(--ink-950)' }}>
        <p className="font-mono text-sm" style={{ color: 'var(--red-400)' }}>
          {sceneError ?? 'no scene loaded'}
        </p>
      </div>
    );
  }

  const tier = lodTier(interaction.viewport.scale);

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ background: 'var(--ink-950)' }}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      {/* canvas / svg hosts */}
      <div
        ref={canvasHostRef}
        className={`absolute inset-0 ${backend === 'webgl' ? '' : 'hidden'}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
        onClick={onClick}
        style={{ cursor: dragStateRef.current ? 'grabbing' : 'grab', touchAction: 'none' }}
      >
        <div ref={textOverlayRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
      </div>
      <div
        ref={svgHostRef}
        className={`absolute inset-0 ${backend === 'svg' ? '' : 'hidden'}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
        onClick={onClick}
        style={{ cursor: 'grab', touchAction: 'none' }}
      />

      {/* toolbar */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 flex items-start justify-between p-3">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-md border px-2.5 py-1.5"
          style={{ borderColor: 'var(--ink-750)', background: 'rgba(10,14,18,0.85)' }}>
          <Layers size={13} style={{ color: 'var(--teal-400)' }} />
          <select
            className="bg-transparent font-mono text-[11px] outline-none"
            style={{ color: 'var(--ink-100)' }}
            value={activeSceneId}
            onChange={(e) => onActiveSceneChange(e.target.value)}
          >
            {availableScenes.map((s) => (
              <option key={s.id} value={s.id} style={{ background: '#0A0E12' }}>
                {s.label} ({s.nodeCount})
              </option>
            ))}
          </select>
          <span style={{ color: 'var(--ink-600)' }}>|</span>
          {(['svg', 'webgl'] as BackendKind[]).map((b) => (
            <button
              key={b}
              onClick={() => onBackendChange(b)}
              className="rounded px-1.5 py-0.5 font-mono text-[11px] transition-colors"
              style={
                backend === b
                  ? { background: 'var(--teal-900)', color: 'var(--teal-300)' }
                  : { color: 'var(--ink-400)' }
              }
            >
              {b === 'svg' ? 'SVG' : 'WebGL'}
            </button>
          ))}
          <span style={{ color: 'var(--ink-600)' }}>|</span>
          <input
            value={interaction.query}
            onChange={(e) => setInteraction((s) => ({ ...s, query: e.target.value }))}
            placeholder="filter nodes…"
            className="w-36 bg-transparent font-mono text-[11px] outline-none placeholder:opacity-40"
            style={{ color: 'var(--ink-100)' }}
          />
        </div>

        <div className="pointer-events-auto flex items-center gap-2 rounded-md border px-2.5 py-1.5"
          style={{ borderColor: 'var(--ink-750)', background: 'rgba(10,14,18,0.85)' }}>
          {RELATION_KINDS.map((rk) => {
            const hidden = interaction.hiddenRelations.has(rk);
            return (
              <button
                key={rk}
                onClick={() =>
                  setInteraction((s) => {
                    const next = new Set(s.hiddenRelations);
                    if (next.has(rk)) next.delete(rk);
                    else next.add(rk);
                    return { ...s, hiddenRelations: next };
                  })
                }
                className="rounded px-1.5 py-0.5 font-mono text-[10px] transition-opacity"
                style={{ color: hidden ? 'var(--ink-600)' : 'var(--ink-200)', textDecoration: hidden ? 'line-through' : 'none' }}
              >
                {RELATION_LABELS[rk]}
              </button>
            );
          })}
          <span style={{ color: 'var(--ink-600)' }}>|</span>
          <button
            onClick={() => interaction.selection && setInteraction((s) => ({ ...s, viewport: zoomToNode(scene, s.viewport, s.selection!) }))}
            title="zoom to selection (f)"
            className="p-1"
            style={{ color: 'var(--ink-300)' }}
          >
            <Crosshair size={13} />
          </button>
          <button
            onClick={() => setInteraction((s) => ({ ...s, viewport: fitViewport(scene, viewportWidth(), viewportHeight()) }))}
            title="fit scene (0)"
            className="p-1"
            style={{ color: 'var(--ink-300)' }}
          >
            <Maximize2 size={13} />
          </button>
          <button
            onClick={runFps}
            title="measure frame cadence (1s window)"
            className="p-1"
            style={{ color: fps ? 'var(--teal-400)' : 'var(--ink-300)' }}
          >
            <Activity size={13} />
          </button>
          <button onClick={() => setShowHeatmap((v) => !v)} title="hit-density heatmap PoC" className="p-1" style={{ color: showHeatmap ? 'var(--amber-400)' : 'var(--ink-300)' }}>
            <ZoomIn size={13} />
          </button>
          <button onClick={() => setShowHelp((v) => !v)} className="p-1" style={{ color: 'var(--ink-300)' }}>
            <Keyboard size={13} />
          </button>
        </div>
      </div>

      {/* legend */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 p-3 font-mono text-[10px] leading-relaxed"
        style={{ color: 'var(--ink-500)' }}
      >
        <div>
          evidence provenance:{' '}
          <span style={{ color: 'var(--teal-400)' }}>OBS</span> observed{' '}
          <span style={{ color: 'var(--blue-400)' }}>REP</span> reported{' '}
          <span style={{ color: 'var(--amber-400)' }}>DER</span> derived{' '}
          <span style={{ color: 'var(--ink-500)' }}>N/A</span> not-applicable
        </div>
        <div style={{ color: 'var(--ink-600)' }}>
          replay status is a continuation kind, not provenance — see node cards.
        </div>
        <div>
          {visibleNodes?.size ?? 0}/{scene.nodes.length} nodes · zoom {interaction.viewport.scale.toFixed(2)} · {tier}
        </div>
      </div>

      {/* selection card */}
      {selected && (
        <div
          className="absolute right-3 top-16 w-72 rounded-md border p-3"
          style={{ borderColor: 'var(--ink-750)', background: 'rgba(10,14,18,0.92)' }}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="font-mono text-xs" style={{ color: 'var(--ink-100)' }}>{selected.label}</div>
              <div className="font-mono text-[10px]" style={{ color: 'var(--ink-500)' }}>{selected.id}</div>
            </div>
            <button onClick={() => setInteraction((s) => ({ ...s, selection: null }))} style={{ color: 'var(--ink-500)' }}>
              <X size={12} />
            </button>
          </div>
          <dl className="mt-2 space-y-1 font-mono text-[10px]">
            <div className="flex justify-between">
              <dt style={{ color: 'var(--ink-500)' }}>evidence</dt>
              <dd style={{ color: PROVENANCE_BADGE[selected.provenance].color }}>
                {PROVENANCE_BADGE[selected.provenance].label}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt style={{ color: 'var(--ink-500)' }}>continuation</dt>
              <dd style={{ color: 'var(--ink-200)' }}>{selected.classification}</dd>
            </div>
            {selected.provenanceReason && (
              <div>
                <dt style={{ color: 'var(--ink-500)' }}>why</dt>
                <dd style={{ color: 'var(--ink-400)' }}>{selected.provenanceReason}</dd>
              </div>
            )}
            {ancestry && ancestry.ancestors.size > 0 && (
              <div>
                <dt style={{ color: 'var(--ink-500)' }}>ancestors</dt>
                <dd style={{ color: 'var(--ink-400)' }}>{[...ancestry.ancestors].join(', ')}</dd>
              </div>
            )}
          </dl>
          <div className="mt-2 flex gap-1.5">
            <button
              onClick={() => setInteraction((s) => ({ ...s, viewport: zoomToNode(scene, s.viewport, selected.id) }))}
              className="rounded border px-2 py-0.5 font-mono text-[10px]"
              style={{ borderColor: 'var(--ink-750)', color: 'var(--teal-300)' }}
            >
              zoom (f)
            </button>
            <button
              onClick={() => {
                const focus = focusSetOf(scene, selected.id);
                setInteraction((s) => ({ ...s, focusOverride: focus, viewport: fitViewport(scene, viewportWidth(), viewportHeight()) }));
              }}
              className="rounded border px-2 py-0.5 font-mono text-[10px]"
              style={{ borderColor: 'var(--ink-750)', color: 'var(--blue-300)' }}
            >
              isolate
            </button>
          </div>
        </div>
      )}

      {/* diagnostics */}
      {showDiagnostics && (
        <div
          className="absolute bottom-3 right-3 w-96 rounded-md border p-3 font-mono text-[10px]"
          style={{ borderColor: 'var(--ink-750)', background: 'rgba(10,14,18,0.92)' }}
        >
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--teal-300)' }}>diagnostics</span>
            <button onClick={() => setShowDiagnostics(false)} style={{ color: 'var(--ink-500)' }}>
              <X size={12} />
            </button>
          </div>
          {fps ? (
            <pre className="mt-1 whitespace-pre-wrap" style={{ color: 'var(--ink-300)' }}>{describeMeasurements([fps])}</pre>
          ) : (
            <p className="mt-1" style={{ color: 'var(--ink-500)' }}>no measurement yet — press the activity button.</p>
          )}
          <ul className="mt-2 space-y-1" style={{ color: 'var(--ink-600)' }}>
            {MEASURE_NOTES.map((n, i) => (
              <li key={i}>· {n}</li>
            ))}
          </ul>
        </div>
      )}

      {showHeatmap && (
        <div className="absolute inset-x-3 top-16 bottom-3 rounded-md border"
          style={{ borderColor: 'var(--amber-700)', background: 'rgba(10,14,18,0.85)' }}>
          <HeatmapPoC scene={scene} width={viewportWidth()} height={viewportHeight()} />
        </div>
      )}

      {showHelp && (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md border p-3 font-mono text-[10px]"
          style={{ borderColor: 'var(--ink-750)', background: 'rgba(10,14,18,0.92)', color: 'var(--ink-300)' }}
        >
          <div>← → ↑ ↓ move selection in (depth, row) order · f zoom to selection · 0 fit scene</div>
          <div style={{ color: 'var(--ink-600)' }}>drag to pan · wheel to zoom about the cursor · click a node to select</div>
        </div>
      )}
    </div>
  );
}
