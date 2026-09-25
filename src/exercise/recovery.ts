/**
 * Guided recovery for Havens: gentle, timed movements with spoken cues.
 * Deliberately not the combat rep system: nothing is scored, the timer runs
 * whether or not the camera sees you, and you can move on whenever you like.
 */
export interface RecoveryStep {
  /** Seconds for this cue. */
  s: number;
  say: string;
}

export interface RecoveryMove {
  id: string;
  name: string;
  /** Where to be relative to the phone (the camera isn't needed). */
  position: string;
  steps: RecoveryStep[];
  /** Floor movement: stand up slowly afterwards. */
  floor: boolean;
}

export const RECOVERY: RecoveryMove[] = [
  {
    id: 'standing_reach',
    name: 'Standing side reach',
    position: 'Stand comfortably, feet hip-width apart.',
    floor: false,
    steps: [
      { s: 8, say: 'Breathe in and reach both arms overhead.' },
      { s: 10, say: 'Lean gently to the left. Long through your right side.' },
      { s: 4, say: 'Back to the middle.' },
      { s: 10, say: 'Lean gently to the right.' },
      { s: 6, say: 'Back to the middle, and let your arms float down.' },
    ],
  },
  {
    id: 'cat_cow',
    name: 'Cat-cow',
    position: 'On hands and knees, hands under shoulders, knees under hips.',
    floor: true,
    steps: [
      { s: 6, say: 'Breathe in, let your belly sink and lift your gaze. Cow.' },
      { s: 6, say: 'Breathe out, round your back toward the ceiling. Cat.' },
      { s: 6, say: 'Breathe in. Cow.' },
      { s: 6, say: 'Breathe out. Cat.' },
      { s: 6, say: 'Once more. Cow.' },
      { s: 6, say: 'And cat. Then settle into a neutral back.' },
    ],
  },
  {
    id: 'childs_pose',
    name: 'Child’s pose',
    position: 'Kneel, then sit back toward your heels.',
    floor: true,
    steps: [
      { s: 8, say: 'Sit back toward your heels and rest your arms forward.' },
      { s: 12, say: 'Let your forehead rest. Breathe slowly into your back.' },
      { s: 12, say: 'Each breath out, soften a little more.' },
      { s: 8, say: 'When you are ready, walk your hands back and come up slowly.' },
    ],
  },
  {
    id: 'neck_shoulders',
    name: 'Shoulder rolls',
    position: 'Stand or sit tall.',
    floor: false,
    steps: [
      { s: 10, say: 'Roll your shoulders slowly backwards.' },
      { s: 10, say: 'Now forwards.' },
      { s: 8, say: 'Let your shoulders drop away from your ears.' },
    ],
  },
];

export function recoveryDuration(m: RecoveryMove): number {
  return m.steps.reduce((a, s) => a + s.s, 0);
}

/** A short Haven sequence: one standing, then one or two floor movements. */
export function havenSequence(rng: () => number = Math.random, length: 'short' | 'standard' = 'standard'): RecoveryMove[] {
  const standing = RECOVERY.filter((m) => !m.floor);
  const floor = RECOVERY.filter((m) => m.floor);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rng() * xs.length)];
  const out = [pick(standing)];
  if (length === 'short') out.push(pick(floor));
  else out.push(...floor);
  return out;
}
