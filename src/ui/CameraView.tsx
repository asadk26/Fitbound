import { useEffect, useRef } from 'react';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { POSE_LINKS, tracker } from '../pose/PoseTracker';

/**
 * The live camera feed with the detected skeleton drawn on top.
 *
 * It paints the tracker's video frames onto its own canvas rather than
 * borrowing the <video> element: iOS Safari pauses a playing video whenever
 * it is moved in the DOM, which froze the camera (and pose tracking) the
 * moment one screen's preview handed over to the next. The video element now
 * never moves, and any number of previews can show it at once.
 */
export function CameraView({ className = '', skeleton = true, good = true, children }: { className?: string; skeleton?: boolean; good?: boolean; children?: React.ReactNode }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const raw = useRef<NormalizedLandmark[] | null>(null);
  const goodRef = useRef(good);
  goodRef.current = good;

  useEffect(() => tracker.subscribe((f) => (raw.current = f.raw)), []);

  useEffect(() => {
    let rafId = 0;
    const draw = () => {
      rafId = requestAnimationFrame(draw);
      const c = canvas.current;
      const v = tracker.video;
      if (!c) return;
      const box = c.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const cw = Math.max(1, Math.round(box.width * dpr));
      const chh = Math.max(1, Math.round(box.height * dpr));
      if (c.width !== cw || c.height !== chh) {
        c.width = cw;
        c.height = chh;
      }
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, c.width, c.height);
      if (!v.videoWidth || v.readyState < 2) return;
      // object-fit: contain
      const va = v.videoWidth / v.videoHeight;
      const ca = c.width / c.height;
      const w = va > ca ? c.width : c.height * va;
      const h = va > ca ? c.width / va : c.height;
      const ox = (c.width - w) / 2;
      const oy = (c.height - h) / 2;
      ctx.drawImage(v, ox, oy, w, h);

      const lms = raw.current;
      if (!skeleton || !lms) return;
      const pt = (l: NormalizedLandmark) => [ox + l.x * w, oy + l.y * h] as const;
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
      <div className={`camview-feed ${tracker.facing === 'user' ? 'mirrored' : ''}`}>
        <canvas ref={canvas} className="cam-overlay" />
      </div>
      {children}
    </div>
  );
}
