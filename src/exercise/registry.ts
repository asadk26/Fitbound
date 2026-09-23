import { JumpingJackDetector, jackConfig } from './detectors/jumpingJack';
import { PlankDetector, plankConfig } from './detectors/plank';
import { PushupDetector, pushupConfig } from './detectors/pushup';
import { SquatDetector, squatConfig } from './detectors/squat';
import type { Difficulty, ExerciseDetector, ExerciseKind } from './types';

/** What an ability does in combat. The combat engine interprets these. */
export type AbilityEffect = 'slash' | 'shield' | 'arcane' | 'bulwark' | 'gale' | 'flurry';

export type CameraView = 'side' | 'front';

export interface ExerciseDefinition {
  id: string;
  name: string;
  kind: ExerciseKind;
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
    name: 'Reverse Lunges',
    kind: 'reps',
    ability: {
      name: 'Gale Step',
      effect: 'gale',
      description: 'Sidestep and strike with the wind. (Camera detector in development.)',
      icon: 'wind',
      color: '#9ee7e3',
    },
    targets: { beginner: 4, intermediate: 6, advanced: 10 },
    unlock: { level: 3 },
    camera: { view: 'side', instructions: ['Detector not yet available.'] },
    alternative: 'Static split squats holding a chair for balance.',
    animation: 'dash',
    createDetector: null,
  },
  {
    id: 'mountain_climber',
    name: 'Mountain Climbers',
    kind: 'reps',
    ability: {
      name: 'Flurry Strikes',
      effect: 'flurry',
      description: 'A rapid volley of blows. (Camera detector in development.)',
      icon: 'bolt',
      color: '#ff8c61',
    },
    targets: { beginner: 8, intermediate: 12, advanced: 20 },
    unlock: { level: 4 },
    camera: { view: 'side', instructions: ['Detector not yet available.'] },
    alternative: 'Slow alternating knee drives with hands on a bench.',
    animation: 'jab',
    createDetector: null,
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
