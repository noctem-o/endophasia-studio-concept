import type { EvidenceKind } from '@/domain/types';
import { ProvGlyph } from '@/ui/marks';
import type { LineageScene, SceneProvenance } from './types';
import type { Viewport } from './renderers/types';
import { CLASSIFICATION_TAG, PROVENANCE_BADGE } from './renderers/palette';
import type { LodTier } from './interaction';

const PROV_KIND: Record<SceneProvenance, EvidenceKind> = { observed: 'OBS', reported: 'REP', derived: 'DER', 'not-applicable': 'NA' };

/**
 * Node text for the WebGL backend, which draws shapes only. Each card is laid out in WORLD units and scaled with the same
 * transform as the graph (`transform: scale`), so text tracks the nodes exactly at every zoom, as it does in the SVG backend.
 * Culled to the viewport; its cost is therefore separate from the GPU's, as the renderer docs require.
 */
export function NodeOverlay({ scene, visible, viewport, size, emphasis, lod }: {
  scene: LineageScene;
  visible: ReadonlySet<string>;
  viewport: Viewport;
  size: { w: number; h: number };
  /** Nodes kept at full emphasis (the filter, the lineage focus, or both); null = all. Every other node is DIMMED, never removed. */
  emphasis: ReadonlySet<string> | null;
  lod: LodTier;
}) {
  // Past 2,000 nodes the text cards would cost more than they show: only the matching nodes get one.
  const crowded = scene.nodes.length > 2000;
  if (lod === 'dots' || (crowded && visible.size > 2000)) return null;
  const enc = scene.encoding;
  const k = viewport.scale;
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {scene.nodes
        .filter((n) => scene.layout.positions[n.id] && (!crowded || visible.has(n.id)))
        .map((n) => {
          const p = scene.layout.positions[n.id];
          const sx = (20 + p.column * enc.columnGap) * k + viewport.x;
          const sy = (20 + p.row * enc.rowGap) * k + viewport.y;
          if (sx < -enc.nodeWidth * k - 40 || sy < -enc.nodeHeight * k - 20 || sx > size.w + 40 || sy > size.h + 40) return null;
          // The same rule as the SVG backend: a node outside the emphasis keeps its card and is dimmed.
          const dim = emphasis !== null && !emphasis.has(n.id);
          const tag = CLASSIFICATION_TAG[n.classification];
          const prov = PROVENANCE_BADGE[n.provenance];
          return (
            <div
              key={n.id}
              data-overlay-node={n.id}
              className="absolute origin-top-left"
              style={{ left: sx, top: sy, width: enc.nodeWidth, height: enc.nodeHeight, transform: `scale(${k})`, opacity: dim ? 0.15 : 1 }}
            >
              <div className="flex items-center gap-1 px-2.5 pt-[6px] font-mono text-[9px] leading-[11px] tracking-[0.08em]">
                <span style={{ color: tag.color }}>{tag.label}</span>
                <span className="ml-auto inline-flex items-center gap-1" style={{ color: prov.color }}>
                  <ProvGlyph kind={PROV_KIND[n.provenance]} size={9} />
                  {prov.label}
                </span>
              </div>
              {lod === 'full' && (
                <>
                  <div className="truncate px-2.5 pt-[3px] text-[11px] leading-[14px] text-fg-1">{n.label}</div>
                  <div className="truncate px-2.5 font-mono text-[9px] leading-[11px] text-fg-3">{n.sessionId ?? 'trajectory not in registry'}</div>
                </>
              )}
              {n.sessionId === null && (
                <svg width="12" height="12" viewBox="0 0 12 12" className="absolute bottom-[5px] right-[7px] text-na" aria-hidden>
                  <circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2 1.7" />
                </svg>
              )}
            </div>
          );
        })}
    </div>
  );
}
