import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, Gauge, Maximize2 } from 'lucide-react';
import type { LineageScene } from './types';
import type { Viewport } from './renderers/types';
import { createRenderer, isBackendAvailable, type BackendId } from './renderers';
import type { LineageRenderer } from './renderers/types';
import { measureFps, measureRenderer, type MeasurementBlock } from './renderers/measure';
import {
  clampScale, filteredVisibleNodes, fitViewport, focusSetOf, initialInteraction, lodTier, navOrder, type InteractionState,
} from './interaction';
import { CLASSIFICATION_TAG, PROVENANCE_BADGE } from './renderers/palette';
import { makeHeatmapPoc } from './heatmapPoc';
import { ExplorerKey } from './ExplorerKey';
import { NodeOverlay } from './NodeOverlay';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { Button, SearchField } from '@/ui/controls';
import type { LineageRelation } from '@/domain/evolve';
import type { EvidenceKind } from '@/domain/types';
import { ProvMark } from '@/ui/marks';

/**
 * LineageExplorer — renderer-independent graph explorer.
 * Owns viewport/selection/filter/focus as React state; the renderer is a
 * replaceable view. Backend switches rebuild the renderer and push the exact
 * same state back in, so selection and camera survive the swap.
 *
 * The host application may follow the selection (`onSelectNode`) and may set it from outside (`selectedId`); selecting a node
 * never navigates away from the graph. `onOpenNode` is the explicit "open this record" action and is retained for callers that
 * want it.
 */

const PROV_KIND: Record<string, EvidenceKind> = { observed: 'OBS', reported: 'REP', derived: 'DER', 'not-applicable': 'NA' };

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
  /** Explicit "open the record" action. Selecting a node does not call this. */
  onOpenNode?: (id: string) => void;
  /** Called whenever the selection changes by interaction (a node id, or null when cleared). */
  onSelectNode?: (id: string | null) => void;
  /** When defined, the selection follows this value (set from outside, e.g. from an inspector). */
  selectedId?: string | null;
}

const selectCls = 'h-6 max-w-[300px] rounded-tag border border-line bg-surface-2 px-1.5 font-mono text-2xs text-fg-1 hover:border-line-strong focus:border-line-strong';

export function LineageExplorer({ scenes, initialSceneId, initialSelection = null, onOpenNode, onSelectNode, selectedId }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<LineageRenderer | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; vp: Viewport } | null>(null);
  const movedRef = useRef(false);
  const viewSizeRef = useRef({ w: 800, h: 600 });
  const needsFitRef = useRef(true);

  const [backend, setBackend] = useState<BackendId>(() => (isBackendAvailable('webgl2-instanced') ? 'webgl2-instanced' : 'svg-dom'));
  const [backendIssue, setBackendIssue] = useState<string | null>(null);
  const [sceneId, setSceneId] = useState(initialSceneId ?? scenes[0]?.id ?? '');
  const [interaction, setInteraction] = useState<InteractionState>(() => ({ ...initialInteraction(), selection: selectedId !== undefined ? selectedId : initialSelection }));
  const [backendDetails, setBackendDetails] = useState('');
  const [measurements, setMeasurements] = useState<MeasurementBlock[]>([]);
  const [fps, setFps] = useState<{ median: number; min: number } | null | 'unmeasured'>('unmeasured');
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [keyOpen, setKeyOpen] = useState(true);
  const [size, setSize] = useState({ w: 800, h: 600 });

  const scene = useMemo(() => scenes.find((s) => s.id === sceneId) ?? scenes[0], [scenes, sceneId]);
  const heatmapScene = useMemo(() => makeHeatmapPoc(), []);
  const visible = useMemo(() => (scene ? filteredVisibleNodes(scene.scene, interaction) : new Set<string>()), [scene, interaction]);
  const lod = lodTier(interaction.viewport.scale);

  const interactionRef = useRef(interaction);
  interactionRef.current = interaction;
  const onOpenNodeRef = useRef(onOpenNode);
  onOpenNodeRef.current = onOpenNode;
  const onSelectNodeRef = useRef(onSelectNode);
  onSelectNodeRef.current = onSelectNode;
  const sceneRef = useRef(scene);
  sceneRef.current = scene;

  const select = useCallback((id: string | null) => {
    setInteraction((s) => ({ ...s, selection: id }));
    onSelectNodeRef.current?.(id);
  }, []);

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
        // A drag that ends over a node is a pan, not a selection.
        if (movedRef.current) return;
        select(id);
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

  // ── Resize handling; the first real size fits the graph ───────────────────
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const ro = new ResizeObserver(() => {
      const r = host.getBoundingClientRect();
      viewSizeRef.current = { w: Math.max(1, r.width), h: Math.max(1, r.height) };
      setSize(viewSizeRef.current);
      rendererRef.current?.resize(viewSizeRef.current.w, viewSizeRef.current.h);
      if (needsFitRef.current && r.width > 1 && r.height > 1 && sceneRef.current) {
        needsFitRef.current = false;
        const { w, h } = viewSizeRef.current;
        setInteraction((s) => ({ ...s, viewport: fitViewport(sceneRef.current!.scene, w, h) }));
      }
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
      movedRef.current = false;
    };
    const move = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (!movedRef.current && Math.abs(dx) + Math.abs(dy) > 4) {
        movedRef.current = true;
        host.style.cursor = 'grabbing';
      }
      if (!movedRef.current) return;
      setInteraction((s) => ({ ...s, viewport: { ...s.viewport, x: d.vp.x + dx, y: d.vp.y + dy } }));
    };
    const up = () => {
      dragRef.current = null;
      host.style.cursor = '';
      // The click that follows a drag is dispatched after mouseup; clear the flag once it has had its chance.
      setTimeout(() => { movedRef.current = false; }, 0);
    };
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

  // A selection made outside the graph (an inspector link) is followed, and brought into view only if it is off-screen.
  useEffect(() => {
    if (selectedId === undefined || !scene) return;
    if (selectedId === interactionRef.current.selection) return;
    setInteraction((s) => ({ ...s, selection: selectedId }));
    if (selectedId) {
      const p = scene.scene.layout.positions[selectedId];
      if (p) {
        const { viewport: vp } = interactionRef.current;
        const enc = scene.scene.encoding;
        const sx = (20 + p.column * enc.columnGap) * vp.scale + vp.x;
        const sy = (20 + p.row * enc.rowGap) * vp.scale + vp.y;
        const { w, h } = viewSizeRef.current;
        if (sx < 0 || sy < 0 || sx + enc.nodeWidth * vp.scale > w || sy + enc.nodeHeight * vp.scale > h) centerOn(selectedId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Switching scene: keep a selection in view if there is one, otherwise fit the new scene.
  const firstSceneRender = useRef(true);
  useEffect(() => {
    if (firstSceneRender.current) { firstSceneRender.current = false; return; }
    if (interactionRef.current.selection && scene?.scene.layout.positions[interactionRef.current.selection]) centerOn(interactionRef.current.selection);
    else fitToScene();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId]);

  // ── Keyboard navigation ──────────────────────────────────────
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!scene) return;
    const order = navOrder(scene.scene);
    const idx = interaction.selection ? order.indexOf(interaction.selection) : -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = order[Math.min(order.length - 1, idx + 1)];
      if (next) select(next);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = order[Math.max(0, idx - 1)];
      if (prev) select(prev);
    } else if (e.key === 'f' && interaction.selection) {
      setInteraction((s) => ({ ...s, focus: s.focus ? null : focusSetOf(scene.scene, s.selection!) }));
    } else if (e.key === '0') {
      if (scene) setInteraction((s) => ({ ...s, viewport: fitViewport(scene.scene, viewSizeRef.current.w, viewSizeRef.current.h) }));
    } else if (e.key === 'Escape' && (interaction.selection || interaction.focus)) {
      e.preventDefault();
      setInteraction((s) => ({ ...s, focus: null }));
      if (interaction.selection) select(null);
    } else if (e.key === 'Enter' && interaction.selection) {
      onOpenNodeRef.current?.(interaction.selection);
    }
  }, [scene, interaction.selection, interaction.focus, select]);

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

  const toggleRelation = (r: LineageRelation) => setInteraction((s) => {
    const next = new Set(s.hiddenRelations);
    if (next.has(r)) next.delete(r); else next.add(r);
    return { ...s, hiddenRelations: next };
  });

  const toggleFocus = () => {
    if (interaction.selection && scene) {
      const id = interaction.selection;
      setInteraction((s) => ({ ...s, focus: s.focus ? null : focusSetOf(scene.scene, id) }));
    }
  };

  if (!scene) return <div className="p-4 text-xs text-fg-3">no scene available</div>;

  const selectedNode = scene.scene.nodes.find((n) => n.id === interaction.selection) ?? null;
  const vp = interaction.viewport;
  const dot = Math.max(10, 28 * vp.scale);

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="lineage-explorer">
      <div className="relative flex min-h-0 flex-1">
        {/* Graph viewport */}
        <div
          ref={hostRef}
          tabIndex={0}
          onKeyDown={onKeyDown}
          role="application"
          aria-label="Lineage graph viewport — drag to pan, scroll to zoom, arrow keys to move selection"
          className="relative min-h-0 flex-1 cursor-grab overflow-hidden bg-surface-0 outline-none focus-visible:shadow-focus-inset"
        >
          {/* A dot grid that pans and zooms with the graph: orientation without ink. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: 'radial-gradient(rgba(236,232,223,0.10) 1px, transparent 1.2px)',
              backgroundSize: `${dot}px ${dot}px`,
              backgroundPosition: `${vp.x}px ${vp.y}px`,
            }}
          />
          {/* DOM text overlay (the WebGL backend draws shapes only) */}
          {backend === 'webgl2-instanced' && (
            <NodeOverlay scene={scene.scene} visible={visible} viewport={vp} size={size} focus={interaction.focus} lod={lod} />
          )}

          {visible.size === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="rounded-ctl border border-line bg-surface-1 px-4 py-3 font-mono text-2xs text-fg-2">no node matches “{interaction.query}”</p>
            </div>
          )}
        </div>

        {/* Floating controls: they sit beside the viewport, so using them never starts a pan. */}
        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-3">
          <div className="pointer-events-auto flex items-center gap-2 rounded-panel border border-line bg-surface-1/95 p-1.5 shadow-pop">
            <SearchField
              value={interaction.query}
              onChange={(query) => setInteraction((s) => ({ ...s, query }))}
              placeholder="Filter by label or id"
              label="Filter nodes"
              className="w-48"
            />
            <Button
              onClick={toggleFocus}
              disabled={!interaction.selection}
              active={interaction.focus !== null}
              leading={<Crosshair className="h-3 w-3" aria-hidden />}
              title="Dim everything except the selected execution's ancestors and descendants (f)"
            >
              focus lineage
            </Button>
            <Button onClick={fitToScene} leading={<Maximize2 className="h-3 w-3" aria-hidden />} title="Fit the whole graph (0)">fit</Button>
          </div>
          <div className="pointer-events-auto">
            <ExplorerKey open={keyOpen} onToggle={() => setKeyOpen((o) => !o)} hidden={interaction.hiddenRelations} onToggleRelation={toggleRelation} backend={backend} />
          </div>
        </div>

        {scene.synthetic && (
          <div className="pointer-events-none absolute inset-x-0 top-[64px] flex justify-center">
            <span className="hatch rounded-tag border border-line-strong bg-surface-1 px-3 py-1 font-mono text-2xs font-semibold tracking-[0.12em] text-fg-1">
              SYNTHETIC FIXTURE · {scene.scene.nodes.length} NODES · A STRESS SCENE, NOT A RESULT
            </span>
          </div>
        )}

        {selectedNode && (
          <div className="pointer-events-none absolute bottom-3 left-3 max-w-[340px] rounded-panel border border-line-strong bg-surface-1/95 p-3 shadow-pop">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-2xs">
              <span style={{ color: CLASSIFICATION_TAG[selectedNode.classification].color }}>{CLASSIFICATION_TAG[selectedNode.classification].label}</span>
              <ProvMark kind={PROV_KIND[selectedNode.provenance]} title={PROVENANCE_BADGE[selectedNode.provenance].label} />
              <span className="text-fg-3">{selectedNode.id}</span>
            </div>
            <p className="mt-1.5 text-xs font-medium text-fg-1">{selectedNode.label}</p>
            <p className="mt-1 text-2xs leading-relaxed text-fg-3">{selectedNode.provenanceReason}</p>
            <p className="mt-1.5 font-mono text-2xs text-fg-3">
              coordinates: {selectedNode.coordinates.recorded} recorded / {selectedNode.coordinates.unavailable} unavailable
            </p>
          </div>
        )}

        {showDiagnostics && (
          <DiagnosticsPanel
            backend={backend}
            scene={scene.scene}
            visibleCount={visible.size}
            lod={lod}
            backendDetails={backendDetails}
            fps={fps}
            measurements={measurements}
            onRun={runMeasurements}
            heatmap={heatmapScene}
          />
        )}
      </div>

      {backendIssue && (
        <p className="shrink-0 border-t border-attn/40 bg-attn/10 px-3 py-1 font-mono text-2xs text-attn">{backendIssue}</p>
      )}

      {/* Renderer bar: what is being drawn, and how */}
      <div className="flex h-9 shrink-0 items-center gap-3 border-t border-line bg-surface-1 px-3">
        <span className="eyebrow">Scene</span>
        <select value={sceneId} onChange={(e) => setSceneId(e.target.value)} aria-label="Scene" className={selectCls}>
          {scenes.map((s) => (
            <option key={s.id} value={s.id}>{s.label}{s.synthetic ? ' (synthetic)' : ''}</option>
          ))}
        </select>
        <span className="eyebrow">Renderer</span>
        <select value={backend} onChange={(e) => switchBackend(e.target.value as BackendId)} aria-label="Renderer backend" className={selectCls}>
          <option value="webgl2-instanced">WebGL2 instanced</option>
          <option value="svg-dom">SVG (DOM)</option>
        </select>
        <Button onClick={() => setShowDiagnostics((v) => !v)} active={showDiagnostics} leading={<Gauge className="h-3 w-3" aria-hidden />}>diagnostics</Button>
        <span className="ml-auto font-mono text-2xs text-fg-3 tnum">
          {visible.size}/{scene.scene.nodes.length} nodes · LOD {lod} · {Math.round(vp.scale * 100)}%
        </span>
      </div>
    </div>
  );
}
