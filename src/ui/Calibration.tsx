import { useEffect, useRef, useState } from 'react';
import { bestSide, inclineFromHorizontal, inFrame, LM, SIDE } from '../exercise/geometry';
import type { PoseFrame } from '../exercise/types';
import { audio } from '../game/audio';
import { input } from '../input/InputHub';
import { measure, NeutralCalibrator } from '../input/motion';
import { tracker } from '../pose/PoseTracker';
import { CameraView } from './CameraView';
import { HoldRing, MotionMeter, useInputEvents, useMotion } from './motionUi';

/**
 * Hands-free setup, run once per session with the phone in its final spot.
 * Each check advances on its own when the camera sees it done:
 *
 *   body → arms → neutral → confirm → march → lean left → lean right →
 *   floor (push-up position) → stand up → done
 *
 * The floor check can be skipped with the left hand; the result is reported
 * so the trial can warn that push-ups may not track from this placement.
 */
type Step = 'body' | 'arms' | 'neutral' | 'confirm' | 'march' | 'leanL' | 'leanR' | 'floor' | 'stand' | 'done';

const STEPS: { id: Step; title: string; say: string }[] = [
  { id: 'body', title: 'Step back until your whole body is in view', say: 'Step back until your whole body is in view, head to feet.' },
  { id: 'arms', title: 'Raise BOTH hands high', say: 'Raise both hands high above your head.' },
  { id: 'neutral', title: 'Stand still, arms down', say: 'Now stand still with your arms down.' },
  { id: 'confirm', title: 'Raise your RIGHT hand to confirm', say: 'Raise your right hand and hold it to confirm.' },
  { id: 'march', title: 'March in place', say: 'March in place. Lift your knees.' },
  { id: 'leanL', title: 'Lean to your LEFT', say: 'Lean to your left.' },
  { id: 'leanR', title: 'Lean to your RIGHT', say: 'Now lean to your right.' },
  { id: 'floor', title: 'Floor check: turn sideways and get into push-up position', say: 'Floor check. Turn sideways and get down into push-up position. Raise your left hand to skip.' },
  { id: 'stand', title: 'Great — stand back up, facing the phone', say: 'Great. Stand back up, facing the phone.' },
  { id: 'done', title: 'All set!', say: 'Calibration complete. Let the trial begin!' },
];

export interface CalibrationResult {
  floorOk: boolean;
}

export function Calibration({ onDone, camera }: { onDone: (r: CalibrationResult) => void; camera: { state: string; message?: string } }) {
  const [step, setStepState] = useState<Step>('body');
  const stepRef = useRef<Step>('body');
  const [hint, setHint] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const counter = useRef(0);
  const cal = useRef(new NeutralCalibrator(30));
  const steps = useRef(0);
  const floorOk = useRef(false);
  const r = useMotion();

  const setStep = (s: Step) => {
    stepRef.current = s;
    counter.current = 0;
    setProgress(0);
    setHint(null);
    setStepState(s);
    const info = STEPS.find((x) => x.id === s)!;
    audio.say(info.say);
    if (s !== 'body') audio.gesture();
    if (s === 'done') {
      audio.levelUp();
      window.setTimeout(() => onDone({ floorOk: floorOk.current }), 2200);
    }
  };

  useEffect(() => {
    input.setMode('calibration');
    audio.say(STEPS[0].say);
    const need = (cond: boolean, frames: number) => {
      counter.current = cond ? counter.current + 1 : 0;
      setProgress(Math.min(1, counter.current / frames));
      return counter.current >= frames;
    };
    const off = tracker.subscribe(({ frame }) => {
      const s = stepRef.current;
      if (s === 'body') {
        const q = frameIssue(frame);
        setHint(q);
        if (need(q === null, 20)) setStep('arms');
      } else if (s === 'arms') {
        const ok = !!frame && armsUpInFrame(frame);
        setHint(frame && !ok ? 'Both hands above your head — make sure they stay in the picture' : null);
        if (need(ok, 12)) setStep('neutral');
      } else if (s === 'neutral') {
        const res = cal.current.push(frame);
        setProgress(res.progress);
        setHint(res.still ? null : 'Stand still and relaxed, arms down');
        if (res.neutral) {
          input.setNeutral(res.neutral);
          setStep('confirm');
        }
      } else if (s === 'leanL' || s === 'leanR') {
        const want = s === 'leanL' ? -1 : 1;
        if (need(input.latest?.leanDir === want, 12)) setStep(s === 'leanL' ? 'leanR' : 'floor');
      } else if (s === 'floor') {
        if (need(!!frame && onFloor(frame), 20)) {
          floorOk.current = true;
          setStep('stand');
        }
      } else if (s === 'stand') {
        if (need(!!frame && measure(frame).fullBody && frameIssue(frame) === null, 15)) setStep('done');
      }
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useInputEvents((e) => {
    const s = stepRef.current;
    if (s === 'confirm' && e.type === 'confirm') setStep('march');
    if (s === 'march' && e.type === 'step') {
      steps.current++;
      setProgress(Math.min(1, steps.current / 6));
      if (steps.current >= 6) setStep('leanL');
    }
    if (s === 'floor' && e.type === 'back') {
      floorOk.current = false;
      setStep('stand');
    }
  });

  const idx = STEPS.findIndex((x) => x.id === step);
  const tracking = r?.tracking ?? 'lost';
  return (
    <div className="calib">
      <CameraView className="calib-cam" good={tracking === 'good'}>
        {camera.state !== 'running' && (
          <div className="cam-msg">
            {camera.state === 'error' ? (
              <>
                <b>Camera unavailable</b>
                <span>{camera.message}</span>
              </>
            ) : (
              'Starting camera…'
            )}
          </div>
        )}
      </CameraView>
      <div className="calib-side">
        <h2>Setup</h2>
        <ol className="calib-steps">
          {STEPS.slice(0, -1).map((s, i) => (
            <li key={s.id} className={i < idx ? 'done' : i === idx ? 'now' : ''}>
              {i < idx ? '✓ ' : ''}
              {s.title}
            </li>
          ))}
        </ol>
        <div className="calib-now">
          <b>{STEPS[idx].title}</b>
          {hint && <span className="calib-hint">{hint}</span>}
          {progress > 0 && step !== 'done' && (
            <div className="xpbar">
              <div style={{ width: `${progress * 100}%` }} />
            </div>
          )}
          {step === 'confirm' && <HoldRing value={r?.hold.confirm ?? 0} label="confirm" hand="right" />}
          {step === 'floor' && <HoldRing value={r?.hold.back ?? 0} label="skip this check" hand="left" />}
          {(step === 'march' || step === 'leanL' || step === 'leanR') && <MotionMeter r={r} />}
        </div>
      </div>
    </div>
  );
}

/** Why the whole body isn't usable yet, or null if it is. */
function frameIssue(f: PoseFrame | null): string | null {
  if (!f) return 'No one in view — step in front of the phone';
  const l = f.landmarks;
  const vis = (i: number) => l[i].visibility >= 0.5 && inFrame(l[i], f.aspect, 0);
  const head = vis(LM.NOSE);
  const feet = vis(LM.L_ANKLE) && vis(LM.R_ANKLE);
  if (!head && !feet) return 'Move farther from the phone';
  if (!feet) return 'Your feet are cut off — step back, or tilt the phone down';
  if (!head) return 'Your head is cut off — step back, or tilt the phone up';
  if (l[LM.NOSE].y < 0.04 || Math.max(l[LM.L_ANKLE].y, l[LM.R_ANKLE].y) > 0.97) return 'A little farther back, please — leave some room around you';
  return null;
}

function armsUpInFrame(f: PoseFrame): boolean {
  const l = f.landmarks;
  const ok = (w: number) => l[w].visibility >= 0.5 && l[w].y < l[LM.NOSE].y - 0.03 && l[w].y > 0.01 && inFrame(l[w], f.aspect, 0);
  return ok(LM.L_WRIST) && ok(LM.R_WRIST);
}

/** Lying horizontally, side-on, with shoulder, hip and ankle visible. */
function onFloor(f: PoseFrame): boolean {
  const l = f.landmarks;
  const side = SIDE[bestSide(l, ['shoulder', 'hip', 'ankle'])];
  const vis = [side.shoulder, side.hip, side.ankle].every((i) => l[i].visibility >= 0.5 && inFrame(l[i], f.aspect, 0));
  return vis && inclineFromHorizontal(l[side.shoulder], l[side.ankle]) < 40;
}
