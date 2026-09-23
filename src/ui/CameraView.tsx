import { useEffect, useRef } from 'react';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { POSE_LINKS, tracker } from '../pose/PoseTracker';

/**
 * The live camera feed with the detected skeleton drawn on top. Owns no
 * camera state: it borrows the shared tracker's <video> while mounted.
 * Mirrored for the front camera so it behaves like a mirror.
 */
export function CameraView({ className = '', skeleton = true, good = true, children }: { className?: string; skeleton?: boolean; good?: boolean; children?: React.ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const raw = useRef<NormalizedLandmark[] | null>(null);
  const goodRef = useRef(good);
  goodRef.current = good;

  useEffect(() => {
    const h = host.current;
    if (!h) return;
    const v = tracker.video;
    v.className = 'cam-video';
    h.prepend(v);
    const off = tracker.subscribe((f) => (raw.current = f.raw));
    return () => {
      off();
      if (v.parentElement === h) tracker.park();
    };
  }, []);

  useEffect(() => {
    let rafId = 0;
    const draw = () => {
      rafId = requestAnimationFrame(draw);
      const c = canvas.current;
      const v = tracker.video;
      if (!c || !v.videoWidth) return;
      const box = c.parentElement!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (c.width !== Math.round(box.width * dpr) || c.height !== Math.round(box.height * dpr)) {
        c.width = Math.round(box.width * dpr);
        c.height = Math.round(box.height * dpr);
      }
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, c.width, c.height);
      const lms = raw.current;
      if (!skeleton || !lms) return;
      const va = v.videoWidth / v.videoHeight;
      const ca = c.width / c.height;
      const w = va > ca ? c.width : c.height * va;
      const hh = va > ca ? c.width / va : c.height;
      const ox = (c.width - w) / 2;
      const oy = (c.height - hh) / 2;
      const pt = (l: NormalizedLandmark) => [ox + l.x * w, oy + l.y * hh] as const;
      const lw = Math.max(2, Math.min(c.width, c.height) / 90);
      ctx.lineWidth = lw;
      ctx.strokeStyle = goodRef.current ? 'rgba(115,239,247,0.95)' : 'rgba(255,205,117,0.95)';
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
        ctx.fillRect(x - lw, y - lw, lw * 2, lw * 2);
      }
    };
    draw();
    return () => cancelAnimationFrame(rafId);
  }, [skeleton]);

  return (
    <div className={`camview ${className}`}>
      <div className={`camview-feed ${tracker.facing === 'user' ? 'mirrored' : ''}`} ref={host}>
        <canvas ref={canvas} className="cam-overlay" />
      </div>
      {children}
    </div>
  );
}
