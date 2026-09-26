import type { Fracture, Scenario } from '../fractures';
import { MEDIEVAL_A } from './medieval';

/**
 * The fracture roster (bible §9.1; open-ended) and the scenarios built so
 * far. A scenario appears here only once it exists: the generator never
 * invents placeholders, and with no valid pair new expeditions use the
 * legacy route.
 */
export const FRACTURES: Fracture[] = [
  { id: 'prehistoric', name: 'Prehistoric', introductory: true },
  { id: 'medieval', name: 'Medieval', introductory: true },
  { id: '1800s', name: 'The 1800s', unlockAt: 1 },
  { id: 'modern', name: 'Modern', introductory: true },
  { id: 'future', name: 'The Future', unlockAt: 2 },
];

export const SCENARIOS: Scenario[] = [MEDIEVAL_A];

export const SCENARIO_TITLES: Record<string, string> = Object.fromEntries(SCENARIOS.map((s) => [s.id, s.title]));
