import { SetDiagnostics } from '../exercise/diagnostics';
import { levelFrame } from '../exercise/level';
import { EXERCISES } from '../exercise/registry';
import { ExerciseSessionController, trialSessionOptions, type SessionStage } from '../exercise/session';
import type { DiagBlocker, ExerciseEvent, GuidanceCode, PoseFrame, TrackingQuality } from '../exercise/types';
import { CalibrationFlow, type CalKind, type CalState } from '../input/calibration';
import { InputHub, type InputEvent } from '../input/InputHub';
import { detectorsFor, type InputMode } from '../input/modes';
import { motionPreset, type MotionReading, type NeutralPose } from '../input/motion';
import type { CameraState, CtrlPayload, GameMsg, ModelState } from '../net/protocol';
import type { TiltWatch } from '../input/tilt';
import { viewSummary } from '../net/view';
import { DodgeReader } from '../rpg/dodge';

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
 *               one EXERCISE_REP per counted rep, that exercise's pause
 *               gesture → PAUSE, and rep diagnostics → EXERCISE_DIAG
 *   ready       standing tall, hands relaxed → READY
 *
 * Only these interpreted events leave the phone — never landmarks. While
 * tracking is poor it also sends a words-only VIEW (which body parts are
 * visible) and, only if the player switched it on, a tiny PEEK preview.
 * No DOM here, so the whole pipeline can be tested with synthetic poses.
 */
export const MOVE_REFRESH_MS = 400;
export const TELEMETRY_MS = 100;
export const STATUS_MS = 2000;
export const EXERCISE_STATUS_MS = 150;
export const DIAG_MS = 1000;
/** "What the camera sees" while tracking is poor: parts list, and opt-in preview. */
export const VIEW_MS = 500;
export const PEEK_MS = 1000;
/** Poor for this long before the TV shows it; good for this long before it hides. */
export const VIEW_SHOW_MS = 500;
export const VIEW_HIDE_MS = 1000;

interface ActiveSet {
  id: string;
  exerciseId: string;
  ctrl: ExerciseSessionController;
  lastStage: SessionStage | null;
  lastSentAt: number;
  diag: SetDiagnostics;
  diagAt: number;
  /** Hold exercises: last hold time reported to the PC. */
  heldSent: number;
  heldAt: number;
}

export const HOLD_REPORT_MS = 250;

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
  exerciseBlocker: DiagBlocker | null = null;
  /** Optional: reports whether the phone moved since calibration. */
  tilt: TiltWatch | null = null;
  private calKind: CalKind = 'full';
  /** Which camera is in use, shown on the TV so the player knows. */
  cameraLabel: string | undefined;
  /** Opt-in (off by default): grabs a tiny low-res still for the TV while tracking is lost. */
  peek: (() => string | null) | null = null;
  peekEnabled = false;
  private poorSince: number | null = null;
  private goodSince: number | null = null;
  private viewShown = false;
  private viewAt = -Infinity;
  private peekShown = false;
  private peekAt = -Infinity;
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
  /** Dodge mode: duck / hop reading, restarted (new baseline) each time dodging begins. */
  readonly dodge = new DodgeReader();
  private dodgeKey = '';
  private dodgeAt = -Infinity;

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
      case 'PING':
        // Echo with our clock so the PC can measure the delay (nothing else changes).
        this.out({ type: 'PONG', id: msg.id, t: msg.t, at: this.clock() });
        return;
      case 'MODE':
        if (msg.calibration) this.calKind = msg.calibration;
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
        if (!ex?.createDetector) return;
        const detector = ex.createDetector(msg.difficulty);
        // The PC decides when the set is complete; the phone just keeps counting.
        const ctrl = new ExerciseSessionController(ex, detector, 10_000, (e) => this.onExerciseEvent(msg.setId, e), trialSessionOptions(ex.id));
        if (msg.holdTargetMs) detector.setHoldTarget?.(msg.holdTargetMs);
        this.set = { id: msg.setId, exerciseId: ex.id, ctrl, lastStage: null, lastSentAt: -Infinity, diag: new SetDiagnostics(), diagAt: -Infinity, heldSent: 0, heldAt: -Infinity };
        this.hub.setExercise(ex.id);
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
        if (this.set?.id === msg.setId) {
          this.sendDiag(this.set);
          this.set = null;
          this.hub.setExercise(null);
        }
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
    if (mode === 'dodge') {
      this.dodge.reset();
      this.dodgeKey = '';
    }
    if (mode === 'calibration') {
      this.calibration = null;
      this.calib = new CalibrationFlow(
        (s, changed) => this.onCalibration(s, changed),
        (n) => {
          this.neutral = n;
          this.hub.setNeutral(n);
          this.sendStatus(true);
        },
        this.calKind,
      );
      this.calKind = 'full';
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
      // The exercise's own pause gesture (standing variants only; see exercisePause.ts).
      this.hub.feed(frame, now);
      const snap = s.ctrl.update(levelFrame(frame, this.neutral?.rollDeg), now);
      s.diag.feed(snap.last, snap.stage, now);
      this.tracking = snap.last?.tracking ?? (frame ? 'partial' : 'lost');
      this.exerciseGuidance = snap.last?.guidance ?? null;
      this.exerciseFallback = snap.fallbackAvailable;
      this.exerciseBlocker = snap.last?.diag?.blocker ?? null;
      if (now - s.diagAt >= DIAG_MS) this.sendDiag(s, now);
      if (s.ctrl.isHold && snap.heldMs > s.heldSent && now - s.heldAt >= HOLD_REPORT_MS) {
        s.heldSent = Math.floor(snap.heldMs);
        s.heldAt = now;
        const sides = snap.holdSides ? { left: Math.floor(snap.holdSides.left), right: Math.floor(snap.holdSides.right) } : {};
        this.out({ type: 'EXERCISE_HOLD', setId: s.id, heldMs: s.heldSent, ...sides });
      }
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
          blocker: this.exerciseBlocker,
          pauseProgress: this.hub.exercisePauseProgress,
        });
      }
    } else if (d.dodge) {
      const r = this.dodge.update(frame, now);
      this.tracking = r.tracking;
      const key = `${r.tracking}|${r.baseline}|${r.ducking}|${r.hops}`;
      if (key !== this.dodgeKey || now - this.dodgeAt >= 66) {
        this.dodgeKey = key;
        this.dodgeAt = now;
        this.out({ type: 'DODGE_STATUS', tracking: r.tracking, baseline: r.baseline, ducking: r.ducking, duck: Math.round(r.duck * 100) / 100, hops: r.hops, at: this.clock() });
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
            readyProgress: r.readyProgress,
          },
        });
      }
    } else this.tracking = frame ? 'good' : 'lost';
    // Menus and dialogue don't need the body (a gamepad player may be on the couch).
    if (this.mode === 'menu' || this.mode === 'dialogue') this.clearView();
    else this.updateView(frame, now);
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

  /** Tell the TV what the camera can see while tracking is poor; clear it once good again. */
  private updateView(frame: PoseFrame | null, now: number): void {
    if (this.tracking === 'good') {
      this.poorSince = null;
      this.goodSince ??= now;
      if (now - this.goodSince >= VIEW_HIDE_MS) this.clearView();
      return;
    }
    this.goodSince = null;
    this.poorSince ??= now;
    if (now - this.poorSince < VIEW_SHOW_MS) return;
    if (now - this.viewAt >= VIEW_MS) {
      this.viewAt = now;
      this.viewShown = true;
      this.out({ type: 'VIEW', view: viewSummary(frame) });
    }
    if (this.peekEnabled && this.peek && now - this.peekAt >= PEEK_MS) {
      this.peekAt = now;
      const image = this.peek();
      if (image) {
        this.peekShown = true;
        this.out({ type: 'PEEK', image });
      }
    } else if (!this.peekEnabled) this.clearPeek();
  }

  private clearView(): void {
    if (this.viewShown) this.out({ type: 'VIEW', view: null });
    this.viewShown = false;
    this.viewAt = -Infinity;
    this.clearPeek();
  }

  /** Stop any preview on the TV now (e.g. the player switched it off). */
  clearPeek(): void {
    if (this.peekShown) this.out({ type: 'PEEK', image: null });
    this.peekShown = false;
    this.peekAt = -Infinity;
  }

  sendStatus(force = false, now = this.clock()): void {
    const moved = !!this.tilt?.moved;
    const s = {
      type: 'STATUS' as const,
      camera: this.camera,
      model: this.model,
      calibrated: !!this.neutral,
      tracking: this.tracking,
      ...(this.cameraError ? { error: this.cameraError.slice(0, 200) } : {}),
      ...(moved ? { moved } : {}),
      ...(this.cameraLabel ? { cameraLabel: this.cameraLabel.slice(0, 80) } : {}),
    };
    const key = JSON.stringify(s);
    if (!force && key === this.statusKey && now - this.statusAt < STATUS_MS) return;
    this.statusKey = key;
    this.statusAt = now;
    this.out(s);
  }

  // ── Touch fallback ──────────────────────────────────────────────────────
  touch(action: 'left' | 'right' | 'confirm' | 'back' | 'pause' | 'ready' | 'duck' | 'hop'): void {
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

  /** The player tapped "Finish set" on the phone; the PC resolves it. */
  finishSet(): void {
    const s = this.set;
    if (!s) return;
    this.out({ type: 'FINISH_SET', setId: s.id });
    this.note('✓ Finish set');
  }

  get exerciseActive(): boolean {
    return !!this.set;
  }

  private sendDiag(s: ActiveSet, now = this.clock()): void {
    s.diagAt = now;
    this.out({ type: 'EXERCISE_DIAG', setId: s.id, summary: s.diag.summary() });
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
      case 'ready':
        this.out({ type: 'READY', via });
        this.note('✓ Ready');
        return;
      case 'duck':
        this.out({ type: 'DUCK', via });
        this.note('⬇ Duck');
        return;
      case 'hop':
        this.out({ type: 'HOP', via });
        this.note('⬆ Hop');
        return;
    }
  }

  private onCalibration(s: CalState, changed: boolean): void {
    this.calibration = s;
    // The phone's position now is "where it belongs".
    if (changed && s.step === 'done') this.tilt?.setReference();
    const now = this.clock();
    // Progress bars don't need every frame; step changes go at once.
    if (!changed && now - this.lastCalSentAt < 100) return;
    this.lastCalSentAt = now;
    this.out({ type: 'CALIBRATION', step: s.step, progress: Math.max(0, Math.min(1, s.progress)), hint: s.hint, floorOk: s.floorOk });
  }

  private onExerciseEvent(setId: string, e: ExerciseEvent): void {
    if (e.type !== 'rep' || this.set?.id !== setId) return;
    this.out({ type: 'EXERCISE_REP', setId, exerciseId: e.exerciseId, index: e.index, source: e.source, ...(e.side ? { side: e.side } : {}), at: this.clock() });
    this.note(e.source === 'manual' ? '+1 rep (manual)' : '+1 rep');
  }
}
