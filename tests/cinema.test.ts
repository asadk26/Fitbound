import { describe, expect, it } from 'vitest';
import { defaultSave, loadSave, sanitize, writeSave } from '../src/game/save';
import { CinemaRunner, CPS, GUARD_MS, type Script } from '../src/story/cinema';
import { OPENING, ritualReason, ritualScript } from '../src/story/scripts';

class Mem {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

const tiny: Script = {
  id: 't',
  beats: [
    { set: 'dark', sound: { rain: 0.5 }, ms: 1000 },
    { line: { id: 'a', who: 'elara', text: 'Hello there.' } },
    { cues: ['x'], sound: { heart: 50 }, ms: 500 },
    { line: { id: 'b', who: 'hero', text: 'Hi.' } },
  ],
};

describe('the cinematic runner', () => {
  it('staging beats move on by themselves; lines wait for the player', () => {
    const seen: number[] = [];
    let done: boolean | null = null;
    const r = new CinemaRunner(tiny, { onBeat: (_b, i) => seen.push(i), onDone: (s) => (done = s) });
    r.start();
    r.tick(999);
    expect(r.index).toBe(0);
    r.tick(2);
    expect(r.index).toBe(1);
    // A line never times out.
    r.tick(60_000);
    expect(r.index).toBe(1);
    r.advance();
    expect(r.index).toBe(2);
    expect(r.sound).toMatchObject({ rain: 0.5, heart: 50 });
    r.tick(500);
    r.tick(GUARD_MS);
    r.tick(1000);
    r.advance();
    expect(done).toBe(false);
    expect(seen).toEqual([0, 1, 2, 3]);
  });

  it('the first press finishes the text; the next moves on; a press right away is ignored', () => {
    const r = new CinemaRunner(tiny);
    r.start();
    r.tick(1000);
    r.advance();
    expect(r.index).toBe(1);
    r.tick(GUARD_MS);
    expect(r.visibleChars()).toBe(Math.floor((GUARD_MS * CPS) / 1000));
    r.advance();
    expect(r.visibleChars()).toBe('Hello there.'.length);
    expect(r.index).toBe(1);
    r.advance();
    expect(r.index).toBe(2);
  });

  it('skipping ends it at once and says so', () => {
    let done: boolean | null = null;
    const r = new CinemaRunner(tiny, { onDone: (s) => (done = s) });
    r.start();
    r.skip();
    expect(done).toBe(true);
    expect(r.done).toBe(true);
    r.tick(5000);
    r.advance();
    expect(r.index).toBe(0);
  });
});

describe('the opening', () => {
  const lines = OPENING.beats.filter((b) => b.line).map((b) => b.line!);
  const text = lines.map((l) => l.text);

  it('keeps the agreed lines, in order, and ends on the way into setup', () => {
    for (const l of ['A street. A name. A song.', 'That’s enough to start with.', 'The Heart will give you what it remembers.', 'It may not be what you remember.']) expect(text).toContain(l);
    expect(text.at(-1)).toBe('Come. Let’s see what the Heart has remembered of you.');
    expect(text.indexOf('The Heart will give you what it remembers.')).toBeLessThan(text.indexOf('It may not be what you remember.'));
  });

  it('never slips: no “welcome back”, no explaining the Haze', () => {
    const all = text.join(' ').toLowerCase();
    expect(all).not.toContain('welcome');
    expect(all).not.toContain('echo');
    expect(all).not.toContain('different every time');
  });

  it('is built from the four stages, with Elara unseen until the garden', () => {
    const sets = OPENING.beats.filter((b) => b.set).map((b) => b.set);
    expect(sets).toEqual(['dark', 'memory', 'heart', 'sanctuary']);
    const firstGarden = OPENING.beats.findIndex((b) => b.set === 'sanctuary');
    OPENING.beats.slice(0, firstGarden).forEach((b) => b.line && expect(b.line.offscreen).toBe(true));
    OPENING.beats.slice(firstGarden).forEach((b) => b.line && expect(b.line.offscreen).toBeFalsy());
  });

  it('rain from the first moment, muffled in the cavern, the heartbeat under it', () => {
    const r = new CinemaRunner(OPENING);
    const at: Record<string, { rain: number; muffled: boolean; heart: number }> = {};
    const r2 = new CinemaRunner(OPENING, { onBeat: (b, _i, s) => b.set && (at[b.set] = { ...s }) });
    r2.start();
    while (!r2.done) {
      r2.tick(10_000);
      r2.tick(GUARD_MS);
      r2.advance();
    }
    expect(at.dark.rain).toBeGreaterThan(0);
    expect(at.heart).toMatchObject({ muffled: true });
    expect(at.heart.heart).toBeGreaterThan(0);
    expect(at.sanctuary).toMatchObject({ muffled: false });
    expect(at.sanctuary.rain).toBeGreaterThan(0);
    expect(r.done).toBe(false);
  });

  it('every line has its own id, ready for recorded voice later', () => {
    const ids = lines.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('the reconstruction ritual', () => {
  it('about ten seconds of staging plus one line', () => {
    for (const reason of ['victory', 'fell', 'ended', 'suspended', 'return', 'longAway'] as const) {
      const s = ritualScript(reason, 3);
      const ms = s.beats.reduce((a, b) => a + (b.ms ?? 0), 0);
      expect(ms).toBeLessThanOrEqual(7000);
      expect(s.beats.filter((b) => b.line)).toHaveLength(1);
    }
  });

  it('the first restoration: she listens before she speaks', () => {
    const s = ritualScript('firstRestoration', 0);
    const lines = s.beats.filter((b) => b.line).map((b) => b.line!.text);
    expect(lines[0]).toBe('Listen.');
    expect(lines).toHaveLength(2);
  });

  it('fits how the hero left, or how long he was away', () => {
    expect(ritualReason({ outcome: 'victory', firstRestoration: true })).toBe('firstRestoration');
    expect(ritualReason({ outcome: 'victory' })).toBe('victory');
    expect(ritualReason({ outcome: 'defeat' })).toBe('fell');
    expect(ritualReason({ outcome: 'ended', fell: true })).toBe('fell');
    expect(ritualReason({ outcome: 'ended' })).toBe('ended');
    expect(ritualReason({ outcome: 'suspended' })).toBe('suspended');
    expect(ritualReason({ daysAway: 1 })).toBe('return');
    expect(ritualReason({ daysAway: 6 })).toBe('longAway');
    expect(ritualScript('victory', 0).beats.find((b) => b.line)!.line!.text).not.toBe(ritualScript('victory', 1).beats.find((b) => b.line)!.line!.text);
  });
});

describe('story progress in the save', () => {
  it('defaults to a first launch and survives a reload', () => {
    expect(defaultSave().story).toEqual({ openingSeen: false, restored: false, rituals: 0, lastVisit: 0 });
    const s = defaultSave();
    s.story = { openingSeen: true, restored: true, rituals: 4, lastVisit: 123 };
    const m = new Mem();
    writeSave(s, m);
    expect(loadSave(m).story).toEqual(s.story);
  });

  it('a damaged story block falls back safely', () => {
    expect(sanitize({ story: { openingSeen: 'yes', rituals: -3, lastVisit: 'x' } }).story).toEqual({ openingSeen: true, restored: false, rituals: 0, lastVisit: 0 });
    expect(sanitize({}).story.openingSeen).toBe(false);
  });
});
