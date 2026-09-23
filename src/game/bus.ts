import type { CombatEffect } from '../combat/CombatEngine';
import type { MapId } from '../phaser/maps';

/** Messages between React (UI, camera, rules) and Phaser (world, animation). */
export interface BusEvents {
  // Phaser → React
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
  'battle:start': { enemyId: string; heroName: string; playerHp: number; playerMaxHp: number; enemyHp: number; enemyMaxHp: number };
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
