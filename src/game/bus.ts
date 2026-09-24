import type { CombatEffect } from '../combat/CombatEngine';
import type { MapId } from '../phaser/maps';

/** What the Motion Trial wants the diorama to show. */
export interface DioramaState {
  /** Where the objective beacon points, if anywhere. */
  target: string | null;
  /** Other acceptable objective spots (e.g. either of two guardians). */
  alt?: string[];
  /** Spots the hero can interact with right now. */
  interact: string[];
  /** Enemies that engage when approached. */
  enemies: string[];
  /** Enemies already beaten (removed from the board). */
  defeated: string[];
  gateOpen: boolean;
}

/** Messages between React (UI, camera, rules) and Phaser (world, animation). */
export interface BusEvents {
  // Phaser → React
  'boot:ready': undefined;
  'diorama:near': { id: string | null };
  'diorama:reached': { id: string };
  /** Guided Traversal: a fork where the player picks a route (null when resolved). */
  'trail:choice': { prompt: string; options: { dir: -1 | 1; label: string; detail: string; icon: string }[] } | null;
  'trail:chosen': { label: string };
  /** The hero is walking back to the trail after Assisted Traversal. */
  'trail:rejoin': { active: boolean };
  // React → Phaser (diorama)
  'diorama:state': DioramaState;
  'diorama:hit': { id: string };
  'diorama:reset': undefined;
  'world:ready': { map: MapId };
  'world:encounter': { enemyId: string };
  'world:talk': { npcId: string };
  'world:blocked': { text: string };
  'world:moved': { map: MapId; x: number; y: number; initial?: boolean };
  'battle:ready': undefined;
  'battle:animDone': undefined;
  // React → Phaser
  'world:goto': { map: MapId; x?: number; y?: number };
  'world:refresh': undefined;
  'world:setPaused': { paused: boolean };
  'battle:start': { enemyId: string; heroName: string; playerHp: number; playerMaxHp: number; enemyHp: number; enemyMaxHp: number; outdoor?: boolean; enemyName?: string; /** false when a React HUD shows HP instead. */ hud?: boolean };
  'battle:effects': { effects: CombatEffect[]; intensity?: number };
  'battle:end': undefined;
  'battle:charge': { level: number; color: string };
}

type Handler<T> = (payload: T) => void;

class Bus {
  private handlers = new Map<keyof BusEvents, Set<Handler<unknown>>>();

  on<K extends keyof BusEvents>(ev: K, fn: Handler<BusEvents[K]>): () => void {
    let set = this.handlers.get(ev);
    if (!set) this.handlers.set(ev, (set = new Set()));
    set.add(fn as Handler<unknown>);
    return () => set!.delete(fn as Handler<unknown>);
  }

  emit<K extends keyof BusEvents>(ev: K, ...payload: BusEvents[K] extends undefined ? [] : [BusEvents[K]]): void {
    const set = this.handlers.get(ev);
    if (!set) return;
    for (const fn of [...set]) fn(payload[0]);
  }
}

export const bus = new Bus();
