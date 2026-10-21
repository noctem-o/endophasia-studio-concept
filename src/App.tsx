import { AppHeader, AppFooter } from './components/AppShell';
import { ObservationWorkspace } from './workspaces/ObservationWorkspace';
import { CompareWorkspace } from './workspaces/CompareWorkspace';
import { CapabilitiesWorkspace } from './workspaces/CapabilitiesWorkspace';
import { EvolveWorkspace } from './components/evolve/EvolveWorkspace';
import { useStudioState } from './state/studio';

export default function App() {
  const studio = useStudioState();

  return (
    <div className="flex h-screen flex-col bg-ink-950 text-ink-100">
      <AppHeader
        sessions={studio.sessions}
        activeSession={studio.session}
        workspace={studio.workspace}
        onWorkspace={studio.setWorkspace}
        onSelectSession={studio.selectSession}
      />

      <main className="min-h-0 flex-1 overflow-hidden">
        {studio.workspace === 'observe' && <ObservationWorkspace studio={studio} />}
        {studio.workspace === 'compare' && <CompareWorkspace studio={studio} />}
        {studio.workspace === 'capabilities' && <CapabilitiesWorkspace studio={studio} />}
        {studio.workspace === 'evolve' && <EvolveWorkspace studio={studio} />}
      </main>

      <AppFooter />
    </div>
  );
}
