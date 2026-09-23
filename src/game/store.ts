import { loadSave, reconcileUnlocks, writeSave, type SaveData } from './save';

/**
 * The single source of truth for persistent game state. React subscribes via
 * useSyncExternalStore; Phaser scenes read it directly. Every update is
 * written to localStorage immediately (autosave).
 */
let current: SaveData = loadSave();
const listeners = new Set<() => void>();

export function getSave(): SaveData {
  return current;
}

export function updateSave(fn: (s: SaveData) => SaveData | void): SaveData {
  const draft = structuredClone(current);
  const next = reconcileUnlocks(fn(draft) ?? draft);
  current = next;
  writeSave(current);
  listeners.forEach((l) => l());
  return current;
}

export function replaceSave(s: SaveData): void {
  current = s;
  writeSave(current);
  listeners.forEach((l) => l());
}

export function subscribeSave(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
