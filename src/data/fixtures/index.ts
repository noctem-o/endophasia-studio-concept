import type { Session } from '../../domain/types';
import { scenarioA, scenarioB, scenarioE } from './scenariosABE';
import { scenarioC, scenarioD } from './scenariosCDF';
import { scenarioF } from './scenarioF';

/**
 * The demonstration registry. A future implementation replaces this module with
 * a loader over validated Endophasia observation projections; the Session shape
 * is the contract.
 */
export const sessions: Session[] = [scenarioA, scenarioB, scenarioC, scenarioD, scenarioE, scenarioF];

export const sessionById = (id: string): Session | undefined =>
  sessions.find((s) => s.id === id);

export const DEMONSTRATION_NOTE =
  'All sessions, events, capabilities and sources in this prototype are synthetic demonstration data. Nothing here is connected to a real runtime.';
