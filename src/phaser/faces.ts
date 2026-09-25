import Phaser from 'phaser';
import type { Expression } from './diorama/figures';

/** Texture key for a figure's face: `fig-hero`, `fig-hero-blink-free`, … */
export function faceKey(name: string, face: Expression = 'neutral', free = false): string {
  return `fig-${name}${face === 'neutral' ? '' : `-${face}`}${free ? '-free' : ''}`;
}

export interface Face {
  /** Show an expression for a while (or until changed, with ms 0), then back to neutral. */
  express(face: Expression, ms?: number): void;
}

/**
 * Small signs of life for a figure: a blink every few seconds, and brief
 * expressions (a wince when hit, wonder, a soft smile). Swaps between the
 * pre-painted face textures, so the silhouette never changes.
 */
export function lifelike(scene: Phaser.Scene, obj: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite, name: string, free: boolean): Face {
  let face: Expression = 'neutral';
  let until = 0;
  const show = (f: Expression) => obj.active && scene.textures.exists(faceKey(name, f, free)) && obj.setTexture(faceKey(name, f, free));
  const blink = () => {
    if (!obj.active) return;
    if (face === 'neutral') {
      show('blink');
      scene.time.delayedCall(130, () => face === 'neutral' && show('neutral'));
    }
    scene.time.delayedCall(2600 + Math.random() * 3600, blink);
  };
  scene.time.delayedCall(1500 + Math.random() * 2000, blink);
  return {
    express(f, ms = 1200) {
      face = f;
      show(f);
      const mine = ++until;
      if (ms > 0 && f !== 'neutral')
        scene.time.delayedCall(ms, () => {
          if (mine !== until) return;
          face = 'neutral';
          show('neutral');
        });
    },
  };
}
