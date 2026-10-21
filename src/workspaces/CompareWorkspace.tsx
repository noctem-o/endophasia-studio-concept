import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { alignTrajectories } from '../analysis/compare';
import type { StudioState } from '../state/studio';
import { buildLinks, classCounts } from '../state/compare';
import type { LinkClass } from '../state/compare';
import { isPlainShortcut } from '../state/keys';
import { WorkspaceBar } from '../components/AppShell';
import { InspectorColumn } from '../components/InspectorColumn';
import { SessionSwitcher } from '../components/SessionSwitcher';
import { CorrespondenceMap } from '../components/compare/CorrespondenceMap';
import { CLASS_LABEL, CLASS_MEANING } from '../components/compare/classMeta';
import { MethodologyBrief, PairInspector } from '../components/compare/PairInspector';
import { Button, Chip } from '../ui/controls';

const ORDER: LinkClass[] = ['exact', 'proposed', 'unmatched-a', 'unmatched-b'];

/** A sample of how each class is drawn, so the legend is the same ink as the map. */
function Sample({ cls }: { cls: LinkClass }) {
  return (
    <svg width="22" height="10" viewBox="0 0 22 10" aria-hidden className="shrink-0">
      {cls === 'exact' && <path d="M1 5h20" className="stroke-fg-2" strokeWidth="1.8" strokeLinecap="round" />}
      {cls === 'proposed' && <path d="M1 5h20" className="stroke-fg-3" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="5 3" />}
      {(cls === 'unmatched-a' || cls === 'unmatched-b') && <><path d="M1 5h10" className="stroke-fg-4" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="2 2.4" /><circle cx="15" cy="5" r="3.2" className="fill-surface-0 stroke-fg-3" strokeWidth="1.2" /></>}
    </svg>
  );
}

export function CompareWorkspace({ studio }: { studio: StudioState }) {
  const a = studio.compareSessionA;
  const b = studio.compareSessionB;
  const links = useMemo(() => buildLinks(alignTrajectories(a.events, b.events)), [a, b]);
  const counts = useMemo(() => classCounts(links), [links]);
  const differing = links.filter((l) => l.differences.length > 0).length;

  const [selected, setSelected] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [focusClass, setFocusClass] = useState<LinkClass | null>(null);

  // A different pair of trajectories is a different alignment: nothing carries over.
  useEffect(() => { setSelected(null); setHover(null); }, [a.id, b.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (isPlainShortcut(e) && e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const link = selected === null ? null : links.find((l) => l.index === selected) ?? null;
  const swap = () => { studio.setCompareA(b.id); studio.setCompareB(a.id); };

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <WorkspaceBar actions={<Button onClick={swap} leading={<ArrowLeftRight className="h-3 w-3" aria-hidden />} title="Swap A and B">swap</Button>}>
          <SessionSwitcher label="Trajectory A" sessions={studio.sessions} value={a.id} onChange={studio.setCompareA} />
          <span aria-hidden className="font-mono text-2xs text-fg-3">against</span>
          <SessionSwitcher label="Trajectory B" sessions={studio.sessions} value={b.id} onChange={studio.setCompareB} />
        </WorkspaceBar>

        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface-1 px-4 py-2">
          <div role="group" aria-label="Show only one kind of link" className="flex flex-wrap items-center gap-1.5">
            {ORDER.map((c) => (
              <Chip key={c} active={focusClass === c} onClick={() => setFocusClass(focusClass === c ? null : c)} title={`${CLASS_MEANING[c]} (click to isolate)`} leading={<Sample cls={c} />}>
                {CLASS_LABEL[c]}<span className="ml-0.5 text-fg-3 tnum">{counts[c]}</span>
              </Chip>
            ))}
          </div>
          <span className="ml-auto font-mono text-2xs text-fg-3 tnum">
            {a.events.length} events vs {b.events.length} events · {differing} {differing === 1 ? 'link differs' : 'links differ'} in a recorded status, evidence class or compared field
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          {a.events.length === 0 && b.events.length === 0 ? (
            <p className="py-16 text-center font-mono text-2xs text-fg-3">nothing to align</p>
          ) : (
            <CorrespondenceMap a={a} b={b} links={links} selectedIndex={selected} hoverIndex={hover} focusClass={focusClass} onSelect={setSelected} onHover={setHover} />
          )}
        </div>
      </div>

      <InspectorColumn label="Link inspector" open={link !== null} onClose={() => setSelected(null)}>
        {link ? (
          <PairInspector key={link.index} link={link} sessionA={a} sessionB={b} onClose={() => setSelected(null)} onOpenEvent={studio.inspectEventOf} />
        ) : (
          <MethodologyBrief />
        )}
      </InspectorColumn>
    </div>
  );
}
