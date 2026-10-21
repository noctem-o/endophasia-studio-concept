import { GitBranch, GitCompareArrows, LayoutGrid, Microscope } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { WorkspaceId } from './studio';

/** The four workspaces, in the order of the number keys that open them. */
export const WORKSPACES: { id: WorkspaceId; label: string; key: string; icon: LucideIcon; blurb: string }[] = [
  { id: 'observe', label: 'Observe', key: '1', icon: Microscope, blurb: 'One recorded session: trajectory, events, evidence' },
  { id: 'compare', label: 'Compare', key: '2', icon: GitCompareArrows, blurb: 'Two trajectories, aligned by a stated method' },
  { id: 'capabilities', label: 'Capabilities', key: '3', icon: LayoutGrid, blurb: 'Declared against observed, and the sources behind it' },
  { id: 'evolve', label: 'Evolve', key: '4', icon: GitBranch, blurb: 'Counterfactual Laboratory: lineage, experiments, gates' },
];

