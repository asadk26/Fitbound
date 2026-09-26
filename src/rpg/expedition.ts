import { EXERCISES, FAMILIES, getExercise, type Family } from '../exercise/registry';
import { ABILITIES } from './abilities';
import { BLESSINGS } from './blessings';
import { RPG_ENEMIES, type Cues } from './enemies';
import type { BoardMarker } from '../game/bus';
import type { Loadout } from './engine';
import { DEFAULT_PREFS, type DayPrefs, type ExLoadout } from './loadout';
import type { BattleSave } from './session';
import { newWorkout, type WorkoutData } from './workout';

/**
 * An expedition: a short, handcrafted route of encounters in three resumable
 * phases. Between phases you may stop and come back later; your character,
 * loadout, blessings and — separately — the workout so far are saved.
 *
 * Suspending is not the same as losing: if the character falls, the Heart
 * reforms them and the run carries on (the Spark just can't be restored this
 * time), so the workout never restarts from zero.
 */
export type NodeKind = 'fight' | 'blessing' | 'mirror' | 'haven' | 'boss' | 'crossing';

export interface ExNode {
  kind: NodeKind;
  phase: 1 | 2 | 3;
  title: string;
  enemies?: string[];
  /** Enemy HP scale for this route. */
  hpScale?: number;
  /** How plainly attacks are announced (early fights spell it out, later ones rely on body language). */
  cues?: Cues;
  /** Trail stop on the meadow board where this encounter stands (you march there). */
  at?: string;
  /** Fracture routes: the scenario this node belongs to (e.g. 'medieval.A'). */
  scenario?: string;
  /** A scenario's boss: 'A' is a miniboss, 'B' a main boss. */
  boss?: 'A' | 'B';
  /** A staged boss: its fights in order (the first is `enemies`), with a scene before a stage. */
  stages?: { enemies: string[]; interlude?: string }[];
  /** The boss's introduction scene (full the first time it's reached, short after). */
  intro?: string;
  /** A line as the leg toward this node begins (fracture routes; legacy routes use STORY.legs). */
  leg?: string;
}

/**
 * 'standard' is today's expedition. 'short' is retired: new expeditions never
 * use it, but runs saved on it still finish on it (bible §18).
 */
export type RouteId = 'standard' | 'short';

export const ROUTES: Record<RouteId, { name: string; blurb: string; nodes: ExNode[]; plannedSets: number }> = {
  standard: {
    name: 'Expedition',
    blurb: '6 fights, a Haven, the Warden',
    plannedSets: 21,
    nodes: [
      { kind: 'fight', phase: 1, title: 'The Training Yard', enemies: ['echo_dummy'], cues: 'obvious', at: 'dummyStop' },
      { kind: 'fight', phase: 1, title: 'Rusted Causeway', enemies: ['iron_husk'], cues: 'obvious', at: 'signStop' },
      { kind: 'blessing', phase: 1, title: 'A Fragment Remembered' },
      { kind: 'fight', phase: 2, title: 'The Bone Field', enemies: ['bone_charger'], cues: 'clear', at: 'skeleton' },
      { kind: 'mirror', phase: 2, title: 'The Mirror of Unlived Lives', at: 'forkC' },
      { kind: 'fight', phase: 2, title: 'Drifting Hollow', enemies: ['haze_wisp', 'haze_wisp', 'haze_wisp'], cues: 'clear', at: 'golem' },
      { kind: 'blessing', phase: 2, title: 'A Fragment Remembered' },
      { kind: 'haven', phase: 3, title: 'A Quiet Haven', at: 'mage' },
      { kind: 'fight', phase: 3, title: 'The Veiled Stair', enemies: ['hollow_acolyte'], cues: 'subtle', at: 'veil' },
      { kind: 'blessing', phase: 3, title: 'A Fragment Remembered' },
      { kind: 'boss', phase: 3, title: 'Before the Spark', enemies: ['warden_of_haze'], cues: 'subtle', at: 'warden' },
    ],
  },
  short: {
    name: 'Short expedition (retired)',
    blurb: 'An older saved run: 4 fights and a Haven',
    plannedSets: 12,
    nodes: [
      { kind: 'fight', phase: 1, title: 'The Training Yard', enemies: ['echo_dummy'], cues: 'obvious', at: 'dummyStop' },
      { kind: 'fight', phase: 1, title: 'The Bone Field', enemies: ['bone_charger'], cues: 'clear', at: 'skeleton' },
      { kind: 'blessing', phase: 1, title: 'A Fragment Remembered' },
      { kind: 'mirror', phase: 2, title: 'The Mirror of Unlived Lives', at: 'forkC' },
      { kind: 'fight', phase: 2, title: 'Drifting Hollow', enemies: ['haze_wisp', 'haze_wisp', 'haze_wisp'], cues: 'clear', at: 'golem' },
      { kind: 'haven', phase: 2, title: 'A Quiet Haven', at: 'mage' },
      { kind: 'boss', phase: 3, title: 'Before the Spark', enemies: ['warden_of_haze'], hpScale: 0.75, cues: 'subtle', at: 'warden' },
    ],
  },
};

export interface ExpeditionState {
  v: 1;
  id: string;
  /** Legacy expeditions play a fixed route. Fracture expeditions carry their own `nodes` (then `route` is only a label). */
  route: RouteId;
  /** Fracture expeditions: the scenarios planned (A then B; one for a development preview). */
  plan?: string[];
  /** Fracture expeditions: the concrete route, saved with the run so content edits never break it. */
  nodes?: ExNode[];
  /** Planned sets for a fracture expedition. */
  plannedSets?: number;
  /** A development preview of a single scenario: never a reignition. */
  preview?: boolean;
  /** Staged boss: the stage reached at the current node. */
  stage?: number;
  /** Index of the next node to play. */
  index: number;
  prefs: DayPrefs;
  loadout: ExLoadout;
  /** Rep / second targets per exercise for this run (the player's own). */
  targets: Record<string, number>;
  hp: number;
  maxHp: number;
  blessings: string[];
  /** The character fell at least once: the run continues, but the Spark can't be restored. */
  fallen: boolean;
  /** The current workout session (one real sitting; earlier sittings are in the save's history). */
  workout: WorkoutData;
  /** Earlier sessions of this expedition: their ids and working sets, for the expedition's progress. */
  earlier?: { sessions: string[]; sets: number };
  /** A fight saved at a safe point, resumed exactly there. */
  battle?: BattleSave;
  status: 'active' | 'suspended' | 'complete' | 'ended';
  /** Dodge with the body (default) or with a controller (couch play). */
  dodgeInput: 'body' | 'controller';
  /** The Mossy Shrine detour has been used this run. */
  shrineUsed?: boolean;
}

export const HERO_HP = 100;

export function newExpedition(route: RouteId, prefs: DayPrefs, loadout: ExLoadout, targets: Record<string, number>, now = Date.now()): ExpeditionState {
  return {
    v: 1,
    id: `x${now.toString(36)}`,
    route,
    index: 0,
    prefs,
    loadout,
    targets,
    hp: HERO_HP,
    maxHp: HERO_HP,
    blessings: [],
    fallen: false,
    workout: newWorkout(prefs.intensity, ROUTES[route].plannedSets, now),
    status: 'active',
    dodgeInput: 'body',
  };
}

/** The expedition's route: its own saved nodes, or the legacy table. */
export function routeNodes(s: Pick<ExpeditionState, 'route' | 'nodes'>): ExNode[] {
  return s.nodes ?? ROUTES[s.route].nodes;
}

export function plannedSets(s: Pick<ExpeditionState, 'route' | 'plannedSets'>): number {
  return s.plannedSets ?? ROUTES[s.route].plannedSets;
}

/** How the route is named in menus and reports. */
export function routeName(s: Pick<ExpeditionState, 'route' | 'plan' | 'preview'>, titles?: Record<string, string>): string {
  if (!s.plan) return ROUTES[s.route].name;
  const names = s.plan.map((id) => titles?.[id] ?? id);
  return s.preview ? `Preview: ${names.join(' → ')}` : names.join(' → ');
}

export function currentNode(s: ExpeditionState): ExNode | null {
  return routeNodes(s)[s.index] ?? null;
}

/** True when the next node starts a new phase (a natural place to stop). */
export function atPhaseBoundary(s: ExpeditionState): boolean {
  const nodes = routeNodes(s);
  const prev = nodes[s.index - 1];
  const next = nodes[s.index];
  return !!prev && !!next && prev.phase !== next.phase;
}

/** Trail stop the hero stands at now: the last visited encounter's, or the start. */
export function standingAt(s: ExpeditionState): string {
  const nodes = routeNodes(s);
  for (let i = Math.min(s.index, nodes.length) - 1; i >= 0; i--) if (nodes[i].at) return nodes[i].at!;
  return 'start';
}

/** The encounters on the board, for the diorama. */
export function boardMarkers(nodes: ExNode[]): BoardMarker[] {
  return nodes.flatMap((n, i): BoardMarker[] => {
    if (!n.at) return [];
    if (n.kind === 'mirror' || n.kind === 'haven') return [{ id: `n${i}`, node: n.at, kind: n.kind }];
    const e = RPG_ENEMIES[n.enemies![0]];
    return [{ id: `n${i}`, node: n.at, kind: 'enemy' as const, sprite: e.sprite, tint: e.tint, scale: e.scale, count: n.enemies!.length }];
  });
}

/** The engine's ability loadout from the exercise loadout. */
export function abilityLoadout(l: ExLoadout): Loadout {
  const out: Loadout = {};
  for (const f of FAMILIES) {
    const slot = l[f];
    if (slot) out[f] = getExercise(slot.exerciseId).rpgAbility;
  }
  return out;
}

export function familyOf(exerciseId: string): Family {
  return getExercise(exerciseId).family;
}

// ── Persistence ───────────────────────────────────────────────────────────

export const EXPEDITION_KEY = 'fitbound.expedition.v1';

interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

function kv(s?: KV): KV | null {
  if (s) return s;
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function saveExpedition(x: ExpeditionState, s?: KV): void {
  try {
    kv(s)?.setItem(EXPEDITION_KEY, JSON.stringify(x));
  } catch {
    /* storage full or unavailable */
  }
}

export function loadExpedition(s?: KV): ExpeditionState | null {
  try {
    const raw = kv(s)?.getItem(EXPEDITION_KEY);
    return raw ? sanitizeExpedition(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function clearExpedition(s?: KV): void {
  try {
    kv(s)?.removeItem(EXPEDITION_KEY);
  } catch {
    /* ignore */
  }
}

/** Validate a stored expedition; anything inconsistent is dropped rather than half-loaded. */
export function sanitizeExpedition(v: unknown): ExpeditionState | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as ExpeditionState;
  if (o.v !== 1 || typeof o.id !== 'string' || !(o.route in ROUTES)) return null;
  if (!Number.isInteger(o.index) || o.index < 0) return null;
  // A fracture route whose content changed: nodes that no longer resolve are skipped (never the whole run).
  if (o.nodes !== undefined) {
    if (!Array.isArray(o.nodes)) return null;
    const kept: ExNode[] = [];
    let index = o.index;
    o.nodes.forEach((n, i) => {
      if (validNode(n)) kept.push(n);
      else if (i < o.index) index--;
    });
    const moved = index !== o.index;
    o.nodes = kept;
    o.index = index;
    if (moved) delete o.battle;
    if (!kept.length) return null;
  }
  if (o.index > routeNodes(o).length) return null;
  if (typeof o.hp !== 'number' || typeof o.maxHp !== 'number' || o.hp < 0 || o.hp > o.maxHp) return null;
  if (!o.loadout || !FAMILIES.every((f) => o.loadout[f] === null || (typeof o.loadout[f]?.exerciseId === 'string' && safeEx(o.loadout[f]!.exerciseId)))) return null;
  if (!Array.isArray(o.blessings) || !o.blessings.every((b) => BLESSINGS.some((x) => x.id === b))) return null;
  if (!o.workout || !Array.isArray(o.workout.sets)) return null;
  if (!['active', 'suspended', 'complete', 'ended'].includes(o.status)) return null;
  const prefs = { ...DEFAULT_PREFS, ...(o.prefs ?? {}) };
  const earlier = o.earlier && Array.isArray(o.earlier.sessions) && Number.isInteger(o.earlier.sets) && o.earlier.sets >= 0 ? { sessions: o.earlier.sessions.filter((x) => typeof x === 'string'), sets: o.earlier.sets } : undefined;
  const { battle: _drop, ...rest } = o;
  const battle = validBattle(o.battle, o.index) ? o.battle : undefined;
  return { ...rest, prefs, targets: o.targets ?? {}, dodgeInput: o.dodgeInput === 'controller' ? 'controller' : 'body', fallen: !!o.fallen, ...(earlier ? { earlier } : {}), ...(battle ? { battle } : {}) };
}

const KINDS: NodeKind[] = ['fight', 'blessing', 'mirror', 'haven', 'boss', 'crossing'];

function validNode(n: ExNode): boolean {
  if (!n || typeof n !== 'object' || !KINDS.includes(n.kind) || typeof n.title !== 'string') return false;
  const known = (ids: unknown) => Array.isArray(ids) && ids.length > 0 && ids.every((e) => typeof e === 'string' && !!RPG_ENEMIES[e]);
  if ((n.kind === 'fight' || n.kind === 'boss') && !known(n.enemies)) return false;
  if (n.stages !== undefined && !(Array.isArray(n.stages) && n.stages.length > 0 && n.stages.every((st) => known(st?.enemies)))) return false;
  return true;
}

/** A saved fight must belong to the current node and name only enemies that exist; otherwise the fight restarts. */
function validBattle(b: BattleSave | undefined, index: number): b is BattleSave {
  if (!b || typeof b !== 'object' || b.index !== index || !['choose', 'ready', 'strikes'].includes(b.phase)) return false;
  const e = b.engine;
  if (!e || !Array.isArray(e.foes) || !e.foes.length || !e.hero || typeof e.hero.hp !== 'number' || !e.cooldowns) return false;
  if (!e.foes.every((f) => f && typeof f.def === 'string' && RPG_ENEMIES[f.def] && typeof f.hp === 'number')) return false;
  if (b.phase === 'strikes' && !Array.isArray(b.strikes)) return false;
  if (b.stage !== undefined && !(Number.isInteger(b.stage) && b.stage >= 0)) return false;
  return true;
}

function safeEx(id: string): boolean {
  try {
    getExercise(id);
    return true;
  } catch {
    return false;
  }
}

/** Sanity: every enemy and ability a route or loadout names exists. */
export function validateContent(): string[] {
  const errs: string[] = [];
  for (const r of Object.values(ROUTES)) for (const n of r.nodes) for (const e of n.enemies ?? []) if (!RPG_ENEMIES[e]) errs.push(`enemy ${e}`);
  for (const ex of EXERCISES) {
    const a = ABILITIES[ex.rpgAbility];
    if (!a) errs.push(`ability ${ex.rpgAbility} for ${ex.id}`);
    else if (a.family !== ex.family) errs.push(`ability ${a.id} is ${a.family}, ${ex.id} is ${ex.family}`);
  }
  return errs;
}
