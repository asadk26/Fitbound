import { describe, expect, it } from 'vitest';
import { BOSS_GATE, buildTiles, findPath, MAPS, WALKABLE } from '../src/phaser/maps';

describe('maps', () => {
  for (const def of Object.values(MAPS)) {
    it(`${def.id}: rows are a clean rectangle`, () => {
      const w = def.rows[0].length;
      def.rows.forEach((r, i) => expect(r.length, `row ${i}`).toBe(w));
    });

    it(`${def.id}: every entity and exit is reachable from spawn`, () => {
      const tiles = buildTiles(def, true);
      const h = tiles.length;
      const w = tiles[0].length;
      const blocked = new Set(def.entities.map((e) => `${e.x},${e.y}`));
      const walk = (x: number, y: number) => WALKABLE.has(tiles[y][x]) && !blocked.has(`${x},${y}`);
      expect(walk(def.spawn.x, def.spawn.y)).toBe(true);
      for (const ex of def.exits) expect(findPath(walk, def.spawn, ex, w, h), `exit ${ex.x},${ex.y}`).not.toBeNull();
      for (const e of def.entities) {
        const adj = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => walk(e.x + dx, e.y + dy) && findPath(walk, def.spawn, { x: e.x + dx, y: e.y + dy }, w, h) !== null);
        expect(adj, e.id).toBe(true);
      }
    });
  }

  it('the boss room is sealed until the gate opens', () => {
    const def = MAPS.dungeon;
    const closed = buildTiles(def, false);
    const w = closed[0].length;
    const walk = (x: number, y: number) => WALKABLE.has(closed[y][x]);
    expect(findPath(walk, def.spawn, { x: 7, y: 3 }, w, closed.length)).toBeNull();
    for (const g of BOSS_GATE) expect(walk(g.x, g.y)).toBe(false);
  });
});
