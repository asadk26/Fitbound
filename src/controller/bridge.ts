import { EXERCISES } from '../exercise/registry';
import { ExerciseSessionController, type SessionStage } from '../exercise/session';
import type { ExerciseEvent, GuidanceCode, PoseFrame, TrackingQuality } from '../exercise/types';
import { CalibrationFlow, type CalState } from '../input/calibration';
import { InputHub, type InputEvent } from '../input/InputHub';
import { detectorsFor, type InputMode } from '../input/modes';
import { motionPreset, type MotionReading, type NeutralPose } from '../input/motion';
import type { CameraState, CtrlPayload, GameMsg, ModelState } from '../net/protocol';

/**
 * The phone's brain in Connected Play. It runs the detectors the game asks
 * for (the PC owns the input mode) and turns what it sees into protocol
 * messages:
 *
 *   explore     march → MOVE_START (refreshed while marching) / MOVE_STOP,
 *               lean → one TURN_LEFT / TURN_RIGHT per lean, gestures
 *   menu /
 *   dialogue    lean → NAV, gestures
 *   calibration the setup checklist → CALIBRATION state
 *   exercise    only the requested exercise detector → EXERCISE_STATUS and
 *               one EXERCISE_REP per counted rep
 *
 * Only these interpreted events leave the phone — never frames or landmarks.
 * No DOM here, so the whole pipeline can be tested with synthetic poses.
 */
export const MOVE_REFRESH_MS = 400;
export const TELEMETRY_MS = 100;
export const STATUS_MS = 2000;
export const EXERCISE_STATUS_MS = 150;

interface ActiveSet {
  id: string;
  exerciseId: string;
  ctrl: ExerciseSessionController;
  lastStage: SessionStage | null;
  lastSentAt: number;
}

export interface Progress {
  setId: string;
  exerciseName: string;
  count: number;
  target: number;
  manualMode: boolean;
  paused: boolean;
}

export class ControllerBridge {
  readonly hub = new InputHub();
  mode: InputMode = 'off';
  epoch = 0;
  camera: CameraState = 'off';
  model: ModelState = 'loading';
  cameraError: string | undefined;
  tracking: TrackingQuality = 'lost';
  neutral: NeutralPose | null = null;
  calibration: CalState | null = null;
  progress: Progress | null = null;
  game: Extract<GameMsg, { type: 'GAME' }> | null = null;
  pcSound = true;
  facing: 'user' | 'environment' = 'user';
  modelSize: 'full' | 'lite' = 'full';
  exerciseGuidance: GuidanceCode | null = null;
  exerciseFallback = false;
  /** Last command sent, for the dashboard ("Turn left", "Marching"...). */
  lastAction: { label: string; at: number } | null = null;
  reading: MotionReading | null = null;
  private set: ActiveSet | null = null;
  private calib: CalibrationFlow | null = null;
  private moveSent = 0;
  private moveAt = -Infinity;
  private telemetryAt = -Infinity;
  private statusAt = -Infinity;
  private statusKey = '';
  private lastCalSentAt = -Infinity;

  constructor(
    /** Send one message (the link adds the sequence number and this epoch). */
    private readonly out: (p: CtrlPayload) => void,
    private readonly clock: () => number = () => performance.now(),
  ) {
    this.hub.on((e) => this.onHubEvent(e));
  }

  private note(label: string): void {
    this.lastAction = { label, at: this.clock() };
  }

  // ── Messages from the game ──────────────────────────────────────────────
  handle(msg: GameMsg): void {
    switch (msg.type) {
      case 'MODE':
        this.applyMode(msg.mode, msg.epoch);
        return;
      case 'SETTINGS':
        this.hub.reader.configure(motionPreset({ lean: msg.lean, march: msg.march }));
        this.pcSound = msg.pcSound;
        this.facing = msg.facing;
        this.modelSize = msg.model;
        return;
      case 'EXERCISE_BEGIN': {
        const ex = EXERCISES.find((e) => e.id === msg.exerciseId);
        if (!ex?.createDetector || ex.kind !== 'reps') return;
        const detector = ex.createDetector(msg.difficulty);
        // The PC decides when the set is complete; the phone just keeps counting.
        const ctrl = new ExerciseSessionController(ex, detector, 10_000, (e) => this.onExerciseEvent(msg.setId, e), { setupStuckMs: 20000, activeStuckMs: 20000 });
        this.set = { id: msg.setId, exerciseId: ex.id, ctrl, lastStage: null, lastSentAt: -Infinity };
        this.progress = { setId: msg.setId, exerciseName: ex.name, count: 0, target: 0, manualMode: false, paused: false };
        return;
      }
      case 'EXERCISE_PROGRESS':
        if (this.progress?.setId === msg.setId) this.progress = { ...this.progress, count: msg.count, target: msg.target, manualMode: msg.manualMode, paused: msg.paused };
        return;
      case 'EXERCISE_CONTROL': {
        const s = this.set;
        if (!s || s.id !== msg.setId) return;
        if (msg.action === 'pause') s.ctrl.pause();
        if (msg.action === 'resume') s.ctrl.resume(this.clock());
        if (msg.action === 'manual') s.ctrl.enableManualMode();
        return;
      }
      case 'EXERCISE_END':
        if (this.set?.id === msg.setId) this.set = null;
        if (this.progress?.setId === msg.setId) this.progress = null;
        return;
      case 'GAME':
        this.game = msg;
        return;
    }
  }

  applyMode(mode: InputMode, epoch: number): void {
    const prev = this.mode;
    this.epoch = epoch;
    if (mode === prev) return;
    this.mode = mode;
    this.hub.setMode(mode);
    this.moveSent = 0;
    if (mode === 'calibration') {
      this.calibration = null;
      this.calib = new CalibrationFlow(
        (s, changed) => this.onCalibration(s, changed),
        (n) => {
          this.neutral = n;
          this.hub.setNeutral(n);
          this.sendStatus(true);
        },
      );
      this.onCalibration(this.calib.state, true);
    } else this.calib = null;
    // An exercise set survives a pause (menu mode); only EXERCISE_END ends it.
  }

  /** Restore a calibration measured earlier in this browser session. */
  restoreNeutral(n: NeutralPose): void {
    this.neutral = n;
    this.hub.setNeutral(n);
  }

  // ── Camera frames ───────────────────────────────────────────────────────
  frame(frame: PoseFrame | null, now = this.clock()): void {
    const d = detectorsFor(this.mode);
    if (d.exercise) {
      const s = this.set;
      if (!s) return;
      const snap = s.ctrl.update(frame, now);
      this.tracking = snap.last?.tracking ?? (frame ? 'partial' : 'lost');
      this.exerciseGuidance = snap.last?.guidance ?? null;
      this.exerciseFallback = snap.fallbackAvailable;
      if (snap.stage !== s.lastStage || now - s.lastSentAt >= EXERCISE_STATUS_MS) {
        s.lastStage = snap.stage;
        s.lastSentAt = now;
        this.out({
          type: 'EXERCISE_STATUS',
          setId: s.id,
          stage: snap.stage,
          countdownLeftMs: Math.round(snap.countdownLeftMs),
          tracking: this.tracking,
          confidence: Math.max(0, Math.min(1, snap.last?.confidence ?? 0)),
          guidance: snap.last?.guidance ?? null,
          ready: !!snap.last?.ready,
          fallbackAvailable: snap.fallbackAvailable,
        });
      }
    } else if (d.march || d.lean || d.gestures) {
      const r = this.hub.feed(frame, now);
      this.reading = r;
      this.tracking = r?.tracking ?? 'lost';
      if (this.calib) this.calib.frame(frame, r?.leanDir ?? 0);
      if (r && now - this.telemetryAt >= TELEMETRY_MS) {
        this.telemetryAt = now;
        this.out({
          type: 'TELEMETRY',
          r: {
            tracking: r.tracking,
            fullBody: r.fullBody,
            marching: r.marching,
            cadence: Math.min(10, r.cadence),
            intensity: r.intensity,
            steps: r.steps,
            lastFoot: r.lastFoot,
            steer: Math.max(-1, Math.min(1, r.steer)),
            leanDeg: Math.max(-90, Math.min(90, r.leanDeg)),
            leanDir: r.leanDir,
            turnArmed: r.turnArmed,
            hold: r.hold,
            armed: r.armed,
          },
        });
      }
    } else this.tracking = frame ? 'good' : 'lost';
    this.tick(now);
  }

  /** Housekeeping, called for every frame and on a timer (so touch controls work without the camera). */
  tick(now = this.clock()): void {
    // Movement: MOVE_START while marching (refreshed so the PC's dead-man
    // timer never stops a march), one MOVE_STOP when it ends.
    const f = this.mode === 'explore' ? Math.round(this.hub.intent(now).forward * 100) / 100 : 0;
    if (f > 0 && (this.moveSent === 0 || now - this.moveAt >= MOVE_REFRESH_MS || Math.abs(f - this.moveSent) >= 0.15)) {
      if (this.moveSent === 0) this.note('Marching');
      this.out({ type: 'MOVE_START', intensity: f });
      this.moveSent = f;
      this.moveAt = now;
    } else if (f === 0 && this.moveSent > 0) {
      this.out({ type: 'MOVE_STOP' });
      this.moveSent = 0;
      this.note('Stopped');
    }
    this.sendStatus(false, now);
  }

  sendStatus(force = false, now = this.clock()): void {
    const s = { type: 'STATUS' as const, camera: this.camera, model: this.model, calibrated: !!this.neutral, tracking: this.tracking, ...(this.cameraError ? { error: this.cameraError.slice(0, 200) } : {}) };
    const key = JSON.stringify(s);
    if (!force && key === this.statusKey && now - this.statusAt < STATUS_MS) return;
    this.statusKey = key;
    this.statusAt = now;
    this.out(s);
  }

  // ── Touch fallback ──────────────────────────────────────────────────────
  touch(action: 'left' | 'right' | 'confirm' | 'back' | 'pause'): void {
    this.hub.press(action, 'touch');
  }

  touchForward(down: boolean): void {
    this.hub.setKey('forward', down);
    this.tick();
  }

  /** The player chose manual counting for this set (camera struggling). */
  manualMode(): void {
    const s = this.set;
    if (!s) return;
    s.ctrl.enableManualMode();
    this.out({ type: 'MANUAL_MODE', setId: s.id });
  }

  manualRep(): void {
    this.set?.ctrl.manualRep();
  }

  get exerciseActive(): boolean {
    return !!this.set;
  }

  // ── Internals ───────────────────────────────────────────────────────────
  private onHubEvent(e: InputEvent): void {
    const via = e.source === 'touch' || e.source === 'keyboard' ? 'touch' : 'motion';
    if (this.mode === 'calibration') {
      // Setup gestures drive the checklist here; the PC just shows its state.
      if (e.type === 'confirm' || e.type === 'back' || e.type === 'step') this.calib?.event(e.type);
      return;
    }
    switch (e.type) {
      case 'turn':
        this.out({ type: e.dir < 0 ? 'TURN_LEFT' : 'TURN_RIGHT', via });
        this.note(e.dir < 0 ? '↺ Turn left' : '↻ Turn right');
        return;
      case 'nav':
        this.out({ type: 'NAV', dir: e.dir, via });
        this.note(e.dir < 0 ? '◀ Previous' : 'Next ▶');
        return;
      case 'confirm':
        this.out({ type: 'INTERACT', via });
        this.note('✋ Confirm');
        return;
      case 'back':
        this.out({ type: 'BACK', via });
        this.note('✋ Back');
        return;
      case 'pause':
        this.out({ type: 'PAUSE', via });
        this.note('🙌 Pause');
        return;
      case 'step':
        this.out({ type: 'STEP', via });
        return;
    }
  }

  private onCalibration(s: CalState, changed: boolean): void {
    this.calibration = s;
    const now = this.clock();
    // Progress bars don't need every frame; step changes go at once.
    if (!changed && now - this.lastCalSentAt < 100) return;
    this.lastCalSentAt = now;
    this.out({ type: 'CALIBRATION', step: s.step, progress: Math.max(0, Math.min(1, s.progress)), hint: s.hint, floorOk: s.floorOk });
  }

  private onExerciseEvent(setId: string, e: ExerciseEvent): void {
    if (e.type !== 'rep' || this.set?.id !== setId) return;
    this.out({ type: 'EXERCISE_REP', setId, exerciseId: e.exerciseId, index: e.index, source: e.source });
    this.note(e.source === 'manual' ? '+1 rep (manual)' : '+1 rep');
  }
}
