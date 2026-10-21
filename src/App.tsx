import { useEffect, useState } from 'react';
import { AppHeader, AppStatusBar, ShortcutDialog } from './components/AppShell';
import { WORKSPACES } from './state/workspaces';
import { ObservationWorkspace } from './workspaces/ObservationWorkspace';
import { CompareWorkspace } from './workspaces/CompareWorkspace';
import { CapabilitiesWorkspace } from './workspaces/CapabilitiesWorkspace';
import { EvolveWorkspace } from './components/evolve/EvolveWorkspace';
import { useStudioState } from './state/studio';
import type { StudioState } from './state/studio';
import { isTypingTarget } from './state/keys';

function statusContext(studio: StudioState): string {
  switch (studio.workspace) {
    case 'observe': {
      const n = studio.session.events.length;
      const e = studio.selectedEvent;
      return e ? `${studio.session.id} · event ${e.seq} of ${n} · ${e.title}` : `${studio.session.id} · ${n} events in storage order · nothing selected`;
    }
    case 'compare':
      return `A ${studio.compareSessionA.id} · B ${studio.compareSessionB.id} · alignment is proposed, never verified`;
    case 'capabilities':
      return `${studio.session.id} · ${studio.selectedCapability?.name ?? studio.session.capabilities[0]?.name ?? 'no capability'}`;
    case 'evolve':
      return `Counterfactual Laboratory · ${studio.evolveView.kind}`;
  }
}

export default function App() {
  const studio = useStudioState();
  const [helpOpen, setHelpOpen] = useState(false);
  const { setWorkspace } = studio;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target) || helpOpen) return;
      const ws = WORKSPACES.find((w) => w.key === e.key);
      if (ws) {
        e.preventDefault();
        setWorkspace(ws.id);
      } else if (e.key === '?') {
        e.preventDefault();
        setHelpOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [helpOpen, setWorkspace]);

  return (
    <div className="flex h-screen flex-col bg-surface-0 text-fg-1">
      <a href="#workspace" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-ctl focus:bg-surface-3 focus:px-3 focus:py-2 focus:text-xs">
        Skip to workspace
      </a>
      <AppHeader workspace={studio.workspace} onWorkspace={studio.setWorkspace} onHelp={() => setHelpOpen(true)} />

      <main id="workspace" tabIndex={-1} className="min-h-0 flex-1 overflow-hidden outline-none">
        {studio.workspace === 'observe' && <ObservationWorkspace studio={studio} />}
        {studio.workspace === 'compare' && <CompareWorkspace studio={studio} />}
        {studio.workspace === 'capabilities' && <CapabilitiesWorkspace studio={studio} />}
        {studio.workspace === 'evolve' && <EvolveWorkspace studio={studio} />}
      </main>

      <AppStatusBar context={statusContext(studio)} />
      <ShortcutDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
