import { CAL_STEP_IDS, type CalStep } from '../input/calibration';
import { INPUT_MODES, type InputMode } from '../input/modes';
import type { SessionStage } from '../exercise/session';
import type { DiagBlocker, DiagEvent, GuidanceCode, RepSource, Side, TrackingQuality } from '../exercise/types';
import type { DiagSummary } from '../exercise/diagnostics';

/**
 * The Connected Play wire protocol: small JSON messages between the phone
 * (controller) and the PC (game), passed through the relay.
 *
 * The phone sends *interpreted* input — "a turn to the left", "a push-up
 * rep" — never camera images or landmarks. Every controller message carries a
 * sequence number (strictly increasing per controller session, so replays and
 * duplicates are dropped) and the input-mode epoch it was produced in (so a
 * command meant for one mode can't act in the next). The PC validates each
 * one's shape here, then its session, sequence and game context in the gate.
 */
export const PROTOCOL_VERSION = 1;

export type CameraState = 'off' | 'starting' | 'running' | 'error';
export type ModelState = 'loading' | 'ready' | 'error';

/** Display-only summary of the phone's motion reading (drives TV meters). */
export interface Telemetry {
  tracking: TrackingQuality;
  fullBody: boolean;
  marching: boolean;
  cadence: number;
  intensity: number;
  steps: number;
  lastFoot: 'left' | 'right' | null;
  steer: number;
  leanDeg: number;
  leanDir: -1 | 0 | 1;
  turnArmed: boolean;
  hold: { confirm: number; back: number; pause: number };
  armed: boolean;
  /** 0..1 standing-tall "ready" hold. */
  readyProgress: number;
}

/** Body parts, each 0 = not seen, 1 = one side seen, 2 = both sides seen. */
export const VIEW_PARTS = ['head', 'shoulders', 'elbows', 'wrists', 'hips', 'knees', 'ankles'] as const;
export type ViewPart = (typeof VIEW_PARTS)[number];

/**
 * What the camera can see, without any image: which body parts are visible
 * and where the body sits in the frame (0..1 box). Sent while tracking is
 * poor so the TV can say e.g. "can't see your wrists or ankles".
 */
export interface ViewSummary {
  parts: Record<ViewPart, 0 | 1 | 2>;
  box: [number, number, number, number] | null;
}

/** Longest preview image accepted (a ~128×72 JPEG is 3–6 KB). */
export const MAX_PEEK_CHARS = 14_000;

export type CtrlPayload =
  | { type: 'HELLO'; version: number; facing: 'user' | 'environment' }
  | { type: 'HEARTBEAT' }
  | { type: 'STATUS'; camera: CameraState; model: ModelState; calibrated: boolean; tracking: TrackingQuality; error?: string; moved?: boolean; cameraLabel?: string }
  | { type: 'TELEMETRY'; r: Telemetry }
  | { type: 'MOVE_START'; intensity: number }
  | { type: 'MOVE_STOP' }
  | { type: 'TURN_LEFT' | 'TURN_RIGHT' | 'INTERACT' | 'BACK' | 'PAUSE' | 'STEP' | 'READY' | 'DUCK' | 'HOP'; via: 'motion' | 'touch' }
  /** Dodge mode: the phone's duck/hop reading, ~15 times a second. */
  | { type: 'DODGE_STATUS'; tracking: TrackingQuality; baseline: boolean; ducking: boolean; duck: number; hops: number }
  | { type: 'NAV'; dir: -1 | 1; via: 'motion' | 'touch' }
  | { type: 'CALIBRATION'; step: CalStep; progress: number; hint: string | null; floorOk: boolean }
  | {
      type: 'EXERCISE_STATUS';
      setId: string;
      stage: SessionStage;
      countdownLeftMs: number;
      tracking: TrackingQuality;
      confidence: number;
      guidance: GuidanceCode | null;
      ready: boolean;
      fallbackAvailable: boolean;
      /** Why the detector is blocked right now (push-ups report this). */
      blocker?: DiagBlocker | null;
      /** 0..1 progress of the mid-set pause gesture. */
      pauseProgress?: number;
    }
  | { type: 'EXERCISE_DIAG'; setId: string; summary: DiagSummary }
  | { type: 'EXERCISE_REP'; setId: string; exerciseId: string; index: number; source: RepSource; side?: Side }
  /** Hold exercises: total valid hold time so far in this set (never decreases). */
  | { type: 'EXERCISE_HOLD'; setId: string; heldMs: number }
  /** The player asked to finish the set now (phone button). */
  | { type: 'FINISH_SET'; setId: string }
  | { type: 'MANUAL_MODE'; setId: string }
  | { type: 'VIEW'; view: ViewSummary | null }
  /** Opt-in only: a tiny, low-resolution preview while tracking is lost (null clears it). */
  | { type: 'PEEK'; image: string | null };

export type CtrlMsg = CtrlPayload & { seq: number; epoch: number };

export type GameMsg =
  | { type: 'MODE'; mode: InputMode; epoch: number; calibration?: 'full' | 'quick' }
  | { type: 'SETTINGS'; turnStep: 45 | 90; lean: 'low' | 'normal' | 'high'; march: 'low' | 'normal' | 'high'; facing: 'user' | 'environment'; model: 'full' | 'lite'; pcSound: boolean }
  | { type: 'EXERCISE_BEGIN'; setId: string; exerciseId: string; difficulty: 'beginner' | 'intermediate' | 'advanced' }
  | { type: 'EXERCISE_PROGRESS'; setId: string; count: number; target: number; manualMode: boolean; paused: boolean }
  | { type: 'EXERCISE_CONTROL'; setId: string; action: 'pause' | 'resume' | 'manual' }
  | { type: 'EXERCISE_END'; setId: string }
  | { type: 'ACK'; seq: number }
  | { type: 'GAME'; title: string; hint: string; exercise: string | null; paused: boolean; notice: string | null }
  | { type: 'HEARTBEAT' };

// ── Validation helpers ────────────────────────────────────────────────────
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const int = (v: unknown, lo: number, hi: number): v is number => num(v, lo, hi) && Number.isInteger(v);
const oneOf = <T extends string | number | null>(v: unknown, list: readonly T[]): v is T => list.includes(v as T);
const str = (v: unknown, max: number, re = /^[A-Za-z0-9_-]+$/): v is string => typeof v === 'string' && v.length > 0 && v.length <= max && re.test(v);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;

const TRACKING = ['good', 'partial', 'lost'] as const;
const STAGES = ['setup', 'countdown', 'active', 'complete'] as const;
const GUIDANCE = [
  null,
  'NO_BODY',
  'TRACKING_LOST',
  'MOVE_BACK',
  'LEGS_NOT_VISIBLE',
  'ARMS_NOT_VISIBLE',
  'TURN_SIDEWAYS',
  'FACE_CAMERA',
  'STAND_UPRIGHT',
  'GET_INTO_PUSHUP',
  'GET_INTO_PLANK',
  'KEEP_BODY_STRAIGHT',
  'GO_LOWER',
  'EXTEND_FULLY',
  'ARMS_AND_LEGS_TOGETHER',
  'REPOSITION',
  'NO_SWING',
  'GET_INTO_ROW',
  'LIE_ON_BACK',
  'STEP_BACK_TOGETHER',
] as const;
const VIA = ['motion', 'touch'] as const;
const BLOCKERS = ['NO_BODY', 'BODY_HIDDEN', 'ARMS_HIDDEN', 'NOT_LEVEL', 'NOT_SIDEWAYS', 'HIPS_PIKED', 'ARMS_NOT_STRAIGHT'] as const;
const EVENTS = ['partial-depth', 'no-return', 'too-fast', 'lost-mid-rep', 'reset-mid-rep'] as const;

/** A map of known keys to small non-negative numbers; anything else fails. */
function counts<K extends string>(v: unknown, keys: readonly K[], max: number): Partial<Record<K, number>> | null {
  if (!isObj(v)) return null;
  const out: Partial<Record<K, number>> = {};
  for (const [k, n] of Object.entries(v)) {
    if (!keys.includes(k as K) || !num(n, 0, max)) return null;
    out[k as K] = n;
  }
  return out;
}

function diagSummary(v: unknown): DiagSummary | null {
  if (!isObj(v) || typeof v.started !== 'boolean' || !(v.startBlocker === null || oneOf(v.startBlocker, BLOCKERS)) || !int(v.counted, 0, 10_000)) return null;
  const blockedMs = counts(v.blockedMs, BLOCKERS, 3_600_000);
  const events = counts(v.events, EVENTS, 10_000);
  if (!blockedMs || !events) return null;
  return { started: v.started, startBlocker: v.startBlocker as DiagBlocker | null, blockedMs, events: events as Partial<Record<DiagEvent, number>>, counted: v.counted };
}
const SENS = ['low', 'normal', 'high'] as const;

function telemetry(v: unknown): Telemetry | null {
  if (!isObj(v) || !isObj(v.hold)) return null;
  const h = v.hold;
  const ok =
    oneOf(v.tracking, TRACKING) &&
    typeof v.fullBody === 'boolean' &&
    typeof v.marching === 'boolean' &&
    num(v.cadence, 0, 10) &&
    num(v.intensity, 0, 1) &&
    int(v.steps, 0, 1e7) &&
    oneOf(v.lastFoot, ['left', 'right', null] as const) &&
    num(v.steer, -1, 1) &&
    num(v.leanDeg, -90, 90) &&
    oneOf(v.leanDir, [-1, 0, 1] as const) &&
    typeof v.turnArmed === 'boolean' &&
    num(h.confirm, 0, 1) &&
    num(h.back, 0, 1) &&
    num(h.pause, 0, 1) &&
    typeof v.armed === 'boolean' &&
    num(v.readyProgress, 0, 1);
  if (!ok) return null;
  return {
    tracking: v.tracking as TrackingQuality,
    fullBody: v.fullBody as boolean,
    marching: v.marching as boolean,
    cadence: v.cadence as number,
    intensity: v.intensity as number,
    steps: v.steps as number,
    lastFoot: v.lastFoot as Telemetry['lastFoot'],
    steer: v.steer as number,
    leanDeg: v.leanDeg as number,
    leanDir: v.leanDir as Telemetry['leanDir'],
    turnArmed: v.turnArmed as boolean,
    hold: { confirm: h.confirm as number, back: h.back as number, pause: h.pause as number },
    armed: v.armed as boolean,
    readyProgress: v.readyProgress as number,
  };
}

/**
 * Validate a message from the controller. Returns a clean copy containing
 * only known fields, or null if anything is missing, mistyped or out of range.
 */
export function parseCtrlMsg(v: unknown): CtrlMsg | null {
  if (!isObj(v) || !int(v.seq, 1, Number.MAX_SAFE_INTEGER) || !int(v.epoch, 0, 1e9) || typeof v.type !== 'string') return null;
  const base = { seq: v.seq, epoch: v.epoch };
  switch (v.type) {
    case 'HELLO':
      return int(v.version, 1, 1000) && oneOf(v.facing, ['user', 'environment'] as const) ? { ...base, type: 'HELLO', version: v.version, facing: v.facing } : null;
    case 'HEARTBEAT':
    case 'MOVE_STOP':
      return { ...base, type: v.type };
    case 'STATUS':
      if (!oneOf(v.camera, ['off', 'starting', 'running', 'error'] as const) || !oneOf(v.model, ['loading', 'ready', 'error'] as const) || typeof v.calibrated !== 'boolean' || !oneOf(v.tracking, TRACKING)) return null;
      if (v.error !== undefined && !text(v.error, 200)) return null;
      if (v.moved !== undefined && typeof v.moved !== 'boolean') return null;
      if (v.cameraLabel !== undefined && !text(v.cameraLabel, 80)) return null;
      return {
        ...base,
        type: 'STATUS',
        camera: v.camera,
        model: v.model,
        calibrated: v.calibrated,
        tracking: v.tracking,
        ...(v.error ? { error: v.error as string } : {}),
        ...(v.moved ? { moved: true } : {}),
        ...(v.cameraLabel ? { cameraLabel: v.cameraLabel as string } : {}),
      };
    case 'TELEMETRY': {
      const r = telemetry(v.r);
      return r ? { ...base, type: 'TELEMETRY', r } : null;
    }
    case 'MOVE_START':
      return num(v.intensity, 0, 1) ? { ...base, type: 'MOVE_START', intensity: v.intensity } : null;
    case 'TURN_LEFT':
    case 'TURN_RIGHT':
    case 'INTERACT':
    case 'BACK':
    case 'PAUSE':
    case 'STEP':
    case 'READY':
    case 'DUCK':
    case 'HOP':
      return oneOf(v.via, VIA) ? { ...base, type: v.type, via: v.via } : null;
    case 'DODGE_STATUS':
      return oneOf(v.tracking, TRACKING) && typeof v.baseline === 'boolean' && typeof v.ducking === 'boolean' && num(v.duck, 0, 1) && int(v.hops, 0, 100_000)
        ? { ...base, type: 'DODGE_STATUS', tracking: v.tracking, baseline: v.baseline, ducking: v.ducking, duck: v.duck, hops: v.hops }
        : null;
    case 'NAV':
      return oneOf(v.dir, [-1, 1] as const) && oneOf(v.via, VIA) ? { ...base, type: 'NAV', dir: v.dir, via: v.via } : null;
    case 'CALIBRATION':
      return oneOf(v.step, CAL_STEP_IDS) && num(v.progress, 0, 1) && (v.hint === null || text(v.hint, 200)) && typeof v.floorOk === 'boolean'
        ? { ...base, type: 'CALIBRATION', step: v.step, progress: v.progress, hint: v.hint as string | null, floorOk: v.floorOk }
        : null;
    case 'EXERCISE_DIAG': {
      const summary = diagSummary(v.summary);
      return str(v.setId, 40) && summary ? { ...base, type: 'EXERCISE_DIAG', setId: v.setId, summary } : null;
    }
    case 'EXERCISE_STATUS':
      if ((v.blocker !== undefined && !(v.blocker === null || oneOf(v.blocker, BLOCKERS))) || (v.pauseProgress !== undefined && !num(v.pauseProgress, 0, 1))) return null;
      return str(v.setId, 40) && oneOf(v.stage, STAGES) && num(v.countdownLeftMs, 0, 60_000) && oneOf(v.tracking, TRACKING) && num(v.confidence, 0, 1) && oneOf(v.guidance, GUIDANCE) && typeof v.ready === 'boolean' && typeof v.fallbackAvailable === 'boolean'
        ? {
            ...base,
            type: 'EXERCISE_STATUS',
            setId: v.setId,
            stage: v.stage,
            countdownLeftMs: v.countdownLeftMs,
            tracking: v.tracking,
            confidence: v.confidence,
            guidance: v.guidance,
            ready: v.ready,
            fallbackAvailable: v.fallbackAvailable,
            blocker: (v.blocker as DiagBlocker | null | undefined) ?? null,
            pauseProgress: (v.pauseProgress as number | undefined) ?? 0,
          }
        : null;
    case 'EXERCISE_REP':
      if (v.side !== undefined && !oneOf(v.side, ['left', 'right'] as const)) return null;
      return str(v.setId, 40) && str(v.exerciseId, 32) && int(v.index, 1, 10_000) && oneOf(v.source, ['camera', 'manual'] as const)
        ? { ...base, type: 'EXERCISE_REP', setId: v.setId, exerciseId: v.exerciseId, index: v.index, source: v.source, ...(v.side ? { side: v.side as Side } : {}) }
        : null;
    case 'EXERCISE_HOLD':
      return str(v.setId, 40) && int(v.heldMs, 0, 3_600_000) ? { ...base, type: 'EXERCISE_HOLD', setId: v.setId, heldMs: v.heldMs } : null;
    case 'FINISH_SET':
      return str(v.setId, 40) ? { ...base, type: 'FINISH_SET', setId: v.setId } : null;
    case 'MANUAL_MODE':
      return str(v.setId, 40) ? { ...base, type: 'MANUAL_MODE', setId: v.setId } : null;
    case 'VIEW': {
      if (v.view === null) return { ...base, type: 'VIEW', view: null };
      if (!isObj(v.view) || !isObj(v.view.parts)) return null;
      const parts = {} as Record<ViewPart, 0 | 1 | 2>;
      for (const k of VIEW_PARTS) {
        const n = v.view.parts[k];
        if (!oneOf(n, [0, 1, 2] as const)) return null;
        parts[k] = n;
      }
      const b = v.view.box;
      if (b !== null && !(Array.isArray(b) && b.length === 4 && b.every((x) => num(x, -0.5, 1.5)))) return null;
      return { ...base, type: 'VIEW', view: { parts, box: b as ViewSummary['box'] } };
    }
    case 'PEEK':
      if (v.image === null) return { ...base, type: 'PEEK', image: null };
      return typeof v.image === 'string' && v.image.length <= MAX_PEEK_CHARS && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(v.image) ? { ...base, type: 'PEEK', image: v.image } : null;
    default:
      return null;
  }
}

/** Validate a message from the game (the phone trusts the PC less than blindly). */
export function parseGameMsg(v: unknown): GameMsg | null {
  if (!isObj(v) || typeof v.type !== 'string') return null;
  switch (v.type) {
    case 'MODE':
      if (v.calibration !== undefined && !oneOf(v.calibration, ['full', 'quick'] as const)) return null;
      return oneOf(v.mode, INPUT_MODES) && int(v.epoch, 0, 1e9) ? { type: 'MODE', mode: v.mode, epoch: v.epoch, ...(v.calibration ? { calibration: v.calibration as 'full' | 'quick' } : {}) } : null;
    case 'SETTINGS':
      return oneOf(v.turnStep, [45, 90] as const) && oneOf(v.lean, SENS) && oneOf(v.march, SENS) && oneOf(v.facing, ['user', 'environment'] as const) && oneOf(v.model, ['full', 'lite'] as const) && typeof v.pcSound === 'boolean'
        ? { type: 'SETTINGS', turnStep: v.turnStep, lean: v.lean, march: v.march, facing: v.facing, model: v.model, pcSound: v.pcSound }
        : null;
    case 'EXERCISE_BEGIN':
      return str(v.setId, 40) && str(v.exerciseId, 32) && oneOf(v.difficulty, ['beginner', 'intermediate', 'advanced'] as const) ? { type: 'EXERCISE_BEGIN', setId: v.setId, exerciseId: v.exerciseId, difficulty: v.difficulty } : null;
    case 'EXERCISE_PROGRESS':
      return str(v.setId, 40) && int(v.count, 0, 10_000) && int(v.target, 1, 10_000) && typeof v.manualMode === 'boolean' && typeof v.paused === 'boolean'
        ? { type: 'EXERCISE_PROGRESS', setId: v.setId, count: v.count, target: v.target, manualMode: v.manualMode, paused: v.paused }
        : null;
    case 'EXERCISE_CONTROL':
      return str(v.setId, 40) && oneOf(v.action, ['pause', 'resume', 'manual'] as const) ? { type: 'EXERCISE_CONTROL', setId: v.setId, action: v.action } : null;
    case 'EXERCISE_END':
      return str(v.setId, 40) ? { type: 'EXERCISE_END', setId: v.setId } : null;
    case 'ACK':
      return int(v.seq, 1, Number.MAX_SAFE_INTEGER) ? { type: 'ACK', seq: v.seq } : null;
    case 'GAME':
      return text(v.title, 120) && text(v.hint, 240) && (v.exercise === null || text(v.exercise, 60)) && typeof v.paused === 'boolean' && (v.notice === null || text(v.notice, 200))
        ? { type: 'GAME', title: v.title, hint: v.hint, exercise: v.exercise as string | null, paused: v.paused, notice: v.notice as string | null }
        : null;
    case 'HEARTBEAT':
      return { type: 'HEARTBEAT' };
    default:
      return null;
  }
}

/** Controller messages that must survive a reconnect (resent until ACKed).
 *  Everything else is state that is simply re-sent fresh after reconnecting. */
export const RELIABLE: ReadonlySet<CtrlPayload['type']> = new Set(['EXERCISE_REP', 'MANUAL_MODE', 'FINISH_SET']);
