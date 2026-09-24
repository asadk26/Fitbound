import { describe, expect, it } from 'vitest';
import { ControllerBridge, VIEW_HIDE_MS } from '../src/controller/bridge';
import { PushupDetector } from '../src/exercise/detectors/pushup';
import { getExercise } from '../src/exercise/registry';
import { ExerciseSessionController, trialSessionOptions } from '../src/exercise/session';
import type { PoseFrame } from '../src/exercise/types';
import { speakable } from '../src/game/audio';
import { ControllerGate } from '../src/net/gate';
import { MAX_PEEK_CHARS, parseCtrlMsg, type CtrlMsg } from '../src/net/protocol';
import { missingParts, viewSummary } from '../src/net/view';
import { cycle, FRAME_MS, hold, pushupPose, standPose } from '../src/testing/poses';

describe('narration', () => {
  it('says "push ups", not "push U-P-S"', () => {
    expect(speakable('Do 10 push-ups!')).toBe('Do 10 push ups!');
    expect(speakable('One more Push-up')).toBe('One more push up');
    expect(speakable('Squats and jumping jacks')).toBe('Squats and jumping jacks');
  });
});

describe('push-ups start counting at once', () => {
  it('goes straight from position to counting, with no countdown', () => {
    const s = new ExerciseSessionController(getExercise('pushup'), new PushupDetector(), 5, () => {}, trialSessionOptions('pushup'));
    let t = 0;
    const stages: string[] = [];
    let activeAt = -1;
    let count = 0;
    for (const [i, a] of [...hold(170, 30), ...cycle(170, 80), ...hold(170, 5)].entries()) {
      t += FRAME_MS;
      const sn = s.update(pushupPose(a, t), t);
      stages.push(sn.stage);
      count = sn.count;
      if (sn.stage === 'active' && activeAt < 0) activeAt = i;
    }
    expect(stages).not.toContain('countdown');
    // In position within about half a second of the first frame.
    expect(activeAt * FRAME_MS).toBeLessThan(600);
    expect(count).toBe(1);
  });

  it('other exercises keep their countdown', () => {
    expect(trialSessionOptions('squat').countdownMs).toBeUndefined();
    expect(trialSessionOptions('pushup').countdownMs).toBe(0);
  });
});

describe('what the camera sees', () => {
  it('names hidden parts in words, with the body box in 0..1', () => {
    const f = pushupPose(170, 0);
    // Hide the wrists (something in front of the camera).
    const hidden: PoseFrame = { ...f, landmarks: f.landmarks.map((l, i) => (i === 15 || i === 16 ? { ...l, visibility: 0.1 } : l)) };
    const v = viewSummary(hidden);
    expect(v.parts.wrists).toBe(0);
    expect(v.parts.shoulders).toBeGreaterThan(0);
    expect(missingParts(v).missing).toContain('hands');
    for (const n of v.box!) expect(n).toBeGreaterThanOrEqual(-0.5);
    expect(v.box![2]).toBeLessThanOrEqual(1.5);
    expect(parseCtrlMsg({ seq: 1, epoch: 0, type: 'VIEW', view: v })).toBeTruthy();
    const nobody = viewSummary(null);
    expect(nobody.box).toBeNull();
    expect(Object.values(nobody.parts).every((p) => p === 0)).toBe(true);
  });

  it('validates VIEW, PEEK and the camera label', () => {
    const view = viewSummary(standPose(0));
    expect(parseCtrlMsg({ seq: 1, epoch: 0, type: 'VIEW', view: null })).toBeTruthy();
    expect(parseCtrlMsg({ seq: 1, epoch: 0, type: 'VIEW', view: { ...view, parts: { ...view.parts, head: 3 } } })).toBeNull();
    expect(parseCtrlMsg({ seq: 1, epoch: 0, type: 'VIEW', view: { ...view, box: [0, 0, 9, 1] } })).toBeNull();
    expect(parseCtrlMsg({ seq: 2, epoch: 0, type: 'PEEK', image: 'data:image/jpeg;base64,AAAA' })).toBeTruthy();
    expect(parseCtrlMsg({ seq: 2, epoch: 0, type: 'PEEK', image: null })).toBeTruthy();
    expect(parseCtrlMsg({ seq: 2, epoch: 0, type: 'PEEK', image: 'javascript:alert(1)' })).toBeNull();
    expect(parseCtrlMsg({ seq: 2, epoch: 0, type: 'PEEK', image: 'data:image/png;base64,AAAA' })).toBeNull();
    expect(parseCtrlMsg({ seq: 2, epoch: 0, type: 'PEEK', image: 'data:image/jpeg;base64,' + 'A'.repeat(MAX_PEEK_CHARS) })).toBeNull();
    const st = { seq: 3, epoch: 0, type: 'STATUS', camera: 'running', model: 'ready', calibrated: true, tracking: 'good' };
    expect((parseCtrlMsg({ ...st, cameraLabel: 'Back Ultra Wide Camera' }) as { cameraLabel?: string }).cameraLabel).toBe('Back Ultra Wide Camera');
    expect(parseCtrlMsg({ ...st, cameraLabel: 'x'.repeat(200) })).toBeNull();
    const gate = new ControllerGate();
    gate.bind('s');
    expect(gate.check('s', parseCtrlMsg({ seq: 4, epoch: 0, type: 'VIEW', view: null })!, { mode: 'exercise', epoch: 0 }).ok).toBe(true);
    expect(gate.check('s', parseCtrlMsg({ seq: 5, epoch: 0, type: 'PEEK', image: null })!, { mode: 'explore', epoch: 0 }).ok).toBe(true);
  });

  function run(peekEnabled: boolean) {
    let seq = 0;
    let now = 0;
    const sent: CtrlMsg[] = [];
    const bridge = new ControllerBridge((p) => sent.push({ ...p, seq: ++seq, epoch: bridge.epoch } as CtrlMsg), () => now);
    let grabs = 0;
    bridge.peek = () => (grabs++, 'data:image/jpeg;base64,AAAA');
    bridge.peekEnabled = peekEnabled;
    bridge.applyMode('menu', 1);
    const feed = (n: number, f: (t: number) => PoseFrame | null) => {
      for (let i = 0; i < n; i++) bridge.frame(f((now += FRAME_MS)), now);
    };
    feed(60, (t) => standPose(t));
    const before = sent.length;
    feed(90, () => null); // ~3 s lost
    const lost = sent.slice(before);
    feed(Math.ceil(VIEW_HIDE_MS / FRAME_MS) + 10, (t) => standPose(t));
    return { sent, lost, grabs };
  }

  it('the phone sends a words-only VIEW while it cannot see you, and clears it after', () => {
    const { sent, lost, grabs } = run(false);
    const views = lost.filter((m) => m.type === 'VIEW');
    expect(views.length).toBeGreaterThanOrEqual(4);
    expect(views.length).toBeLessThanOrEqual(7); // ~2 per second, not every frame
    expect(sent.some((m) => m.type === 'PEEK')).toBe(false);
    expect(grabs).toBe(0);
    const last = sent.filter((m) => m.type === 'VIEW').at(-1) as Extract<CtrlMsg, { type: 'VIEW' }>;
    expect(last.view).toBeNull();
  });

  it('the preview is opt-in: about one still a second while lost, then cleared', () => {
    const { sent, lost } = run(true);
    const peeks = lost.filter((m) => m.type === 'PEEK');
    expect(peeks.length).toBeGreaterThanOrEqual(2);
    expect(peeks.length).toBeLessThanOrEqual(4);
    const last = sent.filter((m) => m.type === 'PEEK').at(-1) as Extract<CtrlMsg, { type: 'PEEK' }>;
    expect(last.image).toBeNull();
  });
});
