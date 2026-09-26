import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { effectiveness, type SetWork } from '../src/rpg/engine';
import { ROUTES } from '../src/rpg/expedition';
import { measure, PLAYERS, simulateFight, randomLoadout } from '../src/rpg/sim';
import { rng } from '../src/testing/poses';

/**
 * The balance harness (src/rpg/sim.ts) over today's encounters. These tests
 * pin down the harness itself and a few loose facts about today's balance;
 * `BALANCE_OUT=file.md` also writes the full table (used for the proposal).
 */
const fights = ROUTES.standard.nodes.filter((n) => n.enemies);

describe('balance harness', () => {
  it('is deterministic for a seed and never exceeds its set cap', () => {
    const a = simulateFight(['iron_husk'], randomLoadout(rng(1)), PLAYERS[0], rng(2));
    const b = simulateFight(['iron_husk'], randomLoadout(rng(1)), PLAYERS[0], rng(2));
    expect(a).toEqual(b);
    const capped = simulateFight(['warden_of_haze'], { core: 'tide' }, PLAYERS[0], rng(3), { maxSets: 5 });
    expect(capped.sets).toBeLessThanOrEqual(5);
  });

  it('a careful player wins every ordinary fight of today’s route in a handful of sets', () => {
    for (const n of fights.filter((f) => f.kind === 'fight')) {
      const [careful] = measure(n.enemies!, rng(7), 200, { hpScale: n.hpScale });
      expect(careful.winRate, n.title).toBeGreaterThan(0.9);
      expect(careful.median, n.title).toBeLessThanOrEqual(6);
    }
  });

  it('the Green Knight (both stages) sits in the miniboss band: about 5 sets careful, no long tail', () => {
    const [careful, partial, tired] = measure(['green_knight'], rng(21), 600, { stages: [['green_knight_headless']] });
    expect(careful.winRate).toBeGreaterThan(0.98);
    expect(careful.median).toBeGreaterThanOrEqual(4);
    expect(careful.median).toBeLessThanOrEqual(6);
    expect(partial.p90).toBeLessThanOrEqual(8);
    expect(tired.winRate).toBeGreaterThan(0.9);
    expect(tired.p90).toBeLessThanOrEqual(12);
  });

  it('writes the full table on request', () => {
    const out = process.env.BALANCE_OUT;
    if (!out) return;
    const curves: Record<string, (w: SetWork, floor: number) => number> = {
      'today (35% floor)': effectiveness,
      linear: (w, floor) => (w.done <= 0 ? 0 : Math.max(floor, w.full ? 1 : Math.min(1, w.done / w.target))),
      'floor 20%': (w, floor) => (w.done <= 0 ? 0 : Math.max(floor, w.full ? 1 : 0.2 + 0.8 * Math.min(1, w.done / w.target))),
    };
    const lines: string[] = [];
    for (const [cname, curve] of Object.entries(curves)) {
      lines.push(`\n### Partial-set curve: ${cname}\n`);
      lines.push('| Encounter | Player | Wins | Sets to win (median / p90) | HP lost (median) |');
      lines.push('|---|---|---|---|---|');
      let routeCareful = 0;
      for (const n of fights) {
        const stats = measure(n.enemies!, rng(11), 400, { hpScale: n.hpScale, engine: { effectiveness: curve } });
        routeCareful += stats[0].median;
        for (const s of stats) lines.push(`| ${n.title} | ${s.player} | ${Math.round(s.winRate * 100)}% | ${s.median} / ${s.p90} | ${s.medianHpLost} |`);
      }
      lines.push(`\nCareful player, whole route: about **${routeCareful} sets** (sum of medians).`);
    }
    writeFileSync(out, lines.join('\n') + '\n');
  });
});
