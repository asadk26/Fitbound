import Phaser from 'phaser';
import { bus, type BusEvents } from '../game/bus';
import { BattleScene } from './scenes/BattleScene';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';

let game: Phaser.Game | null = null;

export const getGame = () => game;

export function createGame(parent: HTMLElement): Phaser.Game {
  if (game) return game;
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#1a1c2c',
    pixelArt: true,
    roundPixels: true,
    scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth || 390, height: parent.clientHeight || 700 },
    input: { activePointers: 2 },
    audio: { noAudio: true },
    scene: [BootScene, WorldScene, BattleScene],
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

export function startBattle(data: BusEvents['battle:start']): void {
  if (!game) return;
  const sm = game.scene;
  if (sm.isActive('World')) sm.sleep('World');
  if (sm.isActive('Battle') || sm.isSleeping('Battle')) sm.stop('Battle');
  sm.run('Battle', data);
}

export function endBattle(): void {
  if (!game) return;
  const sm = game.scene;
  sm.stop('Battle');
  if (sm.isSleeping('World')) sm.wake('World');
  else if (!sm.isActive('World')) sm.run('World');
  bus.emit('world:refresh');
}
