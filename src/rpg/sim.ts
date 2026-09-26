import { FAMILIES, type Family } from '../exercise/registry';
import { ABILITIES } from './abilities';
import { RpgEngine, type EngineOptions, type Loadout, type SetWork } from './engine';

/**
 * Balance harness: plays fights with the real combat engine and scripted
 * players, to measure how many sets an encounter takes. It changes nothing
 * in the game; it is how allowances (bible §18, proposals/foundation.md §2)
 * are checked before anyone's body is asked to find out.
 *
 * A player is described by how much of each set they complete, how often
 * they dodge, and whether they read the fight (use the ability the game
 * hints is strong) or pick at random.
 */
export interface SimPlayer {
  name: string;
  /** Fraction of the target done in a set (1 = full). */
  completion: number;
  /** Chance of dodging each strike. */
  dodge: number;
  choice: 'reads' | 'random';
}

export const PLAYERS: SimPlayer[] = [
  { name: 'careful', completion: 1, dodge: 0.85, choice: 'reads' },
  { name: 'partial sets (70%)', completion: 0.7, dodge: 0.8, choice: 'reads' },
  { name: 'tired (40%)', completion: 0.4, dodge: 0.7, choice: 'reads' },
  { name: 'careless', completion: 1, dodge: 0.6, choice: 'random' },
];

export interface FightResult {
  won: boolean;
  /** Sets done (player turns). */
  sets: number;
  hpLost: number;
}

/** A random one-ability-per-family loadout (optionally with a family resting). */
export function randomLoadout(rng: () => number, rest?: Family): Loadout {
  const out: Loadout = {};
  for (const f of FAMILIES) {
    if (f === rest) continue;
    const options = Object.values(ABILITIES).filter((a) => a.family === f);
    out[f] = options[Math.floor(rng() * options.length)].id;
  }
  return out;
}

export function simulateFight(
  enemies: string[],
  loadout: Loadout,
  player: SimPlayer,
  rng: () => number,
  opts: { hpScale?: number; hero?: { hp: number; maxHp: number }; blessings?: string[]; engine?: EngineOptions; maxSets?: number } = {},
): FightResult {
  const hero = opts.hero ?? { hp: 100, maxHp: 100 };
  const e = new RpgEngine(enemies, hero, loadout, { blessings: opts.blessings ?? [], ...opts.engine });
  if (opts.hpScale && opts.hpScale !== 1) for (const f of e.foes) f.hp = f.maxHp = Math.round(f.maxHp * opts.hpScale);
  const maxSets = opts.maxSets ?? 40;
  let sets = 0;
  let turns = 0;
  while (e.outcome === 'ongoing' && sets < maxSets && turns++ < maxSets * 2) {
    const usable = FAMILIES.filter((f) => e.available(f));
    if (!usable.length) {
      // Nothing ready (every family resting or cooling): the turn passes.
      e.startEnemyTurn();
      e.endEnemyTurn();
      continue;
    }
    let pick: Family;
    if (player.choice === 'reads') {
      const strong = usable.filter((f) => e.hint(f).level === 'strong');
      const damaging = usable.filter((f) => ABILITIES[loadout[f]!]?.damage && e.hint(f).level !== 'weak');
      const pool = strong.length ? strong : damaging.length ? damaging : usable;
      pick = pool[Math.floor(rng() * pool.length)];
    } else pick = usable[Math.floor(rng() * usable.length)];
    const target = 10;
    const done = Math.round(target * player.completion);
    const work: SetWork = { done, target, sided: false, full: done >= target };
    e.useAbility(pick, work);
    sets++;
    if (e.outcome !== 'ongoing') break;
    const t = e.startEnemyTurn();
    for (const s of t.strikes) {
      e.resolveStrike(s, rng() < player.dodge ? 'dodged' : 'hit');
      if (e.outcome !== 'ongoing') break;
    }
    if (e.outcome === 'ongoing') e.endEnemyTurn();
  }
  return { won: e.outcome === 'victory', sets, hpLost: hero.hp - e.hero.hp };
}

export interface EncounterStats {
  player: string;
  winRate: number;
  /** Sets to win, over the fights that were won. */
  median: number;
  p90: number;
  medianHpLost: number;
}

const q = (xs: number[], p: number) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};

/** Many fights with random loadouts: how many sets an encounter takes, per kind of player. */
export function measure(enemies: string[], rng: () => number, runs = 400, opts: Parameters<typeof simulateFight>[4] = {}, players = PLAYERS): EncounterStats[] {
  return players.map((pl) => {
    const res = Array.from({ length: runs }, () => simulateFight(enemies, randomLoadout(rng), pl, rng, opts));
    const won = res.filter((r) => r.won);
    return {
      player: pl.name,
      winRate: won.length / runs,
      median: q(
        won.map((r) => r.sets),
        0.5,
      ),
      p90: q(
        won.map((r) => r.sets),
        0.9,
      ),
      medianHpLost: q(
        res.map((r) => r.hpLost),
        0.5,
      ),
    };
  });
}
