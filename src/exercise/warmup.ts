import type { DayPrefs } from '../rpg/loadout';
import type { RecoveryMove } from './recovery';

/**
 * The Awakening (bible §18): about five minutes of gentle dynamic warm-up at
 * the start of each real workout session, while the reconstructed hero gets
 * used to his body. Guided and timed, like the Haven — nothing is scored and
 * no camera is needed. It adapts to soreness and to the room, and can be
 * shortened or skipped.
 */
const move = (id: string, name: string, demo: RecoveryMove['demo'], position: string, steps: [number, string][]): RecoveryMove => ({
  id,
  name,
  demo,
  position,
  floor: false,
  steps: steps.map(([s, say]) => ({ s, say })),
});

const MARCH = move('march', 'Marching in place', 'march', 'Stand tall where you have a little room.', [
  [15, 'March gently on the spot.'],
  [15, 'Let your arms swing with your steps.'],
  [15, 'Lift your knees a little higher, if it feels good.'],
]);
const ARM_CIRCLES = move('arm_circles', 'Arm circles', 'armCircles', 'Arms out to the sides.', [
  [20, 'Small circles forwards, growing bigger.'],
  [20, 'Now backwards.'],
]);
const TORSO = move('torso', 'Torso rotations', 'twist', 'Feet hip-width apart, knees soft.', [
  [20, 'Turn gently from side to side, arms loose.'],
  [20, 'Let your gaze follow. Nice and easy.'],
]);
const HIPS = move('hips', 'Hip circles', 'hips', 'Hands on your hips.', [
  [20, 'Slow circles one way.'],
  [20, 'And the other way.'],
]);
const LEG_SWINGS = move('leg_swings', 'Leg swings', 'legSwing', 'Hold a wall or chair if you like.', [
  [12, 'Swing your right leg gently forwards and back.'],
  [12, 'Now the left.'],
  [12, 'Right leg, side to side, in front of you.'],
  [12, 'And the left.'],
]);
const KNEE_LIFTS = move('knee_lifts', 'Knee lifts', 'kneeLift', 'Stand tall; hold something if you like.', [
  [20, 'Lift one knee, then the other, slowly.'],
  [20, 'A little higher if it feels good.'],
]);
const EASY_SQUATS = move('easy_squats', 'Easy squats', 'squat', 'Feet a little wider than your hips.', [
  [20, 'Sit back a little, then stand. Only as deep as is comfortable.'],
  [20, 'Keep it easy. This is a warm-up.'],
]);
const HEEL_RAISES = move('heel_raises', 'Heel raises', 'heelRaise', 'Stand tall; hold something if you like.', [[30, 'Rise onto your toes, and lower slowly. Gently.']]);
const REACH = move('reach', 'Reach and breathe', 'reach', 'Stand tall.', [
  [15, 'Reach both arms up and breathe in.'],
  [15, 'Let them float down as you breathe out.'],
]);

export interface WarmupOptions {
  /** 'short' is the brief version for a resumed session or a busy day (~2 min). */
  length: 'full' | 'short';
  /** Little room around you: no leg swings. */
  smallSpace: boolean;
}

/** The Awakening's moves for today (soreness from the day's readiness check). */
export function awakeningSequence(prefs: Pick<DayPrefs, 'sore'>, o: WarmupOptions): RecoveryMove[] {
  const sore = prefs.sore ?? {};
  const legsSore = !!sore.legs;
  const upperSore = !!sore.upper;
  const out: RecoveryMove[] = [MARCH, upperSore ? REACH : ARM_CIRCLES, TORSO, HIPS];
  // Sore legs: no swings or squats, just gentle heel raises. Little room: knee lifts instead of swings.
  if (legsSore) out.push(HEEL_RAISES);
  else out.push(o.smallSpace ? KNEE_LIFTS : LEG_SWINGS, EASY_SQUATS);
  out.push(REACH);
  const seq = [...new Set(out)];
  if (o.length === 'full') return seq;
  // The short version: each move trimmed to about a third, and no repeats.
  return seq.map((m) => ({ ...m, steps: m.steps.slice(0, 1).map((st) => ({ ...st, s: Math.max(10, Math.round(st.s * 1.1)) })) }));
}

export function sequenceSeconds(seq: RecoveryMove[]): number {
  return seq.reduce((a, m) => a + m.steps.reduce((b, s) => b + s.s, 0), 0);
}
