import type { LineageScene } from './types';

/** A repeatable operation that CONSTRUCTS the scene an entry displays, so scene-construction cost can be measured honestly. */
export interface SceneBuilder {
  /** What the operation is, for the measurement's label: constructing from records is not the same as generating a fixture. */
  label: string;
  /** Builds the scene afresh. Must be pure and deterministic, and must return a scene whose content digest equals the displayed one. */
  run: () => LineageScene | null;
}

export interface ExplorerSceneEntry {
  id: string;
  label: string;
  scene: LineageScene;
  synthetic: boolean;
  /** Absent when the scene arrived already built: its construction cost is then reported unmeasured, never timed as a no-op. */
  build?: SceneBuilder;
}
