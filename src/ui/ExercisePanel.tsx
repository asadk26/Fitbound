import { useEffect, useRef } from 'react';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { ExerciseDefinition } from '../exercise/registry';
import type { SessionSnapshot } from '../exercise/session';
import { iconDataUrl } from '../phaser/art';
import { POSE_LINKS, tracker } from '../pose/PoseTracker';
import { GUIDANCE } from './guidance';

export interface CameraStatus {
  state: 'idle' | 'starting' | 'running' | 'error';
  message?: string;
  fps?: number;
}

interface Props {
  exercise: ExerciseDefinition;
  snap: SessionSnapshot | null;
  camera: CameraStatus;
  rawRef: React.RefObject<NormalizedLandmark[] | null>;
  showSkeleton: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onManual: () => void;
  onManualRep: () => void;
  onManualHold: (running: boolean) => void;
  manualHoldRunning: boolean;
}

export function ExercisePanel(p: Props) {
  const videoHost = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { exercise: ex, snap, camera } = p;
  const isHold = ex.kind === 'hold';

  // Mount the tracker's <video> element (owned outside React).
  useEffect(() => {
    const host = videoHost.current;
    if (!host) return;
    const v = tracker.video;
    v.className = 'cam-video';
    host.prepend(v);
    return () => {
      if (v.parentElement === host) host.removeChild(v);
    };
  }, []);

  // Draw the landmark overlay at display rate, straight from the latest frame.
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = canvas.current;
      const v = tracker.video;
      if (!c || !v.videoWidth) return;
      const box = c.parentElement!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (c.width !== Math.round(box.width * dpr)) {
        c.width = Math.round(box.width * dpr);
        c.height = Math.round(box.height * dpr);
      }
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, c.width, c.height);
      const lms = p.rawRef.current;
      if (!p.showSkeleton || !lms) return;
      // Match object-fit: contain.
      const va = v.videoWidth / v.videoHeight;
      const ca = c.width / c.height;
      const w = va > ca ? c.width : c.height * va;
      const h = va > ca ? c.width / va : c.height;
      const ox = (c.width - w) / 2;
      const oy = (c.height - h) / 2;
      const pt = (l: NormalizedLandmark) => [ox + l.x * w, oy + l.y * h] as const;
      const good = snap?.last?.tracking === 'good';
      ctx.lineWidth = 4 * dpr;
      ctx.strokeStyle = good ? 'rgba(115,239,247,0.9)' : 'rgba(255,205,117,0.9)';
      for (const [a, b] of POSE_LINKS) {
        const la = lms[a];
        const lb = lms[b];
        if (!la || !lb || (la.visibility ?? 0) < 0.3 || (lb.visibility ?? 0) < 0.3) continue;
        const [x1, y1] = pt(la);
        const [x2, y2] = pt(lb);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      for (const i of [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
        const l = lms[i];
        if (!l || (l.visibility ?? 0) < 0.3) continue;
        const [x, y] = pt(l);
        ctx.fillStyle = (l.visibility ?? 0) > 0.6 ? '#f4f4f4' : '#ef7d57';
        ctx.fillRect(x - 4 * dpr, y - 4 * dpr, 8 * dpr, 8 * dpr);
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [p.rawRef, p.showSkeleton, snap?.last?.tracking]);

  const stage = snap?.stage ?? 'setup';
  const last = snap?.last;
  const tracking = camera.state !== 'running' ? 'lost' : (last?.tracking ?? 'lost');
  const confidence = last?.confidence ?? 0;
  const guidance = last?.guidance ? GUIDANCE[last.guidance] : null;
  const count = snap?.count ?? 0;
  const target = snap?.target ?? 0;
  const heldS = Math.floor((snap?.heldMs ?? 0) / 1000);
  const frac = isHold ? (snap?.heldMs ?? 0) / (target * 1000) : count / Math.max(1, target);
  const manual = snap?.manualMode ?? false;

  let big: React.ReactNode = null;
  if (snap?.paused) big = <div className="cam-big">PAUSED</div>;
  else if (stage === 'countdown') big = <div className="cam-big cam-count">{Math.max(1, Math.ceil((snap?.countdownLeftMs ?? 0) / 1000))}</div>;
  else if (stage === 'active' || stage === 'complete') {
    big = (
      <div className={`cam-big ${stage === 'complete' ? 'cam-done' : ''}`} key={isHold ? heldS : count}>
        {isHold ? (
          <>
            {heldS}
            <small>/{target}s</small>
          </>
        ) : (
          <>
            {count}
            <small>/{target}</small>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="cam-panel" style={{ ['--ability' as string]: ex.ability.color }}>
      <div className="cam-head">
        <img src={iconDataUrl(ex.ability.icon)} alt="" className="pix-icon" />
        <div className="cam-title">
          <b>{ex.ability.name}</b>
          <span>
            {ex.name} · {isHold ? `hold ${target}s` : `${target} reps`}
          </span>
        </div>
        <div className={`track-dot track-${tracking}`} title={`Tracking: ${tracking}`}>
          <i />
          <span>{camera.state === 'running' ? (tracking === 'good' ? 'Tracking' : tracking === 'partial' ? 'Weak' : 'Lost') : camera.state === 'starting' ? 'Starting…' : 'No camera'}</span>
          <meter min={0} max={1} value={confidence} />
        </div>
      </div>

      <div className="cam-view">
        <div className="cam-video-host" ref={videoHost}>
          <canvas ref={canvas} className="cam-overlay" />
        </div>
        {camera.state === 'starting' && <div className="cam-msg">Starting camera and pose model…</div>}
        {camera.state === 'error' && (
          <div className="cam-msg cam-error">
            <b>Camera unavailable</b>
            <span>{camera.message}</span>
            <span>You can still play by counting reps manually below.</span>
          </div>
        )}
        {big}
        <div className="cam-progress">
          <div style={{ width: `${Math.min(1, frac) * 100}%` }} />
        </div>
        {manual && <div className="manual-badge">MANUAL COUNT · not camera-verified</div>}
      </div>

      <div className="cam-info">
        {stage === 'setup' && !manual && (
          <>
            <ol className="cam-steps">
              {ex.camera.instructions.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <div className={`cue ${last?.ready ? 'cue-ok' : ''}`}>{last?.ready ? 'Hold still… starting' : (guidance ?? 'Looking for you…')}</div>
          </>
        )}
        {stage === 'countdown' && <div className="cue cue-ok">Get ready!</div>}
        {stage === 'active' && !manual && (
          <div className={`cue ${guidance ? '' : 'cue-ok'}`}>
            {guidance ?? (isHold ? (last?.holding ? 'Holding — great!' : 'Get into position') : `Phase: ${prettyPhase(last?.phase)}`)}
          </div>
        )}
        {stage === 'complete' && (
          <div className="cue cue-ok">
            Set complete! {snap && snap.manualReps === 0 && !manual ? '✓ camera-verified' : '(includes manual count)'}
          </div>
        )}
        {stage !== 'complete' && <p className="alt">Easier option: {ex.alternative}</p>}
      </div>

      {stage !== 'complete' && (
        <div className="cam-actions">
          {manual ? (
            isHold ? (
              <button className="btn btn-big" onPointerDown={() => p.onManualHold(!p.manualHoldRunning)}>
                {p.manualHoldRunning ? 'Stop timer' : 'Start hold timer'}
              </button>
            ) : (
              <button className="btn btn-big" onPointerDown={p.onManualRep}>
                +1 rep (manual)
              </button>
            )
          ) : snap?.fallbackAvailable || camera.state === 'error' ? (
            <button className="btn btn-warn" onClick={p.onManual}>
              Camera struggling? Count manually
            </button>
          ) : null}
          {snap?.paused ? (
            <button className="btn" onClick={p.onResume}>
              Resume
            </button>
          ) : (
            <button className="btn" onClick={p.onPause}>
              Pause
            </button>
          )}
          <button className="btn btn-ghost" onClick={p.onStop}>
            End set
          </button>
        </div>
      )}
    </div>
  );
}

function prettyPhase(phase?: string): string {
  if (!phase) return '—';
  return phase.toLowerCase().replace(/_/g, ' ');
}
