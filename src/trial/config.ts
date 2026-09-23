import type { AbilityEffect } from '../exercise/registry';
import { getExercise } from '../exercise/registry';
import { ENEMIES, type EnemyDef } from '../combat/enemies';
import type { PlayerStats } from '../game/progression';

/**
 * The Motion Trial: a short, fixed playtest. Rep targets are configurable
 * (Trial settings, or a `?reps=pushup:3,squat:5,...` URL parameter) so a
 * session can be shortened for testing without touching code.
 */
export interface TrialTargets {
  pushup: number;
  squat: number;
  jumping_jack: number;
  bossPushup: number;
  bossSquat: number;
  bossJack: number;
}

export const DEFAULT_TARGETS: TrialTargets = { pushup: 5, squat: 10, jumping_jack: 10, bossPushup: 3, bossSquat: 6, bossJack: 8 };

export function parseTargets(query: string, base: TrialTargets): TrialTargets {
  const out = { ...base };
  const raw = new URLSearchParams(query).get('reps');
  if (!raw) return out;
  for (const part of raw.split(',')) {
    const [k, v] = part.split(':');
    const n = Math.round(Number(v));
    if (k in out && Number.isFinite(n) && n >= 1 && n <= 50) out[k as keyof TrialTargets] = n;
  }
  return out;
}

export interface PlannedSet {
  exerciseId: string;
  target: number;
}

export const TRIAL_ENEMIES = ['skeleton', 'golem', 'mage', 'warden'] as const;
export type TrialEnemy = (typeof TRIAL_ENEMIES)[number];

export function encounterPlan(id: TrialEnemy, t: TrialTargets): PlannedSet[] {
  switch (id) {
    case 'skeleton':
      return [{ exerciseId: 'pushup', target: t.pushup }];
    case 'golem':
      return [{ exerciseId: 'squat', target: t.squat }];
    case 'mage':
      return [{ exerciseId: 'jumping_jack', target: t.jumping_jack }];
    case 'warden':
      return [
        { exerciseId: 'pushup', target: t.bossPushup },
        { exerciseId: 'squat', target: t.bossSquat },
        { exerciseId: 'jumping_jack', target: t.bossJack },
      ];
  }
}

/** Damage a completed set deals before resistances and combos. */
export function expectedSetDamage(effect: AbilityEffect, s: PlayerStats): number {
  if (effect === 'slash') return s.atk * 5;
  if (effect === 'arcane') return s.mag * 5;
  if (effect === 'shield') return s.atk * 2.5;
  return 0;
}

/**
 * Trial versions of the guardians: HP is sized so that finishing the planned
 * sets wins the fight (a stopped-early set leaves it standing, and the set
 * repeats). They hit softly; the trial is about the movement, not attrition.
 */
export function trialEnemy(id: TrialEnemy, stats: PlayerStats, t: TrialTargets): EnemyDef {
  const base = ENEMIES[id];
  const plan = encounterPlan(id, t);
  if (id === 'warden') return { ...base, atk: 9 };
  const dmg = plan.reduce((sum, p) => {
    const ex = getExercise(p.exerciseId);
    return sum + expectedSetDamage(ex.ability.effect, stats) * (1 - base.resist[ex.ability.effect === 'arcane' ? 'magic' : 'physical']);
  }, 0);
  const atk = { skeleton: 5, golem: 8, mage: 7 }[id];
  return { ...base, maxHp: Math.max(10, Math.floor(dmg * 0.9)), atk };
}

export interface Boon {
  id: 'atk' | 'def' | 'mag' | 'heal';
  name: string;
  text: string;
  icon: string;
}

export const BOONS: Boon[] = [
  { id: 'atk', name: 'Whetstone', text: '+3 Attack — stronger Sword Slash', icon: 'sword' },
  { id: 'heal', name: 'Hearty Stew', text: 'Restore all HP', icon: 'heart' },
  { id: 'mag', name: 'Moonstone', text: '+3 Magic — brighter Arcane Burst', icon: 'star' },
];
