import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { EXERCISES, isPlayable, type ExerciseDefinition } from '../exercise/registry';
import type { Difficulty, DetectorUpdate, ExerciseDetector } from '../exercise/types';
import { loadLandmarker, POSE_LINKS, toPoseFrame, tracker } from '../pose/PoseTracker';
import { GUIDANCE } from '../ui/guidance';
import '../styles.css';
import './lab.css';

/**
 * Detector Lab: run the real exercise detectors against the live camera or a
 * recorded video and see every number behind each decision. Use it to check
 * camera placement and to tune thresholds on a real phone. Recorded videos
 * are analysed frame by frame on this device and never uploaded.
 */

interface LogLine {
  t: number;
  text: string;
  kind: 'rep' | 'partial' | 'info';
}

const PLAYABLE = EXERCISES.filter(isPlayable);

function Lab() {
  const [exId, setExId] = useState(PLAYABLE[0].id);
  const [difficulty, setDifficulty] = useState<Difficulty>('intermediate');
  const [source, setSource] = useState<'idle' | 'live' | 'file'>('idle');
  const [status, setStatus] = useState('Choose a source.');
  const [u, setU] = useState<DetectorUpdate | null>(null);
  const [reps, setReps] = useState(0);
  const [log, setLog] = useState<LogLine[]>([]);
  const [progress, setProgress] = useState(0);
  const detector = useRef<ExerciseDetector | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const fileVideo = useRef<HTMLVideoElement>(null);
  const cancel = useRef(false);
  const t0 = useRef(0);

  const ex: ExerciseDefinition = PLAYABLE.find((e) => e.id === exId)!;

  const resetDetector = () => {
    detector.current = ex.createDetector!(difficulty);
    setReps(0);
    setLog([]);
    setU(null);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(resetDetector, [exId, difficulty]);

  const feed = (raw: NormalizedLandmark[] | null, w: number, h: number, now: number, video: HTMLVideoElement) => {
    const d = detector.current;
    if (!d) return;
    const upd = d.update(toPoseFrame(raw, w, h, now), now);
    setU(upd);
    const secs = (now - t0.current) / 1000;
    if (upd.repCompleted) {
      setReps((r) => r + 1);
      setLog((l) => [{ t: secs, text: 'REP counted', kind: 'rep' as const }, ...l].slice(0, 200));
    } else if (upd.partialRep) {
      setLog((l) => [{ t: secs, text: `Partial rep ignored (${upd.guidance ? GUIDANCE[upd.guidance] : ''})`, kind: 'partial' as const }, ...l].slice(0, 200));
    }
    draw(canvas.current, video, raw, upd);
  };

  const startLive = async () => {
    stopAll();
    resetDetector();
    setSource('live');
    setStatus('Starting camera…');
    try {
      await tracker.start('full');
      t0.current = performance.now();
      setStatus('Live camera. Nothing is recorded.');
      tracker.onFrame(({ raw, now }) => feed(raw, tracker.video.videoWidth, tracker.video.videoHeight, now, tracker.video));
    } catch (e) {
      setStatus(`Camera error: ${(e as Error).message}`);
    }
  };

  const analyseFile = async (file: File) => {
    stopAll();
    resetDetector();
    setSource('file');
    const v = fileVideo.current!;
    v.src = URL.createObjectURL(file);
    await new Promise((r) => v.addEventListener('loadedmetadata', r, { once: true }));
    setStatus('Loading pose model…');
    const lm = await loadLandmarker('full');
    cancel.current = false;
    const fps = 30;
    const total = Math.floor(v.duration * fps);
    // Timestamps must increase across every call to the shared landmarker.
    const base = performance.now();
    t0.current = base;
    setStatus(`Analysing ${total} frames at ${fps} fps…`);
    for (let i = 0; i < total && !cancel.current; i++) {
      v.currentTime = i / fps;
      await new Promise((r) => v.addEventListener('seeked', r, { once: true }));
      const ts = base + (i * 1000) / fps;
      let raw: NormalizedLandmark[] | null = null;
      try {
        raw = lm.detectForVideo(v, ts).landmarks?.[0] ?? null;
      } catch {
        raw = null;
      }
      feed(raw, v.videoWidth, v.videoHeight, ts, v);
      if (i % 5 === 0) setProgress(i / total);
    }
    setProgress(1);
    setStatus(cancel.current ? 'Stopped.' : 'Done. Scroll the log to see each decision.');
  };

  const stopAll = () => {
    cancel.current = true;
    tracker.onFrame(null);
    tracker.stop();
    setSource('idle');
  };

  useEffect(() => () => stopAll(), []);

  const metrics = u?.metrics ?? {};
  return (
    <div className="lab">
      <header>
        <h1>
          FITBOUND <span>Detector Lab</span>
        </h1>
        <a href="./" className="btn btn-sm btn-ghost">
          ◂ Game
        </a>
      </header>
      <div className="lab-controls">
        <select value={exId} onChange={(e) => setExId(e.target.value)}>
          {PLAYABLE.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} ({e.camera.view} view)
            </option>
          ))}
        </select>
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
        <button className="btn btn-sm" onClick={startLive}>
          Live camera
        </button>
        <label className="btn btn-sm btn-ghost">
          Analyse a video…
          <input type="file" accept="video/*" hidden onChange={(e) => e.target.files?.[0] && analyseFile(e.target.files[0])} />
        </label>
        {source !== 'idle' && (
          <button className="btn btn-sm btn-warn" onClick={stopAll}>
            Stop
          </button>
        )}
        <button className="btn btn-sm btn-ghost" onClick={resetDetector}>
          Reset count
        </button>
      </div>
      <p className="lab-status">
        {status} {source === 'file' && progress < 1 && `${Math.round(progress * 100)}%`}
      </p>
      <div className="lab-main">
        <div className="lab-view">
          <canvas ref={canvas} />
          <video ref={fileVideo} muted playsInline hidden />
        </div>
        <div className="lab-side">
          <div className="lab-big">
            {ex.kind === 'hold' ? `${Math.floor((u?.holdMs ?? 0) / 1000)}s` : reps}
            <small>{ex.kind === 'hold' ? 'held' : 'reps'}</small>
          </div>
          <table>
            <tbody>
              <tr>
                <th>Phase</th>
                <td>{u?.phase ?? '—'}</td>
              </tr>
              <tr>
                <th>Tracking</th>
                <td className={`trk-${u?.tracking}`}>{u?.tracking ?? '—'}</td>
              </tr>
              <tr>
                <th>Confidence</th>
                <td>{u ? u.confidence.toFixed(2) : '—'}</td>
              </tr>
              <tr>
                <th>Ready</th>
                <td>{u ? String(u.ready) : '—'}</td>
              </tr>
              <tr>
                <th>Progress</th>
                <td>{u ? u.progress.toFixed(2) : '—'}</td>
              </tr>
              {Object.entries(metrics).map(([k, v]) => (
                <tr key={k}>
                  <th>{k}</th>
                  <td>{v}</td>
                </tr>
              ))}
              <tr>
                <th>Cue</th>
                <td>{u?.guidance ? GUIDANCE[u.guidance] : '—'}</td>
              </tr>
            </tbody>
          </table>
          <ol className="lab-log">
            {log.map((l, i) => (
              <li key={i} className={`log-${l.kind}`}>
                <span>{l.t.toFixed(1)}s</span> {l.text}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <p className="muted small lab-foot">
        Camera placement: {ex.camera.instructions.join(' ')} Everything runs on this device; videos you analyse are never uploaded.
      </p>
    </div>
  );
}

function draw(c: HTMLCanvasElement | null, v: HTMLVideoElement, raw: NormalizedLandmark[] | null, u: DetectorUpdate): void {
  if (!c || !v.videoWidth) return;
  if (c.width !== v.videoWidth) {
    c.width = v.videoWidth;
    c.height = v.videoHeight;
  }
  const ctx = c.getContext('2d')!;
  ctx.drawImage(v, 0, 0, c.width, c.height);
  if (!raw) return;
  ctx.lineWidth = 4;
  ctx.strokeStyle = u.tracking === 'good' ? '#73eff7' : '#ffcd75';
  for (const [a, b] of POSE_LINKS) {
    const la = raw[a];
    const lb = raw[b];
    if ((la?.visibility ?? 0) < 0.3 || (lb?.visibility ?? 0) < 0.3) continue;
    ctx.beginPath();
    ctx.moveTo(la.x * c.width, la.y * c.height);
    ctx.lineTo(lb.x * c.width, lb.y * c.height);
    ctx.stroke();
  }
  for (const l of raw) {
    if ((l.visibility ?? 0) < 0.3) continue;
    ctx.fillStyle = (l.visibility ?? 0) > 0.6 ? '#f4f4f4' : '#ef7d57';
    ctx.fillRect(l.x * c.width - 3, l.y * c.height - 3, 6, 6);
  }
}

createRoot(document.getElementById('root')!).render(<Lab />);
