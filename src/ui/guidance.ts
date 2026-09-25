import type { GuidanceCode } from '../exercise/types';

/** Player-facing text for each detector cue. */
export const GUIDANCE: Record<GuidanceCode, string> = {
  NO_BODY: 'No body detected — step into view',
  TRACKING_LOST: 'Camera tracking lost — move back into view',
  MOVE_BACK: 'Move farther from the camera',
  LEGS_NOT_VISIBLE: 'Your legs are not visible — step back or tilt the phone down',
  ARMS_NOT_VISIBLE: 'Your arms are not clearly visible',
  TURN_SIDEWAYS: 'Turn sideways to the camera for push-ups',
  FACE_CAMERA: 'Face the camera',
  STAND_UPRIGHT: 'Stand fully upright to begin',
  GET_INTO_PUSHUP: 'Get into push-up position, arms straight',
  GET_INTO_PLANK: 'Get into plank position',
  KEEP_BODY_STRAIGHT: 'Keep your body in a straight line',
  GO_LOWER: 'Almost! Go a little lower to count',
  EXTEND_FULLY: 'Straighten your arms at the top to begin',
  ARMS_AND_LEGS_TOGETHER: 'Arms up AND feet apart together to count',
  REPOSITION: 'Reposition your phone so your whole body is visible',
  NO_SWING: 'Keep your body and elbows still — that one didn’t count',
  GET_INTO_ROW: 'Bend over with a hand on your support, rowing arm nearest the phone',
  LIE_ON_BACK: 'Lie on your back side-on to the phone, arms up, knees over hips',
  STEP_BACK_TOGETHER: 'Step one foot back and lower — both knees level is a squat',
};

/** Short spoken versions of the most important cues. */
export const SPOKEN: Partial<Record<GuidanceCode, string>> = {
  MOVE_BACK: 'Move back',
  LEGS_NOT_VISIBLE: 'I can’t see your legs',
  TURN_SIDEWAYS: 'Turn sideways',
  FACE_CAMERA: 'Face the camera',
  TRACKING_LOST: 'Tracking lost',
  GO_LOWER: 'Go lower',
};
