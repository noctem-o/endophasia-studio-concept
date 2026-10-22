import { Puzzle } from 'lucide-react';
import { UnsupportedProjectionState } from '../../ui/states';

/**
 * How Observe communicates projection-version limits:
 * - some records unreadable → a restrained banner names them and states the limit (nothing is hidden silently);
 * - no record readable → the whole surface becomes UnsupportedProjectionState (from ui/states).
 */

export interface UnreadableRecord {
  id: string;
  label: string;
  projection: string;
}

export function ProjectionBanner({ unsupported, supported }: { unsupported: UnreadableRecord[]; supported: readonly string[] }) {
  const versions = [...new Set(unsupported.map((u) => u.projection))].join(', ');
  return (
    <div role="status" className="shrink-0 border-b border-line bg-surface-1 px-4 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-2xs text-fg-3">
        <Puzzle className="h-3.5 w-3.5 shrink-0 text-fg-4" aria-hidden />
        <span>
          {unsupported.length} {unsupported.length === 1 ? 'record' : 'records'} written by{' '}
          {unsupported.length === 1 ? 'a projection' : 'projections'} <span className="text-fg-2">{versions}</span>
          {' '}— not shown: this build reads {supported.join(', ')} only.
        </span>
      </div>
    </div>
  );
}

export { UnsupportedProjectionState };
