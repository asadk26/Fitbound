import { describe, expect, it } from 'vitest';
import { CHARACTERS, ENEMY_ART, ICON_ART, spriteSize } from '../src/phaser/art';
import { ENEMIES } from '../src/combat/enemies';
import { EXERCISES } from '../src/exercise/registry';

describe('pixel art', () => {
  it('every sprite frame is a clean rectangle', () => {
    for (const [name, s] of Object.entries({ ...CHARACTERS, ...ENEMY_ART, ...ICON_ART })) {
      expect(() => spriteSize(s), name).not.toThrow();
    }
  });

  it('every palette character used in a sprite is defined', () => {
    for (const [name, s] of Object.entries({ ...CHARACTERS, ...ENEMY_ART, ...ICON_ART })) {
      for (const f of s.frames) for (const row of f) for (const ch of row) if (ch !== '.') expect(s.palette[ch], `${name}: '${ch}'`).toBeDefined();
    }
  });

  it('every enemy and ability has art', () => {
    for (const e of Object.values(ENEMIES)) expect(ENEMY_ART[e.sprite], e.id).toBeDefined();
    for (const ex of EXERCISES) expect(ICON_ART[ex.ability.icon], ex.id).toBeDefined();
  });
});
