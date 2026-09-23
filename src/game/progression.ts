import { EXERCISES, type ExerciseDefinition } from '../exercise/registry';

/** Cumulative XP required to reach each level (index = level - 1). */
export const XP_TABLE = [0, 60, 160, 320, 520, 780, 1100, 1500];
export const MAX_LEVEL = XP_TABLE.length;

export interface Upgrades {
  atk: number;
  def: number;
  mag: number;
}

export interface PlayerStats {
  maxHp: number;
  atk: number;
  def: number;
  mag: number;
}

export function levelForXp(xp: number): number {
  let lvl = 1;
  for (let i = 0; i < XP_TABLE.length; i++) if (xp >= XP_TABLE[i]) lvl = i + 1;
  return lvl;
}

/** XP progress within the current level, for the XP bar. */
export function xpProgress(xp: number): { level: number; into: number; needed: number } {
  const level = levelForXp(xp);
  if (level >= MAX_LEVEL) return { level, into: 1, needed: 1 };
  const base = XP_TABLE[level - 1];
  return { level, into: xp - base, needed: XP_TABLE[level] - base };
}

export function statsFor(level: number, up: Upgrades): PlayerStats {
  const l = level - 1;
  return {
    maxHp: 100 + 15 * l,
    atk: 10 + 2 * l + 2 * up.atk,
    def: 10 + 2 * l + 2 * up.def,
    mag: 10 + 2 * l + 2 * up.mag,
  };
}

/** Exercises that become available when reaching exactly `level`. */
export function unlocksAtLevel(level: number): ExerciseDefinition[] {
  return EXERCISES.filter((e) => e.unlock.level === level);
}

export const SHOP_ITEMS: { stat: keyof Upgrades; name: string; blurb: string }[] = [
  { stat: 'atk', name: 'Whetstone', blurb: '+2 Attack — sharper Sword Slash and shield bash.' },
  { stat: 'def', name: 'Oak Buckler Trim', blurb: '+2 Defense — sturdier shields.' },
  { stat: 'mag', name: 'Arcane Focus', blurb: '+2 Magic — brighter Arcane Burst.' },
];
export const MAX_UPGRADE = 3;

export function upgradeCost(currentTier: number): number {
  return 30 * (currentTier + 1);
}
