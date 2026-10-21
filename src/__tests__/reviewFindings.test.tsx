// @vitest-environment jsdom
// Regressions found by review of the draft PR: each test fails against the behaviour it names.
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';
import App from '../App';
import { LineageExplorer } from '../scenes/LineageExplorer';
import { explorerScenes } from '../scenes/explorerScenes';
import { CheckpointsSection } from '../components/evolve/CheckpointsSection';
import { evolveCorpus } from '../data/evolve';

beforeAll(() => {
  const g = globalThis as { ResizeObserver?: unknown };
  if (typeof g.ResizeObserver === 'undefined') g.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(cleanup);

describe('Escape in the lineage graph unwinds in two steps', () => {
  it('the first Escape leaves lineage focus and keeps the selection; the second clears the selection', () => {
    const onSelectNode = vi.fn();
    const recorded = explorerScenes.filter((e) => !e.synthetic);
    const { getByRole } = render(<LineageExplorer scenes={recorded} onSelectNode={onSelectNode} />);
    const app = getByRole('application');
    act(() => { fireEvent.keyDown(app, { key: 'ArrowRight' }); });
    const selectedId = onSelectNode.mock.calls.at(-1)?.[0];
    expect(selectedId).toBeTruthy();
    act(() => { fireEvent.keyDown(app, { key: 'f' }); });
    expect(getByRole('button', { name: 'focus lineage' }).getAttribute('aria-pressed')).toBe('true');
    onSelectNode.mockClear();
    act(() => { fireEvent.keyDown(app, { key: 'Escape' }); });
    expect(getByRole('button', { name: 'focus lineage' }).getAttribute('aria-pressed')).toBe('false');
    expect(onSelectNode).not.toHaveBeenCalled(); // still selected
    act(() => { fireEvent.keyDown(app, { key: 'Escape' }); });
    expect(onSelectNode).toHaveBeenLastCalledWith(null);
  });
});

describe('the event grid moves from the row that has focus', () => {
  it('with nothing selected, ArrowDown on the focused first row selects the SECOND row', () => {
    render(<App />);
    const rows = Array.from(document.querySelectorAll<HTMLElement>('tbody tr[data-seq]'));
    expect(rows.every((r) => r.getAttribute('aria-selected') === 'false')).toBe(true);
    act(() => { rows[0].focus(); fireEvent.keyDown(rows[0], { key: 'ArrowDown' }); });
    const selected = rows.filter((r) => r.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveLength(1);
    expect(selected[0]).toBe(rows[1]);
  });
});

describe('the checkpoint dossier lists only the branches that name that checkpoint', () => {
  const branchIds = (checkpointId: string) => {
    const { container, unmount } = render(
      <CheckpointsSection corpus={evolveCorpus} checkpointId={checkpointId} onSelect={() => {}} onOpenExecution={() => {}} onOpenExperiment={() => {}} />,
    );
    // The branch list is in the inspector column; at jsdom's width it is the desktop column, so its content is rendered.
    const ids = Array.from(container.querySelectorAll('aside .font-mono')).map((n) => n.textContent ?? '');
    unmount();
    return ids;
  };
  it('exec-sim1 (a projection from ckpt-a-08) belongs to ckpt-a-08 only', () => {
    expect(branchIds('ckpt-a-08')).toContain('exec-sim1');
    expect(branchIds('ckpt-a-11')).not.toContain('exec-sim1');
    expect(branchIds('ckpt-trunc-08')).not.toContain('exec-sim1');
  });
});

describe('a Compare isolate does not outlive its alignment', () => {
  it('swapping the pair clears the isolate chip', () => {
    const { getByRole, getAllByRole } = render(<App />);
    act(() => { fireEvent.keyDown(window, { key: '2' }); });
    const chips = () => getAllByRole('button').filter((b) => /click to isolate/.test(b.getAttribute('title') ?? ''));
    expect(chips().length).toBeGreaterThan(0);
    act(() => { fireEvent.click(chips()[0]); });
    expect(chips().some((c) => c.getAttribute('aria-pressed') === 'true')).toBe(true);
    act(() => { fireEvent.click(getByRole('button', { name: /swap/i })); });
    expect(chips().some((c) => c.getAttribute('aria-pressed') === 'true')).toBe(false);
  });
});
