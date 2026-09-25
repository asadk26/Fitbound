import { JumpingJackDetector, jackConfig } from './detectors/jumpingJack';
import { PlankDetector, plankConfig } from './detectors/plank';
import { PushupDetector, pushupConfig } from './detectors/pushup';
import { SquatDetector, squatConfig } from './detectors/squat';
import { SidePlankDetector, sidePlankConfig, WallSitDetector, wallSitConfig } from './detectors/holds';
import { ButtKickDetector, GluteBridgeDetector, LateralRaiseDetector, OverheadPressDetector, PunchDetector, SkaterDetector, TwistDetector } from './detectors/more';
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
  /** Holds only: the target is the total, split evenly between the two sides (side planks). */
  holdSplit?: boolean;
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
  // ── Added for variety (beta: check each in the Movement Lab first) ──────
  {
    id: 'overhead_press',
    family: 'upper',
    equipment: ['dumbbells'],
    sided: false,
    floor: false,
    calibration: 'standing',
    reliability: 'beta',
    reliabilityNote: 'Facing the phone: both hands travel from the shoulders to fully overhead. The lower hand counts.',
    range: { min: 4, default: 8, max: 20 },
    rpgAbility: 'skyhammer',
    variants: ['Seated press (from a chair)', 'Lighter dumbbells or water bottles'],
    eligible: ['combat', 'lab'],
    name: 'Overhead Press',
    kind: 'reps',
    ability: { name: 'Skyfall Hammer', effect: 'slash', description: 'A heavy blow from above.', icon: 'sword', color: '#ffd166' },
    targets: { beginner: 6, intermediate: 8, advanced: 12 },
    unlock: { level: 1 },
    camera: { view: 'front', instructions: ['Stand facing the phone, dumbbells at your shoulders.', 'Press both straight overhead until your arms are straight.', 'Lower back to the shoulders. To pause mid-set, hold both hands up and still for 3 s, or use the pad, P or voice.'] },
    alternative: 'Pike push-ups are harder; for easier, press lighter weights.',
    animation: 'slash',
    createDetector: () => new OverheadPressDetector(),
  },
  {
    id: 'lateral_raise',
    family: 'upper',
    equipment: ['dumbbells'],
    sided: false,
    floor: false,
    calibration: 'standing',
    reliability: 'beta',
    reliabilityNote: 'Facing the phone: both arms lift out to the sides to about shoulder height.',
    range: { min: 6, default: 10, max: 20 },
    rpgAbility: 'wingclip',
    variants: ['Light dumbbells (these get heavy fast)', 'Bent-elbow raises'],
    eligible: ['combat', 'lab'],
    name: 'Lateral Raises',
    kind: 'reps',
    ability: { name: 'Wingclip', effect: 'slash', description: 'Two quick cuts that break a wind-up.', icon: 'sword', color: '#f4a261' },
    targets: { beginner: 8, intermediate: 10, advanced: 14 },
    unlock: { level: 1 },
    camera: { view: 'front', instructions: ['Stand facing the phone, light dumbbells at your sides.', 'Raise both arms out to the sides to shoulder height, elbows soft.', 'Lower slowly.'] },
    alternative: 'Water bottles, or no weight at all.',
    animation: 'slash',
    createDetector: () => new LateralRaiseDetector(),
  },
  {
    id: 'goblet_squat',
    family: 'legs',
    equipment: ['dumbbells'],
    sided: false,
    floor: false,
    calibration: 'standing',
    reliability: 'beta',
    reliabilityNote: 'The squat detector, holding one dumbbell at the chest.',
    range: { min: 5, default: 10, max: 25 },
    rpgAbility: 'bastion',
    variants: ['Bodyweight squats', 'Box squats to a chair'],
    eligible: ['combat', 'lab'],
    name: 'Goblet Squats',
    kind: 'reps',
    ability: { name: 'Bastion Stomp', effect: 'shield', description: 'Stagger every foe and dig in behind a guard.', icon: 'shield', color: '#9bd36a' },
    targets: { beginner: 6, intermediate: 10, advanced: 15 },
    unlock: { level: 1 },
    camera: { view: 'front', instructions: ['Stand facing the phone, one dumbbell held upright at your chest.', 'Squat until your thighs are about level, then stand tall.'] },
    alternative: 'Bodyweight squats.',
    animation: 'guard',
    createDetector: (d) => new SquatDetector(squatConfig(d), 'goblet_squat'),
  },
  {
    id: 'sumo_squat',
    family: 'legs',
    equipment: [],
    sided: false,
    floor: false,
    calibration: 'standing',
    reliability: 'beta',
    reliabilityNote: 'The squat detector with a wide stance, toes turned out.',
    range: { min: 5, default: 12, max: 30 },
    rpgAbility: 'rootbreaker',
    variants: ['Hold a dumbbell between the legs', 'Shallower squats'],
    eligible: ['combat', 'lab'],
    name: 'Sumo Squats',
    kind: 'reps',
    ability: { name: 'Rootbreaker', effect: 'shield', description: 'Shake the ground under every foe.', icon: 'shield', color: '#b5e07a' },
    targets: { beginner: 8, intermediate: 12, advanced: 16 },
    unlock: { level: 1 },
    camera: { view: 'front', instructions: ['Stand facing the phone, feet wide, toes turned out.', 'Squat straight down, knees tracking over the toes, then stand tall.'] },
    alternative: 'Regular bodyweight squats.',
    animation: 'guard',
    createDetector: (d) => new SquatDetector(squatConfig(d), 'sumo_squat'),
  },
  {
    id: 'glute_bridge',
    family: 'legs',
    equipment: [],
    sided: false,
    floor: true,
    calibration: 'supine-side',
    reliability: 'beta',
    reliabilityNote: 'Lying on your back side-on (like push-ups): shoulder, hip and knee must reach a straight line.',
    range: { min: 6, default: 12, max: 30 },
    rpgAbility: 'upheaval',
    variants: ['Hold at the top for a second', 'Single-leg bridges (harder)'],
    eligible: ['combat', 'lab'],
    name: 'Glute Bridges',
    kind: 'reps',
    ability: { name: 'Upheaval', effect: 'shield', description: 'Heave the ground up under every foe, cracking armour.', icon: 'shield', color: '#8cc063' },
    targets: { beginner: 8, intermediate: 12, advanced: 16 },
    unlock: { level: 1 },
    camera: { view: 'side', instructions: ['Lie on your back side-on to the phone (where you do push-ups), knees bent, feet flat.', 'Lift your hips until shoulder, hip and knee make a line.', 'Lower slowly.'] },
    alternative: 'Smaller bridges, or hip lifts with feet on a step.',
    animation: 'brace',
    createDetector: () => new GluteBridgeDetector(),
  },
  {
    id: 'skaters',
    family: 'cardio',
    equipment: [],
    sided: true,
    floor: false,
    calibration: 'standing',
    reliability: 'beta',
    reliabilityNote: 'Facing the phone: the hips travel side to side; each bound counts for the side it goes to.',
    range: { min: 6, default: 10, max: 30 },
    rpgAbility: 'slipstream',
    variants: ['Step-out skaters (no jump)', 'Smaller bounds'],
    eligible: ['combat', 'lab'],
    name: 'Skaters',
    kind: 'reps',
    ability: { name: 'Slipstream', effect: 'gale', description: 'Wind that leaps from foe to foe.', icon: 'wind', color: '#7fd8e0' },
    targets: { beginner: 6, intermediate: 10, advanced: 14 },
    unlock: { level: 1 },
    camera: { view: 'front', instructions: ['Stand facing the phone with room to either side.', 'Bound sideways onto one foot, then back across onto the other.', 'Each bound counts for the side you land on.'] },
    alternative: 'Side steps: step wide to each side instead of bounding.',
    animation: 'dash',
    createDetector: () => new SkaterDetector(),
  },
  {
    id: 'butt_kicks',
    family: 'cardio',
    equipment: [],
    sided: false,
    floor: false,
    calibration: 'standing',
    reliability: 'experimental',
    reliabilityNote: 'Facing the phone, the heel kicking up goes behind the leg, where the camera sees it least well.',
    range: { min: 10, default: 24, max: 80 },
    rpgAbility: 'cinder',
    variants: ['Slower heel flicks', 'Standing hamstring curls'],
    eligible: ['combat', 'lab'],
    name: 'Butt Kicks',
    kind: 'reps',
    ability: { name: 'Cinder Kick', effect: 'flurry', description: 'Kick up embers that keep burning.', icon: 'bolt', color: '#ff7a59' },
    targets: { beginner: 16, intermediate: 24, advanced: 36 },
    unlock: { level: 1 },
    camera: { view: 'front', instructions: ['Stand facing the phone, whole body in view.', 'Jog in place flicking your heels up behind you, knees pointing down.', 'Every kick counts.'] },
    alternative: 'Marching in place.',
    animation: 'jab',
    createDetector: () => new ButtKickDetector(),
  },
  {
    id: 'russian_twist',
    family: 'core',
    equipment: [],
    sided: true,
    floor: true,
    calibration: 'standing',
    reliability: 'beta',
    reliabilityNote: 'Seated facing the phone, leaning back a little: hands together turn to beside each hip.',
    range: { min: 6, default: 12, max: 30 },
    rpgAbility: 'whirl',
    variants: ['Feet on the floor (easier)', 'Holding a dumbbell (harder)'],
    eligible: ['combat', 'lab'],
    name: 'Russian Twists',
    kind: 'reps',
    ability: { name: 'Whirling Ward', effect: 'bulwark', description: 'Spin up a ward that also mends a little.', icon: 'heart', color: '#6fc3e8' },
    targets: { beginner: 8, intermediate: 12, advanced: 16 },
    unlock: { level: 1 },
    camera: { view: 'front', instructions: ['Sit facing the phone, knees bent, leaning back a little.', 'Hands together, turn to bring them beside one hip, then the other.', 'Each turn counts for that side.'] },
    alternative: 'Seated twists sitting upright.',
    animation: 'guard',
    createDetector: () => new TwistDetector(),
  },
  // ── Movement Lab only: can punches be read at all? ───────────────────────
  {
    id: 'punch_front',
    family: 'upper',
    equipment: [],
    sided: true,
    floor: false,
    calibration: 'standing',
    reliability: 'experimental',
    reliabilityNote: 'Lab test only. Facing the phone, punching toward it: read from depth and the elbow rising. Does it tell your left from your right?',
    range: { min: 6, default: 10, max: 40 },
    rpgAbility: 'twinfang',
    variants: [],
    eligible: ['lab'],
    name: 'Punch test · facing',
    kind: 'reps',
    ability: { name: 'Jab', effect: 'slash', description: 'Straight punches.', icon: 'sword', color: '#ffb35c' },
    targets: { beginner: 10, intermediate: 10, advanced: 10 },
    unlock: { level: 1 },
    camera: { view: 'front', instructions: ['Stand facing the phone, fists up at your chin (guard).', 'Throw straight punches toward the phone, alternating and repeating arms.', 'Bring each fist back to guard. Check the left and right counts match what you threw.'] },
    alternative: '—',
    animation: 'jab',
    createDetector: () => new PunchDetector('front'),
  },
  {
    id: 'punch_side',
    family: 'upper',
    equipment: [],
    sided: true,
    floor: false,
    calibration: 'standing-side',
    reliability: 'experimental',
    reliabilityNote: 'Lab test only. Turned side-on (like push-ups), punching across the view: the clearest movement, but the far arm is half hidden. Does it keep left and right apart?',
    range: { min: 6, default: 10, max: 40 },
    rpgAbility: 'twinfang',
    variants: [],
    eligible: ['lab'],
    name: 'Punch test · side-on',
    kind: 'reps',
    ability: { name: 'Jab', effect: 'slash', description: 'Straight punches.', icon: 'sword', color: '#ffb35c' },
    targets: { beginner: 10, intermediate: 10, advanced: 10 },
    unlock: { level: 1 },
    camera: { view: 'side', instructions: ['Stand side-on to the phone, the way you face for push-ups, fists up at your chin.', 'Throw straight punches forward across the view, alternating and repeating arms.', 'Bring each fist back to guard. Check the left and right counts match what you threw.'] },
    alternative: '—',
    animation: 'jab',
    createDetector: () => new PunchDetector('side'),
  },
  {
    id: 'wall_sit',
    family: 'legs',
    equipment: [],
    sided: false,
    floor: false,
    calibration: 'standing-side',
    reliability: 'experimental',
    reliabilityNote: 'Lab test only. Side-on to the phone against a wall: knees near a right angle, thighs near level, back upright. Does the clock run only while you really sit?',
    range: { min: 10, default: 20, max: 90 },
    rpgAbility: 'bastion',
    variants: ['Sit higher (beginner level accepts a shallower bend)', 'Hands on thighs'],
    eligible: ['lab'],
    name: 'Wall Sit',
    kind: 'hold',
    ability: { name: 'Bastion', effect: 'shield', description: 'Root yourself like a wall.', icon: 'shield', color: '#9bd36a' },
    targets: { beginner: 15, intermediate: 20, advanced: 30 },
    unlock: { level: 1 },
    camera: {
      view: 'side',
      instructions: [
        'Find a clear stretch of wall and put the phone about 2 m (6 ft) to your side, low, like for push-ups.',
        'Back flat against the wall, slide down until your knees bend near a right angle.',
        'The clock runs only while you hold. Stand up to rest; your time is kept.',
      ],
    },
    alternative: 'A higher wall sit, or a chair squat hold.',
    animation: 'brace',
    createDetector: (d) => new WallSitDetector(wallSitConfig(d)),
  },
  {
    id: 'side_plank',
    family: 'core',
    equipment: [],
    sided: false,
    holdSplit: true,
    floor: true,
    calibration: 'floor-side',
    reliability: 'experimental',
    reliabilityNote: "Lab test only. Lying on your side facing the phone. Half the time goes to each side: once one side's half is done it should say 'Switch sides', and only the other side should finish the set.",
    range: { min: 10, default: 30, max: 90 },
    rpgAbility: 'whirl',
    variants: ['Knees down (beginner level)', 'Forearm or straight arm'],
    eligible: ['lab'],
    name: 'Side Plank',
    kind: 'hold',
    ability: { name: 'Whirling Ward', effect: 'bulwark', description: 'A ward held on each side.', icon: 'heart', color: '#6fc3e8' },
    targets: { beginner: 20, intermediate: 30, advanced: 40 },
    unlock: { level: 1 },
    camera: {
      view: 'front',
      instructions: [
        'Lay the phone on the floor about 2 m (6 ft) away, facing you.',
        'Lie on your side facing the phone, propped on your lower forearm, feet stacked, and lift your hips into a line.',
        'Half the time goes to each side. When one side is done, roll over for the other.',
      ],
    },
    alternative: 'Knees-down side plank (beginner level).',
    animation: 'brace',
    createDetector: (d) => new SidePlankDetector(sidePlankConfig(d)),
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
  if (ex.kind === 'hold') return ex.holdSplit ? `${n} s (${n / 2} s each side)` : `${n} s`;
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
