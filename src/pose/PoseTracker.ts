import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { PoseFrame } from '../exercise/types';

/**
 * Camera + MediaPipe Pose Landmarker.
 *
 * Frames are processed in the browser and immediately discarded. Nothing is
 * recorded, stored, or uploaded; the WASM runtime and model are served from
 * this app's own origin.
 */
export type TrackerErrorCode = 'insecure' | 'unsupported' | 'denied' | 'notfound' | 'inuse' | 'model' | 'unknown';

export class TrackerError extends Error {
  constructor(
    readonly code: TrackerErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface TrackerFrame {
  frame: PoseFrame | null;
  /** Raw normalized landmarks (0..1) for drawing the overlay. */
  raw: NormalizedLandmark[] | null;
  now: number;
  fps: number;
}

const BASE = import.meta.env.BASE_URL;

let landmarkerPromise: Promise<PoseLandmarker> | null = null;
let landmarkerModel: string | null = null;

export async function loadLandmarker(model: 'full' | 'lite'): Promise<PoseLandmarker> {
  if (landmarkerPromise && landmarkerModel === model) return landmarkerPromise;
  if (landmarkerPromise) {
    const old = landmarkerPromise;
    landmarkerPromise = null;
    old.then((l) => l.close()).catch(() => {});
  }
  landmarkerModel = model;
  landmarkerPromise = (async () => {
    const fileset = await FilesetResolver.forVisionTasks(`${BASE}mediapipe/wasm`);
    const opts = (delegate: 'GPU' | 'CPU') => ({
      baseOptions: { modelAssetPath: `${BASE}models/pose_landmarker_${model}.task`, delegate },
      runningMode: 'VIDEO' as const,
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    try {
      return await PoseLandmarker.createFromOptions(fileset, opts('GPU'));
    } catch (e) {
      console.warn('GPU delegate unavailable, falling back to CPU', e);
      return await PoseLandmarker.createFromOptions(fileset, opts('CPU'));
    }
  })();
  landmarkerPromise.catch(() => {
    landmarkerPromise = null;
  });
  return landmarkerPromise;
}

/** Convert MediaPipe's normalized landmarks to isotropic detector input. */
export function toPoseFrame(raw: NormalizedLandmark[] | null, width: number, height: number, now: number): PoseFrame | null {
  if (!raw) return null;
  const aspect = width / height;
  return {
    timestamp: now,
    aspect,
    landmarks: raw.map((l) => ({ x: l.x * aspect, y: l.y, z: l.z, visibility: l.visibility ?? 0 })),
  };
}

/** Start downloading the model early (e.g. when a battle begins). */
export function preloadPose(model: 'full' | 'lite'): void {
  void loadLandmarker(model).catch(() => {});
}

const clock = () => performance.now();

export class PoseTracker {
  readonly video: HTMLVideoElement;
  private stream: MediaStream | null = null;
  private landmarker: PoseLandmarker | null = null;
  private running = false;
  private rafId: number | null = null;
  private lastVideoTime = -1;
  private lastTs = 0;
  private fps = 0;
  private lastResume = 0;
  private listeners = new Set<(f: TrackerFrame) => void>();
  private legacy: ((f: TrackerFrame) => void) | null = null;
  /** 'user' = front camera (you can see yourself); 'environment' = back camera. */
  facing: 'user' | 'environment' = 'user';
  /** A specific camera (from listCameras); overrides `facing` when set. */
  deviceId: string | null = null;
  /** Ask for the camera's widest zoom (e.g. 0.5× on phones that expose it). */
  wide = false;

  constructor() {
    this.video = document.createElement('video');
    this.video.setAttribute('playsinline', '');
    this.video.setAttribute('muted', '');
    this.video.muted = true;
    this.video.autoplay = true;
    this.park();
    // If anything pauses the stream (iOS does this on DOM moves, interruptions
    // or returning from the background), start it again while we're running.
    this.video.addEventListener('pause', () => this.resume());
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && this.resume());
  }

  private resume(): void {
    if (this.running && this.video.paused && this.video.srcObject) void this.video.play().catch(() => {});
  }

  /**
   * Keep the video in the document when no panel is showing it: iOS Safari
   * can stop delivering frames to a detached <video>.
   */
  park(): void {
    const v = this.video;
    v.className = 'cam-parked';
    if (typeof document !== 'undefined' && document.body) document.body.appendChild(v);
  }

  get active(): boolean {
    return this.running;
  }

  /** Replace the single "owner" listener (kept for the classic battle and the lab). */
  onFrame(fn: ((f: TrackerFrame) => void) | null): void {
    if (this.legacy) this.listeners.delete(this.legacy);
    this.legacy = fn;
    if (fn) this.listeners.add(fn);
  }

  /** Add a listener; frames go to every listener. Returns an unsubscribe. */
  subscribe(fn: (f: TrackerFrame) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  async start(model: 'full' | 'lite'): Promise<void> {
    if (this.running) return;
    if (!window.isSecureContext) throw new TrackerError('insecure', 'The camera needs a secure (HTTPS) connection.');
    if (!navigator.mediaDevices?.getUserMedia) throw new TrackerError('unsupported', 'This browser does not support camera access.');

    try {
      // 720p gives the pose model enough pixels for a whole body 2.5–3 m away.
      const size = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };
      const pick = this.deviceId ? { deviceId: { exact: this.deviceId } } : { facingMode: this.facing };
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { ...pick, ...size } });
      } catch (e) {
        // A remembered camera may be gone (other phone, iOS update): fall back.
        if (!this.deviceId || (e as DOMException)?.name !== 'OverconstrainedError') throw e;
        this.deviceId = null;
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: this.facing, ...size } });
      }
      if (this.wide) await this.applyWidest();
    } catch (e) {
      const name = (e as DOMException)?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') throw new TrackerError('denied', 'Camera permission was denied.');
      if (name === 'NotFoundError' || name === 'OverconstrainedError') throw new TrackerError('notfound', 'No camera was found.');
      if (name === 'NotReadableError') throw new TrackerError('inuse', 'The camera is in use by another app.');
      throw new TrackerError('unknown', `Could not start the camera (${name ?? 'unknown error'}).`);
    }

    this.video.srcObject = this.stream;
    try {
      await this.video.play();
    } catch {
      /* autoplay with muted+playsinline normally succeeds; frames still arrive */
    }

    try {
      this.landmarker = await loadLandmarker(model);
    } catch (e) {
      this.stop();
      throw new TrackerError('model', `Pose model failed to load: ${(e as Error)?.message ?? e}`);
    }

    this.running = true;
    this.resume(); // in case the stream was paused while the model loaded
    this.loop();
  }

  /**
   * Test hook (only reachable via ?debug): stop emitting real camera results
   * and emit injected frames instead, so browser automation can drive the
   * real app with a synthetic body.
   */
  simulated = false;
  inject(frame: PoseFrame | null, now: number): void {
    const raw = frame ? frame.landmarks.map((l) => ({ x: l.x / frame.aspect, y: l.y, z: l.z, visibility: l.visibility })) : null;
    const f = { frame, raw, now, fps: 30 };
    this.listeners.forEach((l) => l(f));
  }

  private loop = (): void => {
    if (!this.running) return;
    if (this.simulated) {
      this.rafId = requestAnimationFrame(this.loop);
      return;
    }
    this.rafId = requestAnimationFrame(this.loop);
    const v = this.video;
    if (v.paused && clock() - this.lastResume > 1000) {
      this.lastResume = clock();
      this.resume();
    }
    if (!this.landmarker || v.readyState < 2 || v.videoWidth === 0) return;
    if (v.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = v.currentTime;

    const now = performance.now();
    if (this.lastTs) this.fps = this.fps * 0.9 + (1000 / Math.max(1, now - this.lastTs)) * 0.1;
    this.lastTs = now;

    let raw: NormalizedLandmark[] | null = null;
    try {
      const res = this.landmarker.detectForVideo(v, now);
      raw = res.landmarks?.[0] ?? null;
    } catch (e) {
      console.warn('pose detection failed for a frame', e);
    }

    const frame = toPoseFrame(raw, v.videoWidth, v.videoHeight, now);
    const f = { frame, raw, now, fps: this.fps };
    this.listeners.forEach((l) => l(f));
  };

  /** Video cameras this browser exposes (labels appear once permission is granted). */
  async listCameras(): Promise<{ id: string; label: string }[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const all = await navigator.mediaDevices.enumerateDevices();
    return all.filter((d) => d.kind === 'videoinput').map((d, i) => ({ id: d.deviceId, label: d.label || `Camera ${i + 1}` }));
  }

  /** Zoom range of the running camera, if the browser exposes one. */
  zoomRange(): { min: number; max: number } | null {
    const t = this.stream?.getVideoTracks()[0];
    const caps = (t?.getCapabilities?.() ?? {}) as { zoom?: { min: number; max: number } };
    return caps.zoom ? { min: caps.zoom.min, max: caps.zoom.max } : null;
  }

  private async applyWidest(): Promise<void> {
    const t = this.stream?.getVideoTracks()[0];
    const z = this.zoomRange();
    if (!t || !z || z.min >= 1) return;
    try {
      await t.applyConstraints({ advanced: [{ zoom: z.min } as MediaTrackConstraintSet] });
    } catch {
      /* not supported on this camera */
    }
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.lastVideoTime = -1;
  }
}

/** One tracker for the whole app; the camera runs only during battles. */
export const tracker = new PoseTracker();

/** Skeleton connections for the overlay. */
export const POSE_LINKS: [number, number][] = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [27, 31],
  [28, 32],
];
