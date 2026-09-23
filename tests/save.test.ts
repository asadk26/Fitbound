import { describe, expect, it } from 'vitest';
import { defaultSave, loadSave, resetSave, SAVE_KEY, writeSave, type KeyValueStore } from '../src/game/save';
import { levelForXp, statsFor, xpProgress } from '../src/game/progression';

class MemoryStore implements KeyValueStore {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

describe('save system', () => {
  it('saves and reloads progress', () => {
    const store = new MemoryStore();
    const s = defaultSave();
    s.created = true;
    s.heroName = 'Asha';
    s.xp = 120;
    s.gold = 40;
    s.defeated = ['skeleton', 'golem'];
    s.loadout = ['pushup', 'plank'];
    s.settings.sound = false;
    s.settings.difficulty = 'advanced';
    s.location = { map: 'dungeon', x: 100, y: 200 };
    expect(writeSave(s, store)).toBe(true);

    const back = loadSave(store);
    expect(back.heroName).toBe('Asha');
    expect(back.xp).toBe(120);
    expect(back.gold).toBe(40);
    expect(back.defeated).toEqual(['skeleton', 'golem']);
    expect(back.loadout).toEqual(['pushup', 'plank']);
    expect(back.settings.sound).toBe(false);
    expect(back.settings.difficulty).toBe('advanced');
    expect(back.location).toEqual({ map: 'dungeon', x: 100, y: 200 });
  });

  it('reaching level 2 unlocks the plank on load', () => {
    const store = new MemoryStore();
    writeSave({ ...defaultSave(), xp: 60 }, store);
    expect(loadSave(store).unlocked).toContain('plank');
  });

  it('never equips an exercise without a working detector', () => {
    const store = new MemoryStore();
    writeSave({ ...defaultSave(), xp: 9999, loadout: ['reverse_lunge', 'pushup', 'mountain_climber'] }, store);
    const back = loadSave(store);
    expect(back.unlocked).toContain('reverse_lunge');
    expect(back.loadout).toEqual(['pushup']);
  });

  it('never equips a locked exercise', () => {
    const store = new MemoryStore();
    writeSave({ ...defaultSave(), xp: 0, loadout: ['plank', 'squat'] }, store);
    expect(loadSave(store).loadout).toEqual(['squat']);
  });

  it('recovers from a corrupted save', () => {
    const store = new MemoryStore();
    store.setItem(SAVE_KEY, '{not json');
    expect(loadSave(store)).toEqual(defaultSave());
    store.setItem(SAVE_KEY, JSON.stringify({ xp: -5, gold: 'lots', settings: { difficulty: 'godlike' } }));
    const s = loadSave(store);
    expect(s.xp).toBe(0);
    expect(s.gold).toBe(0);
    expect(s.settings.difficulty).toBe('beginner');
  });

  it('reset clears the save', () => {
    const store = new MemoryStore();
    writeSave({ ...defaultSave(), xp: 300 }, store);
    resetSave(store);
    expect(store.getItem(SAVE_KEY)).toBeNull();
    expect(loadSave(store).xp).toBe(0);
  });
});

describe('progression', () => {
  it('levels follow the XP table', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(59)).toBe(1);
    expect(levelForXp(60)).toBe(2);
    expect(xpProgress(100)).toEqual({ level: 2, into: 40, needed: 100 });
  });

  it('stats grow with level and upgrades', () => {
    expect(statsFor(1, { atk: 0, def: 0, mag: 0 })).toEqual({ maxHp: 100, atk: 10, def: 10, mag: 10 });
    expect(statsFor(3, { atk: 1, def: 0, mag: 2 })).toEqual({ maxHp: 130, atk: 16, def: 14, mag: 18 });
  });
});
