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

async function loadLandmarker(model: 'full' | 'lite'): Promise<PoseLandmarker> {
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

/** Start downloading the model early (e.g. when a battle begins). */
export function preloadPose(model: 'full' | 'lite'): void {
  void loadLandmarker(model).catch(() => {});
}

export class PoseTracker {
  readonly video: HTMLVideoElement;
  private stream: MediaStream | null = null;
  private landmarker: PoseLandmarker | null = null;
  private running = false;
  private rafId: number | null = null;
  private lastVideoTime = -1;
  private lastTs = 0;
  private fps = 0;
  private listener: ((f: TrackerFrame) => void) | null = null;

  constructor() {
    this.video = document.createElement('video');
    this.video.setAttribute('playsinline', '');
    this.video.setAttribute('muted', '');
    this.video.muted = true;
    this.video.autoplay = true;
  }

  get active(): boolean {
    return this.running;
  }

  onFrame(fn: ((f: TrackerFrame) => void) | null): void {
    this.listener = fn;
  }

  async start(model: 'full' | 'lite'): Promise<void> {
    if (this.running) return;
    if (!window.isSecureContext) throw new TrackerError('insecure', 'The camera needs a secure (HTTPS) connection.');
    if (!navigator.mediaDevices?.getUserMedia) throw new TrackerError('unsupported', 'This browser does not support camera access.');

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
      });
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
    this.loop();
  }

  private loop = (): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);
    const v = this.video;
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

    const aspect = v.videoWidth / v.videoHeight;
    const frame: PoseFrame | null = raw
      ? {
          timestamp: now,
          aspect,
          landmarks: raw.map((l) => ({ x: l.x * aspect, y: l.y, z: l.z, visibility: l.visibility ?? 0 })),
        }
      : null;
    this.listener?.({ frame, raw, now, fps: this.fps });
  };

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
