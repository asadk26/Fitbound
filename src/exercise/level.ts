import type { PoseFrame } from './types';

/**
 * Undo a sideways camera tilt (roll) before exercise detectors see a frame.
 *
 * Why not just the phone's tilt sensor: the sensor gives gravity in the
 * phone's own axes, but turning that into "which way is down in this video
 * frame" also depends on how iOS rotates and mirrors camera frames for the
 * current screen orientation, and the sign conventions of the motion API
 * differ between browsers. A mistake there would *add* tilt instead of
 * removing it. Instead the roll is measured from the player: during
 * calibration they stand upright, so the angle of their torso in the image
 * *is* the camera's roll (to within their natural posture, a few degrees).
 *
 * Only rotation within the image is corrected. Pitch (the phone leaning back
 * against a wall) and perspective can't be undone from one 2D view; the push-up
 * checks are tolerant enough (±45° body incline) that pitch hasn't mattered in
 * testing, and the calibrated top angle absorbs its effect on elbow angles.
 */
export const MAX_LEVEL_DEG = 25;

export function levelFrame(frame: PoseFrame | null, rollDeg: number | undefined): PoseFrame | null {
  if (!frame || !rollDeg || Math.abs(rollDeg) < 1 || Math.abs(rollDeg) > MAX_LEVEL_DEG) return frame;
  const phi = (-rollDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const cx = frame.aspect / 2;
  const cy = 0.5;
  return {
    ...frame,
    landmarks: frame.landmarks.map((l) => {
      const x = l.x - cx;
      const y = l.y - cy;
      return { ...l, x: cx + x * cos - y * sin, y: cy + x * sin + y * cos };
    }),
  };
}
