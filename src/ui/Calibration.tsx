import { useEffect, useRef, useState } from 'react';
import { audio } from '../game/audio';
import { CAL_STEPS, CalibrationFlow, type CalState } from '../input/calibration';
import { input } from '../input/InputHub';
import type { MotionReading } from '../input/motion';
import { tracker } from '../pose/PoseTracker';
import { CameraView } from './CameraView';
import { HoldRing, MotionMeter, useInputEvents, useMotion } from './motionUi';

/**
 * The setup checklist (see input/calibration.ts for the steps). Single-device
 * play runs the checks here against the local camera; in Connected Play the
 * phone runs them and the TV shows <CalibrationPanel> with the phone's state.
 */
export interface CalibrationResult {
  floorOk: boolean;
}

/** Voice and sound for step changes, and the hand-off once done. The PC is
 *  the only device that speaks. */
export function useCalibrationCues(state: CalState, onDone: (r: CalibrationResult) => void): void {
  const last = useRef<string | null>(null);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (last.current === state.step) return;
    const first = last.current === null;
    last.current = state.step;
    audio.say(CAL_STEPS.find((x) => x.id === state.step)!.say);
    if (!first) audio.gesture();
    if (state.step === 'done') {
      audio.levelUp();
      const id = window.setTimeout(() => done.current({ floorOk: state.floorOk }), 2200);
      return () => clearTimeout(id);
    }
  }, [state.step, state.floorOk]);
}

export function Calibration({ onDone, camera }: { onDone: (r: CalibrationResult) => void; camera: { state: string; message?: string } }) {
  const [state, setState] = useState<CalState>({ step: 'body', progress: 0, hint: null, floorOk: false });
  const flow = useRef<CalibrationFlow | null>(null);
  const r = useMotion();
  useCalibrationCues(state, onDone);

  useEffect(() => {
    input.setMode('calibration');
    const f = new CalibrationFlow(
      (s) => setState(s),
      (n) => input.setNeutral(n),
    );
    flow.current = f;
    return tracker.subscribe(({ frame }) => f.frame(frame, input.latest?.leanDir ?? 0));
  }, []);

  useInputEvents((e) => {
    if (e.type === 'confirm' || e.type === 'back' || e.type === 'step') flow.current?.event(e.type);
  });

  return (
    <CalibrationPanel state={state} r={r}>
      <CameraView className="calib-cam" good={r?.tracking === 'good'}>
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
    </CalibrationPanel>
  );
}

/** The checklist itself. `children` fills the left side (camera or controller status). */
export function CalibrationPanel({ state, r, children }: { state: CalState; r: MotionReading | null; children: React.ReactNode }) {
  const idx = Math.max(0, CAL_STEPS.findIndex((x) => x.id === state.step));
  const step = state.step;
  return (
    <div className="calib">
      {children}
      <div className="calib-side">
        <h2>Setup</h2>
        <ol className="calib-steps">
          {CAL_STEPS.slice(0, -1).map((s, i) => (
            <li key={s.id} className={i < idx ? 'done' : i === idx ? 'now' : ''}>
              {i < idx ? '✓ ' : ''}
              {s.title}
            </li>
          ))}
        </ol>
        <div className="calib-now">
          <b>{CAL_STEPS[idx].title}</b>
          {state.hint && <span className="calib-hint">{state.hint}</span>}
          {state.progress > 0 && step !== 'done' && (
            <div className="xpbar">
              <div style={{ width: `${state.progress * 100}%` }} />
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
