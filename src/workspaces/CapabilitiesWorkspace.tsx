import { useMemo, useState } from 'react';
import type { StudioState } from '../state/studio';
import { capabilityMeta } from '../state/meta';
import { citedSources } from '../state/capabilities';
import { WorkspaceBar } from '../components/AppShell';
import { InspectorColumn } from '../components/InspectorColumn';
import { SessionSwitcher } from '../components/SessionSwitcher';
import { CapabilityMatrix } from '../components/capabilities/CapabilityMatrix';
import { CapabilityInspector } from '../components/capabilities/CapabilityInspector';
import { SourceLedger } from '../components/capabilities/SourceLedger';
import { CapabilityGlyph } from '../ui/marks';

export function CapabilitiesWorkspace({ studio }: { studio: StudioState }) {
  const session = studio.session;
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const selected = studio.selectedCapability ?? session.capabilities[0] ?? null;

  const cited = useMemo(() => new Map(session.capabilities.map((c) => [c.id, citedSources(c)])), [session]);
  const citedCount = (id: string) => session.capabilities.filter((c) => cited.get(c.id)?.has(id)).length;
  // With a source selected, capabilities that do not cite it recede. Nothing is hidden: absence of a citation is information too.
  const dimmed = useMemo(
    () => new Set(sourceId ? session.capabilities.filter((c) => !cited.get(c.id)?.has(sourceId)).map((c) => c.id) : []),
    [session, cited, sourceId],
  );
  const activeSource = session.sources.some((s) => s.id === sourceId) ? sourceId : null;

  const tally = useMemo(() => {
    const t = new Map<string, number>();
    for (const c of session.capabilities) t.set(c.status, (t.get(c.status) ?? 0) + 1);
    return [...t.entries()].sort((a, b) => capabilityMeta[a[0] as keyof typeof capabilityMeta].order - capabilityMeta[b[0] as keyof typeof capabilityMeta].order);
  }, [session]);

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <WorkspaceBar>
          <SessionSwitcher sessions={studio.sessions} value={session.id} onChange={(id) => { setSourceId(null); studio.selectSession(id); }} />
          <ul aria-label="Capabilities by status" className="hidden items-center gap-x-4 font-mono text-2xs text-fg-3 xl:flex">
            {tally.map(([status, n]) => (
              <li key={status} className="inline-flex items-center gap-1.5" title={capabilityMeta[status as keyof typeof capabilityMeta].desc}>
                <CapabilityGlyph status={status as keyof typeof capabilityMeta} size={11} />
                {capabilityMeta[status as keyof typeof capabilityMeta].label.toLowerCase()} <span className="text-fg-2 tnum">{n}</span>
              </li>
            ))}
          </ul>
        </WorkspaceBar>

        <SourceLedger sources={session.sources} active={activeSource} citedCount={citedCount} onToggle={(id) => setSourceId(activeSource === id ? null : id)} />

        <CapabilityMatrix
          session={session}
          selectedId={selected?.id ?? null}
          dimmed={dimmed}
          onSelect={(id) => { studio.setCapabilityId(id); setDrawer(true); }}
        />
      </div>

      <InspectorColumn label="Capability inspector" open={drawer && selected !== null} onClose={() => setDrawer(false)}>
        {selected ? (
          <CapabilityInspector key={selected.id} session={session} capability={selected} onClose={() => setDrawer(false)} onInspect={studio.inspectEventOf} />
        ) : (
          <p className="p-6 font-mono text-2xs text-fg-3">no capabilities declared</p>
        )}
      </InspectorColumn>
    </div>
  );
}
