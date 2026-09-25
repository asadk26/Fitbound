import Phaser from 'phaser';
import { bus, type BusEvents, type DioramaState } from '../game/bus';
import { BattleScene } from './scenes/BattleScene';
import { RpgScene } from './scenes/RpgScene';
import { BootScene } from './scenes/BootScene';
import { CinemaScene, type CinemaData } from './scenes/CinemaScene';
import { DioramaScene } from './scenes/DioramaScene';
import { WorldScene } from './scenes/WorldScene';

let game: Phaser.Game | null = null;
let booted = false;
let pending: (() => void) | null = null;
/** The exploration scene that a battle interrupted, to wake afterwards. */
let paused: 'World' | 'Diorama' | null = null;
let dioramaState: DioramaState = { target: null, interact: [], enemies: [], defeated: [], gateOpen: false };

export const getGame = () => game;

export function createGame(parent: HTMLElement): Phaser.Game {
  if (game) return game;
  bus.on('boot:ready', () => {
    booted = true;
    pending?.();
    pending = null;
  });
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#1a1c2c',
    // Smooth filtering for the diorama art; pixel-art textures opt back into
    // nearest-neighbour individually in BootScene.
    antialias: true,
    roundPixels: false,
    scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth || 390, height: parent.clientHeight || 700 },
    input: { activePointers: 2 },
    audio: { noAudio: true },
    scene: [BootScene, WorldScene, DioramaScene, BattleScene, RpgScene, CinemaScene],
  });
  return game;
}

export function destroyGame(): void {
  game?.destroy(true);
  game = null;
}

/**
 * Re-measure the host element. In RESIZE mode Phaser sizes the game from its
 * cached parent bounds, so those must be refreshed before refresh().
 */
export function refreshScale(): void {
  if (!game) return;
  game.scale.getParentBounds();
  game.scale.refresh();
}

function whenBooted(fn: () => void): void {
  if (booted && game) fn();
  else pending = fn;
}

/** Show one exploration scene (stopping the others). */
export function showScene(key: 'World' | 'Diorama' | 'Cinema', data: object = {}): void {
  whenBooted(() => {
    const sm = game!.scene;
    for (const k of ['World', 'Diorama', 'Battle', 'Rpg', 'Cinema']) if (k !== key && (sm.isActive(k) || sm.isSleeping(k))) sm.stop(k);
    paused = null;
    if (sm.isActive(key) || sm.isSleeping(key)) sm.stop(key);
    sm.run(key, data);
  });
}

/** Play a cinematic from its first beat (the scene says `cine:ready` when it can take beats). */
export function showCinema(data: CinemaData): void {
  showScene('Cinema', data);
}

/**
 * The quiet Sanctuary garden behind the setup screen. If a cinematic just
 * ended there, it simply settles (no restart, no break in the rain).
 */
export function showSanctuary(restored: boolean): void {
  whenBooted(() => {
    const sm = game!.scene;
    if (sm.isActive('Cinema')) bus.emit('cine:idle', { restored });
    else showScene('Cinema', { mode: 'idle', restored } satisfies CinemaData);
  });
}

export function setDioramaState(s: DioramaState): void {
  dioramaState = s;
  bus.emit('diorama:state', s);
}
export const getDioramaState = () => dioramaState;

export function startBattle(data: BusEvents['battle:start']): void {
  if (!game) return;
  const sm = game.scene;
  for (const k of ['World', 'Diorama'] as const) {
    if (sm.isActive(k)) {
      sm.sleep(k);
      paused = k;
    }
  }
  if (sm.isActive('Battle') || sm.isSleeping('Battle')) sm.stop('Battle');
  sm.run('Battle', data);
}

export function endBattle(): void {
  if (!game) return;
  const sm = game.scene;
  sm.stop('Battle');
  const k = paused ?? 'World';
  paused = null;
  if (sm.isSleeping(k)) sm.wake(k);
  else if (!sm.isActive(k)) sm.run(k);
  if (k === 'World') bus.emit('world:refresh');
  else bus.emit('diorama:state', dioramaState);
}

/** Expedition battle: sleep the diorama and run the RPG scene. */
export function startRpgBattle(data: BusEvents['rpg:start']): void {
  whenBooted(() => {
    const sm = game!.scene;
    for (const k of ['World', 'Diorama'] as const) {
      if (sm.isActive(k)) {
        sm.sleep(k);
        paused = k;
      }
    }
    if (sm.isActive('Rpg') || sm.isSleeping('Rpg')) sm.stop('Rpg');
    sm.run('Rpg', data);
  });
}

export function endRpgBattle(): void {
  if (!game) return;
  const sm = game.scene;
  sm.stop('Rpg');
  const k = paused ?? 'Diorama';
  paused = null;
  if (sm.isSleeping(k)) sm.wake(k);
  else if (!sm.isActive(k)) sm.run(k, { attract: true });
  if (k === 'Diorama') bus.emit('diorama:state', dioramaState);
}
