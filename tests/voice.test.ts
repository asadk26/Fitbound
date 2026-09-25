import { describe, expect, it } from 'vitest';
import { InputHub, type InputEvent } from '../src/input/InputHub';
import { matchCommand, ResultTracker, VoiceGate } from '../src/input/voice';

describe('voice command matching', () => {
  it('recognises the four commands and a few natural variants', () => {
    expect(matchCommand('Pause')).toBe('pause');
    expect(matchCommand('okay pause')).toBe('pause');
    expect(matchCommand('Paws.')).toBe('pause');
    expect(matchCommand('resume')).toBe('resume');
    expect(matchCommand('Resume the game please')).toBe('resume');
    expect(matchCommand('finish set')).toBe('finish');
    expect(matchCommand('Finish the set')).toBe('finish');
    expect(matchCommand("I'm done")).toBe('finish');
    expect(matchCommand('re-calibrate')).toBe('recalibrate');
    expect(matchCommand('Recalibrate.')).toBe('recalibrate');
  });

  it('ignores commands buried in ordinary speech', () => {
    expect(matchCommand('we should pause for a sec')).toBeNull();
    expect(matchCommand('I think I can finish the set if I try')).toBeNull();
    expect(matchCommand('let me grab a drink then resume')).toBeNull();
    expect(matchCommand('the skeleton is almost done')).toBeNull();
    expect(matchCommand('')).toBeNull();
    expect(matchCommand('push ups')).toBeNull();
  });

  it('one utterance fires once, even as interim results keep arriving', () => {
    const t = new ResultTracker();
    expect(t.take('1:0', 'pause', false)).toBe('pause');
    expect(t.take('1:0', 'pause', false)).toBeNull();
    expect(t.take('1:0', 'pause', true)).toBeNull();
    // Interim fragments only fire on an exact phrase; the final result decides the rest.
    expect(t.take('1:1', 'okay finish the', false)).toBeNull();
    expect(t.take('1:1', 'okay finish the set', true)).toBe('finish');
  });

  it('debounces repeats and never listens to the game talking', () => {
    let spoke = -Infinity;
    const g = new VoiceGate(undefined, () => spoke);
    expect(g.check('pause', 1000).ok).toBe(true);
    expect(g.check('pause', 2000)).toEqual({ ok: false, reason: 'repeat' });
    expect(g.check('resume', 1500)).toEqual({ ok: false, reason: 'too-soon' });
    expect(g.check('resume', 2200).ok).toBe(true);
    spoke = Infinity; // narrator speaking now
    expect(g.check('finish', 9000)).toEqual({ ok: false, reason: 'game-speaking' });
    spoke = 9500; // finished at 9.5 s
    expect(g.check('finish', 9800)).toEqual({ ok: false, reason: 'game-speaking' });
    expect(g.check('finish', 10_400).ok).toBe(true);
  });
});

describe('voice commands are mode-aware', () => {
  const hub = () => {
    const h = new InputHub();
    const evs: InputEvent[] = [];
    h.on((e) => evs.push(e));
    return { h, evs };
  };

  it('"finish set" exists only mid-set or in the pause menu; it never confirms dialogue or moves', () => {
    const { h, evs } = hub();
    for (const m of ['explore', 'dialogue', 'ready', 'dodge', 'calibration', 'off'] as const) {
      h.setMode(m);
      expect(h.press('finish', 'voice'), m).toBe(false);
    }
    h.setMode('exercise');
    expect(h.press('finish', 'voice')).toBe(true);
    h.setMode('menu');
    expect(h.press('finish', 'voice')).toBe(true);
    expect(evs.map((e) => e.type)).toEqual(['finish', 'finish']);
    expect(evs.every((e) => e.source === 'voice')).toBe(true);
  });

  it('"resume" only in menus; "pause" and "recalibrate" wherever pausing is allowed', () => {
    const { h } = hub();
    h.setMode('exercise');
    expect(h.press('resume', 'voice')).toBe(false);
    expect(h.press('pause', 'voice')).toBe(true);
    expect(h.press('recalibrate', 'voice')).toBe(true);
    h.setMode('menu');
    expect(h.press('resume', 'voice')).toBe(true);
    h.setMode('calibration');
    expect(h.press('recalibrate', 'voice')).toBe(false);
    expect(h.press('pause', 'voice')).toBe(false);
  });

  it('dodge mode only takes a duck, a hop or a pause', () => {
    const { h } = hub();
    h.setMode('dodge');
    expect(h.press('confirm', 'gamepad')).toBe(false);
    expect(h.press('finish', 'voice')).toBe(false);
    expect(h.press('duck', 'gamepad')).toBe(true);
    expect(h.press('hop', 'keyboard')).toBe(true);
    h.setMode('explore');
    expect(h.press('duck', 'gamepad')).toBe(false);
  });
});
