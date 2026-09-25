import { JumpingJackDetector, jackConfig } from './detectors/jumpingJack';
import { PlankDetector, plankConfig } from './detectors/plank';
import { PushupDetector, pushupConfig } from './detectors/pushup';
import { SquatDetector, squatConfig } from './detectors/squat';
import { ClimberDetector, CrossCrunchDetector, CurlDetector, DeadBugDetector, HighKneesDetector, LungeDetector, lungeConfig, RowDetector } from './detectors/movements';
import type { Difficulty, ExerciseDetector, ExerciseKind } from './types';

/**
 * The exercise library. Every movement belongs to one of four *families*,
 * which map to the four combat ability slots; which movement fills a slot
 * changes between expeditions. Adding a movement means adding an entry here
 * (and a detector); combat reads only the family and the ability variant.
 */
export type Family = 'upper' | 'legs' | 'cardio' | 'core';
export const FAMILIES: readonly Family[] = ['upper', 'legs', 'cardio', 'core'];

export const FAMILY_INFO: Record<Family, { name: string; color: string; icon: string }> = {
  upper: { name: 'Upper body', color: '#f2c14e', icon: 'sword' },
  legs: { name: 'Legs', color: '#a7f070', icon: 'shield' },
  cardio: { name: 'Cardio', color: '#c77dff', icon: 'bolt' },
  core: { name: 'Core', color: '#5fb3f5', icon: 'heart' },
};

export type Equipment = 'dumbbells';

/**
 * How far a detector can be trusted on the real setup:
 *  - stable:       physically playtested; always eligible for expeditions.
 *  - beta:         sound in simulation from a camera view that already works;
 *                  eligible once you've checked it in the Movement Lab.
 *  - experimental: relies on signals a single low camera may not see well;
 *                  only with "include experimental" on, after a Lab check.
 *  - unavailable:  no detector.
 */
export type Reliability = 'stable' | 'beta' | 'experimental' | 'unavailable';

/** Which body calibration the movement relies on. */
export type CalibrationNeed = 'standing' | 'floor-side' | 'standing-side' | 'supine-side';

/** What an ability does in combat. The combat engine interprets these. */
export type AbilityEffect = 'slash' | 'shield' | 'arcane' | 'bulwark' | 'gale' | 'flurry';

export type CameraView = 'side' | 'front';

export interface ExerciseDefinition {
  id: string;
  name: string;
  kind: ExerciseKind;
  family: Family;
  /** Equipment required (empty: none). */
  equipment: Equipment[];
  /** Needs a sturdy chair or bench to lean on. */
  needsSupport?: boolean;
  /** Counted per side; the target is per side and both must reach it. */
  sided: boolean;
  /** Performed on the floor: allow extra time to stand before any dodge. */
  floor: boolean;
  calibration: CalibrationNeed;
  reliability: Reliability;
  /** Why it isn't stable yet (shown in the Lab and setup). */
  reliabilityNote?: string;
  /** Player-adjustable target range: reps (per side if sided) or seconds. */
  range: { min: number; default: number; max: number };
  /** Ability variant in the expedition combat system (see rpg/abilities.ts). */
  rpgAbility: string;
  /** Easier or alternative versions the player may do instead. */
  variants: string[];
  /** Where it can appear. */
  eligible: ('combat' | 'lab')[];
  /** Usable in the classic touch adventure (the original ability effects). */
  classic?: boolean;
  ability: {
    name: string;
    effect: AbilityEffect;
    description: string;
    /** Icon key for the procedural icon set. */
    icon: string;
    color: string;
  };
  /** Reps (for 'reps') or seconds (for 'hold') per difficulty. */
  targets: Record<Difficulty, number>;
  unlock: { level: number };
  camera: {
    view: CameraView;
    instructions: string[];
  };
  /** Easier alternative movement, shown to every player. */
  alternative: string;
  /** Hero animation the battle scene plays on each rep. */
  animation: 'slash' | 'guard' | 'cast' | 'brace' | 'dash' | 'jab';
  /**
   * Builds the recognition module, or null when no camera detector exists yet.
   * An exercise with no detector is never equippable: it will not silently fall
   * back to some other exercise's detector.
   */
  createDetector: ((d: Difficulty) => ExerciseDetector) | null;
}

export const EXERCISES: ExerciseDefinition[] = [
  {
    id: 'pushup',
    family: 'upper',
    equipment: [],
    sided: false,
    floor: true,
    calibration: 'floor-side',
    reliability: 'stable',
    range: { min: 2, default: 6, max: 30 },
    rpgAbility: 'sunder',
    variants: ['Knee push-ups', 'Incline push-ups (hands on a couch) — may not track'],
    eligible: ['combat', 'lab'],
    classic: true,
    name: 'Push-ups',
    kind: 'reps',
    ability: {
      name: 'Sword Slash',
      effect: 'slash',
      description: 'Each push-up is a sword strike. Finish the set for a heavy finishing blow.',
      icon: 'sword',
      color: '#f2c14e',
    },
    targets: { beginner: 3, intermediate: 5, advanced: 8 },
    unlock: { level: 1 },
    camera: {
      view: 'side',
      instructions: [
        'Lay the phone on the floor or a low shelf, about 2 m (6 ft) to your side.',
        'Turn sideways so the camera sees your profile — head, arms and hips.',
        'Start at the top with arms straight.',
      ],
    },
    alternative: 'Knee push-ups, or hands on a sturdy couch or bench (incline push-ups).',
    animation: 'slash',
    createDetector: (d) => new PushupDetector(pushupConfig(d)),
  },
  {
    id: 'squat',
    family: 'legs',
    equipment: [],
    sided: false,
    floor: false,
    calibration: 'standing',
    reliability: 'stable',
    range: { min: 3, default: 10, max: 40 },
    rpgAbility: 'quake',
    variants: ['Chair squats', 'Half squats'],
    eligible: ['combat', 'lab'],
    classic: true,
    name: 'Squats',
    kind: 'reps',
    ability: {
      name: 'Shield Stance',
      effect: 'shield',
      description: 'Each squat builds defensive energy. Finish the set to raise a shield and bash back.',
      icon: 'shield',
      color: '#5fb3f5',
    },
    targets: { beginner: 5, intermediate: 8, advanced: 12 },
    unlock: { level: 1 },
    camera: {
      view: 'front',
      instructions: [
        'Prop the phone at about waist height, 2–3 m (7–10 ft) away.',
        'Face the camera. Your whole body, head to feet, must be in view.',
        'Stand tall to begin.',
      ],
    },
    alternative: 'Chair squats: sit down to a chair and stand back up.',
    animation: 'guard',
    createDetector: (d) => new SquatDetector(squatConfig(d)),
  },
  {
    id: 'jumping_jack',
    family: 'cardio',
    equipment: [],
    sided: false,
    floor: false,
    calibration: 'standing',
    reliability: 'stable',
    range: { min: 4, default: 12, max: 50 },
    rpgAbility: 'arc',
    variants: ['Step jacks'],
    eligible: ['combat', 'lab'],
    classic: true,
    name: 'Jumping Jacks',
    kind: 'reps',
    ability: {
      name: 'Arcane Burst',
      effect: 'arcane',
      description: 'Each jack charges arcane energy. Finish the set to unleash a burst that ignores armor.',
      icon: 'star',
      color: '#c77dff',
    },
    targets: { beginner: 6, intermediate: 10, advanced: 15 },
    unlock: { level: 1 },
    camera: {
      view: 'front',
      instructions: [
        'Prop the phone 2.5–3 m (8–10 ft) away, facing you.',
        'Your whole body, hands raised overhead included, must be in view.',
        'Start standing, arms at your sides, feet together.',
      ],
    },
    alternative: 'Step jacks: step one foot out at a time while raising your arms.',
    animation: 'cast',
    createDetector: (d) => new JumpingJackDetector(jackConfig(d)),
  },
  {
    id: 'plank',
    family: 'core',
    equipment: [],
    sided: false,
    floor: true,
    calibration: 'floor-side',
    reliability: 'beta',
    reliabilityNote: 'Built on the same side-on floor view as push-ups; not yet timed on your setup.',
    range: { min: 10, default: 25, max: 120 },
    rpgAbility: 'aegis',
    variants: ['Knee plank', 'Forearm or straight-arm plank'],
    eligible: ['combat', 'lab'],
    classic: true,
    name: 'Plank',
    kind: 'hold',
    ability: {
      name: 'Iron Bulwark',
      effect: 'bulwark',
      description: 'Hold a plank to recover health. Finish the hold for a large heal and a sturdy barrier.',
      icon: 'heart',
      color: '#7ee081',
    },
    targets: { beginner: 12, intermediate: 20, advanced: 30 },
    unlock: { level: 2 },
    camera: {
      view: 'side',
      instructions: [
        'Lay the phone on the floor about 2 m (6 ft) to your side.',
        'Turn sideways so your whole body, shoulders to ankles, is in view.',
        'Forearms or straight arms both work. The timer runs only while you hold.',
      ],
    },
    alternative: 'Knee plank (beginner level accepts knees down).',
    animation: 'brace',
    createDetector: (d) => new PlankDetector(plankConfig(d)),
  },
  {
    id: 'reverse_lunge',
    family: 'legs',
    equipment: [],
    sided: true,
    floor: false,
    calibration: 'standing',
    reliability: 'beta',
    reliabilityNote: 'Reads the hips dropping and which knee goes down; check the side it reports in the Lab.',
    range: { min: 2, default: 5, max: 20 },
    rpgAbility: 'stride',
    variants: ['Split squats holding a chair', 'Shorter step, less depth'],
    eligible: ['combat', 'lab'],
    name: 'Reverse Lunges',
    kind: 'reps',
    ability: {
      name: 'Gale Step',
      effect: 'gale',
      description: 'Step back and strike with the wind.',
      icon: 'wind',
      color: '#9ee7e3',
    },
    targets: { beginner: 4, intermediate: 6, advanced: 10 },
    unlock: { level: 3 },
    camera: {
      view: 'front',
      instructions: ['Stand facing the phone, whole body in view.', 'Step one foot back and lower until the back knee nears the floor, then step back together.', 'Each side counts on its own.'],
    },
    alternative: 'Static split squats holding a chair for balance.',
    animation: 'dash',
    createDetector: (d) => new LungeDetector(lungeConfig(d)),
  },
  {
    id: 'mountain_climber',
    family: 'cardio',
    equipment: [],
    sided: false,
    floor: true,
    calibration: 'floor-side',
    reliability: 'experimental',
    reliabilityNote: 'From one side the legs overlap and blur at speed. High knees are the reliable cardio alternative.',
    range: { min: 8, default: 20, max: 60 },
    rpgAbility: 'flurry',
    variants: ['Slow knee drives with hands on a bench', 'High knees (standing)'],
    eligible: ['combat', 'lab'],
    name: 'Mountain Climbers',
    kind: 'reps',
    ability: {
      name: 'Flurry Strikes',
      effect: 'flurry',
      description: 'A rapid volley of blows.',
      icon: 'bolt',
      color: '#ff8c61',
    },
    targets: { beginner: 8, intermediate: 12, advanced: 20 },
    unlock: { level: 4 },
    camera: { view: 'side', instructions: ['Turn sideways to the phone in a high plank, hands under shoulders.', 'Drive one knee toward your chest, then the other.'] },
    alternative: 'Slow alternating knee drives with hands on a bench.',
    animation: 'jab',
    createDetector: () => new ClimberDetector(),
  },
  {
    id: 'dumbbell_row',
    family: 'upper',
    equipment: ['dumbbells'],
    needsSupport: true,
    sided: true,
    floor: false,
    calibration: 'standing-side',
    reliability: 'experimental',
    reliabilityNote: 'Needs the rowing arm on the side nearest the phone; the far arm is hidden from a side view. Turn around to switch sides.',
    range: { min: 3, default: 8, max: 20 },
    rpgAbility: 'hook',
    variants: ['Two-hand bent-over rows (counted per arm)', 'Lighter dumbbell, slower tempo'],
    eligible: ['combat', 'lab'],
    name: 'Dumbbell Rows',
    kind: 'reps',
    ability: { name: 'Reaping Hook', effect: 'slash', description: 'Hook and haul: heavy damage that disrupts a charging enemy.', icon: 'sword', color: '#e8a33d' },
    targets: { beginner: 6, intermediate: 8, advanced: 12 },
    unlock: { level: 1 },
    camera: {
      view: 'side',
      instructions: ['One hand and knee on a sturdy chair or bench, side-on to the phone, rowing arm nearest the phone.', 'Let the dumbbell hang straight down, then pull it up to your ribs.', 'Turn around to row with the other arm.'],
    },
    alternative: 'Two-hand bent-over rows, or skip dumbbells today.',
    animation: 'slash',
    createDetector: () => new RowDetector(),
  },
  {
    id: 'bicep_curl',
    family: 'upper',
    equipment: ['dumbbells'],
    sided: true,
    floor: false,
    calibration: 'standing',
    reliability: 'beta',
    reliabilityNote: 'Front view: checks the wrist rising past the elbow and rejects torso swing and raised elbows.',
    range: { min: 4, default: 8, max: 20 },
    rpgAbility: 'twinfang',
    variants: ['Alternating curls', 'Hammer curls'],
    eligible: ['combat', 'lab'],
    name: 'Bicep Curls',
    kind: 'reps',
    ability: { name: 'Twin Fang', effect: 'slash', description: 'Two quick strikes, one per arm.', icon: 'sword', color: '#ffb35c' },
    targets: { beginner: 6, intermediate: 8, advanced: 12 },
    unlock: { level: 1 },
    camera: { view: 'front', instructions: ['Stand facing the phone, dumbbells at your sides.', 'Curl with elbows tucked; keep your body still.', 'Each arm counts on its own; both together is fine.'] },
    alternative: 'Resistance band or water-bottle curls.',
    animation: 'slash',
    createDetector: () => new CurlDetector(),
  },
  {
    id: 'high_knees',
    family: 'cardio',
    equipment: [],
    sided: false,
    floor: false,
    calibration: 'standing',
    reliability: 'beta',
    reliabilityNote: 'Front view, like marching (which is proven); needs the knee raised near hip height.',
    range: { min: 10, default: 24, max: 80 },
    rpgAbility: 'ember',
    variants: ['Marching high knees (slower)'],
    eligible: ['combat', 'lab'],
    name: 'High Knees',
    kind: 'reps',
    ability: { name: 'Ember Rush', effect: 'flurry', description: 'Kindle a fire that keeps burning.', icon: 'bolt', color: '#ff8c61' },
    targets: { beginner: 16, intermediate: 24, advanced: 36 },
    unlock: { level: 1 },
    camera: { view: 'front', instructions: ['Stand facing the phone, whole body in view.', 'Drive each knee up to about hip height.', 'Every knee counts.'] },
    alternative: 'Marching in place with big knee lifts.',
    animation: 'jab',
    createDetector: () => new HighKneesDetector(),
  },
  {
    id: 'dead_bug',
    family: 'core',
    equipment: [],
    sided: false,
    floor: true,
    calibration: 'supine-side',
    reliability: 'experimental',
    reliabilityNote: 'Lying down side-on, the two legs overlap and only leg extensions are checked (not the opposite arm).',
    range: { min: 6, default: 12, max: 30 },
    rpgAbility: 'tide',
    variants: ['Heel taps (feet to the floor)', 'Legs only, arms resting'],
    eligible: ['combat', 'lab'],
    name: 'Dead Bugs',
    kind: 'reps',
    ability: { name: 'Mending Tide', effect: 'bulwark', description: 'Heal and raise a small shield.', icon: 'heart', color: '#73eff7' },
    targets: { beginner: 8, intermediate: 12, advanced: 16 },
    unlock: { level: 1 },
    camera: { view: 'side', instructions: ['Lie on your back, side-on to the phone.', 'Arms up to the ceiling, knees bent over hips.', 'Straighten one leg toward the floor, bring it back, then the other.'] },
    alternative: 'Heel taps from tabletop.',
    animation: 'brace',
    createDetector: () => new DeadBugDetector(),
  },
  {
    id: 'cross_crunch',
    family: 'core',
    equipment: [],
    sided: true,
    floor: false,
    calibration: 'standing',
    reliability: 'beta',
    reliabilityNote: 'Standing, facing the phone: a knee drive plus the opposite elbow coming across.',
    range: { min: 4, default: 8, max: 25 },
    rpgAbility: 'riposte',
    variants: ['Slow standing knee-to-elbow', 'Hands on hips, knee drive only (won’t count)'],
    eligible: ['combat', 'lab'],
    name: 'Standing Cross Crunches',
    kind: 'reps',
    ability: { name: 'Riposte Stance', effect: 'bulwark', description: 'Guard and strike back.', icon: 'shield', color: '#8fd3ff' },
    targets: { beginner: 6, intermediate: 8, advanced: 12 },
    unlock: { level: 1 },
    camera: { view: 'front', instructions: ['Stand facing the phone, hands lightly behind your head.', 'Drive one knee up and bring the opposite elbow down across to it.', 'Each side counts on its own.'] },
    alternative: 'Slow marching knee lifts with a twist.',
    animation: 'guard',
    createDetector: () => new CrossCrunchDetector(),
  },
];

export const MAX_LOADOUT = 4;

export function getExercise(id: string): ExerciseDefinition {
  const ex = EXERCISES.find((e) => e.id === id);
  if (!ex) throw new Error(`Unknown exercise: ${id}`);
  return ex;
}

/** Whether a camera detector exists for this exercise. */
export function isPlayable(ex: ExerciseDefinition): boolean {
  return ex.createDetector !== null;
}

/** Usable in the classic touch adventure (its combat knows the original four abilities). */
export function isClassicPlayable(ex: ExerciseDefinition): boolean {
  return isPlayable(ex) && ex.classic === true;
}

export function exercisesIn(family: Family): ExerciseDefinition[] {
  return EXERCISES.filter((e) => e.family === family);
}

/** Target unit label: "8 reps", "8 per side", "25 s". */
export function targetLabel(ex: ExerciseDefinition, n: number): string {
  if (ex.kind === 'hold') return `${n} s`;
  return ex.sided ? `${n} per side` : `${n} reps`;
}

export function isUnlocked(ex: ExerciseDefinition, level: number): boolean {
  return level >= ex.unlock.level;
}

/** Apply the difficulty table, then any per-exercise player adjustment. */
export function targetFor(ex: ExerciseDefinition, d: Difficulty, adjust: Record<string, number> = {}): number {
  const base = ex.targets[d];
  const delta = adjust[ex.id] ?? 0;
  const min = ex.kind === 'hold' ? 5 : 1;
  return Math.max(min, base + delta);
}
