/**
 * Exercise detection contracts.
 *
 * The detection module is deliberately isolated from the combat engine: a
 * detector only ever sees pose frames and only ever reports what it saw. The
 * session controller turns detector output into ExerciseEvents, and the combat
 * engine consumes those events without knowing which detector produced them.
 */

/** One MediaPipe pose landmark in *isotropic* image space.
 *
 *  x is scaled by the frame's aspect ratio so that one unit horizontally is the
 *  same physical distance as one unit vertically; angles computed from these
 *  points are therefore true angles. y grows downward, as in the image. */
export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface PoseFrame {
  /** 33 landmarks in MediaPipe BlazePose order. */
  landmarks: Landmark[];
  /** Milliseconds, monotonically increasing. */
  timestamp: number;
  /** width / height of the source frame. x values range 0..aspect. */
  aspect: number;
}

export type ExerciseKind = 'reps' | 'hold';

export type TrackingQuality = 'good' | 'partial' | 'lost';

/** Coaching cues a detector can raise. The UI maps each to player-facing text. */
export type GuidanceCode =
  | 'NO_BODY'
  | 'TRACKING_LOST'
  | 'MOVE_BACK'
  | 'LEGS_NOT_VISIBLE'
  | 'ARMS_NOT_VISIBLE'
  | 'TURN_SIDEWAYS'
  | 'FACE_CAMERA'
  | 'STAND_UPRIGHT'
  | 'GET_INTO_PUSHUP'
  | 'GET_INTO_PLANK'
  | 'KEEP_BODY_STRAIGHT'
  | 'GO_LOWER'
  | 'EXTEND_FULLY'
  | 'ARMS_AND_LEGS_TOGETHER'
  | 'REPOSITION'
  | 'NO_SWING'
  | 'GET_INTO_ROW'
  | 'LIE_ON_BACK'
  | 'STEP_BACK_TOGETHER'
  | 'GET_INTO_WALL_SIT'
  | 'BACK_AGAINST_WALL'
  | 'GET_INTO_SIDE_PLANK'
  | 'LIFT_HIPS'
  | 'SWITCH_SIDES';

/** The player's anatomical side, for exercises counted per side. */
export type Side = 'left' | 'right';

export interface DetectorUpdate {
  /** Name of the current state-machine phase, for display and debugging. */
  phase: string;
  tracking: TrackingQuality;
  /** Mean visibility of the landmarks this exercise depends on, 0..1. */
  confidence: number;
  /** The most important cue right now, or null when all is well. */
  guidance: GuidanceCode | null;
  /** True while the player is holding a valid starting position. */
  ready: boolean;
  /** True on exactly the update in which a full repetition completed. */
  repCompleted: boolean;
  /** Sided exercises: which side that repetition was (the player's anatomical side). */
  repSide?: Side;
  /** Rough 0..1 progress through the current movement, for UI meters. */
  progress: number;
  /** Hold exercises only: accumulated valid hold time in ms. */
  holdMs?: number;
  /** Split holds (side planks): credited hold time per side, ms; sums to holdMs. */
  holdSides?: SideCounts;
  /** Hold exercises only: whether the hold is currently valid. */
  holding?: boolean;
  /** True on the update where a started rep was abandoned without counting. */
  partialRep?: boolean;
  /** Raw measurements behind the decision, for the Detector Lab and tuning. */
  metrics?: Record<string, number>;
  /** Why reps aren't counting right now, for on-screen diagnostics (optional per detector). */
  diag?: DetectorDiag;
}

/** Something stopping the detector from starting or continuing a rep. */
export type DiagBlocker = 'NO_BODY' | 'BODY_HIDDEN' | 'ARMS_HIDDEN' | 'NOT_LEVEL' | 'NOT_SIDEWAYS' | 'HIPS_PIKED' | 'ARMS_NOT_STRAIGHT';

/**
 * One-off outcomes of a rep attempt that didn't count. The first three are
 * *incomplete reps* (the camera saw them and they fell short); the last two
 * are attempts the camera *could not assess*.
 */
export type DiagEvent = 'partial-depth' | 'no-return' | 'too-fast' | 'lost-mid-rep' | 'reset-mid-rep';

export interface DetectorDiag {
  /** Present while the detector is blocked (not in position / not started). */
  blocker: DiagBlocker | null;
  /** The transition the detector is waiting for. */
  waiting: 'start' | 'lower' | 'bottom' | 'return' | null;
  event?: DiagEvent;
}

export interface ExerciseDetector {
  readonly exerciseId: string;
  readonly kind: ExerciseKind;
  /** Clear all state, e.g. between sets. */
  reset(): void;
  /** Feed one frame. `null` means the tracker saw no body in this frame. */
  update(frame: PoseFrame | null, now: number): DetectorUpdate;
  /** Hold exercises that split their target (side planks): the set's total target. */
  setHoldTarget?(ms: number): void;
}

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

/** Where an exercise event came from. Manual completions are never reported
 *  as camera-verified. */
export type RepSource = 'camera' | 'manual';

export type ExerciseEvent =
  | { type: 'rep'; exerciseId: string; index: number; target: number; source: RepSource; side?: Side }
  | { type: 'holdTick'; exerciseId: string; heldMs: number; targetMs: number; source: RepSource }
  | {
      type: 'setComplete';
      exerciseId: string;
      /** 'camera' only if every rep in the set was camera-verified. */
      verification: 'camera' | 'manual' | 'mixed';
      completed: number;
      target: number;
      sides?: SideCounts;
    }
  /**
   * The set ended before its target. 'finished': the player chose to finish
   * (voice, button, menu) — the verified work resolves as a partial ability.
   * 'stopped' / 'abandoned': older flows (no ability resolution beyond reps).
   */
  | { type: 'setEnded'; exerciseId: string; completed: number; target: number; reason: 'stopped' | 'abandoned' | 'finished'; sides?: SideCounts };

/** Verified reps per side for sided exercises. */
export interface SideCounts {
  left: number;
  right: number;
}
